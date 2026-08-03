import Database from 'better-sqlite3'
import {
  encounterTableDraftSchema,
  encounterTableSnapshotSchema,
  type EncounterTableDraft,
  type EncounterTableSnapshot
} from '../../shared/contracts/encounter-source.js'
import { CapabilityError } from '../../shared/errors/capability-error.js'
import { uuidv7 } from '../../shared/ids/uuidv7.js'
import { creatureById } from '../creatures/catalog.js'

export function initializeEncounterTableSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS encounter_table_metadata (
      singleton INTEGER PRIMARY KEY NOT NULL CHECK(singleton = 1),
      revision INTEGER NOT NULL CHECK(revision >= 0)
    );
    CREATE TABLE IF NOT EXISTS encounter_table (
      id TEXT PRIMARY KEY NOT NULL,
      display_name TEXT NOT NULL,
      description TEXT NOT NULL,
      position INTEGER NOT NULL CHECK(position >= 0)
    );
    CREATE TABLE IF NOT EXISTS encounter_table_entry (
      encounter_table_id TEXT NOT NULL REFERENCES encounter_table(id) ON DELETE CASCADE,
      creature_id TEXT NOT NULL,
      weight INTEGER NOT NULL CHECK(weight BETWEEN 1 AND 10),
      position INTEGER NOT NULL CHECK(position >= 0),
      PRIMARY KEY (encounter_table_id, creature_id)
    );
    CREATE TABLE IF NOT EXISTS encounter_table_loot_link (
      encounter_table_id TEXT PRIMARY KEY NOT NULL REFERENCES encounter_table(id) ON DELETE CASCADE,
      loot_table_id TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_encounter_table_name
      ON encounter_table(display_name COLLATE NOCASE, id);
  `)
  db.prepare(
    'INSERT OR IGNORE INTO encounter_table_metadata (singleton, revision) VALUES (1, 0)'
  ).run()
}

export class EncounterTableStore {
  constructor(private readonly db: Database.Database) {}

  read(): EncounterTableSnapshot {
    const rows = this.db
      .prepare(
        'SELECT id, display_name AS displayName, description, position FROM encounter_table ORDER BY position, id'
      )
      .all() as {
      id: string
      displayName: string
      description: string
      position: number
    }[]
    const entries = this.db.prepare(
      'SELECT creature_id AS creatureId, weight, position FROM encounter_table_entry WHERE encounter_table_id = ? ORDER BY position, creature_id'
    )
    return encounterTableSnapshotSchema.parse({
      revision: this.revision(),
      tables: rows.map((row) => ({ ...row, entries: entries.all(row.id) }))
    })
  }

  contains(id: string): boolean {
    return (
      this.db.prepare('SELECT 1 FROM encounter_table WHERE id = ?').get(id) !==
      undefined
    )
  }

  containsCreature(id: string, creatureId: string): boolean {
    return (
      this.db
        .prepare(
          'SELECT 1 FROM encounter_table_entry WHERE encounter_table_id = ? AND creature_id = ?'
        )
        .get(id, creatureId) !== undefined
    )
  }

  create(
    draft: EncounterTableDraft,
    expectedRevision: number
  ): EncounterTableSnapshot {
    const parsed = encounterTableDraftSchema.parse(draft)
    this.mutate(expectedRevision, () => {
      this.assertCreatures(parsed.entries.map((entry) => entry.creatureId))
      const id = uuidv7()
      const position = (
        this.db
          .prepare(
            'SELECT COALESCE(MAX(position), -1) + 1 AS value FROM encounter_table'
          )
          .get() as { value: number }
      ).value
      this.db
        .prepare(
          'INSERT INTO encounter_table (id, display_name, description, position) VALUES (?, ?, ?, ?)'
        )
        .run(id, parsed.displayName, parsed.description, position)
      this.replaceEntries(id, parsed.entries)
    })
    return this.read()
  }

  update(
    id: string,
    draft: EncounterTableDraft,
    expectedRevision: number
  ): EncounterTableSnapshot {
    const parsed = encounterTableDraftSchema.parse(draft)
    this.mutate(expectedRevision, () => {
      this.assertCreatures(parsed.entries.map((entry) => entry.creatureId))
      const changed = this.db
        .prepare(
          'UPDATE encounter_table SET display_name = ?, description = ? WHERE id = ?'
        )
        .run(parsed.displayName, parsed.description, id).changes
      if (changed === 0) throw new CapabilityError('not_found', false)
      this.replaceEntries(id, parsed.entries)
    })
    return this.read()
  }

  delete(id: string, expectedRevision: number): EncounterTableSnapshot {
    this.mutate(expectedRevision, () => {
      const changed = this.db
        .prepare('DELETE FROM encounter_table WHERE id = ?')
        .run(id).changes
      if (changed === 0) throw new CapabilityError('not_found', false)
    })
    return this.read()
  }

  private replaceEntries(
    id: string,
    entries: readonly { creatureId: string; weight: number }[]
  ): void {
    this.db
      .prepare('DELETE FROM encounter_table_entry WHERE encounter_table_id = ?')
      .run(id)
    const insert = this.db.prepare(
      'INSERT INTO encounter_table_entry (encounter_table_id, creature_id, weight, position) VALUES (?, ?, ?, ?)'
    )
    entries.forEach((entry, position) =>
      insert.run(id, entry.creatureId, entry.weight, position)
    )
  }

  private assertCreatures(ids: readonly string[]): void {
    if (ids.some((id) => !creatureById(id)))
      throw new CapabilityError('not_found', false)
  }

  private revision(): number {
    return (
      this.db
        .prepare(
          'SELECT revision FROM encounter_table_metadata WHERE singleton = 1'
        )
        .get() as { revision: number }
    ).revision
  }

  private mutate(expectedRevision: number, operation: () => void): void {
    const mutation = () => {
      if (this.revision() !== expectedRevision)
        throw new CapabilityError('stale', true)
      operation()
      this.db
        .prepare(
          'UPDATE encounter_table_metadata SET revision = revision + 1 WHERE singleton = 1'
        )
        .run()
    }
    if (this.db.inTransaction) mutation()
    else this.db.transaction(mutation)()
  }
}
