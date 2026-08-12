import type Database from 'better-sqlite3'
import { uuidv7 } from '../../shared/ids/uuidv7.js'
import type {
  PreparedGeneratedEncounterBatch,
  SavedEncounterPlanSearchResult
} from '../../shared/contracts/encounter-plans.js'

export type StoredEncounterPlan = Readonly<{
  id: string
  titleKind: 'authored' | 'generated_encounter'
  authoredName: string | null
  generatedEncounterNumber: number | null
  creatures: readonly Readonly<{
    creatureId: string
    quantity: number
    lastKnownName: string
    position: number
  }>[]
}>

class GeneratedEncounterConflictError extends Error {}

export function initializeEncounterPlanSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS saved_encounter_plans (
      id TEXT PRIMARY KEY NOT NULL,
      title_kind TEXT NOT NULL CHECK(title_kind IN (
        'authored', 'generated_encounter'
      )),
      authored_name TEXT,
      generated_encounter_number INTEGER
        CHECK(generated_encounter_number IS NULL OR generated_encounter_number > 0),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      CHECK(
        (title_kind = 'authored' AND authored_name IS NOT NULL AND
         length(trim(authored_name)) > 0 AND generated_encounter_number IS NULL) OR
        (title_kind = 'generated_encounter' AND authored_name IS NULL AND
         generated_encounter_number IS NOT NULL)
      )
    );

    CREATE TABLE IF NOT EXISTS saved_encounter_plan_creatures (
      plan_id TEXT NOT NULL,
      position INTEGER NOT NULL CHECK(position >= 0),
      creature_id TEXT NOT NULL,
      quantity INTEGER NOT NULL CHECK(quantity > 0),
      last_known_name TEXT NOT NULL,
      PRIMARY KEY (plan_id, position),
      FOREIGN KEY (plan_id) REFERENCES saved_encounter_plans(id)
        ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS generated_encounter_plan_batches (
      batch_origin_fingerprint TEXT PRIMARY KEY NOT NULL
        CHECK(length(batch_origin_fingerprint) = 64),
      engine_version TEXT NOT NULL,
      generation_run_id TEXT NOT NULL,
      cardinality INTEGER NOT NULL CHECK(cardinality > 0),
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS generated_encounter_plan_origins (
      batch_origin_fingerprint TEXT NOT NULL,
      batch_position INTEGER NOT NULL CHECK(batch_position >= 0),
      encounter_number INTEGER NOT NULL CHECK(encounter_number > 0),
      roster_fingerprint TEXT NOT NULL,
      plan_id TEXT NOT NULL UNIQUE,
      PRIMARY KEY (batch_origin_fingerprint, batch_position),
      UNIQUE (batch_origin_fingerprint, encounter_number),
      FOREIGN KEY (batch_origin_fingerprint)
        REFERENCES generated_encounter_plan_batches(batch_origin_fingerprint)
        ON DELETE RESTRICT,
      FOREIGN KEY (plan_id) REFERENCES saved_encounter_plans(id)
        ON DELETE RESTRICT
    );

    CREATE INDEX IF NOT EXISTS idx_saved_encounter_plans_search
      ON saved_encounter_plans(authored_name COLLATE NOCASE, updated_at DESC);
  `)
}

export class EncounterPlanStore {
  constructor(
    private readonly db: Database.Database,
    private readonly clock: () => Date = () => new Date()
  ) {}

  commitGeneratedBatch(
    prepared: PreparedGeneratedEncounterBatch
  ): readonly Readonly<{
    encounterNumber: number
    plan: StoredEncounterPlan
  }>[] {
    const commit = this.db.transaction(() => {
      const existing = this.db
        .prepare(
          `SELECT generation_run_id AS generationRunId,
                  cardinality
             FROM generated_encounter_plan_batches
            WHERE batch_origin_fingerprint = ?`
        )
        .get(prepared.batchFingerprint) as
        | {
            generationRunId: string
            cardinality: number
          }
        | undefined
      if (existing) {
        if (
          existing.generationRunId !== prepared.runId ||
          existing.cardinality !== prepared.rosters.length
        )
          throw new GeneratedEncounterConflictError()
        const origins = this.db
          .prepare(
            `SELECT encounter_number AS encounterNumber,
                    roster_fingerprint AS rosterFingerprint, plan_id AS planId
               FROM generated_encounter_plan_origins
              WHERE batch_origin_fingerprint = ?
              ORDER BY batch_position`
          )
          .all(prepared.batchFingerprint) as Array<{
          encounterNumber: number
          rosterFingerprint: string
          planId: string
        }>
        if (
          origins.length !== prepared.rosters.length ||
          origins.some(
            (origin, position) =>
              origin.encounterNumber !==
                prepared.rosters[position]?.encounterNumber ||
              origin.rosterFingerprint !==
                prepared.rosters[position]?.rosterFingerprint
          )
        )
          throw new GeneratedEncounterConflictError()
        const plans = this.readMany(origins.map((origin) => origin.planId))
        if (plans.some((plan) => plan === null))
          throw new GeneratedEncounterConflictError()
        return origins.map((origin, position) => ({
          encounterNumber: origin.encounterNumber,
          plan: plans[position]!
        }))
      }

      const now = this.clock().toISOString()
      this.db
        .prepare(
          `INSERT INTO generated_encounter_plan_batches (
             batch_origin_fingerprint, engine_version, generation_run_id,
             cardinality, created_at
           ) VALUES (?, ?, ?, ?, ?)`
        )
        .run(
          prepared.batchFingerprint,
          prepared.engineVersion,
          prepared.runId,
          prepared.rosters.length,
          now
        )
      const insertPlan = this.db.prepare(
        `INSERT INTO saved_encounter_plans (
           id, title_kind, authored_name, generated_encounter_number,
           created_at, updated_at
         ) VALUES (?, 'generated_encounter', NULL, ?, ?, ?)`
      )
      const insertCreature = this.db.prepare(
        `INSERT INTO saved_encounter_plan_creatures (
           plan_id, position, creature_id, quantity, last_known_name
         ) VALUES (?, ?, ?, ?, ?)`
      )
      const insertOrigin = this.db.prepare(
        `INSERT INTO generated_encounter_plan_origins (
           batch_origin_fingerprint, batch_position, encounter_number,
           roster_fingerprint, plan_id
         ) VALUES (?, ?, ?, ?, ?)`
      )
      return prepared.rosters.map((roster, position) => {
        const planId = uuidv7()
        insertPlan.run(planId, roster.encounterNumber, now, now)
        for (const creature of roster.creatures)
          insertCreature.run(
            planId,
            creature.position,
            creature.creatureId,
            creature.quantity,
            creature.lastKnownName
          )
        insertOrigin.run(
          prepared.batchFingerprint,
          position,
          roster.encounterNumber,
          roster.rosterFingerprint,
          planId
        )
        return {
          encounterNumber: roster.encounterNumber,
          plan: {
            id: planId,
            titleKind: 'generated_encounter' as const,
            authoredName: null,
            generatedEncounterNumber: roster.encounterNumber,
            creatures: roster.creatures
          }
        }
      })
    })
    return commit.immediate()
  }

  readMany(
    planIds: readonly string[]
  ): readonly (StoredEncounterPlan | null)[] {
    if (planIds.length === 0) return []
    const placeholders = planIds.map(() => '?').join(', ')
    const roots = this.db
      .prepare(
        `SELECT id, title_kind AS titleKind,
                authored_name AS authoredName,
                generated_encounter_number AS generatedEncounterNumber
           FROM saved_encounter_plans
          WHERE id IN (${placeholders})`
      )
      .all(...planIds) as Array<{
      id: string
      titleKind: 'authored' | 'generated_encounter'
      authoredName: string | null
      generatedEncounterNumber: number | null
    }>
    const creatures = this.db
      .prepare(
        `SELECT plan_id AS planId, creature_id AS creatureId, quantity,
                last_known_name AS lastKnownName, position
           FROM saved_encounter_plan_creatures
          WHERE plan_id IN (${placeholders})
          ORDER BY plan_id, position`
      )
      .all(...planIds) as Array<{
      planId: string
      creatureId: string
      quantity: number
      lastKnownName: string
      position: number
    }>
    const byId = new Map(
      roots.map((root) => [
        root.id,
        {
          ...root,
          creatures: creatures
            .filter((entry) => entry.planId === root.id)
            .map((entry) => ({
              creatureId: entry.creatureId,
              quantity: entry.quantity,
              lastKnownName: entry.lastKnownName,
              position: entry.position
            }))
        }
      ])
    )
    return planIds.map((planId) => byId.get(planId) ?? null)
  }

  search(query: string): SavedEncounterPlanSearchResult {
    const escaped = query.replace(/[\\%_]/g, '\\$&')
    const rows = this.db
      .prepare(
        `SELECT p.id
           FROM saved_encounter_plans p
          WHERE COALESCE(p.authored_name, '') LIKE ? ESCAPE '\\' COLLATE NOCASE
             OR COALESCE(CAST(p.generated_encounter_number AS TEXT), '')
                  LIKE ? ESCAPE '\\' COLLATE NOCASE
             OR EXISTS (
               SELECT 1 FROM saved_encounter_plan_creatures c
                WHERE c.plan_id = p.id
                  AND c.last_known_name LIKE ? ESCAPE '\\' COLLATE NOCASE
             )
          ORDER BY p.updated_at DESC, p.id
          LIMIT 9`
      )
      .all(`%${escaped}%`, `%${escaped}%`, `%${escaped}%`) as Array<{
      id: string
    }>
    const plans = this.readMany(rows.map(({ id }) => id))
    return {
      hits: plans.slice(0, 8).map((plan) => ({
        planId: plan!.id,
        titleKind: plan!.titleKind,
        authoredName: plan!.authoredName,
        generatedEncounterNumber: plan!.generatedEncounterNumber,
        creatures: plan!.creatures.map((creature) => ({
          quantity: creature.quantity,
          name: creature.lastKnownName
        }))
      })),
      hasMore: rows.length > 8
    }
  }
}

export function isGeneratedEncounterConflict(
  error: unknown
): error is GeneratedEncounterConflictError {
  return error instanceof GeneratedEncounterConflictError
}
