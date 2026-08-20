import { randomUUID } from 'node:crypto'
import type Database from 'better-sqlite3'
import {
  CampaignLifecycleInterruption,
  type CampaignLifecyclePhase,
  type CampaignLifecycleReceipt
} from '../application/campaign-lifecycle-coordinator.js'
import {
  campaignImportBundleSchema,
  campaignImportReportSchema,
  type CampaignImportApplyResult,
  type CampaignImportBundle,
  type CampaignImportReport,
  type CampaignImportSection
} from '../../shared/contracts/campaign-import.js'
import { CapabilityError } from '../../shared/errors/capability-error.js'
import { fingerprint } from '../fingerprint.js'
import { PartyImportAdapter } from '../party/party-import-adapter.js'
import type { CampaignStore } from '../persistence/sqlite/campaign-store.js'
import { FactionImportAdapter } from '../worldplanner/faction-import-adapter.js'
import { LocationImportAdapter } from '../worldplanner/location-import-adapter.js'
import { NpcImportAdapter } from '../worldplanner/npc-import-adapter.js'
import type { CreatureReferenceResolver } from '../worldplanner/npc-store.js'
import { CampaignImportAdapterRegistry } from './campaign-import-adapter-registry.js'
import type {
  CampaignImportAdapterContext,
  CampaignImportDomainReadback,
  CampaignImportSectionAdapter,
  CampaignImportSectionPlan,
  ImportedCampaignEntity
} from './campaign-import-section-adapter.js'
import {
  type CampaignImportSagaReceipt,
  type CampaignImportStore
} from './campaign-import-store.js'

const emptySummary = Object.freeze({
  party: 0,
  locations: 0,
  factions: 0,
  npcs: 0
})

type Conflict = CampaignImportReport['conflicts'][number]

export type CampaignImportSagaBoundary = CampaignLifecyclePhase

export interface CampaignImportServiceOptions {
  readonly adapters?: readonly CampaignImportSectionAdapter<unknown>[]
  /** Failure seam that models termination after a shared lifecycle phase. */
  readonly onLifecyclePhase?: (
    phase: CampaignImportSagaBoundary,
    receipt: CampaignLifecycleReceipt
  ) => void
}

/** Tests throw this to model process death; the live saga stays nonterminal. */
export class CampaignImportInterruption extends CampaignLifecycleInterruption {
  constructor(override readonly phase: CampaignImportSagaBoundary) {
    super(phase)
    this.name = 'CampaignImportInterruption'
  }
}

type RuntimePlan = Readonly<{
  adapter: CampaignImportSectionAdapter<unknown>
  plan: CampaignImportSectionPlan<unknown>
}>

type ImportExecutionEvidence = Readonly<{
  campaignFingerprint: string
  entities: readonly ImportedCampaignEntity[]
  readbacks: readonly CampaignImportDomainReadback[]
  sectionResults: Readonly<Record<string, unknown>>
}>

export function campaignImportExportHash(bundle: CampaignImportBundle): string {
  return fingerprint({
    ...bundle,
    source: { ...bundle.source, exportHash: '0'.repeat(64) }
  })
}

export class CampaignImportService {
  private readonly imports: CampaignImportStore
  private readonly adapters: CampaignImportAdapterRegistry
  private readonly onLifecyclePhase:
    CampaignImportServiceOptions['onLifecyclePhase'] | undefined

  constructor(
    private readonly campaigns: CampaignStore,
    private readonly creatures: CreatureReferenceResolver,
    options: CampaignImportServiceOptions = {}
  ) {
    this.imports = campaigns.campaignImportRepository()
    this.adapters = new CampaignImportAdapterRegistry(
      options.adapters ?? createDefaultCampaignImportAdapters()
    )
    this.onLifecyclePhase = options.onLifecyclePhase
    this.recoverPendingImports()
  }

  validate(value: unknown): CampaignImportReport {
    return this.report(value, false)
  }

  preview(value: unknown): CampaignImportReport {
    return this.report(value, true)
  }

