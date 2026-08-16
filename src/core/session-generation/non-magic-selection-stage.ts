import type { EncounterEntropy } from './deterministic-order.js'
import type { GeneratorLootRules } from '../../shared/contracts/generator-loot-rules.js'
import { defaultGeneratorLootRules } from '../../shared/generator/default-loot-rules.js'
import { compareText } from './deterministic-order.js'
import { itemSelectionStream } from './entropy-streams.js'
import type {
  FullSessionGenerationCatalog,
  LootCatalogItem,
  LootTheme
} from './loot-catalog.js'
import {
  absolute,
  add,
  compare,
  divide,
  multiply,
  rational,
  roundHalfUp,
  subtract
} from './rational.js'
import {
  freezeStage,
  type LootRole,
  type RewardItemDraft,
  type RolePlannedTreasure,
  type SelectedTreasureDraft
} from './reward-stage-types.js'

export type NonMagicSelectionInput = Readonly<{
  seed: number
  treasures: readonly RolePlannedTreasure[]
  catalog: FullSessionGenerationCatalog
  rules?: GeneratorLootRules
}>

/**
 * Preconditions: roles and slot budgets are already planned. Postconditions:
 * catalog items are unique across this reward, arithmetic values are integral
 * copper, and the caller's plans/catalog remain untouched.
 */
export function selectNonMagicItems(
  input: NonMagicSelectionInput,
  entropy: EncounterEntropy
): readonly SelectedTreasureDraft[] {
  const usedItems = new Set<string>()
  const usedCategories = new Map<string, number>()
  const rules = input.rules ?? defaultGeneratorLootRules
  return freezeStage(
    input.treasures.map((treasure) => {
      let value = 0
      let enhancedCount = 0
      const items: RewardItemDraft[] = []
      for (const [slot, role] of treasure.roles.entries()) {
        const remainingSlots = treasure.roles.length - slot
        const available = Math.max(1, treasure.targetValueCp - value)
        const slotBudget = Math.max(1, Math.round(available / remainingSlots))
        const desiredForm = chooseValueForm(
          role,
          rules,
          input.seed,
          treasure.id,
          slot,
          entropy
        )
        if (role === 'compact_value' && desiredForm === 'Coinage') {
          const coinage = createCoinage(
            treasure.id,
            items.length,
            slotBudget,
            rules,
            input.seed,
            slot,
            entropy
          )
          items.push(coinage)
          value += coinage.totalValueCp
          continue
        }
        const selected = selectCatalogItem(
          role,
          desiredForm,
          treasure.theme,
          slotBudget,
          input.seed,
          treasure.id,
          slot,
          input.catalog,
          rules,
          entropy,
          usedItems,
          usedCategories
        )
        if (!selected) continue
        usedItems.add(selected.id)
        usedCategories.set(
          selected.category,
          (usedCategories.get(selected.category) ?? 0) + 1
        )
        const quantityGood = selected.valueForm === 'Quantity_Good'
        const limit = quantityLimit(selected, role, rules)
        const quantity =
          limit > 1
            ? Math.max(
                1,
                Math.min(
                  limit,
                  roundHalfUp(
                    divide(rational(BigInt(slotBudget)), selected.baseCp)
                  )
                )
              )
            : 1
        const modifier = resolveModifier(
          selected,
          role,
          input.seed,
          treasure.id,
          slot,
          input.catalog,
          rules,
          desiredForm === 'Adorned' &&
            enhancedCount < enhancedCap(treasure.roles.length, rules),
          entropy
        )
        if (modifier) enhancedCount += 1
        const unitValueCp = Math.max(
          0,
          roundHalfUp(
            add(selected.baseCp, modifier?.flatValueCp ?? rational(0n))
          )
        )
        const totalValueCp = unitValueCp * quantity
        const name = modifier
          ? (modifier.textTemplate
              ?.replace('{item}', selected.name)
              .replace('{qty}', '1')
              .replace('{component}', modifier.name) ??
            `${modifier.name} ${selected.name}`)
          : selected.name
        items.push({
          id: `${treasure.id}:item:${items.length + 1}`,
          treasureId: treasure.id,
          catalogItemId: selected.id,
          role,
          name,
          modifier: modifier?.name ?? null,
          quantity,
          unitValueCp,
          totalValueCp,
          stackable: quantityGood || quantity > 1,
          magic: false,
          rarity: null,
          curseName: null,
          curseEffect: null,
          capacity: Math.max(0, selected.capacity * quantity)
        })
        value += totalValueCp
      }
      const remaining = Math.round(treasure.targetValueCp) - value
      if (remaining > 0)
        items.push({
          id: `${treasure.id}:item:${items.length + 1}`,
          treasureId: treasure.id,
          catalogItemId: null,
          role: 'compact_value',
          name: 'copper_pieces',
          modifier: null,
          quantity: remaining,
          unitValueCp: 1,
          totalValueCp: remaining,
          stackable: true,
          magic: false,
          rarity: null,
          curseName: null,
          curseEffect: null,
          capacity: remaining / rules.packing.coinsPerCapacityUnit
        })
      const { roles: _roles, ...plan } = treasure
      void _roles
      return { ...plan, items }
    })
  )
}

