import { randomUUID } from 'node:crypto'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { BiomeCatalogService } from '../../src/core/application/biome-catalog-service.js'
import { EncounterSourceService } from '../../src/core/application/encounter-source-service.js'
import { CampaignStore } from '../../src/core/persistence/sqlite/campaign-store.js'
import { HexMapStore } from '../../src/core/hex/hex-map-store.js'
import { WorldLocationStore } from '../../src/core/worldplanner/location-store.js'
import { placeholderBiomeId } from '../../src/shared/contracts/biome.js'
import { creatures } from '../../src/core/creatures/catalog.js'
import { creatureCatalogQuerySchema } from '../../src/shared/contracts/encounter.js'
import { BiomeHexUsageStore } from '../../src/core/hex/biome-hex-usage-store.js'
import { LivePlayService } from '../../src/core/encounter/live-combat.js'
import { HexTravelService } from '../../src/core/hex/hex-travel.js'

const roots: string[] = []
const stores: CampaignStore[] = []

afterEach(() => {
  for (const store of stores.splice(0)) store.close()
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true })
})

function harness() {
  const root = mkdtempSync(join(tmpdir(), 'salt-marcher-biomes-'))
  roots.push(root)
  const campaigns = new CampaignStore(root)
  stores.push(campaigns)
  campaigns.create('Biom-Test')
  const biomes = new BiomeCatalogService(campaigns)
  const sources = new EncounterSourceService(
    () => campaigns.activeCampaignDatabase(),
    () => campaigns.installationDatabase()
  )
  return { campaigns, biomes, sources }
}

