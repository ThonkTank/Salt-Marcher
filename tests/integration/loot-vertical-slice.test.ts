import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { afterEach, describe, expect, it } from 'vitest'
import { LootService } from '../../src/core/application/loot-service.js'
import { CharacterLootStore } from '../../src/core/loot/character-loot-store.js'
import { PartyStore } from '../../src/core/party/party-store.js'
import { CampaignStore } from '../../src/core/persistence/sqlite/campaign-store.js'
import { SceneStore } from '../../src/core/scene/scene-store.js'
import { WorldLocationStore } from '../../src/core/worldplanner/location-store.js'
import { SessionGenerationService } from '../../src/utility/session-generation/session-generation-service.js'
import { BundledEncounterCatalogProvider } from '../../src/utility/session-generation/catalog-provider.js'
import { createLootCatalogIndex } from '../../src/core/loot/loot-catalog-index.js'
import { sha256EncounterEntropy } from '../../src/utility/session-generation/sha256-entropy.js'
import { systemGeneratorPresetId } from '../../src/shared/contracts/generator-presets.js'
import { defaultGeneratorConfig } from '../../src/shared/generator/system-generator-preset.js'
import { GeneratedRunStore } from '../../src/core/session-generation/generated-run-store.js'
import { GroupRewardCommandHandler } from '../../src/core/application/group-reward-command-handler.js'
import { CampaignRulesService } from '../../src/core/application/campaign-rules-service.js'
import { GroupRewardCommitHandler } from '../../src/core/application/group-reward-commit-handler.js'
import { CampaignUnitOfWork } from '../../src/core/application/campaign-unit-of-work.js'
import { LootOperationJournal } from '../../src/core/loot/loot-operation-journal.js'
import { LootProjectionStore } from '../../src/core/loot/loot-projection-store.js'
import { TreasureStore } from '../../src/core/loot/loot-store.js'
import { LivePlayService } from '../../src/core/encounter/live-combat.js'
import type { GeneratedTreasure } from '../../src/shared/contracts/session-generation.js'
import type { GroupRewardTreasureDraft } from '../../src/shared/contracts/loot.js'

const roots: string[] = []
const stores: CampaignStore[] = []

afterEach(() => {
  for (const store of stores.splice(0)) store.close()
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true })
})

function campaign() {
  const root = mkdtempSync(join(tmpdir(), 'salt-marcher-loot-'))
  roots.push(root)
  const campaigns = new CampaignStore(root)
  stores.push(campaigns)
  campaigns.create('Loot test')
  const db = campaigns.activeCampaignDatabase()
  const party = new PartyStore(db)
  const members = party.read().members
  party.setMembership(members[0]!.id, true, 0)
  party.setMembership(members[1]!.id, true, 1)
  return { campaigns, db, party, members }
}

