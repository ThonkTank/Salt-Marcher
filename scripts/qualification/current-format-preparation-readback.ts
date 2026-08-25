import assert from 'node:assert/strict'
import { join } from 'node:path'
import { CampaignRulesService } from '../../src/core/application/campaign-rules-service.js'
import { GeneratedEncounterPlanService } from '../../src/core/encounter/generated-plan-service.js'
import { EncounterTableStore } from '../../src/core/encounter/encounter-table-store.js'
import { CampaignStore } from '../../src/core/persistence/sqlite/campaign-store.js'
import { fixedSqliteDatabaseAccess } from '../../src/core/persistence/sqlite/database-access.js'
import { GeneratorPresetStore } from '../../src/core/persistence/sqlite/generator-preset-store.js'
import { systemGeneratorPresetId } from '../../src/shared/contracts/generator-presets.js'
import { BundledEncounterCatalogProvider } from '../../src/utility/session-generation/catalog-provider.js'
import { SessionGenerationService } from '../../src/utility/session-generation/session-generation-service.js'
import { sha256EncounterEntropy } from '../../src/utility/session-generation/sha256-entropy.js'
import { SessionPlannerService } from '../../src/utility/session-planner/session-planner-service.js'
import { WorldLocationService } from '../../src/core/worldplanner/location-store.js'
import type { WorldLocationSnapshot } from '../../src/shared/contracts/world-location.js'
import type { CurrentFormatLiveFixture } from './current-format-live-fixture.js'
import { currentFormatLiveSemanticIdentities } from './current-format-live-readback.js'
import type {
  CurrentFormatPreparationCampaign,
  CurrentFormatPreparationFixture
} from './current-format-preparation-fixture.js'
import type { CurrentFormatPreparationMaterializationReceipt } from './current-format-preparation-materializer.js'
import type { CurrentFormatRootFixture } from './current-format-root-fixture.js'
import type { CurrentFormatRootCampaignReadback } from './current-format-root-readback.js'
import type { CurrentFormatSpatialFixture } from './current-format-spatial-fixture.js'
import {
  assertCurrentFormatSpatialReadback,
  readCurrentFormatSpatialFixture,
  type CurrentFormatSpatialReadback
} from './current-format-spatial-readback.js'
import {
  assertNoRawUuid,
  collectUuids,
  replaceSemanticIdentities,
  semanticHash
} from './qualification-semantic-oracle.js'

type PresetEditor = ReturnType<GeneratorPresetStore['readEditor']>
type PresetReceipt = ReturnType<GeneratorPresetStore['commandReceipt']>
type TableSnapshot = ReturnType<EncounterTableStore['read']>
type TableReceipt = ReturnType<EncounterTableStore['commandReceipt']>
type Rules = ReturnType<CampaignRulesService['read']>
type Workspace = ReturnType<SessionPlannerService['read']>
type PreparationReceipt = NonNullable<
  ReturnType<SessionPlannerService['preparationReceipt']>['receipt']
>
type GeneratedRun = ReturnType<SessionGenerationService['readRun']>
type PlanSummaries = ReturnType<GeneratedEncounterPlanService['summaries']>

export type CurrentFormatPreparationCampaignReadback = Readonly<{
  role: 'A' | 'B'
  campaignId: string
  preset: PresetEditor
  presetCreateReceipt: PresetReceipt
  presetAssignReceipt: PresetReceipt
  rules: Rules
  rulesReceipt: Rules | null
  encounterTables: TableSnapshot
  encounterTableReceipt: TableReceipt
  locations: WorldLocationSnapshot
  workspace: Workspace
  preparation: PreparationReceipt
  generatedRun: GeneratedRun
  encounterPlans: PlanSummaries
  semanticProjection: unknown
  semanticSha256: string
}>

