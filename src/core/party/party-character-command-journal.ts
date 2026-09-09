import type Database from 'better-sqlite3'
import { CapabilityError } from '../../shared/errors/capability-error.js'
import {
  partyCharacterCommandReceiptSchema,
  type PartyCharacterCommand,
  type PartyCharacterCommandReceipt
} from '../../shared/contracts/party.js'
import { fingerprintExcluding } from '../fingerprint.js'

export function initializePartyCharacterCommandJournal(
  db: Database.Database
): void {
  db.exec(`CREATE TABLE IF NOT EXISTS party_character_command_receipt (
    command_id TEXT PRIMARY KEY NOT NULL,
    request_fingerprint TEXT NOT NULL,
    result_schema_version INTEGER NOT NULL CHECK(result_schema_version = 1),
    result_json TEXT NOT NULL
  )`)
}

/** Party receipts survive deletion and commit atomically with scene/combat effects. */
export class PartyCharacterCommandJournal {
  constructor(private readonly db: Database.Database) {}
  read(input: PartyCharacterCommand): PartyCharacterCommandReceipt | null {
    const row = this.db
      .prepare(
        `SELECT request_fingerprint AS fingerprint,
      result_schema_version AS version, result_json AS result
      FROM party_character_command_receipt WHERE command_id = ?`
      )
      .get(input.commandId) as
      { fingerprint: string; version: number; result: string } | undefined
    if (!row) return null
    if (
      row.version !== 1 ||
      row.fingerprint !== fingerprintExcluding(input, ['commandId'])
    )
      throw new CapabilityError('idempotency_conflict', false)
    return partyCharacterCommandReceiptSchema.parse(
      JSON.parse(row.result) as unknown
    )
  }
  record(
    input: PartyCharacterCommand,
    result: PartyCharacterCommandReceipt
  ): void {
    this.db
      .prepare(
        `INSERT INTO party_character_command_receipt
      (command_id, request_fingerprint, result_schema_version, result_json) VALUES (?, ?, 1, ?)`
      )
      .run(
        input.commandId,
        fingerprintExcluding(input, ['commandId']),
        JSON.stringify(partyCharacterCommandReceiptSchema.parse(result))
      )
  }
}
