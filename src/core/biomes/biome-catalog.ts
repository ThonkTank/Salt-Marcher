import type Database from 'better-sqlite3'
import catalogDocument from '../creatures/srd-5.1.generated.json' with { type: 'json' }
import {
  biomeCatalogMutationResultSchema,
  biomeDefinitionSchema,
  biomeDraftSchema,
  biomeIdSchema,
  biomePageSchema,
  biomeSearchInputSchema,
  anyBiomeEncounterTableId,
  placeholderBiomeId,
  type BiomeDefinition,
  type BiomeDraft,
  type BiomeId,
  type BuiltinBiomeId
} from '../../shared/contracts/biome.js'
import { CapabilityError } from '../../shared/errors/capability-error.js'
import { uuidv7 } from '../../shared/ids/uuidv7.js'
import {
  EncounterTableStore,
  initializeEncounterTableSchema
} from '../encounter/encounter-table-store.js'
import { builtinBiomeSeeds } from './biome-seeds.js'

const tableIds = new Map(
  builtinBiomeSeeds.map((entry, index) => [
    entry.id,
    `01900000-0000-7000-8000-${String(index + 101).padStart(12, '0')}`
  ])
)

const sourceCreatures = catalogDocument.creatures as readonly {
  id: string
  biomes: readonly string[]
}[]

export function initializeBiomeCatalogSchema(db: Database.Database): void {
  initializeEncounterTableSchema(db)
  db.exec(`
    CREATE TABLE IF NOT EXISTS biome_catalog_metadata (
      singleton INTEGER PRIMARY KEY NOT NULL CHECK(singleton = 1),
      revision INTEGER NOT NULL CHECK(revision >= 0)
    );
    CREATE TABLE IF NOT EXISTS biome_definition (
      id TEXT PRIMARY KEY NOT NULL,
      kind TEXT NOT NULL CHECK(kind IN ('builtin', 'custom', 'placeholder')),
      display_name TEXT NOT NULL,
      normalized_name TEXT NOT NULL UNIQUE,
      color TEXT NOT NULL,
      passable INTEGER NOT NULL CHECK(passable IN (0, 1)),
      travel_cost REAL NOT NULL CHECK(travel_cost BETWEEN 0.1 AND 100),
      position INTEGER NOT NULL CHECK(position >= 0),
      protected INTEGER NOT NULL CHECK(protected IN (0, 1))
    );
    CREATE TABLE IF NOT EXISTS biome_alias (
      biome_id TEXT NOT NULL REFERENCES biome_definition(id) ON DELETE CASCADE,
      alias TEXT NOT NULL,
      normalized_alias TEXT NOT NULL,
      PRIMARY KEY (biome_id, normalized_alias)
    );
    CREATE TABLE IF NOT EXISTS biome_encounter_table (
      biome_id TEXT NOT NULL REFERENCES biome_definition(id) ON DELETE CASCADE,
      encounter_table_id TEXT NOT NULL,
      position INTEGER NOT NULL CHECK(position >= 0),
      PRIMARY KEY (biome_id, encounter_table_id)
    );
    CREATE TABLE IF NOT EXISTS biome_command_receipt (
      command_id TEXT PRIMARY KEY NOT NULL,
      operation TEXT NOT NULL,
      subject_id TEXT NOT NULL,
      request_json TEXT NOT NULL,
      result_json TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_biome_position ON biome_definition(position, id);
    CREATE INDEX IF NOT EXISTS idx_biome_alias_search ON biome_alias(normalized_alias);
    CREATE INDEX IF NOT EXISTS idx_biome_encounter_table_reverse
      ON biome_encounter_table(encounter_table_id, biome_id);
  `)
  db.prepare(
    'INSERT OR IGNORE INTO biome_catalog_metadata (singleton, revision) VALUES (1, 0)'
  ).run()
  seedCatalog(db)
}

export class BiomeCatalogStore {
  constructor(private readonly db: Database.Database) {}

  revision(): number {
    return (
      this.db
        .prepare(
          'SELECT revision FROM biome_catalog_metadata WHERE singleton = 1'
        )
        .get() as { revision: number }
    ).revision
  }