function selectCatalogItem(
  role: LootRole,
  desiredForm: string | null,
  theme: LootTheme,
  budget: number,
  seed: number,
  treasureId: string,
  slot: number,
  catalog: FullSessionGenerationCatalog,
  rules: GeneratorLootRules,
  entropy: EncounterEntropy,
  usedItems: ReadonlySet<string>,
  usedCategories: ReadonlyMap<string, number>
): LootCatalogItem | null {
  const themeCategories = new Set(
    catalog.relations
      .filter(
        (relation) =>
          relation.active &&
          relation.type === 'THEME_CATEGORY' &&
          relation.sourceId === theme.id
      )
      .map((relation) => relation.targetId)
  )
  const candidates = catalog.items.filter(
    (item) =>
      item.active &&
      compare(item.baseCp, rational(0n)) > 0 &&
      roleMatches(item, role, desiredForm)
  )
  const themed = candidates.filter((item) => themeCategories.has(item.category))
  const pool = themed.length > 0 ? themed : candidates
  if (pool.length === 0) return null
  const policy =
    desiredForm === 'Adorned'
      ? rules.selection.adornedBase
      : role === 'useful'
        ? rules.selection.useful
        : role === 'flavor'
          ? rules.selection.flavor
          : rules.selection.carrier
  const effectiveBudget = Math.max(
    1,
    desiredForm === 'Adorned' ? budget - policy.preferredBaseExtraCp : budget
  )
  const budgetValue = rational(BigInt(effectiveBudget))
  const upperBound = multiply(
    budgetValue,
    rational(
      BigInt(Math.round((1 + policy.maxOverfit) * 1_000_000)),
      1_000_000n
    )
  )
  const lowerBound = multiply(
    budgetValue,
    rational(BigInt(Math.round(policy.minFit * 1_000_000)), 1_000_000n)
  )
  const fit = pool.filter(
    (item) =>
      compare(item.baseCp, upperBound) <= 0 &&
      compare(item.baseCp, lowerBound) >= 0
  )
  const affordable = pool.filter(
    (item) => compare(item.baseCp, upperBound) <= 0
  )
  const ranked = (
    fit.length > 0 ? fit : affordable.length > 0 ? affordable : pool
  )
    .map((item) => ({
      item,
      delta: absolute(subtract(budgetValue, item.baseCp)),
      themed: themeCategories.has(item.category),
      tie: entropy.unit(
        itemSelectionStream(seed, 'loot-item', treasureId, slot, item.id)
      )
    }))
    .map((candidate) => ({
      ...candidate,
      score:
        policy.fitWeight *
          (1 -
            Math.min(
              1,
              Number(candidate.delta.numerator) /
                Number(candidate.delta.denominator) /
                Math.max(1, effectiveBudget)
            )) +
        policy.themeWeight * Number(candidate.themed) +
        policy.jitterWeight * candidate.tie -
        policy.duplicatePenalty * Number(usedItems.has(candidate.item.id)) -
        rules.balance.categoryStrength *
          (usedCategories.get(candidate.item.category) ?? 0)
    }))
    .toSorted(
      (left, right) =>
        right.score - left.score || compareText(left.item.id, right.item.id)
    )
  const best = ranked[0]?.score
  if (best === undefined) return null
  const shortlist = ranked
    .filter((candidate) => candidate.score >= best - policy.nearBestGap)
    .slice(0, policy.shortlistSize)
  return (
    shortlist[
      entropy.modulo(
        itemSelectionStream(seed, 'loot-item', treasureId, slot, 'shortlist'),
        shortlist.length
      )
    ]?.item ?? null
  )
}

