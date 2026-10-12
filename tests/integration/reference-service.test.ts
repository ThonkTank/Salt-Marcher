import { SessionPlannerStore } from '../../src/core/session-planner/session-planner-store.js'
import { PlannedSceneReferences } from '../../src/core/session-planner/planned-scene-references.js'
import { randomUUID } from 'node:crypto'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { EncounterSourceService } from '../../src/core/application/encounter-source-service.js'
import {
  CreatureCatalogService,
  creatures as creatureCatalog
} from '../../src/core/creatures/catalog.js'
import { CampaignStore } from '../../src/core/persistence/sqlite/campaign-store.js'
import { ReferenceCatalogAdapter } from '../../src/core/reference/reference-catalog-adapter.js'
import { ReferenceService } from '../../src/core/reference/reference-service.js'
import { WorldLocationService } from '../../src/core/worldplanner/location-store.js'
import { WorldNpcApplicationService } from '../../src/core/application/world-npc-application-service.js'
import { EncounterTableStore } from '../../src/core/encounter/encounter-table-store.js'
import { WorldFactionStore } from '../../src/core/worldplanner/faction-store.js'

const roots: string[] = []
const catalogs: ReferenceCatalogAdapter[] = []

afterEach(() => {
  for (const catalog of catalogs.splice(0)) catalog.close()
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true })
})

function harness() {
  const root = mkdtempSync(join(tmpdir(), 'salt-marcher-references-'))
  roots.push(root)
  const campaigns = new CampaignStore(root)
  campaigns.create('References')
  const locations = new WorldLocationService(
    campaigns.activeCampaignPersistence()
  )
  const sources = new EncounterSourceService(
    campaigns.activeCampaignPersistence()
  )
  const npcResolver = {
    resolve(id: string) {
      const creature = creatureCatalog.find((candidate) => candidate.id === id)
      return creature ? { id: creature.id, displayName: creature.name } : null
    }
  }
  const npcs = new WorldNpcApplicationService(
    campaigns.activeCampaignPersistence(),
    npcResolver,
    (db) => {
      const tables = new EncounterTableStore(db)
      return new WorldFactionStore(db, {
        containsTable: (id) => tables.contains(id),
        containsCreature: (tableId, creatureId) =>
          tables.containsCreature(tableId, creatureId)
      })
    }
  )
  const creatures = new CreatureCatalogService(
    campaigns.installationPersistenceAccess()
  )
  const catalog = new ReferenceCatalogAdapter(
    resolve('resources/reference/srd-5.1.sqlite')
  )
  catalogs.push(catalog)
  return {
    campaigns,
    locations,
    sources,
    npcs,
    references: new ReferenceService(
      catalog,
      { all: () => creatureCatalog, detail: (id) => creatures.detail(id) },
      locations,
      { read: () => sources.readFactions() },
      { read: () => npcs.readAllForReferences() },
      () => campaigns.activeCampaignId(),
      new PlannedSceneReferences(campaigns.activeCampaignPersistence())
    )
  }
}

