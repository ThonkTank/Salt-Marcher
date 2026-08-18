import type Database from 'better-sqlite3'
import { GeneratedEncounterPlanService } from '../../core/encounter/generated-plan-service.js'
import { TreasureStore } from '../../core/loot/loot-store.js'
import { ItemDefinitionResolver } from '../../core/loot/item-definition-resolver.js'
import { dailyXp, levelXp, PartyStore } from '../../core/party/party-store.js'
import type { PartyLevelProgression } from '../../core/party/party-roster-domain.js'
import { SessionPlannerStore } from '../../core/session-planner/session-planner-store.js'
import {
  SessionPreparationStore,
  type SessionPreparationRecord
} from '../../core/session-planner/session-preparation-store.js'
import { GeneratedRunStore } from '../../core/session-generation/generated-run-store.js'
import {
  decimal,
  floor,
  multiply,
  rational,
  roundHalfUp
} from '../../core/session-generation/rational.js'
import { WorldLocationStore } from '../../core/worldplanner/location-store.js'
import { CapabilityError } from '../../shared/errors/capability-error.js'
import type { SavedEncounterPlanSummary } from '../../shared/contracts/encounter-plans.js'
import {
  cancelSessionPreparationResultSchema,
  createSessionPlanInputSchema,
  deleteSessionPlanInputSchema,
  openSessionPlanInputSchema,
  renameSessionPlanInputSchema,
  saveSessionPlanInputSchema,
  sessionPlannerWorkspaceSchema,
  sessionPreparationReceiptInputSchema,
  sessionPreparationReceiptResultSchema,
  sessionPreparationReceiptSchema,
  startSessionPreparationInputSchema,
  startSessionPreparationResultSchema,
  switchSessionPlanInputSchema,
  type SaveSessionPlanInput,
  type SessionPlannerWorkspace,
  type SessionPreparationReceipt,
  type StartSessionPreparationResult
} from '../../shared/contracts/session-planner.js'
import type {
  GeneratedRun,
  PersistedSessionGeneratedRun
} from '../../shared/contracts/session-generation.js'
import { SessionGenerationService } from '../session-generation/session-generation-service.js'
import { fingerprintExcluding } from '../../core/fingerprint.js'
import { SessionRewardBasis } from './session-reward-basis.js'
import { mapGeneratedScenes } from './session-generated-scene-mapper.js'

export class SessionPlannerService {
  private readonly scheduled = new Set<string>()

  constructor(
    private readonly activeDatabase: () => Database.Database,
    private readonly generation: SessionGenerationService,
    private readonly encounters: GeneratedEncounterPlanService,
    private readonly preparationChanged: (notice: {
      operationId: string
      status: SessionPreparationReceipt['status']
    }) => void = () => undefined,
    private readonly scheduleWork: (work: () => void) => void = (work) =>
      void setImmediate(work),
    private readonly phaseBoundary: (
      phase:
        | 'before_generation'
        | 'after_run_commit'
        | 'after_encounter_commit'
        | 'before_planner_commit'
        | 'after_planner_commit',
      operationId: string
    ) => void = () => undefined,
    private readonly definitionResolver: (
      db: Database.Database
    ) => ItemDefinitionResolver = (db) =>
      new ItemDefinitionResolver(db, () => {
        throw new Error('Catalog definition resolver is not configured')
      }),
    private readonly progression: () => PartyLevelProgression = () => levelXp
  ) {}

  read(): SessionPlannerWorkspace {
    const store = new SessionPlannerStore(this.activeDatabase())
    return this.workspace(store.currentId())
  }

  create(input: unknown): SessionPlannerWorkspace {
    const parsed = createSessionPlanInputSchema.parse(input)
    const session = new SessionPlannerStore(this.activeDatabase()).create(
      parsed.name
    )
    return this.workspace(session.id)
  }

  open(input: unknown): SessionPlannerWorkspace {
    const parsed = openSessionPlanInputSchema.parse(input)
    const session = new SessionPlannerStore(this.activeDatabase()).open(
      parsed.sessionId
    )
    return this.workspace(session.id)
  }

