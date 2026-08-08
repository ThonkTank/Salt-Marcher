import type Database from 'better-sqlite3'
import { CapabilityError } from '../../shared/errors/capability-error.js'
import {
  builtinLocationSymbolCatalog,
  locationSymbolDraftSchema,
  locationSymbolMutationReceiptSchema,
  locationSymbolPageSchema,
  locationSymbolSnapshotSchema,
  type LocationSymbolDraft
} from '../../shared/contracts/location-symbol.js'
import { uuidv7 } from '../../shared/ids/uuidv7.js'

const builtinNames = new Set(
  builtinLocationSymbolCatalog.map(({ displayName }) =>
    displayName.toLocaleLowerCase('de')
  )
)

export function initializeLocationSymbolSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS location_symbol_metadata (
      singleton INTEGER PRIMARY KEY NOT NULL CHECK(singleton = 1),
      revision INTEGER NOT NULL CHECK(revision >= 0)
    );
    CREATE TABLE IF NOT EXISTS location_symbol (
      id TEXT PRIMARY KEY NOT NULL,
      display_name TEXT NOT NULL COLLATE NOCASE UNIQUE,
      viewbox_min_x REAL NOT NULL,
      viewbox_min_y REAL NOT NULL,
      viewbox_width REAL NOT NULL CHECK(viewbox_width > 0),
      viewbox_height REAL NOT NULL CHECK(viewbox_height > 0),
      path_data TEXT NOT NULL,
      fill_rule TEXT NOT NULL CHECK(fill_rule IN ('nonzero', 'evenodd')),
      position INTEGER NOT NULL CHECK(position >= 0)
    );
    CREATE TABLE IF NOT EXISTS location_symbol_deletion (
      command_id TEXT PRIMARY KEY NOT NULL,
      symbol_id TEXT NOT NULL,
      expected_revision INTEGER NOT NULL CHECK(expected_revision >= 0),
      state TEXT NOT NULL CHECK(state IN ('pending', 'completed'))
    );
    CREATE TABLE IF NOT EXISTS location_symbol_import (
      command_id TEXT PRIMARY KEY NOT NULL,
      campaign_id TEXT NOT NULL,
      location_id TEXT NOT NULL,
      expected_presentation_revision INTEGER NOT NULL CHECK(expected_presentation_revision >= 0),
      expected_symbol_revision INTEGER NOT NULL CHECK(expected_symbol_revision >= 0),
      created_symbol_id TEXT NOT NULL,
      state TEXT NOT NULL CHECK(state IN ('pending', 'completed', 'cancelled'))
    );
  `)
  db.prepare(
    'INSERT OR IGNORE INTO location_symbol_metadata (singleton, revision) VALUES (1, 0)'
  ).run()
}

export class LocationSymbolStore {
  constructor(private readonly db: Database.Database) {}

  contains(id: string): boolean {
    return (
      this.db.prepare('SELECT 1 FROM location_symbol WHERE id = ?').get(id) !==
      undefined
    )
  }

  get(id: string) {
    return this.read().symbols.find((symbol) => symbol.id === id) ?? null
  }

  detail(id: string) {
    const symbol = this.get(id)
    if (!symbol) throw new CapabilityError('not_found', false)
    return symbol
  }

  read() {
    const revision = (
      this.db
        .prepare(
          'SELECT revision FROM location_symbol_metadata WHERE singleton = 1'
        )
        .get() as { revision: number }
    ).revision
    const symbols = this.db
      .prepare(
        `SELECT id, display_name AS displayName,
                viewbox_min_x AS minX, viewbox_min_y AS minY,
                viewbox_width AS width, viewbox_height AS height,
                path_data AS pathData, fill_rule AS fillRule, position
         FROM location_symbol ORDER BY position, id`
      )
      .all()
      .map((row) => {
        const value = row as {
          id: string
          displayName: string
          minX: number
          minY: number
          width: number
          height: number
          pathData: string
          fillRule: 'nonzero' | 'evenodd'
          position: number
        }
        return {
          id: value.id,
          displayName: value.displayName,
          viewBox: {
            minX: value.minX,
            minY: value.minY,
            width: value.width,
            height: value.height
          },
          pathData: value.pathData,
          fillRule: value.fillRule,
          position: value.position
        }
      })
    return locationSymbolSnapshotSchema.parse({ revision, symbols })
  }

  create(raw: LocationSymbolDraft, expectedRevision: number) {
    const symbol = locationSymbolDraftSchema.parse(raw)
    const normalizedName = symbol.displayName.toLocaleLowerCase('de')
    if (builtinNames.has(normalizedName))
      throw new CapabilityError('validation_failed', false)
    return this.db.transaction(() => {
      const current = this.read()
      if (current.revision !== expectedRevision)
        throw new CapabilityError('stale', true)
      if (
        current.symbols.some(
          (entry) =>
            entry.displayName.toLocaleLowerCase('de') === normalizedName
        )
      )
        throw new CapabilityError('validation_failed', false)
      const position = current.symbols.length
      const id = uuidv7()
      this.db
        .prepare(
          `INSERT INTO location_symbol
           (id, display_name, viewbox_min_x, viewbox_min_y, viewbox_width,
            viewbox_height, path_data, fill_rule, position)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          id,
          symbol.displayName,
          symbol.viewBox.minX,
          symbol.viewBox.minY,
          symbol.viewBox.width,
          symbol.viewBox.height,
          symbol.pathData,
          symbol.fillRule,
          position
        )
      this.db
        .prepare(
          'UPDATE location_symbol_metadata SET revision = revision + 1 WHERE singleton = 1'
        )
        .run()
      const snapshot = this.read()
      const saved = snapshot.symbols.find((entry) => entry.id === id)
      if (!saved) throw new Error('Created Location Symbol is missing.')
      return locationSymbolMutationReceiptSchema.parse({ snapshot, saved })
    })()
  }

  beginImport(input: {
    commandId: string
    campaignId: string
    locationId: string
    expectedPresentationRevision: number
    symbol: LocationSymbolDraft
    expectedSymbolRevision: number
  }) {
    const existing = this.importJob(input.commandId)
    const symbol = locationSymbolDraftSchema.parse(input.symbol)
    if (existing) {
      const created = this.get(existing.createdSymbolId)
      if (
        existing.campaignId !== input.campaignId ||
        existing.locationId !== input.locationId ||
        existing.expectedPresentationRevision !==
          input.expectedPresentationRevision ||
        existing.expectedSymbolRevision !== input.expectedSymbolRevision ||
        (created !== null &&
          (created.displayName !== symbol.displayName ||
            created.viewBox.minX !== symbol.viewBox.minX ||
            created.viewBox.minY !== symbol.viewBox.minY ||
            created.viewBox.width !== symbol.viewBox.width ||
            created.viewBox.height !== symbol.viewBox.height ||
            created.pathData !== symbol.pathData ||
            created.fillRule !== symbol.fillRule))
      )
        throw new CapabilityError('validation_failed', false)
      return { ...existing, symbols: this.read() }
    }
    this.assertNameAvailable(symbol.displayName)
    const createdSymbolId = uuidv7()
    this.db.transaction(() => {
      this.assertRevision(input.expectedSymbolRevision)
      const position = (
        this.db
          .prepare('SELECT COUNT(*) AS value FROM location_symbol')
          .get() as {
          value: number
        }
      ).value
      this.db
        .prepare(
          `INSERT INTO location_symbol_import
           (command_id, campaign_id, location_id,
            expected_presentation_revision, expected_symbol_revision,
            created_symbol_id, state)
           VALUES (?, ?, ?, ?, ?, ?, 'pending')`
        )
        .run(
          input.commandId,
          input.campaignId,
          input.locationId,
          input.expectedPresentationRevision,
          input.expectedSymbolRevision,
          createdSymbolId
        )
      this.db
        .prepare(
          `INSERT INTO location_symbol
           (id, display_name, viewbox_min_x, viewbox_min_y, viewbox_width,
            viewbox_height, path_data, fill_rule, position)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          createdSymbolId,
          symbol.displayName,
          symbol.viewBox.minX,
          symbol.viewBox.minY,
          symbol.viewBox.width,
          symbol.viewBox.height,
          symbol.pathData,
          symbol.fillRule,
          position
        )
      this.bumpRevision()
    })()
    return { ...this.importJob(input.commandId)!, symbols: this.read() }
  }

  pendingImports() {
    return this.db
      .prepare(
        `SELECT command_id AS commandId, campaign_id AS campaignId,
                location_id AS locationId,
                expected_presentation_revision AS expectedPresentationRevision,
                expected_symbol_revision AS expectedSymbolRevision,
                created_symbol_id AS createdSymbolId, state
         FROM location_symbol_import WHERE state = 'pending' ORDER BY rowid`
      )
      .all() as Array<{
      commandId: string
      campaignId: string
      locationId: string
      expectedPresentationRevision: number
      expectedSymbolRevision: number
      createdSymbolId: string
      state: 'pending'
    }>
  }

  completeImport(commandId: string): void {
    this.db
      .prepare(
        "UPDATE location_symbol_import SET state = 'completed' WHERE command_id = ?"
      )
      .run(commandId)
  }

  cancelImport(commandId: string): void {
    const job = this.importJob(commandId)
    if (!job || job.state !== 'pending') return
    this.db.transaction(() => {
      const removed = this.db
        .prepare('DELETE FROM location_symbol WHERE id = ?')
        .run(job.createdSymbolId).changes
      if (removed > 0) this.bumpRevision()
      this.db
        .prepare(
          "UPDATE location_symbol_import SET state = 'cancelled' WHERE command_id = ?"
        )
        .run(commandId)
    })()
  }

  search(query: string, offset: number, limit: number) {
    const revision = this.readRevision()
    const needle = `%${query.trim().replaceAll('%', '\\%').replaceAll('_', '\\_')}%`
    const total = (
      this.db
        .prepare(
          `SELECT COUNT(*) AS value FROM location_symbol
           WHERE display_name LIKE ? ESCAPE '\\' COLLATE NOCASE`
        )
        .get(needle) as { value: number }
    ).value
    const symbols = this.db
      .prepare(
        `SELECT id, display_name AS displayName,
                viewbox_min_x AS minX, viewbox_min_y AS minY,
                viewbox_width AS width, viewbox_height AS height,
                path_data AS pathData, fill_rule AS fillRule, position
         FROM location_symbol
         WHERE display_name LIKE ? ESCAPE '\\' COLLATE NOCASE
         ORDER BY position, id LIMIT ? OFFSET ?`
      )
      .all(needle, limit, offset)
      .map((raw) => {
        const row = raw as {
          id: string
          displayName: string
          minX: number
          minY: number
          width: number
          height: number
          pathData: string
          fillRule: 'nonzero' | 'evenodd'
          position: number
        }
        return {
          id: row.id,
          displayName: row.displayName,
          viewBox: {
            minX: row.minX,
            minY: row.minY,
            width: row.width,
            height: row.height
          },
          pathData: row.pathData,
          fillRule: row.fillRule,
          position: row.position
        }
      })
    return locationSymbolPageSchema.parse({
      revision,
      total,
      offset,
      symbols
    })
  }

  update(id: string, displayName: string, expectedRevision: number) {
    const name = displayName.trim()
    this.assertNameAvailable(name, id)
    this.db.transaction(() => {
      this.assertRevision(expectedRevision)
      if (
        this.db
          .prepare('UPDATE location_symbol SET display_name = ? WHERE id = ?')
          .run(name, id).changes === 0
      )
        throw new CapabilityError('not_found', false)
      this.bumpRevision()
    })()
    return this.read()
  }

  remove(id: string, expectedRevision: number): void {
    this.db.transaction(() => {
      this.assertRevision(expectedRevision)
      if (
        this.db.prepare('DELETE FROM location_symbol WHERE id = ?').run(id)
          .changes === 0
      )
        throw new CapabilityError('not_found', false)
      this.bumpRevision()
    })()
  }

  beginDeletion(
    commandId: string,
    symbolId: string,
    expectedRevision: number
  ): void {
    this.db
      .prepare(
        `INSERT OR IGNORE INTO location_symbol_deletion
         (command_id, symbol_id, expected_revision, state)
         VALUES (?, ?, ?, 'pending')`
      )
      .run(commandId, symbolId, expectedRevision)
    const existing = this.db
      .prepare(
        `SELECT symbol_id AS symbolId, expected_revision AS expectedRevision
         FROM location_symbol_deletion WHERE command_id = ?`
      )
      .get(commandId) as
      { symbolId: string; expectedRevision: number } | undefined
    if (
      existing?.symbolId !== symbolId ||
      existing.expectedRevision !== expectedRevision
    )
      throw new CapabilityError('validation_failed', false)
  }

  pendingDeletions(): Array<{
    commandId: string
    symbolId: string
    expectedRevision: number
  }> {
    return this.db
      .prepare(
        `SELECT command_id AS commandId, symbol_id AS symbolId,
                expected_revision AS expectedRevision
         FROM location_symbol_deletion WHERE state = 'pending'
         ORDER BY rowid`
      )
      .all() as Array<{
      commandId: string
      symbolId: string
      expectedRevision: number
    }>
  }

  completeDeletion(commandId: string): void {
    this.db
      .prepare(
        "UPDATE location_symbol_deletion SET state = 'completed' WHERE command_id = ?"
      )
      .run(commandId)
  }

  deletionJob(commandId: string) {
    return this.db
      .prepare(
        `SELECT command_id AS commandId, symbol_id AS symbolId,
                expected_revision AS expectedRevision, state
         FROM location_symbol_deletion WHERE command_id = ?`
      )
      .get(commandId) as
      | {
          commandId: string
          symbolId: string
          expectedRevision: number
          state: 'pending' | 'completed'
        }
      | undefined
  }

  private readRevision(): number {
    return (
      this.db
        .prepare(
          'SELECT revision FROM location_symbol_metadata WHERE singleton = 1'
        )
        .get() as { revision: number }
    ).revision
  }

  private importJob(commandId: string) {
    return this.db
      .prepare(
        `SELECT command_id AS commandId, campaign_id AS campaignId,
                location_id AS locationId,
                expected_presentation_revision AS expectedPresentationRevision,
                expected_symbol_revision AS expectedSymbolRevision,
                created_symbol_id AS createdSymbolId, state
         FROM location_symbol_import WHERE command_id = ?`
      )
      .get(commandId) as
      | {
          commandId: string
          campaignId: string
          locationId: string
          expectedPresentationRevision: number
          expectedSymbolRevision: number
          createdSymbolId: string
          state: 'pending' | 'completed' | 'cancelled'
        }
      | undefined
  }

  private assertRevision(expected: number): void {
    if (this.readRevision() !== expected)
      throw new CapabilityError('stale', true)
  }

  private assertNameAvailable(displayName: string, exceptId?: string): void {
    const normalized = displayName.toLocaleLowerCase('de')
    if (builtinNames.has(normalized))
      throw new CapabilityError('validation_failed', false)
    const row = this.db
      .prepare(
        `SELECT id FROM location_symbol
         WHERE display_name = ? COLLATE NOCASE AND id <> COALESCE(?, '')`
      )
      .get(displayName, exceptId)
    if (row) throw new CapabilityError('validation_failed', false)
  }

  private bumpRevision(): void {
    this.db
      .prepare(
        'UPDATE location_symbol_metadata SET revision = revision + 1 WHERE singleton = 1'
      )
      .run()
  }
}

export class LocationSymbolService {
  constructor(private readonly database: () => Database.Database) {}

  read() {
    return new LocationSymbolStore(this.database()).read()
  }

  create(symbol: LocationSymbolDraft, expectedRevision: number) {
    return new LocationSymbolStore(this.database()).create(
      symbol,
      expectedRevision
    )
  }

  search(query: string, offset: number, limit: number) {
    return new LocationSymbolStore(this.database()).search(query, offset, limit)
  }

  detail(id: string) {
    return new LocationSymbolStore(this.database()).detail(id)
  }

  update(id: string, displayName: string, expectedRevision: number) {
    return new LocationSymbolStore(this.database()).update(
      id,
      displayName,
      expectedRevision
    )
  }

  remove(id: string, expectedRevision: number): void {
    new LocationSymbolStore(this.database()).remove(id, expectedRevision)
  }
}