  search(input: unknown) {
    const query = biomeSearchInputSchema.parse(input)
    const needle = `%${escapeLike(normalizeName(query.query))}%`
    const where = `definition.kind <> 'placeholder' AND (
      definition.normalized_name LIKE ? ESCAPE '\\' OR EXISTS (
        SELECT 1 FROM biome_alias alias
        WHERE alias.biome_id = definition.id
          AND alias.normalized_alias LIKE ? ESCAPE '\\'
      )
    )`
    const total = (
      this.db
        .prepare(
          `SELECT COUNT(*) AS value FROM biome_definition definition WHERE ${where}`
        )
        .get(needle, needle) as { value: number }
    ).value
    const ids = (
      this.db
        .prepare(
          `SELECT definition.id FROM biome_definition definition
           WHERE ${where}
           ORDER BY definition.position, definition.id
           LIMIT ? OFFSET ?`
        )
        .all(needle, needle, query.limit, query.offset) as { id: string }[]
    ).map(({ id }) => id)
    return biomePageSchema.parse({
      revision: this.revision(),
      total,
      offset: query.offset,
      limit: query.limit,
      biomes: this.resolve(ids)
    })
  }

  get(id: string): BiomeDefinition | null {
    return this.definitions([id])[0] ?? null
  }

  require(id: string): BiomeDefinition {
    const biome = this.get(id)
    if (!biome) throw new CapabilityError('not_found', false)
    return biome
  }

  resolve(ids: readonly BiomeId[]): readonly BiomeDefinition[] {
    const unique = [...new Set(ids)]
    const definitions: BiomeDefinition[] = []
    for (let index = 0; index < unique.length; index += 500)
      definitions.push(...this.definitions(unique.slice(index, index + 500)))
    const byId = new Map(definitions.map((biome) => [biome.id, biome]))
    return unique.map((id) => {
      const biome = byId.get(id)
      if (!biome) throw new CapabilityError('not_found', false)
      return biome
    })
  }

  encounterTableIdsForBiomes(ids: readonly string[]): readonly string[] {
    const unique = [...new Set(ids)].map((id) => biomeIdSchema.parse(id))
    if (unique.length === 0) return []
    this.resolve(unique)
    const placeholders = unique.map(() => '?').join(', ')
    return (
      this.db
        .prepare(
          `SELECT encounter_table_id AS id FROM biome_encounter_table
           WHERE biome_id IN (${placeholders})
           ORDER BY position, encounter_table_id`
        )
        .all(...unique) as { id: string }[]
    ).map(({ id }) => id)
  }

  biomeIdsUsingEncounterTable(encounterTableId: string): readonly BiomeId[] {
    return (
      this.db
        .prepare(
          `SELECT biome_id AS id FROM biome_encounter_table
           WHERE encounter_table_id = ? ORDER BY biome_id`
        )
        .all(encounterTableId) as { id: BiomeId }[]
    ).map(({ id }) => id)
  }

  unlinkEncounterTable(encounterTableId: string): readonly BiomeId[] {
    const ids = this.biomeIdsUsingEncounterTable(encounterTableId)
    if (ids.length === 0) return []
    this.db.transaction(() => {
      this.db
        .prepare(
          'DELETE FROM biome_encounter_table WHERE encounter_table_id = ?'
        )
        .run(encounterTableId)
      this.bumpRevision()
    })()
    return ids
  }

  systemDefinitions(): readonly BiomeDefinition[] {
    return this.resolve(
      (
        this.db
          .prepare(
            "SELECT id FROM biome_definition WHERE kind <> 'custom' ORDER BY position, id"
          )
          .all() as { id: BiomeId }[]
      ).map(({ id }) => id)
    )
  }

  create(commandId: string, raw: BiomeDraft, expectedRevision: number) {
    const draft = biomeDraftSchema.parse(raw)
    const request = { biome: draft, expectedRevision }
    const replay = this.receipt(commandId, 'create', request)
    if (replay) return replay
    const id = uuidv7()
    this.db.transaction(() => {
      this.assertRevision(expectedRevision)
      this.assertNameAvailable(draft.displayName)
      this.assertGlobalTables(draft.encounterTableIds)
      const position = (
        this.db
          .prepare(
            'SELECT COALESCE(MAX(position), -1) + 1 AS value FROM biome_definition'
          )
          .get() as { value: number }
      ).value
      this.db
        .prepare(
          `INSERT INTO biome_definition
           (id, kind, display_name, normalized_name, color, passable,
            travel_cost, position, protected)
           VALUES (?, 'custom', ?, ?, ?, ?, ?, ?, 0)`
        )
        .run(
          id,
          draft.displayName,
          normalizeName(draft.displayName),
          draft.color,
          Number(draft.passable),
          draft.travelCost,
          position
        )
      this.replaceTables(id, draft.encounterTableIds)
      this.bumpRevision()
      this.writeReceipt(commandId, 'create', id, request, {
        revision: this.revision(),
        biome: this.require(id)
      })
    })()
    return this.receipt(commandId, 'create', request)!
  }

