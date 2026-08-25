import assert from 'node:assert/strict'
import type Database from 'better-sqlite3'
import { z } from 'zod'
import { WorldLocationPlacementService } from '../../src/core/application/world-location-placement.js'
import { WorldLocationSaveCommandHandler } from '../../src/core/application/world-location-save.js'
import { HexMapStore } from '../../src/core/hex/hex-map-store.js'
import { CampaignStore } from '../../src/core/persistence/sqlite/campaign-store.js'
import { fixedSqliteDatabaseAccess } from '../../src/core/persistence/sqlite/database-access.js'
import {
  WorldLocationService,
  WorldLocationStore
} from '../../src/core/worldplanner/location-store.js'
import { LocationSymbolService } from '../../src/core/worldplanner/location-symbol-store.js'
import { WorldLocationSaveJournal } from '../../src/core/worldplanner/world-location-save-journal.js'
import type { SaveWorldLocationInput } from '../../src/shared/contracts/world-location.js'
import type {
  CurrentFormatCompletionCampaign,
  CurrentFormatCompletionFixture
} from './current-format-completion-fixture.js'
import type { CurrentFormatEconomyFixture } from './current-format-economy-fixture.js'
import { materializeCurrentFormatEconomyFixture } from './current-format-economy-materializer.js'
import type { CurrentFormatLiveFixture } from './current-format-live-fixture.js'
import type { CurrentFormatPreparationFixture } from './current-format-preparation-fixture.js'
import type { CurrentFormatRootFixture } from './current-format-root-fixture.js'
import type {
  CurrentFormatSpatialCampaign,
  CurrentFormatSpatialFixture
} from './current-format-spatial-fixture.js'
import { createCurrentFormatSpatialEditingOwner } from './current-format-spatial-owner.js'

const interruptedCampaignSchema = z
  .object({
    role: z.enum(['A', 'B']),
    campaignId: z.uuid(),
    mapId: z.uuid(),
    commandId: z.uuid(),
    locationId: z.uuid(),
    locationRevision: z.number().int().positive(),
    mapContentRevision: z.number().int().positive(),
    provisionalStatus: z.literal('partially-saved'),
    provisionalFailureDetail: z.literal('placement_pending')
  })
  .strict()

const interruptedReceiptSchema = z
  .object({
    fixtureIdentity: z.literal(
      'frontend-robustness-current-format-completion-v1'
    ),
    qualificationClaim: z.literal(
      'complete-fr2f2c-current-format-owner-coverage-not-rp-r-or-rp-l'
    ),
    campaigns: z.array(interruptedCampaignSchema).length(2),
    activeCampaignRole: z.literal('A')
  })
  .strict()

const reconciledCampaignSchema = interruptedCampaignSchema
  .omit({ provisionalStatus: true, provisionalFailureDetail: true })
  .extend({
    finalStatus: z.literal('saved'),
    placement: z.literal('applied'),
    idempotentReplay: z.literal(true)
  })
  .strict()

const reconciledReceiptSchema = z
  .object({
    fixtureIdentity: z.literal(
      'frontend-robustness-current-format-completion-v1'
    ),
    qualificationClaim: z.literal(
      'complete-fr2f2c-current-format-owner-coverage-not-rp-r-or-rp-l'
    ),
    campaigns: z.array(reconciledCampaignSchema).length(2),
    activeCampaignRole: z.literal('A')
  })
  .strict()

export type CurrentFormatCompletionInterruptedReceipt = Readonly<
  z.infer<typeof interruptedReceiptSchema>
>
export type CurrentFormatCompletionReconciledReceipt = Readonly<
  z.infer<typeof reconciledReceiptSchema>
>

