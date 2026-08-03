import Database from 'better-sqlite3'
import {
  worldFactionDraftSchema,
  worldFactionSnapshotSchema,
  type WorldFactionDraft,
  type WorldFactionSnapshot
} from '../../shared/contracts/encounter-source.js'
import { CapabilityError } from '../../shared/errors/capability-error.js'
import { uuidv7 } from '../../shared/ids/uuidv7.js'
import { creatureById } from '../creatures/catalog.js'

export interface EncounterTableReferences {
  containsTable(id: string): boolean
  containsCreature(tableId: string, creatureId: string): boolean
}

export function initializeWorldFactionSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS worldplanner_faction_metadata (
      singleton INTEGER PRIMARY KEY NOT NULL CHECK(singleton = 1),
      revision INTEGER NOT NULL CHECK(revision >= 0)
    );
    CREATE TABLE IF NOT EXISTS worldplanner_faction (
      id TEXT PRIMARY KEY NOT NULL,
      display_name TEXT NOT NULL,
      notes TEXT NOT NULL,
      disposition INTEGER NOT NULL CHECK(disposition BETWEEN -50 AND 50),
      primary_encounter_table_id TEXT,
      position INTEGER NOT NULL CHECK(position >= 0)
    );
    CREATE TABLE IF NOT EXISTS worldplanner_faction_inventory (
      faction_id TEXT NOT NULL REFERENCES worldplanner_faction(id) ON DELETE CASCADE,
      creature_id TEXT NOT NULL,
      maximum INTEGER NOT NULL CHECK(maximum >= 0),
      PRIMARY KEY (faction_id, creature_id)
    );
    CREATE INDEX IF NOT EXISTS idx_worldplanner_faction_name
      ON worldplanner_faction(display_name COLLATE NOCASE, id);
  `)
  db.prepare(
    'INSERT OR IGNORE INTO worldplanner_faction_metadata (singleton, revision) VALUES (1, 0)'
  ).run()
}

export class WorldFactionStore {
  constructor(
    private readonly db: Database.Database,
    private readonly encounterTables: EncounterTableReferences
  ) {}

  contains(id: string): boolean {
    return (
      this.db
        .prepare('SELECT 1 FROM worldplanner_faction WHERE id = ?')
        .get(id) !== undefined
    )
  }

  read(): WorldFactionSnapshot {
    const rows = this.db
      .prepare(
        `SELECT id, display_name AS displayName, notes, disposition,
          primary_encounter_table_id AS primaryEncounterTableId, position
         FROM worldplanner_faction ORDER BY position, id`
      )
      .all() as {
      id: string
      displayName: string
      notes: string
      disposition: number
      primaryEncounterTableId: string | null
      position: number
    }[]
    const inventory = this.db.prepare(
      `SELECT creature_id AS creatureId, maximum
       FROM worldplanner_faction_inventory
       WHERE faction_id = ? ORDER BY creature_id`
    )
    return worldFactionSnapshotSchema.parse({
      revision: this.revision(),
      factions: rows.map((row) => ({
        ...row,
        inventory: inventory.all(row.id)
      }))
    })
  }

  create(
    draft: WorldFactionDraft,
    expectedRevision: number
  ): WorldFactionSnapshot {
    const parsed = worldFactionDraftSchema.parse(draft)
    this.mutate(expectedRevision, () => {
      this.assertReferences(parsed)
      const position = (
        this.db
          .prepare(
            'SELECT COALESCE(MAX(position), -1) + 1 AS value FROM worldplanner_faction'
          )
          .get() as { value: number }
      ).value
      const id = uuidv7()
      this.db
        .prepare(
          `INSERT INTO worldplanner_faction
           (id, display_name, notes, disposition, primary_encounter_table_id, position)
           VALUES (?, ?, ?, ?, ?, ?)`
        )
        .run(
          id,
          parsed.displayName,
          parsed.notes,
          parsed.disposition,
          parsed.primaryEncounterTableId,
          position
        )
      this.replaceInventory(id, parsed.inventory)
    })
    return this.read()
  }

  update(
    id: string,
    draft: WorldFactionDraft,
    expectedRevision: number
  ): WorldFactionSnapshot {
    const parsed = worldFactionDraftSchema.parse(draft)
    this.mutate(expectedRevision, () => {
      this.assertReferences(parsed)
      const changed = this.db
        .prepare(
          `UPDATE worldplanner_faction SET display_name = ?, notes = ?, disposition = ?,
           primary_encounter_table_id = ? WHERE id = ?`
        )
        .run(
          parsed.displayName,
          parsed.notes,
          parsed.disposition,
          parsed.primaryEncounterTableId,
          id
        ).changes
      if (changed === 0) throw new CapabilityError('not_found', false)
      this.replaceInventory(id, parsed.inventory)
    })
    return this.read()
  }

  delete(id: string, expectedRevision: number): WorldFactionSnapshot {
    this.mutate(expectedRevision, () => {
      const changed = this.db
        .prepare('DELETE FROM worldplanner_faction WHERE id = ?')
        .run(id).changes
      if (changed === 0) throw new CapabilityError('not_found', false)
    })
    return this.read()
  }

  clearPrimaryEncounterTable(encounterTableId: string): void {
    const factionIds = (
      this.db
        .prepare(
          'SELECT id FROM worldplanner_faction WHERE primary_encounter_table_id = ?'
        )
        .all(encounterTableId) as { id: string }[]
    ).map((row) => row.id)
    const changes = this.db
      .prepare(
        'UPDATE worldplanner_faction SET primary_encounter_table_id = NULL WHERE primary_encounter_table_id = ?'
      )
      .run(encounterTableId).changes
    if (changes === 0) return
    const removeInventory = this.db.prepare(
      'DELETE FROM worldplanner_faction_inventory WHERE faction_id = ?'
    )
    factionIds.forEach((id) => removeInventory.run(id))
    this.bumpRevision()
  }

  pruneInventoryForTable(
    encounterTableId: string,
    allowedCreatureIds: readonly string[]
  ): void {
    const factionIds = (
      this.db
        .prepare(
          'SELECT id FROM worldplanner_faction WHERE primary_encounter_table_id = ?'
        )
        .all(encounterTableId) as { id: string }[]
    ).map((row) => row.id)
    if (factionIds.length === 0) return
    const remove = this.db.prepare(
      'DELETE FROM worldplanner_faction_inventory WHERE faction_id = ? AND creature_id = ?'
    )
    let changed = 0
    for (const faction of this.read().factions.filter((item) =>
      factionIds.includes(item.id)
    ))
      for (const entry of faction.inventory)
        if (!allowedCreatureIds.includes(entry.creatureId))
          changed += remove.run(faction.id, entry.creatureId).changes
    if (changed > 0) this.bumpRevision()
  }

  private assertReferences(draft: WorldFactionDraft): void {
    if (draft.primaryEncounterTableId === null) {
      if (draft.inventory.length > 0)
        throw new CapabilityError('validation_failed', false)
      return
    }
    if (!this.encounterTables.containsTable(draft.primaryEncounterTableId))
      throw new CapabilityError('not_found', false)
    if (draft.inventory.some((entry) => !creatureById(entry.creatureId)))
      throw new CapabilityError('not_found', false)
    if (
      draft.inventory.some(
        (entry) =>
          !this.encounterTables.containsCreature(
            draft.primaryEncounterTableId!,
            entry.creatureId
          )
      )
    )
      throw new CapabilityError('validation_failed', false)
  }

  private replaceInventory(
    id: string,
    inventory: readonly { creatureId: string; maximum: number }[]
  ): void {
    this.db
      .prepare(
        'DELETE FROM worldplanner_faction_inventory WHERE faction_id = ?'
      )
      .run(id)
    const insert = this.db.prepare(
      'INSERT INTO worldplanner_faction_inventory (faction_id, creature_id, maximum) VALUES (?, ?, ?)'
    )
    inventory.forEach((entry) =>
      insert.run(id, entry.creatureId, entry.maximum)
    )
  }

  private revision(): number {
    return (
      this.db
        .prepare(
          'SELECT revision FROM worldplanner_faction_metadata WHERE singleton = 1'
        )
        .get() as { revision: number }
    ).revision
  }

  private mutate(expectedRevision: number, operation: () => void): void {
    const mutation = () => {
      if (this.revision() !== expectedRevision)
        throw new CapabilityError('stale', true)
      operation()
      this.bumpRevision()
    }
    if (this.db.inTransaction) mutation()
    else this.db.transaction(mutation)()
  }

  private bumpRevision(): void {
    this.db
      .prepare(
        'UPDATE worldplanner_faction_metadata SET revision = revision + 1 WHERE singleton = 1'
      )
      .run()
  }
}