export type CurrentFormatPreparationReadback = Readonly<{
  fixtureIdentity: string
  qualificationClaim: string
  spatial: CurrentFormatSpatialReadback
  installation: Readonly<{
    presetRegistryRevision: number
    sharedEncounterTables: TableSnapshot
    sharedEncounterTableReceipt: TableReceipt
  }>
  campaigns: readonly CurrentFormatPreparationCampaignReadback[]
}>

export function readCurrentFormatPreparationFixture(
  dataRoot: string,
  rootFixture: CurrentFormatRootFixture,
  liveFixture: CurrentFormatLiveFixture,
  spatialFixture: CurrentFormatSpatialFixture,
  preparationFixture: CurrentFormatPreparationFixture
): CurrentFormatPreparationReadback {
  const spatial = readCurrentFormatSpatialFixture(
    dataRoot,
    rootFixture,
    liveFixture,
    spatialFixture
  )
  const campaigns = new CampaignStore(dataRoot)
  try {
    const registry = campaigns.list()
    const presets = campaigns
      .installationPersistenceAccess()
      .use((database) => new GeneratorPresetStore(database))
    const installation = campaigns
      .installationPersistenceAccess()
      .use((database) => {
        const tables = new EncounterTableStore(database, 'installation')
        return Object.freeze({
          presetRegistryRevision: presets.registry().revision,
          sharedEncounterTables: tables.read(),
          sharedEncounterTableReceipt: tables.commandReceipt(
            preparationFixture.installation.sharedEncounterTableCommandId
          )
        })
      })
    const readbacks = preparationFixture.campaigns.map((configured) => {
      const spatialCampaign = spatial.campaigns.find(
        ({ role }) => role === configured.role
      )
      const liveCampaign = liveFixture.campaigns.find(
        ({ role }) => role === configured.role
      )
      const rootCampaign = spatial.root.campaigns.find(
        ({ role }) => role === configured.role
      )
      if (!spatialCampaign || !liveCampaign || !rootCampaign)
        throw new Error(
          `Current-format preparation Campaign ${configured.role} has no upstream readback.`
        )
      const value = campaigns.visitCampaignDatabase(
        spatialCampaign.campaignId,
        (database) => {
          const access = fixedSqliteDatabaseAccess(database)
          const rulesOwner = new CampaignRulesService(access)
          const locationOwner = new WorldLocationService(
            access,
            () => null,
            campaigns.installationPersistenceAccess()
          )
          const tableOwner = new EncounterTableStore(database)
          const generation = new SessionGenerationService(
            new BundledEncounterCatalogProvider(
              join(
                process.cwd(),
                'resources/sessiongeneration/catalog-2026-07-16'
              )
            ),
            sha256EncounterEntropy,
            () => presets.configFor(spatialCampaign.campaignId),
            access
          )
          const plans = new GeneratedEncounterPlanService(access)
          const planner = new SessionPlannerService(
            access,
            generation,
            plans,
            () => undefined,
            () => undefined
          )
          const preset = presets.readEditor(spatialCampaign.campaignId)
          const workspace = planner.read()
          const preparation = planner.preparationReceipt({
            operationId:
              configured.materialization.commandIds.preparationOperation
          }).receipt
          if (!preparation?.runId)
            throw new Error(
              `Current-format preparation Campaign ${configured.role} has no completed preparation run.`
            )
          const generatedRun = generation.readRun(preparation.runId)
          const planIds = workspace.session.scenes.flatMap((scene) =>
            scene.encounterPlanId ? [scene.encounterPlanId] : []
          )
          const encounterPlans = plans.summaries({ planIds })
          const projection = semanticPreparationProjection(
            configured,
            liveCampaign,
            rootCampaign,
            spatialCampaign,
            workspace,
            {
              preset,
              presetCreateReceipt: presets.commandReceipt(
                configured.materialization.commandIds.createPreset
              ),
              presetAssignReceipt: presets.commandReceipt(
                configured.materialization.commandIds.assignPreset
              ),
              rules: rulesOwner.read(),
              rulesReceipt: rulesOwner.commandReceipt(
                configured.materialization.commandIds.updateRules
              ),
              encounterTables: tableOwner.read(),
              encounterTableReceipt: tableOwner.commandReceipt(
                configured.materialization.commandIds
                  .createCampaignEncounterTable
              ),
              locations: locationOwner.read(),
              sharedEncounterTables: installation.sharedEncounterTables,
              sharedEncounterTableReceipt:
                installation.sharedEncounterTableReceipt,
              workspace,
              preparation,
              generatedRun,
              encounterPlans
            }
          )
          return Object.freeze({
            role: configured.role,
            campaignId: spatialCampaign.campaignId,
            preset,
            presetCreateReceipt: presets.commandReceipt(
              configured.materialization.commandIds.createPreset
            ),
            presetAssignReceipt: presets.commandReceipt(
              configured.materialization.commandIds.assignPreset
            ),
            rules: rulesOwner.read(),
            rulesReceipt: rulesOwner.commandReceipt(
              configured.materialization.commandIds.updateRules
            ),
            encounterTables: tableOwner.read(),
            encounterTableReceipt: tableOwner.commandReceipt(
              configured.materialization.commandIds.createCampaignEncounterTable
            ),
            locations: locationOwner.read(),
            workspace,
            preparation,
            generatedRun,
            encounterPlans,
            semanticProjection: projection,
            semanticSha256: semanticHash(projection)
          })
        }
      )
      if (!value)
        throw new Error(
          `Current-format preparation Campaign ${configured.role} database is unavailable.`
        )
      return value
    })
    assert.deepStrictEqual(
      campaigns.list(),
      registry,
      'Independent preparation readback must not mutate Campaign registry state.'
    )
    return Object.freeze({
      fixtureIdentity: preparationFixture.identity,
      qualificationClaim: preparationFixture.qualificationClaim,
      spatial,
      installation,
      campaigns: Object.freeze(readbacks)
    })
  } finally {
    campaigns.close()
  }
}

