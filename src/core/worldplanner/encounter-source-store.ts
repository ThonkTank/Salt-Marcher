import Database from 'better-sqlite3'
import {
  encounterTableDraftSchema,
  encounterTableSnapshotSchema,
  worldFactionDraftSchema,
  worldFactionSnapshotSchema,
  type EncounterTableDraft,
  type EncounterTableSnapshot,
  type WorldFactionDraft,
  type WorldFactionSnapshot
} from '../../shared/contracts/encounter-source.js'
import type { CreatureCatalogQuery } from '../../shared/contracts/encounter.js'
import { uuidv7 } from '../../shared/ids/uuidv7.js'
import { creatureById } from '../creatures/catalog.js'
import {
  initializeWorldLocationSchema,
  WorldLocationStore
} from './location-store.js'

export type ResolvedSourceCandidate = Readonly<{
  creatureId: string
  weight: number
  maximum: number | null
}>

export type ResolvedEncounterSource = Readonly<{
  candidates: readonly ResolvedSourceCandidate[] | null
  effectiveEncounterTableIds: readonly string[]
  effectiveFactionIds: readonly string[]
  locationId: string | null
  catalogFallback: boolean
}>

export function initializeEncounterSourceSchema(db: Database.Database): void {
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
      encounter_table_id TEXT NOT NULL,
      creature_id TEXT NOT NULL,
      weight INTEGER NOT NULL CHECK(weight BETWEEN 1 AND 10),
      position INTEGER NOT NULL CHECK(position >= 0),
      PRIMARY KEY (encounter_table_id, creature_id)
    );
    CREATE TABLE IF NOT EXISTS encounter_table_loot_link (
      encounter_table_id TEXT PRIMARY KEY NOT NULL,
      loot_table_id TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_encounter_table_name
      ON encounter_table(display_name COLLATE NOCASE, id);

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
      faction_id TEXT NOT NULL,
      creature_id TEXT NOT NULL,
      maximum INTEGER NOT NULL CHECK(maximum >= 0),
      PRIMARY KEY (faction_id, creature_id)
    );
    CREATE INDEX IF NOT EXISTS idx_worldplanner_faction_name
      ON worldplanner_faction(display_name COLLATE NOCASE, id);

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
    'INSERT OR IGNORE INTO encounter_table_metadata (singleton, revision) VALUES (1, 0)'
  ).run()
  db.prepare(
    'INSERT OR IGNORE INTO worldplanner_faction_metadata (singleton, revision) VALUES (1, 0)'
  ).run()
}

export class EncounterTableStore {
  constructor(private readonly db: Database.Database) {}

  read(): EncounterTableSnapshot {
    const revision = this.revision()
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
    return encounterTableSnapshotSchema.parse({
      revision,
      tables: rows.map((row) => ({
        ...row,
        entries: this.db
          .prepare(
            'SELECT creature_id AS creatureId, weight, position FROM encounter_table_entry WHERE encounter_table_id = ? ORDER BY position, creature_id'
          )
          .all(row.id)
      }))
    })
  }

  create(draft: EncounterTableDraft, expectedRevision: number) {
    const parsed = encounterTableDraftSchema.parse(draft)
    this.mutate(expectedRevision, () => {
      this.assertCreatures(parsed.entries.map((entry) => entry.creatureId))
      const id = uuidv7()
      const position = this.nextPosition('encounter_table')
      this.db
        .prepare(
          'INSERT INTO encounter_table (id, display_name, description, position) VALUES (?, ?, ?, ?)'
        )
        .run(id, parsed.displayName, parsed.description, position)
      this.replaceEntries(id, parsed.entries)
    })
    return this.read()
  }

  update(id: string, draft: EncounterTableDraft, expectedRevision: number) {
    const parsed = encounterTableDraftSchema.parse(draft)
    this.mutate(expectedRevision, () => {
      this.assertCreatures(parsed.entries.map((entry) => entry.creatureId))
      const changed = this.db
        .prepare(
          'UPDATE encounter_table SET display_name = ?, description = ? WHERE id = ?'
        )
        .run(parsed.displayName, parsed.description, id).changes
      if (changed === 0) throw new Error('not found')
      this.replaceEntries(id, parsed.entries)
    })
    return this.read()
  }