function roleMatches(
  item: LootCatalogItem,
  role: LootRole,
  desiredForm: string | null
): boolean {
  if (role === 'compact_value')
    return (
      item.lootClass === 'carrier' &&
      (desiredForm === null || item.category === desiredForm)
    )
  if (role === 'complex_value')
    return (
      item.lootClass === 'carrier' &&
      item.category !== 'Gemstone' &&
      item.category !== 'Ingot' &&
      (desiredForm === 'Adorned' ||
        desiredForm === null ||
        item.valueForm === desiredForm ||
        item.formOverride === desiredForm)
    )
  return item.lootClass === role
}

function resolveModifier(
  item: LootCatalogItem,
  role: LootRole,
  seed: number,
  treasureId: string,
  slot: number,
  catalog: FullSessionGenerationCatalog,
  rules: GeneratorLootRules,
  force: boolean,
  entropy: EncounterEntropy
) {
  if (role !== 'complex_value' || !item.canAdorn || !force) return null
  const candidates = catalog.modifiers.filter(
    (modifier) =>
      modifier.active &&
      (modifier.allowedCategories.some(
        (category) => relationKey(category) === relationKey(item.category)
      ) ||
        modifier.allowedProfiles.some((profile) =>
          item.modularProfiles.some(
            (itemProfile) => relationKey(itemProfile) === relationKey(profile)
          )
        ))
  )
  const shortlist = candidates
    .toSorted((left, right) => compareText(left.id, right.id))
    .slice(0, rules.selection.adornedModifier.shortlistSize)
  return (
    shortlist[
      entropy.modulo(
        itemSelectionStream(seed, 'modifier', treasureId, slot),
        Math.max(1, shortlist.length)
      )
    ] ?? null
  )
}

function chooseValueForm(
  role: LootRole,
  rules: GeneratorLootRules,
  seed: number,
  treasureId: string,
  slot: number,
  entropy: EncounterEntropy
): string | null {
  const weights =
    role === 'compact_value'
      ? rules.mix.compactForms
      : role === 'complex_value'
        ? rules.mix.complexForms
        : null
  if (!weights) return null
  let roll =
    entropy.unit(itemSelectionStream(seed, 'loot-form', treasureId, slot)) *
    Object.values(weights).reduce((sum, weight) => sum + weight, 0)
  for (const [form, weight] of Object.entries(weights)) {
    roll -= weight
    if (roll <= 0) return form
  }
  return Object.keys(weights).at(-1) ?? null
}

function quantityLimit(
  item: LootCatalogItem,
  role: LootRole,
  rules: GeneratorLootRules
): number {
  const category = item.category.toLowerCase().replaceAll(/[^a-z]/g, '')
  if (role === 'useful') {
    if (item.valueForm === 'Quantity_Good')
      return rules.quantityLimits.useful.quantityGood
    if (category.includes('ammunition'))
      return rules.quantityLimits.useful.ammunition
    if (category.includes('potion')) return rules.quantityLimits.useful.potion
    if (category.includes('poison')) return rules.quantityLimits.useful.poison
    if (category.includes('hazard'))
      return rules.quantityLimits.useful.hazardItem
    return rules.quantityLimits.useful.fallback
  }
  if (role === 'flavor')
    return item.valueForm === 'Quantity_Good'
      ? rules.quantityLimits.flavor.quantityGood
      : rules.quantityLimits.flavor.fallback
  if (item.valueForm === 'Quantity_Good')
    return rules.quantityLimits.carrier.quantityGood
  if (category.includes('artobject'))
    return rules.quantityLimits.carrier.artObject
  if (category.includes('gemstone'))
    return rules.quantityLimits.carrier.gemstone
  if (category.includes('ingot')) return rules.quantityLimits.carrier.ingot
  if (category.includes('tradegood'))
    return rules.quantityLimits.carrier.tradeGood
  return rules.quantityLimits.carrier.fallback
}

