import type {
  LootCatalogEntry,
  LootCatalogQuery
} from '../../shared/contracts/loot.js'
import { compareText } from '../session-generation/deterministic-order.js'
import {
  lootRarities,
  type FullSessionGenerationCatalog
} from '../session-generation/loot-catalog.js'
import { roundHalfUp } from '../session-generation/rational.js'
import type { ItemDefinition } from '../../shared/contracts/loot.js'

export type LootCatalogIndex = Readonly<{
  catalogVersion: string
  catalogContentHash: string
  entries: readonly LootCatalogEntry[]
  filterOptions: Readonly<{
    types: readonly string[]
    categories: readonly string[]
    rarities: readonly (typeof lootRarities)[number][]
  }>
  items: ReadonlyMap<string, FullSessionGenerationCatalog['items'][number]>
  magicItems: ReadonlyMap<
    string,
    FullSessionGenerationCatalog['magicItems'][number]
  >
  containers: ReadonlyMap<
    string,
    FullSessionGenerationCatalog['containers'][number]
  >
  search(query: LootCatalogQuery): readonly LootCatalogEntry[]
}>

type IndexedEntry = Readonly<{
  entry: LootCatalogEntry
  normalizedName: string
}>

export function createLootCatalogIndex(
  catalog: FullSessionGenerationCatalog
): LootCatalogIndex {
  const entries: LootCatalogEntry[] = [
    ...catalog.items
      .filter((item) => item.active)
      .map((item): LootCatalogEntry => {
        const definition = catalogDefinition(catalog, 'item', item.id)
        return {
          kind: 'item',
          id: item.id,
          defaultName: definition.name,
          type: item.lootTypeId.slice('loot-type:'.length),
          category: item.categoryId
            .slice('category:'.length)
            .replaceAll('-', '_'),
          unitValueCp: definition.unitValueCp,
          stackable: definition.stackable,
          magic: false,
          rarity: null,
          itemReference: definition.reference,
          definition
        }
      }),
    ...catalog.magicItems
      .filter((item) => item.active)
      .map((item): LootCatalogEntry => {
        const definition = catalogDefinition(catalog, 'magic_item', item.id)
        return {
          kind: 'magic_item',
          id: item.id,
          defaultName: definition.name,
          type: item.type,
          category: null,
          unitValueCp: 0,
          stackable: false,
          magic: true,
          rarity: item.rarity,
          itemReference: definition.reference,
          definition
        }
      }),
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
  ].toSorted(compareEntries)
  const frozenEntries = Object.freeze(
    entries.map((entry) => Object.freeze(entry))
  )
  const indexed: readonly IndexedEntry[] = frozenEntries.map((entry) => ({
    entry,
    normalizedName: normalizeSearch(entry.defaultName)
  }))
  const filterOptions = deepFreeze({
    types: uniqueSorted(frozenEntries.map((entry) => entry.type)),
    categories: uniqueSorted(
      frozenEntries.flatMap((entry) =>
        entry.category === null ? [] : [entry.category]
      )
    ),
    rarities: lootRarities.filter((rarity) =>
      frozenEntries.some(
        (entry) => entry.kind === 'magic_item' && entry.rarity === rarity
      )
    )
  })
  return Object.freeze({
    catalogVersion: catalog.encounter.catalogVersion,
    catalogContentHash: catalog.encounter.catalogContentHash,
    entries: frozenEntries,
    filterOptions,
    items: new Map(catalog.items.map((item) => [item.id, item])),
    magicItems: new Map(catalog.magicItems.map((item) => [item.id, item])),
    containers: new Map(
      catalog.containers.map((container) => [container.id, container])
    ),
    search(query: LootCatalogQuery): readonly LootCatalogEntry[] {
      const search = normalizeSearch(query.search)
      return Object.freeze(
        indexed
          .filter(({ entry, normalizedName }) =>
            matches(entry, normalizedName, search, query)
          )
          .map(({ entry }) => entry)
      )
    }
  })
}

function catalogDefinition(
  catalog: FullSessionGenerationCatalog,
  entryKind: 'item' | 'magic_item',
  catalogId: string
): ItemDefinition {
  const reference = {
    kind: 'catalog' as const,
    catalogVersion: catalog.encounter.catalogVersion,
    catalogContentHash: catalog.encounter.catalogContentHash,
    entryKind,
    catalogId
  }
  if (entryKind === 'item') {
    const item = catalog.items.find((candidate) => candidate.id === catalogId)!
    return Object.freeze({
      reference,
      name: item.name,
      unitValueCp: Math.max(0, roundHalfUp(item.baseCp)),
      unitCapacity: item.capacity,
      stackable: item.valueForm === 'quantity_good',
      magic: false,
      rarity: null,
      curse: null,
      components: {
        baseItemId: item.id,
        modifierId: null,
        componentId: null,
        magicItemId: null,
        magicVariantId: null,
        spellId: null,
        enspelledRuleId: null,
        curseId: null,
        coinDenominations: []
      }
    })
  }
  const item = catalog.magicItems.find(
    (candidate) => candidate.id === catalogId
  )!
  return Object.freeze({
    reference,
    name: item.item,
    unitValueCp: 0,
    unitCapacity: 1,
    stackable: false,
    magic: true,
    rarity: item.rarity,
    curse: null,
    components: {
      baseItemId: null,
      modifierId: null,
      componentId: null,
      magicItemId: item.id,
      magicVariantId: null,
      spellId: null,
      enspelledRuleId: null,
      curseId: null,
      coinDenominations: []
    }
  })
}

export class LootCatalogIndexCache {
  readonly #indexes = new Map<string, LootCatalogIndex>()

  constructor(
    private readonly load: (reference: {
      catalogVersion: string
      catalogContentHash: string
    }) => FullSessionGenerationCatalog
  ) {}

  require(reference: {
    catalogVersion: string
    catalogContentHash: string
  }): LootCatalogIndex {
    const existing = this.#indexes.get(reference.catalogContentHash)
    if (existing) {
      if (existing.catalogVersion !== reference.catalogVersion)
        throw new Error('Catalog reference does not match cached identity')
      return existing
    }
    const index = createLootCatalogIndex(this.load(reference))
    if (
      index.catalogVersion !== reference.catalogVersion ||
      index.catalogContentHash !== reference.catalogContentHash
    )
      throw new Error('Loaded catalog does not match requested identity')
    this.#indexes.set(reference.catalogContentHash, index)
    return index
  }
}

function matches(
  entry: LootCatalogEntry,
  normalizedName: string,
  search: string,
  query: LootCatalogQuery
): boolean {
  return (
    normalizedName.includes(search) &&
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
  return Object.freeze([...new Set(values)].toSorted(compareText))
}

function normalizeSearch(value: string): string {
  return value.normalize('NFKC').toLowerCase()
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value)
    for (const child of Object.values(value as Record<string, unknown>))
      deepFreeze(child)
  }
  return value
}
