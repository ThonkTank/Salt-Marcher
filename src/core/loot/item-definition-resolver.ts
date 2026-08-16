import type Database from 'better-sqlite3'
import {
  itemDefinitionSchema,
  itemReferenceKey,
  type ItemDefinition,
  type ItemReference
} from '../../shared/contracts/loot.js'
import type { LootCatalogIndex } from './loot-catalog-index.js'

export function initializeLegacyItemDefinitionSchema(
  db: Database.Database
): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS loot_legacy_item_definition (
      definition_id TEXT PRIMARY KEY NOT NULL,
      definition_json TEXT NOT NULL
    );
  `)
}

/** Resolves item facts at the read boundary; contextual owners store references only. */
export class ItemDefinitionResolver {
  constructor(
    private readonly db: Database.Database,
    private readonly requireCatalog: (reference: {
      catalogVersion: string
      catalogContentHash: string
    }) => LootCatalogIndex
  ) {}

  resolve(reference: ItemReference): ItemDefinition {
    if (reference.kind === 'generated') {
      const row = this.db
        .prepare(
          `SELECT definition_json AS definitionJson
             FROM session_generation_item_definition
            WHERE run_id = ? AND definition_id = ?`
        )
        .get(reference.runId, reference.definitionId) as
        { definitionJson: string } | undefined
      if (!row)
        throw new Error(
          `Generated item definition not found: ${itemReferenceKey(reference)}`
        )
      return parseMatching(row.definitionJson, reference)
    }
    if (reference.kind === 'legacy') {
      const row = this.db
        .prepare(
          `SELECT definition_json AS definitionJson
             FROM loot_legacy_item_definition WHERE definition_id = ?`
        )
        .get(reference.definitionId) as { definitionJson: string } | undefined
      if (!row)
        throw new Error(
          `Legacy item definition not found: ${itemReferenceKey(reference)}`
        )
      return parseMatching(row.definitionJson, reference)
    }
    const entry = this.requireCatalog(reference).entries.find(
      (candidate) =>
        candidate.kind === reference.entryKind &&
        candidate.id === reference.catalogId
    )
    if (!entry || entry.kind === 'container')
      throw new Error(
        `Catalog item definition not found: ${itemReferenceKey(reference)}`
      )
    return itemDefinitionSchema.parse(entry.definition)
  }

  resolveMany(
    references: readonly ItemReference[]
  ): ReadonlyMap<string, ItemDefinition> {
    const unique = new Map(
      references.map((reference) => [itemReferenceKey(reference), reference])
    )
    const result = new Map<string, ItemDefinition>()
    const generated = [...unique.values()].filter(
      (reference): reference is Extract<ItemReference, { kind: 'generated' }> =>
        reference.kind === 'generated'
    )
    if (generated.length > 0) {
      const runIds = [...new Set(generated.map((reference) => reference.runId))]
      const wanted = new Set(generated.map(itemReferenceKey))
      const rows = this.db
        .prepare(
          `SELECT reference_json AS referenceJson, definition_json AS definitionJson
             FROM session_generation_item_definition
            WHERE run_id IN (SELECT value FROM json_each(?))`
        )
        .all(JSON.stringify(runIds)) as Array<{
        referenceJson: string
        definitionJson: string
      }>
      for (const row of rows) {
        const reference = JSON.parse(row.referenceJson) as ItemReference
        const key = itemReferenceKey(reference)
        if (wanted.has(key))
          result.set(key, parseMatching(row.definitionJson, reference))
      }
    }
    const legacy = [...unique.values()].filter(
      (reference): reference is Extract<ItemReference, { kind: 'legacy' }> =>
        reference.kind === 'legacy'
    )
    if (legacy.length > 0) {
      const rows = this.db
        .prepare(
          `SELECT definition_id AS definitionId, definition_json AS definitionJson
             FROM loot_legacy_item_definition
            WHERE definition_id IN (SELECT value FROM json_each(?))`
        )
        .all(
          JSON.stringify(legacy.map((reference) => reference.definitionId))
        ) as Array<{
        definitionId: string
        definitionJson: string
      }>
      for (const row of rows) {
        const reference = {
          kind: 'legacy' as const,
          definitionId: row.definitionId
        }
        result.set(
          itemReferenceKey(reference),
          parseMatching(row.definitionJson, reference)
        )
      }
    }
    for (const reference of unique.values())
      if (reference.kind === 'catalog')
        result.set(itemReferenceKey(reference), this.resolve(reference))
    if (result.size !== unique.size)
      throw new Error('One or more item definitions could not be resolved')
    return result
  }

  saveLegacy(definition: ItemDefinition): void {
    if (definition.reference.kind !== 'legacy')
      throw new Error('Only legacy definitions may be stored outside a run')
    const parsed = itemDefinitionSchema.parse(definition)
    const reference = parsed.reference
    if (reference.kind !== 'legacy')
      throw new Error('Only legacy definitions may be stored outside a run')
    const existing = this.db
      .prepare(
        `SELECT definition_json AS definitionJson
           FROM loot_legacy_item_definition WHERE definition_id = ?`
      )
      .get(reference.definitionId) as { definitionJson: string } | undefined
    const encoded = JSON.stringify(parsed)
    if (existing && existing.definitionJson !== encoded)
      throw new Error('Legacy item definition identity is immutable')
    if (!existing)
      this.db
        .prepare(
          `INSERT INTO loot_legacy_item_definition (definition_id, definition_json)
           VALUES (?, ?)`
        )
        .run(reference.definitionId, encoded)
  }
}

function parseMatching(
  encoded: string,
  reference: ItemReference
): ItemDefinition {
  const definition = itemDefinitionSchema.parse(JSON.parse(encoded))
  if (itemReferenceKey(definition.reference) !== itemReferenceKey(reference))
    throw new Error(
      'Persisted item definition reference does not match its key'
    )
  return definition
}
