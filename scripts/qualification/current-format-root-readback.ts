import assert from 'node:assert/strict'
import type Database from 'better-sqlite3'
import { creatures } from '../../src/core/creatures/catalog.js'
import type {
  CampaignImportEntityMapping,
  CampaignImportProvenance,
  CampaignImportSagaReceipt,
  PreviousCampaignImport
} from '../../src/core/campaign-import/campaign-import-store.js'
import { PartyStore } from '../../src/core/party/party-store.js'
import { CampaignStore } from '../../src/core/persistence/sqlite/campaign-store.js'
import { databaseSchemaVersions } from '../../src/core/persistence/sqlite/database.js'
import { WorldFactionStore } from '../../src/core/worldplanner/faction-store.js'
import { WorldLocationStore } from '../../src/core/worldplanner/location-store.js'
import { WorldNpcStore } from '../../src/core/worldplanner/npc-store.js'
import type { PartySnapshot } from '../../src/shared/contracts/party.js'
import type { WorldFactionSnapshot } from '../../src/shared/contracts/encounter-source.js'
import type { WorldLocationSnapshot } from '../../src/shared/contracts/world-location.js'
import type { WorldNpcSnapshot } from '../../src/shared/contracts/world-npc.js'
import type {
  CurrentFormatRootCampaign,
  CurrentFormatRootFixture
} from './current-format-root-fixture.js'

const noEncounterReferences = {
  containsTable: () => false,
  containsCreature: () => false
}
const creatureReferences = new Map(
  creatures.map((creature) => [
    creature.id,
    { id: creature.id, displayName: creature.name }
  ])
)
const creatureResolver = {
  resolve: (id: string) => creatureReferences.get(id) ?? null
}

type StructuralReadback = Readonly<{
  campaignRuntimeRows: number
  migrationMetadataRows: number
  userVersion: number
}>

export type CurrentFormatRootCampaignReadback = Readonly<{
  role: 'A' | 'B'
  campaignId: string
  campaignName: string
  sourceId: string
  registryImport: PreviousCampaignImport
  provenance: CampaignImportProvenance | null
  mappings: readonly CampaignImportEntityMapping[]
  saga: CampaignImportSagaReceipt | null
  party: PartySnapshot
  locations: WorldLocationSnapshot
  factions: WorldFactionSnapshot
  npcs: WorldNpcSnapshot
  structure: StructuralReadback
}>

export type CurrentFormatRootReadback = Readonly<{
  fixtureIdentity: string
  qualificationClaim: string
  registryRevision: number
  activeCampaignId: string | null
  campaigns: readonly CurrentFormatRootCampaignReadback[]
}>

export function readCurrentFormatRootFixture(
  dataRoot: string,
  fixture: CurrentFormatRootFixture
): CurrentFormatRootReadback {
  const campaigns = new CampaignStore(dataRoot)
  try {
    const registry = campaigns.list()
    const imports = campaigns.campaignImportRepository()
    const readbacks = fixture.campaigns.map((expected) => {
      const previous = imports.previous(expected.bundle.source.id)
      if (!previous)
        throw new Error(
          `Current-format root source ${expected.bundle.source.id} is not registered.`
        )
      const campaign = registry.campaigns.find(
        ({ id }) => id === previous.campaignId
      )
      if (!campaign)
        throw new Error(
          `Current-format root Campaign ${expected.role} is not available.`
        )
      const readback = campaigns.visitCampaignDatabase(
        campaign.id,
        (database) => ({
          role: expected.role,
          campaignId: campaign.id,
          campaignName: campaign.name,
          sourceId: expected.bundle.source.id,
          registryImport: previous,
          provenance: imports.provenance(database, expected.bundle.source.id),
          mappings: imports.entityMappings(database, expected.bundle.source.id),
          saga: imports.latestSagaForSource(expected.bundle.source.id),
          party: new PartyStore(database).read(),
          locations: new WorldLocationStore(database).read(),
          factions: new WorldFactionStore(
            database,
            noEncounterReferences
          ).read(),
          npcs: new WorldNpcStore(
            database,
            creatureResolver
          ).readAllForReferences(),
          structure: structuralReadback(database)
        })
      )
      if (!readback)
        throw new Error(
          `Current-format root Campaign ${expected.role} database is unavailable.`
        )
      return readback
    })
    const after = campaigns.list()
    assert.deepStrictEqual(
      after,
      registry,
      'Independent root readback must not mutate Campaign registry state.'
    )
    return Object.freeze({
      fixtureIdentity: fixture.identity,
      qualificationClaim: fixture.qualificationClaim,
      registryRevision: registry.revision,
      activeCampaignId: registry.activeCampaignId,
      campaigns: Object.freeze(readbacks)
    })
  } finally {
    campaigns.close()
  }
}