  switch(input: unknown): SessionPlannerWorkspace {
    const parsed = switchSessionPlanInputSchema.parse(input)
    this.validateAuthoredReferences(parsed.source)
    const session = new SessionPlannerStore(this.activeDatabase()).switch(
      parsed
    )
    return this.workspace(session.id)
  }

  rename(input: unknown): SessionPlannerWorkspace {
    const parsed = renameSessionPlanInputSchema.parse(input)
    const session = new SessionPlannerStore(this.activeDatabase()).rename(
      parsed.sessionId,
      parsed.expectedRevision,
      parsed.name
    )
    return this.workspace(session.id)
  }

  save(input: unknown): SessionPlannerWorkspace {
    const parsed = saveSessionPlanInputSchema.parse(input)
    this.validateAuthoredReferences(parsed)
    const session = new SessionPlannerStore(this.activeDatabase()).save(parsed)
    return this.workspace(session.id)
  }

  delete(input: unknown): SessionPlannerWorkspace {
    const parsed = deleteSessionPlanInputSchema.parse(input)
    const session = new SessionPlannerStore(this.activeDatabase()).delete(
      parsed.sessionId,
      parsed.expectedRevision
    )
    return this.workspace(session.id)
  }

  startPreparation(input: unknown): StartSessionPreparationResult {
    const parsed = startSessionPreparationInputSchema.parse(input)
    const db = this.activeDatabase()
    const fingerprint = preparationFingerprint(parsed)
    const journal = new SessionPreparationStore(db)
    const existing = journal.read(parsed.operationId)
    if (existing) {
      if (existing.requestFingerprint !== fingerprint)
        throw new CapabilityError('idempotency_conflict', false)
      this.schedulePreparation(existing.id)
      return startSessionPreparationResultSchema.parse({
        status: 'accepted',
        receipt: receipt(existing)
      })
    }
    const session = new SessionPlannerStore(db).require(parsed.sessionId)
    if (session.scenes.length > 0 && !parsed.confirmedReplacement)
      return startSessionPreparationResultSchema.parse({
        status: 'confirmation_required',
        operationId: parsed.operationId,
        code: 'planner_replace_existing',
        parameters: { sceneCount: session.scenes.length }
      })
    const party = this.party(db).read()
    const selected = session.participantIds.map((id) =>
      party.members.find((member) => member.id === id)
    )
    const counts = new Map<number, number>()
    for (const member of selected)
      if (member) counts.set(member.level, (counts.get(member.level) ?? 0) + 1)
    const record = journal.start({
      id: parsed.operationId,
      requestFingerprint: fingerprint,
      session,
      expectedSessionRevision: parsed.expectedRevision,
      seed: parsed.seed,
      party: [...counts.entries()]
        .toSorted(([left], [right]) => left - right)
        .map(([level, count]) => ({ level, count }))
    })
    if (session.revision !== parsed.expectedRevision)
      journal.markFailure(record.id, 'stale', {
        stage: 'validation',
        code: 'session_revision_changed',
        retryable: true,
        parameters: {
          expectedRevision: parsed.expectedRevision,
          actualRevision: session.revision
        }
      })
    else if (
      selected.length === 0 ||
      selected.some((member) => !member || member.level === null)
    )
      journal.markFailure(record.id, 'invalid', {
        stage: 'validation',
        code: 'participants_require_levels',
        retryable: false,
        parameters: { participantCount: selected.length }
      })
    const accepted = journal.read(record.id)!
    this.publish(accepted)
    this.schedulePreparation(accepted.id)
    return startSessionPreparationResultSchema.parse({
      status: 'accepted',
      receipt: receipt(accepted)
    })
  }

  preparationReceipt(input: unknown): {
    receipt: SessionPreparationReceipt | null
  } {
    const parsed = sessionPreparationReceiptInputSchema.parse(input)
    return sessionPreparationReceiptResultSchema.parse({
      receipt: nullableReceipt(
        new SessionPreparationStore(this.activeDatabase()).read(
          parsed.operationId
        )
      )
    })
  }

