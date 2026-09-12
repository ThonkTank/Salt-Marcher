import type Database from 'better-sqlite3'
import { z } from 'zod'
import { uuidv7 } from '../../shared/ids/uuidv7.js'
const value = z
  .object({
    quantity: z.number().int().positive(),
    status: z.enum(['received', 'given_away', 'sold'])
  })
  .strict()
export const partyLootChangeSchema = z
  .object({
    entryId: z.string(),
    characterId: z.string(),
    before: value,
    after: value
  })
  .strict()
export type PartyLootChange = z.infer<typeof partyLootChangeSchema>
export class PartyLootHistoryOwner {
  constructor(
    private readonly db: Database.Database,
    private readonly isHistoryCommand: (id: string) => boolean
  ) {}
  changes(commandId: string): PartyLootChange[] {
    return (
      this.db
        .prepare(
          `SELECT correction.id, correction.character_id, correction.quantity, correction.status,
      original.quantity AS before_quantity, original.status AS before_status
      FROM character_loot_entry correction JOIN character_loot_entry original ON original.id = correction.corrects_entry_id
      WHERE correction.command_id = ?`
        )
        .all(commandId) as {
        id: string
        character_id: string
        quantity: number
        status: string
        before_quantity: number
        before_status: string
      }[]
    ).map((row) =>
      partyLootChangeSchema.parse({
        entryId: row.id,
        characterId: row.character_id,
        before: { quantity: row.before_quantity, status: row.before_status },
        after: { quantity: row.quantity, status: row.status }
      })
    )
  }
  private leaf(entryId: string) {
    return this.db
      .prepare(
        `WITH RECURSIVE chain AS (
      SELECT id, quantity, status, command_id, 0 AS depth FROM character_loot_entry WHERE id = ?
      UNION ALL SELECT e.id, e.quantity, e.status, e.command_id, chain.depth + 1 FROM character_loot_entry e JOIN chain ON e.corrects_entry_id = chain.id
    ) SELECT * FROM chain ORDER BY depth`
      )
      .all(entryId) as {
      id: string
      quantity: number
      status: string
      command_id: string
      depth: number
    }[]
  }
  conflict(changes: readonly PartyLootChange[], undo: boolean): string | null {
    for (const change of changes) {
      const chain = this.leaf(change.entryId)
      const last = chain.at(-1)
      const expected = undo ? change.after : change.before
      if (
        !last ||
        last.quantity !== expected.quantity ||
        last.status !== expected.status ||
        chain.slice(1).some((row) => !this.isHistoryCommand(row.command_id))
      )
        return 'Der Loot-Eintrag wurde später korrigiert.'
    }
    return null
  }
  restore(
    changes: readonly PartyLootChange[],
    undo: boolean,
    commandId: string
  ): void {
    for (const change of changes) {
      const next = undo ? change.before : change.after
      const last = this.leaf(change.entryId).at(-1)!
      this.db
        .prepare(
          `INSERT INTO character_loot_entry (id, command_id, character_id, treasure_id, treasure_item_id, source, item_reference_json, quantity, status, provenance_kind, provenance_treasure_label, provenance_recipient_name, source_run_id, generated_treasure_id, reward_channel, corrects_entry_id, correction_reason, received_at)
        SELECT ?, ?, character_id, treasure_id, treasure_item_id, 'correction', item_reference_json, ?, ?, provenance_kind, provenance_treasure_label, provenance_recipient_name, source_run_id, generated_treasure_id, reward_channel, id, ?, ? FROM character_loot_entry WHERE id = ?`
        )
        .run(
          uuidv7(),
          commandId,
          next.quantity,
          next.status,
          undo ? 'Party: Rückgängig' : 'Party: Wiederherstellen',
          new Date().toISOString(),
          last.id
        )
      this.db
        .prepare(
          'UPDATE character_loot_ledger_metadata SET revision = revision + 1 WHERE character_id = ?'
        )
        .run(change.characterId)
    }
  }
}
