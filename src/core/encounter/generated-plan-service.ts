import type Database from 'better-sqlite3'
import {
  commitGeneratedEncounterBatchCommandSchema,
  committedGeneratedEncounterBatchResultSchema,
  generatedEncounterPlanSummaryBatchQuerySchema,
  generatedEncounterPlanSummaryBatchResultSchema,
  preparedGeneratedEncounterBatchResultSchema,
  prepareGeneratedEncounterBatchCommandSchema,
  savedEncounterPlanSearchResultSchema,
  searchSavedEncounterPlansQuerySchema,
  type CommittedGeneratedEncounterBatchResult,
  type GeneratedEncounterPlanSummaryBatchResult,
  type PreparedGeneratedEncounterBatch,
  type PreparedGeneratedEncounterBatchResult,
  type SavedEncounterPlanSummary,
  type SavedEncounterPlanSearchResult
} from '../../shared/contracts/encounter-plans.js'
import { creatures, creatureById } from '../creatures/catalog.js'
import { PartyStore } from '../party/party-store.js'
import { fingerprint } from '../fingerprint.js'
import { difficulty, multiplier, partyThresholds } from './math.js'
import { selectGeneratedRosters } from './generated-roster-selector.js'
import { validatePreparedEncounterBatch } from './prepared-batch-validator.js'
import {
  EncounterPlanStore,
  isGeneratedEncounterConflict,
  type StoredEncounterPlan
} from './encounter-plan-store.js'

export class GeneratedEncounterPlanService {
  constructor(private readonly activeDatabase: () => Database.Database) {}

  prepare(input: unknown): PreparedGeneratedEncounterBatchResult {
    const parsed = prepareGeneratedEncounterBatchCommandSchema.safeParse(input)
    if (!parsed.success)
      return preparedGeneratedEncounterBatchResultSchema.parse({
        status: 'INVALID_REQUEST',
        code: 'encounter_batch_invalid',
        parameters: {}
      })
    const partySize = Math.max(
      1,
      new PartyStore(this.activeDatabase())
        .read()
        .members.filter((member) => member.active).length
    )
    const selection = selectGeneratedRosters(parsed.data, creatures, partySize)
    if (selection.status === 'unresolvable')
      return preparedGeneratedEncounterBatchResultSchema.parse({
        status: 'UNRESOLVABLE',
        code: selection.code,
        parameters: selection.parameters
      })
    const rosters = selection.rosters
    const prepared = {
      runId: parsed.data.runId,
      engineVersion: parsed.data.engineVersion,
      batchFingerprint: generatedEncounterBatchFingerprint({
        runId: parsed.data.runId,
        engineVersion: parsed.data.engineVersion,
        rosters
      }),
      rosters
    }
    return preparedGeneratedEncounterBatchResultSchema.parse({
      status: 'SUCCESS',
      prepared
    })
  }

  commit(input: unknown): CommittedGeneratedEncounterBatchResult {
    const parsed = commitGeneratedEncounterBatchCommandSchema.safeParse(input)
    if (!parsed.success)
      return committedGeneratedEncounterBatchResultSchema.parse({
        status: 'INVALID_REQUEST',
        code: 'prepared_batch_invalid',
        parameters: {}
      })
    const expectedFingerprint = generatedEncounterBatchFingerprint({
      runId: parsed.data.prepared.runId,
      engineVersion: parsed.data.prepared.engineVersion,
      rosters: parsed.data.prepared.rosters
    })
    if (expectedFingerprint !== parsed.data.prepared.batchFingerprint)
      return committedGeneratedEncounterBatchResultSchema.parse({
        status: 'INVALID_REQUEST',
        code: 'batch_fingerprint_mismatch',
        parameters: {}
      })
    const partySize = new PartyStore(this.activeDatabase())
      .read()
      .members.filter((member) => member.active).length
    if (
      !validatePreparedEncounterBatch(
        parsed.data.prepared,
        creatureById,
        partySize
      )
    )
      return committedGeneratedEncounterBatchResultSchema.parse({
        status: 'INVALID_REQUEST',
        code: 'prepared_roster_invalid',
        parameters: {}
      })
    try {
      const stored = new EncounterPlanStore(
        this.activeDatabase()
      ).commitGeneratedBatch(parsed.data.prepared)
      const mappings = stored.map((entry) => {
        const summary = this.summary(entry.plan)
        if (!summary) throw new Error('unavailable_creature')
        return {
          encounterNumber: entry.encounterNumber,
          planId: entry.plan.id,
          summary
        }
      })
      return committedGeneratedEncounterBatchResultSchema.parse({
        status: 'SUCCESS',
        runId: parsed.data.prepared.runId,
        mappings
      })
    } catch (error) {
      return committedGeneratedEncounterBatchResultSchema.parse({
        status: isGeneratedEncounterConflict(error)
          ? 'CONFLICT'
          : 'STORAGE_FAILURE',
        code: isGeneratedEncounterConflict(error)
          ? 'batch_origin_conflict'
          : 'encounter_storage_failed',
        parameters: {}
      })
    }
  }