  cancelPreparation(input: unknown): { receipt: SessionPreparationReceipt } {
    const parsed = sessionPreparationReceiptInputSchema.parse(input)
    const journal = new SessionPreparationStore(this.activeDatabase())
    const canceled = journal.requestCancel(parsed.operationId)
    if (!canceled) throw new CapabilityError('not_found', false)
    this.publish(canceled)
    return cancelSessionPreparationResultSchema.parse({
      receipt: receipt(canceled)
    })
  }

  recoverPendingPreparations(): void {
    const journal = new SessionPreparationStore(this.activeDatabase())
    for (const operation of journal.recoverable())
      this.schedulePreparation(operation.id)
  }

  /** Internal queue worker entrypoint; exposed for deterministic integration
   * tests, not through the capability registry. */
  runPreparationWorker(operationId: string): void {
    while (this.runPreparationStage(operationId)) continue
  }

  private runPreparationStage(operationId: string): boolean {
    const db = this.activeDatabase()
    const journal = new SessionPreparationStore(db)
    let operation = journal.read(operationId)
    if (!operation || isTerminal(operation.status)) return false

    if (operation.status === 'queued') {
      if (operation.cancelRequested) {
        journal.requestCancel(operation.id)
        this.publishCurrent(journal, operation.id)
        return false
      }
      if (!journal.markGenerating(operation.id)) return false
      this.publishCurrent(journal, operation.id)
      return true
    }

    if (operation.status === 'generating') {
      if (operation.cancelRequested) {
        journal.requestCancel(operation.id)
        this.publishCurrent(journal, operation.id)
        return false
      }
      this.phaseBoundary('before_generation', operation.id)
      let generated: ReturnType<SessionGenerationService['generate']>
      try {
        const rewardParty = new SessionRewardBasis(
          db,
          this.definitionResolver,
          this.progression()
        ).snapshot(operation.sessionId)
        if (
          JSON.stringify(rewardParty.party) !== JSON.stringify(operation.party)
        )
          throw new CapabilityError('stale', true)
        generated = this.generation.generate({
          party: [...rewardParty.party],
          ledgerParty: [...rewardParty.ledgerParty],
          adventureDayFraction: operation.adventureDayFraction,
          ...(operation.encounterCount === null
            ? {}
            : { encounterCount: operation.encounterCount }),
          seed: operation.seed
        })
      } catch {
        journal.markFailure(operation.id, 'failed', {
          stage: 'generation',
          code: 'generation_failed',
          retryable: true,
          parameters: {}
        })
        this.publishCurrent(journal, operation.id)
        return false
      }
      if (generated.status !== 'success') {
        journal.markFailure(operation.id, 'invalid', {
          stage: 'generation',
          code: generated.issues[0]?.code ?? 'generation_invalid',
          retryable: false,
          parameters: { issueCount: generated.issues.length }
        })
        this.publishCurrent(journal, operation.id)
        return false
      }
      if (!journal.markRunReady(operation.id, generated.run.id)) return false
      this.publishCurrent(journal, operation.id)
      this.phaseBoundary('after_run_commit', operation.id)
      return true
    }

    if (operation.status === 'resolving_encounters') {
      if (operation.cancelRequested) {
        journal.requestCancel(operation.id)
        this.publishCurrent(journal, operation.id)
        return false
      }
      if (!operation.encounterBatchFingerprint) {
        const run = operation.runId
          ? new GeneratedRunStore(db).read(operation.runId)
          : null
        if (!run || run.runKind !== 'session') {
          journal.markFailure(operation.id, 'failed', {
            stage: 'encounter_import',
            code: 'generated_run_missing',
            retryable: false,
            parameters: {}
          })
          this.publishCurrent(journal, operation.id)
          return false
        }
        if (!this.rewardBasisIsCurrent(db, run, operation.sessionId)) {
          journal.markFailure(operation.id, 'stale', {
            stage: 'validation',
            code: 'reward_basis_changed',
            retryable: true,
            parameters: {}
          })
          this.publishCurrent(journal, operation.id)
          return false
        }
        const prepared = this.encounters.prepare({
          runId: run.id,
          engineVersion: run.engineVersion,
          seed: run.input.seed,
          intents: run.encounters.map((encounter) => ({
            encounterNumber: encounter.encounterNumber,
            targetXp: encounter.targetXp,
            difficulty: encounter.difficulty,
            blocks: encounter.blocks
          }))
        })
        if (prepared.status !== 'SUCCESS') {
          journal.markFailure(operation.id, 'failed', {
            stage: 'encounter_import',
            code: `encounter_prepare_${prepared.status.toLowerCase()}`,
            retryable: false,
            parameters: {}
          })
          this.publishCurrent(journal, operation.id)
          return false
        }
        if (journal.read(operation.id)?.cancelRequested) {
          journal.requestCancel(operation.id)
          this.publishCurrent(journal, operation.id)
          return false
        }
        const committed = this.encounters.commit({
          prepared: prepared.prepared
        })
        if (committed.status !== 'SUCCESS') {
          journal.markFailure(operation.id, 'failed', {
            stage: 'encounter_import',
            code: `encounter_commit_${committed.status.toLowerCase()}`,
            retryable: committed.status === 'STORAGE_FAILURE',
            parameters: {}
          })
          this.publishCurrent(journal, operation.id)
          return false
        }
        journal.saveEncounterResult(
          operation.id,
          prepared.prepared.batchFingerprint,
          mapGeneratedScenes(run, committed)
        )
        this.phaseBoundary('after_encounter_commit', operation.id)
        operation = journal.read(operation.id)!
      }
      if (operation.cancelRequested) {
        journal.requestCancel(operation.id)
        this.publishCurrent(journal, operation.id)
        return false
      }
      if (!journal.markSaving(operation.id)) return false
      this.publishCurrent(journal, operation.id)
      this.phaseBoundary('before_planner_commit', operation.id)
      return true
    }

    if (operation.status !== 'saving') return false
    try {
      const finish = db.transaction(() => {
        const current = journal.read(operationId)
        if (!current || current.status !== 'saving') return
        const planner = new SessionPlannerStore(db)
        const target = planner.require(current.sessionId)
        if (target.revision !== current.expectedSessionRevision)
          throw new CapabilityError('stale', true)
        const run = current.runId
          ? new GeneratedRunStore(db).read(current.runId)
          : null
        if (
          !run ||
          run.runKind !== 'session' ||
          !this.rewardBasisIsCurrent(db, run, current.sessionId)
        )
          throw new RewardBasisChangedError()
        const scenes = journal.scenes(operationId)
        const saved = planner.saveWithinTransaction({
          sessionId: target.id,
          expectedRevision: current.expectedSessionRevision,
          participantIds: target.participantIds,
          adventureDayFraction: target.adventureDayFraction,
          encounterCount: target.encounterCount,
          selectedSceneId: scenes[0]?.id ?? null,
          scenes: [...scenes]
        })
        if (!journal.markSucceeded(operationId, saved.revision))
          throw new Error('preparation_receipt_commit_failed')
      })
      finish.immediate()
      this.phaseBoundary('after_planner_commit', operationId)
    } catch (error) {
      journal.markFailure(
        operationId,
        error instanceof CapabilityError && error.code === 'stale'
          ? 'stale'
          : error instanceof RewardBasisChangedError
            ? 'stale'
            : 'failed',
        {
          stage: 'saving',
          code:
            error instanceof CapabilityError && error.code === 'stale'
              ? 'session_revision_changed'
              : error instanceof RewardBasisChangedError
                ? 'reward_basis_changed'
                : 'planner_commit_failed',
          retryable:
            error instanceof RewardBasisChangedError ||
            !(error instanceof CapabilityError),
          parameters: {}
        }
      )
    }
    this.publishCurrent(journal, operationId)
    return false
  }

