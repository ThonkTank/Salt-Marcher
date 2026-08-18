import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { afterEach, describe, expect, it } from 'vitest'
import {
  CreatureCatalogService,
  creatures
} from '../../src/core/creatures/catalog.js'
import { LivePlayService } from '../../src/core/encounter/live-combat.js'
import { CampaignStore } from '../../src/core/persistence/sqlite/campaign-store.js'
import { EncounterSourceService } from '../../src/core/application/encounter-source-service.js'
import { WorldLocationService } from '../../src/core/worldplanner/location-store.js'
import { creatureCatalogQuerySchema } from '../../src/shared/contracts/encounter.js'
import { EncounterTableStore } from '../../src/core/encounter/encounter-table-store.js'
import type { EncounterTableSnapshot } from '../../src/shared/contracts/encounter-source.js'
import { seedExampleParty } from '../../src/core/party/party-example-seed.js'
import {
  activeCampaignDatabase,
  installationDatabase
} from '../support/campaign-store-test-access.js'

const roots: string[] = []

afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true })
})

function harness() {
  const root = mkdtempSync(join(tmpdir(), 'salt-marcher-sources-'))
  roots.push(root)
  const campaigns = new CampaignStore(root)
  campaigns.create('Sources')
  seedExampleParty(activeCampaignDatabase(campaigns))
  const sources = new EncounterSourceService(
    campaigns.activeCampaignPersistence()
  )
  const locations = new WorldLocationService(
    campaigns.activeCampaignPersistence()
  )
  const catalog = new CreatureCatalogService(
    campaigns.installationPersistenceAccess(),
    (query) => sources.resolve(query),
    () => ({
      biomes: [],
      encounterTables: allTables(sources.readTables()).map((table) => ({
        id: table.id,
        label: table.displayName
      })),
      factions: sources.readFactions().factions.map((faction) => ({
        id: faction.id,
        label: faction.displayName
      })),
      locations: locations.read().locations.map((location) => ({
        id: location.id,
        label: location.displayName
      }))
    })
  )
  return {
    campaigns,
    sources,
    locations,
    catalog,
    play: new LivePlayService(campaigns.activeCampaignPersistence())
  }
}

const query = (values: Record<string, unknown> = {}) =>
  creatureCatalogQuerySchema.parse({ limit: 100, ...values })

