import {
  lootCatalogPageSchema,
  lootCatalogQuerySchema,
  type LootCatalogEntry,
  type LootCatalogPage,
  type LootCatalogQuery
} from '../../shared/contracts/loot.js'
import { CapabilityError } from '../../shared/errors/capability-error.js'
import { compareText } from '../session-generation/deterministic-order.js'
import {
  lootRarities,
  type FullSessionGenerationCatalog
} from '../session-generation/loot-catalog.js'
import { roundHalfUp } from '../session-generation/rational.js'

export type LootCatalogPort = Readonly<{
  loadFull(): FullSessionGenerationCatalog
}>

export class LootCatalogService {
  constructor(private readonly catalog: LootCatalogPort) {}

  search(raw: LootCatalogQuery): LootCatalogPage {
    const query = lootCatalogQuerySchema.parse(raw)
    const catalog = this.catalog.loadFull()
    if (catalog.encounter.catalogContentHash !== query.catalogContentHash)
      throw new CapabilityError('stale', true)

    const entries = projectEntries(catalog)
    const matching = entries
      .filter((entry) => matches(entry, query))
      .toSorted(compareEntries)
    return deepFreeze(
      lootCatalogPageSchema.parse({
        catalogContentHash: catalog.encounter.catalogContentHash,
        entries: matching.slice(query.offset, query.offset + query.limit),
        total: matching.length,
        offset: query.offset,
        limit: query.limit,
        filterOptions: {
          types: uniqueSorted(entries.map((entry) => entry.type)),
          categories: uniqueSorted(
            entries.flatMap((entry) =>
              entry.category === null ? [] : [entry.category]
            )
          ),
          rarities: lootRarities.filter((rarity) =>
            entries.some(
              (entry) => entry.kind === 'magic_item' && entry.rarity === rarity
            )
          )
        }
      })
    )
  }
}

export function projectLootCatalogEntries(
  catalog: FullSessionGenerationCatalog
): readonly LootCatalogEntry[] {
  return deepFreeze(projectEntries(catalog).toSorted(compareEntries))
}

function projectEntries(
  catalog: FullSessionGenerationCatalog
): LootCatalogEntry[] {
  return [
    ...catalog.items
      .filter((item) => item.active)
      .map((item): LootCatalogEntry => ({
        kind: 'item',
        id: item.id,
        defaultName: item.name,
        type: item.lootType,
        category: item.category,
        unitValueCp: Math.max(0, roundHalfUp(item.baseCp)),
        stackable: item.valueForm === 'Quantity_Good',
        magic: false,
        rarity: null
      })),
    ...catalog.magicItems
      .filter((item) => item.active)
      .map((item): LootCatalogEntry => ({
        kind: 'magic_item',
        id: item.id,
        defaultName: item.item,
        type: item.type,
        category: null,
        unitValueCp: 0,
        stackable: false,
        magic: true,
        rarity: item.rarity
      })),
    ...catalog.containers
      .filter((container) => !container.hidden)
      .map((container): LootCatalogEntry => ({
        kind: 'container',
        id: container.id,
        defaultName: container.name,
        type: 'container',
        category: null,
        capacity: container.capacity
      }))
  ]
}

function matches(entry: LootCatalogEntry, query: LootCatalogQuery): boolean {
  const search = query.search.toLowerCase()
  return (
    entry.defaultName.toLowerCase().includes(search) &&
    (query.types.length === 0 || query.types.includes(entry.type)) &&
    (query.categories.length === 0 ||
      (entry.category !== null && query.categories.includes(entry.category))) &&
    (query.rarities.length === 0 ||
      (entry.kind === 'magic_item' && query.rarities.includes(entry.rarity)))
  )
}

function compareEntries(
  left: LootCatalogEntry,
  right: LootCatalogEntry
): number {
  return (
    compareText(left.defaultName, right.defaultName) ||
    compareText(left.kind, right.kind) ||
    compareText(left.id, right.id)
  )
}

function uniqueSorted(values: readonly string[]): readonly string[] {
  return [...new Set(values)].toSorted(compareText)
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value)
    for (const child of Object.values(value as Record<string, unknown>))
      deepFreeze(child)
  }
  return value
}