  private rewardBasisIsCurrent(
    db: Database.Database,
    run: PersistedSessionGeneratedRun,
    sessionId: string
  ): boolean {
    return new SessionRewardBasis(
      db,
      this.definitionResolver,
      this.progression()
    ).isCurrent(run, sessionId)
  }

  private schedulePreparation(operationId: string): void {
    if (this.scheduled.has(operationId)) return
    this.scheduled.add(operationId)
    this.scheduleWork(() => {
      let continuePreparation = false
      try {
        continuePreparation = this.runPreparationStage(operationId)
      } catch {
        const journal = new SessionPreparationStore(this.activeDatabase())
        journal.markFailure(operationId, 'failed', {
          stage: 'saving',
          code: 'preparation_worker_failed',
          retryable: true,
          parameters: {}
        })
        this.publishCurrent(journal, operationId)
      } finally {
        this.scheduled.delete(operationId)
      }
      if (continuePreparation) this.schedulePreparation(operationId)
    })
  }

  private publishCurrent(journal: SessionPreparationStore, id: string): void {
    const current = journal.read(id)
    if (current) this.publish(current)
  }

  private publish(operation: SessionPreparationRecord): void {
    this.preparationChanged({
      operationId: operation.id,
      status: operation.status
    })
  }

  private workspace(sessionId: string): SessionPlannerWorkspace {
    const db = this.activeDatabase()
    const store = new SessionPlannerStore(db)
    const session = store.require(sessionId)
    const party = this.party(db).read()
    const locations = new WorldLocationStore(db).read().locations
    const locationLabels = new Map(
      locations.map((location) => [location.id, location.displayName] as const)
    )
    const planIds = [
      ...new Set(
        session.scenes.flatMap((scene) =>
          scene.encounterPlanId ? [scene.encounterPlanId] : []
        )
      )
    ]
    const planEntries =
      planIds.length === 0 ? [] : this.encounters.summaries({ planIds }).entries
    const plans = new Map(planEntries.map((entry) => [entry.planId, entry]))
    const runs = new Map(
      [
        ...new Set(
          session.scenes.flatMap((scene) =>
            scene.generatedRewards.map((reward) => reward.runId)
          )
        )
      ].map((runId) => [runId, new GeneratedRunStore(db).read(runId)] as const)
    )
    const loot = new TreasureStore(db, this.definitionResolver(db))
    const preparation = new SessionPreparationStore(db).latestActive(session.id)
    const scenes = session.scenes.map((scene) => ({
      ...scene,
      locationLabel: scene.locationId
        ? (locationLabels.get(scene.locationId) ?? null)
        : null,
      encounter: scene.encounterPlanId
        ? encounterProjection(plans.get(scene.encounterPlanId))
        : null,
      generatedRewards: scene.generatedRewards.map((reward) => {
        const run = runs.get(reward.runId)
        const generatedTreasure =
          run?.treasures.find(
            (treasure) => treasure.id === reward.generatedTreasureId
          ) ?? null
        return {
          ...reward,
          status: generatedTreasure ? ('ready' as const) : ('missing' as const),
          itemDefinitions: run?.itemDefinitions ?? [],
          generatedTreasure,
          placedTreasure: loot.findByGenerated(
            reward.runId,
            reward.generatedTreasureId
          )
        }
      })
    }))
    const participants = session.participantIds
      .map((id) => party.members.find((member) => member.id === id))
      .filter((member) => member !== undefined)
    const dayBudget = participants.reduce(
      (sum, member) => sum + dailyXp[member.level - 1]!,
      0
    )
    const fraction = decimal(session.adventureDayFraction)
    const xpBudget = roundHalfUp(
      multiply(rational(BigInt(dayBudget)), fraction)
    )
    const plannedXp = scenes.reduce(
      (sum, scene) =>
        sum +
        (scene.encounter?.status === 'ready'
          ? scene.encounter.summary.adjustedXp
          : 0),
      0
    )
    return sessionPlannerWorkspaceSchema.parse({
      currentSessionId: store.currentId(),
      sessions: store.catalog(),
      session: { ...session, scenes },
      availableParticipants: party.members.map((member) => ({
        id: member.id,
        name: member.name,
        level: member.level,
        fullDayXp: dailyXp[member.level - 1]!,
        partyMember: member.active
      })),
      availableLocations: locations.map((location) => ({
        id: location.id,
        label: location.displayName
      })),
      preparation: preparation ? receipt(preparation) : null,
      budget: {
        xpBudget,
        plannedXp,
        remainingXp: xpBudget - plannedXp,
        recommendedShortRests: floor(multiply(fraction, rational(2n))),
        recommendedLongRests: floor(fraction)
      }
    })
  }

