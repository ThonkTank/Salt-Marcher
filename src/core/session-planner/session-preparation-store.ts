import type Database from 'better-sqlite3'
import {
  sessionPlannerSceneSchema,
  type SessionPlannerScene,
  type SessionPlannerSession,
  type SessionPreparationReceipt
} from '../../shared/contracts/session-planner.js'

export type SessionPreparationStatus = SessionPreparationReceipt['status']
export type SessionPreparationFailure = NonNullable<
  SessionPreparationReceipt['failure']
>

export type SessionPreparationRecord = Readonly<{
  id: string
  requestFingerprint: string
  sessionId: string
  expectedSessionRevision: number
  seed: number
  adventureDayFraction: string
  encounterCount: number | null
  status: SessionPreparationStatus
  runId: string | null
  encounterBatchFingerprint: string | null
  cancelRequested: boolean
  committedPlannerRevision: number | null
  failure: SessionPreparationFailure | null
  createdAt: string
  updatedAt: string
  party: readonly Readonly<{ level: number; count: number }>[]
}>

const terminalStatuses: readonly SessionPreparationStatus[] = [
  'succeeded',
  'invalid',
  'stale',
  'failed',
  'canceled'
]

export class SessionPreparationStore {
  constructor(
    private readonly db: Database.Database,
    private readonly clock: () => Date = () => new Date()
  ) {}

  read(id: string): SessionPreparationRecord | null {
    const root = this.db
      .prepare(
        `SELECT id, request_fingerprint AS requestFingerprint,
                session_id AS sessionId,
                expected_session_revision AS expectedSessionRevision,
                seed, adventure_day_fraction AS adventureDayFraction,
                encounter_count AS encounterCount, status, run_id AS runId,
                encounter_batch_fingerprint AS encounterBatchFingerprint,
                cancel_requested AS cancelRequested,
                committed_planner_revision AS committedPlannerRevision,
                failure_stage AS failureStage, failure_code AS failureCode,
                failure_retryable AS failureRetryable,
                created_at AS createdAt, updated_at AS updatedAt
           FROM session_preparation_operation WHERE id = ?`
      )
      .get(id) as
      | (Omit<
          SessionPreparationRecord,
          'party' | 'failure' | 'cancelRequested'
        > & {
          cancelRequested: number
          failureStage: SessionPreparationFailure['stage'] | null
          failureCode: string | null
          failureRetryable: number | null
        })
      | undefined
    if (!root) return null
    const party = this.db
      .prepare(
        `SELECT level, member_count AS count
           FROM session_preparation_party_level
          WHERE preparation_id = ? ORDER BY level`
      )
      .all(id) as Array<{ level: number; count: number }>
    const parameters = this.failureParameters(id)
    const {
      failureStage,
      failureCode,
      failureRetryable,
      cancelRequested,
      ...record
    } = root
    return {
      ...record,
      cancelRequested: Boolean(cancelRequested),
      failure:
        failureStage && failureCode && failureRetryable !== null
          ? {
              stage: failureStage,
              code: failureCode,
              retryable: Boolean(failureRetryable),
              parameters
            }
          : null,
      party
    }
  }

  latestActive(sessionId: string): SessionPreparationRecord | null {
    const row = this.db
      .prepare(
        `SELECT id FROM session_preparation_operation
          WHERE session_id = ?
            AND status IN ('queued','generating','resolving_encounters','saving')
          ORDER BY updated_at DESC, id DESC LIMIT 1`
      )
      .get(sessionId) as { id: string } | undefined
    return row ? this.read(row.id) : null
  }

  recoverable(): readonly SessionPreparationRecord[] {
    const ids = this.db
      .prepare(
        `SELECT id FROM session_preparation_operation
          WHERE status IN ('queued','generating','resolving_encounters','saving')
          ORDER BY created_at, id`
      )
      .all() as Array<{ id: string }>
    return ids.map(({ id }) => this.read(id)!)
  }