export function assertCurrentFormatPreparationReadback(
  rootFixture: CurrentFormatRootFixture,
  spatialFixture: CurrentFormatSpatialFixture,
  preparationFixture: CurrentFormatPreparationFixture,
  readback: CurrentFormatPreparationReadback
): void {
  assertPreparationSpatialPreservation(
    rootFixture,
    spatialFixture,
    preparationFixture,
    readback
  )
  assert.equal(readback.fixtureIdentity, preparationFixture.identity)
  assert.equal(
    readback.qualificationClaim,
    preparationFixture.qualificationClaim
  )
  assert.equal(
    readback.installation.presetRegistryRevision,
    preparationFixture.installation.expectedPresetRegistryRevision
  )
  assert.equal(
    readback.installation.sharedEncounterTables.revision,
    preparationFixture.installation.expectedEncounterTableRevision
  )
  assert.equal(
    readback.installation.sharedEncounterTables.tables.filter(
      ({ displayName }) =>
        displayName === preparationFixture.installation.sharedEncounterTableName
    ).length,
    1
  )
  assert.ok(readback.installation.sharedEncounterTableReceipt)
  const sharedEncounterTableId = requireSavedTableReceipt(
    readback.installation.sharedEncounterTableReceipt,
    'installation'
  ).saved.id
  const campaignUuids: Set<string>[] = []
  for (const expected of preparationFixture.campaigns) {
    const actual = readback.campaigns.find(({ role }) => role === expected.role)
    const root = readback.spatial.root.campaigns.find(
      ({ role }) => role === expected.role
    )
    assert.ok(actual)
    assert.ok(root)
    assertCampaign(expected, actual, root, sharedEncounterTableId)
    const uuids = collectUuids({
      rules: actual.rules,
      tables: actual.encounterTables,
      locations: actual.locations,
      workspace: actual.workspace,
      preparation: actual.preparation,
      run: actual.generatedRun,
      plans: actual.encounterPlans
    })
    uuids.delete(sharedEncounterTableId)
    campaignUuids.push(uuids)
  }
  for (const id of campaignUuids[0] ?? [])
    assert.ok(
      !(campaignUuids[1]?.has(id) ?? false),
      `Preparation identity ${id} leaked across Campaign A/B.`
    )
}