describe('loot vertical slice', () => {
  it('keeps the durable Loot receipt schema frozen with one versioned result envelope', () => {
    const { db } = campaign()
    expect(columns(db, 'loot_operation_receipt')).toEqual([
      'command_id',
      'operation_type',
      'request_fingerprint',
      'target_id',
      'result_schema_version',
      'result_json'
    ])
    for (const table of [
      'loot_treasure',
      'loot_container',
      'loot_item',
      'loot_allocation',
      'character_loot_entry'
    ])
      expect(columns(db, table).some((column) => /json/i.test(column))).toBe(
        false
      )
    expect(() =>
      db
        .prepare(
          `INSERT INTO loot_operation_receipt (
             command_id, operation_type, request_fingerprint, target_id,
             result_schema_version, result_json
           ) VALUES (?, 'unknown', ?, ?, 1, '{}')`
        )
        .run(randomUUID(), 'f'.repeat(64), randomUUID())
    ).toThrow()
  })

  it('enforces schema 27 provenance and metadata invariants in SQLite', () => {
    const { db } = campaign()
    expect(columns(db, 'loot_item')).toContain('catalog_entry_kind')
    expect(columns(db, 'loot_container')).toContain('source_container_id')
    const loot = new LootService(() => db)
    const treasure = loot.create({
      commandId: randomUUID(),
      label: 'Constraints',
      anchor: { kind: 'unplaced' },
      items: [{ name: 'Münze', quantity: 1, unitValueCp: 1, stackable: true }]
    })
    const insert = db.prepare(
      `INSERT INTO loot_item (
         id, treasure_id, source_line_id, catalog_entry_kind, catalog_item_id,
         name, quantity, unit_value_cp, stackable, magic, rarity, curse_name,
         container_id, position
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)`
    )
    expect(() =>
      insert.run(
        randomUUID(),
        treasure.id,
        null,
        'magic_item',
        'magic:test',
        'Falsch',
        1,
        0,
        0,
        0,
        null,
        null,
        1
      )
    ).toThrow()
    expect(() =>
      insert.run(
        randomUUID(),
        treasure.id,
        null,
        'item',
        'item:test',
        'Unteilbar',
        2,
        1,
        0,
        0,
        null,
        null,
        1
      )
    ).toThrow()
  })

  it('binds a command id to one semantic request and its original result', () => {
    const { campaigns } = campaign()
    const loot = new LootService(() => campaigns.activeCampaignDatabase())
    const commandId = randomUUID()
    const input = {
      commandId,
      label: 'Original',
      anchor: { kind: 'unplaced' as const },
      items: [{ name: 'Münze', quantity: 1, unitValueCp: 1, stackable: true }]
    }
    const original = loot.create(input)
    const updateInput = {
      commandId: randomUUID(),
      treasureId: original.id,
      expectedRevision: original.revision,
      label: 'Später geändert',
      anchor: original.anchor,
      items: original.items.map((item) => ({
        id: item.id,
        name: item.name,
        quantity: item.quantity,
        unitValueCp: item.unitValueCp,
        stackable: item.stackable
      }))
    }
    const changed = loot.update(updateInput)
    expect(changed.label).toBe('Später geändert')
    expect(
      new LootService(() => campaigns.activeCampaignDatabase()).update(
        updateInput
      )
    ).toEqual(changed)
    expect(loot.update(updateInput)).toEqual(changed)
    expectIdempotencyConflict(() =>
      loot.update({ ...updateInput, label: 'Konflikt' })
    )
    expect(
      new LootService(() => campaigns.activeCampaignDatabase()).create(input)
    ).toEqual(original)
    expect(loot.create(input)).toEqual(original)
    try {
      loot.create({ ...input, label: 'Anderer Request' })
      throw new Error('Expected idempotency conflict')
    } catch (cause) {
      expect(cause).toMatchObject({ code: 'idempotency_conflict' })
    }
  })

  it('anchors multiple treasures to a group and projects them into the scene', () => {
    const { campaigns, db, party } = campaign()
    const scenes = new SceneStore(db)
    const sceneId = scenes.focusedSceneId()
    const groupId = scenes.saveGroup(
      sceneId,
      null,
      'Bergungsort',
      '',
      'neutral',
      [],
      scenes.revision(),
      null
    )
    const loot = new LootService(
      () => campaigns.activeCampaignDatabase(),
      () => new Date('2026-08-09T10:00:00.000Z')
    )
    const anchor = {
      kind: 'group' as const,
      sceneId,
      groupId,
      lastKnownLabel: 'ignored client label'
    }
    loot.create({
      commandId: randomUUID(),
      label: 'Truhe A',
      anchor,
      items: [
        { name: 'Rubin', quantity: 1, unitValueCp: 5_000, stackable: false }
      ]
    })
    loot.create({
      commandId: randomUUID(),
      label: 'Truhe B',
      anchor,
      items: [{ name: 'Silber', quantity: 8, unitValueCp: 10, stackable: true }]
    })

    const projection = loot.sceneProjection(sceneId)
    expect(projection.groupTreasures).toHaveLength(1)
    expect(projection.groupTreasures[0]?.groupId).toBe(groupId)
    expect(
      projection.groupTreasures[0]?.treasures.map((entry) => entry.label)
    ).toEqual(['Truhe A', 'Truhe B'])
    expect(projection.groupTreasures[0]?.treasures[0]?.anchor).toMatchObject({
      lastKnownLabel: 'Bergungsort'
    })
    expect(party.read().revision).toBe(2)
  })

  it('generates one group reward from the campaign XP policy and saves its provenance', () => {
    const { campaigns, db, party, members } = campaign()
    let partySnapshot = party.read()
    for (const member of partySnapshot.members.slice(0, 2)) {
      if (member.level === null)
        partySnapshot = party.update(
          member.id,
          {
            name: member.name,
            playerName: member.playerName,
            level: 3,
            passivePerception: member.passivePerception,
            armorClass: member.armorClass,
            movementSpeedFeet: member.movementSpeedFeet
          },
          partySnapshot.revision
        )
    }
    const scenes = new SceneStore(
      db,
      () => [],
      (id) =>
        party.read().members.some((member) => member.id === id && member.active)
    )
    const sceneId = scenes.focusedSceneId()
    for (const member of members.slice(0, 2))
      scenes.assignPartyMember(sceneId, member.id, true, scenes.revision())
    const groupId = scenes.saveGroup(
      sceneId,
      null,
      'Wolfsrudel',
      '',
      'hostile',
      [{ creatureId: 'wolf', quantity: 3 }],
      scenes.revision(),
      null
    )
    const rules = new CampaignRulesService(
      () => campaigns.activeCampaignDatabase(),
      () => new Date('2026-08-09T10:00:00.000Z')
    ).update({
      commandId: randomUUID(),
      expectedRevision: 0,
      rewardXpBasis: 'adjusted'
    })
    const catalog = new BundledEncounterCatalogProvider(
      join(process.cwd(), 'resources/sessiongeneration/catalog-2026-07-16')
    )
    const generation = new SessionGenerationService(
      catalog,
      sha256EncounterEntropy,
      () => ({
        id: systemGeneratorPresetId,
        revision: 0,
        config: defaultGeneratorConfig
      }),
      () => campaigns.activeCampaignDatabase(),
      () => new Date('2026-08-09T10:00:00.000Z')
    )
    const group = scenes
      .snapshot(party.read().members)
      .scenes[0]!.groups.find((candidate) => candidate.id === groupId)!
    const groupRewards = new GroupRewardCommandHandler(() => ({
      party,
      scenes,
      rules: { read: () => rules },
      generation
    }))
    const request = {
      sceneId,
      groupId,
      expectedSceneRevision: scenes.revision(),
      expectedGroupRevision: group.revision,
      expectedPartyRevision: party.read().revision,
      expectedCampaignRulesRevision: rules.revision,
      entries: group.entries.map((entry) => ({
        creatureId: entry.creatureId,
        quantity: entry.aliveQuantity,
        deadQuantity: entry.deadQuantity
      })),
      seed: 99_001
    }
    for (const changed of [
      { ...request, expectedSceneRevision: request.expectedSceneRevision + 1 },
      { ...request, expectedGroupRevision: request.expectedGroupRevision + 1 },
      { ...request, expectedPartyRevision: request.expectedPartyRevision + 1 },
      {
        ...request,
        expectedCampaignRulesRevision: request.expectedCampaignRulesRevision + 1
      }
    ])
      expectCapabilityCode(() => groupRewards.generate(changed), 'stale')
    expect(tableCount(db, 'session_generation_run')).toBe(0)

    const generated = groupRewards.generate(request).run
    expect(generated).toMatchObject({
      runKind: 'group_reward',
      input: {
        sceneId,
        groupId,
        rewardXpBasis: 'adjusted',
        baseXp: group.baseXp
      }
    })
    expect(generated.input.rewardXp).toBe(generated.input.adjustedXp)
    expect(generated.treasures).toHaveLength(1)
    expect(generated.treasures[0]!.rewardChannel).toBe('encounter')
    expect(tableCount(db, 'saved_encounter_plans')).toBe(0)
    expect(tableCount(db, 'session_planner_scenes')).toBe(0)
    expect(tableCount(db, 'loot_treasure')).toBe(0)
    const accepted = new LootService(() =>
      campaigns.activeCampaignDatabase()
    ).acceptGenerated({
      commandId: randomUUID(),
      runId: generated.id,
      generatedTreasureId: generated.treasures[0]!.id,
      label: 'Generated reward',
      anchor: { kind: 'group', sceneId, groupId, lastKnownLabel: 'ignored' }
    })
    expect(accepted.source).toEqual({
      kind: 'generated',
      runId: generated.id,
      generatedTreasureId: generated.treasures[0]!.id
    })
    expect(tableCount(db, 'loot_treasure')).toBe(1)
    scenes.setGroupArchived(sceneId, groupId, true, group.revision)
    expectCapabilityCode(
      () =>
        groupRewards.generate({
          ...request,
          expectedSceneRevision: scenes.revision(),
          expectedGroupRevision: group.revision + 1
        }),
      'validation_failed'
    )
    scenes.deleteGroup(sceneId, groupId, group.revision + 1)
    expectCapabilityCode(
      () =>
        groupRewards.generate({
          ...request,
          expectedSceneRevision: scenes.revision(),
          expectedGroupRevision: group.revision + 2
        }),
      'not_found'
    )
    expect(tableCount(db, 'session_generation_run')).toBe(1)
  })

  it('commits an unsaved group draft and its generated reward atomically and idempotently', () => {
    const { db, party, members } = campaign()
    let partySnapshot = party.read()
    for (const member of partySnapshot.members.slice(0, 2))
      partySnapshot = party.update(
        member.id,
        {
          name: member.name,
          playerName: member.playerName,
          level: 3,
          passivePerception: member.passivePerception,
          armorClass: member.armorClass,
          movementSpeedFeet: member.movementSpeedFeet
        },
        partySnapshot.revision
      )
    const scenes = new SceneStore(
      db,
      () => [],
      (id) => party.read().members.some((member) => member.id === id)
    )
    const sceneId = scenes.focusedSceneId()
    for (const member of members.slice(0, 2))
      scenes.assignPartyMember(sceneId, member.id, true, scenes.revision())
    const groupId = randomUUID()
    const entries = [
      { creatureId: 'wolf', quantity: 3, deadQuantity: 1 }
    ] as const
    const catalog = new BundledEncounterCatalogProvider(
      join(process.cwd(), 'resources/sessiongeneration/catalog-2026-07-16')
    )
    const generation = new SessionGenerationService(
      catalog,
      sha256EncounterEntropy,
      () => ({
        id: systemGeneratorPresetId,
        revision: 0,
        config: defaultGeneratorConfig
      }),
      () => db,
      () => new Date('2026-08-09T10:00:00.000Z')
    )
    const rules = new CampaignRulesService(() => db)
    const rewards = new GroupRewardCommandHandler(() => ({
      party,
      scenes,
      rules,
      generation
    }))
    const expectedSceneRevision = scenes.revision()
    const run = rewards.generate({
      sceneId,
      groupId,
      expectedSceneRevision,
      expectedGroupRevision: null,
      expectedPartyRevision: party.read().revision,
      expectedCampaignRulesRevision: rules.read().revision,
      entries,
      seed: 81_337
    }).run
    expect(run.input.groupEntries).toEqual(entries)
    expect(run.input.baseXp).toBe(150)
    expect(columns(db, 'session_generation_group_entry')).toEqual([
      'run_id',
      'position',
      'creature_id',
      'alive_quantity',
      'dead_quantity'
    ])
    expect(tableCount(db, 'session_generation_group_entry')).toBe(1)
    expect(new GeneratedRunStore(db).read(run.id)).toEqual(run)
    expect(scenes.groups(sceneId)).toHaveLength(0)
    expect(tableCount(db, 'loot_treasure')).toBe(0)

    const play = new LivePlayService(() => db)
    const commit = new GroupRewardCommitHandler(
      () => ({
        party: new PartyStore(db),
        scenes: new SceneStore(db),
        rules,
        catalog: {
          index: () => createLootCatalogIndex(catalog.loadFull())
        },
        generatedRuns: new GeneratedRunStore(db),
        treasures: new TreasureStore(db),
        groupCommands: {
          save: (input) =>
            play.saveSceneGroup(
              input.sceneId,
              input.groupId,
              input.name,
              input.note,
              input.disposition,
              input.entries,
              input.expectedSceneRevision,
              input.expectedGroupRevision,
              input.prospectiveGroupId
            ),
          result: (id, groupIds) => play.sceneGroupResult(id, groupIds)
        },
        journal: new LootOperationJournal(db),
        projections: new LootProjectionStore(db),
        now: () => '2026-08-09T10:01:00.000Z'
      }),
      (work) => new CampaignUnitOfWork(db).run(work)
    )
    const baseDraft = generatedTreasureDraft(run.treasures[0]!, 'Wolfsbeute')
    const addedContainerId = randomUUID()
    const treasureDraft: GroupRewardTreasureDraft = {
      label: 'Wolfsbeute bearbeitet',
      containers: [
        ...baseDraft.containers.slice(0, 1).map((container) => ({
          ...container,
          name: `${container.name} bearbeitet`
        })),
        {
          id: addedContainerId,
          origin: {
            kind: 'catalog',
            catalogContainerId: 'container:pouch'
          },
          name: 'Reisebeutel',
          capacity: 25
        }
      ],
      items: [
        {
          ...baseDraft.items[0]!,
          name: `${baseDraft.items[0]!.name} bearbeitet`,
          containerId: addedContainerId
        },
        {
          id: randomUUID(),
          origin: {
            kind: 'catalog',
            entryKind: 'item',
            catalogId: 'item:object:abacus'
          },
          name: 'Reise-Abakus',
          quantity: 2,
          unitValueCp: 250,
          stackable: true,
          containerId: addedContainerId
        },
        {
          id: randomUUID(),
          origin: {
            kind: 'catalog',
            entryKind: 'magic_item',
            catalogId: 'magic:arcana:common:bead-of-nourishment'
          },
          name: 'Perle der Wegzehrung',
          quantity: 1,
          unitValueCp: 0,
          stackable: false,
          containerId: null
        }
      ]
    }
    const input = {
      commandId: randomUUID(),
      runId: run.id,
      generatedTreasureId: run.treasures[0]!.id,
      treasureDraft,
      sceneId,
      groupId,
      expectedSceneRevision,
      expectedGroupRevision: null,
      name: 'Wolfsrudel',
      note: 'Gemeinsam bestätigt',
      disposition: 'hostile' as const,
      entries: [...entries]
    }
    expectCapabilityCode(
      () =>
        commit.commit({
          ...input,
          commandId: randomUUID(),
          entries: [{ creatureId: 'wolf', quantity: 2, deadQuantity: 1 }]
        }),
      'validation_failed'
    )
    expectCapabilityCode(
      () =>
        commit.commit({
          ...input,
          commandId: randomUUID(),
          treasureDraft: {
            ...input.treasureDraft,
            items: input.treasureDraft.items.map((item, index) =>
              index === 1
                ? {
                    ...item,
                    origin: {
                      kind: 'catalog' as const,
                      entryKind: 'item' as const,
                      catalogId: 'item:missing'
                    }
                  }
                : item
            )
          }
        }),
      'validation_failed'
    )
    expect(scenes.groups(sceneId)).toHaveLength(0)
    expect(tableCount(db, 'loot_treasure')).toBe(0)
    const result = commit.commit(input)
    expect(result.groupResult.scenePatch.sceneRevision).toBe(
      expectedSceneRevision + 1
    )
    expect(scenes.groups(sceneId)).toMatchObject([
      {
        id: groupId,
        name: 'Wolfsrudel',
        entries: [{ aliveQuantity: 3, deadQuantity: 1 }]
      }
    ])
    expect(result.treasure.anchor).toEqual({
      kind: 'group',
      sceneId,
      groupId,
      lastKnownLabel: 'Wolfsrudel'
    })
    expect(result.treasure.label).toBe('Wolfsbeute bearbeitet')
    expect(result.treasure.items).toHaveLength(3)
    expect(result.treasure.items[0]).toMatchObject({
      sourceLineId: run.treasures[0]!.items[0]!.id,
      name: `${run.treasures[0]!.items[0]!.name} bearbeitet`
    })
    expect(result.treasure.items[1]).toMatchObject({
      sourceLineId: null,
      catalogEntryKind: 'item',
      catalogItemId: 'item:object:abacus',
      provenance: {
        kind: 'catalog',
        catalogEntry: { kind: 'item', id: 'item:object:abacus' }
      },
      name: 'Reise-Abakus',
      quantity: 2,
      unitValueCp: 250,
      magic: false,
      rarity: null,
      curseName: null
    })
    expect(result.treasure.items[2]).toMatchObject({
      sourceLineId: null,
      catalogEntryKind: 'magic_item',
      catalogItemId: 'magic:arcana:common:bead-of-nourishment',
      magic: true,
      rarity: 'Common',
      curseName: null
    })
    const addedContainer = result.treasure.containers.find(
      (container) => container.name === 'Reisebeutel'
    )!
    expect(addedContainer).toMatchObject({ name: 'Reisebeutel', capacity: 25 })
    expect(result.treasure.items[0]!.containerId).toBe(addedContainer.id)
    expect(result.treasure.items[1]!.containerId).toBe(addedContainer.id)
    expect(commit.commit(input)).toEqual(result)
    expect(tableCount(db, 'loot_treasure')).toBe(1)
    expectIdempotencyConflict(() =>
      commit.commit({
        ...input,
        treasureDraft: { ...input.treasureDraft, label: 'Anderer Fund' }
      })
    )

    const savedGroup = scenes.groups(sceneId)[0]!
    const unchangedSceneRevision = scenes.revision()
    const secondRun = rewards.generate({
      sceneId,
      groupId,
      expectedSceneRevision: unchangedSceneRevision,
      expectedGroupRevision: savedGroup.revision,
      expectedPartyRevision: party.read().revision,
      expectedCampaignRulesRevision: rules.read().revision,
      entries,
      seed: 81_338
    }).run
    const unchanged = commit.commit({
      ...input,
      commandId: randomUUID(),
      runId: secondRun.id,
      generatedTreasureId: secondRun.treasures[0]!.id,
      treasureDraft: generatedTreasureDraft(
        secondRun.treasures[0]!,
        'Wolfsbeute'
      ),
      expectedSceneRevision: unchangedSceneRevision,
      expectedGroupRevision: savedGroup.revision
    })
    expect(unchanged.groupResult.scenePatch.sceneRevision).toBe(
      unchangedSceneRevision
    )
    expect(scenes.revision()).toBe(unchangedSceneRevision)
    expect(scenes.groups(sceneId)[0]!.revision).toBe(savedGroup.revision)
    expect(tableCount(db, 'loot_treasure')).toBe(2)
  })

  it('commits distribution and character provenance atomically and idempotently', () => {
    const { campaigns, db, party, members } = campaign()
    const loot = new LootService(
      () => campaigns.activeCampaignDatabase(),
      () => new Date('2026-08-09T10:00:00.000Z')
    )
    const treasure = loot.create({
      commandId: randomUUID(),
      label: 'Münzbeutel',
      anchor: { kind: 'unplaced' },
      items: [
        {
          name: 'Goldmünzen',
          quantity: 4,
          unitValueCp: 100,
          stackable: true
        }
      ]
    })
    const commandId = randomUUID()
    const input = {
      commandId,
      treasureId: treasure.id,
      expectedTreasureRevision: treasure.revision,
      expectedPartyRevision: party.read().revision,
      items: [
        {
          itemId: treasure.items[0]!.id,
          shares: [
            { characterId: members[0]!.id, quantity: 1 },
            { characterId: members[1]!.id, quantity: 2 }
          ]
        }
      ]
    }
    const result = loot.distribute(input)
    expect(result.treasure.items[0]?.allocatedQuantity).toBe(3)
    expect(result.createdEntries).toHaveLength(2)
    expect(result.createdEntries.map((entry) => entry.provenance)).toEqual([
      {
        kind: 'treasure_distribution',
        treasureLabel: 'Münzbeutel',
        recipientName: 'Alrik'
      },
      {
        kind: 'treasure_distribution',
        treasureLabel: 'Münzbeutel',
        recipientName: 'Brynn'
      }
    ])
    const changed = loot.update({
      commandId: randomUUID(),
      treasureId: result.treasure.id,
      expectedRevision: result.treasure.revision,
      label: 'Nach dem Award umbenannt',
      anchor: result.treasure.anchor,
      items: result.treasure.items.map((item) => ({
        id: item.id,
        name: item.name,
        quantity: item.quantity,
        unitValueCp: item.unitValueCp,
        stackable: item.stackable
      }))
    })
    expect(changed.label).toBe('Nach dem Award umbenannt')
    expect(
      new LootService(() => campaigns.activeCampaignDatabase()).distribute(
        input
      )
    ).toEqual(result)
    expect(loot.distribute(input)).toEqual(result)
    expectIdempotencyConflict(() =>
      loot.distribute({
        ...input,
        items: [
          {
            ...input.items[0]!,
            shares: [{ characterId: members[0]!.id, quantity: 2 }]
          }
        ]
      })
    )
    expect(
      new CharacterLootStore(db).ledger(members[0]!.id).entries
    ).toHaveLength(1)
  })

  it('rolls back the whole distribution when a recipient is not active', () => {
    const { campaigns, db, party, members } = campaign()
    const loot = new LootService(() => campaigns.activeCampaignDatabase())
    const treasure = loot.create({
      commandId: randomUUID(),
      label: 'Fund',
      anchor: { kind: 'unplaced' },
      items: [
        { name: 'Münzen', quantity: 2, unitValueCp: 10, stackable: true },
        { name: 'Ring', quantity: 1, unitValueCp: 50, stackable: false }
      ]
    })
    expect(() =>
      loot.distribute({
        commandId: randomUUID(),
        treasureId: treasure.id,
        expectedTreasureRevision: treasure.revision,
        expectedPartyRevision: party.read().revision,
        items: [
          {
            itemId: treasure.items[0]!.id,
            shares: [{ characterId: members[0]!.id, quantity: 1 }]
          },
          {
            itemId: treasure.items[1]!.id,
            shares: [{ characterId: members[2]!.id, quantity: 1 }]
          }
        ]
      })
    ).toThrow()
    expect(
      loot.read(treasure.id).items.every((item) => item.allocatedQuantity === 0)
    ).toBe(true)
    expect(
      new CharacterLootStore(db).ledger(members[0]!.id).entries
    ).toHaveLength(0)
    expect(
      new CharacterLootStore(db).ledger(members[2]!.id).entries
    ).toHaveLength(0)
  })

  it('moves one exclusive anchor and preserves unresolved group and location history', () => {
    const { campaigns, db } = campaign()
    const scenes = new SceneStore(db)
    const sceneId = scenes.focusedSceneId()
    const groupId = scenes.saveGroup(
      sceneId,
      null,
      'Versunkene Kiste',
      '',
      'neutral',
      [],
      scenes.revision(),
      null
    )
    const locations = new WorldLocationStore(db)
    const location = locations.create(
      {
        displayName: 'Alter Kai',
        tags: ['Hafen'],
        readAloud: '',
        notes: '',
        factionIds: [],
        encounterTableIds: []
      },
      locations.read().revision
    ).saved
    scenes.setLocation(sceneId, location.id, scenes.revision())
    const loot = new LootService(() => campaigns.activeCampaignDatabase())
    const first = loot.create({
      commandId: randomUUID(),
      label: 'Treibgut A',
      anchor: {
        kind: 'location',
        locationId: location.id,
        lastKnownLabel: 'client value'
      },
      items: [{ name: 'Tauwerk', quantity: 2, unitValueCp: 5, stackable: true }]
    })
    loot.create({
      commandId: randomUUID(),
      label: 'Treibgut B',
      anchor: {
        kind: 'location',
        locationId: location.id,
        lastKnownLabel: 'client value'
      },
      items: [{ name: 'Holz', quantity: 1, unitValueCp: 2, stackable: false }]
    })
    expect(loot.sceneProjection(sceneId).locationTreasures).toHaveLength(2)

    const moveInput = {
      commandId: randomUUID(),
      treasureId: first.id,
      expectedRevision: first.revision,
      anchor: {
        kind: 'group' as const,
        sceneId,
        groupId,
        lastKnownLabel: 'client value'
      }
    }
    const moved = loot.move(moveInput)
    expect(moved.anchor).toEqual({
      kind: 'group',
      sceneId,
      groupId,
      lastKnownLabel: 'Versunkene Kiste'
    })
    expect(loot.sceneProjection(sceneId).locationTreasures).toHaveLength(1)
    expect(
      loot
        .sceneProjection(sceneId)
        .groupTreasures[0]?.treasures.map((treasure) => treasure.id)
    ).toContain(first.id)
    expect(
      new LootService(() => campaigns.activeCampaignDatabase()).move(moveInput)
    ).toEqual(moved)
    expect(loot.move(moveInput)).toEqual(moved)
    expectIdempotencyConflict(() =>
      loot.move({ ...moveInput, anchor: { kind: 'unplaced' } })
    )

    scenes.setGroupArchived(sceneId, groupId, true, 0)
    scenes.deleteGroup(sceneId, groupId, 1)
    const unresolvedGroup = loot
      .inbox({ cursor: null, limit: 100 })
      .entries.find(
        (entry) =>
          entry.reason === 'missing_group' && entry.treasure.id === first.id
      )
    expect(unresolvedGroup).toMatchObject({
      reason: 'missing_group',
      lastKnownLabel: 'Versunkene Kiste'
    })
    expect(unresolvedGroup?.treasure.id).toBe(first.id)

    locations.delete(location.id, locations.read().revision)
    expect(loot.inbox({ cursor: null, limit: 100 }).entries).toContainEqual(
      expect.objectContaining({
        reason: 'missing_location',
        lastKnownLabel: 'Alter Kai'
      })
    )
  })

  it('supports partial, complete, stale, and non-stackable distribution rules', () => {
    const { campaigns, party, members } = campaign()
    const loot = new LootService(
      () => campaigns.activeCampaignDatabase(),
      () => new Date('2026-08-09T10:00:00.000Z')
    )
    const treasure = loot.create({
      commandId: randomUUID(),
      label: 'Teilbarer Fund',
      anchor: { kind: 'unplaced' },
      items: [
        { name: 'Silber', quantity: 4, unitValueCp: 10, stackable: true },
        { name: 'Siegelring', quantity: 1, unitValueCp: 500, stackable: false }
      ]
    })
    expect(() =>
      loot.distribute({
        commandId: randomUUID(),
        treasureId: treasure.id,
        expectedTreasureRevision: treasure.revision,
        expectedPartyRevision: party.read().revision,
        items: [
          {
            itemId: treasure.items[1]!.id,
            shares: [{ characterId: members[0]!.id, quantity: 2 }]
          }
        ]
      })
    ).toThrow()

    const partial = loot.distribute({
      commandId: randomUUID(),
      treasureId: treasure.id,
      expectedTreasureRevision: treasure.revision,
      expectedPartyRevision: party.read().revision,
      items: [
        {
          itemId: treasure.items[0]!.id,
          shares: [
            { characterId: members[0]!.id, quantity: 1 },
            { characterId: members[1]!.id, quantity: 1 }
          ]
        }
      ]
    })
    expect(partial.treasure.distributionState).toBe('partial')
    expect(partial.treasure.items[0]?.allocatedQuantity).toBe(2)
    expect(() =>
      loot.distribute({
        commandId: randomUUID(),
        treasureId: treasure.id,
        expectedTreasureRevision: treasure.revision,
        expectedPartyRevision: party.read().revision,
        items: [
          {
            itemId: treasure.items[0]!.id,
            shares: [{ characterId: members[0]!.id, quantity: 1 }]
          }
        ]
      })
    ).toThrow()

    const complete = loot.distribute({
      commandId: randomUUID(),
      treasureId: treasure.id,
      expectedTreasureRevision: partial.treasure.revision,
      expectedPartyRevision: party.read().revision,
      items: [
        {
          itemId: treasure.items[0]!.id,
          shares: [{ characterId: members[0]!.id, quantity: 2 }]
        },
        {
          itemId: treasure.items[1]!.id,
          shares: [{ characterId: members[1]!.id, quantity: 1 }]
        }
      ]
    })
    expect(complete.treasure.distributionState).toBe('complete')
    expect(
      complete.treasure.items.every(
        (item) => item.quantity === item.allocatedQuantity
      )
    ).toBe(true)
  })

  it('rejects a stale Party revision before writing allocations or ledger rows', () => {
    const { campaigns, db, party, members } = campaign()
    const loot = new LootService(() => campaigns.activeCampaignDatabase())
    const treasure = loot.create({
      commandId: randomUUID(),
      label: 'Revisionierter Fund',
      anchor: { kind: 'unplaced' },
      items: [{ name: 'Münzen', quantity: 3, unitValueCp: 10, stackable: true }]
    })
    const stalePartyRevision = party.read().revision
    const third = members[2]!
    party.setMembership(third.id, true, stalePartyRevision)

    expect(() =>
      loot.distribute({
        commandId: randomUUID(),
        treasureId: treasure.id,
        expectedTreasureRevision: treasure.revision,
        expectedPartyRevision: stalePartyRevision,
        items: [
          {
            itemId: treasure.items[0]!.id,
            shares: [{ characterId: members[0]!.id, quantity: 1 }]
          }
        ]
      })
    ).toThrow()
    expect(loot.read(treasure.id).items[0]?.allocatedQuantity).toBe(0)
    expect(
      new CharacterLootStore(db).ledger(members[0]!.id).entries
    ).toHaveLength(0)
  })

  it('accepts a generated treasure once and never mutates its immutable run', () => {
    const { campaigns, db, party, members } = campaign()
    const generation = new SessionGenerationService(
      new BundledEncounterCatalogProvider(
        join(process.cwd(), 'resources/sessiongeneration/catalog-2026-07-16')
      ),
      sha256EncounterEntropy,
      () => ({
        id: systemGeneratorPresetId,
        revision: 0,
        config: defaultGeneratorConfig
      }),
      () => campaigns.activeCampaignDatabase(),
      () => new Date('2026-08-09T10:00:00.000Z')
    )
    const generated = generation.generate({
      party: [{ level: 3, count: 2 }],
      adventureDayFraction: '0.6',
      encounterCount: 2,
      seed: 1_000
    })
    expect(generated.status).toBe('success')
    if (generated.status !== 'success') return
    const source = generated.run.treasures[0]!
    const loot = new LootService(() => campaigns.activeCampaignDatabase())
    const acceptInput = {
      commandId: randomUUID(),
      runId: generated.run.id,
      generatedTreasureId: source.id,
      label: 'Generated reward',
      anchor: { kind: 'unplaced' }
    } as const
    const accepted = loot.acceptGenerated(acceptInput)
    const repeated = loot.acceptGenerated({
      commandId: randomUUID(),
      runId: generated.run.id,
      generatedTreasureId: source.id,
      label: 'Generated reward',
      anchor: { kind: 'unplaced' }
    })
    expect(repeated.id).toBe(accepted.id)
    expect(
      db
        .prepare(
          'SELECT COUNT(*) AS value FROM loot_treasure WHERE source_run_id = ? AND source_treasure_id = ?'
        )
        .get(generated.run.id, source.id)
    ).toEqual({ value: 1 })

    const edited = loot.update({
      commandId: randomUUID(),
      treasureId: accepted.id,
      expectedRevision: accepted.revision,
      label: 'Vom GM bearbeitet',
      anchor: { kind: 'unplaced' },
      items: accepted.items.map((item) => ({
        id: item.id,
        name: item.name,
        quantity: item.quantity,
        unitValueCp: item.unitValueCp,
        stackable: item.stackable
      }))
    })
    expect(
      new GeneratedRunStore(db).read(generated.run.id)?.treasures[0]
    ).toEqual(source)
    expect(
      new LootService(() => campaigns.activeCampaignDatabase()).acceptGenerated(
        acceptInput
      )
    ).toEqual(accepted)
    expect(loot.acceptGenerated(acceptInput)).toEqual(accepted)
    expectIdempotencyConflict(() =>
      loot.acceptGenerated({ ...acceptInput, label: 'Konflikt' })
    )

    const awarded = loot.distribute({
      commandId: randomUUID(),
      treasureId: edited.id,
      expectedTreasureRevision: edited.revision,
      expectedPartyRevision: party.read().revision,
      items: [
        {
          itemId: edited.items[0]!.id,
          shares: [
            {
              characterId: members[0]!.id,
              quantity: edited.items[0]!.quantity
            }
          ]
        }
      ]
    }).createdEntries[0]!
    expect(awarded.rewardProvenance).toEqual({
      runId: generated.run.id,
      generatedTreasureId: source.id,
      rewardChannel: source.rewardChannel
    })
  })

  it('retains the original ledger row and appends a linked correction', () => {
    const { campaigns, party, members } = campaign()
    const loot = new LootService(() => campaigns.activeCampaignDatabase())
    const treasure = loot.create({
      commandId: randomUUID(),
      label: 'Korrektur-Fund',
      anchor: { kind: 'unplaced' },
      items: [
        { name: 'Perle', quantity: 1, unitValueCp: 100, stackable: false }
      ]
    })
    const awarded = loot.distribute({
      commandId: randomUUID(),
      treasureId: treasure.id,
      expectedTreasureRevision: treasure.revision,
      expectedPartyRevision: party.read().revision,
      items: [
        {
          itemId: treasure.items[0]!.id,
          shares: [{ characterId: members[0]!.id, quantity: 1 }]
        }
      ]
    }).createdEntries[0]!
    const before = loot.ledger(members[0]!.id)
    const correctionInput = {
      commandId: randomUUID(),
      characterId: members[0]!.id,
      entryId: awarded.id,
      expectedRevision: before.revision,
      itemName: 'Schwarze Perle',
      quantity: 1,
      unitValueCp: 150,
      status: 'sold',
      reason: 'Identifikation beim Händler'
    } as const
    const corrected = loot.correctLedger(correctionInput)
    expect(corrected.revision).toBe(before.revision + 1)
    expect(corrected.entries).toHaveLength(2)
    const original = corrected.entries.find((entry) => entry.id === awarded.id)!
    const correction = corrected.entries.find(
      (entry) => entry.source === 'correction'
    )!
    expect(original.supersededByEntryId).toBe(correction.id)
    expect(correction).toMatchObject({
      correctsEntryId: original.id,
      correctionReason: 'Identifikation beim Händler',
      itemName: 'Schwarze Perle',
      status: 'sold'
    })
    expect(
      new LootService(() => campaigns.activeCampaignDatabase()).correctLedger(
        correctionInput
      )
    ).toEqual(corrected)
    expect(loot.correctLedger(correctionInput)).toEqual(corrected)
    expectIdempotencyConflict(() =>
      loot.correctLedger({
        ...correctionInput,
        reason: 'Anderer semantischer Request'
      })
    )
  })
})

