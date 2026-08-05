import type Database from 'better-sqlite3'
import {
  hexBrushStrokeResultSchema,
  hexHistoryStateSchema,
  type HexBrushStrokeResult
} from '../../shared/contracts/hex.js'
import type { HexMapTruthCell } from './hex-map-store.js'

export type HexHistoryDirection = 'undo' | 'redo'

export type HexHistoryStep = Readonly<{
  sequence: number
  before: readonly HexMapTruthCell[]
  after: readonly HexMapTruthCell[]
}>

/** Owns Hex edit-history and idempotency SQL; application handlers see a port. */
export class HexEditJournalStore {
  constructor(private readonly db: Database.Database) {}

  history(mapId: string) {
    const cursor = this.cursor(mapId)
    const undo = this.db
      .prepare(
        `SELECT label_code AS labelCode FROM hex_edit_history
         WHERE map_id = ? AND sequence <= ?
         ORDER BY sequence DESC LIMIT 1`
      )
      .get(mapId, cursor) as { labelCode: string } | undefined
    const redo = this.db
      .prepare(
        `SELECT label_code AS labelCode FROM hex_edit_history
         WHERE map_id = ? AND sequence > ?
         ORDER BY sequence ASC LIMIT 1`
      )
      .get(mapId, cursor) as { labelCode: string } | undefined
    return hexHistoryStateSchema.parse({
      canUndo: undo !== undefined,
      canRedo: redo !== undefined,
      undoLabel: undo?.labelCode ?? null,
      redoLabel: redo?.labelCode ?? null
    })
  }

  step(mapId: string, direction: HexHistoryDirection): HexHistoryStep | null {
    const row = this.db
      .prepare(
        `SELECT sequence, before_json AS beforeJson, after_json AS afterJson
         FROM hex_edit_history WHERE map_id = ? AND sequence
           ${direction === 'undo' ? '<=' : '>'} ?
         ORDER BY sequence ${direction === 'undo' ? 'DESC' : 'ASC'} LIMIT 1`
      )
      .get(mapId, this.cursor(mapId)) as
      { sequence: number; beforeJson: string; afterJson: string } | undefined
    return row
      ? {
          sequence: row.sequence,
          before: JSON.parse(row.beforeJson) as HexMapTruthCell[],
          after: JSON.parse(row.afterJson) as HexMapTruthCell[]
        }
      : null
  }

  advance(mapId: string, sequence: number, direction: HexHistoryDirection) {
    const nextCursor =
      direction === 'redo'
        ? sequence
        : (
            this.db
              .prepare(
                `SELECT COALESCE(MAX(sequence), 0) AS value
               FROM hex_edit_history WHERE map_id = ? AND sequence < ?`
              )
              .get(mapId, sequence) as { value: number }
          ).value
    this.setCursor(mapId, nextCursor)
  }

  record(
    mapId: string,
    commandId: string,
    labelCode: string,
    before: readonly HexMapTruthCell[],
    after: readonly HexMapTruthCell[]
  ) {
    const cursor = this.cursor(mapId)
    this.db
      .prepare('DELETE FROM hex_edit_history WHERE map_id = ? AND sequence > ?')
      .run(mapId, cursor)
    const sequence = (
      this.db
        .prepare(
          `SELECT COALESCE(MAX(sequence), 0) + 1 AS value
           FROM hex_edit_history WHERE map_id = ?`
        )
        .get(mapId) as { value: number }
    ).value
    this.db
      .prepare(
        `INSERT INTO hex_edit_history
         (map_id, sequence, command_id, label_code, before_json, after_json)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(
        mapId,
        sequence,
        commandId,
        labelCode,
        JSON.stringify(before),
        JSON.stringify(after)
      )
    this.setCursor(mapId, sequence)
    this.db
      .prepare(
        `DELETE FROM hex_edit_history WHERE map_id = ? AND sequence NOT IN
         (SELECT sequence FROM hex_edit_history WHERE map_id = ?
          ORDER BY sequence DESC LIMIT 20)`
      )
      .run(mapId, mapId)
  }

  receipt(commandId: string): HexBrushStrokeResult | null {
    const row = this.db
      .prepare(
        'SELECT result_json AS resultJson FROM hex_command_receipt WHERE command_id = ?'
      )
      .get(commandId) as { resultJson: string } | undefined
    return row
      ? hexBrushStrokeResultSchema.parse(JSON.parse(row.resultJson) as unknown)
      : null
  }

  storeReceipt(commandId: string, mapId: string, result: unknown) {
    this.db
      .prepare(
        `INSERT INTO hex_command_receipt
         (command_id, map_id, result_json, created_at) VALUES (?, ?, ?, ?)`
      )
      .run(commandId, mapId, JSON.stringify(result), Date.now())
    this.db
      .prepare(
        `DELETE FROM hex_command_receipt WHERE command_id NOT IN
         (SELECT command_id FROM hex_command_receipt
          ORDER BY created_at DESC LIMIT 512)`
      )
      .run()
  }

  removeLocationReferences(locationId: string): void {
    const rows = this.db
      .prepare(
        `SELECT map_id AS mapId, sequence,
                before_json AS beforeJson, after_json AS afterJson
         FROM hex_edit_history`
      )
      .all() as Array<{
      mapId: string
      sequence: number
      beforeJson: string
      afterJson: string
    }>
    const clean = (json: string) =>
      JSON.stringify(
        (JSON.parse(json) as HexMapTruthCell[]).map((cell) =>
          cell.locationId === locationId ? { ...cell, locationId: null } : cell
        )
      )
    const update = this.db.prepare(
      `UPDATE hex_edit_history SET before_json = ?, after_json = ?
       WHERE map_id = ? AND sequence = ?`
    )
    for (const row of rows)
      update.run(
        clean(row.beforeJson),
        clean(row.afterJson),
        row.mapId,
        row.sequence
      )
  }

  private cursor(mapId: string): number {
    return (
      (
        this.db
          .prepare(
            `SELECT cursor_sequence AS cursorSequence
           FROM hex_edit_history_cursor WHERE map_id = ?`
          )
          .get(mapId) as { cursorSequence: number } | undefined
      )?.cursorSequence ?? 0
    )
  }

  private setCursor(mapId: string, sequence: number): void {
    this.db
      .prepare(
        `INSERT INTO hex_edit_history_cursor (map_id, cursor_sequence)
         VALUES (?, ?)
         ON CONFLICT(map_id) DO UPDATE SET
           cursor_sequence = excluded.cursor_sequence`
      )
      .run(mapId, sequence)
  }
}