export function interruptCurrentFormatCompletionFixture(
  dataRoot: string,
  rootFixture: CurrentFormatRootFixture,
  liveFixture: CurrentFormatLiveFixture,
  spatialFixture: CurrentFormatSpatialFixture,
  preparationFixture: CurrentFormatPreparationFixture,
  economyFixture: CurrentFormatEconomyFixture,
  completionFixture: CurrentFormatCompletionFixture
): CurrentFormatCompletionInterruptedReceipt {
  const economy = materializeCurrentFormatEconomyFixture(
    dataRoot,
    rootFixture,
    liveFixture,
    spatialFixture,
    preparationFixture,
    economyFixture
  )
  const economyCampaigns = new Map(
    economy.campaigns.map((campaign) => [campaign.role, campaign])
  )
  const campaigns = new CampaignStore(dataRoot)
  try {
    const registry = campaigns.list()
    const receipts = completionFixture.campaigns.map((configured) => {
      const economyCampaign = economyCampaigns.get(configured.role)
      const spatial = spatialFixture.campaigns.find(
        ({ role }) => role === configured.role
      )
      if (!economyCampaign || !spatial)
        throw new Error(
          `Current-format completion Campaign ${configured.role} has no economy/spatial identity.`
        )
      const receipt = campaigns.visitCampaignDatabase(
        economyCampaign.campaignId,
        (database) =>
          interruptCampaign(
            campaigns,
            database,
            economyCampaign.campaignId,
            configured,
            spatial
          )
      )
      assert.ok(receipt)
      return receipt
    })
    assert.deepStrictEqual(
      campaigns.list(),
      registry,
      'Completion interruption changed Campaign switch authority.'
    )
    return interruptedReceiptSchema.parse({
      fixtureIdentity: completionFixture.identity,
      qualificationClaim: completionFixture.qualificationClaim,
      campaigns: receipts,
      activeCampaignRole: 'A'
    })
  } finally {
    campaigns.close()
  }
}

export function reconcileCurrentFormatCompletionFixture(
  dataRoot: string,
  rootFixture: CurrentFormatRootFixture,
  spatialFixture: CurrentFormatSpatialFixture,
  completionFixture: CurrentFormatCompletionFixture
): CurrentFormatCompletionReconciledReceipt {
  const campaigns = new CampaignStore(dataRoot)
  try {
    const registry = campaigns.list()
    const receipts = completionFixture.campaigns.map((configured) => {
      const registered = registeredCampaign(
        campaigns,
        rootFixture,
        configured.role
      )
      const spatial = spatialFixture.campaigns.find(
        ({ role }) => role === configured.role
      )
      if (!spatial)
        throw new Error(
          `Current-format completion Campaign ${configured.role} has no spatial fixture.`
        )
      const receipt = campaigns.visitCampaignDatabase(
        registered.id,
        (database) =>
          reconcileCampaign(
            campaigns,
            database,
            registered.id,
            configured,
            spatial
          )
      )
      assert.ok(receipt)
      return receipt
    })
    assert.deepStrictEqual(
      campaigns.list(),
      registry,
      'Completion reconciliation changed Campaign switch authority.'
    )
    return reconciledReceiptSchema.parse({
      fixtureIdentity: completionFixture.identity,
      qualificationClaim: completionFixture.qualificationClaim,
      campaigns: receipts,
      activeCampaignRole: 'A'
    })
  } finally {
    campaigns.close()
  }
}

function interruptCampaign(
  campaigns: CampaignStore,
  database: Database.Database,
  campaignId: string,
  configured: CurrentFormatCompletionCampaign,
  spatial: CurrentFormatSpatialCampaign
) {
  const map = requireMap(database, spatial)
  const input = currentFormatCompletionCommand(configured, map.id)
  const locations = locationOwner(campaigns, database)
  const handler = new WorldLocationSaveCommandHandler(() => ({
    locations,
    journal: new WorldLocationSaveJournal(database),
    placement: {
      execute: () => {
        throw new Error('controlled FR2F2C2B placement interruption')
      }
    }
  }))
  assert.throws(
    () => handler.execute(input),
    /controlled FR2F2C2B placement interruption/
  )
  const provisional = handler.receipt(input.commandId)
  assert.ok(provisional)
  assert.equal(provisional.status, 'partially-saved')
  if (provisional.status !== 'partially-saved')
    throw new Error('Completion interruption did not retain a partial receipt.')
  assert.deepStrictEqual(provisional.placementFailure, {
    kind: 'unavailable',
    detail: 'placement_pending'
  })
  assert.equal(
    provisional.snapshot.revision,
    configured.expected.locationRevision
  )
  assert.equal(
    new HexMapStore(database, new WorldLocationStore(database)).locateLocation(
      provisional.saved.id
    ),
    null
  )
  return interruptedCampaignSchema.parse({
    role: configured.role,
    campaignId,
    mapId: map.id,
    commandId: input.commandId,
    locationId: provisional.saved.id,
    locationRevision: provisional.snapshot.revision,
    mapContentRevision: map.contentRevision,
    provisionalStatus: provisional.status,
    provisionalFailureDetail: provisional.placementFailure.detail
  })
}

