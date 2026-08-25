import assert from 'node:assert/strict'
import { join } from 'node:path'
import type Database from 'better-sqlite3'
import { z } from 'zod'
import { CampaignRulesService } from '../../src/core/application/campaign-rules-service.js'
import { GeneratedEncounterPlanService } from '../../src/core/encounter/generated-plan-service.js'
import { EncounterTableStore } from '../../src/core/encounter/encounter-table-store.js'
import { PartyStore } from '../../src/core/party/party-store.js'
import { CampaignStore } from '../../src/core/persistence/sqlite/campaign-store.js'
import { fixedSqliteDatabaseAccess } from '../../src/core/persistence/sqlite/database-access.js'
import { GeneratorPresetStore } from '../../src/core/persistence/sqlite/generator-preset-store.js'
import { defaultGeneratorConfig } from '../../src/shared/generator/system-generator-preset.js'
import { BundledEncounterCatalogProvider } from '../../src/utility/session-generation/catalog-provider.js'
import { SessionGenerationService } from '../../src/utility/session-generation/session-generation-service.js'
import { sha256EncounterEntropy } from '../../src/utility/session-generation/sha256-entropy.js'
import { SessionPlannerService } from '../../src/utility/session-planner/session-planner-service.js'
import { WorldLocationService } from '../../src/core/worldplanner/location-store.js'
import type { CurrentFormatLiveFixture } from './current-format-live-fixture.js'
import type {
  CurrentFormatPreparationCampaign,
  CurrentFormatPreparationFixture
} from './current-format-preparation-fixture.js'
import type { CurrentFormatRootFixture } from './current-format-root-fixture.js'
import type { CurrentFormatSpatialFixture } from './current-format-spatial-fixture.js'
import { materializeCurrentFormatSpatialFixture } from './current-format-spatial-materializer.js'

const campaignReceiptSchema = z
  .object({
    role: z.enum(['A', 'B']),
    campaignId: z.uuid(),
    presetId: z.uuid(),
    sessionId: z.uuid(),
    runId: z.uuid(),
    encounterPlanIds: z.array(z.uuid()).min(1),
    campaignEncounterTableId: z.uuid(),
    linkedLocationId: z.uuid(),
    operationId: z.uuid()
  })
  .strict()

const materializationReceiptSchema = z
  .object({
    fixtureIdentity: z.literal(
      'frontend-robustness-current-format-preparation-v1'
    ),
    qualificationClaim: z.literal(
      'partial-fr2f2c1-preparation-cohort-not-complete-current-format'
    ),
    sharedEncounterTableId: z.uuid(),
    campaigns: z.array(campaignReceiptSchema).length(2),
    activeCampaignRole: z.literal('A')
  })
  .strict()

export type CurrentFormatPreparationMaterializationReceipt = Readonly<
  z.infer<typeof materializationReceiptSchema>
>

