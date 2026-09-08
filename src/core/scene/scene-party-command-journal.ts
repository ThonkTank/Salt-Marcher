import type Database from 'better-sqlite3'
import { CapabilityError } from '../../shared/errors/capability-error.js'
import {
  scenePartyCommandReceiptSchema,
  type ScenePartyCommand,
  type ScenePartyCommandReceipt
} from '../../shared/contracts/scene-party-command.js'
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

/** The original cross-aggregate outcome is immutable, even after later work. */
export class ScenePartyCommandJournal {
  constructor(private readonly database: Database.Database) {}
  read(input: ScenePartyCommand): ScenePartyCommandReceipt | null {
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
    return scenePartyCommandReceiptSchema.parse(
      JSON.parse(row.result) as unknown
    )
  }
  record(input: ScenePartyCommand, receipt: ScenePartyCommandReceipt): void {
    this.database
      .prepare(
        `INSERT INTO scene_party_command_receipt
      (command_id, request_fingerprint, result_schema_version, result_json) VALUES (?, ?, 1, ?)`
      )
      .run(
        input.commandId,
        fingerprintExcluding(input, ['commandId']),
        JSON.stringify(scenePartyCommandReceiptSchema.parse(receipt))
      )
  }
}