describe('reference service', () => {
  it('finds saved Scene notes across sessions without changing selected preparation, and distinguishes repeated titles', () => {
    const { campaigns, references } = harness()
    const persistence = campaigns.activeCampaignPersistence()
    const campaignId = campaigns.activeCampaignId()
    const createScene = (sessionName: string, notes: string, manual: string) =>
      persistence.use((db) => {
        const store = new SessionPlannerStore(db)
        const session = store.create(sessionName)
        const sceneId = randomUUID()
        const saved = store.save({
          sessionId: session.id,
          expectedRevision: session.revision,
          participantIds: [],
          adventureDayFraction: '1',
          encounterCount: null,
          selectedSceneId: sceneId,
          scenes: [
            {
              id: sceneId,
              titleKind: 'authored',
              title: 'Verhör am Glassteg',
              notes,
              locationId: null,
              encounterPlanId: null,
              allocatedXp: 0,
              position: 0,
              restAfter: null,
              manualLootNotes: manual
                ? [{ id: randomUUID(), text: manual, position: 0 }]
                : [],
              generatedRewards: []
            }
          ]
        })
        return { store, saved, sceneId }
      })
    const first = createScene(
      'Am Hafen',
      'Die Zeugin erwähnt eine kobaltblaue Erinnerung.',
      'Die gestohlene Smaragdbrosche liegt am Kai.'
    )
    const second = createScene('Im Wald', 'Die Zeugin bleibt stumm.', '')
    const selected = persistence.use((db) =>
      new SessionPlannerStore(db).currentId()
    )
    const search = (query: string) =>
      references.searchCampaign({ campaignId, query, offset: 0, limit: 100 })
    const matches = search('Verhör')
    expect(matches.total).toBe(2)
    expect(matches.candidates.map((c) => c.contextLabel).toSorted()).toEqual([
      'Geplante Szene · Am Hafen',
      'Geplante Szene · Im Wald'
    ])
    expect(search('Hafen kobaltblaue').candidates[0]?.target).toMatchObject({
      entityKind: 'planned-scene',
      entityId: first.sceneId
    })
    const loot = search('Smaragdbrosche')
    expect(loot.total).toBe(1)
    expect(references.detail(loot.candidates[0]!.target)).toMatchObject({
      documentKind: 'article',
      title: 'Verhör am Glassteg',
      facts: [
        { label: 'Sitzung', value: [{ kind: 'text', text: 'Am Hafen' }] }
      ],
      blocks: [
        {
          kind: 'paragraph',
          inlines: [
            {
              kind: 'text',
              text: 'Die Zeugin erwähnt eine kobaltblaue Erinnerung.'
            }
          ]
        },
        {
          kind: 'heading',
          level: 2,
          inlines: [{ kind: 'text', text: 'Manuelle Loot-Notizen' }]
        },
        {
          kind: 'list',
          ordered: false,
          items: [
            [
              {
                kind: 'text',
                text: 'Die gestohlene Smaragdbrosche liegt am Kai.'
              }
            ]
          ]
        }
      ]
    })
    expect(
      persistence.use((db) => new SessionPlannerStore(db).currentId())
    ).toBe(selected)
    persistence.use((db) =>
      new SessionPlannerStore(db).delete(first.saved.id, first.saved.revision)
    )
    expect(search('Smaragdbrosche').total).toBe(0)
    expect(() => references.detail(loot.candidates[0]!.target)).toThrow(
      'not_found'
    )
    expect(search('stumm').candidates[0]?.target).toMatchObject({
      entityId: second.sceneId
    })
    campaigns.create('Other')
    expect(() => search('stumm')).toThrow('not_found')
    campaigns.close()
  })

  it('retains valid manual notes beyond one reference-list block', () => {
    const { campaigns, references } = harness()
    const sceneId = randomUUID()
    campaigns.activeCampaignPersistence().use((db) => {
      const store = new SessionPlannerStore(db),
        current = store.require(store.currentId())
      store.save({
        sessionId: current.id,
        expectedRevision: current.revision,
        participantIds: [],
        adventureDayFraction: '1',
        encounterCount: null,
        selectedSceneId: sceneId,
        scenes: [
          {
            id: sceneId,
            titleKind: 'authored',
            title: 'Fundstücke',
            notes: '',
            locationId: null,
            encounterPlanId: null,
            allocatedXp: 0,
            position: 0,
            restAfter: null,
            generatedRewards: [],
            manualLootNotes: Array.from({ length: 1001 }, (_, position) => ({
              id: randomUUID(),
              text: `Fundstück ${position + 1}`,
              position
            }))
          }
        ]
      })
    })
    const page = references.searchCampaign({
      campaignId: campaigns.activeCampaignId(),
      query: 'Fundstück 1001',
      offset: 0,
      limit: 100
    })
    expect(page.total).toBe(1)
    const document = references.detail(page.candidates[0]!.target)
    if (document.documentKind !== 'article')
      throw new Error('Expected Scene document')
    const lists = document.blocks.filter((block) => block.kind === 'list')
    expect(lists.flatMap((block) => block.items)).toHaveLength(1001)
    expect(lists.at(-1)?.items.at(-1)).toEqual([
      { kind: 'text', text: 'Fundstück 1001' }
    ])
    campaigns.close()
  })

  it('finds GM prose across fields, normalizes Unicode, and never searches a different Campaign', () => {
    const { campaigns, locations, sources, references } = harness()
    const campaignId = campaigns.activeCampaignId()
    const search = (query: string) =>
      references.searchCampaign({ campaignId, query, offset: 0, limit: 100 })
    const created = locations.create(
      {
        displayName: 'Alter Hafen',
        tags: ['Küste'],
        notes: 'Kai 30: Überfall bei Vollmond.'
      },
      0
    ).saved
    const faction = sources.createFaction(
      randomUUID(),
      {
        displayName: 'Seewache',
        notes: 'Die Schuld wird am Kai beglichen.',
        disposition: 0,
        primaryEncounterTableId: null,
        inventory: []
      },
      0
    ).saved
    expect(
      search('hafen ÜBERFALL').candidates.map((entry) => entry.target)
    ).toEqual([
      {
        scope: 'campaign',
        campaignId,
        entityKind: 'location',
        entityId: created.id
      }
    ])
    expect(search('U\u0308BERFALL').candidates[0]?.title).toBe('Alter Hafen')
    expect(search('küste kai 30').candidates[0]?.title).toBe('Alter Hafen')
    expect(search('Schuld').candidates[0]?.target).toMatchObject({
      entityKind: 'faction',
      entityId: faction.id
    })
    expect(search('   ')).toEqual({ candidates: [], total: 0, offset: 0 })
    locations.update(
      created.id,
      {
        displayName: created.displayName,
        tags: created.tags,
        notes: 'Nur noch eine Fähre.'
      },
      locations.read().revision
    )
    expect(search('Überfall').total).toBe(0)
    expect(search('Fähre').total).toBe(1)
    campaigns.create('Other')
    expect(() => search('Fähre')).toThrow()
    campaigns.close()
  })

  it('retrieves prepared narration and keeps it separate from GM secrets without dropping line breaks', () => {
    const { campaigns, locations, references } = harness()
    const campaignId = campaigns.activeCampaignId()
    const readAloud =
      'Unter euch glühen sternenblaue Quallen.\n\nAm Ende wartet die schweigende Fährfrau.'
    const notes = 'Die Fährfrau fordert eine Erinnerung statt Münzen.'
    const location = locations.create(
      { displayName: 'Glassteg', tags: ['Ort'], readAloud, notes },
      0
    ).saved
    const hits = references.searchCampaign({
      campaignId,
      query: 'sternenblaue Quallen',
      offset: 0,
      limit: 100
    })
    expect(hits.total).toBe(1)
    const target = hits.candidates[0]!.target
    const document = references.detail(target)
    expect(document.documentKind).toBe('article')
    if (document.documentKind !== 'article')
      throw new Error('Expected location document')
    expect(document.blocks).toEqual([
      {
        kind: 'heading',
        level: 2,
        inlines: [{ kind: 'text', text: 'Vorlesetext' }]
      },
      { kind: 'paragraph', inlines: [{ kind: 'text', text: readAloud }] },
      {
        kind: 'heading',
        level: 2,
        inlines: [{ kind: 'text', text: 'GM-Notizen' }]
      },
      { kind: 'paragraph', inlines: [{ kind: 'text', text: notes }] }
    ])
    locations.update(
      location.id,
      {
        displayName: location.displayName,
        tags: location.tags,
        readAloud: '',
        notes: ''
      },
      locations.read().revision
    )
    expect(
      references.searchCampaign({
        campaignId,
        query: 'sternenblaue',
        offset: 0,
        limit: 100
      }).total
    ).toBe(0)
    const empty = references.detail(target)
    expect(empty).toMatchObject({ blocks: [] })
    campaigns.close()
  })

  it('pages matching records without collapsing duplicate names or silently losing the last matches', () => {
    const { campaigns, locations, references } = harness()
    const campaignId = campaigns.activeCampaignId()
    for (let index = 0; index < 105; index += 1)
      locations.create(
        { displayName: 'Lager', tags: ['Ort'], notes: 'versiegelte Kiste' },
        locations.read().revision
      )
    const first = references.searchCampaign({
      campaignId,
      query: 'Kiste',
      offset: 0,
      limit: 100
    })
    const second = references.searchCampaign({
      campaignId,
      query: 'Kiste',
      offset: 100,
      limit: 100
    })
    expect(first.total).toBe(105)
    expect(first.candidates).toHaveLength(100)
    expect(second.candidates).toHaveLength(5)
    expect(
      new Set(
        [...first.candidates, ...second.candidates].map((entry) =>
          JSON.stringify(entry.target)
        )
      ).size
    ).toBe(105)
    campaigns.close()
  })
  it('publishes pinned offline SRD concepts and stable creature-part targets', () => {
    const { campaigns, references } = harness()
    const index = references.staticIndex()
    const terms = new Set(index.terms.map((term) => term.term))
    expect(index.scope).toBe('static')
    expect(terms.has('Prone')).toBe(true)
    expect(terms.has('Magic Missile')).toBe(true)
    expect(terms.has('Dash')).toBe(true)
    expect(terms.has('Longsword')).toBe(true)

    const prone = references.detail({
      scope: 'srd',
      catalogId: 'srd-5.1',
      definitionKind: 'condition',
      definitionId: 'conditions:prone'
    })
    expect(prone.documentKind).toBe('article')
    expect(JSON.stringify(prone)).toContain('movement')

    const goblin = references.detail({
      scope: 'creature',
      creatureId: 'goblin'
    })
    expect(goblin.documentKind).toBe('creature')
    if (goblin.documentKind === 'creature')
      expect(goblin.creature.name).toBe('Goblin')
    expect(
      references.detail({
        scope: 'creature-part',
        creatureId: 'goblin',
        partKind: 'trait',
        partId: 'nimble-escape'
      }).title
    ).toBe('Nimble Escape')
    campaigns.close()
  })

  it('isolates exact campaign terms by explicit campaign id', () => {
    const { campaigns, locations, references } = harness()
    const world = locations.create(
      {
        displayName: 'Slow',
        tags: ['Ort'],
        notes: 'Magic Missile is forbidden here.'
      },
      locations.read().revision
    ).snapshot
    const campaignId = campaigns.activeCampaignId()
    const location = world.locations[0]!
    const before = references.campaignIndex(campaignId)
    expect(before.scope).toBe('campaign')
    expect(before.terms.find((term) => term.term === 'Slow')?.matchMode).toBe(
      'exact'
    )

    locations.update(
      location.id,
      {
        displayName: 'The Quiet Keep',
        tags: location.tags,
        notes: location.notes
      },
      world.revision
    )
    const renamed = references.campaignIndex(campaignId)
    expect(renamed.revision).not.toBe(before.revision)
    expect(renamed.terms.some((term) => term.term === 'The Quiet Keep')).toBe(
      true
    )
    expect(() => references.campaignIndex('another-campaign')).toThrow(
      'not_found'
    )
    campaigns.close()
  })

  it('indexes NPC names and returns current creature, faction and location facts', () => {
    const { campaigns, locations, sources, npcs, references } = harness()
    const faction = sources.createFaction(
      randomUUID(),
      {
        displayName: 'Rosenhof',
        notes: '',
        disposition: 15,
        primaryEncounterTableId: null,
        inventory: []
      },
      0
    ).saved
    const location = locations.create(
      {
        displayName: 'Flussuferhöhle',
        tags: ['Höhle'],
        notes: ''
      },
      0
    ).saved
    const created = npcs.create(
      randomUUID(),
      {
        displayName: 'Erika',
        creatureId: 'sprite',
        lifecycle: 'active',
        appearance: 'Silberne Flügel.',
        behavior: 'Neugierig.',
        history: 'Tochter von Rosenschein.',
        notes: 'Gerettet.',
        dispositionModifier: 2,
        factionId: faction.id,
        locationId: location.id
      },
      0,
      1
    )
    const campaignId = campaigns.activeCampaignId()
    const indexed = references.campaignIndex(campaignId)
    const candidate = indexed.terms.find((term) => term.term === 'Erika')
      ?.candidates[0]
    for (const query of [
      'Flügel',
      'Neugierig',
      'Rosenschein',
      'Gerettet',
      'erika Flügel'
    ])
      expect(
        references.searchCampaign({ campaignId, query, offset: 0, limit: 100 })
          .candidates
      ).toContainEqual(candidate)
    expect(candidate?.target).toEqual({
      scope: 'campaign',
      campaignId,
      entityKind: 'npc',
      entityId: created.saved.id
    })
    const detail = references.detail(candidate!.target)
    expect(JSON.stringify(detail)).toContain('Sprite (sprite)')
    expect(JSON.stringify(detail)).toContain('Rosenhof')
    expect(JSON.stringify(detail)).toContain('Flussuferhöhle')
    expect(JSON.stringify(detail)).toContain('Silberne Flügel.')

    const factionsBefore = sources.readFactions().revision
    npcs.update(
      randomUUID(),
      created.saved.id,
      {
        displayName: created.saved.displayName,
        creatureId: created.saved.creatureId,
        lifecycle: created.saved.lifecycle,
        appearance: created.saved.appearance,
        behavior: created.saved.behavior,
        history: created.saved.history,
        notes: 'Aktualisiert.',
        dispositionModifier: created.saved.dispositionModifier,
        factionId: created.saved.factionId,
        locationId: created.saved.locationId
      },
      created.revision,
      created.factionRevision
    )
    const updatedIndex = references.campaignIndex(campaignId)
    expect(updatedIndex.revision).not.toBe(indexed.revision)
    expect(sources.readFactions().revision).toBe(factionsBefore)
    expect(JSON.stringify(references.detail(candidate!.target))).toContain(
      'Aktualisiert.'
    )
    campaigns.close()
  })
})