export function materializeCurrentFormatPreparationFixture(
  dataRoot: string,
  rootFixture: CurrentFormatRootFixture,
  liveFixture: CurrentFormatLiveFixture,
  spatialFixture: CurrentFormatSpatialFixture,
  preparationFixture: CurrentFormatPreparationFixture
): CurrentFormatPreparationMaterializationReceipt {
  const spatialReceipt = materializeCurrentFormatSpatialFixture(
    dataRoot,
    rootFixture,
    liveFixture,
    spatialFixture
  )
  const campaignIds = new Map(
    spatialReceipt.campaigns.map((campaign) => [
      campaign.role,
      campaign.campaignId
    ])
  )
  const campaigns = new CampaignStore(dataRoot)
  try {
    const before = campaigns.list()
    const presets = campaigns
      .installationPersistenceAccess()
      .use((database) => new GeneratorPresetStore(database))
    const presetIds = new Map<'A' | 'B', string>()
    for (const configured of preparationFixture.campaigns) {
      const command = configured.materialization.commandIds.createPreset
      const created = presets.create({
        commandId: command,
        expectedRegistryRevision: presets.registry().revision,
        name: configured.materialization.presetName,
        config: defaultGeneratorConfig
      })
      presetIds.set(configured.role, created.saved.id)
    }
    for (const configured of preparationFixture.campaigns) {
      const campaignId = campaignIds.get(configured.role)
      const presetId = presetIds.get(configured.role)
      if (!campaignId || !presetId)
        throw new Error(
          `Current-format preparation Campaign ${configured.role} is missing its upstream identity.`
        )
      presets.assign({
        commandId: configured.materialization.commandIds.assignPreset,
        campaignId,
        presetId,
        expectedRegistryRevision: presets.registry().revision
      })
    }
    assert.equal(
      presets.registry().revision,
      preparationFixture.installation.expectedPresetRegistryRevision
    )

    const sharedEncounterTableId = campaigns
      .installationPersistenceAccess()
      .use((database) => {
        const tables = new EncounterTableStore(database, 'installation')
        const receipt = tables.create(
          preparationFixture.installation.sharedEncounterTableCommandId,
          {
            displayName:
              preparationFixture.installation.sharedEncounterTableName,
            description: 'FR2F2C1 shared installation dependency.',
            entries: [
              {
                creatureId:
                  preparationFixture.installation.sharedEncounterCreatureId,
                weight: 2
              }
            ]
          },
          tables.read().revision
        )
        assert.equal(
          receipt.snapshot.revision,
          preparationFixture.installation.expectedEncounterTableRevision
        )
        return receipt.saved.id
      })

    const receipts = preparationFixture.campaigns.map((configured) => {
      const campaignId = campaignIds.get(configured.role)
      const presetId = presetIds.get(configured.role)
      if (!campaignId || !presetId)
        throw new Error(
          `Current-format preparation Campaign ${configured.role} is missing its preset.`
        )
      const root = rootFixture.campaigns.find(
        ({ role }) => role === configured.role
      )
      if (!root)
        throw new Error(
          `Current-format preparation Campaign ${configured.role} has no root source.`
        )
      const receipt = campaigns.visitCampaignDatabase(campaignId, (database) =>
        materializeCampaign(
          campaigns,
          presets,
          database,
          campaignId,
          presetId,
          sharedEncounterTableId,
          root.bundle.source.id,
          configured
        )
      )
      if (!receipt)
        throw new Error(
          `Current-format preparation Campaign ${configured.role} database is unavailable.`
        )
      return receipt
    })
    assert.deepStrictEqual(
      campaigns.list(),
      before,
      'Current-format preparation materialization changed Campaign switch authority.'
    )
    return materializationReceiptSchema.parse({
      fixtureIdentity: preparationFixture.identity,
      qualificationClaim: preparationFixture.qualificationClaim,
      sharedEncounterTableId,
      campaigns: receipts,
      activeCampaignRole: 'A'
    })
  } finally {
    campaigns.close()
  }
}