  delete(id: string, expectedRevision: number) {
    this.mutate(expectedRevision, () => {
      if (
        this.db.prepare('DELETE FROM encounter_table WHERE id = ?').run(id)
          .changes === 0
      )
        throw new Error('not found')
      this.db
        .prepare(
          'DELETE FROM encounter_table_entry WHERE encounter_table_id = ?'
        )
        .run(id)
      this.db
        .prepare(
          'DELETE FROM encounter_table_loot_link WHERE encounter_table_id = ?'
        )
        .run(id)
    })
    return this.read()
  }

  private replaceEntries(
    id: string,
    entries: readonly { creatureId: string; weight: number }[]
  ) {
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

  private assertCreatures(ids: readonly string[]) {
    if (ids.some((id) => !creatureById(id))) throw new Error('not found')
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

  private nextPosition(table: string): number {
    return (
      this.db
        .prepare(
          `SELECT COALESCE(MAX(position), -1) + 1 AS value FROM ${table}`
        )
        .get() as { value: number }
    ).value
  }

  private mutate(expectedRevision: number, operation: () => void) {
    const mutation = () => {
      if (this.revision() !== expectedRevision) throw new Error('stale')
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

export class WorldFactionStore {
  constructor(private readonly db: Database.Database) {}

  read(): WorldFactionSnapshot {
    const revision = this.revision()
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
    return worldFactionSnapshotSchema.parse({
      revision,
      factions: rows.map((row) => ({
        ...row,
        inventory: this.db
          .prepare(
            `SELECT i.creature_id AS creatureId, i.maximum
             FROM worldplanner_faction_inventory i
             JOIN worldplanner_faction f ON f.id = i.faction_id
             JOIN encounter_table_entry e
               ON e.encounter_table_id = f.primary_encounter_table_id
              AND e.creature_id = i.creature_id
             WHERE i.faction_id = ? ORDER BY i.creature_id`
          )
          .all(row.id)
      }))
    })
  }

  create(draft: WorldFactionDraft, expectedRevision: number) {
    const parsed = worldFactionDraftSchema.parse(draft)
    this.mutate(expectedRevision, () => {
      this.assertReferences(parsed)
      const id = uuidv7()
      const position = (
        this.db
          .prepare(
            'SELECT COALESCE(MAX(position), -1) + 1 AS value FROM worldplanner_faction'
          )
          .get() as { value: number }
      ).value
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

  update(id: string, draft: WorldFactionDraft, expectedRevision: number) {
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
      if (changed === 0) throw new Error('not found')
      this.replaceInventory(id, parsed.inventory)
    })
    return this.read()
  }

  delete(id: string, expectedRevision: number) {
    this.mutate(expectedRevision, () => {
      if (
        this.db.prepare('DELETE FROM worldplanner_faction WHERE id = ?').run(id)
          .changes === 0
      )
        throw new Error('not found')
      this.db
        .prepare(
          'DELETE FROM worldplanner_faction_inventory WHERE faction_id = ?'
        )
        .run(id)
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
    if (changes > 0) {
      const removeInventory = this.db.prepare(
        'DELETE FROM worldplanner_faction_inventory WHERE faction_id = ?'
      )
      factionIds.forEach((id) => removeInventory.run(id))
      this.bumpRevision()
    }
  }

  pruneInventoryForTable(
    encounterTableId: string,
    allowedCreatureIds: readonly string[]
  ): void {
    const values: unknown[] = [encounterTableId]
    const outsideTable =
      allowedCreatureIds.length === 0
        ? ''
        : `AND creature_id NOT IN (${allowedCreatureIds.map(() => '?').join(', ')})`
    values.push(...allowedCreatureIds)
    const changes = this.db
      .prepare(
        `DELETE FROM worldplanner_faction_inventory
         WHERE faction_id IN (
           SELECT id FROM worldplanner_faction
           WHERE primary_encounter_table_id = ?
         ) ${outsideTable}`
      )
      .run(...values).changes
    if (changes > 0) this.bumpRevision()
  }

  private assertReferences(draft: WorldFactionDraft) {
    if (!draft.primaryEncounterTableId) {
      if (draft.inventory.length > 0) throw new Error('validation')
      return
    }
    if (
      !this.db
        .prepare('SELECT 1 FROM encounter_table WHERE id = ?')
        .get(draft.primaryEncounterTableId)
    )
      throw new Error('not found')
    if (draft.inventory.some((entry) => !creatureById(entry.creatureId)))
      throw new Error('not found')
    const belongs = this.db.prepare(
      'SELECT 1 FROM encounter_table_entry WHERE encounter_table_id = ? AND creature_id = ?'
    )
    if (
      draft.inventory.some(
        (entry) => !belongs.get(draft.primaryEncounterTableId, entry.creatureId)
      )
    )
      throw new Error('validation')
  }

  private replaceInventory(
    id: string,
    inventory: readonly { creatureId: string; maximum: number }[]
  ) {
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

  private mutate(expectedRevision: number, operation: () => void) {
    const mutation = () => {
      if (this.revision() !== expectedRevision) throw new Error('stale')
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

export class EncounterSourceService {
  constructor(private readonly campaignPath: () => string) {}

  readTables() {
    return this.withStores(({ tables }) => tables.read())
  }
  createTable(draft: EncounterTableDraft, revision: number) {
    return this.withStores(({ tables }) => tables.create(draft, revision))
  }
  updateTable(id: string, draft: EncounterTableDraft, revision: number) {
    return this.withStores(({ db, tables, factions }) => {
      db.transaction(() => {
        tables.update(id, draft, revision)
        factions.pruneInventoryForTable(
          id,
          draft.entries.map((entry) => entry.creatureId)
        )
      })()
      return tables.read()
    })
  }
  deleteTable(id: string, revision: number) {
    return this.withStores(({ db, tables, factions, locations }) => {
      db.transaction(() => {
        tables.delete(id, revision)
        factions.clearPrimaryEncounterTable(id)
        locations.unlinkEncounterTable(id)
      })()
      return tables.read()
    })
  }
  readFactions() {
    return this.withStores(({ factions }) => factions.read())
  }
  createFaction(draft: WorldFactionDraft, revision: number) {
    return this.withStores(({ factions }) => factions.create(draft, revision))
  }
  updateFaction(id: string, draft: WorldFactionDraft, revision: number) {
    return this.withStores(({ factions }) =>
      factions.update(id, draft, revision)
    )
  }
  deleteFaction(id: string, revision: number) {
    return this.withStores(({ db, factions, locations }) => {
      db.transaction(() => {
        factions.delete(id, revision)
        locations.unlinkFaction(id)
      })()
      return factions.read()
    })
  }
  resolve(query: CreatureCatalogQuery) {
    const db = new Database(this.campaignPath())
    try {
      initializeEncounterSourceSchema(db)
      return resolveEncounterSource(db, query)
    } finally {
      db.close()
    }
  }

  private withStores<T>(
    work: (stores: {
      db: Database.Database
      tables: EncounterTableStore
      factions: WorldFactionStore
      locations: WorldLocationStore
    }) => T
  ): T {
    const db = new Database(this.campaignPath())
    try {
      initializeEncounterSourceSchema(db)
      initializeWorldLocationSchema(db)
      return work({
        db,
        tables: new EncounterTableStore(db),
        factions: new WorldFactionStore(db),
        locations: new WorldLocationStore(db)
      })
    } finally {
      db.close()
    }
  }
}

type Dimension = Map<string, { weight: number; maximum: number | null }>

export function resolveEncounterSource(
  db: Database.Database,
  query: CreatureCatalogQuery
): ResolvedEncounterSource {
  initializeEncounterSourceSchema(db)
  const dimensions: Dimension[] = []
  const effectiveTables = new Set<string>()
  const effectiveFactions = new Set<string>()

  let tableCount = effectiveTables.size
  const direct = tableDimension(db, query.encounterTableIds, effectiveTables)
  if (effectiveTables.size > tableCount) dimensions.push(direct)

  tableCount = effectiveTables.size
  const factions = factionDimension(
    db,
    query.factionIds,
    effectiveFactions,
    effectiveTables
  )
  if (effectiveTables.size > tableCount) dimensions.push(factions)

  if (query.locationId) {
    tableCount = effectiveTables.size
    const locationTableIds = ids(
      db,
      'SELECT encounter_table_id AS id FROM worldplanner_location_encounter_table WHERE location_id = ? ORDER BY position',
      query.locationId
    )
    const locationFactionIds = ids(
      db,
      'SELECT faction_id AS id FROM worldplanner_location_faction WHERE location_id = ? ORDER BY position',
      query.locationId
    )
    const tablePart = tableDimension(db, locationTableIds, effectiveTables)
    const factionPart = factionDimension(
      db,
      locationFactionIds,
      effectiveFactions,
      effectiveTables
    )
    const location = unionDimensions(tablePart, factionPart)
    if (effectiveTables.size > tableCount) dimensions.push(location)
  }

  if (effectiveTables.size === 0)
    return {
      candidates: null,
      effectiveEncounterTableIds: [],
      effectiveFactionIds: [...effectiveFactions],
      locationId: query.locationId,
      catalogFallback: true
    }

  const candidates = intersectDimensions(dimensions)
  return {
    candidates: [...candidates.entries()].map(([creatureId, value]) => ({
      creatureId,
      ...value
    })),
    effectiveEncounterTableIds: [...effectiveTables],
    effectiveFactionIds: [...effectiveFactions],
    locationId: query.locationId,
    catalogFallback: false
  }
}

function tableDimension(
  db: Database.Database,
  tableIds: readonly string[],
  effective: Set<string>
): Dimension {
  const result: Dimension = new Map()
  const table = db.prepare('SELECT 1 FROM encounter_table WHERE id = ?')
  const entries = db.prepare(
    'SELECT creature_id AS creatureId, weight FROM encounter_table_entry WHERE encounter_table_id = ?'
  )
  for (const tableId of new Set(tableIds)) {
    if (!table.get(tableId)) continue
    effective.add(tableId)
    for (const row of entries.all(tableId) as {
      creatureId: string
      weight: number
    }[]) {
      const current = result.get(row.creatureId)
      result.set(row.creatureId, {
        weight: (current?.weight ?? 0) + row.weight,
        maximum: null
      })
    }
  }
  return result
}

function factionDimension(
  db: Database.Database,
  factionIds: readonly string[],
  effectiveFactions: Set<string>,
  effectiveTables: Set<string>
): Dimension {
  const result: Dimension = new Map()
  const faction = db.prepare(
    'SELECT primary_encounter_table_id AS tableId FROM worldplanner_faction WHERE id = ?'
  )
  const entries = db.prepare(
    'SELECT creature_id AS creatureId, weight FROM encounter_table_entry WHERE encounter_table_id = ?'
  )
  const maximum = db.prepare(
    'SELECT maximum FROM worldplanner_faction_inventory WHERE faction_id = ? AND creature_id = ?'
  )
  for (const factionId of new Set(factionIds)) {
    const row = faction.get(factionId) as { tableId: string | null } | undefined
    if (!row) continue
    effectiveFactions.add(factionId)
    if (!row.tableId) continue
    effectiveTables.add(row.tableId)
    for (const entry of entries.all(row.tableId) as {
      creatureId: string
      weight: number
    }[]) {
      const inventory = maximum.get(factionId, entry.creatureId) as
        { maximum: number } | undefined
      const current = result.get(entry.creatureId)
      result.set(entry.creatureId, {
        weight: (current?.weight ?? 0) + entry.weight,
        maximum:
          current?.maximum === null || inventory === undefined
            ? null
            : (current?.maximum ?? 0) + inventory.maximum
      })
    }
  }
  return result
}

function unionDimensions(...dimensions: Dimension[]): Dimension {
  const result: Dimension = new Map()
  for (const dimension of dimensions)
    for (const [id, value] of dimension) {
      const current = result.get(id)
      result.set(id, {
        weight: (current?.weight ?? 0) + value.weight,
        maximum:
          current?.maximum === null || value.maximum === null
            ? null
            : (current?.maximum ?? 0) + value.maximum
      })
    }
  return result
}

function intersectDimensions(dimensions: readonly Dimension[]): Dimension {
  if (dimensions.length === 0) return new Map()
  const result = new Map(dimensions[0])
  for (const dimension of dimensions.slice(1))
    for (const [id, current] of result) {
      const other = dimension.get(id)
      if (!other) result.delete(id)
      else
        result.set(id, {
          weight: Math.min(current.weight, other.weight),
          maximum:
            current.maximum === null
              ? other.maximum
              : other.maximum === null
                ? current.maximum
                : Math.min(current.maximum, other.maximum)
        })
    }
  return result
}

function ids(db: Database.Database, sql: string, value: string): string[] {
  return (db.prepare(sql).all(value) as { id: string }[]).map((row) => row.id)
}