  private validateAuthoredReferences(input: SaveSessionPlanInput): void {
    const partyIds = new Set(
      this.party(this.activeDatabase())
        .read()
        .members.map((member) => member.id)
    )
    if (input.participantIds.some((id) => !partyIds.has(id)))
      throw new CapabilityError('validation_failed', false)
    const locationIds = new Set(
      new WorldLocationStore(this.activeDatabase())
        .read()
        .locations.map((location) => location.id)
    )
    if (
      input.scenes.some(
        (scene) =>
          scene.locationId !== null && !locationIds.has(scene.locationId)
      )
    )
      throw new CapabilityError('validation_failed', false)
    const planIds = [
      ...new Set(
        input.scenes.flatMap((scene) =>
          scene.encounterPlanId ? [scene.encounterPlanId] : []
        )
      )
    ]
    if (
      planIds.length > 0 &&
      this.encounters
        .summaries({ planIds })
        .entries.some((entry) => entry.status === 'MISSING')
    )
      throw new CapabilityError('validation_failed', false)
    const runs = new Map<string, GeneratedRun | null>()
    for (const reward of input.scenes.flatMap(
      (scene) => scene.generatedRewards
    )) {
      if (!runs.has(reward.runId))
        runs.set(
          reward.runId,
          new GeneratedRunStore(this.activeDatabase()).read(reward.runId)
        )
      if (
        !runs
          .get(reward.runId)
          ?.treasures.some(
            (treasure) => treasure.id === reward.generatedTreasureId
          )
      )
        throw new CapabilityError('validation_failed', false)
    }
  }

