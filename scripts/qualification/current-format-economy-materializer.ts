import assert from 'node:assert/strict'
import type Database from 'better-sqlite3'
import { z } from 'zod'
import { LootService } from '../../src/core/application/loot-service.js'
import { ItemDefinitionResolver } from '../../src/core/loot/item-definition-resolver.js'
import { PartyStore } from '../../src/core/party/party-store.js'
import { CampaignStore } from '../../src/core/persistence/sqlite/campaign-store.js'
import { fixedSqliteDatabaseAccess } from '../../src/core/persistence/sqlite/database-access.js'
import { GeneratedRunStore } from '../../src/core/session-generation/generated-run-store.js'
import { parseLocationSymbolSource } from '../../src/core/worldplanner/location-symbol-import.js'
import { LocationSymbolService } from '../../src/core/worldplanner/location-symbol-store.js'
import { WorldLocationService } from '../../src/core/worldplanner/location-store.js'
import type { CurrentFormatLiveFixture } from './current-format-live-fixture.js'
import type {
  CurrentFormatEconomyCampaign,
  CurrentFormatEconomyFixture
} from './current-format-economy-fixture.js'
import { materializeCurrentFormatPreparationFixture } from './current-format-preparation-materializer.js'
import type { CurrentFormatPreparationFixture } from './current-format-preparation-fixture.js'
import type { CurrentFormatRootFixture } from './current-format-root-fixture.js'
import type { CurrentFormatSpatialFixture } from './current-format-spatial-fixture.js'

const campaignReceiptSchema = z
  .object({
    role: z.enum(['A', 'B']),
    campaignId: z.uuid(),
    runId: z.uuid(),
    sourceGeneratedTreasureId: z.string().min(1),
    symbolLocationId: z.uuid(),
    manualTreasureId: z.uuid(),
    acceptedTreasureId: z.uuid(),
    recipientId: z.uuid(),
    ledgerEntryId: z.uuid()
  })
  .strict()

const materializationReceiptSchema = z
  .object({
    fixtureIdentity: z.literal('frontend-robustness-current-format-economy-v1'),
    qualificationClaim: z.literal(
      'partial-fr2f2c2a-economy-installation-cohort-not-complete-current-format'
    ),
    sharedLocationSymbolId: z.uuid(),
    settingsRevision: z.literal(1),
    campaigns: z.array(campaignReceiptSchema).length(2),
    activeCampaignRole: z.literal('A')
  })
  .strict()

export type CurrentFormatEconomyMaterializationReceipt = Readonly<
  z.infer<typeof materializationReceiptSchema>
>

export function materializeCurrentFormatEconomyFixture(
  dataRoot: string,
  rootFixture: CurrentFormatRootFixture,
  liveFixture: CurrentFormatLiveFixture,
  spatialFixture: CurrentFormatSpatialFixture,
  preparationFixture: CurrentFormatPreparationFixture,
  economyFixture: CurrentFormatEconomyFixture
): CurrentFormatEconomyMaterializationReceipt {
  const preparationReceipt = materializeCurrentFormatPreparationFixture(
    dataRoot,
    rootFixture,
    liveFixture,
    spatialFixture,
    preparationFixture
  )
  const preparationCampaigns = new Map(
    preparationReceipt.campaigns.map((campaign) => [campaign.role, campaign])
  )
  const campaigns = new CampaignStore(dataRoot)
  try {
    const registryBefore = campaigns.list()
    const symbols = new LocationSymbolService(
      campaigns.installationPersistenceAccess()
    )
    const symbol = symbols.create(
      parseLocationSymbolSource(
        economyFixture.installation.locationSymbolSource,
        economyFixture.installation.locationSymbolName
      ),
      symbols.read().revision
    )
    assert.equal(
      symbol.snapshot.revision,
      economyFixture.installation.expectedLocationSymbolRevision
    )
    const settings = campaigns.updateSettings(
      { sessionLayout: economyFixture.installation.sessionLayout },
      campaigns.readSettings().revision
    )
    assert.equal(
      settings.revision,
      economyFixture.installation.expectedSettingsRevision
    )

    const receipts = economyFixture.campaigns.map((configured) => {
      const preparation = preparationCampaigns.get(configured.role)
      const root = rootFixture.campaigns.find(
        ({ role }) => role === configured.role
      )
      if (!preparation || !root)
        throw new Error(
          `Current-format economy Campaign ${configured.role} has no preparation/root identity.`
        )
      const receipt = campaigns.visitCampaignDatabase(
        preparation.campaignId,
        (database) =>
          materializeCampaign(
            campaigns,
            symbols,
            database,
            preparation.campaignId,
            preparation.runId,
            root.bundle.source.id,
            symbol.saved.id,
            configured
          )
      )
      if (!receipt)
        throw new Error(
          `Current-format economy Campaign ${configured.role} database is unavailable.`
        )
      return receipt
    })
    assert.deepStrictEqual(
      campaigns.list(),
      registryBefore,
      'Current-format economy materialization changed Campaign switch authority.'
    )
    return materializationReceiptSchema.parse({
      fixtureIdentity: economyFixture.identity,
      qualificationClaim: economyFixture.qualificationClaim,
      sharedLocationSymbolId: symbol.saved.id,
      settingsRevision: settings.revision,
      campaigns: receipts,
      activeCampaignRole: 'A'
    })
  } finally {
    campaigns.close()
  }
}

