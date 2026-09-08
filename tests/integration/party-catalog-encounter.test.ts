import { randomUUID } from 'node:crypto'
import { CombatService } from '../../src/core/encounter/combat-service.js'
import { partyCharacterDraftSchema } from '../../src/shared/contracts/party.js'
import { vi } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { CreatureCatalogService } from '../../src/core/creatures/catalog.js'
import { LivePlayService } from '../../src/core/encounter/live-combat.js'
import { CampaignStore } from '../../src/core/persistence/sqlite/campaign-store.js'
import { creatureCatalogQuerySchema } from '../../src/shared/contracts/encounter.js'
import { seedExampleParty } from '../../src/core/party/party-example-seed.js'
import { activeCampaignDatabase } from '../support/campaign-store-test-access.js'

const roots: string[] = []

afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true })
})

function harness() {
  const root = mkdtempSync(join(tmpdir(), 'salt-marcher-parity-'))
  roots.push(root)
  const campaigns = new CampaignStore(root)
  campaigns.create('Parity Campaign')
  seedExampleParty(activeCampaignDatabase(campaigns))
  const play = new LivePlayService(campaigns.activeCampaignPersistence())
  const catalog = new CreatureCatalogService(
    campaigns.installationPersistenceAccess()
  )
  return { campaigns, play, catalog }
}

function sessionAfter(play: LivePlayService, command: () => unknown) {
  command()
  return play.readSession()
}

