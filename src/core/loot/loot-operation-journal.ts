import type Database from 'better-sqlite3'
import type { z } from 'zod'
import { CapabilityError } from '../../shared/errors/capability-error.js'

export type LootOperationType =
  | 'create'
  | 'update'
  | 'move'
  | 'accept_generated'
  | 'commit_group_reward'
  | 'distribute'
  | 'correct_ledger'

export class LootOperationJournal {
  constructor(private readonly db: Database.Database) {}

  read<T>(input: {
    commandId: string
    operationType: LootOperationType
    requestFingerprint: string
    targetId?: string
    schema: z.ZodType<T>
  }): Readonly<{ targetId: string; result: T }> | null {
    const row = this.db
      .prepare(
        `SELECT operation_type AS operationType,
                request_fingerprint AS requestFingerprint,
                target_id AS targetId, result_schema_version AS schemaVersion,
                result_json AS resultJson
           FROM loot_operation_receipt WHERE command_id = ?`
      )
      .get(input.commandId) as
      | {
          operationType: string
          requestFingerprint: string
          targetId: string
          schemaVersion: number
          resultJson: string
        }
      | undefined
    if (!row) return null
    if (
      row.operationType !== input.operationType ||
      row.requestFingerprint !== input.requestFingerprint ||
      row.schemaVersion !== 1 ||
      (input.targetId !== undefined && row.targetId !== input.targetId)
    )
      throw new CapabilityError('idempotency_conflict', false)
    return {
      targetId: row.targetId,
      result: input.schema.parse(JSON.parse(row.resultJson) as unknown)
    }
  }

  record<T>(input: {
    commandId: string
    operationType: LootOperationType
    requestFingerprint: string
    targetId: string
    schema: z.ZodType<T>
    result: T
  }): void {
    this.db
      .prepare(
        `INSERT INTO loot_operation_receipt (
           command_id, operation_type, request_fingerprint, target_id,
           result_schema_version, result_json
         ) VALUES (?, ?, ?, ?, 1, ?)`
      )
      .run(
        input.commandId,
        input.operationType,
        input.requestFingerprint,
        input.targetId,
        JSON.stringify(input.schema.parse(input.result))
      )
  }

  has(commandId: string): boolean {
    return Boolean(
      this.db
        .prepare(
          'SELECT 1 AS present FROM loot_operation_receipt WHERE command_id = ?'
        )
        .get(commandId)
    )
  }
}
