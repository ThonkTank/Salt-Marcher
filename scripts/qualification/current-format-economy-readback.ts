import assert from 'node:assert/strict'
import { BiomeCatalogStore } from '../../src/core/biomes/biome-catalog.js'
import { LootService } from '../../src/core/application/loot-service.js'
import { ItemDefinitionResolver } from '../../src/core/loot/item-definition-resolver.js'
import { CampaignStore } from '../../src/core/persistence/sqlite/campaign-store.js'
import { fixedSqliteDatabaseAccess } from '../../src/core/persistence/sqlite/database-access.js'
import { LocationSymbolService } from '../../src/core/worldplanner/location-symbol-store.js'
import { WorldLocationService } from '../../src/core/worldplanner/location-store.js'
import type { WorldLocationSnapshot } from '../../src/shared/contracts/world-location.js'
import type { CurrentFormatLiveFixture } from './current-format-live-fixture.js'
import { currentFormatLiveSemanticIdentities } from './current-format-live-readback.js'
import type {
  CurrentFormatEconomyCampaign,
  CurrentFormatEconomyFixture
} from './current-format-economy-fixture.js'
import type { CurrentFormatEconomyMaterializationReceipt } from './current-format-economy-materializer.js'
import type { CurrentFormatPreparationFixture } from './current-format-preparation-fixture.js'
import {
  assertCurrentFormatPreparationReadback,
  readCurrentFormatPreparationFixture,
  type CurrentFormatPreparationReadback
} from './current-format-preparation-readback.js'
import type { CurrentFormatRootFixture } from './current-format-root-fixture.js'
import type { CurrentFormatRootCampaignReadback } from './current-format-root-readback.js'
import type { CurrentFormatSpatialFixture } from './current-format-spatial-fixture.js'
import type { CurrentFormatSpatialCampaignReadback } from './current-format-spatial-readback.js'
import {
  assertNoRawUuid,
  collectUuids,
  replaceSemanticIdentities,
  semanticHash
} from './qualification-semantic-oracle.js'

type Settings = ReturnType<CampaignStore['readSettings']>
type Symbols = ReturnType<LocationSymbolService['read']>
type SystemBiomes = ReturnType<BiomeCatalogStore['resolve']>
type Treasure = ReturnType<LootService['read']>
type Ledger = ReturnType<LootService['ledger']>
type SceneProjection = ReturnType<LootService['sceneProjection']>
type Inbox = ReturnType<LootService['inbox']>
type LegacyDefinition = ReturnType<ItemDefinitionResolver['resolve']>

export type CurrentFormatEconomyCampaignReadback = Readonly<{
  role: 'A' | 'B'
  campaignId: string
  locations: WorldLocationSnapshot
  symbolLocation: WorldLocationSnapshot['locations'][number]
  legacyDefinition: LegacyDefinition
  manualTreasure: Treasure
  acceptedTreasure: Treasure
  ledger: Ledger
  sceneProjection: SceneProjection
  inbox: Inbox
  semanticProjection: unknown
  semanticSha256: string
}>

export type CurrentFormatEconomyReadback = Readonly<{
  fixtureIdentity: string
  qualificationClaim: string
  preparation: CurrentFormatPreparationReadback
  installation: Readonly<{
    settings: Settings
    symbols: Symbols
    systemBiomes: SystemBiomes
  }>
  campaigns: readonly CurrentFormatEconomyCampaignReadback[]
}>