  apply(value: unknown): CampaignImportApplyResult {
    const report = this.preview(value)
    if (!report.valid) throw new CapabilityError('validation_failed', false)
    const bundle = campaignImportBundleSchema.parse(value)
    const previous = this.imports.previous(bundle.source.id)
    const summary = summaryFor(bundle)
    if (report.delta === 'unchanged' && previous) {
      this.campaigns.activate(previous.campaignId)
      return resultFor('unchanged', previous.campaignId, bundle, summary)
    }

    const targetCampaignId = previous?.campaignId ?? randomUUID()
    const previousCampaignFingerprint = previous
      ? this.campaigns.visitCampaignDatabase(previous.campaignId, (database) =>
          this.imports.campaignFingerprint(database, bundle.source.id)
        )
      : null
    const plans = this.plansFor(bundle, previous?.campaignId ?? null)
    const importId = randomUUID()
    let receipt = this.imports.beginSaga({
      importId,
      bundle,
      targetCampaignId,
      previousActiveCampaignId: this.campaigns.list().activeCampaignId,
      previousCampaignFingerprint: previousCampaignFingerprint ?? null,
      sectionPlans: serializePlans(plans)
    })
    try {
      receipt = this.imports.advanceSaga(importId, 'planned', 'staging')
      const staged = this.campaigns.stageImportedCampaign(
        bundle.campaign.name,
        previous?.campaignId ?? null,
        (database) => this.executePlans(database, bundle, plans),
        targetCampaignId,
        {
          operation: { kind: 'campaign-import', importId },
          verifyPublished: (database, stagedEvidence) => {
            const published = this.inspectImportDatabase(database, receipt)
            return (
              published !== null &&
              published.campaignFingerprint ===
                stagedEvidence.campaignFingerprint &&
              published.readbacks.every(({ passed }) => passed)
            )
          },
          onPhase: (phase, lifecycleReceipt) =>
            this.onLifecyclePhase?.(phase, lifecycleReceipt)
        }
      )
      receipt = this.imports.advanceSaga(
        importId,
        'staging',
        'campaign_replaced',
        {
          replacementCampaignFingerprint: staged.evidence.campaignFingerprint,
          sectionResults: staged.evidence.sectionResults,
          directoryTransition: staged.campaignLifecycle,
          quickCheck: staged.quickCheck,
          domainReadbacks: [...staged.evidence.readbacks]
        }
      )
      receipt = this.imports.commitRegistryForSaga(importId)
      receipt = this.imports.completeSaga(importId, 'applied')
      return resultFor('applied', staged.campaignId, bundle, summary)
    } catch (error) {
      if (error instanceof CampaignImportInterruption) throw error
      const durable = this.imports.saga(importId)
      const registered = this.imports.registryMatchesSaga(importId)
      // Once the replacement is published, failing the receipt would make
      // new campaign content plus an old registry a terminal state. Keep the
      // saga resumable; startup deterministically commits the registry and
      // completes it. Earlier failures are safe to mark rolled back because
      // CampaignStore has not exposed the staged image.
      if (
        !registered &&
        durable?.phase !== 'campaign_replaced' &&
        durable?.phase !== 'registry_committed'
      )
        this.imports.failSaga(
          importId,
          error instanceof Error ? error.message : String(error)
        )
      throw error
    }
  }

  recoverPendingImports(): readonly CampaignImportSagaReceipt[] {
    const recovered: CampaignImportSagaReceipt[] = []
    for (const pending of this.imports.pendingSagas()) {
      let receipt = pending
      if (receipt.phase === 'planned')
        receipt = this.imports.advanceSaga(
          receipt.importId,
          'planned',
          'staging'
        )
      if (receipt.phase === 'staging') {
        const evidence = this.inspectPublishedImport(receipt)
        if (!evidence) {
          recovered.push(
            this.imports.failSaga(
              receipt.importId,
              'No completely verified replacement was published'
            )
          )
          continue
        }
        receipt = this.imports.advanceSaga(
          receipt.importId,
          'staging',
          'campaign_replaced',
          {
            replacementCampaignFingerprint: evidence.campaignFingerprint,
            sectionResults: evidence.sectionResults,
            directoryTransition: {
              kind: 'startup-reconciliation',
              campaignId: receipt.targetCampaignId,
              phase: 'complete'
            },
            quickCheck: 'ok',
            domainReadbacks: [...evidence.readbacks]
          }
        )
      }
      if (receipt.phase === 'campaign_replaced')
        receipt = this.imports.commitRegistryForSaga(receipt.importId)
      if (receipt.phase === 'registry_committed')
        receipt = this.imports.completeSaga(receipt.importId, 'recovered')
      recovered.push(receipt)
    }
    return recovered
  }

