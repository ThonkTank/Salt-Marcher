import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { LivePlayService } from '../../src/core/encounter/live-combat.js'
import { CampaignStore } from '../../src/core/persistence/sqlite/campaign-store.js'
import { uuidv7 } from '../../src/shared/ids/uuidv7.js'
import type { GeneratorPresetConfigV3 } from '../../src/shared/contracts/generator-presets.js'
import { defaultGeneratorConfig } from '../../src/shared/generator/system-generator-preset.js'
import { CampaignRulesService } from '../../src/core/application/campaign-rules-service.js'
import { seedExampleParty } from '../../src/core/party/party-example-seed.js'
import { activeCampaignDatabase } from '../support/campaign-store-test-access.js'

const roots: string[] = []

afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true })
})

function harness(generatorPreset?: {
  config: GeneratorPresetConfigV3
  id: string
  revision: number
}) {
  const root = mkdtempSync(join(tmpdir(), 'salt-marcher-live-play-'))
  roots.push(root)
  const campaigns = new CampaignStore(root)
  campaigns.create('Test Campaign')
  seedExampleParty(activeCampaignDatabase(campaigns))
  const play = new LivePlayService(
    campaigns.activeCampaignPersistence(),
    undefined,
    generatorPreset ? () => generatorPreset : undefined
  )
  return { campaigns, play }
}

function sessionAfter(play: LivePlayService, command: () => unknown) {
  command()
  return play.readSession()
}

