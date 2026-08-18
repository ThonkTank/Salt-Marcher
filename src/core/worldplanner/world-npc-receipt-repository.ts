import type Database from 'better-sqlite3'
import { z } from 'zod'
import { worldNpcCommandReceiptSchema } from '../../shared/contracts/world-npc.js'
import { CapabilityError } from '../../shared/errors/capability-error.js'
import { WORLD_NPC_RECEIPT_RETENTION_LIMIT } from './world-npc-persistence.js'

export class WorldNpcReceiptRepository {
  constructor(private readonly db: Database.Database) {}

  read(commandId: string) {
    const row = this.db
      .prepare(
        'SELECT result_json AS resultJson FROM worldplanner_npc_command_receipt WHERE command_id = ?'
      )
      .get(commandId) as { resultJson: string } | undefined
    return row
      ? worldNpcCommandReceiptSchema.parse(JSON.parse(row.resultJson))
      : null
  }

  write(
    commandId: string,
    operation: 'create' | 'update' | 'delete',
    request: unknown,
    result: unknown
  ): void {
    this.db
      .prepare(
        `INSERT INTO worldplanner_npc_command_receipt
         (command_id, operation, request_json, result_json) VALUES (?, ?, ?, ?)`
      )
      .run(
        commandId,
        operation,
        JSON.stringify(request),
        JSON.stringify(result)
      )
    this.db
      .prepare(
        `DELETE FROM worldplanner_npc_command_receipt
         WHERE command_id NOT IN (
           SELECT command_id FROM worldplanner_npc_command_receipt
           ORDER BY rowid DESC LIMIT ?
         )`
      )
      .run(WORLD_NPC_RECEIPT_RETENTION_LIMIT)
  }

  replay<Output>(
    commandId: string,
    operation: 'create' | 'update' | 'delete',
    request: unknown,
    schema: z.ZodType<Output>
  ): Output | null {
    const row = this.db
      .prepare(
        `SELECT operation, request_json AS requestJson, result_json AS resultJson
         FROM worldplanner_npc_command_receipt WHERE command_id = ?`
      )
      .get(commandId) as
      { operation: string; requestJson: string; resultJson: string } | undefined
    if (!row) return null
    if (
      row.operation !== operation ||
      row.requestJson !== JSON.stringify(request)
    )
      throw new CapabilityError('validation_failed', false)
    return schema.parse(JSON.parse(row.resultJson))
  }
}