export function assertCurrentFormatRootReadback(
  fixture: CurrentFormatRootFixture,
  readback: CurrentFormatRootReadback
): void {
  assert.equal(readback.fixtureIdentity, fixture.identity)
  assert.equal(readback.qualificationClaim, fixture.qualificationClaim)
  assert.equal(readback.campaigns.length, fixture.campaigns.length)
  const allInternalIds = new Set<string>()
  for (const expected of fixture.campaigns) {
    const actual = readback.campaigns.find(({ role }) => role === expected.role)
    assert.ok(actual, `Missing root readback for Campaign ${expected.role}.`)
    assertCampaignReadback(expected, actual, allInternalIds)
  }
  const campaignA = readback.campaigns.find(({ role }) => role === 'A')!
  assert.equal(
    readback.activeCampaignId,
    campaignA.campaignId,
    'Campaign A must remain active after independent readback.'
  )
}

function assertCampaignReadback(
  expected: CurrentFormatRootCampaign,
  actual: CurrentFormatRootCampaignReadback,
  allInternalIds: Set<string>
): void {
  assert.equal(actual.campaignName, expected.bundle.campaign.name)
  assert.equal(actual.sourceId, expected.bundle.source.id)
  assert.deepStrictEqual(actual.registryImport, {
    campaignId: actual.campaignId,
    campaignExternalKey: expected.bundle.campaign.externalKey,
    revision: expected.bundle.source.revision,
    exportHash: expected.bundle.source.exportHash
  })
  assert.deepStrictEqual(actual.provenance, {
    sourceId: expected.bundle.source.id,
    sourceRevision: expected.bundle.source.revision,
    exportHash: expected.bundle.source.exportHash
  })
  assert.equal(actual.saga?.phase, 'complete')
  assert.equal(actual.saga?.terminalResult, 'applied')
  assert.deepStrictEqual(
    actual.saga?.domainReadbacks
      .map(({ name, passed }) => ({ name, passed }))
      .toSorted((left, right) => left.name.localeCompare(right.name)),
    expected.bundle.source.sections
      .map((name) => ({ name, passed: true }))
      .toSorted((left, right) => left.name.localeCompare(right.name))
  )
  assert.deepStrictEqual(actual.structure, {
    campaignRuntimeRows: 0,
    migrationMetadataRows: 0,
    userVersion: databaseSchemaVersions.campaign
  })

  const expectedMappingCount =
    expected.bundle.party.length +
    expected.bundle.locations.length +
    expected.bundle.factions.length +
    expected.bundle.npcs.length
  assert.equal(actual.mappings.length, expectedMappingCount)
  for (const mapping of actual.mappings) {
    assert.match(mapping.internalId, /^[0-9a-f-]{36}$/i)
    assert.ok(
      !allInternalIds.has(mapping.internalId),
      `Imported identity ${mapping.internalId} is not unique across A/B.`
    )
    allInternalIds.add(mapping.internalId)
  }

  assert.deepStrictEqual(
    byExternalKey(expected.bundle.party).map((entry) => ({
      externalKey: entry.externalKey,
      name: entry.name,
      playerName: entry.playerName,
      species: entry.species?.resolved ?? null,
      characterClass: entry.characterClass,
      languages: entry.languages.map(({ resolved }) => resolved),
      level: entry.level,
      passivePerception: entry.passivePerception,
      passiveInvestigation: entry.passiveInvestigation,
      passiveInsight: entry.passiveInsight,
      armorClass: entry.armorClass,
      movementSpeedFeet: entry.movementSpeedFeet,
      active: true,
      travelPosition: null
    })),
    projectMapped(actual.mappings, 'party', actual.party.members, (entry) => ({
      name: entry.name,
      playerName: entry.playerName,
      species: entry.species,
      characterClass: entry.characterClass,
      languages: entry.languages,
      level: entry.level,
      passivePerception: entry.passivePerception,
      passiveInvestigation: entry.passiveInvestigation,
      passiveInsight: entry.passiveInsight,
      armorClass: entry.armorClass,
      movementSpeedFeet: entry.movementSpeedFeet,
      active: entry.active,
      travelPosition: entry.travelPosition
    }))
  )
  assert.deepStrictEqual(
    byExternalKey(expected.bundle.locations).map((entry) => ({
      externalKey: entry.externalKey,
      displayName: entry.displayName,
      tags: entry.tags,
      readAloud: entry.readAloud,
      notes: entry.notes,
      factionIds: [],
      encounterTableIds: []
    })),
    projectMapped(
      actual.mappings,
      'locations',
      actual.locations.locations,
      (entry) => ({
        displayName: entry.displayName,
        tags: entry.tags,
        readAloud: entry.readAloud,
        notes: entry.notes,
        factionIds: entry.factionIds,
        encounterTableIds: entry.encounterTableIds
      })
    )
  )
  assert.deepStrictEqual(
    byExternalKey(expected.bundle.factions).map((entry) => ({
      externalKey: entry.externalKey,
      displayName: entry.displayName,
      notes: entry.notes,
      disposition: entry.disposition,
      primaryEncounterTableId: null,
      inventory: []
    })),
    projectMapped(
      actual.mappings,
      'factions',
      actual.factions.factions,
      (entry) => ({
        displayName: entry.displayName,
        notes: entry.notes,
        disposition: entry.disposition,
        primaryEncounterTableId: entry.primaryEncounterTableId,
        inventory: entry.inventory
      })
    )
  )
  const mappingIds = new Map(
    actual.mappings.map((mapping) => [
      `${mapping.kind}:${mapping.externalKey}`,
      mapping.internalId
    ])
  )
  assert.deepStrictEqual(
    byExternalKey(expected.bundle.npcs).map((entry) => ({
      externalKey: entry.externalKey,
      displayName: entry.displayName,
      creatureId: entry.creature.resolvedId,
      lifecycle: entry.lifecycle,
      appearance: entry.appearance,
      behavior: entry.behavior,
      history: entry.history,
      notes: entry.notes,
      dispositionModifier: entry.dispositionModifier,
      factionId:
        entry.factionExternalKey === null
          ? null
          : mappingIds.get(`factions:${entry.factionExternalKey}`),
      locationId:
        entry.locationExternalKey === null
          ? null
          : mappingIds.get(`locations:${entry.locationExternalKey}`)
    })),
    projectMapped(actual.mappings, 'npcs', actual.npcs.npcs, (entry) => ({
      displayName: entry.displayName,
      creatureId: entry.creatureId,
      lifecycle: entry.lifecycle,
      appearance: entry.appearance,
      behavior: entry.behavior,
      history: entry.history,
      notes: entry.notes,
      dispositionModifier: entry.dispositionModifier,
      factionId: entry.factionId,
      locationId: entry.locationId
    }))
  )
}