  private party(db: Database.Database): PartyStore {
    return new PartyStore(db, this.progression())
  }
}

class RewardBasisChangedError extends Error {}

function encounterProjection(
  entry:
    | {
        status: 'READY'
        summary: SavedEncounterPlanSummary
      }
    | { status: 'MISSING' | 'UNAVAILABLE' }
    | undefined
) {
  if (!entry || entry.status === 'MISSING')
    return { status: 'missing' as const }
  if (entry.status === 'UNAVAILABLE') return { status: 'unavailable' as const }
  if (entry.status === 'READY')
    return { status: 'ready' as const, summary: entry.summary }
  return { status: 'unavailable' as const }
}

function preparationFingerprint(input: {
  operationId: string
  confirmedReplacement: boolean
  [key: string]: unknown
}): string {
  return fingerprintExcluding(input, ['operationId', 'confirmedReplacement'])
}

function receipt(
  operation: SessionPreparationRecord
): SessionPreparationReceipt {
  return sessionPreparationReceiptSchema.parse({
    operationId: operation.id,
    sessionId: operation.sessionId,
    status: operation.status,
    seed: operation.seed,
    runId: operation.runId,
    encounterBatchFingerprint: operation.encounterBatchFingerprint,
    cancelRequested: operation.cancelRequested,
    committedPlannerRevision: operation.committedPlannerRevision,
    failure: operation.failure,
    updatedAt: operation.updatedAt
  })
}

function nullableReceipt(
  operation: SessionPreparationRecord | null
): SessionPreparationReceipt | null {
  return operation ? receipt(operation) : null
}

function isTerminal(status: SessionPreparationReceipt['status']): boolean {
  return ['succeeded', 'invalid', 'stale', 'failed', 'canceled'].includes(
    status
  )
}
