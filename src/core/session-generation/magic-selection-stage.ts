import type {
  ItemDefinition,
  ItemReference
} from '../../shared/contracts/loot.js'
import type { GeneratorLootRules } from '../../shared/contracts/generator-loot-rules.js'
import { defaultGeneratorLootRules } from '../../shared/generator/default-loot-rules.js'
import type { RewardRandom } from './reward-random.js'
import type { GenerationCatalogIndex } from './generation-catalog-index.js'
import {
  lootRarities,
  rarityIndex,
  type LootRarity,
  type LootTheme,
  type MagicItem
} from './loot-catalog.js'
import {
  freezeStage,
  type RewardItemDraft,
  type SelectedTreasureDraft
} from './reward-stage-types.js'

export type MagicSelectionInput = Readonly<{
  runId: string
  treasures: readonly SelectedTreasureDraft[]
  targets: Readonly<Record<LootRarity, number>>
  catalogIndex: GenerationCatalogIndex
  rules?: GeneratorLootRules
}>

/**
 * Preconditions: non-magic selection is complete. Postconditions: magic items
 * are globally unique, distributed round-robin, resolved from typed entropy
 * streams, and returned as immutable Treasure drafts.
 */
export function selectMagicItems(
  input: MagicSelectionInput,
  random: RewardRandom
): readonly SelectedTreasureDraft[] {
  if (input.treasures.length === 0) throw new Error('missing_treasure_plan')
  const rules = input.rules ?? defaultGeneratorLootRules
  const usedItems = new Set(
    input.treasures.flatMap((treasure) =>
      treasure.items.flatMap((item) =>
        [
          item.definition.components.baseItemId,
          item.definition.components.magicItemId
        ].filter((id): id is string => id !== null)
      )
    )
  )
  const items = input.treasures.map((treasure) => [...treasure.items])
  const magicTotal = Object.values(input.targets).reduce(
    (sum, count) => sum + count,
    0
  )
  const overstockTarget = Math.round(magicTotal * rules.magic.overstockShare)
  let ordinal = 0
  for (const rarity of lootRarities)
    for (let count = 0; count < input.targets[rarity]; count += 1) {
      const desiredStock =
        ordinal < overstockTarget ? ('overstock' as const) : ('normal' as const)
      const eligibleTreasures = input.treasures
        .map((treasure, index) => ({ treasure, index }))
        .filter(({ treasure }) => treasure.stockClass === desiredStock)
      const targetTreasures =
        eligibleTreasures.length > 0
          ? eligibleTreasures
          : input.treasures.map((treasure, index) => ({ treasure, index }))
      const treasureIndex =
        targetTreasures[ordinal % targetTreasures.length]!.index
      const treasure = input.treasures[treasureIndex]!
      const available = (
        input.catalogIndex.magicItemsByRarity.get(rarity) ?? []
      ).filter(
        (item) =>
          item.decisionType === 'enspelled_item' || !usedItems.has(item.id)
      )
      const themed = available.filter(
        (item) => item.type === treasure.theme.magicType
      )
      const pool = themed.length > 0 ? themed : available
      if (pool.length === 0) continue
      const magic =
        pool[random.modulo(`magic-item:${rarity}`, ordinal, pool.length)]!
      if (magic.decisionType !== 'enspelled_item') usedItems.add(magic.id)
      const resolution = resolveMagicItem(
        magic,
        treasure.theme,
        ordinal,
        input.catalogIndex,
        random
      )
      const curse = resolveCurse(
        magic,
        resolution.baseItemId,
        ordinal,
        input.catalogIndex,
        rules,
        random
      )
      const itemId = `${treasure.id}:item:${items[treasureIndex]!.length + 1}`
      const itemReference = generatedItemReference(input.runId, itemId)
      const definition: ItemDefinition = {
        reference: itemReference,
        name: resolution.name,
        unitValueCp: 0,
        unitCapacity: resolution.unitCapacity,
        stackable: false,
        magic: true,
        rarity,
        curse: curse
          ? {
              catalogId: curse.id,
              name: curse.name,
              effect: curse.effect
            }
          : null,
        components: {
          baseItemId: resolution.baseItemId,
          modifierId: null,
          componentId: null,
          magicItemId: magic.id,
          magicVariantId: resolution.magicVariantId,
          spellId: resolution.spellId,
          enspelledRuleId: resolution.enspelledRuleId,
          curseId: curse?.id ?? null,
          coinDenominations: []
        }
      }
      const selected: RewardItemDraft = {
        id: itemId,
        treasureId: treasure.id,
        itemReference,
        definition,
        role: 'magic',
        quantity: 1
      }
      items[treasureIndex]!.push(selected)
      ordinal += 1
    }
  return freezeStage(
    input.treasures.map((treasure, index) => ({
      ...treasure,
      items: items[index]!
    }))
  )
}

