import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { CreatureCatalogService } from '../../src/core/creatures/catalog.js'
import { LivePlayService } from '../../src/core/encounter/live-combat.js'
import { CampaignStore } from '../../src/core/persistence/sqlite/campaign-store.js'
import { creatureCatalogQuerySchema } from '../../src/shared/contracts/encounter.js'

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
  const play = new LivePlayService(() => campaigns.activeCampaignDatabase())
  const catalog = new CreatureCatalogService(() =>
    campaigns.installationDatabase()
  )
  return { campaigns, play, catalog }
}

describe('party and catalog parity slice', () => {
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
        biomes: options.biomes.includes('Forest') ? ['Forest'] : [],
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
        balance: 'auto',
        diversity: 'auto'
      },
      0,
      session.scene.revision
    )
    expect(suggestion.entries.length).toBeGreaterThan(0)
    expect(play.readSession().scene.scenes[0]?.groups).toHaveLength(0)
    session = play.saveSceneGroup(
      sceneId,
      null,
      'Forest trouble',
      '',
      'hostile',
      suggestion.entries,
      session.scene.revision
    )
    const groupId = session.scene.scenes[0]?.groups[0]?.id ?? ''
    const evaluation = play.evaluateEncounter(
      sceneId,
      [groupId],
      session.scene.revision
    )
    expect(evaluation.canStart).toBe(true)
    session = play.prepareCombat(sceneId, session.scene.revision, [groupId])
    expect(session.combat?.phase).toBe('initiative')
    const expected = session.combat
    campaigns.close()

    const reopened = new CampaignStore(roots[0] ?? '')
    const resumed = new LivePlayService(() =>
      reopened.activeCampaignDatabase()
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