export function assertCurrentFormatPreparationReceipt(
  receipt: CurrentFormatPreparationMaterializationReceipt,
  readback: CurrentFormatPreparationReadback
): void {
  assert.equal(receipt.fixtureIdentity, readback.fixtureIdentity)
  assert.equal(receipt.qualificationClaim, readback.qualificationClaim)
  assert.equal(
    requireSavedTableReceipt(
      readback.installation.sharedEncounterTableReceipt,
      'installation'
    ).saved.id,
    receipt.sharedEncounterTableId
  )
  for (const expected of receipt.campaigns) {
    const actual = readback.campaigns.find(({ role }) => role === expected.role)
    assert.ok(actual)
    assert.equal(actual.campaignId, expected.campaignId)
    assert.equal(actual.preset.assignment?.effectivePresetId, expected.presetId)
    assert.equal(actual.workspace.session.id, expected.sessionId)
    assert.equal(actual.preparation.runId, expected.runId)
    assert.deepStrictEqual(
      actual.workspace.session.scenes.flatMap((scene) =>
        scene.encounterPlanId ? [scene.encounterPlanId] : []
      ),
      expected.encounterPlanIds
    )
    assert.equal(
      requireSavedTableReceipt(actual.encounterTableReceipt, expected.role)
        .saved.id,
      expected.campaignEncounterTableId
    )
    assert.equal(actual.preparation.operationId, expected.operationId)
    const linked = actual.locations.locations.find(
      ({ id }) => id === expected.linkedLocationId
    )
    assert.ok(linked)
    assert.deepStrictEqual(linked.encounterTableIds, [
      receipt.sharedEncounterTableId
    ])
  }
}

function assertCampaign(
  expected: CurrentFormatPreparationCampaign,
  actual: CurrentFormatPreparationCampaignReadback,
  root: CurrentFormatRootCampaignReadback,
  sharedEncounterTableId: string
): void {
  assert.equal(actual.rules.revision, expected.expected.rulesRevision)
  assert.equal(
    actual.rules.rewardXpBasis,
    expected.materialization.rewardXpBasis
  )
  assert.deepStrictEqual(actual.rulesReceipt, actual.rules)
  assert.equal(actual.locations.revision, expected.expected.locationRevision)
  assert.ok(actual.presetCreateReceipt)
  assert.ok(actual.presetAssignReceipt)
  assert.equal(
    actual.preset.registry.presets.find(
      ({ name }) => name === expected.materialization.presetName
    )?.id,
    actual.preset.assignment?.effectivePresetId
  )
  assert.equal(
    actual.encounterTables.revision,
    expected.expected.campaignEncounterTableRevision
  )
  assert.equal(
    actual.encounterTables.tables.filter(
      ({ displayName }) =>
        displayName === expected.materialization.campaignEncounterTableName
    ).length,
    1
  )
  assert.ok(actual.encounterTableReceipt)
  assert.deepStrictEqual(
    linkedLocation(actual.locations, root, expected).encounterTableIds,
    [sharedEncounterTableId]
  )
  assert.equal(
    actual.workspace.session.revision,
    expected.expected.plannerRevision
  )
  assert.equal(actual.preparation.status, expected.expected.preparationStatus)
  assert.equal(actual.generatedRun.runKind, expected.expected.generatedRunKind)
  assert.match(actual.generatedRun.originFingerprint, /^[0-9a-f]{64}$/)
  assert.match(
    actual.preparation.encounterBatchFingerprint ?? '',
    /^[0-9a-f]{64}$/
  )
  const planIds = actual.workspace.session.scenes.flatMap((scene) =>
    scene.encounterPlanId ? [scene.encounterPlanId] : []
  )
  assert.equal(planIds.length, expected.expected.encounterPlanCount)
  assert.equal(
    actual.workspace.session.scenes.flatMap((scene) => scene.generatedRewards)
      .length,
    expected.expected.generatedRewardCount
  )
  assert.equal(
    actual.semanticSha256,
    expected.expected.semanticSha256,
    `Campaign ${expected.role} complete semantic preparation hash drifted; actual ${actual.semanticSha256}.`
  )
}