function generatedTreasureDraft(
  treasure: GeneratedTreasure,
  label: string
): GroupRewardTreasureDraft {
  const containerIds = new Map<string, string>()
  const containers = treasure.containers.map((container) => {
    const id = randomUUID()
    containerIds.set(container.id, id)
    return {
      id,
      origin: {
        kind: 'generator' as const,
        sourceContainerId: container.id
      },
      name: container.name,
      capacity: container.capacity
    }
  })
  return {
    label,
    containers,
    items: treasure.items.map((item) => ({
      id: randomUUID(),
      origin: { kind: 'generator', sourceLineId: item.id },
      name: item.name,
      quantity: item.quantity,
      unitValueCp: item.unitValueCp,
      stackable: item.stackable,
      containerId: item.containerId
        ? (containerIds.get(item.containerId) ?? null)
        : null
    }))
  }
}

function expectIdempotencyConflict(action: () => unknown): void {
  try {
    action()
    throw new Error('Expected idempotency conflict')
  } catch (cause) {
    expect(cause).toMatchObject({ code: 'idempotency_conflict' })
  }
}

function expectCapabilityCode(action: () => unknown, code: string): void {
  try {
    action()
    throw new Error(`Expected capability error ${code}`)
  } catch (cause) {
    expect(cause).toMatchObject({ code })
  }
}

function tableCount(
  db: ReturnType<CampaignStore['activeCampaignDatabase']>,
  table: string
): number {
  return (
    db.prepare(`SELECT COUNT(*) AS value FROM ${table}`).get() as {
      value: number
    }
  ).value
}

function columns(
  db: ReturnType<CampaignStore['activeCampaignDatabase']>,
  table: string
): string[] {
  return (
    db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>
  ).map((entry) => entry.name)
}