function materializeCampaign(
  campaigns: CampaignStore,
  symbols: LocationSymbolService,
  database: Database.Database,
  campaignId: string,
  runId: string,
  sourceId: string,
  sharedLocationSymbolId: string,
  configured: CurrentFormatEconomyCampaign
) {
  const targetLocationId = campaigns
    .campaignImportRepository()
    .entityMappings(database, sourceId)
    .find(
      ({ kind, externalKey }) =>
        kind === 'locations' &&
        externalKey === configured.materialization.targetLocationExternalKey
    )?.internalId
  if (!targetLocationId)
    throw new Error(
      `Current-format economy Campaign ${configured.role} target Location is unavailable.`
    )
  const access = fixedSqliteDatabaseAccess(database)
  const locations = new WorldLocationService(
    access,
    (id) => symbols.read().symbols.find((symbol) => symbol.id === id) ?? null,
    campaigns.installationPersistenceAccess()
  )
  const initialLocations = locations.read()
  const targetLocation = initialLocations.locations.find(
    ({ id }) => id === targetLocationId
  )
  if (!targetLocation)
    throw new Error(
      `Current-format economy Campaign ${configured.role} target Location readback is unavailable.`
    )
  const createdLocation = locations.create(
    {
      displayName: configured.materialization.symbolLocationName,
      tags: configured.materialization.symbolLocationTags,
      readAloud: '',
      notes: 'FR2F2C2A shared installation symbol sentinel.',
      factionIds: [],
      encounterTableIds: []
    },
    initialLocations.revision
  )
  assert.equal(
    createdLocation.snapshot.revision,
    configured.expected.locationRevision
  )
  const presentation = locations.updateMapPresentation(
    createdLocation.saved.id,
    {
      titleOverride: configured.materialization.symbolLocationName,
      symbolId: sharedLocationSymbolId,
      symbolSize: 52,
      labelCurve: configured.role === 'A' ? 8 : -8,
      labelPosition: 'above'
    },
    createdLocation.saved.mapPresentation.revision
  )
  assert.equal(
    presentation.revision,
    configured.expected.mapPresentationRevision
  )

  const definitions = new ItemDefinitionResolver(database, () => {
    throw new Error('Economy fixture does not use catalog item definitions.')
  })
  definitions.saveLegacy(configured.materialization.legacyDefinition)
  const loot = new LootService(
    access,
    () =>
      new Date(`2026-08-${configured.role === 'A' ? '12' : '13'}T12:00:00.000Z`)
  )
  const manual = loot.create({
    commandId: configured.materialization.commandIds.createManualTreasure,
    label: configured.materialization.manualTreasureLabel,
    anchor: {
      kind: 'location',
      locationId: targetLocationId,
      lastKnownLabel: targetLocation.displayName
    },
    containers: [
      {
        id: configured.materialization.manualContainerId,
        catalogContainerId: null,
        name: configured.materialization.manualContainerName,
        capacity: configured.materialization.manualContainerCapacity
      }
    ],
    items: [
      {
        itemReference: configured.materialization.legacyDefinition.reference,
        quantity: configured.materialization.manualItemQuantity,
        containerId: configured.materialization.manualContainerId
      }
    ]
  })
  const run = new GeneratedRunStore(database).read(runId)
  const generated = run?.treasures[0]
  if (!run || !generated)
    throw new Error(
      `Current-format economy Campaign ${configured.role} has no generated Treasure source.`
    )
  const accepted = loot.acceptGenerated({
    commandId: configured.materialization.commandIds.acceptGeneratedTreasure,
    runId,
    generatedTreasureId: generated.id,
    label: configured.materialization.generatedTreasureLabel,
    anchor: { kind: 'unplaced' }
  })
  const party = new PartyStore(database).read()
  const recipient = party.members.find(({ active }) => active)
  if (!recipient)
    throw new Error(
      `Current-format economy Campaign ${configured.role} has no active recipient.`
    )
  const distribution = loot.distribute({
    commandId: configured.materialization.commandIds.distributeManualTreasure,
    treasureId: manual.id,
    expectedTreasureRevision: manual.revision,
    expectedPartyRevision: party.revision,
    items: [
      {
        itemId: manual.items[0]!.id,
        shares: [
          {
            characterId: recipient.id,
            quantity: configured.materialization.distributionQuantity
          }
        ]
      }
    ]
  })
  assert.equal(
    distribution.treasure.revision,
    configured.expected.manualTreasureRevision
  )
  assert.equal(
    distribution.treasure.distributionState,
    configured.expected.manualDistributionState
  )
  assert.equal(
    loot.inbox({ cursor: null, limit: 100 }).revision,
    configured.expected.lootProjectionRevision
  )
  const ledger = loot.ledger(recipient.id)
  assert.equal(ledger.revision, configured.expected.ledgerRevision)
  assert.equal(ledger.entries.length, configured.expected.ledgerEntryCount)

  return campaignReceiptSchema.parse({
    role: configured.role,
    campaignId,
    runId,
    sourceGeneratedTreasureId: generated.id,
    symbolLocationId: createdLocation.saved.id,
    manualTreasureId: distribution.treasure.id,
    acceptedTreasureId: accepted.id,
    recipientId: recipient.id,
    ledgerEntryId: ledger.entries[0]!.id
  })
}