  private report(
    value: unknown,
    includePrevious: boolean
  ): CampaignImportReport {
    const parsed = campaignImportBundleSchema.safeParse(value)
    if (!parsed.success) {
      const conflicts: Conflict[] = parsed.error.issues
        .slice(0, 100)
        .map((issue) => ({
          code: 'invalid_bundle',
          path: issue.path.join('.'),
          sourcePath: issue.path.join('.'),
          parameters: { issue: issue.code }
        }))
      return campaignImportReportSchema.parse({
        valid: false,
        sourceId: null,
        sourceRevision: null,
        exportHash: null,
        previous: null,
        delta: 'new',
        changedSections: [],
        summary: emptySummary,
        conflicts
      })
    }
    const bundle = parsed.data
    const previous = includePrevious
      ? this.imports.previous(bundle.source.id)
      : null
    const conflicts = this.bundleConflicts(bundle)
    if (campaignImportExportHash(bundle) !== bundle.source.exportHash)
      conflicts.push(
        conflict('export_hash_mismatch', 'source.exportHash', {
          actual: campaignImportExportHash(bundle)
        })
      )
    let delta: CampaignImportReport['delta'] = previous ? 'changed' : 'new'
    if (previous) {
      if (bundle.campaign.externalKey !== previous.campaignExternalKey)
        conflicts.push(
          conflict('invalid_bundle', 'campaign.externalKey', {
            previous: previous.campaignExternalKey,
            incoming: bundle.campaign.externalKey
          })
        )
      if (bundle.source.revision < previous.revision) {
        delta = 'regressed'
        conflicts.push(
          conflict('source_revision_regressed', 'source.revision', {
            previous: previous.revision,
            incoming: bundle.source.revision
          })
        )
      } else if (
        bundle.source.revision === previous.revision &&
        bundle.source.exportHash !== previous.exportHash
      ) {
        delta = 'reused-revision'
        conflicts.push(
          conflict('source_revision_reused', 'source.revision', {
            revision: bundle.source.revision
          })
        )
      } else if (bundle.source.exportHash === previous.exportHash)
        delta = 'unchanged'
    }
    const changedSections = this.changedSections(
      bundle,
      previous?.campaignId ?? null,
      delta
    )
    conflicts.sort((left, right) =>
      `${left.path}:${left.code}`.localeCompare(`${right.path}:${right.code}`)
    )
    return campaignImportReportSchema.parse({
      valid: conflicts.length === 0,
      sourceId: bundle.source.id,
      sourceRevision: bundle.source.revision,
      exportHash: bundle.source.exportHash,
      previous: previous
        ? { revision: previous.revision, exportHash: previous.exportHash }
        : null,
      delta,
      changedSections,
      summary: summaryFor(bundle),
      conflicts
    })
  }

  private bundleConflicts(bundle: CampaignImportBundle): Conflict[] {
    const context = emptyAdapterContext(bundle, this.creatures)
    const conflicts = this.adapters.ordered().flatMap((adapter) => {
      const values = adapter.select(bundle)
      const adapterConflicts = adapter.validate(values, context)
      if (
        values.length > 0 &&
        !bundle.source.sections.includes(adapter.section)
      )
        return [
          ...adapterConflicts,
          conflict('invalid_bundle', 'source.sections', {
            missing: adapter.section
          })
        ]
      return adapterConflicts
    })
    return [...conflicts]
  }

