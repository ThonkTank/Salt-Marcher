import type Database from 'better-sqlite3'
import { CapabilityError } from '../../shared/errors/capability-error.js'
import {
  sessionPlannerWorkspaceSchema,
  type SessionPlannerCommand,
  type SessionPlannerWorkspace
} from '../../shared/contracts/session-planner.js'
import { fingerprintExcluding } from '../fingerprint.js'

export function initializeSessionPlannerCommandJournal(
  db: Database.Database
): void {
  db.exec(`CREATE TABLE IF NOT EXISTS session_planner_command_receipt (
    command_id TEXT PRIMARY KEY NOT NULL,
    request_fingerprint TEXT NOT NULL,
    result_schema_version INTEGER NOT NULL CHECK(result_schema_version = 1),
    result_json TEXT NOT NULL
  )`)
}

/** Receipts survive session deletion and are committed with the owning command. */
export class SessionPlannerCommandJournal {
  constructor(private readonly db: Database.Database) {}
  read(input: SessionPlannerCommand): SessionPlannerWorkspace | null {
    const row = this.db
      .prepare(
        `SELECT request_fingerprint AS fingerprint,
      result_schema_version AS version, result_json AS result
      FROM session_planner_command_receipt WHERE command_id = ?`
      )
      .get(input.commandId) as
      { fingerprint: string; version: number; result: string } | undefined
    if (!row) return null
    if (
      row.version !== 1 ||
      row.fingerprint !== fingerprintExcluding(input, ['commandId'])
    )
      throw new CapabilityError('idempotency_conflict', false)
    return sessionPlannerWorkspaceSchema.parse(
      JSON.parse(row.result) as unknown
    )
  }
  record(input: SessionPlannerCommand, result: SessionPlannerWorkspace): void {
    this.db
      .prepare(
        `INSERT INTO session_planner_command_receipt
      (command_id, request_fingerprint, result_schema_version, result_json)
      VALUES (?, ?, 1, ?)`
      )
      .run(
        input.commandId,
        fingerprintExcluding(input, ['commandId']),
        JSON.stringify(sessionPlannerWorkspaceSchema.parse(result))
      )
  }
}