function materializeCampaign(
  campaigns: CampaignStore,
  presets: GeneratorPresetStore,
  database: Database.Database,
  campaignId: string,
  presetId: string,
  sharedEncounterTableId: string,
  sourceId: string,
  configured: CurrentFormatPreparationCampaign
) {
  const access = fixedSqliteDatabaseAccess(database)
  const linkedLocationId = campaigns
    .campaignImportRepository()
    .entityMappings(database, sourceId)
    .find(
      ({ kind, externalKey }) =>
        kind === 'locations' &&
        externalKey === configured.materialization.referencedLocationExternalKey
    )?.internalId
  if (!linkedLocationId)
    throw new Error(
      `Current-format preparation Campaign ${configured.role} has no mapped shared-table Location.`
    )
  const locations = new WorldLocationService(
    access,
    () => null,
    campaigns.installationPersistenceAccess()
  )
  const locationSnapshot = locations.read()
  const linkedLocation = locationSnapshot.locations.find(
    ({ id }) => id === linkedLocationId
  )
  if (!linkedLocation)
    throw new Error(
      `Current-format preparation Campaign ${configured.role} shared-table Location is unavailable.`
    )
  const linked = locations.update(
    linkedLocationId,
    {
      displayName: linkedLocation.displayName,
      tags: linkedLocation.tags,
      readAloud: linkedLocation.readAloud,
      notes: linkedLocation.notes,
      factionIds: linkedLocation.factionIds,
      encounterTableIds: [sharedEncounterTableId]
    },
    locationSnapshot.revision
  )
  assert.equal(linked.snapshot.revision, configured.expected.locationRevision)
  assert.deepStrictEqual(linked.saved.encounterTableIds, [
    sharedEncounterTableId
  ])
  const rules = new CampaignRulesService(
    access,
    () =>
      new Date(`2026-08-${configured.role === 'A' ? '10' : '11'}T10:00:00.000Z`)
  )
  const updatedRules = rules.update({
    commandId: configured.materialization.commandIds.updateRules,
    expectedRevision: rules.read().revision,
    rewardXpBasis: configured.materialization.rewardXpBasis
  })
  assert.equal(updatedRules.revision, configured.expected.rulesRevision)

  const encounterTables = new EncounterTableStore(database)
  const encounterTable = encounterTables.create(
    configured.materialization.commandIds.createCampaignEncounterTable,
    {
      displayName: configured.materialization.campaignEncounterTableName,
      description: `FR2F2C1 Campaign ${configured.role} preparation table.`,
      entries: [
        {
          creatureId: configured.materialization.encounterCreatureId,
          weight: 3
        }
      ]
    },
    encounterTables.read().revision
  )
  assert.equal(
    encounterTable.snapshot.revision,
    configured.expected.campaignEncounterTableRevision
  )

  const generation = new SessionGenerationService(
    new BundledEncounterCatalogProvider(
      join(process.cwd(), 'resources/sessiongeneration/catalog-2026-07-16')
    ),
    sha256EncounterEntropy,
    () => presets.configFor(campaignId),
    access,
    () =>
      new Date(`2026-08-${configured.role === 'A' ? '10' : '11'}T11:00:00.000Z`)
  )
  const plans = new GeneratedEncounterPlanService(access)
  const planner = new SessionPlannerService(
    access,
    generation,
    plans,
    () => undefined,
    () => undefined
  )
  const initial = planner.read()
  const participantIds = new PartyStore(database)
    .read()
    .members.filter(({ active }) => active)
    .map(({ id }) => id)
  assert.ok(participantIds.length > 0)
  const authored = planner.save({
    sessionId: initial.session.id,
    expectedRevision: initial.session.revision,
    participantIds,
    adventureDayFraction: configured.materialization.adventureDayFraction,
    encounterCount: configured.materialization.encounterCount,
    selectedSceneId: null,
    scenes: []
  })
  const operationId = configured.materialization.commandIds.preparationOperation
  const accepted = planner.startPreparation({
    operationId,
    sessionId: authored.session.id,
    expectedRevision: authored.session.revision,
    seed: configured.materialization.seed,
    confirmedReplacement: false
  })
  assert.equal(accepted.status, 'accepted')
  planner.runPreparationWorker(operationId)
  const preparation = planner.preparationReceipt({ operationId }).receipt
  assert.ok(preparation)
  assert.equal(preparation.status, configured.expected.preparationStatus)
  assert.ok(preparation.runId)
  const workspace = planner.read()
  assert.equal(workspace.session.revision, configured.expected.plannerRevision)
  const encounterPlanIds = workspace.session.scenes.flatMap((scene) =>
    scene.encounterPlanId ? [scene.encounterPlanId] : []
  )
  assert.equal(encounterPlanIds.length, configured.expected.encounterPlanCount)

  return campaignReceiptSchema.parse({
    role: configured.role,
    campaignId,
    presetId,
    sessionId: workspace.session.id,
    runId: preparation.runId,
    encounterPlanIds,
    campaignEncounterTableId: encounterTable.saved.id,
    linkedLocationId,
    operationId
  })
}