  start(input: {
    id: string
    requestFingerprint: string
    session: SessionPlannerSession
    expectedSessionRevision: number
    seed: number
    party: readonly Readonly<{ level: number; count: number }>[]
  }): SessionPreparationRecord {
    const write = this.db.transaction(() => {
      const now = this.clock().toISOString()
      this.db
        .prepare(
          `INSERT INTO session_preparation_operation (
             id, request_fingerprint, session_id, expected_session_revision,
             seed, adventure_day_fraction, encounter_count, status, run_id,
             encounter_batch_fingerprint, cancel_requested,
             failure_stage, failure_code, failure_retryable,
             committed_planner_revision, created_at, updated_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, 'queued', NULL, NULL, 0,
                     NULL, NULL, NULL, NULL, ?, ?)`
        )
        .run(
          input.id,
          input.requestFingerprint,
          input.session.id,
          input.expectedSessionRevision,
          input.seed,
          input.session.adventureDayFraction,
          input.session.encounterCount,
          now,
          now
        )
      const insertLevel = this.db.prepare(
        `INSERT INTO session_preparation_party_level (
           preparation_id, level, member_count
         ) VALUES (?, ?, ?)`
      )
      for (const level of input.party)
        insertLevel.run(input.id, level.level, level.count)
    })
    write.immediate()
    return this.read(input.id)!
  }

  markGenerating(id: string): boolean {
    return this.transition(id, 'generating', ['queued', 'generating'])
  }

  markRunReady(id: string, runId: string): boolean {
    const result = this.db
      .prepare(
        `UPDATE session_preparation_operation
            SET status = 'resolving_encounters', run_id = ?, updated_at = ?
          WHERE id = ? AND status IN ('queued', 'generating',
                                      'resolving_encounters')
            AND cancel_requested = 0`
      )
      .run(runId, this.clock().toISOString(), id)
    return result.changes === 1
  }