function projectMapped<T extends { id: string }, R>(
  mappings: readonly CampaignImportEntityMapping[],
  kind: CampaignImportEntityMapping['kind'],
  values: readonly T[],
  project: (value: T) => R
): readonly ({ externalKey: string } & R)[] {
  return mappings
    .filter((mapping) => mapping.kind === kind)
    .map((mapping) => {
      const value = values.find(({ id }) => id === mapping.internalId)
      assert.ok(
        value,
        `Imported ${mapping.kind} identity ${mapping.internalId} is missing.`
      )
      return { externalKey: mapping.externalKey, ...project(value) }
    })
}

function byExternalKey<T extends { externalKey: string }>(
  values: readonly T[]
): readonly T[] {
  return values.toSorted((left, right) =>
    left.externalKey.localeCompare(right.externalKey)
  )
}

function structuralReadback(database: Database.Database): StructuralReadback {
  return {
    campaignRuntimeRows: (
      database
        .prepare('SELECT COUNT(*) AS value FROM campaign_runtime')
        .get() as {
        value: number
      }
    ).value,
    migrationMetadataRows: (
      database
        .prepare('SELECT COUNT(*) AS value FROM campaign_schema_migration')
        .get() as { value: number }
    ).value,
    userVersion: database.pragma('user_version', { simple: true }) as number
  }
}