describe('live party, scene groups and combat', () => {
  it('uses preset tuning and lets explicit Scene tuning override it', () => {
    const config = structuredClone(defaultGeneratorConfig)
    config.generationDefaults = {
      difficulty: 'deadly',
      amount: 'few',
      balance: 'even',
      diversity: 'low'
    }
    const preset = {
      config,
      id: '00000000-0000-4000-8000-000000000099',
      revision: 4
    }
    const { campaigns, play } = harness(preset)
    let party = play.readParty()
    for (const member of party.members)
      party = play.setMembership(member.id, true, party.revision)
    const session = play.readSession()
    const auto = play.generateGroupDraft(
      session.scene.focusedSceneId,
      [],
      'replace',
      {
        name: '',
        sizes: [],
        types: [],
        subtypes: [],
        biomes: [],
        alignments: [],
        encounterTableIds: [],
        factionIds: [],
        locationId: null,
        sort: 'name',
        direction: 'asc',
        offset: 0,
        limit: 50
      },
      {
        difficulty: 'preset',
        amount: 'preset',
        balance: 'preset',
        diversity: 'preset'
      },
      1,
      session.scene.revision
    )
    const explicit = play.generateGroupDraft(
      session.scene.focusedSceneId,
      [],
      'replace',
      {
        name: '',
        sizes: [],
        types: [],
        subtypes: [],
        biomes: [],
        alignments: [],
        encounterTableIds: [],
        factionIds: [],
        locationId: null,
        sort: 'name',
        direction: 'asc',
        offset: 0,
        limit: 50
      },
      {
        difficulty: 'trivial',
        amount: 'many',
        balance: 'varied',
        diversity: 'high'
      },
      1,
      session.scene.revision
    )

    expect(auto.name).toBe('Deadly-Gruppe')
    expect(auto.context).toMatchObject({
      generatorPresetId: preset.id,
      generatorPresetRevision: preset.revision
    })
    expect(explicit.name).toBe('Trivial-Gruppe')
    expect(explicit.context.generatorConfigHash).not.toBe(
      auto.context.generatorConfigHash
    )
    campaigns.close()
  })

  it('keeps production rosters empty and seeds examples only when requested', () => {
    const root = mkdtempSync(join(tmpdir(), 'salt-marcher-empty-party-'))
    roots.push(root)
    const campaigns = new CampaignStore(root)
    campaigns.create('Empty Party')
    const play = new LivePlayService(campaigns.activeCampaignPersistence())

    expect(play.readParty().members).toEqual([])
    const first = seedExampleParty(activeCampaignDatabase(campaigns))
    campaigns.close()

    const reopened = new CampaignStore(root)
    const second = new LivePlayService(
      reopened.activeCampaignPersistence()
    ).readParty()
    expect(() => seedExampleParty(activeCampaignDatabase(reopened))).toThrow(
      'empty roster'
    )
    reopened.close()

    expect(first.members.map((member) => member.name)).toEqual([
      'Alrik',
      'Brynn',
      'Cora',
      'Dain'
    ])
    expect(first.members.every((member) => !member.active)).toBe(true)
    expect(second).toEqual(first)
  })

  it('allocates the smallest free generic group name per scene', () => {
    const { campaigns, play } = harness()
    let session = play.readSession()
    const sceneId = session.scene.focusedSceneId
    const save = (
      name: string,
      groupId: string | null = null,
      expectedGroupRevision: number | null = null
    ) => {
      session = sessionAfter(play, () =>
        play.saveSceneGroup(
          sceneId,
          groupId,
          name,
          '',
          'hostile',
          [],
          session.scene.revision,
          expectedGroupRevision
        )
      )
      return session.scene.scenes[0]!.groups
    }

    let groups = save('   ')
    expect(groups[0]?.name).toBe('Gruppe 1')
    groups = save('\t', groups[0]!.id, groups[0]!.revision)
    expect(groups[0]?.name).toBe('Gruppe 1')
    groups = save('  Gruppe 3  ')
    expect(groups[1]?.name).toBe('Gruppe 3')

    const first = groups[0]!
    session = sessionAfter(play, () =>
      play.setSceneGroupArchived(sceneId, first.id, true, first.revision)
    )
    groups = save('')
    expect(groups[2]?.name).toBe('Gruppe 2')

    groups = save('  Wölfe  ')
    expect(groups[3]?.name).toBe('Wölfe')
    const wolves = groups[3]!
    groups = save('\t', wolves.id, wolves.revision)
    expect(groups.map((group) => group.name)).toEqual([
      'Gruppe 1',
      'Gruppe 3',
      'Gruppe 2',
      'Gruppe 4'
    ])
    expect(groups[0]?.archived).toBe(true)
    campaigns.close()
  })

  it('assigns new party members to the focused scene and preserves manual scene removal', () => {
    const { campaigns, play } = harness()
    let party = play.readParty()
    for (const member of party.members)
      party = play.setMembership(member.id, true, party.revision)

    let session = play.readSession()
    const defaultSceneId = session.scene.focusedSceneId
    expect(session.scene.scenes[0]?.partyMemberIds).toEqual(
      party.members.map((member) => member.id)
    )
    expect(session.scene.unassignedPartyMemberIds).toEqual([])

    const movingMember = party.members[0]!
    party = play.setMembership(movingMember.id, false, party.revision)
    session = play.readSession()
    expect(session.scene.scenes[0]?.partyMemberIds).not.toContain(
      movingMember.id
    )

    const secondSceneId = uuidv7()
    const db = activeCampaignDatabase(campaigns)
    db.prepare(
      "INSERT INTO scene_running_scene (id, title, location_id, location_name, position) VALUES (?, 'Nebenszene', NULL, '', 1)"
    ).run(secondSceneId)
    db.prepare(
      'UPDATE scene_workspace SET revision = revision + 1 WHERE singleton = 1'
    ).run()
    session = play.readSession()
    play.focusScene(secondSceneId, session.scene.revision)

    play.setMembership(movingMember.id, true, party.revision)
    session = play.readSession()
    expect(
      session.scene.scenes.find((scene) => scene.id === secondSceneId)
        ?.partyMemberIds
    ).toEqual([movingMember.id])
    expect(
      session.scene.scenes.find((scene) => scene.id === defaultSceneId)
        ?.partyMemberIds
    ).not.toContain(movingMember.id)

    session = play.assignScenePartyMember(
      secondSceneId,
      movingMember.id,
      false,
      session.scene.revision
    )
    expect(session.scene.unassignedPartyMemberIds).toContain(movingMember.id)
    expect(play.readSession().scene.unassignedPartyMemberIds).toContain(
      movingMember.id
    )
    campaigns.close()
  })

  it('reconciles automatically assigned members into initiative and combat', () => {
    const { campaigns, play } = harness()
    let party = play.readParty()
    party = play.setMembership(party.members[0]!.id, true, party.revision)
    let session = play.readSession()
    const sceneId = session.scene.focusedSceneId
    session = sessionAfter(play, () =>
      play.saveSceneGroup(
        sceneId,
        null,
        'Wölfe',
        '',
        'hostile',
        [{ creatureId: 'wolf', quantity: 2 }],
        session.scene.revision,
        null
      )
    )
    play.prepareCombat(sceneId, session.scene.revision, [
      session.scene.scenes[0]!.groups[0]!.id
    ])

    party = play.setMembership(party.members[1]!.id, true, party.revision)
    session = play.readSession()
    expect(
      session.combat?.initiativeRows.filter((row) => row.kind === 'party')
    ).toHaveLength(2)
    expect(
      session.combat?.initiativeRows.filter((row) => row.kind === 'monster')
    ).toHaveLength(2)
    session = sessionAfter(play, () =>
      play.confirmInitiative(
        session.combat!.revision,
        session.combat!.initiativeRows.map((row) => ({
          id: row.id,
          initiative: row.initiative
        }))
      )
    )
    const activeCardId = session.combat?.cards.find((card) => card.active)?.id

    play.setMembership(party.members[2]!.id, true, party.revision)
    session = play.readSession()
    expect(
      session.combat?.cards.filter((card) => card.playerCharacter)
    ).toHaveLength(3)
    expect(session.combat?.cards.find((card) => card.active)?.id).toBe(
      activeCardId
    )
    campaigns.close()
  })

  it('runs party and a monster group through resolution and awards XP once', () => {
    const { campaigns, play } = harness()
    let party = play.readParty()
    for (const member of party.members.slice(0, 2))
      party = play.setMembership(member.id, true, party.revision)

    let session = play.readSession()
    const sceneId = session.scene.focusedSceneId
    for (const member of party.members.filter((entry) => entry.active))
      session = play.assignScenePartyMember(
        sceneId,
        member.id,
        true,
        session.scene.revision
      )
    session = sessionAfter(play, () =>
      play.saveSceneGroup(
        sceneId,
        null,
        'Goblin Patrol',
        'Hält sich im Unterholz verborgen.',
        'hostile',
        [{ creatureId: 'goblin', quantity: 6 }],
        session.scene.revision,
        null
      )
    )
    const groupId = session.scene.scenes[0]?.groups[0]?.id
    expect(groupId).toBeDefined()

    session = sessionAfter(play, () =>
      play.prepareCombat(sceneId, session.scene.revision, [groupId ?? ''])
    )
    expect(session.combat?.phase).toBe('initiative')
    expect(
      session.combat?.initiativeRows.filter((row) => row.kind === 'monster')
    ).toHaveLength(1)
    const partyInitiative = session.combat?.initiativeRows
      .filter((row) => row.kind === 'party')
      .map((row) => ({ id: row.id, initiative: row.initiative }))
    session = sessionAfter(play, () =>
      play.rollInitiative(session.combat?.revision ?? -1)
    )
    expect(
      session.combat?.initiativeRows
        .filter((row) => row.kind === 'party')
        .map((row) => ({ id: row.id, initiative: row.initiative }))
    ).toEqual(partyInitiative)
    const initiatives =
      session.combat?.initiativeRows.map((row) => ({
        id: row.id,
        initiative: row.initiative
      })) ?? []
    session = sessionAfter(play, () =>
      play.confirmInitiative(session.combat?.revision ?? -1, initiatives)
    )
    const monsterCard = session.combat?.cards.find(
      (card) => !card.playerCharacter
    )
    expect(monsterCard).toMatchObject({ count: 6, creatureId: 'goblin' })

    session = sessionAfter(play, () =>
      play.changeHp(
        session.combat?.revision ?? -1,
        monsterCard?.id ?? '',
        8,
        false
      )
    )
    expect(
      session.combat?.cards.find((card) => card.id === monsterCard?.id)
    ).toMatchObject({ currentHp: 6, maxHp: 7, aliveCount: 5, count: 6 })
    expect(session.scene.scenes[0]?.groups[0]?.entries[0]).toMatchObject({
      aliveQuantity: 5,
      deadQuantity: 1
    })
    session = sessionAfter(play, () =>
      play.toggleCombatCondition(
        session.combat?.revision ?? -1,
        monsterCard?.id ?? '',
        'prone',
        true
      )
    )
    expect(
      session.combat?.cards.find((card) => card.id === monsterCard?.id)
        ?.conditions
    ).toEqual(['prone'])
    expect(
      session.scene.scenes[0]?.groups[0]?.entries[0]?.members.some((member) =>
        member.conditions.includes('prone')
      )
    ).toBe(true)
    expect(session.combat?.undoLabel).toContain('prone')
    session = sessionAfter(play, () =>
      play.setCombatConcentration(
        session.combat?.revision ?? -1,
        monsterCard?.id ?? '',
        true
      )
    )
    session = sessionAfter(play, () =>
      play.setCombatExhaustion(
        session.combat?.revision ?? -1,
        monsterCard?.id ?? '',
        3
      )
    )
    expect(
      session.combat?.cards.find((card) => card.id === monsterCard?.id)
    ).toMatchObject({ concentrating: true, exhaustionLevel: 3 })
    session = sessionAfter(play, () =>
      play.undoCombat(session.combat?.revision ?? -1)
    )
    expect(
      session.combat?.cards.find((card) => card.id === monsterCard?.id)
    ).toMatchObject({ concentrating: true, exhaustionLevel: 0 })
    session = sessionAfter(play, () =>
      play.undoCombat(session.combat?.revision ?? -1)
    )
    expect(
      session.combat?.cards.find((card) => card.id === monsterCard?.id)
    ).toMatchObject({ concentrating: false, exhaustionLevel: 0 })
    session = sessionAfter(play, () =>
      play.undoCombat(session.combat?.revision ?? -1)
    )
    expect(
      session.combat?.cards.find((card) => card.id === monsterCard?.id)
    ).toMatchObject({ currentHp: 6, conditions: [] })
    session = sessionAfter(play, () =>
      play.undoCombat(session.combat?.revision ?? -1)
    )
    expect(
      session.combat?.cards.find((card) => card.id === monsterCard?.id)
    ).toMatchObject({ currentHp: 7, aliveCount: 6 })
    expect(session.scene.scenes[0]?.groups[0]?.entries[0]).toMatchObject({
      aliveQuantity: 6,
      deadQuantity: 0
    })

    session = sessionAfter(play, () =>
      play.changeHp(
        session.combat?.revision ?? -1,
        monsterCard?.id ?? '',
        42,
        false
      )
    )
    expect(session.combat?.allEnemiesDefeated).toBe(true)
    session = sessionAfter(play, () =>
      play.endCombat(session.combat?.revision ?? -1)
    )
    const enemyIds =
      session.combat?.resolution?.enemies.map((enemy) => enemy.id) ?? []
    session = sessionAfter(play, () =>
      play.updateResolution(
        session.combat?.revision ?? -1,
        enemyIds,
        'manual',
        1
      )
    )
    const staleRulesRevision =
      session.combat?.resolution?.campaignRulesRevision ?? -1
    new CampaignRulesService(campaigns.activeCampaignPersistence()).update({
      commandId: uuidv7(),
      expectedRevision: staleRulesRevision,
      rewardXpBasis: 'adjusted'
    })
    expect(() =>
      play.awardXp(session.combat?.revision ?? -1, staleRulesRevision)
    ).toThrow('stale')
    session = play.readSession()
    expect(session.combat?.resolution).toMatchObject({
      rewardXpBasis: 'adjusted',
      eligibleBaseXp: 300,
      eligibleAdjustedXp: 750,
      eligibleRewardXp: 750,
      campaignRulesRevision: 1
    })
    session = sessionAfter(play, () =>
      play.awardXp(
        session.combat?.revision ?? -1,
        session.combat?.resolution?.campaignRulesRevision ?? -1
      )
    )

    expect(session.combat?.resolution?.xpAwarded).toBe(true)
    expect(session.combat?.resolution?.perPlayerXp).toBe(375)
    expect(
      session.party.members
        .filter((member) => member.active)
        .map((member) => member.xp)
    ).toEqual([1275, 1275])
    expect(() =>
      play.awardXp(
        session.combat?.revision ?? -1,
        session.combat?.resolution?.campaignRulesRevision ?? -1
      )
    ).toThrow('validation')
    campaigns.close()
  })

  it('persists group disposition and unlinks archived groups from combat', () => {
    const { campaigns, play } = harness()
    const party = play.readParty()
    const memberId = party.members[0]?.id ?? ''
    play.setMembership(memberId, true, party.revision)
    let session = play.readSession()
    const sceneId = session.scene.focusedSceneId
    session = play.assignScenePartyMember(
      sceneId,
      memberId,
      true,
      session.scene.revision
    )
    session = sessionAfter(play, () =>
      play.saveSceneGroup(
        sceneId,
        null,
        'Hafenwache',
        '',
        'allied',
        [],
        session.scene.revision,
        null
      )
    )
    const emptyGroup = session.scene.scenes[0]?.groups[0]
    expect(emptyGroup).toMatchObject({
      disposition: 'allied',
      archived: false,
      baseXp: 0,
      entries: []
    })
    expect(
      play.evaluateEncounter(
        sceneId,
        [emptyGroup?.id ?? ''],
        session.scene.revision
      ).canStart
    ).toBe(false)

    session = sessionAfter(play, () =>
      play.saveSceneGroup(
        sceneId,
        null,
        'Goblins',
        '',
        'hostile',
        [{ creatureId: 'goblin', quantity: 2 }],
        session.scene.revision,
        null
      )
    )
    const combatGroup = session.scene.scenes[0]?.groups[1]
    session = sessionAfter(play, () =>
      play.prepareCombat(sceneId, session.scene.revision, [
        combatGroup?.id ?? ''
      ])
    )
    session = sessionAfter(play, () =>
      play.setSceneGroupArchived(
        sceneId,
        combatGroup?.id ?? '',
        true,
        combatGroup?.revision ?? -1
      )
    )
    expect(session.combat?.selectedGroupIds).toEqual([])
    expect(session.combat?.initiativeRows).toHaveLength(1)
    expect(
      session.scene.scenes[0]?.groups.find(
        (group) => group.id === combatGroup?.id
      )?.archived
    ).toBe(true)
    expect(() =>
      play.evaluateEncounter(
        sceneId,
        [combatGroup?.id ?? ''],
        session.scene.revision
      )
    ).toThrow('validation')

    session = sessionAfter(play, () =>
      play.deleteSceneGroup(
        sceneId,
        combatGroup?.id ?? '',
        session.scene.scenes[0]?.groups.find(
          (group) => group.id === combatGroup?.id
        )?.revision ?? -1
      )
    )
    expect(session.combat?.selectedGroupIds).toEqual([])
    expect(session.scene.scenes[0]?.groups).toHaveLength(1)
    campaigns.close()
  })

  it('keeps linked group membership live and joins explicit reinforcements', () => {
    const { campaigns, play } = harness()
    const party = play.readParty()
    play.setMembership(party.members[0]!.id, true, party.revision)
    let session = play.readSession()
    const sceneId = session.scene.focusedSceneId
    session = sessionAfter(play, () =>
      play.saveSceneGroup(
        sceneId,
        null,
        'Wölfe',
        '',
        'hostile',
        [{ creatureId: 'wolf', quantity: 2 }],
        session.scene.revision,
        null
      )
    )
    const wolves = session.scene.scenes[0]!.groups[0]!
    session = sessionAfter(play, () =>
      play.prepareCombat(sceneId, session.scene.revision, [wolves.id])
    )
    session = sessionAfter(play, () =>
      play.confirmInitiative(
        session.combat!.revision,
        session.combat!.initiativeRows.map((row) => ({
          id: row.id,
          initiative: row.initiative
        }))
      )
    )
    const initialWolfCardIds = session.combat?.cards
      .filter((card) => card.creatureId === 'wolf')
      .map((card) => card.id)
    expect(initialWolfCardIds).toHaveLength(2)
    session = sessionAfter(play, () =>
      play.saveSceneGroup(
        sceneId,
        wolves.id,
        wolves.name,
        wolves.note,
        wolves.disposition,
        [{ creatureId: 'wolf', quantity: 3 }],
        session.scene.revision,
        wolves.revision
      )
    )
    expect(
      session.combat?.cards
        .filter((card) => card.creatureId === 'wolf')
        .reduce((sum, card) => sum + card.count, 0)
    ).toBe(3)
    expect(
      session.combat?.cards
        .filter((card) => card.creatureId === 'wolf')
        .map((card) => card.id)
    ).toEqual(expect.arrayContaining(initialWolfCardIds ?? []))
    expect(
      session.combat?.cards.filter((card) => card.creatureId === 'wolf')
    ).toHaveLength(3)

    session = sessionAfter(play, () =>
      play.saveSceneGroup(
        sceneId,
        null,
        'Goblins',
        '',
        'hostile',
        [{ creatureId: 'goblin', quantity: 2 }],
        session.scene.revision,
        null
      )
    )
    const goblins = session.scene.scenes[0]!.groups[1]!
    session = sessionAfter(play, () =>
      play.joinCombatGroup(
        sceneId,
        goblins.id,
        goblins.revision,
        session.combat!.revision
      )
    )
    expect(session.combat?.selectedGroupIds).toEqual([wolves.id, goblins.id])
    expect(
      session.combat?.cards
        .filter((card) => card.creatureId === 'goblin')
        .reduce((sum, card) => sum + card.count, 0)
    ).toBe(2)
    campaigns.close()
  })

  it('keeps a prepared mob partition when reinforcements join', () => {
    const { campaigns, play } = harness()
    const party = play.readParty()
    play.setMembership(party.members[0]!.id, true, party.revision)
    let session = play.readSession()
    const sceneId = session.scene.focusedSceneId
    session = sessionAfter(play, () =>
      play.saveSceneGroup(
        sceneId,
        null,
        'Goblinmob',
        '',
        'hostile',
        [{ creatureId: 'goblin', quantity: 6 }],
        session.scene.revision,
        null
      )
    )
    const goblins = session.scene.scenes[0]!.groups[0]!
    session = sessionAfter(play, () =>
      play.prepareCombat(sceneId, session.scene.revision, [goblins.id])
    )
    const database = activeCampaignDatabase(campaigns)
    expect(
      database
        .prepare(
          `SELECT source_entry_id AS sourceEntryId,
            partition_kind AS partitionKind, display_ordinal AS displayOrdinal
           FROM encounter_combat_sources WHERE source_kind='monster'`
        )
        .get()
    ).toEqual({
      sourceEntryId: goblins.entries[0]!.id,
      partitionKind: 'mob',
      displayOrdinal: null
    })
    const preparedWith = database
      .prepare(
        `SELECT generator_preset_id AS presetId,
            generator_preset_revision AS presetRevision,
            generator_config_hash AS configHash, mob_threshold AS mobThreshold
           FROM encounter_combat_runtime`
      )
      .get() as {
      presetId: string
      presetRevision: number
      configHash: string
      mobThreshold: number
    }
    expect(preparedWith).toMatchObject({
      presetId: '00000000-0000-4000-8000-000000000001',
      presetRevision: 0,
      mobThreshold: 6
    })
    expect(preparedWith.configHash).toMatch(/^[0-9a-f]{64}$/)
    session = sessionAfter(play, () =>
      play.confirmInitiative(
        session.combat!.revision,
        session.combat!.initiativeRows.map((row) => ({
          id: row.id,
          initiative: row.initiative
        }))
      )
    )
    const mobCardId = session.combat?.cards.find(
      (card) => card.creatureId === 'goblin'
    )?.id
    expect(
      session.combat?.cards.filter((card) => card.creatureId === 'goblin')
    ).toHaveLength(1)

    session = sessionAfter(play, () =>
      play.saveSceneGroup(
        sceneId,
        goblins.id,
        goblins.name,
        goblins.note,
        goblins.disposition,
        [{ creatureId: 'goblin', quantity: 7 }],
        session.scene.revision,
        goblins.revision
      )
    )
    expect(
      session.combat?.cards.filter((card) => card.creatureId === 'goblin')
    ).toEqual([expect.objectContaining({ id: mobCardId, count: 7 })])
    campaigns.close()
  })

  it('resumes the exact running combat after reopening the campaign', () => {
    const { campaigns, play } = harness()
    const party = play.readParty()
    play.setMembership(party.members[0]?.id ?? '', true, party.revision)
    let session = play.readSession()
    const sceneId = session.scene.focusedSceneId
    session = play.assignScenePartyMember(
      sceneId,
      party.members[0]?.id ?? '',
      true,
      session.scene.revision
    )
    session = sessionAfter(play, () =>
      play.saveSceneGroup(
        sceneId,
        null,
        'Wolves',
        'Streift im Dünengras westlich der Furt.',
        'hostile',
        [{ creatureId: 'wolf', quantity: 2 }],
        session.scene.revision,
        null
      )
    )
    session = sessionAfter(play, () =>
      play.prepareCombat(sceneId, session.scene.revision, [
        session.scene.scenes[0]?.groups[0]?.id ?? ''
      ])
    )
    session = sessionAfter(play, () =>
      play.confirmInitiative(
        session.combat?.revision ?? -1,
        session.combat?.initiativeRows.map((row) => ({
          id: row.id,
          initiative: row.initiative
        })) ?? []
      )
    )
    const monsterCard = session.combat?.cards.find(
      (card) => !card.playerCharacter
    )
    session = sessionAfter(play, () =>
      play.toggleCombatCondition(
        session.combat?.revision ?? -1,
        monsterCard?.id ?? '',
        'poisoned',
        true
      )
    )
    session = sessionAfter(play, () =>
      play.advanceTurn(session.combat?.revision ?? -1)
    )
    const expected = session.combat
    campaigns.close()

    const reopened = new CampaignStore(roots[0] ?? '')
    const resumed = new LivePlayService(
      reopened.activeCampaignPersistence()
    ).readSession()
    reopened.close()

    expect(resumed.combat).toEqual(expected)
    expect(resumed.scene.scenes[0]?.groups[0]?.note).toBe(
      'Streift im Dünengras westlich der Furt.'
    )
  })

  it('keeps combat bound to its scene while focus changes', () => {
    const { campaigns, play } = harness()
    const party = play.readParty()
    const memberId = party.members[0]?.id ?? ''
    play.setMembership(memberId, true, party.revision)
    let session = play.readSession()
    const firstSceneId = session.scene.focusedSceneId
    session = play.assignScenePartyMember(
      firstSceneId,
      memberId,
      true,
      session.scene.revision
    )
    session = sessionAfter(play, () =>
      play.saveSceneGroup(
        firstSceneId,
        null,
        'Wölfe',
        '',
        'hostile',
        [{ creatureId: 'wolf', quantity: 2 }],
        session.scene.revision,
        null
      )
    )
    session = sessionAfter(play, () =>
      play.prepareCombat(firstSceneId, session.scene.revision, [
        session.scene.scenes[0]?.groups[0]?.id ?? ''
      ])
    )
    const firstCombat = session.combat

    const secondSceneId = uuidv7()
    const db = activeCampaignDatabase(campaigns)
    db.prepare(
      "INSERT INTO scene_running_scene (id, title, location_id, location_name, position) VALUES (?, 'Nebenszene', NULL, '', 1)"
    ).run(secondSceneId)
    db.prepare(
      'UPDATE scene_workspace SET revision = revision + 1 WHERE singleton = 1'
    ).run()
    session = play.readSession()
    session = play.focusScene(secondSceneId, session.scene.revision)
    expect(session.combat).toBeNull()
    session = play.focusScene(firstSceneId, session.scene.revision)
    expect(session.combat).toEqual(firstCombat)
    campaigns.close()
  })

  it('coordinates concurrent group edits with group revisions instead of the scene root', () => {
    const { campaigns, play } = harness()
    let session = play.readSession()
    const sceneId = session.scene.focusedSceneId
    session = sessionAfter(play, () =>
      play.saveSceneGroup(
        sceneId,
        null,
        'Wölfe',
        '',
        'hostile',
        [{ creatureId: 'wolf', quantity: 1 }],
        session.scene.revision,
        null
      )
    )
    session = sessionAfter(play, () =>
      play.saveSceneGroup(
        sceneId,
        null,
        'Goblins',
        '',
        'hostile',
        [{ creatureId: 'goblin', quantity: 1 }],
        session.scene.revision,
        null
      )
    )
    const staleSceneRevision = session.scene.revision
    const [wolves, goblins] = session.scene.scenes[0]!.groups

    sessionAfter(play, () =>
      play.saveSceneGroup(
        sceneId,
        wolves!.id,
        'Grauwölfe',
        '',
        'hostile',
        [{ creatureId: 'wolf', quantity: 1 }],
        staleSceneRevision,
        wolves!.revision
      )
    )
    session = sessionAfter(play, () =>
      play.saveSceneGroup(
        sceneId,
        goblins!.id,
        'Höhlengoblins',
        '',
        'hostile',
        [{ creatureId: 'goblin', quantity: 1 }],
        staleSceneRevision,
        goblins!.revision
      )
    )

    expect(session.scene.scenes[0]!.groups.map((group) => group.name)).toEqual([
      'Grauwölfe',
      'Höhlengoblins'
    ])
    expect(() =>
      play.saveSceneGroup(
        sceneId,
        wolves!.id,
        'Veralteter Name',
        '',
        'hostile',
        [{ creatureId: 'wolf', quantity: 1 }],
        session.scene.revision,
        wolves!.revision
      )
    ).toThrow('stale')
    campaigns.close()
  })

  it('rewinds combat navigation without undoing persistent TP or conditions', () => {
    const { campaigns, play } = harness()
    const party = play.readParty()
    play.setMembership(party.members[0]!.id, true, party.revision)
    let session = play.readSession()
    const sceneId = session.scene.focusedSceneId
    session = sessionAfter(play, () =>
      play.saveSceneGroup(
        sceneId,
        null,
        'Wölfe',
        '',
        'hostile',
        [{ creatureId: 'wolf', quantity: 2 }],
        session.scene.revision,
        null
      )
    )
    session = sessionAfter(play, () =>
      play.prepareCombat(sceneId, session.scene.revision, [
        session.scene.scenes[0]!.groups[0]!.id
      ])
    )
    session = sessionAfter(play, () =>
      play.confirmInitiative(
        session.combat!.revision,
        session.combat!.initiativeRows.map((row) => ({
          id: row.id,
          initiative: row.initiative
        }))
      )
    )
    const monster = session.combat!.cards.find((card) => !card.playerCharacter)!
    const hpResult = play.changeHp(
      session.combat!.revision,
      monster.id,
      3,
      false
    )
    expect(hpResult.scenePatch?.upsertedGroups).toHaveLength(1)
    session = play.readSession()
    session = sessionAfter(play, () =>
      play.toggleCombatCondition(
        session.combat!.revision,
        monster.id,
        'prone',
        true
      )
    )
    const memberState =
      session.scene.scenes[0]!.groups[0]!.entries[0]!.members.map(
        ({ currentHp, conditions }) => ({ currentHp, conditions })
      )
    const turn = {
      round: session.combat!.round,
      active: session.combat!.cards.find((card) => card.active)!.id
    }
    const advanceResult = play.advanceTurn(session.combat!.revision)
    expect(advanceResult.scenePatch).toBeNull()
    session = play.readSession()
    session = sessionAfter(play, () =>
      play.retreatTurn(session.combat!.revision)
    )
    expect(session.combat!.round).toBe(turn.round)
    expect(session.combat!.cards.find((card) => card.active)!.id).toBe(
      turn.active
    )

    session = sessionAfter(play, () => play.endCombat(session.combat!.revision))
    session = sessionAfter(play, () =>
      play.moveCombatToPhase(session.combat!.revision, 'combat')
    )
    session = sessionAfter(play, () =>
      play.moveCombatToPhase(session.combat!.revision, 'initiative')
    )
    expect(session.combat).toMatchObject({
      phase: 'initiative',
      undoLabel: null
    })
    expect(
      session.scene.scenes[0]!.groups[0]!.entries[0]!.members.map(
        ({ currentHp, conditions }) => ({ currentHp, conditions })
      )
    ).toEqual(memberState)
    campaigns.close()
  })
})