function reconcileCampaign(
  campaigns: CampaignStore,
  database: Database.Database,
  campaignId: string,
  configured: CurrentFormatCompletionCampaign,
  spatial: CurrentFormatSpatialCampaign
) {
  const map = requireMap(database, spatial)
  assert.equal(map.contentRevision, spatial.expected.mapContentRevision)
  const input = currentFormatCompletionCommand(configured, map.id)
  const locations = locationOwner(campaigns, database)
  const placement = new WorldLocationPlacementService(() => ({
    maps: new HexMapStore(database, new WorldLocationStore(database)),
    hexEditing: createCurrentFormatSpatialEditingOwner(database, () => 0)
  }))
  const handler = new WorldLocationSaveCommandHandler(() => ({
    locations,
    journal: new WorldLocationSaveJournal(database),
    placement
  }))
  const provisional = handler.receipt(input.commandId)
  assert.ok(provisional)
  assert.equal(provisional.status, 'partially-saved')
  assert.equal(
    provisional.snapshot.revision,
    configured.expected.locationRevision
  )
  assert.equal(
    provisional.snapshot.locations.filter(
      ({ displayName }) =>
        displayName === configured.materialization.locationName
    ).length,
    1
  )

  const execution = handler.execute(input)
  assert.equal(execution.receipt.status, 'saved')
  if (execution.receipt.status !== 'saved')
    throw new Error('Completion reconciliation did not finish the save.')
  assert.equal(execution.receipt.placement, 'applied')
  assert.equal(execution.receipt.saved.id, provisional.saved.id)
  assert.equal(
    execution.receipt.snapshot.revision,
    provisional.snapshot.revision
  )
  assert.equal(
    locations
      .read()
      .locations.filter(
        ({ displayName }) =>
          displayName === configured.materialization.locationName
      ).length,
    1
  )
  const placed = new HexMapStore(
    database,
    new WorldLocationStore(database)
  ).locateLocation(provisional.saved.id)
  assert.deepStrictEqual(placed, {
    mapId: map.id,
    coordinate: configured.materialization.placementCoordinate,
    contentRevision: configured.expected.mapContentRevision
  })

  const replay = handler.execute(input)
  assert.deepStrictEqual(replay, {
    receipt: execution.receipt,
    hexResult: null
  })
  assert.equal(
    requireMap(database, spatial).contentRevision,
    placed.contentRevision
  )
  return reconciledCampaignSchema.parse({
    role: configured.role,
    campaignId,
    mapId: map.id,
    commandId: input.commandId,
    locationId: provisional.saved.id,
    locationRevision: execution.receipt.snapshot.revision,
    mapContentRevision: placed.contentRevision,
    finalStatus: execution.receipt.status,
    placement: execution.receipt.placement,
    idempotentReplay: true
  })
}

export function currentFormatCompletionCommand(
  configured: CurrentFormatCompletionCampaign,
  mapId: string
): SaveWorldLocationInput {
  return {
    commandId: configured.materialization.commandId,
    locationId: null,
    location: {
      displayName: configured.materialization.locationName,
      tags: configured.materialization.locationTags,
      readAloud: '',
      notes: configured.materialization.locationNotes,
      factionIds: [],
      encounterTableIds: []
    },
    expectedRevision: configured.expected.locationRevision - 1,
    placement: {
      kind: 'place',
      target: {
        mapId,
        coordinate: configured.materialization.placementCoordinate
      }
    }
  }
}

function locationOwner(
  campaigns: CampaignStore,
  database: Database.Database
): WorldLocationService {
  const symbols = new LocationSymbolService(
    campaigns.installationPersistenceAccess()
  )
  return new WorldLocationService(
    fixedSqliteDatabaseAccess(database),
    (id) => symbols.read().symbols.find((symbol) => symbol.id === id) ?? null,
    campaigns.installationPersistenceAccess()
  )
}

function requireMap(
  database: Database.Database,
  spatial: CurrentFormatSpatialCampaign
) {
  const catalog = new HexMapStore(
    database,
    new WorldLocationStore(database)
  ).catalog()
  const maps = catalog.maps.filter(
    ({ displayName }) => displayName === spatial.materialization.mapName
  )
  assert.equal(maps.length, 1)
  return maps[0]!
}

function registeredCampaign(
  campaigns: CampaignStore,
  rootFixture: CurrentFormatRootFixture,
  role: 'A' | 'B'
) {
  const root = rootFixture.campaigns.find((campaign) => campaign.role === role)
  if (!root)
    throw new Error(
      `Current-format completion root Campaign ${role} is absent.`
    )
  const registered = campaigns
    .list()
    .campaigns.find(({ name }) => name === root.bundle.campaign.name)
  if (!registered)
    throw new Error(`Current-format completion Campaign ${role} is absent.`)
  return registered
}
