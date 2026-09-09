import type Database from 'better-sqlite3'
import { CapabilityError } from '../../shared/errors/capability-error.js'
import {
  sceneCommandReceiptSchema,
  type SceneCommand,
  type SceneCommandReceipt
} from '../../shared/contracts/scene-command.js'
import { fingerprintExcluding } from '../fingerprint.js'

export function initializeScenePartyCommandJournal(
  database: Database.Database
): void {
  database.exec(`CREATE TABLE IF NOT EXISTS scene_party_command_receipt (
    command_id TEXT PRIMARY KEY NOT NULL,
    request_fingerprint TEXT NOT NULL,
    result_schema_version INTEGER NOT NULL CHECK(result_schema_version = 1),
    result_json TEXT NOT NULL
  )`)
}

/** Scene commands share this historical table; original outcomes remain immutable. */
export class ScenePartyCommandJournal {
  constructor(private readonly database: Database.Database) {}
  read(input: SceneCommand): SceneCommandReceipt | null {
    const row = this.database
      .prepare(
        `SELECT request_fingerprint AS fingerprint,
      result_schema_version AS version, result_json AS result
      FROM scene_party_command_receipt WHERE command_id = ?`
      )
      .get(input.commandId) as
      { fingerprint: string; version: number; result: string } | undefined
    if (!row) return null
    if (
      row.version !== 1 ||
      row.fingerprint !== fingerprintExcluding(input, ['commandId'])
    )
      throw new CapabilityError('idempotency_conflict', false)
    return sceneCommandReceiptSchema.parse(JSON.parse(row.result) as unknown)
  }
  record(input: SceneCommand, receipt: SceneCommandReceipt): void {
    this.database
      .prepare(
        `INSERT INTO scene_party_command_receipt
      (command_id, request_fingerprint, result_schema_version, result_json) VALUES (?, ?, 1, ?)`
      )
      .run(
        input.commandId,
        fingerprintExcluding(input, ['commandId']),
        JSON.stringify(sceneCommandReceiptSchema.parse(receipt))
      )
  }
}
