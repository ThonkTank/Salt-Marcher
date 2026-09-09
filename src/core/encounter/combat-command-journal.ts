import type { CombatCommand } from '../../shared/contracts/combat-command.js'
import type Database from 'better-sqlite3'
import { CapabilityError } from '../../shared/errors/capability-error.js'
import {
  combatCommandResultSchema,
  type CombatCommandResult
} from '../../shared/contracts/live-session.js'
import { fingerprintExcluding } from '../fingerprint.js'

export function initializeCombatCommandJournal(
  database: Database.Database
): void {
  database.exec(`CREATE TABLE IF NOT EXISTS combat_command_receipt (
    command_id TEXT PRIMARY KEY NOT NULL,
    request_fingerprint TEXT NOT NULL,
    result_schema_version INTEGER NOT NULL CHECK(result_schema_version = 1),
    result_json TEXT NOT NULL
  )`)
}

/** The original cross-aggregate outcome is immutable, even after later work. */
export class CombatCommandJournal {
  constructor(private readonly database: Database.Database) {}
  read(input: CombatCommand): CombatCommandResult | null {
    const row = this.database
      .prepare(
        `SELECT request_fingerprint AS fingerprint,
      result_schema_version AS version, result_json AS result
      FROM combat_command_receipt WHERE command_id = ?`
      )
      .get(input.commandId) as
      { fingerprint: string; version: number; result: string } | undefined
    if (!row) return null
    if (
      row.version !== 1 ||
      row.fingerprint !== fingerprintExcluding(input, ['commandId'])
    )
      throw new CapabilityError('idempotency_conflict', false)
    return combatCommandResultSchema.parse(JSON.parse(row.result) as unknown)
  }
  record(input: CombatCommand, receipt: CombatCommandResult): void {
    this.database
      .prepare(
        `INSERT INTO combat_command_receipt
      (command_id, request_fingerprint, result_schema_version, result_json) VALUES (?, ?, 1, ?)`
      )
      .run(
        input.commandId,
        fingerprintExcluding(input, ['commandId']),
        JSON.stringify(combatCommandResultSchema.parse(receipt))
      )
  }
}
