import Database from 'better-sqlite3'
import { CapabilityError } from '../../shared/errors/capability-error.js'
import {
  worldLocationDraftSchema,
  worldLocationSnapshotSchema,
  type WorldLocationDraft,
  type WorldLocationSnapshot
} from '../../shared/contracts/world-location.js'
import { uuidv7 } from '../../shared/ids/uuidv7.js'
import { EncounterTableStore } from '../encounter/encounter-table-store.js'
import { WorldFactionStore } from './faction-store.js'

export interface WorldLocationReferences {
  containsFaction(id: string): boolean
  containsEncounterTable(id: string): boolean
}

const noReferences: WorldLocationReferences = {
  containsFaction: () => false,
  containsEncounterTable: () => false
}

export function initializeWorldLocationSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS worldplanner_location_metadata (
      singleton INTEGER PRIMARY KEY NOT NULL CHECK(singleton = 1),
      revision INTEGER NOT NULL CHECK(revision >= 0)
    );
    CREATE TABLE IF NOT EXISTS worldplanner_location (
      id TEXT PRIMARY KEY NOT NULL,
      display_name TEXT NOT NULL,
      notes TEXT NOT NULL,
      position INTEGER NOT NULL CHECK(position >= 0)
    );
    CREATE INDEX IF NOT EXISTS idx_worldplanner_location_name
      ON worldplanner_location(display_name COLLATE NOCASE, id);
    CREATE TABLE IF NOT EXISTS worldplanner_location_faction (
      location_id TEXT NOT NULL,
      faction_id TEXT NOT NULL,
      position INTEGER NOT NULL CHECK(position >= 0),
      PRIMARY KEY (location_id, faction_id)
    );
    CREATE TABLE IF NOT EXISTS worldplanner_location_encounter_table (
      location_id TEXT NOT NULL,
      encounter_table_id TEXT NOT NULL,
      position INTEGER NOT NULL CHECK(position >= 0),
      PRIMARY KEY (location_id, encounter_table_id)
    );
  `)
  db.prepare(
    'INSERT OR IGNORE INTO worldplanner_location_metadata (singleton, revision) VALUES (1, 0)'
  ).run()
}

export class WorldLocationStore {
  constructor(
    private readonly db: Database.Database,
    private readonly knownReferences: WorldLocationReferences = noReferences
  ) {}

  exists(id: string): boolean {
    return (
      this.db
        .prepare('SELECT 1 FROM worldplanner_location WHERE id = ?')
        .get(id) !== undefined
    )
  }

  displayName(id: string): string | null {
    const row = this.db
      .prepare(
        'SELECT display_name AS displayName FROM worldplanner_location WHERE id = ?'
      )
      .get(id) as { displayName: string } | undefined
    return row?.displayName ?? null
  }

  displayNames(ids: readonly string[]): ReadonlyMap<string, string> {
    if (ids.length === 0) return new Map()
    const rows = this.db
      .prepare(
        `SELECT id, display_name AS displayName
         FROM worldplanner_location
         WHERE id IN (SELECT value FROM json_each(?))`
      )
      .all(JSON.stringify(ids)) as Array<{ id: string; displayName: string }>
    return new Map(rows.map((row) => [row.id, row.displayName]))
  }

  read(): WorldLocationSnapshot {
    const metadata = this.db
      .prepare(
        'SELECT revision FROM worldplanner_location_metadata WHERE singleton = 1'
      )
      .get() as { revision: number }
    const locations = this.db
      .prepare(
        `
        SELECT id, display_name AS displayName, notes, position
        FROM worldplanner_location ORDER BY position, id
      `
      )
      .all()
      .map((location) => ({
        ...(location as object),
        factionIds: this.references(
          'worldplanner_location_faction',
          'faction_id',
          (location as { id: string }).id
        ),
        encounterTableIds: this.references(
          'worldplanner_location_encounter_table',
          'encounter_table_id',
          (location as { id: string }).id
        )
      }))
    return worldLocationSnapshotSchema.parse({
      revision: metadata.revision,
      locations
    })
  }

  create(
    draft: WorldLocationDraft,
    expectedRevision: number
  ): WorldLocationSnapshot {
    const parsed = worldLocationDraftSchema.parse(draft)
    this.mutate(expectedRevision, () => {
      const position = (
        this.db
          .prepare(
            'SELECT COALESCE(MAX(position), -1) + 1 AS value FROM worldplanner_location'
          )
          .get() as { value: number }
      ).value
      const id = uuidv7()
      this.db
        .prepare(
          'INSERT INTO worldplanner_location (id, display_name, notes, position) VALUES (?, ?, ?, ?)'
        )
        .run(id, parsed.displayName, parsed.notes, position)
      this.replaceReferences(id, parsed.factionIds, parsed.encounterTableIds)
    })
    return this.read()
  }

  update(
    id: string,
    draft: WorldLocationDraft,
    expectedRevision: number
  ): WorldLocationSnapshot {
    const parsed = worldLocationDraftSchema.parse(draft)
    this.mutate(expectedRevision, () => {
      const changed = this.db
        .prepare(
          'UPDATE worldplanner_location SET display_name = ?, notes = ? WHERE id = ?'
        )
        .run(parsed.displayName, parsed.notes, id).changes
      if (changed === 0) throw new CapabilityError('not_found', false)
      this.replaceReferences(id, parsed.factionIds, parsed.encounterTableIds)
    })
    return this.read()
  }

  delete(id: string, expectedRevision: number): WorldLocationSnapshot {
    this.mutate(expectedRevision, () => {
      if (
        this.db
          .prepare('DELETE FROM worldplanner_location WHERE id = ?')
          .run(id).changes === 0
      )
        throw new CapabilityError('not_found', false)
      this.db
        .prepare(
          'DELETE FROM worldplanner_location_faction WHERE location_id = ?'
        )
        .run(id)
      this.db
        .prepare(
          'DELETE FROM worldplanner_location_encounter_table WHERE location_id = ?'
        )
        .run(id)
    })
    return this.read()
  }

  unlinkFaction(factionId: string): void {
    const changes = this.db
      .prepare('DELETE FROM worldplanner_location_faction WHERE faction_id = ?')
      .run(factionId).changes
    if (changes > 0) this.bumpRevision()
  }

  unlinkEncounterTable(encounterTableId: string): void {
    const changes = this.db
      .prepare(
        'DELETE FROM worldplanner_location_encounter_table WHERE encounter_table_id = ?'
      )
      .run(encounterTableId).changes
    if (changes > 0) this.bumpRevision()
  }

  private references(
    table: string,
    column: string,
    locationId: string
  ): string[] {
    return (
      this.db
        .prepare(
          `SELECT ${column} AS id FROM ${table} WHERE location_id = ? ORDER BY position, ${column}`
        )
        .all(locationId) as { id: string }[]
    ).map((row) => row.id)
  }

  private replaceReferences(
    locationId: string,
    factionIds: readonly string[],
    encounterTableIds: readonly string[]
  ): void {
    if (factionIds.some((id) => !this.knownReferences.containsFaction(id)))
      throw new CapabilityError('not_found', false)
    if (
      encounterTableIds.some(
        (id) => !this.knownReferences.containsEncounterTable(id)
      )
    )
      throw new CapabilityError('not_found', false)
    this.db
      .prepare(
        'DELETE FROM worldplanner_location_faction WHERE location_id = ?'
      )
      .run(locationId)
    this.db
      .prepare(
        'DELETE FROM worldplanner_location_encounter_table WHERE location_id = ?'
      )
      .run(locationId)
    const faction = this.db.prepare(
      'INSERT INTO worldplanner_location_faction (location_id, faction_id, position) VALUES (?, ?, ?)'
    )
    const table = this.db.prepare(
      'INSERT INTO worldplanner_location_encounter_table (location_id, encounter_table_id, position) VALUES (?, ?, ?)'
    )
    Array.from(new Set(factionIds)).forEach((id, position) =>
      faction.run(locationId, id, position)
    )
    Array.from(new Set(encounterTableIds)).forEach((id, position) =>
      table.run(locationId, id, position)
    )
  }

  private mutate(expectedRevision: number, operation: () => void): void {
    const mutation = () => {
      const current = (
        this.db
          .prepare(
            'SELECT revision FROM worldplanner_location_metadata WHERE singleton = 1'
          )
          .get() as { revision: number }
      ).revision
      if (current !== expectedRevision) throw new CapabilityError('stale', true)
      operation()
      this.bumpRevision()
    }
    if (this.db.inTransaction) mutation()
    else this.db.transaction(mutation)()
  }

  private bumpRevision(): void {
    this.db
      .prepare(
        'UPDATE worldplanner_location_metadata SET revision = revision + 1 WHERE singleton = 1'
      )
      .run()
  }
}

export class WorldLocationService {
  constructor(private readonly campaignDatabase: () => Database.Database) {}

  read(): WorldLocationSnapshot {
    return this.withStore((store) => store.read())
  }

  create(draft: WorldLocationDraft, expectedRevision: number) {
    return this.withStore((store) => store.create(draft, expectedRevision))
  }

  update(id: string, draft: WorldLocationDraft, expectedRevision: number) {
    return this.withStore((store) => store.update(id, draft, expectedRevision))
  }

  delete(id: string, expectedRevision: number) {
    return this.withStore((store) => store.delete(id, expectedRevision))
  }

  private withStore<T>(work: (store: WorldLocationStore) => T): T {
    const db = this.campaignDatabase()
    const tables = new EncounterTableStore(db)
    const factions = new WorldFactionStore(db, {
      containsTable: (id) => tables.contains(id),
      containsCreature: (tableId, creatureId) =>
        tables.containsCreature(tableId, creatureId)
    })
    return work(
      new WorldLocationStore(db, {
        containsFaction: (id) => factions.contains(id),
        containsEncounterTable: (id) => tables.contains(id)
      })
    )
  }
}
