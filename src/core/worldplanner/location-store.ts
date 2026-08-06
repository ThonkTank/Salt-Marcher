import Database from 'better-sqlite3'
import { CapabilityError } from '../../shared/errors/capability-error.js'
import {
  worldLocationDraftSchema,
  createWorldLocationResultSchema,
  worldLocationMapPresentationSchema,
  worldLocationSnapshotSchema,
  defaultWorldLocationMapPresentation,
  type WorldLocationDraft,
  type WorldLocationMapPresentation,
  type WorldLocationMapPresentationPatch,
  type WorldLocationSnapshot,
  type CreateWorldLocationResult
} from '../../shared/contracts/world-location.js'
import {
  builtinLocationSymbolIdSchema,
  type LocationSymbol
} from '../../shared/contracts/location-symbol.js'
import { uuidv7 } from '../../shared/ids/uuidv7.js'
import { EncounterTableStore } from '../encounter/encounter-table-store.js'
import { WorldFactionStore } from './faction-store.js'

export interface WorldLocationReferences {
  containsFaction(id: string): boolean
  containsEncounterTable(id: string): boolean
  containsLocationSymbol?(id: string): boolean
  locationSymbol?(id: string): LocationSymbol | null
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
      kind TEXT NOT NULL,
      region TEXT NOT NULL,
      notes TEXT NOT NULL,
      position INTEGER NOT NULL CHECK(position >= 0)
    );
    CREATE INDEX IF NOT EXISTS idx_worldplanner_location_name
      ON worldplanner_location(display_name COLLATE NOCASE, id);
    CREATE TABLE IF NOT EXISTS worldplanner_location_map_presentation (
      location_id TEXT PRIMARY KEY NOT NULL
        REFERENCES worldplanner_location(id) ON DELETE CASCADE,
      revision INTEGER NOT NULL CHECK(revision >= 0),
      title_override TEXT,
      symbol_id TEXT NOT NULL,
      symbol_size INTEGER NOT NULL CHECK(symbol_size BETWEEN 24 AND 80),
      label_curve INTEGER NOT NULL CHECK(label_curve BETWEEN -40 AND 40),
      label_position TEXT NOT NULL CHECK(label_position IN ('above', 'below', 'both'))
    );
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
    const factionIds = this.referenceMap(
      'worldplanner_location_faction',
      'faction_id'
    )
    const encounterTableIds = this.referenceMap(
      'worldplanner_location_encounter_table',
      'encounter_table_id'
    )
    const locations = this.db
      .prepare(
        `
        SELECT location.id, location.display_name AS displayName,
               location.kind, location.region, location.notes, location.position,
               presentation.revision AS mapRevision,
               presentation.title_override AS mapTitleOverride,
               presentation.symbol_id AS mapSymbolId,
               presentation.symbol_size AS mapSymbolSize,
               presentation.label_curve AS mapLabelCurve,
               presentation.label_position AS mapLabelPosition
        FROM worldplanner_location location
        JOIN worldplanner_location_map_presentation presentation
          ON presentation.location_id = location.id
        ORDER BY location.position, location.id
      `
      )
      .all()
      .map((raw) => {
        const location = raw as {
          id: string
          displayName: string
          kind: string
          region: string
          notes: string
          position: number
          mapRevision: number
          mapTitleOverride: string | null
          mapSymbolId: string
          mapSymbolSize: number
          mapLabelCurve: number
          mapLabelPosition: 'above' | 'below' | 'both'
        }
        return {
          id: location.id,
          displayName: location.displayName,
          kind: location.kind,
          region: location.region,
          notes: location.notes,
          position: location.position,
          mapPresentation: {
            revision: location.mapRevision,
            titleOverride: location.mapTitleOverride,
            symbolId: location.mapSymbolId,
            symbolSize: location.mapSymbolSize,
            labelCurve: location.mapLabelCurve,
            labelPosition: location.mapLabelPosition
          },
          factionIds: factionIds.get(location.id) ?? [],
          encounterTableIds: encounterTableIds.get(location.id) ?? []
        }
      })
    return worldLocationSnapshotSchema.parse({
      revision: metadata.revision,
      locations
    })
  }

  create(
    draft: WorldLocationDraft,
    expectedRevision: number
  ): WorldLocationSnapshot {
    return this.createResult(draft, expectedRevision).snapshot
  }

  createResult(
    draft: WorldLocationDraft,
    expectedRevision: number
  ): CreateWorldLocationResult {
    const parsed = worldLocationDraftSchema.parse(draft)
    let createdId = ''
    this.mutate(expectedRevision, () => {
      const position = (
        this.db
          .prepare(
            'SELECT COALESCE(MAX(position), -1) + 1 AS value FROM worldplanner_location'
          )
          .get() as { value: number }
      ).value
      const id = uuidv7()
      createdId = id
      this.db
        .prepare(
          `INSERT INTO worldplanner_location
           (id, display_name, kind, region, notes, position)
           VALUES (?, ?, ?, ?, ?, ?)`
        )
        .run(
          id,
          parsed.displayName,
          parsed.kind,
          parsed.region,
          parsed.notes,
          position
        )
      this.db
        .prepare(
          `INSERT INTO worldplanner_location_map_presentation
           (location_id, revision, title_override, symbol_id, symbol_size,
            label_curve, label_position)
           VALUES (?, 0, ?, ?, ?, ?, ?)`
        )
        .run(
          id,
          defaultWorldLocationMapPresentation.titleOverride,
          defaultWorldLocationMapPresentation.symbolId,
          defaultWorldLocationMapPresentation.symbolSize,
          defaultWorldLocationMapPresentation.labelCurve,
          defaultWorldLocationMapPresentation.labelPosition
        )
      this.replaceReferences(id, parsed.factionIds, parsed.encounterTableIds)
    })
    const snapshot = this.read()
    const createdLocation = snapshot.locations.find(
      (location) => location.id === createdId
    )
    if (!createdLocation)
      throw new Error('Created World Location is missing from its snapshot.')
    return createWorldLocationResultSchema.parse({ snapshot, createdLocation })
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
          `UPDATE worldplanner_location SET
             display_name = ?, kind = ?, region = ?, notes = ?
           WHERE id = ?`
        )
        .run(
          parsed.displayName,
          parsed.kind,
          parsed.region,
          parsed.notes,
          id
        ).changes
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

  updateMapPresentation(
    id: string,
    raw: WorldLocationMapPresentationPatch,
    expectedRevision: number
  ): WorldLocationMapPresentation {
    const current = this.mapPresentation(id)
    if (current.revision !== expectedRevision)
      throw new CapabilityError('stale', true)
    const presentation = worldLocationMapPresentationSchema.parse({
      ...current,
      ...raw,
      revision: current.revision + 1
    })
    this.assertMapSymbol(presentation.symbolId)
    this.db.transaction(() => {
      const presentationChanged = this.db
        .prepare(
          `UPDATE worldplanner_location_map_presentation SET
             revision = ?, title_override = ?, symbol_id = ?, symbol_size = ?,
             label_curve = ?, label_position = ?
           WHERE location_id = ? AND revision = ?`
        )
        .run(
          presentation.revision,
          presentation.titleOverride,
          presentation.symbolId,
          presentation.symbolSize,
          presentation.labelCurve,
          presentation.labelPosition,
          id,
          expectedRevision
        ).changes
      if (presentationChanged === 0) throw new CapabilityError('stale', true)
    })()
    return presentation
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

  mapPresentation(id: string): WorldLocationMapPresentation {
    const row = this.db
      .prepare(
        `SELECT revision, title_override AS titleOverride,
                symbol_id AS symbolId, symbol_size AS symbolSize,
                label_curve AS labelCurve, label_position AS labelPosition
         FROM worldplanner_location_map_presentation WHERE location_id = ?`
      )
      .get(id)
    if (!row) throw new CapabilityError('not_found', false)
    return worldLocationMapPresentationSchema.parse(row)
  }

  markerPresentation(id: string) {
    const displayName = this.displayName(id)
    if (!displayName) throw new CapabilityError('not_found', false)
    const presentation = this.mapPresentation(id)
    const builtin = builtinLocationSymbolIdSchema.safeParse(
      presentation.symbolId
    )
    const symbol = builtin.success
      ? ({ kind: 'builtin' as const, id: builtin.data } as const)
      : this.knownReferences.locationSymbol?.(presentation.symbolId)
    if (!symbol) throw new CapabilityError('not_found', false)
    return {
      revision: presentation.revision,
      title: presentation.titleOverride ?? displayName,
      symbol:
        'kind' in symbol
          ? symbol
          : {
              kind: 'custom' as const,
              id: symbol.id,
              viewBox: symbol.viewBox,
              pathData: symbol.pathData,
              fillRule: symbol.fillRule
            },
      symbolSize: presentation.symbolSize,
      labelCurve: presentation.labelCurve,
      labelPosition: presentation.labelPosition
    }
  }

  replaceMapSymbol(symbolId: string, replacementId = 'location'): string[] {
    const ids = (
      this.db
        .prepare(
          `SELECT location_id AS id
           FROM worldplanner_location_map_presentation
           WHERE symbol_id = ? ORDER BY location_id`
        )
        .all(symbolId) as Array<{ id: string }>
    ).map((row) => row.id)
    if (ids.length === 0) return []
    this.db
      .prepare(
        `UPDATE worldplanner_location_map_presentation
         SET symbol_id = ?, revision = revision + 1
         WHERE symbol_id = ?`
      )
      .run(replacementId, symbolId)
    return ids
  }

  locationsUsingMapSymbol(symbolId: string): Array<{
    id: string
    displayName: string
  }> {
    return this.db
      .prepare(
        `SELECT location.id, location.display_name AS displayName
         FROM worldplanner_location location
         JOIN worldplanner_location_map_presentation presentation
           ON presentation.location_id = location.id
         WHERE presentation.symbol_id = ?
         ORDER BY location.position, location.id`
      )
      .all(symbolId) as Array<{ id: string; displayName: string }>
  }

  private referenceMap(table: string, column: string): Map<string, string[]> {
    const result = new Map<string, string[]>()
    const rows = this.db
      .prepare(
        `SELECT location_id AS locationId, ${column} AS id
           FROM ${table} ORDER BY location_id, position, ${column}`
      )
      .all() as Array<{ locationId: string; id: string }>
    for (const row of rows)
      result.set(row.locationId, [
        ...(result.get(row.locationId) ?? []),
        row.id
      ])
    return result
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

  private assertMapSymbol(id: string): void {
    if (builtinLocationSymbolIdSchema.safeParse(id).success) return
    if (!this.knownReferences.containsLocationSymbol?.(id))
      throw new CapabilityError('not_found', false)
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
  constructor(
    private readonly campaignDatabase: () => Database.Database,
    private readonly locationSymbol: (
      id: string
    ) => LocationSymbol | null = () => null
  ) {}

  read(): WorldLocationSnapshot {
    return this.withStore((store) => store.read())
  }

  create(draft: WorldLocationDraft, expectedRevision: number) {
    return this.withStore((store) => store.create(draft, expectedRevision))
  }

  createResult(draft: WorldLocationDraft, expectedRevision: number) {
    return this.withStore((store) =>
      store.createResult(draft, expectedRevision)
    )
  }

  update(id: string, draft: WorldLocationDraft, expectedRevision: number) {
    return this.withStore((store) => store.update(id, draft, expectedRevision))
  }

  delete(id: string, expectedRevision: number) {
    return this.withStore((store) => store.delete(id, expectedRevision))
  }

  updateMapPresentation(
    id: string,
    patch: WorldLocationMapPresentationPatch,
    expectedRevision: number
  ) {
    return this.withStore((store) =>
      store.updateMapPresentation(id, patch, expectedRevision)
    )
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
        containsEncounterTable: (id) => tables.contains(id),
        containsLocationSymbol: (id) => this.locationSymbol(id) !== null,
        locationSymbol: this.locationSymbol
      })
    )
  }
}