export function readCurrentFormatEconomyFixture(
  dataRoot: string,
  rootFixture: CurrentFormatRootFixture,
  liveFixture: CurrentFormatLiveFixture,
  spatialFixture: CurrentFormatSpatialFixture,
  preparationFixture: CurrentFormatPreparationFixture,
  economyFixture: CurrentFormatEconomyFixture
): CurrentFormatEconomyReadback {
  const projectionExtensions = economyProjectionExtensions(
    dataRoot,
    rootFixture,
    economyFixture
  )
  const preparation = readCurrentFormatPreparationFixture(
    dataRoot,
    rootFixture,
    liveFixture,
    spatialFixture,
    preparationFixture,
    projectionExtensions
  )
  const campaigns = new CampaignStore(dataRoot)
  try {
    const registry = campaigns.list()
    const symbols = new LocationSymbolService(
      campaigns.installationPersistenceAccess()
    )
    const installation = campaigns
      .installationPersistenceAccess()
      .use((database) => ({
        settings: campaigns.readSettings(),
        symbols: symbols.read(),
        systemBiomes: new BiomeCatalogStore(database).resolve(
          economyFixture.installation.expectedSystemBiomeIds
        )
      }))
    const readbacks = economyFixture.campaigns.map((configured) => {
      const preparationCampaign = preparation.campaigns.find(
        ({ role }) => role === configured.role
      )
      const spatialCampaign = preparation.spatial.campaigns.find(
        ({ role }) => role === configured.role
      )
      const rootCampaign = preparation.spatial.root.campaigns.find(
        ({ role }) => role === configured.role
      )
      const liveCampaign = liveFixture.campaigns.find(
        ({ role }) => role === configured.role
      )
      if (
        !preparationCampaign ||
        !spatialCampaign ||
        !rootCampaign ||
        !liveCampaign
      )
        throw new Error(
          `Current-format economy Campaign ${configured.role} has no upstream readback.`
        )
      const value = campaigns.visitCampaignDatabase(
        preparationCampaign.campaignId,
        (database) => {
          const access = fixedSqliteDatabaseAccess(database)
          const locationOwner = new WorldLocationService(
            access,
            (id) =>
              installation.symbols.symbols.find((symbol) => symbol.id === id) ??
              null,
            campaigns.installationPersistenceAccess()
          )
          const locations = locationOwner.read()
          const symbolLocation = locations.locations.find(
            ({ displayName }) =>
              displayName === configured.materialization.symbolLocationName
          )
          if (!symbolLocation)
            throw new Error(
              `Current-format economy Campaign ${configured.role} symbol Location is absent.`
            )
          const definitions = new ItemDefinitionResolver(database, () => {
            throw new Error(
              'Economy fixture readback does not use catalog definitions.'
            )
          })
          const legacyDefinition = definitions.resolve(
            configured.materialization.legacyDefinition.reference
          )
          const loot = new LootService(access)
          const sceneProjection = loot.sceneProjection(spatialCampaign.sceneId)
          const inbox = loot.inbox({ cursor: null, limit: 100 })
          const manualTreasure = sceneProjection.locationTreasures.find(
            ({ label }) =>
              label === configured.materialization.manualTreasureLabel
          )
          const acceptedTreasure = inbox.entries.find(
            ({ treasure }) =>
              treasure.label ===
              configured.materialization.generatedTreasureLabel
          )?.treasure
          const recipient = rootCampaign.party.members.find(
            ({ active }) => active
          )
          if (!manualTreasure || !acceptedTreasure || !recipient)
            throw new Error(
              `Current-format economy Campaign ${configured.role} economy projection is incomplete.`
            )
          const ledger = loot.ledger(recipient.id)
          const projection = semanticEconomyProjection(
            configured,
            liveCampaign,
            rootCampaign,
            spatialCampaign,
            preparationCampaign.semanticSha256,
            {
              settings: installation.settings,
              symbols: installation.symbols,
              systemBiomes: installation.systemBiomes,
              locations,
              symbolLocation,
              legacyDefinition,
              manualTreasure,
              acceptedTreasure,
              ledger,
              sceneProjection,
              inbox
            }
          )
          return Object.freeze({
            role: configured.role,
            campaignId: preparationCampaign.campaignId,
            locations,
            symbolLocation,
            legacyDefinition,
            manualTreasure,
            acceptedTreasure,
            ledger,
            sceneProjection,
            inbox,
            semanticProjection: projection,
            semanticSha256: semanticHash(projection)
          })
        }
      )
      if (!value)
        throw new Error(
          `Current-format economy Campaign ${configured.role} database is unavailable.`
        )
      return value
    })
    assert.deepStrictEqual(
      campaigns.list(),
      registry,
      'Independent economy readback must not mutate Campaign registry state.'
    )
    return Object.freeze({
      fixtureIdentity: economyFixture.identity,
      qualificationClaim: economyFixture.qualificationClaim,
      preparation,
      installation,
      campaigns: Object.freeze(readbacks)
    })
  } finally {
    campaigns.close()
  }
}