  summaries(input: unknown): GeneratedEncounterPlanSummaryBatchResult {
    const query = generatedEncounterPlanSummaryBatchQuerySchema.parse(input)
    const plans = new EncounterPlanStore(this.activeDatabase()).readMany(
      query.planIds
    )
    return generatedEncounterPlanSummaryBatchResultSchema.parse({
      entries: plans.map((plan, index) => {
        const planId = query.planIds[index]!
        if (!plan) return { status: 'MISSING', planId }
        const summary = this.summary(plan)
        return summary
          ? { status: 'READY', planId, summary }
          : { status: 'UNAVAILABLE', planId }
      })
    })
  }

  search(input: unknown): SavedEncounterPlanSearchResult {
    const query = searchSavedEncounterPlansQuerySchema.parse(input)
    return savedEncounterPlanSearchResultSchema.parse(
      new EncounterPlanStore(this.activeDatabase()).search(query.query)
    )
  }

  private summary(plan: StoredEncounterPlan): SavedEncounterPlanSummary | null {
    const resolved = plan.creatures.map((entry) => ({
      ...entry,
      creature: creatureById(entry.creatureId)
    }))
    if (resolved.some((entry) => !entry.creature)) return null
    const currentParty = new PartyStore(this.activeDatabase()).read().members
    const partySize = currentParty.filter((member) => member.active).length
    const creatureCount = resolved.reduce(
      (sum, entry) => sum + entry.quantity,
      0
    )
    const baseXp = resolved.reduce(
      (sum, entry) => sum + entry.creature!.xp * entry.quantity,
      0
    )
    const adjustedXp = Math.round(
      baseXp * multiplier(creatureCount, Math.max(1, partySize))
    )
    const difficultyValue = difficulty(
      adjustedXp,
      partyThresholds(currentParty)
    ).toUpperCase() as SavedEncounterPlanSummary['difficulty']
    return {
      id: plan.id,
      titleKind: plan.titleKind,
      authoredName: plan.authoredName,
      generatedEncounterNumber: plan.generatedEncounterNumber,
      creatureCount,
      baseXp,
      adjustedXp,
      difficulty: difficultyValue,
      creatures: resolved.map((entry) => ({
        quantity: entry.quantity,
        name: entry.creature!.name
      }))
    }
  }
}

function semanticRosters(rosters: PreparedGeneratedEncounterBatch['rosters']) {
  return rosters.map((roster) => ({
    encounterNumber: roster.encounterNumber,
    rosterFingerprint: roster.rosterFingerprint,
    targetXp: roster.targetXp,
    declaredDifficulty: roster.declaredDifficulty,
    creatures: roster.creatures,
    totalCreatureCount: roster.totalCreatureCount,
    baseXp: roster.baseXp,
    adjustedXp: roster.adjustedXp
  }))
}

export function generatedEncounterBatchFingerprint(input: {
  runId: string
  engineVersion: string
  rosters: PreparedGeneratedEncounterBatch['rosters']
}): string {
  return fingerprint({
    runId: input.runId,
    engineVersion: input.engineVersion,
    rosters: semanticRosters(input.rosters)
  })
}
