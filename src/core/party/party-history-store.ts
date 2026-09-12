import { partyLootChangeSchema } from '../loot/party-loot-history-owner.js'
import type Database from 'better-sqlite3'
import { z } from 'zod'
import { partyHistoryChangeSchema } from './party-history-owner.js'
import { scenePartyHistorySchema } from '../scene/scene-party-history-owner.js'
import { partyCombatChangeSchema } from '../encounter/party-combat-history-owner.js'
import { partyTravelChangeSchema } from '../hex/party-travel-history-owner.js'
import { partyQuickFieldSchema } from '../../shared/contracts/party-quick-fields.js'
import { fingerprintExcluding } from '../fingerprint.js'
import { CapabilityError } from '../../shared/errors/capability-error.js'
export const preferenceChangeSchema = z
  .object({
    before: z.array(partyQuickFieldSchema),
    after: z.array(partyQuickFieldSchema)
  })
  .strict()
export const partyHistoryPayloadSchema = z
  .object({
    party: z.array(partyHistoryChangeSchema),
    scene: scenePartyHistorySchema,
    combat: z.array(partyCombatChangeSchema),
    travel: z.array(partyTravelChangeSchema),
    loot: z.array(partyLootChangeSchema),
    preferences: preferenceChangeSchema.nullable()
  })
  .strict()
export type PartyHistoryPayload = z.infer<typeof partyHistoryPayloadSchema>
export function initializePartyHistorySchema(db: Database.Database): void {
  db.exec(`CREATE TABLE IF NOT EXISTS party_action_history (
    sequence INTEGER PRIMARY KEY AUTOINCREMENT, id TEXT NOT NULL UNIQUE,
    installation_id TEXT NOT NULL, description TEXT NOT NULL,
    applied INTEGER NOT NULL CHECK(applied IN (0, 1)), payload_json TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS party_action_receipt (
    command_id TEXT PRIMARY KEY NOT NULL, installation_id TEXT NOT NULL,
    request_fingerprint TEXT NOT NULL, result_json TEXT NOT NULL,
    pending INTEGER NOT NULL CHECK(pending IN (0, 1)), preferences_json TEXT,
    sequence INTEGER NOT NULL
  );`)
}
export class PartyHistoryStore {
  constructor(
    private readonly db: Database.Database,
    private readonly installationId: string
  ) {}
  hasCommand(id: string): boolean {
    return !!this.db
      .prepare(
        'SELECT 1 FROM party_action_receipt WHERE command_id = ? AND installation_id = ?'
      )
      .get(id, this.installationId)
  }
  entries() {
    return (
      this.db
        .prepare(
          'SELECT sequence, id, description, applied, payload_json FROM party_action_history WHERE installation_id = ? ORDER BY sequence'
        )
        .all(this.installationId) as {
        sequence: number
        id: string
        description: string
        applied: number
        payload_json: string
      }[]
    ).map((row) => ({
      sequence: row.sequence,
      id: row.id,
      description: row.description,
      applied: row.applied === 1,
      payload: partyHistoryPayloadSchema.parse(JSON.parse(row.payload_json))
    }))
  }
  append(
    id: string,
    description: string,
    payload: PartyHistoryPayload
  ): number {
    this.db
      .prepare(
        'DELETE FROM party_action_history WHERE installation_id = ? AND applied = 0'
      )
      .run(this.installationId)
    const row = this.db
      .prepare(
        'INSERT INTO party_action_history (id, installation_id, description, applied, payload_json) VALUES (?, ?, ?, 1, ?)'
      )
      .run(
        id,
        this.installationId,
        description,
        JSON.stringify(partyHistoryPayloadSchema.parse(payload))
      )
    this.db
      .prepare(
        'DELETE FROM party_action_history WHERE installation_id = ? AND sequence NOT IN (SELECT sequence FROM party_action_history WHERE installation_id = ? ORDER BY sequence DESC LIMIT 100)'
      )
      .run(this.installationId, this.installationId)
    return Number(row.lastInsertRowid)
  }
  mark(id: string, applied: boolean) {
    this.db
      .prepare(
        'UPDATE party_action_history SET applied = ? WHERE id = ? AND installation_id = ?'
      )
      .run(Number(applied), id, this.installationId)
  }
  receipt(input: { commandId: string }): unknown {
    const row = this.db
      .prepare(
        'SELECT request_fingerprint, result_json FROM party_action_receipt WHERE command_id = ? AND installation_id = ?'
      )
      .get(input.commandId, this.installationId) as
      { request_fingerprint: string; result_json: string } | undefined
    if (!row) return null
    if (row.request_fingerprint !== fingerprintExcluding(input, ['commandId']))
      throw new CapabilityError('idempotency_conflict', false)
    return JSON.parse(row.result_json)
  }
  record(
    input: { commandId: string },
    result: unknown,
    sequence: number,
    preferences: z.infer<typeof preferenceChangeSchema> | null = null
  ) {
    this.db
      .prepare(
        'INSERT INTO party_action_receipt (command_id, installation_id, request_fingerprint, result_json, pending, preferences_json, sequence) VALUES (?, ?, ?, ?, 1, ?, ?)'
      )
      .run(
        input.commandId,
        this.installationId,
        fingerprintExcluding(input, ['commandId']),
        JSON.stringify(result),
        preferences ? JSON.stringify(preferences) : null,
        sequence
      )
  }
  pending() {
    return (
      this.db
        .prepare(
          'SELECT command_id, sequence, preferences_json FROM party_action_receipt WHERE installation_id = ? AND pending = 1 ORDER BY rowid'
        )
        .all(this.installationId) as {
        command_id: string
        sequence: number
        preferences_json: string | null
      }[]
    ).map((row) => ({
      id: row.command_id,
      sequence: row.sequence,
      preferences: row.preferences_json
        ? preferenceChangeSchema.parse(JSON.parse(row.preferences_json))
        : null
    }))
  }
  complete(id: string) {
    this.db
      .prepare(
        'UPDATE party_action_receipt SET pending = 0 WHERE command_id = ? AND installation_id = ?'
      )
      .run(id, this.installationId)
  }
}

/** Called on the staged replacement, so a rolled-back import keeps its original history. */
export function invalidatePartyHistoryForReplacement(
  db: Database.Database
): void {
  db.prepare('DELETE FROM party_action_history').run()
  db.prepare('UPDATE party_action_receipt SET pending = 0').run()
}