  update(
    commandId: string,
    id: string,
    raw: BiomeDraft,
    expectedRevision: number
  ) {
    const draft = biomeDraftSchema.parse(raw)
    const request = { id, biome: draft, expectedRevision }
    const replay = this.receipt(commandId, 'update', request)
    if (replay) return replay
    this.db.transaction(() => {
      this.assertRevision(expectedRevision)
      const current = this.require(id)
      if (current.kind === 'placeholder')
        throw new CapabilityError('validation_failed', false)
      this.assertNameAvailable(draft.displayName, id)
      this.assertGlobalTables(draft.encounterTableIds)
      this.db
        .prepare(
          `UPDATE biome_definition
           SET display_name = ?, normalized_name = ?, color = ?, passable = ?,
               travel_cost = ? WHERE id = ?`
        )
        .run(
          draft.displayName,
          normalizeName(draft.displayName),
          draft.color,
          Number(draft.passable),
          draft.travelCost,
          id
        )
      this.replaceTables(id, draft.encounterTableIds)
      this.bumpRevision()
      this.writeReceipt(commandId, 'update', id, request, {
        revision: this.revision(),
        biome: this.require(id)
      })
    })()
    return this.receipt(commandId, 'update', request)!
  }

  remove(commandId: string, id: string, expectedRevision: number) {
    const request = { id, expectedRevision }
    const replay = this.receipt(commandId, 'delete', request)
    if (replay) return replay
    this.db.transaction(() => {
      this.assertRevision(expectedRevision)
      const current = this.require(id)
      if (current.protected || current.kind !== 'custom')
        throw new CapabilityError('validation_failed', false)
      this.db.prepare('DELETE FROM biome_definition WHERE id = ?').run(id)
      this.bumpRevision()
      this.writeReceipt(commandId, 'delete', id, request, {
        revision: this.revision(),
        biome: null
      })
    })()
    return this.receipt(commandId, 'delete', request)!
  }

  private assertRevision(expected: number): void {
    if (this.revision() !== expected) throw new CapabilityError('stale', true)
  }

  private definitions(ids: readonly string[]): readonly BiomeDefinition[] {
    if (ids.length === 0) return []
    const placeholders = ids.map(() => '?').join(', ')
    const rows = this.db
      .prepare(
        `SELECT id, kind, display_name AS displayName, color, passable,
                travel_cost AS travelCost, position, protected
         FROM biome_definition WHERE id IN (${placeholders})`
      )
      .all(...ids) as Array<{
      id: string
      kind: 'builtin' | 'custom' | 'placeholder'
      displayName: string
      color: string
      passable: number
      travelCost: number
      position: number
      protected: number
    }>
    const aliases = new Map<string, string[]>()
    for (const row of this.db
      .prepare(
        `SELECT biome_id AS biomeId, alias FROM biome_alias
         WHERE biome_id IN (${placeholders})
         ORDER BY biome_id, normalized_alias`
      )
      .all(...ids) as Array<{ biomeId: string; alias: string }>)
      if (aliases.has(row.biomeId)) aliases.get(row.biomeId)!.push(row.alias)
      else aliases.set(row.biomeId, [row.alias])
    const encounterTables = new Map<string, string[]>()
    for (const row of this.db
      .prepare(
        `SELECT biome_id AS biomeId, encounter_table_id AS tableId
         FROM biome_encounter_table WHERE biome_id IN (${placeholders})
         ORDER BY biome_id, position, encounter_table_id`
      )
      .all(...ids) as Array<{ biomeId: string; tableId: string }>)
      if (encounterTables.has(row.biomeId))
        encounterTables.get(row.biomeId)!.push(row.tableId)
      else encounterTables.set(row.biomeId, [row.tableId])
    return rows.map((row) =>
      biomeDefinitionSchema.parse({
        ...row,
        passable: Boolean(row.passable),
        protected: Boolean(row.protected),
        aliases: aliases.get(row.id) ?? [],
        encounterTableIds: encounterTables.get(row.id) ?? []
      })
    )
  }

  private assertNameAvailable(displayName: string, exceptId?: string): void {
    const existing = this.db
      .prepare(
        'SELECT id FROM biome_definition WHERE normalized_name = ? AND id <> ?'
      )
      .get(normalizeName(displayName), exceptId ?? '')
    if (existing) throw new CapabilityError('validation_failed', false)
  }

  private assertGlobalTables(ids: readonly string[]): void {
    const tables = new EncounterTableStore(this.db, 'installation')
    if (ids.some((id) => !tables.contains(id)))
      throw new CapabilityError('not_found', false)
  }