function economyProjectionExtensions(
  dataRoot: string,
  rootFixture: CurrentFormatRootFixture,
  economyFixture: CurrentFormatEconomyFixture
): Readonly<{
  downstreamLocationChoiceIds: ReadonlyMap<'A' | 'B', ReadonlySet<string>>
  downstreamPlacedTreasureIds: ReadonlyMap<'A' | 'B', ReadonlySet<string>>
}> {
  const campaigns = new CampaignStore(dataRoot)
  try {
    const symbols = new LocationSymbolService(
      campaigns.installationPersistenceAccess()
    )
    const rows = economyFixture.campaigns.map((configured) => {
      const root = rootFixture.campaigns.find(
        ({ role }) => role === configured.role
      )
      assert.ok(root)
      const registered = campaigns
        .list()
        .campaigns.find(({ name }) => name === root.bundle.campaign.name)
      assert.ok(
        registered,
        `Current-format economy Campaign ${configured.role} is not registered.`
      )
      const locations = campaigns.visitCampaignDatabase(
        registered.id,
        (database) =>
          new WorldLocationService(
            fixedSqliteDatabaseAccess(database),
            (id) =>
              symbols.read().symbols.find((symbol) => symbol.id === id) ?? null,
            campaigns.installationPersistenceAccess()
          ).read()
      )
      assert.ok(locations)
      const matches = locations.locations.filter(
        ({ displayName }) =>
          displayName === configured.materialization.symbolLocationName
      )
      assert.equal(
        matches.length,
        1,
        `Current-format economy Campaign ${configured.role} symbol Location is not singular.`
      )
      const inbox = campaigns.visitCampaignDatabase(registered.id, (database) =>
        new LootService(fixedSqliteDatabaseAccess(database)).inbox({
          cursor: null,
          limit: 100
        })
      )
      assert.ok(inbox)
      const placedTreasures = inbox.entries.filter(
        ({ treasure }) =>
          treasure.label === configured.materialization.generatedTreasureLabel
      )
      assert.equal(
        placedTreasures.length,
        1,
        `Current-format economy Campaign ${configured.role} accepted generated Treasure is not singular.`
      )
      return Object.freeze({
        role: configured.role,
        locationChoiceId: matches[0]!.id,
        placedTreasureId: placedTreasures[0]!.treasure.id
      })
    })
    return Object.freeze({
      downstreamLocationChoiceIds: new Map(
        rows.map(({ role, locationChoiceId }) => [
          role,
          new Set([locationChoiceId])
        ])
      ),
      downstreamPlacedTreasureIds: new Map(
        rows.map(({ role, placedTreasureId }) => [
          role,
          new Set([placedTreasureId])
        ])
      )
    })
  } finally {
    campaigns.close()
  }
}

export function assertCurrentFormatEconomyReadback(
  rootFixture: CurrentFormatRootFixture,
  spatialFixture: CurrentFormatSpatialFixture,
  preparationFixture: CurrentFormatPreparationFixture,
  economyFixture: CurrentFormatEconomyFixture,
  readback: CurrentFormatEconomyReadback
): void {
  assertEconomyPreparationPreservation(
    rootFixture,
    spatialFixture,
    preparationFixture,
    economyFixture,
    readback
  )
  assert.equal(readback.fixtureIdentity, economyFixture.identity)
  assert.equal(readback.qualificationClaim, economyFixture.qualificationClaim)
  assert.deepStrictEqual(
    readback.installation.settings.preferences.sessionLayout,
    economyFixture.installation.sessionLayout
  )
  assert.equal(
    readback.installation.settings.revision,
    economyFixture.installation.expectedSettingsRevision
  )
  assert.equal(
    readback.installation.symbols.revision,
    economyFixture.installation.expectedLocationSymbolRevision
  )
  assert.equal(readback.installation.symbols.symbols.length, 1)
  const sharedSymbol = readback.installation.symbols.symbols.find(
    ({ displayName }) =>
      displayName === economyFixture.installation.locationSymbolName
  )
  assert.ok(sharedSymbol)
  assert.deepStrictEqual(
    readback.installation.systemBiomes.map(({ id }) => id),
    economyFixture.installation.expectedSystemBiomeIds
  )

  const sharedInstallationUuids = collectUuids({
    symbol: sharedSymbol,
    biomes: readback.installation.systemBiomes,
    encounterTables:
      readback.preparation.installation.sharedEncounterTables.tables
  })
  const campaignUuids: Set<string>[] = []
  for (const expected of economyFixture.campaigns) {
    const actual = readback.campaigns.find(({ role }) => role === expected.role)
    const root = readback.preparation.spatial.root.campaigns.find(
      ({ role }) => role === expected.role
    )
    assert.ok(actual)
    assert.ok(root)
    assertCampaign(expected, actual, root, sharedSymbol.id)
    const uuids = collectUuids({
      locations: actual.locations,
      manualTreasure: actual.manualTreasure,
      acceptedTreasure: actual.acceptedTreasure,
      ledger: actual.ledger,
      sceneProjection: actual.sceneProjection,
      inbox: actual.inbox
    })
    for (const id of sharedInstallationUuids) uuids.delete(id)
    campaignUuids.push(uuids)
  }
  for (const id of campaignUuids[0] ?? [])
    assert.ok(
      !(campaignUuids[1]?.has(id) ?? false),
      `Economy identity ${id} leaked across Campaign A/B.`
    )
}