  saveEncounterResult(
    id: string,
    batchFingerprint: string,
    scenes: readonly SessionPlannerScene[]
  ): boolean {
    const parsed = scenes.map((scene) => sessionPlannerSceneSchema.parse(scene))
    const write = this.db.transaction(() => {
      const current = this.read(id)
      if (
        !current ||
        current.status !== 'resolving_encounters' ||
        current.cancelRequested
      )
        return false
      this.db
        .prepare(
          'DELETE FROM session_preparation_scene WHERE preparation_id = ?'
        )
        .run(id)
      const insertScene = this.db.prepare(
        `INSERT INTO session_preparation_scene (
           id, preparation_id, title_kind, title, notes, location_id,
           encounter_plan_id, allocated_xp, position, rest_after
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      const insertReward = this.db.prepare(
        `INSERT INTO session_preparation_generated_reward (
           preparation_id, scene_id, generation_run_id,
           generated_treasure_id, reward_channel, anchor_encounter_number,
           treasure_ordinal, position
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      for (const scene of parsed) {
        insertScene.run(
          scene.id,
          id,
          scene.titleKind,
          scene.title,
          scene.notes,
          scene.locationId,
          scene.encounterPlanId,
          scene.allocatedXp,
          scene.position,
          scene.restAfter
        )
        for (const reward of scene.generatedRewards)
          insertReward.run(
            id,
            scene.id,
            reward.runId,
            reward.generatedTreasureId,
            reward.rewardChannel,
            reward.anchorEncounterNumber,
            reward.treasureOrdinal,
            reward.position
          )
      }
      this.db
        .prepare(
          `UPDATE session_preparation_operation
              SET encounter_batch_fingerprint = ?, updated_at = ?
            WHERE id = ? AND status = 'resolving_encounters'
              AND cancel_requested = 0`
        )
        .run(batchFingerprint, this.clock().toISOString(), id)
      return true
    })
    return write.immediate()
  }

  scenes(id: string): readonly SessionPlannerScene[] {
    const roots = this.db
      .prepare(
        `SELECT id, title_kind AS titleKind, title, notes,
                location_id AS locationId,
                encounter_plan_id AS encounterPlanId,
                allocated_xp AS allocatedXp, position,
                rest_after AS restAfter
           FROM session_preparation_scene
          WHERE preparation_id = ? ORDER BY position`
      )
      .all(id) as Array<
      Omit<SessionPlannerScene, 'manualLootNotes' | 'generatedRewards'>
    >
    const rewards = this.db
      .prepare(
        `SELECT scene_id AS sceneId, generation_run_id AS runId,
                generated_treasure_id AS generatedTreasureId,
                reward_channel AS rewardChannel,
                anchor_encounter_number AS anchorEncounterNumber,
                treasure_ordinal AS treasureOrdinal, position
           FROM session_preparation_generated_reward
          WHERE preparation_id = ? ORDER BY scene_id, position`
      )
      .all(id) as Array<{
      sceneId: string
      runId: string
      generatedTreasureId: string
      rewardChannel: 'encounter' | 'quest' | 'environment'
      anchorEncounterNumber: number | null
      treasureOrdinal: number
      position: number
    }>
    return roots.map((scene) =>
      sessionPlannerSceneSchema.parse({
        ...scene,
        manualLootNotes: [],
        generatedRewards: rewards
          .filter((reward) => reward.sceneId === scene.id)
          .map(({ sceneId, ...reward }) => {
            void sceneId
            return reward
          })
      })
    )
  }

  markSaving(id: string): boolean {
    return this.transition(id, 'saving', ['resolving_encounters'], true)
  }

  markSucceeded(id: string, plannerRevision: number): boolean {
    const result = this.db
      .prepare(
        `UPDATE session_preparation_operation
            SET status = 'succeeded', committed_planner_revision = ?,
                updated_at = ?
          WHERE id = ? AND status = 'saving'`
      )
      .run(plannerRevision, this.clock().toISOString(), id)
    return result.changes === 1
  }

  markFailure(
    id: string,
    status: 'invalid' | 'stale' | 'failed',
    failure: SessionPreparationFailure
  ): boolean {
    const write = this.db.transaction(() => {
      const result = this.db
        .prepare(
          `UPDATE session_preparation_operation
              SET status = ?, failure_stage = ?, failure_code = ?,
                  failure_retryable = ?, updated_at = ?
            WHERE id = ? AND status NOT IN (
              'succeeded','invalid','stale','failed','canceled'
            )`
        )
        .run(
          status,
          failure.stage,
          failure.code,
          failure.retryable ? 1 : 0,
          this.clock().toISOString(),
          id
        )
      if (result.changes !== 1) return false
      this.db
        .prepare(
          `DELETE FROM session_preparation_failure_parameter
            WHERE preparation_id = ?`
        )
        .run(id)
      const insert = this.db.prepare(
        `INSERT INTO session_preparation_failure_parameter (
           preparation_id, parameter_key, value_kind,
           string_value, number_value, boolean_value
         ) VALUES (?, ?, ?, ?, ?, ?)`
      )
      for (const [key, value] of Object.entries(failure.parameters)) {
        const kind = value === null ? 'null' : typeof value
        insert.run(
          id,
          key,
          kind,
          typeof value === 'string' ? value : null,
          typeof value === 'number' ? value : null,
          typeof value === 'boolean' ? (value ? 1 : 0) : null
        )
      }
      return true
    })
    return write.immediate()
  }

  requestCancel(id: string): SessionPreparationRecord | null {
    const write = this.db.transaction(() => {
      const current = this.read(id)
      if (!current) return null
      if (terminalStatuses.includes(current.status)) return current
      const cancelImmediately = current.status !== 'saving'
      this.db
        .prepare(
          `UPDATE session_preparation_operation
              SET cancel_requested = 1,
                  status = CASE WHEN ? THEN 'canceled' ELSE status END,
                  updated_at = ?
            WHERE id = ?`
        )
        .run(cancelImmediately ? 1 : 0, this.clock().toISOString(), id)
      return this.read(id)
    })
    return write.immediate()
  }

  private transition(
    id: string,
    status: SessionPreparationStatus,
    from: readonly SessionPreparationStatus[],
    requireNotCanceled = false
  ): boolean {
    const placeholders = from.map(() => '?').join(', ')
    const result = this.db
      .prepare(
        `UPDATE session_preparation_operation
            SET status = ?, updated_at = ?
          WHERE id = ? AND status IN (${placeholders})
            ${requireNotCanceled ? 'AND cancel_requested = 0' : ''}`
      )
      .run(status, this.clock().toISOString(), id, ...from)
    return result.changes === 1
  }

  private failureParameters(
    id: string
  ): Record<string, string | number | boolean | null> {
    const rows = this.db
      .prepare(
        `SELECT parameter_key AS key, value_kind AS kind,
                string_value AS stringValue, number_value AS numberValue,
                boolean_value AS booleanValue
           FROM session_preparation_failure_parameter
          WHERE preparation_id = ? ORDER BY parameter_key`
      )
      .all(id) as Array<{
      key: string
      kind: 'string' | 'number' | 'boolean' | 'null'
      stringValue: string | null
      numberValue: number | null
      booleanValue: number | null
    }>
    return Object.fromEntries(
      rows.map((row) => [
        row.key,
        row.kind === 'string'
          ? row.stringValue!
          : row.kind === 'number'
            ? row.numberValue!
            : row.kind === 'boolean'
              ? Boolean(row.booleanValue)
              : null
      ])
    )
  }
}