describe('installation biome catalog', () => {
  it('binds command IDs to one biome mutation payload', () => {
    const { campaigns, biomes } = harness()
    const commandId = randomUUID()
    const draft = {
      displayName: 'Wiederholbar',
      color: '#56734a',
      passable: true,
      travelCost: 1,
      encounterTableIds: []
    }
    const first = biomes.create(commandId, draft, 0)
    expect(biomes.create(commandId, draft, 0)).toEqual(first)
    expect(() =>
      biomes.create(commandId, { ...draft, displayName: 'Anders' }, 0)
    ).toThrow('validation')
    campaigns.close()
  })

  it('canonicalizes the SRD environments into 35 searchable biomes', () => {
    const { biomes, sources } = harness()
    const page = biomes.search({ query: '', offset: 0, limit: 60 })
    expect(page.total).toBe(35)
    expect(page.biomes).toHaveLength(35)
    expect(page.biomes.map((biome) => biome.displayName)).toContain('Arktis')
    expect(page.biomes.map((biome) => biome.displayName)).toContain('Feywild')
    expect(
      biomes.search({ query: 'Mountains', offset: 0, limit: 10 }).biomes
    ).toMatchObject([{ id: 'mountain', displayName: 'Gebirge' }])
    expect(
      biomes.search({ query: 'Caves', offset: 0, limit: 10 }).biomes
    ).toMatchObject([{ id: 'cavern', displayName: 'Höhlen' }])

    const installationTables = sources
      .readTables()
      .tables.filter((table) => table.scope === 'installation')
    expect(installationTables).toHaveLength(36)
    expect(installationTables.every((table) => table.protected)).toBe(true)
    const resolved = sources.resolve(
      creatureCatalogQuerySchema.parse({ biomes: ['forest'], limit: 100 })
    )
    const creaturesById = new Map(
      creatures.map((creature) => [creature.id, creature])
    )
    expect(resolved.catalogFallback).toBe(false)
    expect(resolved.candidates?.length).toBeGreaterThan(0)
    expect(
      resolved.candidates?.every((candidate) => {
        const environments = creaturesById.get(candidate.creatureId)?.biomes
        return environments?.includes('Forest') || environments?.includes('Any')
      })
    ).toBe(true)
  })

  it('creates and updates unlimited custom entries linked to global tables', () => {
    const { biomes, sources } = harness()
    const tables = sources.createTable(
      randomUUID(),
      {
        displayName: 'Kristallbegegnungen',
        description: '',
        entries: []
      },
      0,
      'installation'
    )
    const linkedTable = tables.tables.find(
      (table) => table.displayName === 'Kristallbegegnungen'
    )!
    const created = biomes.create(
      randomUUID(),
      {
        displayName: 'Kristallwald',
        color: '#426f91',
        passable: true,
        travelCost: 3,
        encounterTableIds: [linkedTable.id]
      },
      0
    )
    expect(created.biome).toMatchObject({
      kind: 'custom',
      displayName: 'Kristallwald',
      encounterTableIds: [linkedTable.id]
    })

    const updated = biomes.update(
      randomUUID(),
      created.biome!.id,
      {
        displayName: 'Kristallforst',
        color: '#315a73',
        passable: false,
        travelCost: 7,
        encounterTableIds: [linkedTable.id]
      },
      created.revision
    )
    expect(updated.biome).toMatchObject({
      displayName: 'Kristallforst',
      passable: false,
      travelCost: 7
    })
    expect(
      biomes.search({ query: 'Kristall', offset: 0, limit: 10 }).total
    ).toBe(1)
    let revision = updated.revision
    for (let index = 1; index <= 64; index += 1)
      revision = biomes.create(
        randomUUID(),
        {
          displayName: `Eigenes Biom ${index}`,
          color: '#56734a',
          passable: true,
          travelCost: 1,
          encounterTableIds: []
        },
        revision
      ).revision
    const secondPage = biomes.search({ query: '', offset: 60, limit: 60 })
    expect(secondPage.total).toBe(100)
    expect(secondPage.biomes).toHaveLength(40)
    expect(
      biomes.hexCatalog().biomes.some((biome) => biome.id === created.biome!.id)
    ).toBe(false)
    expect(biomes.hexCatalog([created.biome!.id]).biomes).toEqual([
      expect.objectContaining({
        id: created.biome!.id,
        label: 'Kristallforst'
      })
    ])
  })

  it('marks deleted map usages and replaces the placeholder map-wide', () => {
    const { campaigns, biomes, sources } = harness()
    const globalTable = sources
      .createTable(
        randomUUID(),
        { displayName: 'Bleibende Tabelle', description: '', entries: [] },
        0,
        'installation'
      )
      .tables.find((table) => table.displayName === 'Bleibende Tabelle')!
    const created = biomes.create(
      randomUUID(),
      {
        displayName: 'Vergängliches Biom',
        color: '#5d4773',
        passable: true,
        travelCost: 2,
        encounterTableIds: [globalTable.id]
      },
      0
    )
    const customId = created.biome!.id
    const database = campaigns.activeCampaignDatabase()
    const maps = new HexMapStore(database, new WorldLocationStore(database))
    const map = maps.create({
      displayName: 'Testkarte',
      expectedCatalogRevision: 0
    })
    maps.applyBrushTargets({
      mapId: map.id,
      mode: 'paint',
      biomeId: customId,
      coordinates: [
        { q: 0, r: 0 },
        { q: 1, r: 0 }
      ],
      expectedContentRevision: 0
    })

    expect(biomes.deleteImpact(customId)).toMatchObject({
      totalMaps: 1,
      totalTiles: 2
    })
    const deleted = biomes.delete(randomUUID(), customId, created.revision)
    expect(deleted.changes).toEqual([
      expect.objectContaining({
        mapId: map.id,
        key: { q: 0, r: 0 },
        affectedTileCount: 2
      })
    ])
    expect(maps.readChunk(map.id, { q: 0, r: 0 }).authoredTiles).toEqual([
      { q: 0, r: 0, biomeId: placeholderBiomeId },
      { q: 1, r: 0, biomeId: placeholderBiomeId }
    ])
    expect(
      sources.readTables().tables.some((table) => table.id === globalTable.id)
    ).toBe(true)

    const changes = biomes.replaceMapPlaceholder({
      mapId: map.id,
      replacementBiomeId: 'forest',
      expectedContentRevision: 2
    })
    expect(changes).toEqual([expect.objectContaining({ affectedTileCount: 2 })])
    expect(maps.readChunk(map.id, { q: 0, r: 0 }).authoredTiles).toEqual([
      { q: 0, r: 0, biomeId: 'forest' },
      { q: 1, r: 0, biomeId: 'forest' }
    ])
  })

  it('uses the same custom biome projection in session travel readback', () => {
    const { campaigns, biomes } = harness()
    const created = biomes.create(
      randomUUID(),
      {
        displayName: 'Kristallpfad',
        color: '#426f91',
        passable: true,
        travelCost: 3,
        encounterTableIds: []
      },
      0
    )
    const database = campaigns.activeCampaignDatabase()
    const locations = new WorldLocationStore(database)
    const location = locations.create(
      {
        displayName: 'Kristalltor',
        notes: '',
        factionIds: [],
        encounterTableIds: []
      },
      0
    ).locations[0]!
    const maps = new HexMapStore(database, locations)
    const map = maps.create({
      displayName: 'Kristallkarte',
      expectedCatalogRevision: 0
    })
    const painted = maps.applyBrushTargets({
      mapId: map.id,
      mode: 'paint',
      biomeId: created.biome!.id,
      coordinates: [
        { q: 0, r: 0 },
        { q: 1, r: 0 }
      ],
      expectedContentRevision: 0
    })
    maps.placeLocation({
      mapId: map.id,
      locationId: location.id,
      coordinate: { q: 0, r: 0 },
      expectedContentRevision: painted.map.contentRevision
    })
    const play = new LivePlayService(
      () => database,
      (id) => {
        const biome = biomes.catalog.require(id)
        return {
          id: biome.id,
          label: biome.displayName,
          color: biome.color,
          passable: biome.passable,
          travelCost: biome.travelCost
        }
      }
    )
    let session = play.readSession()
    const member = session.party.members[0]!
    play.setMembership(member.id, true, session.party.revision)
    session = play.readSession()
    session = play.setSceneLocation(
      session.scene.focusedSceneId,
      location.id,
      session.scene.revision
    )
    const travel = new HexTravelService(
      () => database,
      Date.now,
      (id) => {
        const biome = biomes.catalog.require(id)
        return {
          id: biome.id,
          label: biome.displayName,
          color: biome.color,
          passable: biome.passable,
          travelCost: biome.travelCost
        }
      }
    )
    const ready = travel.read(session.scene.focusedSceneId)
    travel.start({
      sceneId: session.scene.focusedSceneId,
      mapId: map.id,
      waypoints: [{ q: 1, r: 0 }],
      multiplier: 1,
      expectedRevision: ready.revision
    })
    session = play.readSession()
    expect(session.travel).toMatchObject({
      kind: 'hex',
      remainingGameSeconds: 10_800
    })
  })

  it('recovers a partially completed deletion in a trashed campaign', () => {
    const { campaigns, biomes } = harness()
    const firstId = campaigns.list().activeCampaignId!
    const second = campaigns.create('Zweite Biom-Kampagne')
    const secondId = second.campaigns.find(
      (campaign) => campaign.name === 'Zweite Biom-Kampagne'
    )!.id
    const created = biomes.create(
      randomUUID(),
      {
        displayName: 'Abbruchbiom',
        color: '#5d4773',
        passable: true,
        travelCost: 2,
        encounterTableIds: []
      },
      0
    )
    const biomeId = created.biome!.id
    const maps = new Map<string, string>()
    for (const campaignId of [firstId, secondId]) {
      campaigns.activate(campaignId)
      const store = new HexMapStore(
        campaigns.activeCampaignDatabase(),
        new WorldLocationStore(campaigns.activeCampaignDatabase())
      )
      const map = store.create({
        displayName: `Karte ${campaignId}`,
        expectedCatalogRevision: 0
      })
      store.applyBrushTargets({
        mapId: map.id,
        mode: 'paint',
        biomeId,
        coordinates: [{ q: 0, r: 0 }],
        expectedContentRevision: 0
      })
      maps.set(campaignId, map.id)
    }
    campaigns.trash(firstId)

    const commandId = randomUUID()
    campaigns
      .installationDatabase()
      .prepare(
        `INSERT INTO biome_deletion
         (command_id, biome_id, expected_revision, state)
         VALUES (?, ?, ?, 'pending')`
      )
      .run(commandId, biomeId, created.revision)
    new BiomeHexUsageStore(
      campaigns.activeCampaignDatabase(),
      secondId
    ).replace(biomeId, placeholderBiomeId)
    biomes.catalog.remove(commandId, biomeId, created.revision)

    biomes.recoverPendingDeletions()
    expect(
      campaigns
        .installationDatabase()
        .prepare('SELECT state FROM biome_deletion WHERE command_id = ?')
        .get(commandId)
    ).toEqual({ state: 'completed' })
    campaigns.restore(firstId)
    for (const campaignId of [firstId, secondId]) {
      campaigns.activate(campaignId)
      const store = new HexMapStore(
        campaigns.activeCampaignDatabase(),
        new WorldLocationStore(campaigns.activeCampaignDatabase())
      )
      expect(
        store.readChunk(maps.get(campaignId)!, { q: 0, r: 0 }).authoredTiles[0]
          ?.biomeId
      ).toBe(placeholderBiomeId)
    }
    campaigns.close()
  })
})