describe('encounter tables and factions', () => {
  it('binds command IDs to exactly one encounter-table request', () => {
    const { campaigns } = harness()
    const sources = new EncounterSourceService(
      campaigns.activeCampaignPersistence(),
      campaigns.installationPersistenceAccess(),
      (visitor) => campaigns.visitCampaignDatabases(visitor)
    )
    const commandId = randomUUID()
    const draft = {
      displayName: 'Idempotent',
      description: '',
      entries: []
    }
    const first = sources.createTable(commandId, draft, 0)
    expect(sources.createTable(commandId, draft, 0)).toEqual(first)
    expect(sources.tableReceipt(commandId)).toEqual(first)
    sources.createTable(
      randomUUID(),
      {
        displayName: 'Unabhängige globale Tabelle',
        description: '',
        entries: []
      },
      first.snapshot.installation.revision,
      'installation'
    )
    expect(sources.createTable(commandId, draft, 0)).toEqual(first)
    expect(sources.tableReceipt(commandId)).toEqual(first)
    expect(() =>
      sources.createTable(
        commandId,
        { ...draft, displayName: 'Andere Anfrage' },
        0
      )
    ).toThrow('validation')
    campaigns.close()
  })

  it('binds command IDs to exactly one faction request and exact receipt', () => {
    const { campaigns, sources } = harness()
    const commandId = randomUUID()
    const draft = {
      displayName: 'Idempotenter Bund',
      notes: '',
      disposition: 0,
      primaryEncounterTableId: null,
      inventory: []
    }
    const first = sources.createFaction(commandId, draft, 0)
    expect(sources.createFaction(commandId, draft, 0)).toEqual(first)
    expect(sources.factionReceipt(commandId)).toEqual(first)
    expect(first.snapshot.factions).toContainEqual(first.saved)
    expect(() =>
      sources.createFaction(
        commandId,
        { ...draft, displayName: 'Andere Fraktion' },
        0
      )
    ).toThrow('validation')
    campaigns.close()
  })

  it('recovers a global table deletion across active and trashed campaigns', () => {
    const root = mkdtempSync(join(tmpdir(), 'salt-marcher-global-source-'))
    roots.push(root)
    const campaigns = new CampaignStore(root)
    const firstSnapshot = campaigns.create('Erste Kampagne')
    const firstId = firstSnapshot.campaigns.find(
      (campaign) => campaign.name === 'Erste Kampagne'
    )!.id
    const secondSnapshot = campaigns.create('Zweite Kampagne')
    const secondId = secondSnapshot.campaigns.find(
      (campaign) => campaign.name === 'Zweite Kampagne'
    )!.id
    const sources = new EncounterSourceService(
      campaigns.activeCampaignPersistence(),
      campaigns.installationPersistenceAccess(),
      (visitor) => {
        campaigns.visitCampaignDatabases(visitor)
      }
    )
    const tableReceipt = sources.createTable(
      randomUUID(),
      { displayName: 'Globaler Wachpool', description: '', entries: [] },
      0,
      'installation'
    )
    const table = tableReceipt.saved
    for (const campaignId of [firstId, secondId]) {
      campaigns.activate(campaignId)
      const faction = sources.createFaction(
        randomUUID(),
        {
          displayName: `Wache ${campaignId}`,
          notes: '',
          disposition: 0,
          primaryEncounterTableId: table.id,
          inventory: []
        },
        0
      ).saved
      new WorldLocationService(
        campaigns.activeCampaignPersistence(),
        undefined,
        campaigns.installationPersistenceAccess()
      ).create(
        {
          displayName: `Tor ${campaignId}`,
          tags: ['Tor'],
          notes: '',
          factionIds: [faction.id],
          encounterTableIds: [table.id]
        },
        0
      )
    }
    campaigns.trash(firstId)

    const commandId = randomUUID()
    const installationTables = new EncounterTableStore(
      installationDatabase(campaigns),
      'installation'
    )
    installationTables.beginInstallationLifecycle({
      commandId,
      operation: 'delete',
      tableId: table.id,
      expectedRevision: tableReceipt.snapshot.installation.revision
    })
    installationTables.delete(
      commandId,
      table.id,
      tableReceipt.snapshot.installation.revision
    )

    sources.recoverPendingInstallationTableLifecycles()
    expect(installationTables.lifecycleCompleted(commandId)).toBe(true)
    for (const campaignId of [secondId, firstId]) {
      if (campaignId === firstId) campaigns.restore(firstId)
      campaigns.activate(campaignId)
      expect(sources.readFactions().factions[0]).toMatchObject({
        primaryEncounterTableId: null
      })
      expect(
        new WorldLocationService(
          campaigns.activeCampaignPersistence(),
          undefined,
          campaigns.installationPersistenceAccess()
        ).read().locations[0]?.encounterTableIds
      ).toEqual([])
    }
    campaigns.close()
  })

  it('persists CRUD data, resolves dimensions and exposes source choices', () => {
    const { campaigns, sources, locations, catalog } = harness()
    const [first, second] = creatures
    expect(first).toBeDefined()
    expect(second).toBeDefined()

    const patrolReceipt = sources.createTable(
      randomUUID(),
      {
        displayName: 'Coast Patrol',
        description: 'Weighted coastal opposition',
        entries: [
          { creatureId: first!.id, weight: 2 },
          { creatureId: second!.id, weight: 8 }
        ]
      },
      0
    )
    let tables = patrolReceipt.snapshot
    const orderedCreatures = [first!, second!].toSorted(
      (left, right) => left.cr - right.cr || left.id.localeCompare(right.id)
    )
    expect(tables.campaign.summaries).toContainEqual({
      id: patrolReceipt.saved.id,
      scope: 'campaign',
      displayName: 'Coast Patrol',
      entryCount: 2,
      challengeRatingRange: {
        minimum: orderedCreatures[0]!.challengeRating,
        maximum: orderedCreatures.at(-1)!.challengeRating
      },
      biomes: [
        ...new Set(orderedCreatures.flatMap((creature) => creature.biomes))
      ].toSorted()
    })
    const eliteReceipt = sources.createTable(
      randomUUID(),
      {
        displayName: 'Elite',
        description: '',
        entries: [{ creatureId: second!.id, weight: 4 }]
      },
      tables.campaign.revision
    )
    tables = eliteReceipt.snapshot
    const patrolId = patrolReceipt.saved.id
    const eliteId = eliteReceipt.saved.id
    const factionReceipt = sources.createFaction(
      randomUUID(),
      {
        displayName: 'Sea Princes',
        notes: 'Hostile smugglers',
        disposition: -35,
        primaryEncounterTableId: eliteId,
        inventory: [{ creatureId: second!.id, maximum: 2 }]
      },
      0
    )
    const factionId = factionReceipt.saved.id
    let world = locations.create(
      {
        displayName: 'Hidden Cove',
        tags: ['Bucht'],
        notes: '',
        factionIds: [factionId],
        encounterTableIds: []
      },
      0
    ).snapshot

    const resolved = sources.resolve(
      query({ encounterTableIds: [patrolId], factionIds: [factionId] })
    )
    expect(resolved.catalogFallback).toBe(false)
    expect(resolved.candidates).toEqual([
      expect.objectContaining({ creatureId: second!.id, maximum: 2 })
    ])
    const options = catalog.filterOptions()
    expect(options.encounterTables).toContainEqual({
      id: patrolId,
      label: 'Coast Patrol'
    })
    expect(options.factions).toEqual([{ id: factionId, label: 'Sea Princes' }])
    expect(options.locations).toEqual([
      { id: world.locations[0]!.id, label: 'Hidden Cove' }
    ])

    const filtered = catalog.search(query({ factionIds: [factionId] }))
    expect(filtered.rows.map((creature) => creature.id)).toEqual([second!.id])

    const updatedTable = sources.updateTable(
      randomUUID(),
      eliteId,
      {
        displayName: 'Elite',
        description: 'Changed membership',
        entries: [{ creatureId: first!.id, weight: 4 }]
      },
      tables.campaign.revision
    )
    tables = updatedTable.snapshot
    let factions = sources.readFactions()
    expect(factions.factions[0]).toMatchObject({
      primaryEncounterTableId: eliteId,
      inventory: []
    })

    const deletedTable = sources.deleteTable(
      randomUUID(),
      eliteId,
      tables.campaign.revision
    )
    tables = deletedTable.snapshot
    factions = sources.readFactions()
    world = locations.read()
    expect(factions.factions[0]).toMatchObject({
      primaryEncounterTableId: null,
      inventory: []
    })
    expect(world.locations[0]!.factionIds).toEqual([factionId])
    expect(allTables(tables)).toHaveLength(1)
    campaigns.close()
  })

  it('accepts faction limits only for creatures in the primary table', () => {
    const { campaigns, sources } = harness()
    const [first, second] = creatures
    const tables = sources.createTable(
      randomUUID(),
      {
        displayName: 'Narrow source',
        description: '',
        entries: [{ creatureId: first!.id, weight: 1 }]
      },
      0
    )
    const tableId = tables.saved.id
    expect(() =>
      sources.createFaction(
        randomUUID(),
        {
          displayName: 'Invalid stock',
          notes: '',
          disposition: 0,
          primaryEncounterTableId: tableId,
          inventory: [{ creatureId: second!.id, maximum: 2 }]
        },
        0
      )
    ).toThrow('validation')
    expect(() =>
      sources.createFaction(
        randomUUID(),
        {
          displayName: 'Missing source',
          notes: '',
          disposition: 0,
          primaryEncounterTableId: null,
          inventory: [{ creatureId: first!.id, maximum: 2 }]
        },
        0
      )
    ).toThrow('validation')
    campaigns.close()
  })

  it('falls back only without effective tables and treats an empty table as no solution', () => {
    const { campaigns, sources, catalog } = harness()
    expect(sources.resolve(query({ locationId: null })).catalogFallback).toBe(
      true
    )
    const tables = sources.createTable(
      randomUUID(),
      { displayName: 'Empty', description: '', entries: [] },
      0
    )
    const emptyId = tables.saved.id
    const resolved = sources.resolve(query({ encounterTableIds: [emptyId] }))
    expect(resolved.catalogFallback).toBe(false)
    expect(resolved.candidates).toEqual([])
    expect(
      catalog.search(query({ encounterTableIds: [emptyId] }))
    ).toMatchObject({
      status: 'empty',
      total: 0
    })
    campaigns.close()
  })

  it('does not fall back globally for a location without a direct table', () => {
    const { campaigns, sources, locations } = harness()
    const location = locations.create(
      {
        displayName: 'Unconfigured Location',
        tags: ['Test'],
        notes: '',
        factionIds: [],
        encounterTableIds: []
      },
      0
    ).saved

    expect(sources.resolve(query({ locationId: location.id }))).toMatchObject({
      candidates: [],
      catalogFallback: false,
      sourceIssue: 'location_missing_table'
    })
    campaigns.close()
  })

  it('uses the focused location faction and inventory cap in generation', () => {
    const { campaigns, sources, locations, play } = harness()
    const creature = creatures.find((entry) => entry.xp > 0)!
    const tables = sources.createTable(
      randomUUID(),
      {
        displayName: 'Limited Guard',
        description: '',
        entries: [{ creatureId: creature.id, weight: 10 }]
      },
      0
    )
    const factions = sources.createFaction(
      randomUUID(),
      {
        displayName: 'Watch',
        notes: '',
        disposition: 10,
        primaryEncounterTableId: tables.saved.id,
        inventory: [{ creatureId: creature.id, maximum: 1 }]
      },
      0
    )
    const world = locations.create(
      {
        displayName: 'Gate',
        tags: ['Tor'],
        notes: '',
        factionIds: [factions.saved.id],
        encounterTableIds: [tables.saved.id]
      },
      0
    ).snapshot
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
    session = play.setSceneLocation(
      sceneId,
      world.locations[0]!.id,
      session.scene.revision
    )
    const generation = play.generateGroupDraft(
      sceneId,
      [],
      'replace',
      query({ locationId: world.locations[0]!.id }),
      {
        difficulty: 'medium',
        amount: 'many',
        balance: 'preset',
        diversity: 'preset'
      },
      7,
      session.scene.revision
    )
    expect(generation.entries).toEqual([
      expect.objectContaining({ creatureId: creature.id, quantity: 1 })
    ])
    expect(generation.context).toMatchObject({
      locationId: world.locations[0]!.id,
      effectiveFactionIds: [factions.saved.id],
      catalogFallback: false
    })
    campaigns.close()
  })

  it('honors an explicit dialog location over the focused scene location', () => {
    const { campaigns, sources, locations, play } = harness()
    const [focusedCreature, selectedCreature] = creatures.filter(
      (entry) => entry.xp > 0
    )
    const focusedTable = sources.createTable(
      randomUUID(),
      {
        displayName: 'Focused Source',
        description: '',
        entries: [{ creatureId: focusedCreature!.id, weight: 10 }]
      },
      0
    ).saved
    const selectedTable = sources.createTable(
      randomUUID(),
      {
        displayName: 'Selected Source',
        description: '',
        entries: [{ creatureId: selectedCreature!.id, weight: 10 }]
      },
      1
    ).saved
    const focusedLocation = locations.create(
      {
        displayName: 'Focused',
        tags: ['Test'],
        notes: '',
        factionIds: [],
        encounterTableIds: [focusedTable.id]
      },
      0
    ).saved
    const selectedLocation = locations.create(
      {
        displayName: 'Selected',
        tags: ['Test'],
        notes: '',
        factionIds: [],
        encounterTableIds: [selectedTable.id]
      },
      1
    ).saved

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
    session = play.setSceneLocation(
      sceneId,
      focusedLocation.id,
      session.scene.revision
    )

    const generation = play.generateGroupDraft(
      sceneId,
      [],
      'replace',
      query({ locationId: selectedLocation.id }),
      {
        difficulty: 'medium',
        amount: 'many',
        balance: 'preset',
        diversity: 'preset'
      },
      7,
      session.scene.revision
    )

    expect(generation.entries).toEqual([
      expect.objectContaining({ creatureId: selectedCreature!.id })
    ])
    expect(generation.context.locationId).toBe(selectedLocation.id)
    campaigns.close()
  })
})

function allTables(snapshot: EncounterTableSnapshot) {
  return [...snapshot.installation.tables, ...snapshot.campaign.tables]
}
