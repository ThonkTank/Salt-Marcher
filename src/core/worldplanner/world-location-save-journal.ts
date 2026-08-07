import Database from 'better-sqlite3'
import {
  worldLocationSaveReceiptSchema,
  type SaveWorldLocationInput,
  type WorldLocationMutationReceipt,
  type WorldLocationSaveReceipt
} from '../../shared/contracts/world-location.js'
import { CapabilityError } from '../../shared/errors/capability-error.js'

/** Durable command journal owned by the World Planner location aggregate. */
export function initializeWorldLocationSaveJournalSchema(
  db: Database.Database
): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS worldplanner_location_save_operation (
      command_id TEXT PRIMARY KEY NOT NULL,
      request_json TEXT NOT NULL,
      receipt_json TEXT NOT NULL
    );
  `)
}

export class WorldLocationSaveJournal {
  constructor(private readonly db: Database.Database) {}

  begin(
    input: SaveWorldLocationInput,
    saveBase: () => WorldLocationMutationReceipt
  ): WorldLocationSaveReceipt {
    const requestJson = JSON.stringify(input)
    const existing = this.db
      .prepare(
        `SELECT request_json AS requestJson, receipt_json AS receiptJson
         FROM worldplanner_location_save_operation WHERE command_id = ?`
      )
      .get(input.commandId) as
      { requestJson: string; receiptJson: string } | undefined
    if (existing) {
      if (existing.requestJson !== requestJson)
        throw new CapabilityError('validation_failed', false)
      return worldLocationSaveReceiptSchema.parse(
        JSON.parse(existing.receiptJson)
      )
    }

    return this.transact(() => {
      const base = saveBase()
      const receipt = worldLocationSaveReceiptSchema.parse({
        status: 'partially-saved',
        commandId: input.commandId,
        snapshot: base.snapshot,
        saved: base.saved,
        placementFailure: {
          kind: 'unavailable',
          detail: 'placement_pending'
        }
      })
      this.db
        .prepare(
          `INSERT INTO worldplanner_location_save_operation
           (command_id, request_json, receipt_json) VALUES (?, ?, ?)`
        )
        .run(input.commandId, requestJson, JSON.stringify(receipt))
      return receipt
    })
  }

  complete(
    commandId: string,
    rawReceipt: WorldLocationSaveReceipt
  ): WorldLocationSaveReceipt {
    const receipt = worldLocationSaveReceiptSchema.parse(rawReceipt)
    if (receipt.commandId !== commandId)
      throw new CapabilityError('validation_failed', false)
    this.transact(() => {
      const updated = this.db
        .prepare(
          `UPDATE worldplanner_location_save_operation SET receipt_json = ?
           WHERE command_id = ?`
        )
        .run(JSON.stringify(receipt), commandId).changes
      if (updated !== 1)
        throw new Error('World Location save journal entry is missing.')
    })
    return receipt
  }

  receipt(commandId: string): WorldLocationSaveReceipt | null {
    const row = this.db
      .prepare(
        `SELECT receipt_json AS receiptJson
         FROM worldplanner_location_save_operation WHERE command_id = ?`
      )
      .get(commandId) as { receiptJson: string } | undefined
    return row
      ? worldLocationSaveReceiptSchema.parse(JSON.parse(row.receiptJson))
      : null
  }

  private transact<Output>(work: () => Output): Output {
    return this.db.inTransaction ? work() : this.db.transaction(work)()
  }
}