export function assertCurrentFormatEconomyReceipt(
  receipt: CurrentFormatEconomyMaterializationReceipt,
  readback: CurrentFormatEconomyReadback
): void {
  assert.equal(receipt.fixtureIdentity, readback.fixtureIdentity)
  assert.equal(receipt.qualificationClaim, readback.qualificationClaim)
  assert.equal(
    receipt.settingsRevision,
    readback.installation.settings.revision
  )
  const symbol = readback.installation.symbols.symbols.find(
    ({ id }) => id === receipt.sharedLocationSymbolId
  )
  assert.ok(symbol)
  for (const expected of receipt.campaigns) {
    const actual = readback.campaigns.find(({ role }) => role === expected.role)
    assert.ok(actual)
    assert.equal(actual.campaignId, expected.campaignId)
    assert.equal(actual.symbolLocation.id, expected.symbolLocationId)
    assert.equal(actual.manualTreasure.id, expected.manualTreasureId)
    assert.equal(actual.acceptedTreasure.id, expected.acceptedTreasureId)
    assert.equal(actual.ledger.characterId, expected.recipientId)
    assert.equal(actual.ledger.entries[0]?.id, expected.ledgerEntryId)
    assert.deepStrictEqual(actual.acceptedTreasure.source, {
      kind: 'generated',
      runId: expected.runId,
      generatedTreasureId: expected.sourceGeneratedTreasureId
    })
  }
}

