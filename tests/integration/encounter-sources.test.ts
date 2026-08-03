import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
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
  const path = () => campaigns.activeCampaignDatabase()
  const sources = new EncounterSourceService(path)
  const locations = new WorldLocationService(path)
  const catalog = new CreatureCatalogService(
    () => campaigns.installationDatabase(),
    (query) => sources.resolve(query),
    () => ({
      encounterTables: sources
        .readTables()
        .tables.map((table) => ({ id: table.id, label: table.displayName })),
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
    play: new LivePlayService(path)
  }
}

const query = (values: Record<string, unknown> = {}) =>
  creatureCatalogQuerySchema.parse({ limit: 100, ...values })

describe('encounter tables and factions', () => {
  it('persists CRUD data, resolves dimensions and exposes source choices', () => {
    const { campaigns, sources, locations, catalog } = harness()
    const [first, second] = creatures
    expect(first).toBeDefined()
    expect(second).toBeDefined()

    let tables = sources.createTable(
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
    tables = sources.createTable(
      {
        displayName: 'Elite',
        description: '',
        entries: [{ creatureId: second!.id, weight: 4 }]
      },
      tables.revision
    )
    const patrolId = tables.tables[0]!.id
    const eliteId = tables.tables[1]!.id
    let factions = sources.createFaction(
      {
        displayName: 'Sea Princes',
        notes: 'Hostile smugglers',
        disposition: -35,
        primaryEncounterTableId: eliteId,
        inventory: [{ creatureId: second!.id, maximum: 2 }]
      },
      0
    )
    const factionId = factions.factions[0]!.id
    let world = locations.create(
      {
        displayName: 'Hidden Cove',
        notes: '',
        factionIds: [factionId],
        encounterTableIds: []
      },
      0
    )

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

    tables = sources.updateTable(
      eliteId,
      {
        displayName: 'Elite',
        description: 'Changed membership',
        entries: [{ creatureId: first!.id, weight: 4 }]
      },
      tables.revision
    )
    factions = sources.readFactions()
    expect(factions.factions[0]).toMatchObject({
      primaryEncounterTableId: eliteId,
      inventory: []
    })

    tables = sources.deleteTable(eliteId, tables.revision)
    factions = sources.readFactions()
    world = locations.read()
    expect(factions.factions[0]).toMatchObject({
      primaryEncounterTableId: null,
      inventory: []
    })
    expect(world.locations[0]!.factionIds).toEqual([factionId])
    expect(tables.tables).toHaveLength(1)
    campaigns.close()
  })

  it('accepts faction limits only for creatures in the primary table', () => {
    const { campaigns, sources } = harness()
    const [first, second] = creatures
    const tables = sources.createTable(
      {
        displayName: 'Narrow source',
        description: '',
        entries: [{ creatureId: first!.id, weight: 1 }]
      },
      0
    )
    const tableId = tables.tables[0]!.id
    expect(() =>
      sources.createFaction(
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
      { displayName: 'Empty', description: '', entries: [] },
      0
    )
    const emptyId = tables.tables[0]!.id
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

  it('uses the focused location faction and inventory cap in generation', () => {
    const { campaigns, sources, locations, play } = harness()
    const creature = creatures.find((entry) => entry.xp > 0)!
    const tables = sources.createTable(
      {
        displayName: 'Limited Guard',
        description: '',
        entries: [{ creatureId: creature.id, weight: 10 }]
      },
      0
    )
    const factions = sources.createFaction(
      {
        displayName: 'Watch',
        notes: '',
        disposition: 10,
        primaryEncounterTableId: tables.tables[0]!.id,
        inventory: [{ creatureId: creature.id, maximum: 1 }]
      },
      0
    )
    const world = locations.create(
      {
        displayName: 'Gate',
        notes: '',
        factionIds: [factions.factions[0]!.id],
        encounterTableIds: []
      },
      0
    )
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
      query(),
      {
        difficulty: 'medium',
        amount: 'many',
        balance: 'auto',
        diversity: 'auto'
      },
      7,
      session.scene.revision
    )
    expect(generation.entries).toEqual([
      expect.objectContaining({ creatureId: creature.id, quantity: 1 })
    ])
    expect(generation.context).toMatchObject({
      locationId: world.locations[0]!.id,
      effectiveFactionIds: [factions.factions[0]!.id],
      catalogFallback: false
    })
    campaigns.close()
  })
})