function enhancedCap(slotCount: number, rules: GeneratorLootRules): number {
  return Math.max(
    rules.treasure.enhancedCapMin,
    Math.min(
      rules.treasure.enhancedCapMax,
      Math.round(slotCount / rules.treasure.enhancedCapMultiplier)
    )
  )
}

function createCoinage(
  treasureId: string,
  itemIndex: number,
  budgetCp: number,
  rules: GeneratorLootRules,
  seed: number,
  slot: number,
  entropy: EncounterEntropy
): RewardItemDraft {
  const profiles = Object.entries(rules.coins.profiles).filter(
    ([, profile]) => budgetCp <= profile.maxBudgetCp
  )
  const pool = (
    profiles.length > 0 ? profiles : Object.entries(rules.coins.profiles)
  ).slice(0, rules.selection.coinage.shortlistSize)
  const [, profile] =
    pool[
      entropy.modulo(
        itemSelectionStream(seed, 'coin-profile', treasureId, slot),
        pool.length
      )
    ]!
  let remainder = budgetCp
  let coinCount = 0
  const counts = new Map<string, number>()
  const parts: string[] = []
  const low = profile.denominations.at(-1)!
  const lowDefinition = rules.coins.denominations[low]
  const desiredLow =
    profile.minLowCount +
    entropy.modulo(
      itemSelectionStream(seed, 'coin-profile', treasureId, slot, 'low'),
      profile.maxLowCount - profile.minLowCount + 1
    )
  const lowCount =
    desiredLow * lowDefinition.valueCp <= remainder ? desiredLow : 0
  counts.set(low, lowCount)
  remainder -= lowCount * lowDefinition.valueCp
  if (profile.denominations.length === 3) {
    const middle = profile.denominations[1]!
    const middleDefinition = rules.coins.denominations[middle]
    const middleCount = Math.min(
      Math.floor(remainder / middleDefinition.valueCp),
      entropy.modulo(
        itemSelectionStream(seed, 'coin-profile', treasureId, slot, 'middle'),
        profile.maxMiddleCount + 1
      )
    )
    counts.set(middle, middleCount)
    remainder -= middleCount * middleDefinition.valueCp
  }
  const high = profile.denominations[0]!
  const highDefinition = rules.coins.denominations[high]
  const highCount = Math.floor(remainder / highDefinition.valueCp)
  counts.set(high, highCount)
  remainder -= highCount * highDefinition.valueCp
  for (const denomination of profile.denominations) {
    const definition = rules.coins.denominations[denomination]
    const count = counts.get(denomination) ?? 0
    if (count === 0) continue
    coinCount += count
    parts.push(
      `${String(count)} ${count === 1 ? definition.singularLabel : definition.pluralLabel}`
    )
  }
  if (remainder > 0) {
    const copper = rules.coins.denominations.cp
    coinCount += remainder
    parts.push(
      `${String(remainder)} ${remainder === 1 ? copper.singularLabel : copper.pluralLabel}`
    )
  }
  return {
    id: `${treasureId}:item:${itemIndex + 1}`,
    treasureId,
    catalogItemId: null,
    role: 'compact_value',
    name: parts.length > 0 ? parts.join(', ') : 'Coinage',
    modifier: null,
    quantity: 1,
    unitValueCp: budgetCp,
    totalValueCp: budgetCp,
    stackable: true,
    magic: false,
    rarity: null,
    curseName: null,
    curseEffect: null,
    capacity: coinCount / rules.packing.coinsPerCapacityUnit
  }
}

function relationKey(value: string): string {
  return (value.includes(':') ? value.slice(value.indexOf(':') + 1) : value)
    .toLowerCase()
    .replaceAll('_', '-')
}