function assertCampaign(
  expected: CurrentFormatEconomyCampaign,
  actual: CurrentFormatEconomyCampaignReadback,
  root: CurrentFormatRootCampaignReadback,
  sharedSymbolId: string
): void {
  assert.equal(actual.locations.revision, expected.expected.locationRevision)
  assert.deepStrictEqual(actual.symbolLocation.mapPresentation, {
    revision: expected.expected.mapPresentationRevision,
    titleOverride: expected.materialization.symbolLocationName,
    symbolId: sharedSymbolId,
    symbolSize: 52,
    labelCurve: expected.role === 'A' ? 8 : -8,
    labelPosition: 'above'
  })
  assert.deepStrictEqual(actual.symbolLocation.factionIds, [])
  assert.deepStrictEqual(actual.symbolLocation.encounterTableIds, [])
  assert.deepStrictEqual(
    actual.legacyDefinition,
    expected.materialization.legacyDefinition
  )
  assert.equal(
    actual.sceneProjection.revision,
    expected.expected.lootProjectionRevision
  )
  assert.equal(actual.inbox.revision, expected.expected.lootProjectionRevision)
  assert.equal(
    actual.sceneProjection.locationTreasures.length,
    expected.expected.sceneLocationTreasureCount
  )
  assert.equal(actual.inbox.entries.length, expected.expected.inboxEntryCount)
  assert.equal(actual.inbox.entries[0]?.reason, 'unplaced')
  assert.equal(actual.manualTreasure.source.kind, 'manual')
  assert.equal(
    actual.manualTreasure.revision,
    expected.expected.manualTreasureRevision
  )
  assert.equal(
    actual.manualTreasure.distributionState,
    expected.expected.manualDistributionState
  )
  assert.equal(
    actual.manualTreasure.totalValueCp,
    expected.expected.manualTotalValueCp
  )
  assert.equal(
    actual.manualTreasure.allocatedValueCp,
    expected.expected.manualAllocatedValueCp
  )
  assert.equal(actual.manualTreasure.items.length, 1)
  assert.equal(actual.manualTreasure.containers.length, 1)
  assert.equal(actual.manualTreasure.items[0]?.quantity, 2)
  assert.equal(actual.manualTreasure.items[0]?.allocatedQuantity, 1)
  assert.equal(
    actual.manualTreasure.containers[0]?.id,
    expected.materialization.manualContainerId
  )
  const targetLocationId = root.mappings.find(
    ({ kind, externalKey }) =>
      kind === 'locations' &&
      externalKey === expected.materialization.targetLocationExternalKey
  )?.internalId
  assert.equal(
    actual.manualTreasure.anchor.kind === 'location'
      ? actual.manualTreasure.anchor.locationId
      : null,
    targetLocationId
  )
  assert.equal(actual.acceptedTreasure.source.kind, 'generated')
  assert.deepStrictEqual(actual.acceptedTreasure.anchor, { kind: 'unplaced' })
  assert.ok(actual.acceptedTreasure.items.length > 0)
  assert.equal(actual.ledger.revision, expected.expected.ledgerRevision)
  assert.equal(actual.ledger.entries.length, expected.expected.ledgerEntryCount)
  assert.equal(actual.ledger.entries[0]?.treasureId, actual.manualTreasure.id)
  assert.equal(
    actual.ledger.entries[0]?.treasureItemId,
    actual.manualTreasure.items[0]?.id
  )
  assert.equal(
    actual.ledger.entries[0]?.quantity,
    expected.materialization.distributionQuantity
  )
  assert.deepStrictEqual(
    actual.ledger.entries[0]?.itemReference,
    expected.materialization.legacyDefinition.reference
  )
  assert.equal(
    actual.semanticSha256,
    expected.expected.semanticSha256,
    `Campaign ${expected.role} complete semantic economy hash drifted; actual ${actual.semanticSha256}.`
  )
}

function assertEconomyPreparationPreservation(
  rootFixture: CurrentFormatRootFixture,
  spatialFixture: CurrentFormatSpatialFixture,
  preparationFixture: CurrentFormatPreparationFixture,
  economyFixture: CurrentFormatEconomyFixture,
  readback: CurrentFormatEconomyReadback
): void {
  const symbolLocationIds = new Map(
    readback.campaigns.map((campaign) => [
      campaign.role,
      campaign.symbolLocation.id
    ])
  )
  const sanitizeLocations = (
    role: 'A' | 'B',
    snapshot: WorldLocationSnapshot
  ): WorldLocationSnapshot => {
    const preparation = preparationFixture.campaigns.find(
      (campaign) => campaign.role === role
    )
    const economy = economyFixture.campaigns.find(
      (campaign) => campaign.role === role
    )
    assert.ok(preparation)
    assert.ok(economy)
    assert.equal(snapshot.revision, economy.expected.locationRevision)
    const symbolLocationId = symbolLocationIds.get(role)
    assert.ok(symbolLocationId)
    assert.equal(
      snapshot.locations.filter(({ id }) => id === symbolLocationId).length,
      1
    )
    return {
      revision: preparation.expected.locationRevision,
      locations: snapshot.locations.filter(({ id }) => id !== symbolLocationId)
    }
  }
  const sanitized: CurrentFormatPreparationReadback = {
    ...readback.preparation,
    spatial: {
      ...readback.preparation.spatial,
      root: {
        ...readback.preparation.spatial.root,
        campaigns: readback.preparation.spatial.root.campaigns.map(
          (campaign) => ({
            ...campaign,
            locations: sanitizeLocations(campaign.role, campaign.locations)
          })
        )
      }
    },
    campaigns: readback.preparation.campaigns.map((campaign) => ({
      ...campaign,
      locations: sanitizeLocations(campaign.role, campaign.locations)
    }))
  }
  assertCurrentFormatPreparationReadback(
    rootFixture,
    spatialFixture,
    preparationFixture,
    sanitized
  )
}