  private changedSections(
    bundle: CampaignImportBundle,
    previousCampaignId: string | null,
    delta: CampaignImportReport['delta']
  ): CampaignImportSection[] {
    if (delta === 'unchanged') return []
    if (
      previousCampaignId === null ||
      delta === 'regressed' ||
      delta === 'reused-revision'
    )
      return [...bundle.source.sections]
    const hashes = this.campaigns.visitCampaignDatabase(
      previousCampaignId,
      (database) => this.imports.entityHashes(database, bundle.source.id)
    )
    if (!hashes) return [...bundle.source.sections]
    const context = emptyAdapterContext(bundle, this.creatures, hashes)
    const changed = new Set(
      this.adapters
        .ordered()
        .filter((adapter) => {
          const plan = adapter.diff(hashes, adapter.select(bundle), context)
          return plan.changedExternalKeys.length > 0 || plan.removed.length > 0
        })
        .map((adapter) => adapter.section)
    )
    return bundle.source.sections.filter((section) => changed.has(section))
  }

  private plansFor(
    bundle: CampaignImportBundle,
    previousCampaignId: string | null
  ): readonly RuntimePlan[] {
    const projection =
      previousCampaignId === null
        ? null
        : this.campaigns.visitCampaignDatabase(
            previousCampaignId,
            (database) => ({
              mappings: this.imports.entityMappings(database, bundle.source.id),
              hashes: this.imports.entityHashes(database, bundle.source.id)
            })
          )
    const context = emptyAdapterContext(
      bundle,
      this.creatures,
      projection?.hashes,
      projection?.mappings
    )
    return this.adapters.ordered().map((adapter) => ({
      adapter,
      plan: adapter.diff(
        context.previousHashes,
        adapter.select(bundle),
        context
      )
    }))
  }

  private executePlans(
    database: Database.Database,
    bundle: CampaignImportBundle,
    runtimePlans: readonly RuntimePlan[]
  ): ImportExecutionEvidence {
    const context = emptyAdapterContext(
      bundle,
      this.creatures,
      this.imports.entityHashes(database, bundle.source.id),
      this.imports.entityMappings(database, bundle.source.id)
    )
    const bySection = new Map(
      runtimePlans.map((runtime) => [runtime.adapter.section, runtime])
    )
    for (const adapter of this.adapters.removalOrder()) {
      const runtime = bySection.get(adapter.section)!
      adapter.apply(database, runtime.plan, { ...context, phase: 'remove' })
    }
    const entities: ImportedCampaignEntity[] = []
    const readbacks: CampaignImportDomainReadback[] = []
    const sectionResults: Record<string, unknown> = {}
    for (const adapter of this.adapters.ordered()) {
      const runtime = bySection.get(adapter.section)!
      const applied = adapter.apply(database, runtime.plan, {
        ...context,
        phase: 'upsert'
      })
      entities.push(...applied)
      const readBack = adapter.readBack(
        database,
        runtime.plan,
        context,
        applied
      )
      if (!readBack.passed)
        throw new Error(`Imported ${adapter.section} failed domain readback`)
      readbacks.push(readBack)
      sectionResults[adapter.section] = {
        changedExternalKeys: runtime.plan.changedExternalKeys,
        removedExternalKeys: runtime.plan.removed.map(
          (mapping) => mapping.externalKey
        ),
        summary: adapter.summarize(readBack),
        readBack
      }
    }
    this.imports.recordProvenance(database, bundle, entities)
    const campaignFingerprint = this.imports.campaignFingerprint(
      database,
      bundle.source.id
    )
    if (!campaignFingerprint)
      throw new Error('Imported campaign provenance failed readback')
    return { campaignFingerprint, entities, readbacks, sectionResults }
  }

  private inspectPublishedImport(
    receipt: CampaignImportSagaReceipt
  ): ImportExecutionEvidence | null {
    return this.campaigns.visitCampaignDatabase(
      receipt.targetCampaignId,
      (database) => this.inspectImportDatabase(database, receipt)
    )
  }

