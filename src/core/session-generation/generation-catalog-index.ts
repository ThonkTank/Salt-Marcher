import type {
  FullSessionGenerationCatalog,
  LootAdornmentTypeId,
  LootCatalogItem,
  LootCategoryId,
  LootModifier,
  LootProfileId,
  LootRarity
} from './loot-catalog.js'

export type GenerationCatalogIndex = Readonly<{
  catalog: FullSessionGenerationCatalog
  activeItems: readonly LootCatalogItem[]
  itemsById: ReadonlyMap<string, LootCatalogItem>
  themeCategoryIds: ReadonlyMap<string, ReadonlySet<LootCategoryId>>
  modifiersByCategoryId: ReadonlyMap<LootCategoryId, readonly LootModifier[]>
  modifiersByProfileId: ReadonlyMap<LootProfileId, readonly LootModifier[]>
  adornmentItemsByTypeId: ReadonlyMap<
    LootAdornmentTypeId,
    readonly LootCatalogItem[]
  >
  magicItemsByRarity: ReadonlyMap<
    LootRarity,
    FullSessionGenerationCatalog['magicItems']
  >
  magicVariantsByGroup: ReadonlyMap<
    string,
    FullSessionGenerationCatalog['magicVariants']
  >
  spellsByLevel: ReadonlyMap<number, FullSessionGenerationCatalog['spells']>
  enspelledRulesByRarity: ReadonlyMap<
    LootRarity,
    FullSessionGenerationCatalog['enspelledRules']
  >
  activeCurses: FullSessionGenerationCatalog['curses']
}>

export function createGenerationCatalogIndex(
  catalog: FullSessionGenerationCatalog
): GenerationCatalogIndex {
  const activeItems = Object.freeze(catalog.items.filter((item) => item.active))
  return Object.freeze({
    catalog,
    activeItems,
    itemsById: new Map(catalog.items.map((item) => [item.id, item])),
    themeCategoryIds: groupedSets(
      catalog.relations
        .filter(
          (relation) => relation.active && relation.type === 'THEME_CATEGORY'
        )
        .map((relation) => [
          relation.sourceId,
          relation.targetId as LootCategoryId
        ])
    ),
    modifiersByCategoryId: groupedValues(
      catalog.modifiers.flatMap((modifier) =>
        modifier.allowedCategoryIds.map(
          (categoryId) => [categoryId, modifier] as const
        )
      )
    ),
    modifiersByProfileId: groupedValues(
      catalog.modifiers.flatMap((modifier) =>
        modifier.allowedProfileIds.map(
          (profileId) => [profileId, modifier] as const
        )
      )
    ),
    adornmentItemsByTypeId: groupedValues(
      activeItems.flatMap((item) =>
        item.adornmentTypeId ? [[item.adornmentTypeId, item] as const] : []
      )
    ),
    magicItemsByRarity: groupedValues(
      catalog.magicItems
        .filter((item) => item.active)
        .map((item) => [item.rarity, item] as const)
    ),
    magicVariantsByGroup: groupedValues(
      catalog.magicVariants
        .filter((variant) => variant.active)
        .map((variant) => [variant.groupKey, variant] as const)
    ),
    spellsByLevel: groupedValues(
      catalog.spells.map((spell) => [spell.level, spell] as const)
    ),
    enspelledRulesByRarity: groupedValues(
      catalog.enspelledRules
        .filter((rule) => rule.active)
        .map((rule) => [rule.rarity, rule] as const)
    ),
    activeCurses: Object.freeze(catalog.curses.filter((curse) => curse.active))
  })
}

export function indexedModifiersForItem(
  index: GenerationCatalogIndex,
  item: LootCatalogItem
): readonly LootModifier[] {
  const byId = new Map<string, LootModifier>()
  for (const modifier of index.modifiersByCategoryId.get(item.categoryId) ?? [])
    byId.set(modifier.id, modifier)
  for (const profileId of item.modularProfileIds)
    for (const modifier of index.modifiersByProfileId.get(profileId) ?? [])
      byId.set(modifier.id, modifier)
  return Object.freeze([...byId.values()])
}

function groupedValues<K, V>(
  entries: readonly (readonly [K, V])[]
): ReadonlyMap<K, readonly V[]> {
  const result = new Map<K, V[]>()
  for (const [key, value] of entries) {
    const values = result.get(key) ?? []
    values.push(value)
    result.set(key, values)
  }
  return new Map(
    [...result].map(([key, values]) => [key, Object.freeze(values)] as const)
  )
}

function groupedSets<K, V>(
  entries: readonly (readonly [K, V])[]
): ReadonlyMap<K, ReadonlySet<V>> {
  const result = new Map<K, Set<V>>()
  for (const [key, value] of entries) {
    const values = result.get(key) ?? new Set<V>()
    values.add(value)
    result.set(key, values)
  }
  return result
}