function semanticEconomyProjection(
  configured: CurrentFormatEconomyCampaign,
  liveFixture: CurrentFormatLiveFixture['campaigns'][number],
  root: CurrentFormatRootCampaignReadback,
  spatial: CurrentFormatSpatialCampaignReadback,
  preparationSemanticSha256: string,
  economy: Readonly<{
    settings: Settings
    symbols: Symbols
    systemBiomes: SystemBiomes
    locations: WorldLocationSnapshot
    symbolLocation: WorldLocationSnapshot['locations'][number]
    legacyDefinition: LegacyDefinition
    manualTreasure: Treasure
    acceptedTreasure: Treasure
    ledger: Ledger
    sceneProjection: SceneProjection
    inbox: Inbox
  }>
): unknown {
  const sharedSymbol = economy.symbols.symbols[0]
  if (!sharedSymbol)
    throw new Error(`Campaign ${configured.role} shared symbol is absent.`)
  const additions = new Map<string, string>([
    [spatial.campaignId, 'campaign:current'],
    [sharedSymbol.id, 'location-symbol:shared'],
    [
      economy.symbolLocation.id,
      configured.materialization.symbolLocationSemanticKey
    ],
    [economy.manualTreasure.id, 'treasure:manual'],
    [economy.acceptedTreasure.id, 'treasure:accepted-generated'],
    [economy.ledger.characterId, 'party-member:recipient'],
    [configured.materialization.manualContainerId, 'treasure-container:manual'],
    [
      configured.materialization.commandIds.createManualTreasure,
      'command:treasure-create'
    ],
    [
      configured.materialization.commandIds.acceptGeneratedTreasure,
      'command:treasure-accept-generated'
    ],
    [
      configured.materialization.commandIds.distributeManualTreasure,
      'command:treasure-distribute'
    ]
  ])
  if (economy.acceptedTreasure.source.kind === 'generated') {
    additions.set(
      economy.acceptedTreasure.source.runId,
      'generation-run:session'
    )
    additions.set(
      economy.acceptedTreasure.source.generatedTreasureId,
      'generated-treasure:accepted-source'
    )
  }
  economy.manualTreasure.items.forEach(({ id }, index) =>
    additions.set(id, `treasure-item:manual:${index + 1}`)
  )
  economy.manualTreasure.containers.forEach(({ id }, index) =>
    additions.set(id, `treasure-container:manual:${index + 1}`)
  )
  economy.acceptedTreasure.items.forEach(({ id, itemReference }, index) => {
    additions.set(id, `treasure-item:accepted:${index + 1}`)
    if (
      itemReference.kind === 'generated' &&
      /^[0-9a-f-]{36}$/i.test(itemReference.definitionId)
    )
      additions.set(
        itemReference.definitionId,
        `item-definition:accepted:${index + 1}`
      )
  })
  economy.acceptedTreasure.containers.forEach(({ id }, index) =>
    additions.set(id, `treasure-container:accepted:${index + 1}`)
  )
  economy.ledger.entries.forEach(({ id }, index) =>
    additions.set(id, `ledger-entry:${index + 1}`)
  )
  for (const biome of economy.systemBiomes)
    biome.encounterTableIds.forEach((id, index) =>
      additions.set(id, `biome-table:${biome.id}:${index + 1}`)
    )
  const identities = currentFormatLiveSemanticIdentities(
    liveFixture,
    root,
    spatial.session,
    additions
  )
  const projection = replaceSemanticIdentities(
    normalizeTimestamps({
      upstream: { preparationSemanticSha256 },
      installation: {
        settings: economy.settings,
        sharedSymbol,
        systemBiomes: economy.systemBiomes
      },
      symbolLocation: economy.symbolLocation,
      legacyDefinition: economy.legacyDefinition,
      manualTreasure: economy.manualTreasure,
      acceptedTreasure: economy.acceptedTreasure,
      ledger: economy.ledger,
      sceneProjection: economy.sceneProjection,
      inbox: economy.inbox
    }),
    identities
  )
  assertNoRawUuid(projection, `Campaign ${configured.role} economy`)
  return projection
}

function normalizeTimestamps(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalizeTimestamps)
  if (!value || typeof value !== 'object')
    return typeof value === 'string' && !Number.isNaN(Date.parse(value))
      ? '<timestamp>'
      : value
  return Object.fromEntries(
    Object.entries(value).map(([key, child]) => [
      key,
      normalizeTimestamps(child)
    ])
  )
}
