import Database from 'better-sqlite3'
import { z } from 'zod'
import catalogDocument from './srd-5.1.generated.json' with { type: 'json' }
import {
  creatureCatalogPageSchema,
  creatureCatalogQuerySchema,
  creatureFilterOptionsSchema,
  creatureSchema,
  type Creature,
  type CreatureCatalogPage,
  type CreatureCatalogQuery,
  type CreatureFilterOptions
} from '../../shared/contracts/encounter.js'
import type { ResolvedEncounterSource } from '../worldplanner/encounter-source-store.js'

type ReferenceOptions = Pick<
  CreatureFilterOptions,
  'encounterTables' | 'factions' | 'locations'
>

const documentSchema = z
  .object({
    manifest: z
      .object({
        catalogVersion: z.string(),
        source: z.string(),
        sourceHash: z.string(),
        sourceDocument: z.string(),
        license: z.string(),
        attribution: z.string()
      })
      .strict(),
    creatures: z.array(creatureSchema)
  })
  .strict()

const catalog = documentSchema.parse(catalogDocument)
export const creatures: readonly Creature[] = Object.freeze(catalog.creatures)
const byId = new Map(creatures.map((creature) => [creature.id, creature]))

export class CreatureCatalogService {
  constructor(
    private readonly installationPath: string,
    private readonly sourceResolver?: (
      query: CreatureCatalogQuery
    ) => ResolvedEncounterSource,
    private readonly referenceOptions?: () => ReferenceOptions
  ) {}

  search(input: CreatureCatalogQuery): CreatureCatalogPage {
    const query = creatureCatalogQuerySchema.parse(input)
    const source = this.sourceResolver?.(query)
    const allowed =
      source?.candidates === null || source === undefined
        ? null
        : new Set(
            source.candidates
              .filter(
                (candidate) =>
                  candidate.maximum === null || candidate.maximum > 0
              )
              .map((candidate) => candidate.creatureId)
          )
    const direction = query.direction === 'asc' ? 1 : -1
    const matching = creatures
      .filter(
        (creature) =>
          (allowed === null || allowed.has(creature.id)) &&
          creatureMatchesQuery(creature, query)
      )
      .toSorted((left, right) => {
        const primary =
          query.sort === 'cr'
            ? left.cr - right.cr
            : query.sort === 'xp'
              ? left.xp - right.xp
              : left.name.localeCompare(right.name)
        return (
          primary * direction ||
          left.name.localeCompare(right.name) ||
          left.id.localeCompare(right.id)
        )
      })
    const rows = matching.slice(query.offset, query.offset + query.limit)
    return creatureCatalogPageSchema.parse({
      status: rows.length === 0 ? 'empty' : 'ready',
      rows,
      total: matching.length,
      offset: query.offset,
      limit: query.limit,
      message:
        rows.length === 0
          ? source?.catalogFallback
            ? 'Keine Monster entsprechen den Filtern. Katalog-Fallback ist aktiv.'
            : 'Keine Monster entsprechen den Quellen und Filtern.'
          : source?.catalogFallback &&
              (query.encounterTableIds.length > 0 ||
                query.factionIds.length > 0 ||
                query.locationId !== null)
            ? 'Keine wirksame Encounter-Tabelle; der Monsterkatalog wird verwendet.'
            : ''
    })
  }

  filterOptions(): CreatureFilterOptions {
    const db = this.open()
    try {
      const references = this.referenceOptions?.() ?? {
        encounterTables: [],
        factions: [],
        locations: []
      }
      const strings = (sql: string) =>
        (db.prepare(sql).all() as { value: string }[]).map((row) => row.value)
      return creatureFilterOptionsSchema.parse({
        challengeRatings: strings(
          'SELECT DISTINCT challenge_rating_text AS value FROM creatures ORDER BY challenge_rating, value'
        ),
        sizes: strings(
          'SELECT DISTINCT size AS value FROM creatures ORDER BY value'
        ),
        types: strings(
          'SELECT DISTINCT creature_type AS value FROM creatures ORDER BY value'
        ),
        subtypes: strings(
          'SELECT DISTINCT subtype AS value FROM creature_subtypes ORDER BY value'
        ),
        biomes: strings(
          'SELECT DISTINCT biome AS value FROM creature_biomes ORDER BY value'
        ),
        alignments: strings(
          'SELECT DISTINCT alignment AS value FROM creatures ORDER BY value'
        ),
        encounterTables: references.encounterTables,
        factions: references.factions,
        locations: references.locations
      })
    } finally {
      db.close()
    }
  }

  detail(id: string): Creature {
    const db = this.open()
    try {
      const row = db
        .prepare('SELECT detail_json AS detailJson FROM creatures WHERE id = ?')
        .get(id) as { detailJson: string } | undefined
      if (!row) throw new Error('not found')
      return creatureSchema.parse(JSON.parse(row.detailJson))
    } finally {
      db.close()
    }
  }

  private open(): Database.Database {
    const db = new Database(this.installationPath)
    initializeCreatureSchema(db)
    return db
  }
}