function semanticPreparationProjection(
  configured: CurrentFormatPreparationCampaign,
  liveFixture: CurrentFormatLiveFixture['campaigns'][number],
  root: CurrentFormatRootCampaignReadback,
  spatial: CurrentFormatSpatialReadback['campaigns'][number],
  workspace: Workspace,
  preparation: Readonly<{
    preset: PresetEditor
    presetCreateReceipt: PresetReceipt
    presetAssignReceipt: PresetReceipt
    rules: Rules
    rulesReceipt: Rules | null
    encounterTables: TableSnapshot
    encounterTableReceipt: TableReceipt
    locations: WorldLocationSnapshot
    sharedEncounterTables: TableSnapshot
    sharedEncounterTableReceipt: TableReceipt
    workspace: Workspace
    preparation: PreparationReceipt
    generatedRun: GeneratedRun
    encounterPlans: PlanSummaries
  }>
): unknown {
  const presetId = preparation.preset.assignment?.effectivePresetId
  if (!presetId)
    throw new Error(`Campaign ${configured.role} preset is absent.`)
  const campaignEncounterTableId = requireSavedTableReceipt(
    preparation.encounterTableReceipt,
    configured.role
  ).saved.id
  const sharedEncounterTableId = requireSavedTableReceipt(
    preparation.sharedEncounterTableReceipt,
    'installation'
  ).saved.id
  const additions = new Map<string, string>([
    [spatial.campaignId, 'campaign:current'],
    [systemGeneratorPresetId, 'generator-preset:system'],
    [presetId, configured.materialization.presetSemanticKey],
    [workspace.session.id, 'planner-session:current'],
    [preparation.preparation.operationId, 'preparation:operation'],
    [preparation.preparation.runId!, 'generation-run:session'],
    [campaignEncounterTableId, 'encounter-table:campaign'],
    [sharedEncounterTableId, 'encounter-table:installation-shared'],
    [
      configured.materialization.commandIds.createPreset,
      'command:preset-create'
    ],
    [
      configured.materialization.commandIds.assignPreset,
      'command:preset-assign'
    ],
    [configured.materialization.commandIds.updateRules, 'command:rules-update'],
    [
      configured.materialization.commandIds.createCampaignEncounterTable,
      'command:campaign-table-create'
    ]
  ])
  for (const [index, scene] of workspace.session.scenes.entries()) {
    additions.set(scene.id, `planner-scene:${index + 1}`)
    if (scene.encounterPlanId)
      additions.set(scene.encounterPlanId, `encounter-plan:${index + 1}`)
    for (const [rewardIndex, reward] of scene.generatedRewards.entries())
      if (/^[0-9a-f-]{36}$/i.test(reward.generatedTreasureId))
        additions.set(
          reward.generatedTreasureId,
          `generated-treasure:${index + 1}:${rewardIndex + 1}`
        )
  }
  const identities = currentFormatLiveSemanticIdentities(
    liveFixture,
    root,
    spatial.session,
    additions
  )
  const projection = replaceSemanticIdentities(
    normalizeTimestamps({
      preset: {
        assignment: preparation.preset.assignment,
        effective: preparation.preset.registry.presets.find(
          ({ id }) => id === presetId
        ),
        createReceipt: projectPresetReceipt(preparation.presetCreateReceipt),
        assignReceipt: projectPresetReceipt(preparation.presetAssignReceipt)
      },
      rules: preparation.rules,
      rulesReceipt: preparation.rulesReceipt,
      encounterTables: preparation.encounterTables,
      encounterTableReceipt: preparation.encounterTableReceipt,
      linkedLocation: linkedLocation(preparation.locations, root, configured),
      sharedEncounterTable: preparation.sharedEncounterTables.tables.find(
        ({ id }) => id === sharedEncounterTableId
      ),
      sharedEncounterTableReceipt: projectTableReceipt(
        preparation.sharedEncounterTableReceipt
      ),
      workspace: preparation.workspace,
      preparation: {
        ...preparation.preparation,
        encounterBatchFingerprint: '<identity-bound-batch-fingerprint>'
      },
      generatedRun: {
        ...preparation.generatedRun,
        originFingerprint: '<identity-bound-origin-fingerprint>'
      },
      encounterPlans: preparation.encounterPlans
    }),
    identities
  )
  assertNoRawUuid(projection, `Campaign ${configured.role} preparation`)
  return projection
}