  private inspectImportDatabase(
    database: Database.Database,
    receipt: CampaignImportSagaReceipt
  ): ImportExecutionEvidence | null {
    if (database.pragma('quick_check', { simple: true }) !== 'ok') return null
    const provenance = this.imports.provenance(database, receipt.sourceId)
    if (
      !provenance ||
      provenance.sourceRevision !== receipt.sourceRevision ||
      provenance.exportHash !== receipt.exportHash
    )
      return null
    const mappings = this.imports.entityMappings(database, receipt.sourceId)
    const hashes = this.imports.entityHashes(database, receipt.sourceId)
    const context = emptyAdapterContext(
      receipt.bundle,
      this.creatures,
      hashes,
      mappings
    )
    const entities: ImportedCampaignEntity[] = mappings.map((mapping) => ({
      ...mapping,
      sourcePath: `${mapping.kind}.${mapping.externalKey}`,
      contentHash: hashes.get(`${mapping.kind}:${mapping.externalKey}`) ?? ''
    }))
    const readbacks: CampaignImportDomainReadback[] = []
    const sectionResults: Record<string, unknown> = {}
    for (const adapter of this.adapters.ordered()) {
      const values = adapter.select(receipt.bundle)
      const plan = adapter.diff(hashes, values, context)
      const sectionEntities = entities.filter(
        (entity) => entity.kind === adapter.section
      )
      const readBack = adapter.readBack(
        database,
        plan,
        context,
        sectionEntities
      )
      if (!readBack.passed) return null
      readbacks.push(readBack)
      sectionResults[adapter.section] = {
        changedExternalKeys: [],
        removedExternalKeys: [],
        summary: adapter.summarize(readBack),
        readBack,
        recovery: true
      }
    }
    const campaignFingerprint = this.imports.campaignFingerprint(
      database,
      receipt.sourceId
    )
    return campaignFingerprint
      ? { campaignFingerprint, entities, readbacks, sectionResults }
      : null
  }
}

export function createDefaultCampaignImportAdapters(): readonly CampaignImportSectionAdapter<unknown>[] {
  return [
    eraseAdapter(new PartyImportAdapter()),
    eraseAdapter(new LocationImportAdapter()),
    eraseAdapter(new FactionImportAdapter()),
    eraseAdapter(new NpcImportAdapter())
  ]
}

function eraseAdapter<Value>(
  adapter: CampaignImportSectionAdapter<Value>
): CampaignImportSectionAdapter<unknown> {
  return adapter as unknown as CampaignImportSectionAdapter<unknown>
}

function emptyAdapterContext(
  bundle: CampaignImportBundle,
  creatures: CreatureReferenceResolver,
  previousHashes: ReadonlyMap<string, string> = new Map(),
  previousMappings: CampaignImportAdapterContext['previousMappings'] = []
): CampaignImportAdapterContext {
  return {
    bundle,
    sourceId: bundle.source.id,
    creatures,
    previousMappings,
    previousHashes,
    resolvedIds: new Map()
  }
}

function serializePlans(
  plans: readonly RuntimePlan[]
): Readonly<Record<string, unknown>> {
  return Object.fromEntries(
    plans.map(({ adapter, plan }) => [
      adapter.section,
      {
        section: plan.section,
        incomingExternalKeys: plan.values.map(
          (value) => (value as { externalKey: string }).externalKey
        ),
        changedExternalKeys: plan.changedExternalKeys,
        removedExternalKeys: plan.removed.map((mapping) => mapping.externalKey)
      }
    ])
  )
}

function summaryFor(bundle: CampaignImportBundle) {
  return {
    party: bundle.party.length,
    locations: bundle.locations.length,
    factions: bundle.factions.length,
    npcs: bundle.npcs.length
  }
}

function resultFor(
  status: CampaignImportApplyResult['status'],
  campaignId: string,
  bundle: CampaignImportBundle,
  summary: ReturnType<typeof summaryFor>
): CampaignImportApplyResult {
  return {
    status,
    campaignId,
    sourceId: bundle.source.id,
    sourceRevision: bundle.source.revision,
    exportHash: bundle.source.exportHash,
    summary
  }
}

function conflict(
  code: Conflict['code'],
  path: string,
  parameters: Conflict['parameters']
): Conflict {
  return { code, path, sourcePath: path, parameters }
}
