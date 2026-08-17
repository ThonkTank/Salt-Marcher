import type { EncounterEntropy } from './deterministic-order.js'
import type {
  ItemDefinition,
  ItemReference
} from '../../shared/contracts/loot.js'
import type { GeneratorLootRules } from '../../shared/contracts/generator-loot-rules.js'
import { defaultGeneratorLootRules } from '../../shared/generator/default-loot-rules.js'
import { magicSelectionStream } from './entropy-streams.js'
import {
  lootRarities,
  rarityIndex,
  type FullSessionGenerationCatalog,
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
  seed: number
  treasures: readonly SelectedTreasureDraft[]
  targets: Readonly<Record<LootRarity, number>>
  catalog: FullSessionGenerationCatalog
  rules?: GeneratorLootRules
}>

/**
 * Preconditions: non-magic selection is complete. Postconditions: magic items
 * are globally unique, distributed round-robin, resolved from typed entropy
 * streams, and returned as immutable Treasure drafts.
 */
export function selectMagicItems(
  input: MagicSelectionInput,
  entropy: EncounterEntropy
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
      const available = input.catalog.magicItems.filter(
        (item) =>
          item.active &&
          item.rarity === rarity &&
          (item.decisionType === 'enspelled_item' || !usedItems.has(item.id))
      )
      const themed = available.filter(
        (item) => item.type === treasure.theme.magicType
      )
      const pool = themed.length > 0 ? themed : available
      if (pool.length === 0) continue
      const magic =
        pool[
          entropy.modulo(
            magicSelectionStream(input.seed, 'magic-item', rarity, ordinal),
            pool.length
          )
        ]!
      if (magic.decisionType !== 'enspelled_item') usedItems.add(magic.id)
      const resolution = resolveMagicItem(
        magic,
        treasure.theme,
        input.seed,
        ordinal,
        input.catalog,
        entropy
      )
      const curse = resolveCurse(
        magic,
        resolution.baseItemId,
        input.seed,
        ordinal,
        input.catalog,
        rules,
        entropy
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
  seed: number,
  ordinal: number,
  catalog: FullSessionGenerationCatalog,
  entropy: EncounterEntropy
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
    const variants = catalog.magicVariants.filter(
      (variant) => variant.active && variant.groupKey === item.info1
    )
    const variant =
      variants[
        entropy.modulo(
          magicSelectionStream(seed, 'magic-variant', item.id, ordinal),
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
    const spells = catalog.spells.filter(
      (spell) => spell.level >= minimum && spell.level <= maximum
    )
    const themed = spells.filter((spell) =>
      spell.elements.some((element) => theme.spellColors.includes(element))
    )
    const pool = themed.length > 0 ? themed : spells
    const spell =
      pool[
        entropy.modulo(
          magicSelectionStream(seed, 'magic-spell', item.id, ordinal),
          Math.max(1, pool.length)
        )
      ]
    return {
      ...plain(spell ? `${item.item} · ${spell.name}` : item.item),
      spellId: spell?.id ?? null
    }
  }
  if (item.decisionType === 'enspelled_item') {
    const rules = catalog.enspelledRules.filter(
      (rule) =>
        rule.active &&
        rule.rarity === item.rarity &&
        (!item.info1 || rule.chassis === item.info1)
    )
    const rule =
      rules[
        entropy.modulo(
          magicSelectionStream(seed, 'enspelled-rule', item.id, ordinal),
          Math.max(1, rules.length)
        )
      ]
    if (!rule) return plain()
    const matcher = new RegExp(rule.baseItemRegex, 'i')
    const bases = catalog.items.filter(
      (candidate) =>
        candidate.active &&
        candidate.lootType === 'object' &&
        candidate.capacity <= rule.maxBaseCapacity &&
        (matcher.test(candidate.category) || matcher.test(candidate.name))
    )
    const base =
      bases[
        entropy.modulo(
          magicSelectionStream(seed, 'enspelled-base', item.id, ordinal),
          Math.max(1, bases.length)
        )
      ]
    const spells = catalog.spells.filter(
      (spell) => spell.level === rule.spellLevel
    )
    const spell =
      spells[
        entropy.modulo(
          magicSelectionStream(seed, 'enspelled-spell', item.id, ordinal),
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
  seed: number,
  ordinal: number,
  catalog: FullSessionGenerationCatalog,
  rules: GeneratorLootRules,
  entropy: EncounterEntropy
) {
  if (
    entropy.unit(
      magicSelectionStream(seed, 'curse-chance', item.id, ordinal)
    ) >= rules.magic.curseChance
  )
    return null
  const itemRarity = rarityIndex(item.rarity)
  const curseContext =
    (baseItemId
      ? catalog.items.find((candidate) => candidate.id === baseItemId)?.category
      : null) ?? item.type
  const candidates = catalog.curses.filter(
    (curse) =>
      curse.active &&
      rarityIndex(curse.minRarity) <= itemRarity &&
      rarityIndex(curse.maxRarity) >= itemRarity &&
      (curse.appliesTo === 'all' ||
        relationKey(curseContext) === relationKey(curse.appliesTo))
  )
  if (candidates.length === 0) return null
  const totalWeight = candidates.reduce((sum, curse) => sum + curse.weight, 0)
  let roll =
    entropy.unit(magicSelectionStream(seed, 'curse', item.id, ordinal)) *
    totalWeight
  for (const curse of candidates) {
    roll -= curse.weight
    if (roll <= 0) return curse
  }
  return candidates.at(-1) ?? null
}

function relationKey(value: string): string {
  return value.toLowerCase().replaceAll(/[^a-z0-9]/g, '')
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