function linkedLocation(
  locations: WorldLocationSnapshot,
  root: Pick<CurrentFormatRootCampaignReadback, 'mappings'>,
  configured: CurrentFormatPreparationCampaign
) {
  const externalKey = configured.materialization.referencedLocationExternalKey
  const id = root.mappings.find(
    (mapping) =>
      mapping.kind === 'locations' && mapping.externalKey === externalKey
  )?.internalId
  const location = locations.locations.find((candidate) => candidate.id === id)
  if (!location)
    throw new Error(`Linked preparation Location ${externalKey} is absent.`)
  return location
}

function assertPreparationSpatialPreservation(
  rootFixture: CurrentFormatRootFixture,
  spatialFixture: CurrentFormatSpatialFixture,
  preparationFixture: CurrentFormatPreparationFixture,
  readback: CurrentFormatPreparationReadback
): void {
  const sharedEncounterTableId = requireSavedTableReceipt(
    readback.installation.sharedEncounterTableReceipt,
    'installation'
  ).saved.id
  const sanitizedCampaigns = readback.spatial.root.campaigns.map((campaign) => {
    const configured = preparationFixture.campaigns.find(
      ({ role }) => role === campaign.role
    )
    assert.ok(configured)
    const target = linkedLocation(campaign.locations, campaign, configured)
    assert.deepStrictEqual(
      target.encounterTableIds,
      [sharedEncounterTableId],
      `Campaign ${campaign.role} must reference exactly the shared installation Encounter Table.`
    )
    return {
      ...campaign,
      locations: {
        ...campaign.locations,
        locations: campaign.locations.locations.map((location) =>
          location.id === target.id
            ? { ...location, encounterTableIds: [] }
            : location
        )
      }
    }
  })
  assertCurrentFormatSpatialReadback(rootFixture, spatialFixture, {
    ...readback.spatial,
    root: {
      ...readback.spatial.root,
      campaigns: sanitizedCampaigns
    }
  })
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

function projectPresetReceipt(receipt: PresetReceipt): unknown {
  if (!receipt) return null
  if (receipt.kind === 'created')
    return {
      kind: receipt.kind,
      commandId: receipt.commandId,
      saved: receipt.saved
    }
  if (receipt.kind === 'assigned')
    return {
      kind: receipt.kind,
      commandId: receipt.commandId,
      assignment: receipt.assignment,
      effectivePreset: receipt.effectivePreset
    }
  return { kind: receipt.kind, commandId: receipt.commandId }
}

function projectTableReceipt(receipt: TableReceipt): unknown {
  if (!receipt) return null
  return 'saved' in receipt
    ? { saved: receipt.saved }
    : { deletedId: receipt.deletedId }
}

function requireSavedTableReceipt(
  receipt: TableReceipt,
  label: string
): Extract<NonNullable<TableReceipt>, { saved: unknown }> {
  if (!receipt || !('saved' in receipt))
    throw new Error(`${label} Encounter Table save receipt is absent.`)
  return receipt
}