  private replaceTables(biomeId: string, ids: readonly string[]): void {
    this.db
      .prepare('DELETE FROM biome_encounter_table WHERE biome_id = ?')
      .run(biomeId)
    const insert = this.db.prepare(
      'INSERT INTO biome_encounter_table (biome_id, encounter_table_id, position) VALUES (?, ?, ?)'
    )
    ids.forEach((id, position) => insert.run(biomeId, id, position))
  }

  private bumpRevision(): void {
    this.db
      .prepare(
        'UPDATE biome_catalog_metadata SET revision = revision + 1 WHERE singleton = 1'
      )
      .run()
  }

  private writeReceipt(
    commandId: string,
    operation: string,
    subjectId: string,
    request: unknown,
    result: unknown
  ): void {
    const parsed = biomeCatalogMutationResultSchema.parse(result)
    this.db
      .prepare(
        `INSERT INTO biome_command_receipt
         (command_id, operation, subject_id, request_json, result_json)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run(
        commandId,
        operation,
        subjectId,
        JSON.stringify(request),
        JSON.stringify(parsed)
      )
  }

  private receipt(commandId: string, operation: string, request: unknown) {
    const row = this.db
      .prepare(
        `SELECT operation, request_json AS requestJson, result_json AS resultJson
         FROM biome_command_receipt WHERE command_id = ?`
      )
      .get(commandId) as
      { operation: string; requestJson: string; resultJson: string } | undefined
    if (
      row &&
      (row.operation !== operation ||
        row.requestJson !== JSON.stringify(request))
    )
      throw new CapabilityError('validation_failed', false)
    return row
      ? biomeCatalogMutationResultSchema.parse(JSON.parse(row.resultJson))
      : null
  }
}

function seedCatalog(db: Database.Database): void {
  const insertBiome = db.prepare(
    `INSERT OR IGNORE INTO biome_definition
     (id, kind, display_name, normalized_name, color, passable, travel_cost,
      position, protected)
     VALUES (?, 'builtin', ?, ?, ?, ?, ?, ?, 1)`
  )
  const insertAlias = db.prepare(
    'INSERT OR IGNORE INTO biome_alias (biome_id, alias, normalized_alias) VALUES (?, ?, ?)'
  )
  const insertLink = db.prepare(
    'INSERT OR IGNORE INTO biome_encounter_table (biome_id, encounter_table_id, position) VALUES (?, ?, 0)'
  )
  const tables = new EncounterTableStore(db, 'installation')

  db.transaction(() => {
    builtinBiomeSeeds.forEach((biome, position) => {
      insertBiome.run(
        biome.id,
        biome.displayName,
        normalizeName(biome.displayName),
        biome.color,
        Number(biome.passable),
        biome.travelCost,
        position
      )
      for (const alias of biome.aliases)
        insertAlias.run(biome.id, alias, normalizeName(alias))
      const tableId = tableIds.get(biome.id)!
      tables.seedProtected(
        tableId,
        {
          displayName: `Biom: ${biome.displayName}`,
          description: `Geschützter Standard-Pool für ${biome.displayName}.`,
          entries: sourceCreatures
            .filter((creature) =>
              creature.biomes.some(
                (value) => normalizeLegacyBiome(value) === biome.id
              )
            )
            .map((creature) => ({ creatureId: creature.id, weight: 1 }))
        },
        position
      )
      insertLink.run(biome.id, tableId)
    })

    insertBiome.run(
      placeholderBiomeId,
      'Zu ersetzen',
      normalizeName('Zu ersetzen'),
      '#b54a86',
      1,
      1,
      builtinBiomeSeeds.length
    )
    db.prepare(
      "UPDATE biome_definition SET kind = 'placeholder', protected = 1 WHERE id = ?"
    ).run(placeholderBiomeId)

    tables.seedProtected(
      anyBiomeEncounterTableId,
      {
        displayName: 'Beliebiges Biom',
        description:
          'Geschützter System-Pool für Kreaturen, die in jedes Biom passen.',
        entries: sourceCreatures
          .filter((creature) => creature.biomes.includes('Any'))
          .map((creature) => ({ creatureId: creature.id, weight: 1 }))
      },
      builtinBiomeSeeds.length
    )
  })()
}

function normalizeLegacyBiome(value: string): BuiltinBiomeId | null {
  if (value === 'Any') return null
  for (const biome of builtinBiomeSeeds)
    if (biome.aliases.includes(value)) return biome.id
  throw new Error(`Unknown canonical biome seed value: ${value}`)
}

function normalizeName(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase('de')
    .trim()
}

function escapeLike(value: string): string {
  return value
    .replaceAll('\\', '\\\\')
    .replaceAll('%', '\\%')
    .replaceAll('_', '\\_')
}
