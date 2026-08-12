import type Database from 'better-sqlite3'
import { CapabilityError } from '../../shared/errors/capability-error.js'
import {
  saveSessionPlanInputSchema,
  sessionPlannerSessionSchema,
  switchSessionPlanInputSchema,
  type SaveSessionPlanInput,
  type SessionPlannerSession,
  type SwitchSessionPlanInput
} from '../../shared/contracts/session-planner.js'
import { uuidv7 } from '../../shared/ids/uuidv7.js'

export function initializeSessionPlannerSchema(db: Database.Database): void {
  const initialize = db.transaction(() => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS session_planner_metadata (
        singleton INTEGER PRIMARY KEY NOT NULL CHECK(singleton = 1),
        current_session_id TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS session_planner_sessions (
        id TEXT PRIMARY KEY NOT NULL,
        revision INTEGER NOT NULL CHECK(revision >= 0),
        display_name TEXT NOT NULL,
        adventure_day_fraction TEXT NOT NULL,
        encounter_count INTEGER CHECK(encounter_count BETWEEN 1 AND 10),
        selected_scene_id TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS session_planner_participants (
        session_id TEXT NOT NULL,
        character_id TEXT NOT NULL,
        position INTEGER NOT NULL CHECK(position >= 0),
        PRIMARY KEY (session_id, character_id),
        UNIQUE (session_id, position),
        FOREIGN KEY (session_id) REFERENCES session_planner_sessions(id)
          ON DELETE CASCADE
      );
      CREATE TABLE IF NOT EXISTS session_planner_scenes (
        id TEXT PRIMARY KEY NOT NULL,
        session_id TEXT NOT NULL,
        position INTEGER NOT NULL CHECK(position >= 0),
        title_kind TEXT NOT NULL CHECK(title_kind IN (
          'authored','generated_encounter','generated_quest_rewards',
          'generated_environment_rewards'
        )),
        title TEXT,
        notes TEXT NOT NULL,
        location_id TEXT,
        encounter_plan_id TEXT,
        allocated_xp INTEGER NOT NULL CHECK(allocated_xp >= 0),
        CHECK(
          (title_kind = 'authored' AND title IS NOT NULL AND length(trim(title)) > 0) OR
          (title_kind <> 'authored' AND title IS NULL)
        ),
        UNIQUE (session_id, position),
        FOREIGN KEY (session_id) REFERENCES session_planner_sessions(id)
          ON DELETE CASCADE
      );
      CREATE TABLE IF NOT EXISTS session_planner_rests (
        session_id TEXT NOT NULL,
        after_scene_id TEXT NOT NULL,
        before_scene_id TEXT NOT NULL,
        position INTEGER NOT NULL CHECK(position >= 0),
        rest_type TEXT NOT NULL CHECK(rest_type IN ('short', 'long')),
        PRIMARY KEY (session_id, after_scene_id),
        UNIQUE (session_id, before_scene_id),
        UNIQUE (session_id, position),
        FOREIGN KEY (session_id) REFERENCES session_planner_sessions(id)
          ON DELETE CASCADE,
        FOREIGN KEY (after_scene_id) REFERENCES session_planner_scenes(id)
          ON DELETE CASCADE,
        FOREIGN KEY (before_scene_id) REFERENCES session_planner_scenes(id)
          ON DELETE CASCADE
      );
      CREATE TABLE IF NOT EXISTS session_planner_manual_loot_notes (
        id TEXT PRIMARY KEY NOT NULL,
        session_id TEXT NOT NULL,
        scene_id TEXT NOT NULL,
        position INTEGER NOT NULL CHECK(position >= 0),
        note_text TEXT NOT NULL,
        UNIQUE (scene_id, position),
        FOREIGN KEY (session_id) REFERENCES session_planner_sessions(id)
          ON DELETE CASCADE,
        FOREIGN KEY (scene_id) REFERENCES session_planner_scenes(id)
          ON DELETE CASCADE
      );
      CREATE TABLE IF NOT EXISTS session_planner_generated_rewards (
        session_id TEXT NOT NULL,
        scene_id TEXT NOT NULL,
        generation_run_id TEXT NOT NULL,
        generated_treasure_id TEXT NOT NULL,
        reward_channel TEXT NOT NULL CHECK(reward_channel IN ('encounter','quest','environment')),
        anchor_encounter_number INTEGER CHECK(anchor_encounter_number IS NULL OR anchor_encounter_number > 0),
        treasure_ordinal INTEGER NOT NULL CHECK(treasure_ordinal > 0),
        position INTEGER NOT NULL CHECK(position >= 0),
        PRIMARY KEY (session_id, generation_run_id, generated_treasure_id),
        UNIQUE (scene_id, position),
        FOREIGN KEY (session_id) REFERENCES session_planner_sessions(id)
          ON DELETE CASCADE,
        FOREIGN KEY (scene_id) REFERENCES session_planner_scenes(id)
          ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_session_planner_sessions_updated
        ON session_planner_sessions(updated_at DESC, id);
      CREATE INDEX IF NOT EXISTS idx_session_planner_rewards_scene
        ON session_planner_generated_rewards(scene_id, position);
      CREATE TABLE IF NOT EXISTS session_preparation_operation (
        id TEXT PRIMARY KEY NOT NULL,
        request_fingerprint TEXT NOT NULL,
        session_id TEXT NOT NULL,
        expected_session_revision INTEGER NOT NULL CHECK(expected_session_revision >= 0),
        seed INTEGER NOT NULL CHECK(seed >= 0),
        adventure_day_fraction TEXT NOT NULL,
        encounter_count INTEGER CHECK(encounter_count BETWEEN 1 AND 10),
        status TEXT NOT NULL CHECK(status IN (
          'queued', 'generating', 'resolving_encounters', 'saving',
          'succeeded', 'invalid', 'stale', 'failed', 'canceled'
        )),
        run_id TEXT,
        encounter_batch_fingerprint TEXT CHECK(
          encounter_batch_fingerprint IS NULL OR
          length(encounter_batch_fingerprint) = 64
        ),
        cancel_requested INTEGER NOT NULL DEFAULT 0
          CHECK(cancel_requested IN (0, 1)),
        failure_stage TEXT CHECK(failure_stage IN (
          'validation', 'generation', 'encounter_import', 'saving'
        )),
        failure_code TEXT,
        failure_retryable INTEGER CHECK(failure_retryable IN (0, 1)),
        committed_planner_revision INTEGER
          CHECK(committed_planner_revision IS NULL OR committed_planner_revision >= 0),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        CHECK(
          (status IN ('invalid', 'stale', 'failed') AND
           failure_stage IS NOT NULL AND failure_code IS NOT NULL AND
           failure_retryable IS NOT NULL) OR
          (status NOT IN ('invalid', 'stale', 'failed') AND
           failure_stage IS NULL AND failure_code IS NULL AND
           failure_retryable IS NULL)
        ),
        CHECK(
          (status = 'succeeded' AND committed_planner_revision IS NOT NULL) OR
          (status <> 'succeeded' AND committed_planner_revision IS NULL)
        )
      );
      CREATE TABLE IF NOT EXISTS session_preparation_failure_parameter (
        preparation_id TEXT NOT NULL REFERENCES session_preparation_operation(id)
          ON DELETE CASCADE,
        parameter_key TEXT NOT NULL,
        value_kind TEXT NOT NULL CHECK(value_kind IN (
          'string', 'number', 'boolean', 'null'
        )),
        string_value TEXT,
        number_value REAL,
        boolean_value INTEGER CHECK(boolean_value IN (0, 1)),
        PRIMARY KEY (preparation_id, parameter_key),
        CHECK(
          (value_kind = 'string' AND string_value IS NOT NULL AND
           number_value IS NULL AND boolean_value IS NULL) OR
          (value_kind = 'number' AND string_value IS NULL AND
           number_value IS NOT NULL AND boolean_value IS NULL) OR
          (value_kind = 'boolean' AND string_value IS NULL AND
           number_value IS NULL AND boolean_value IS NOT NULL) OR
          (value_kind = 'null' AND string_value IS NULL AND
           number_value IS NULL AND boolean_value IS NULL)
        )
      );
      CREATE TABLE IF NOT EXISTS session_preparation_party_level (
        preparation_id TEXT NOT NULL REFERENCES session_preparation_operation(id)
          ON DELETE CASCADE,
        level INTEGER NOT NULL CHECK(level BETWEEN 1 AND 20),
        member_count INTEGER NOT NULL CHECK(member_count > 0),
        PRIMARY KEY (preparation_id, level)
      );
      CREATE TABLE IF NOT EXISTS session_preparation_scene (
        id TEXT NOT NULL,
        preparation_id TEXT NOT NULL REFERENCES session_preparation_operation(id)
          ON DELETE CASCADE,
        title_kind TEXT NOT NULL CHECK(title_kind IN (
          'authored','generated_encounter','generated_quest_rewards',
          'generated_environment_rewards'
        )),
        title TEXT,
        notes TEXT NOT NULL,
        location_id TEXT,
        encounter_plan_id TEXT,
        allocated_xp INTEGER NOT NULL CHECK(allocated_xp >= 0),
        position INTEGER NOT NULL CHECK(position >= 0),
        rest_after TEXT CHECK(rest_after IN ('short', 'long')),
        CHECK(
          (title_kind = 'authored' AND title IS NOT NULL AND length(trim(title)) > 0) OR
          (title_kind <> 'authored' AND title IS NULL)
        ),
        PRIMARY KEY (preparation_id, id),
        UNIQUE (preparation_id, position)
      );
      CREATE TABLE IF NOT EXISTS session_preparation_generated_reward (
        preparation_id TEXT NOT NULL REFERENCES session_preparation_operation(id)
          ON DELETE CASCADE,
        scene_id TEXT NOT NULL,
        generation_run_id TEXT NOT NULL,
        generated_treasure_id TEXT NOT NULL,
        reward_channel TEXT NOT NULL CHECK(reward_channel IN ('encounter','quest','environment')),
        anchor_encounter_number INTEGER CHECK(anchor_encounter_number IS NULL OR anchor_encounter_number > 0),
        treasure_ordinal INTEGER NOT NULL CHECK(treasure_ordinal > 0),
        position INTEGER NOT NULL CHECK(position >= 0),
        PRIMARY KEY (
          preparation_id, generation_run_id, generated_treasure_id
        ),
        UNIQUE (preparation_id, scene_id, position),
        FOREIGN KEY (preparation_id, scene_id)
          REFERENCES session_preparation_scene(preparation_id, id)
          ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_session_preparation_session
        ON session_preparation_operation(session_id, updated_at DESC, id);
    `)
    const existing = db
      .prepare('SELECT 1 FROM session_planner_metadata WHERE singleton = 1')
      .get()
    if (existing) return
    const id = uuidv7()
    const now = new Date(0).toISOString()
    db.prepare(
      `INSERT INTO session_planner_sessions (
         id, revision, display_name, adventure_day_fraction, encounter_count,
         selected_scene_id, created_at, updated_at
       ) VALUES (?, 0, ?, '1', NULL, NULL, ?, ?)`
    ).run(id, 'Neue Sitzung', now, now)
    db.prepare(
      `INSERT INTO session_planner_metadata (singleton, current_session_id)
       VALUES (1, ?)`
    ).run(id)
  })
  initialize.immediate()
}

export class SessionPlannerStore {
  constructor(
    private readonly db: Database.Database,
    private readonly clock: () => Date = () => new Date()
  ) {}

  currentId(): string {
    return (
      this.db
        .prepare(
          `SELECT current_session_id AS currentSessionId
             FROM session_planner_metadata WHERE singleton = 1`
        )
        .get() as { currentSessionId: string }
    ).currentSessionId
  }

  catalog(): readonly Readonly<{
    id: string
    name: string
    revision: number
  }>[] {
    return this.db
      .prepare(
        `SELECT id, display_name AS name, revision
           FROM session_planner_sessions
          ORDER BY updated_at DESC, id`
      )
      .all() as Array<{ id: string; name: string; revision: number }>
  }

  read(id: string): SessionPlannerSession | null {
    const root = this.db
      .prepare(
        `SELECT id, revision, display_name AS name,
                adventure_day_fraction AS adventureDayFraction,
                encounter_count AS encounterCount,
                selected_scene_id AS selectedSceneId
           FROM session_planner_sessions WHERE id = ?`
      )
      .get(id) as
      | {
          id: string
          revision: number
          name: string
          adventureDayFraction: string
          encounterCount: number | null
          selectedSceneId: string | null
        }
      | undefined
    if (!root) return null
    const participantIds = (
      this.db
        .prepare(
          `SELECT character_id AS characterId
             FROM session_planner_participants
            WHERE session_id = ? ORDER BY position`
        )
        .all(id) as Array<{ characterId: string }>
    ).map((row) => row.characterId)
    const sceneRows = this.db
      .prepare(
        `SELECT id, position, title_kind AS titleKind, title, notes,
                location_id AS locationId,
                encounter_plan_id AS encounterPlanId,
                allocated_xp AS allocatedXp
           FROM session_planner_scenes
          WHERE session_id = ? ORDER BY position`
      )
      .all(id) as Array<{
      id: string
      position: number
      titleKind:
        | 'authored'
        | 'generated_encounter'
        | 'generated_quest_rewards'
        | 'generated_environment_rewards'
      title: string | null
      notes: string
      locationId: string | null
      encounterPlanId: string | null
      allocatedXp: number
    }>
    const rests = new Map(
      (
        this.db
          .prepare(
            `SELECT after_scene_id AS afterSceneId, rest_type AS restType
               FROM session_planner_rests WHERE session_id = ?`
          )
          .all(id) as Array<{
          afterSceneId: string
          restType: 'short' | 'long'
        }>
      ).map((row) => [row.afterSceneId, row.restType] as const)
    )
    const noteRows = this.db
      .prepare(
        `SELECT id, scene_id AS sceneId, note_text AS text, position
           FROM session_planner_manual_loot_notes
          WHERE session_id = ? ORDER BY scene_id, position`
      )
      .all(id) as Array<{
      id: string
      sceneId: string
      text: string
      position: number
    }>
    const rewardRows = this.db
      .prepare(
        `SELECT scene_id AS sceneId, generation_run_id AS runId,
                generated_treasure_id AS generatedTreasureId,
                reward_channel AS rewardChannel,
                anchor_encounter_number AS anchorEncounterNumber,
                treasure_ordinal AS treasureOrdinal, position
           FROM session_planner_generated_rewards
          WHERE session_id = ? ORDER BY scene_id, position`
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
    return sessionPlannerSessionSchema.parse({
      ...root,
      participantIds,
      scenes: sceneRows.map((scene) => ({
        ...scene,
        restAfter: rests.get(scene.id) ?? null,
        manualLootNotes: noteRows
          .filter((note) => note.sceneId === scene.id)
          .map((note) => ({
            id: note.id,
            text: note.text,
            position: note.position
          })),
        generatedRewards: rewardRows
          .filter((reward) => reward.sceneId === scene.id)
          .map((reward) => ({
            runId: reward.runId,
            generatedTreasureId: reward.generatedTreasureId,
            rewardChannel: reward.rewardChannel,
            anchorEncounterNumber: reward.anchorEncounterNumber,
            treasureOrdinal: reward.treasureOrdinal,
            position: reward.position
          }))
      }))
    })
  }

  require(id: string): SessionPlannerSession {
    const session = this.read(id)
    if (!session) throw new CapabilityError('not_found', false)
    return session
  }

  create(name: string): SessionPlannerSession {
    const create = this.db.transaction(() => {
      const id = uuidv7()
      const now = this.clock().toISOString()
      this.db
        .prepare(
          `INSERT INTO session_planner_sessions (
             id, revision, display_name, adventure_day_fraction,
             encounter_count, selected_scene_id, created_at, updated_at
           ) VALUES (?, 0, ?, '1', NULL, NULL, ?, ?)`
        )
        .run(id, name.trim(), now, now)
      this.setCurrent(id)
      return id
    })
    return this.require(create.immediate())
  }

  open(id: string): SessionPlannerSession {
    this.require(id)
    this.setCurrent(id)
    return this.require(id)
  }

  rename(
    id: string,
    expectedRevision: number,
    name: string
  ): SessionPlannerSession {
    const result = this.db
      .prepare(
        `UPDATE session_planner_sessions
            SET display_name = ?, revision = revision + 1, updated_at = ?
          WHERE id = ? AND revision = ?`
      )
      .run(name.trim(), this.clock().toISOString(), id, expectedRevision)
    if (result.changes === 0) this.throwMissingOrStale(id)
    return this.require(id)
  }

  save(input: SaveSessionPlanInput): SessionPlannerSession {
    const parsed = saveSessionPlanInputSchema.parse(input)
    const save = this.db.transaction(() => this.saveParsed(parsed))
    save.immediate()
    return this.require(parsed.sessionId)
  }

  /** Used by the preparation worker while an owner-spanning SQLite
   * transaction is already active. */
  saveWithinTransaction(input: SaveSessionPlanInput): SessionPlannerSession {
    const parsed = saveSessionPlanInputSchema.parse(input)
    this.saveParsed(parsed)
    return this.require(parsed.sessionId)
  }

  switch(input: SwitchSessionPlanInput): SessionPlannerSession {
    const parsed = switchSessionPlanInputSchema.parse(input)
    const change = this.db.transaction(() => {
      this.require(parsed.targetSessionId)
      if (this.currentId() !== parsed.source.sessionId)
        throw new CapabilityError('stale', true)
      this.saveParsed(parsed.source)
      this.setCurrent(parsed.targetSessionId)
    })
    change.immediate()
    return this.require(parsed.targetSessionId)
  }

  delete(id: string, expectedRevision: number): SessionPlannerSession {
    const remove = this.db.transaction(() => {
      const current = this.require(id)
      if (current.revision !== expectedRevision)
        throw new CapabilityError('stale', true)
      const deletingCurrent = this.currentId() === id
      const deleted = this.db
        .prepare(
          'DELETE FROM session_planner_sessions WHERE id = ? AND revision = ?'
        )
        .run(id, expectedRevision)
      if (deleted.changes !== 1) throw new CapabilityError('stale', true)
      const fallback = this.catalog()[0]
      if (fallback) {
        if (deletingCurrent) this.setCurrent(fallback.id)
        return deletingCurrent ? fallback.id : this.currentId()
      }
      const replacementId = uuidv7()
      const now = this.clock().toISOString()
      this.db
        .prepare(
          `INSERT INTO session_planner_sessions (
             id, revision, display_name, adventure_day_fraction,
             encounter_count, selected_scene_id, created_at, updated_at
           ) VALUES (?, 0, 'Neue Sitzung', '1', NULL, NULL, ?, ?)`
        )
        .run(replacementId, now, now)
      this.setCurrent(replacementId)
      return replacementId
    })
    return this.require(remove.immediate())
  }

  private replaceChildren(input: SaveSessionPlanInput): void {
    const sessionId = input.sessionId
    this.db
      .prepare('DELETE FROM session_planner_participants WHERE session_id = ?')
      .run(sessionId)
    this.db
      .prepare('DELETE FROM session_planner_scenes WHERE session_id = ?')
      .run(sessionId)
    const insertParticipant = this.db.prepare(
      `INSERT INTO session_planner_participants (
         session_id, character_id, position
       ) VALUES (?, ?, ?)`
    )
    input.participantIds.forEach((characterId, position) =>
      insertParticipant.run(sessionId, characterId, position)
    )
    const insertScene = this.db.prepare(
      `INSERT INTO session_planner_scenes (
         id, session_id, position, title_kind, title, notes, location_id,
         encounter_plan_id, allocated_xp
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    const insertRest = this.db.prepare(
      `INSERT INTO session_planner_rests (
         session_id, after_scene_id, before_scene_id, position, rest_type
       ) VALUES (?, ?, ?, ?, ?)`
    )
    const insertNote = this.db.prepare(
      `INSERT INTO session_planner_manual_loot_notes (
         id, session_id, scene_id, position, note_text
       ) VALUES (?, ?, ?, ?, ?)`
    )
    const insertReward = this.db.prepare(
      `INSERT INTO session_planner_generated_rewards (
         session_id, scene_id, generation_run_id, generated_treasure_id,
         reward_channel, anchor_encounter_number, treasure_ordinal, position
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    input.scenes.forEach((scene, position) => {
      insertScene.run(
        scene.id,
        sessionId,
        position,
        scene.titleKind,
        scene.title?.trim() ?? null,
        scene.notes,
        scene.locationId,
        scene.encounterPlanId,
        scene.allocatedXp
      )
    })
    // Rest gaps reference both adjacent Scene rows, so all Scene roots must
    // exist before any gap or other child is inserted.
    input.scenes.forEach((scene, position) => {
      if (scene.restAfter)
        insertRest.run(
          sessionId,
          scene.id,
          input.scenes[position + 1]!.id,
          position,
          scene.restAfter
        )
      scene.manualLootNotes.forEach((note, notePosition) =>
        insertNote.run(note.id, sessionId, scene.id, notePosition, note.text)
      )
      scene.generatedRewards.forEach((reward, rewardPosition) =>
        insertReward.run(
          sessionId,
          scene.id,
          reward.runId,
          reward.generatedTreasureId,
          reward.rewardChannel,
          reward.anchorEncounterNumber,
          reward.treasureOrdinal,
          rewardPosition
        )
      )
    })
  }

  private setCurrent(id: string): void {
    this.db
      .prepare(
        `UPDATE session_planner_metadata SET current_session_id = ?
          WHERE singleton = 1`
      )
      .run(id)
  }

  private saveParsed(parsed: SaveSessionPlanInput): void {
    const current = this.require(parsed.sessionId)
    if (current.revision !== parsed.expectedRevision)
      throw new CapabilityError('stale', true)
    const result = this.db
      .prepare(
        `UPDATE session_planner_sessions
            SET revision = revision + 1, adventure_day_fraction = ?,
                encounter_count = ?, selected_scene_id = NULL, updated_at = ?
          WHERE id = ? AND revision = ?`
      )
      .run(
        parsed.adventureDayFraction,
        parsed.encounterCount,
        this.clock().toISOString(),
        parsed.sessionId,
        parsed.expectedRevision
      )
    if (result.changes !== 1) throw new CapabilityError('stale', true)
    this.replaceChildren(parsed)
    this.db
      .prepare(
        `UPDATE session_planner_sessions SET selected_scene_id = ?
          WHERE id = ?`
      )
      .run(parsed.selectedSceneId, parsed.sessionId)
  }

  private throwMissingOrStale(id: string): never {
    if (this.read(id)) throw new CapabilityError('stale', true)
    throw new CapabilityError('not_found', false)
  }
}