describe('party and catalog parity slice', () => {
  it('atomically replaces, splits and merges scene rosters without activating unrelated characters', () => {
    const { campaigns, play } = harness()
    try {
      let state = play.readSession()
      const sourceId = state.scene.focusedSceneId
      const ids = state.party.members.slice(0, 3).map((member) => member.id)
      const roster = (memberIds: string[]) => ({
        sceneId: sourceId,
        memberIds,
        expectedRevision: state.scene.revision,
        expectedPartyRevision: state.party.revision
      })
      state = play.setSceneRoster(roster(ids))
      expect(
        state.scene.scenes.find((scene) => scene.id === sourceId)
          ?.partyMemberIds
      ).toEqual(ids)
      const stale = roster([ids[0]!])
      state = play.moveSceneRoster({
        ...roster([ids[0]!]),
        target: { kind: 'new', title: 'Wald' }
      })
      const destination = state.scene.scenes.find(
        (scene) => scene.title === 'Wald'
      )!
      const source = state.scene.scenes.find((scene) => scene.id === sourceId)!
      expect(destination).toMatchObject({
        partyMemberIds: [ids[0]],
        gameTimeSeconds: source.gameTimeSeconds,
        locationId: source.locationId,
        locationName: source.locationName
      })
      expect(source.partyMemberIds).toEqual(ids.slice(1))
      expect(
        state.party.members.find((member) => member.id === ids[0])?.active
      ).toBe(true)
      expect(() => play.setSceneRoster(stale)).toThrow()
      expect(() =>
        play.restSceneParty({
          sceneId: sourceId,
          memberIds: [ids[0]!],
          type: 'long',
          expectedRevision: state.party.revision,
          expectedSceneRevision: state.scene.revision
        })
      ).toThrow()
      const before = play.readSession()
      expect(() => play.setSceneRoster(roster([ids[0]!]))).toThrow()
      expect(play.readSession()).toEqual(before)
      const failure = vi
        .spyOn(CombatService.prototype, 'reconcileParty')
        .mockImplementationOnce(() => {
          throw new Error('dependent failure')
        })
      expect(() =>
        play.moveSceneRoster({
          ...roster(ids.slice(1)),
          target: { kind: 'new', title: 'Rollback' }
        })
      ).toThrow('dependent failure')
      failure.mockRestore()
      expect(play.readSession()).toEqual(before)
      state = play.moveSceneRoster({
        ...roster(ids.slice(1)),
        target: { kind: 'existing', sceneId: destination.id }
      })
      expect(
        state.scene.scenes.find((scene) => scene.id === sourceId)
          ?.partyMemberIds
      ).toEqual([])
      expect(
        state.scene.scenes.find((scene) => scene.id === destination.id)
          ?.partyMemberIds
      ).toEqual(ids)
      state = play.setSceneRoster({
        sceneId: destination.id,
        memberIds: [ids[1]!],
        expectedRevision: state.scene.revision,
        expectedPartyRevision: state.party.revision
      })
      expect(
        state.party.members
          .filter((member) => ids.includes(member.id) && member.active)
          .map((member) => member.id)
      ).toEqual([ids[1]])
      expect(() =>
        play.setSceneRoster({ ...roster([ids[2]!, ids[2]!]) })
      ).toThrow()
    } finally {
      campaigns.close()
    }
  })

  it('reconciles legacy membership in the assigned scene even while another scene is focused', () => {
    const { campaigns, play } = harness()
    try {
      let state = play.readSession()
      const member = state.party.members[0]!
      const sourceId = state.scene.focusedSceneId
      state = play.setSceneRoster({
        sceneId: sourceId,
        memberIds: [member.id],
        expectedRevision: state.scene.revision,
        expectedPartyRevision: state.party.revision
      })
      state = play.moveSceneRoster({
        sceneId: sourceId,
        memberIds: [member.id],
        expectedRevision: state.scene.revision,
        expectedPartyRevision: state.party.revision,
        target: { kind: 'new', title: 'Andere Szene' }
      })
      const targetId = state.scene.scenes.find(
        (scene) => scene.title === 'Andere Szene'
      )!.id
      const reconcile = vi.spyOn(CombatService.prototype, 'reconcileParty')
      play.setMembership(member.id, false, state.party.revision)
      expect(reconcile).toHaveBeenCalledTimes(1)
      expect(reconcile).toHaveBeenLastCalledWith([])
      expect(
        play.readSession().scene.scenes.find((scene) => scene.id === targetId)
          ?.partyMemberIds
      ).toEqual([])
      reconcile.mockRestore()
    } finally {
      campaigns.close()
    }
  })

  it('preserves absent character facts and caps XP correction at the level floor', () => {
    const { campaigns, play } = harness()
    let party = play.readParty()
    party = play.createPartyCharacter(
      {
        name: 'Namesake',
        playerName: null,
        level: null,
        passivePerception: null,
        armorClass: null
      },
      party.revision
    )
    const created = party.members.at(-1)
    expect(created).toMatchObject({
      name: 'Namesake',
      active: false,
      playerName: null,
      level: null,
      passivePerception: null,
      armorClass: null
    })

    party = play.updatePartyCharacter(
      created?.id ?? '',
      {
        name: 'Namesake',
        playerName: 'Mara',
        level: 5,
        passivePerception: 14,
        armorClass: 17
      },
      party.revision
    )
    party = play.adjustPartyXp(created?.id ?? '', -1_000_000, party.revision)
    expect(party.members.at(-1)).toMatchObject({
      level: 5,
      xp: 6500,
      currentLevelFloor: 6500
    })
    campaigns.close()
  })

  it('updates and deletes an unfocused scene character atomically without resetting initiative or the active turn', () => {
    const { campaigns, play } = harness()
    let party = play.readParty()
    const member = party.members[0]!
    party = play.setMembership(member.id, true, party.revision)
    let session = play.readSession()
    const originalScene = session.scene.focusedSceneId
    play.saveSceneGroup(
      originalScene,
      null,
      'Wolves',
      '',
      'hostile',
      [{ creatureId: 'wolf', quantity: 2 }],
      session.scene.revision,
      null
    )
    session = play.readSession()
    play.prepareCombat(originalScene, session.scene.revision, [
      session.scene.scenes[0]!.groups[0]!.id
    ])
    session = play.readSession()
    play.confirmInitiative(
      session.combat!.revision,
      session.combat!.initiativeRows.map((row) => ({
        id: row.id,
        initiative: row.kind === 'party' ? 27 : 11
      }))
    )
    session = play.readSession()
    const activeId = session.combat!.cards.find((card) => card.active)!.id
    const otherScene = randomUUID()
    activeCampaignDatabase(campaigns)
      .prepare(
        "INSERT INTO scene_running_scene (id,title,location_name,position) VALUES (?, 'Other', '', 1)"
      )
      .run(otherScene)
    play.focusScene(otherScene, session.scene.revision)
    const draft = partyCharacterDraftSchema.parse({
      name: 'Renamed',
      playerName: member.playerName,
      level: member.level,
      passivePerception: member.passivePerception,
      armorClass: member.armorClass
    })
    party = play.updatePartyCharacter(member.id, draft, party.revision)
    expect(play.readSession().combat).toBeNull()
    session = play.focusScene(originalScene, play.readSession().scene.revision)
    expect(
      session.combat!.cards.find((card) => card.playerCharacter)
    ).toMatchObject({ name: 'Renamed', initiative: 27 })
    expect(session.combat!.cards.find((card) => card.active)!.id).toBe(activeId)
    play.focusScene(otherScene, session.scene.revision)
    const before = play.readParty()
    const reconcile = vi
      .spyOn(CombatService.prototype, 'removePartyCharacter')
      .mockImplementationOnce(() => {
        throw new Error('reconcile failed')
      })
    try {
      expect(() =>
        play.deletePartyCharacter(member.id, party.revision)
      ).toThrow('reconcile failed')
    } finally {
      reconcile.mockRestore()
    }
    expect(play.readParty()).toEqual(before)
    expect(
      play
        .readSession()
        .scene.scenes.find((scene) => scene.id === originalScene)!
        .partyMemberIds
    ).toContain(member.id)
    play.deletePartyCharacter(member.id, party.revision)
    session = play.focusScene(originalScene, play.readSession().scene.revision)
    expect(session.combat!.cards.some((card) => card.playerCharacter)).toBe(
      false
    )
    expect(
      session.scene.scenes.find((scene) => scene.id === originalScene)!
        .partyMemberIds
    ).not.toContain(member.id)
    campaigns.close()
  })

  it('calculates adventuring-day budget and progress without mutating the roster', () => {
    const { campaigns, play } = harness()
    const before = play.readParty()
    const result = play.calculateAdventuringDay([{ level: 3, count: 4 }], 6000)
    expect(result.dailyBudget).toBe(4800)
    expect(result.completedDays).toBe(1)
    expect(result.dayProgress).toBe(0.25)
    expect(play.readParty()).toEqual(before)
    campaigns.close()
  })

  it('queries the bundled SRD catalog with filters, paging and rich details', () => {
    const { campaigns, catalog } = harness()
    const options = catalog.filterOptions()
    const wolves = catalog.search(
      creatureCatalogQuerySchema.parse({
        name: 'wolf',
        types: ['Beast'],
        biomes: options.biomes.some((biome) => biome.id === 'forest')
          ? ['forest']
          : [],
        sort: 'cr',
        direction: 'asc',
        limit: 50
      })
    )
    expect(options.types).toContain('Beast')
    expect(options.biomes.length).toBeGreaterThan(0)
    expect(wolves.total).toBeGreaterThan(0)
    expect(wolves.rows.every((creature) => creature.type === 'Beast')).toBe(
      true
    )
    const detail = catalog.detail(wolves.rows[0]?.id ?? '')
    expect(detail.actions.length).toBeGreaterThan(0)
    expect(detail.abilities.dex).toBeGreaterThan(0)
    campaigns.close()
  })

  it('generates a transient scene group, evaluates it and starts combat', () => {
    const { campaigns, play } = harness()
    let party = play.readParty()
    for (const member of party.members)
      party = play.setMembership(member.id, true, party.revision)
    let session = play.readSession()
    const sceneId = session.scene.focusedSceneId
    for (const member of party.members)
      session = play.assignScenePartyMember(
        sceneId,
        member.id,
        true,
        session.scene.revision
      )
    const suggestion = play.generateGroupDraft(
      sceneId,
      [],
      'replace',
      creatureCatalogQuerySchema.parse({
        types: ['Beast'],
        crMax: 2,
        limit: 50
      }),
      {
        difficulty: 'medium',
        amount: 'standard',
        balance: 'preset',
        diversity: 'preset'
      },
      0,
      session.scene.revision
    )
    expect(suggestion.entries.length).toBeGreaterThan(0)
    expect(play.readSession().scene.scenes[0]?.groups).toHaveLength(0)
    session = sessionAfter(play, () =>
      play.saveSceneGroup(
        sceneId,
        null,
        'Forest trouble',
        '',
        'hostile',
        suggestion.entries,
        session.scene.revision,
        null
      )
    )
    const groupId = session.scene.scenes[0]?.groups[0]?.id ?? ''
    const evaluation = play.evaluateEncounter(
      sceneId,
      [groupId],
      session.scene.revision
    )
    expect(evaluation.canStart).toBe(true)
    session = sessionAfter(play, () =>
      play.prepareCombat(sceneId, session.scene.revision, [groupId])
    )
    expect(session.combat?.phase).toBe('initiative')
    const expected = session.combat
    campaigns.close()

    const reopened = new CampaignStore(roots[0] ?? '')
    const resumed = new LivePlayService(
      reopened.activeCampaignPersistence()
    ).readSession()
    expect(resumed.combat).toEqual(expected)
    expect(resumed.scene.scenes[0]?.groups[0]?.name).toBe('Forest trouble')
    reopened.close()
  })

  it('evaluates manual drafts, fills a base roster and replaces it on request', () => {
    const { campaigns, play, catalog } = harness()
    let party = play.readParty()
    for (const member of party.members)
      party = play.setMembership(member.id, true, party.revision)
    let session = play.readSession()
    const sceneId = session.scene.focusedSceneId
    for (const member of party.members)
      session = play.assignScenePartyMember(
        sceneId,
        member.id,
        true,
        session.scene.revision
      )
    const base = [{ creatureId: 'wolf', quantity: 1 }] as const
    const before = play.evaluateGroupDraft(
      sceneId,
      base,
      session.scene.revision
    )
    expect(before.creatureCount).toBe(1)
    expect(before.baseXp).toBeGreaterThan(0)
    expect(before.multiplier).toBeGreaterThan(0)
    expect(['trivial', 'easy', 'medium', 'hard', 'deadly']).toContain(
      before.difficultyBand
    )

    const filled = play.generateGroupDraft(
      sceneId,
      base,
      'fill',
      creatureCatalogQuerySchema.parse({ types: ['Beast'], limit: 50 }),
      {
        difficulty: 'hard',
        amount: 'many',
        balance: 'even',
        diversity: 'high'
      },
      0,
      session.scene.revision
    )
    expect(
      filled.entries.find((entry) => entry.creatureId === 'wolf')?.quantity
    ).toBeGreaterThanOrEqual(1)
    expect(filled.evaluation.adjustedXp).toBeGreaterThanOrEqual(
      before.adjustedXp
    )

    const replaced = play.generateGroupDraft(
      sceneId,
      [{ creatureId: 'goblin', quantity: 3 }],
      'replace',
      creatureCatalogQuerySchema.parse({ types: ['Beast'], limit: 50 }),
      {
        difficulty: 'medium',
        amount: 'standard',
        balance: 'varied',
        diversity: 'low'
      },
      0,
      session.scene.revision
    )
    expect(replaced.entries.length).toBeGreaterThan(0)
    expect(
      replaced.entries.some((entry) => entry.creatureId === 'goblin')
    ).toBe(false)
    expect(
      replaced.entries.every(
        (entry) => catalog.detail(entry.creatureId).type === 'Beast'
      )
    ).toBe(true)
    expect(play.readSession().scene.scenes[0]?.groups).toHaveLength(0)
    campaigns.close()
  })
})