export function creatureMatchesQuery(
  creature: Creature,
  query: CreatureCatalogQuery
): boolean {
  const name = query.name.trim().toLocaleLowerCase()
  return (
    creature.name.toLocaleLowerCase().includes(name) &&
    (query.crMin === undefined || creature.cr >= query.crMin) &&
    (query.crMax === undefined || creature.cr <= query.crMax) &&
    selectedIncludes(query.sizes, creature.size) &&
    selectedIncludes(query.types, creature.type) &&
    selectedIncludes(query.subtypes, creature.subtype) &&
    selectedIncludes(query.alignments, creature.alignment) &&
    (query.biomes.length === 0 ||
      creature.biomes.some((biome) => query.biomes.includes(biome)))
  )
}

function selectedIncludes(values: readonly string[], value: string): boolean {
  return values.length === 0 || values.includes(value)
}

export function initializeCreatureSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS creature_catalog_metadata (
      singleton INTEGER PRIMARY KEY NOT NULL CHECK(singleton = 1),
      catalog_version TEXT NOT NULL,
      content_hash TEXT NOT NULL,
      attribution TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS creatures (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      size TEXT NOT NULL,
      creature_type TEXT NOT NULL,
      alignment TEXT NOT NULL,
      challenge_rating REAL NOT NULL,
      challenge_rating_text TEXT NOT NULL,
      xp INTEGER NOT NULL,
      hp INTEGER NOT NULL,
      ac INTEGER NOT NULL,
      detail_json TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS creature_biomes (
      creature_id TEXT NOT NULL REFERENCES creatures(id) ON DELETE CASCADE,
      biome TEXT NOT NULL,
      PRIMARY KEY (creature_id, biome)
    );
    CREATE TABLE IF NOT EXISTS creature_subtypes (
      creature_id TEXT NOT NULL REFERENCES creatures(id) ON DELETE CASCADE,
      subtype TEXT NOT NULL,
      PRIMARY KEY (creature_id, subtype)
    );
    CREATE TABLE IF NOT EXISTS creature_actions (
      creature_id TEXT NOT NULL REFERENCES creatures(id) ON DELETE CASCADE,
      action_kind TEXT NOT NULL,
      position INTEGER NOT NULL,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      PRIMARY KEY (creature_id, action_kind, position)
    );
    CREATE INDEX IF NOT EXISTS idx_creatures_name ON creatures(name COLLATE NOCASE);
    CREATE INDEX IF NOT EXISTS idx_creatures_cr ON creatures(challenge_rating);
    CREATE INDEX IF NOT EXISTS idx_creatures_type ON creatures(creature_type);
    CREATE INDEX IF NOT EXISTS idx_creature_biomes_biome ON creature_biomes(biome);
    CREATE INDEX IF NOT EXISTS idx_creature_subtypes_subtype ON creature_subtypes(subtype);
  `)
  const metadata = db
    .prepare(
      'SELECT content_hash AS contentHash FROM creature_catalog_metadata WHERE singleton = 1'
    )
    .get() as { contentHash: string } | undefined
  if (metadata?.contentHash === catalog.manifest.sourceHash) return
  db.transaction(() => {
    db.exec(`
      DELETE FROM creature_actions;
      DELETE FROM creature_biomes;
      DELETE FROM creature_subtypes;
      DELETE FROM creatures;
      DELETE FROM creature_catalog_metadata;
    `)
    const insertCreature = db.prepare(`
      INSERT INTO creatures (
        id, name, size, creature_type, alignment, challenge_rating,
        challenge_rating_text, xp, hp, ac, detail_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    const insertBiome = db.prepare(
      'INSERT INTO creature_biomes (creature_id, biome) VALUES (?, ?)'
    )
    const insertSubtype = db.prepare(
      'INSERT INTO creature_subtypes (creature_id, subtype) VALUES (?, ?)'
    )
    const insertAction = db.prepare(`
      INSERT INTO creature_actions (
        creature_id, action_kind, position, name, description
      ) VALUES (?, ?, ?, ?, ?)
    `)
    for (const creature of creatures) {
      insertCreature.run(
        creature.id,
        creature.name,
        creature.size,
        creature.type,
        creature.alignment,
        creature.cr,
        creature.challengeRating,
        creature.xp,
        creature.hp,
        creature.ac,
        JSON.stringify(creature)
      )
      for (const biome of creature.biomes) insertBiome.run(creature.id, biome)
      if (creature.subtype) insertSubtype.run(creature.id, creature.subtype)
      const sets = [
        ['trait', creature.traits],
        ['action', creature.actions],
        ['legendary', creature.legendaryActions]
      ] as const
      for (const [kind, actions] of sets)
        actions.forEach((action, position) =>
          insertAction.run(
            creature.id,
            kind,
            position,
            action.name,
            action.description
          )
        )
    }
    db.prepare(
      `
      INSERT INTO creature_catalog_metadata (
        singleton, catalog_version, content_hash, attribution
      ) VALUES (1, ?, ?, ?)
    `
    ).run(
      catalog.manifest.catalogVersion,
      catalog.manifest.sourceHash,
      catalog.manifest.attribution
    )
  })()
}

export function searchCreatures(
  name = '',
  crMin?: number,
  crMax?: number,
  type?: string,
  limit = 30
): readonly Creature[] {
  const normalized = name.toLowerCase()
  return creatures
    .filter(
      (creature) =>
        creature.name.toLowerCase().includes(normalized) &&
        (crMin === undefined || creature.cr >= crMin) &&
        (crMax === undefined || creature.cr <= crMax) &&
        (!type || creature.type.toLowerCase().includes(type.toLowerCase()))
    )
    .slice(0, limit)
}

export function creatureById(id: string): Creature | undefined {
  return byId.get(id)
}