function resolveMagicItem(
  item: MagicItem,
  theme: LootTheme,
  ordinal: number,
  catalogIndex: GenerationCatalogIndex,
  random: RewardRandom
): Readonly<{
  name: string
  baseItemId: string | null
  magicVariantId: string | null
  spellId: string | null
  enspelledRuleId: string | null
  unitCapacity: number
}> {
  const plain = (name = item.item) => ({
    name,
    baseItemId: null,
    magicVariantId: null,
    spellId: null,
    enspelledRuleId: null,
    unitCapacity: 0
  })
  if (item.decisionType === 'fixed_variant')
    return plain(item.info1 ? `${item.item} · ${item.info1}` : item.item)
  if (item.decisionType === 'variant_group' && item.info1) {
    const variants = catalogIndex.magicVariantsByGroup.get(item.info1) ?? []
    const variant =
      variants[
        random.modulo(
          `magic-variant:${item.id}`,
          ordinal,
          Math.max(1, variants.length)
        )
      ]
    return {
      ...plain(variant ? `${item.item} · ${variant.option}` : item.item),
      magicVariantId: variant?.id ?? null
    }
  }
  if (item.decisionType === 'spell_level') {
    const minimum = Number(item.info1 ?? 0)
    const maximum = Number(item.info2 ?? minimum)
    const spells = Array.from(
      { length: Math.max(0, maximum - minimum + 1) },
      (_, offset) => catalogIndex.spellsByLevel.get(minimum + offset) ?? []
    ).flat()
    const themed = spells.filter((spell) =>
      spell.elements.some((element) => theme.spellColors.includes(element))
    )
    const pool = themed.length > 0 ? themed : spells
    const spell =
      pool[
        random.modulo(
          `magic-spell:${item.id}`,
          ordinal,
          Math.max(1, pool.length)
        )
      ]
    return {
      ...plain(spell ? `${item.item} · ${spell.name}` : item.item),
      spellId: spell?.id ?? null
    }
  }
  if (item.decisionType === 'enspelled_item') {
    const rules = (
      catalogIndex.enspelledRulesByRarity.get(item.rarity) ?? []
    ).filter((rule) => !item.info1 || rule.chassis === item.info1)
    const rule =
      rules[
        random.modulo(
          `enspelled-rule:${item.id}`,
          ordinal,
          Math.max(1, rules.length)
        )
      ]
    if (!rule) return plain()
    const bases = rule.baseItemIds
      .map((id) => catalogIndex.itemsById.get(id))
      .filter((candidate): candidate is NonNullable<typeof candidate> =>
        Boolean(
          candidate &&
          candidate.active &&
          candidate.lootTypeId === 'loot-type:object' &&
          candidate.capacity <= rule.maxBaseCapacity
        )
      )
    const base =
      bases[
        random.modulo(
          `enspelled-base:${item.id}`,
          ordinal,
          Math.max(1, bases.length)
        )
      ]
    const spells = catalogIndex.spellsByLevel.get(rule.spellLevel) ?? []
    const spell =
      spells[
        random.modulo(
          `enspelled-spell:${item.id}`,
          ordinal,
          Math.max(1, spells.length)
        )
      ]
    return {
      name: `Enspelled ${base?.name ?? item.item}${spell ? ` · ${spell.name}` : ''}`,
      baseItemId: base?.id ?? null,
      magicVariantId: null,
      spellId: spell?.id ?? null,
      enspelledRuleId: rule.id,
      unitCapacity: base?.capacity ?? 0
    }
  }
  return plain()
}

function resolveCurse(
  item: MagicItem,
  baseItemId: string | null,
  ordinal: number,
  catalogIndex: GenerationCatalogIndex,
  rules: GeneratorLootRules,
  random: RewardRandom
) {
  if (
    random.unit(`curse-chance:${item.id}`, ordinal) >= rules.magic.curseChance
  )
    return null
  const itemRarity = rarityIndex(item.rarity)
  const curseContextId =
    (baseItemId ? catalogIndex.itemsById.get(baseItemId)?.categoryId : null) ??
    `magic-type:${item.type.toLowerCase()}`
  const candidates = catalogIndex.activeCurses.filter(
    (curse) =>
      rarityIndex(curse.minRarity) <= itemRarity &&
      rarityIndex(curse.maxRarity) >= itemRarity &&
      (curse.appliesToId === 'all' || curseContextId === curse.appliesToId)
  )
  if (candidates.length === 0) return null
  const totalWeight = candidates.reduce((sum, curse) => sum + curse.weight, 0)
  let roll = random.unit(`curse:${item.id}`, ordinal) * totalWeight
  for (const curse of candidates) {
    roll -= curse.weight
    if (roll <= 0) return curse
  }
  return candidates.at(-1) ?? null
}

function generatedItemReference(
  runId: string,
  itemId: string
): ItemReference & { kind: 'generated' } {
  return {
    kind: 'generated',
    runId,
    definitionId: itemId.replace(':item:', ':definition:')
  }
}
