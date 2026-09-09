import type { SceneGroupLifecycleCommand } from '../../shared/contracts/scene-group-lifecycle.js'
import type Database from 'better-sqlite3'
import { CapabilityError } from '../../shared/errors/capability-error.js'
import {
  sceneGroupCommandResultSchema,
  type SceneGroupCommandResult
} from '../../shared/contracts/live-session.js'
import type { SaveSceneGroupInput } from '../../shared/contracts/scene.js'
import { fingerprintExcluding } from '../fingerprint.js'

export function initializeSceneGroupCommandJournal(
  database: Database.Database
): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS scene_group_command_receipt (
      command_id TEXT PRIMARY KEY NOT NULL,
      request_fingerprint TEXT NOT NULL,
      result_schema_version INTEGER NOT NULL CHECK(result_schema_version = 1),
      result_json TEXT NOT NULL
    );
  `)
}

export class SceneGroupCommandJournal {
  constructor(private readonly database: Database.Database) {}

  read(
    input: SaveSceneGroupInput | SceneGroupLifecycleCommand
  ): SceneGroupCommandResult | null {
    const row = this.database
      .prepare(
        `
      SELECT request_fingerprint AS fingerprint, result_schema_version AS version,
        result_json AS result FROM scene_group_command_receipt WHERE command_id = ?
    `
      )
      .get(input.commandId) as
      { fingerprint: string; version: number; result: string } | undefined
    if (!row) return null
    if (
      row.fingerprint !== fingerprintExcluding(input, ['commandId']) ||
      row.version !== 1
    )
      throw new CapabilityError('idempotency_conflict', false)
    return sceneGroupCommandResultSchema.parse(
      JSON.parse(row.result) as unknown
    )
  }

  record(
    input: SaveSceneGroupInput | SceneGroupLifecycleCommand,
    result: SceneGroupCommandResult
  ): void {
    this.database
      .prepare(
        `
      INSERT INTO scene_group_command_receipt (command_id, request_fingerprint, result_schema_version, result_json)
      VALUES (?, ?, 1, ?)
    `
      )
      .run(
        input.commandId,
        fingerprintExcluding(input, ['commandId']),
        JSON.stringify(sceneGroupCommandResultSchema.parse(result))
      )
  }
}
