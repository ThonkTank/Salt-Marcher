import type {
  ItemDefinition,
  ItemReference
} from '../../shared/contracts/loot.js'
import type { GeneratorLootRules } from '../../shared/contracts/generator-loot-rules.js'
import { defaultGeneratorLootRules } from '../../shared/generator/default-loot-rules.js'
import { compareText } from './deterministic-order.js'
import type { RewardRandom } from './reward-random.js'
import {
  indexedModifiersForItem,
  type GenerationCatalogIndex
} from './generation-catalog-index.js'
import type {
  LootCategoryId,
  LootCatalogItem,
  LootModifier,
  LootTheme
} from './loot-catalog.js'
import {
  absolute,
  add,
  compare,
  decimal,
  divide,
  floor,
  multiply,
  rational,
  roundHalfUp,
  subtract,
  type Rational
} from './rational.js'
import {
  freezeStage,
  type LootRole,
  type RewardItemDraft,
  type RolePlannedTreasure,
  type SelectedTreasureDraft
} from './reward-stage-types.js'

export type NonMagicSelectionInput = Readonly<{
  runId: string
  treasures: readonly RolePlannedTreasure[]
  catalogIndex: GenerationCatalogIndex
  rules?: GeneratorLootRules
}>

/**
 * Preconditions: roles and slot budgets are already planned. Postconditions:
 * catalog items are unique across this reward, arithmetic values are integral
 * copper, and the caller's plans/catalog remain untouched.
 */
export function selectNonMagicItems(
  input: NonMagicSelectionInput,
  random: RewardRandom
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
          treasure.id,
          slot,
          random
        )
        if (role === 'compact_value' && desiredForm === 'Coinage') {
          const coinage = createCoinage(
            input.runId,
            treasure.id,
            items.length,
            slotBudget,
            rules,
            slot,
            random
          )
          items.push(coinage)
          value += coinage.definition.unitValueCp * coinage.quantity
          continue
        }
        const selection = selectCatalogItem(
          role,
          desiredForm,
          treasure.theme,
          slotBudget,
          treasure.id,
          slot,
          input.catalogIndex,
          rules,
          random,
          usedItems,
          usedCategories
        )
        if (!selection) continue
        const { item: selected, quantity } = selection
        usedItems.add(selected.id)
        usedCategories.set(
          selected.categoryId,
          (usedCategories.get(selected.categoryId) ?? 0) + 1
        )
        const quantityGood = selected.valueForm === 'quantity_good'
        const enhancement = resolveEnhancement(
          selected,
          role,
          slotBudget,
          treasure.id,
          slot,
          input.catalogIndex,
          rules,
          desiredForm === 'Adorned' &&
            enhancedCount < enhancedCap(treasure.roles.length, rules),
          random
        )
        if (enhancement.modifier) enhancedCount += 1
        const exactUnitValueCp = add(
          add(
            selected.baseCp,
            enhancement.modifier?.flatValueCp ?? rational(0n)
          ),
          enhancement.component
            ? multiply(
                enhancement.component.baseCp,
                rational(BigInt(enhancement.componentQuantity))
              )
            : rational(0n)
        )
        const unitValueCp = Math.max(0, roundHalfUp(exactUnitValueCp))
        const totalValueCp = Math.max(
          0,
          roundHalfUp(multiply(exactUnitValueCp, rational(BigInt(quantity))))
        )
        const name = enhancement.modifier
          ? (enhancement.modifier.textTemplate
              ?.replace('{item}', selected.name)
              .replace('{qty}', String(enhancement.componentQuantity || 1))
              .replace(
                '{component}',
                enhancement.component?.name ?? enhancement.modifier.name
              )
              .replace('{detail}', enhancement.detail ?? '') ??
            `${enhancement.modifier.name} ${selected.name}`)
          : selected.name
        const itemId = `${treasure.id}:item:${items.length + 1}`
        const itemReference = generatedItemReference(input.runId, itemId)
        const definition: ItemDefinition = {
          reference: itemReference,
          name,
          unitValueCp,
          exactUnitValueCp: {
            numerator: String(exactUnitValueCp.numerator),
            denominator: String(exactUnitValueCp.denominator)
          },
          unitCapacity: Math.max(0, selected.capacity),
          stackable: quantityGood || quantity > 1,
          magic: false,
          rarity: null,
          curse: null,
          components: {
            baseItemId: selected.id,
            modifierId: enhancement.modifier?.id ?? null,
            componentId: enhancement.component?.id ?? null,
            magicItemId: null,
            magicVariantId: null,
            spellId: null,
            enspelledRuleId: null,
            curseId: null,
            coinDenominations: []
          }
        }
        items.push({
          id: itemId,
          treasureId: treasure.id,
          itemReference,
          definition,
          role,
          quantity
        })
        value += totalValueCp
      }
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
  treasureId: string,
  slot: number,
  catalogIndex: GenerationCatalogIndex,
  rules: GeneratorLootRules,
  random: RewardRandom,
  usedItems: ReadonlySet<string>,
  usedCategories: ReadonlyMap<string, number>
): Readonly<{ item: LootCatalogItem; quantity: number }> | null {
  const themeCategories =
    catalogIndex.themeCategoryIds.get(theme.id) ?? new Set<LootCategoryId>()
  const policy =
    desiredForm === 'Adorned'
      ? rules.selection.adornedBase
      : role === 'useful'
        ? rules.selection.useful
        : role === 'flavor'
          ? rules.selection.flavor
          : rules.selection.carrier
  const candidates = catalogIndex.activeItems
    .filter(
      (item) =>
        !usedItems.has(item.id) && compare(item.baseCp, rational(0n)) > 0
    )
    .map((item) => ({
      item,
      quantity: candidateQuantity(
        item,
        role,
        desiredForm,
        budget,
        policy,
        rules
      )
    }))
    .filter(
      (candidate) =>
        candidate.quantity > 0 &&
        roleMatches(
          candidate.item,
          role,
          desiredForm,
          candidate.quantity,
          rules
        )
    )
  const pool = candidates
  if (pool.length === 0) return null
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
    (candidate) =>
      compare(candidateLineValue(candidate), upperBound) <= 0 &&
      compare(candidateLineValue(candidate), lowerBound) >= 0
  )
  if (fit.length === 0) return null
  const ranked = fit
    .map((candidate) => ({
      ...candidate,
      delta: absolute(subtract(budgetValue, candidateLineValue(candidate))),
      themed: themeCategories.has(candidate.item.categoryId),
      tie: itemUnit(random, 'loot-item', treasureId, slot, candidate.item.id)
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
          (usedCategories.get(candidate.item.categoryId) ?? 0)
    }))
    .toSorted(
      (left, right) =>
        right.score - left.score || compareText(left.item.id, right.item.id)
    )
  const bestGap = ranked.reduce(
    (best, candidate) => Math.min(best, rationalDistance(candidate.delta)),
    Number.POSITIVE_INFINITY
  )
  if (!Number.isFinite(bestGap)) return null
  const shortlist = ranked
    .filter(
      (candidate) =>
        rationalDistance(candidate.delta) <=
        bestGap + effectiveBudget * policy.nearBestGap
    )
    .slice(0, policy.shortlistSize)
  return (
    shortlist[
      itemModulo(
        random,
        'loot-item',
        treasureId,
        slot,
        'shortlist',
        shortlist.length
      )
    ] ?? null
  )
}

function roleMatches(
  item: LootCatalogItem,
  role: LootRole,
  desiredForm: string | null,
  quantity: number,
  rules: GeneratorLootRules
): boolean {
  if (role === 'compact_value')
    return (
      item.lootClass === 'carrier' &&
      (desiredForm === null ||
        item.categoryId === valueFormCategoryId(desiredForm))
    )
  if (role === 'complex_value')
    return (
      item.lootClass === 'carrier' &&
      item.categoryId !== 'category:gemstone' &&
      item.categoryId !== 'category:ingot' &&
      (desiredForm === 'Adorned'
        ? item.modularProfileIds.length > 0 &&
          item.allowedContainerIds.length > 0
        : desiredForm === null ||
          carrierForm(item, quantity, rules) === desiredForm)
    )
  return item.lootClass === role
}

function carrierForm(
  item: LootCatalogItem,
  quantity: number,
  rules: GeneratorLootRules
): string {
  if (item.valueForm === 'quantity_good')
    return item.baseLb * quantity >= rules.packing.contextBulkMinLb
      ? 'Bulk_Good'
      : 'Compact_Good'
  if (carrierCategoryForms.has(item.categoryId))
    return categoryForm(item.categoryId)
  return item.formOverride ?? 'Adorned'
}

function candidateQuantity(
  item: LootCatalogItem,
  role: LootRole,
  desiredForm: string | null,
  budgetCp: number,
  policy: GeneratorLootRules['selection']['carrier'],
  rules: GeneratorLootRules
): number {
  if (desiredForm === 'Adorned') return 1
  const cap = quantityLimit(item, role, rules)
  return exactQuantityForBudget(item.baseCp, budgetCp, cap, policy.maxOverfit)
}

export function exactQuantityForBudget(
  unitCp: Rational,
  budgetCp: number,
  cap: number,
  maxOverfit: number
): number {
  if (compare(unitCp, rational(0n)) <= 0 || cap <= 0) return 0
  if (!Number.isSafeInteger(budgetCp) || budgetCp < 0)
    throw new Error('invalid_selection_budget')
  const budget = rational(BigInt(budgetCp))
  const down = Math.min(cap, Math.max(0, floor(divide(budget, unitCp))))
  const downValue = multiply(unitCp, rational(BigInt(down)))
  const up = Math.min(cap, compare(downValue, budget) === 0 ? down : down + 1)
  const upValue = multiply(unitCp, rational(BigInt(up)))
  const upperBound = multiply(
    budget,
    add(rational(1n), decimal(String(maxOverfit)))
  )
  return compare(upValue, upperBound) <= 0 &&
    compare(
      absolute(subtract(upValue, budget)),
      absolute(subtract(downValue, budget))
    ) < 0
    ? up
    : down
}

function candidateLineValue(
  candidate: Readonly<{
    item: LootCatalogItem
    quantity: number
  }>
) {
  return multiply(candidate.item.baseCp, rational(BigInt(candidate.quantity)))
}

function rationalDistance(value: ReturnType<typeof absolute>): number {
  return Number(value.numerator) / Number(value.denominator)
}

function resolveEnhancement(
  item: LootCatalogItem,
  role: LootRole,
  budgetCp: number,
  treasureId: string,
  slot: number,
  catalogIndex: GenerationCatalogIndex,
  rules: GeneratorLootRules,
  force: boolean,
  random: RewardRandom
): Readonly<{
  modifier: LootModifier | null
  component: LootCatalogItem | null
  componentQuantity: number
  detail: string | null
}> {
  const policy =
    force && role === 'complex_value' && item.canAdorn
      ? rules.selection.adornedModifier
      : role === 'useful'
        ? rules.selection.useful
        : role === 'flavor'
          ? rules.selection.flavor
          : rules.selection.carrier
  const requiredKind = force ? 'modular' : 'variant'
  const candidates = indexedModifiersForItem(catalogIndex, item).filter(
    (modifier) =>
      modifier.active &&
      modifier.kind === requiredKind &&
      (modifier.lootTypeId === 'all' ||
        modifier.lootTypeId === item.lootTypeId) &&
      (requiredKind !== 'variant' ||
        compare(modifier.flatValueCp, rational(0n)) > 0) &&
      (modifier.allowedCategoryIds.includes(item.categoryId) ||
        modifier.allowedProfileIds.some((profileId) =>
          item.modularProfileIds.includes(profileId)
        ))
  )
  const shortlistSize = force
    ? policy.shortlistSize
    : policy.variantShortlistSize
  if (shortlistSize === 0 || candidates.length === 0)
    return {
      modifier: null,
      component: null,
      componentQuantity: 0,
      detail: null
    }
  const remainingBudgetCp = Math.max(0, budgetCp - roundHalfUp(item.baseCp))
  const shortlist = valueShortlist(
    candidates.filter(
      (candidate) => roundHalfUp(candidate.flatValueCp) <= remainingBudgetCp
    ),
    (candidate) => roundHalfUp(candidate.flatValueCp),
    remainingBudgetCp,
    policy,
    shortlistSize,
    (candidate) => candidate.id,
    (candidate) => itemUnit(random, 'modifier', treasureId, slot, candidate.id)
  )
  const modifier =
    shortlist[
      itemModulo(
        random,
        'modifier',
        treasureId,
        slot,
        undefined,
        Math.max(1, shortlist.length)
      )
    ] ?? null
  if (!modifier)
    return {
      modifier: null,
      component: null,
      componentQuantity: 0,
      detail: null
    }
  const detailOptions = modifier.details
    ?.split('|')
    .map((value) => value.trim())
    .filter(Boolean)
  const detail =
    detailOptions && detailOptions.length > 0
      ? detailOptions[
          itemModulo(
            random,
            'modifier',
            treasureId,
            slot,
            'detail',
            detailOptions.length
          )
        ]!
      : null
  if (!modifier.componentTypeId)
    return { modifier, component: null, componentQuantity: 0, detail }
  const componentPolicy = rules.selection.adornedComponent
  const componentBudgetCp = Math.max(
    0,
    remainingBudgetCp - roundHalfUp(modifier.flatValueCp)
  )
  const minimum = Math.max(1, Math.floor(modifier.minQuantity))
  const componentCandidates = valueShortlist(
    (
      catalogIndex.adornmentItemsByTypeId.get(modifier.componentTypeId) ?? []
    ).filter(
      (candidate) =>
        candidate.canAdorn &&
        compare(candidate.baseCp, rational(0n)) > 0 &&
        candidate.adornmentTypeId === modifier.componentTypeId
    ),
    (candidate) => roundHalfUp(candidate.baseCp) * minimum,
    componentBudgetCp,
    componentPolicy,
    componentPolicy.shortlistSize,
    (candidate) => candidate.id,
    (candidate) =>
      itemUnit(
        random,
        'modifier',
        treasureId,
        slot,
        `component:${candidate.id}`
      )
  )
  const component =
    componentCandidates[
      itemModulo(
        random,
        'modifier',
        treasureId,
        slot,
        'component',
        Math.max(1, componentCandidates.length)
      )
    ] ?? null
  if (!component)
    return { modifier, component: null, componentQuantity: 0, detail }
  const maximum = Math.max(minimum, Math.floor(modifier.maxQuantity))
  const componentCp = Math.max(1, roundHalfUp(component.baseCp))
  const targetRemainder = Math.max(
    0,
    budgetCp - roundHalfUp(item.baseCp) - roundHalfUp(modifier.flatValueCp)
  )
  const down = Math.max(
    minimum,
    Math.min(maximum, Math.floor(targetRemainder / componentCp))
  )
  const up = Math.max(
    minimum,
    Math.min(maximum, Math.ceil(targetRemainder / componentCp))
  )
  const componentQuantity =
    componentCp * up <=
      targetRemainder + budgetCp * componentPolicy.maxOverfit &&
    Math.abs(componentCp * up - targetRemainder) <
      Math.abs(componentCp * down - targetRemainder)
      ? up
      : down
  return { modifier, component, componentQuantity, detail }
}

function valueShortlist<T>(
  candidates: readonly T[],
  valueCp: (candidate: T) => number,
  budgetCp: number,
  policy: GeneratorLootRules['selection']['carrier'],
  shortlistSize: number,
  id: (candidate: T) => string,
  jitter: (candidate: T) => number
): readonly T[] {
  if (candidates.length === 0 || shortlistSize === 0) return []
  const lower = budgetCp * policy.minFit
  const upper = budgetCp * (1 + policy.maxOverfit)
  const fit = candidates.filter((candidate) => {
    const value = valueCp(candidate)
    return value >= lower && value <= upper
  })
  const affordable = candidates.filter(
    (candidate) => valueCp(candidate) <= upper
  )
  const pool =
    fit.length > 0 ? fit : affordable.length > 0 ? affordable : candidates
  const ranked = pool
    .map((candidate) => ({
      candidate,
      score:
        policy.fitWeight *
          (1 -
            Math.min(
              1,
              Math.abs(budgetCp - valueCp(candidate)) / Math.max(1, budgetCp)
            )) +
        policy.jitterWeight * jitter(candidate)
    }))
    .toSorted(
      (left, right) =>
        right.score - left.score ||
        compareText(id(left.candidate), id(right.candidate))
    )
  const best = ranked[0]!.score
  return ranked
    .filter((candidate) => candidate.score >= best - policy.nearBestGap)
    .slice(0, shortlistSize)
    .map((candidate) => candidate.candidate)
}

function chooseValueForm(
  role: LootRole,
  rules: GeneratorLootRules,
  treasureId: string,
  slot: number,
  random: RewardRandom
): string | null {
  const weights =
    role === 'compact_value'
      ? rules.mix.compactForms
      : role === 'complex_value'
        ? rules.mix.complexForms
        : null
  if (!weights) return null
  let roll =
    itemUnit(random, 'loot-form', treasureId, slot) *
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
  if (role === 'useful') {
    if (item.valueForm === 'quantity_good')
      return rules.quantityLimits.useful.quantityGood
    if (item.categoryId === 'category:ammunition')
      return rules.quantityLimits.useful.ammunition
    if (item.categoryId === 'category:potion')
      return rules.quantityLimits.useful.potion
    if (item.categoryId === 'category:poison')
      return rules.quantityLimits.useful.poison
    if (item.categoryId === 'category:hazard-item')
      return rules.quantityLimits.useful.hazardItem
    return rules.quantityLimits.useful.fallback
  }
  if (role === 'flavor')
    return item.valueForm === 'quantity_good'
      ? rules.quantityLimits.flavor.quantityGood
      : rules.quantityLimits.flavor.fallback
  if (item.valueForm === 'quantity_good')
    return rules.quantityLimits.carrier.quantityGood
  if (item.categoryId === 'category:art-object')
    return rules.quantityLimits.carrier.artObject
  if (item.categoryId === 'category:gemstone')
    return rules.quantityLimits.carrier.gemstone
  if (item.categoryId === 'category:ingot')
    return rules.quantityLimits.carrier.ingot
  if (item.categoryId === 'category:trade-good')
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
  runId: string,
  treasureId: string,
  itemIndex: number,
  budgetCp: number,
  rules: GeneratorLootRules,
  slot: number,
  random: RewardRandom
): RewardItemDraft {
  const maxOverfit = rules.selection.coinage.maxOverfit
  const profiles = Object.entries(rules.coins.profiles).filter(
    ([, profile]) =>
      budgetCp <= profile.maxBudgetCp &&
      minimumCoinProfileValue(profile, rules) <= budgetCp * (1 + maxOverfit)
  )
  const fallback = [['spCp', rules.coins.profiles.spCp]] as const
  const pool = (profiles.length > 0 ? profiles : fallback).slice(
    0,
    rules.selection.coinage.shortlistSize
  )
  const [profileId, profile] =
    pool[
      itemModulo(
        random,
        'coin-profile',
        treasureId,
        slot,
        undefined,
        pool.length
      )
    ]!
  const counts = new Map<string, number>()
  const low = profile.denominations.at(-1)!
  const lowDefinition = rules.coins.denominations[low]
  const middleValue =
    profile.denominations.length === 3
      ? rules.coins.denominations[profile.denominations[1]!].valueCp
      : 0
  const high = profile.denominations[0]!
  const highDefinition = rules.coins.denominations[high]
  const maximumLow = Math.max(
    profile.minLowCount,
    Math.min(
      profile.maxLowCount,
      Math.floor(
        (budgetCp * (1 + maxOverfit) - highDefinition.valueCp - middleValue) /
          lowDefinition.valueCp
      )
    )
  )
  let lowCount =
    profile.minLowCount +
    itemModulo(
      random,
      'coin-profile',
      treasureId,
      slot,
      'low',
      maximumLow - profile.minLowCount + 1
    )
  let middleCount = 0
  if (profile.denominations.length === 3) {
    const middle = profile.denominations[1]!
    const middleDefinition = rules.coins.denominations[middle]
    const maximumMiddle = Math.max(
      1,
      Math.min(
        profile.maxMiddleCount,
        Math.floor(
          (budgetCp * (1 + maxOverfit) -
            highDefinition.valueCp -
            lowCount * lowDefinition.valueCp) /
            middleDefinition.valueCp
        )
      )
    )
    middleCount =
      1 +
      itemModulo(
        random,
        'coin-profile',
        treasureId,
        slot,
        'middle',
        maximumMiddle
      )
    counts.set(middle, middleCount)
  }
  const highCount = Math.max(
    1,
    Math.floor(
      (budgetCp -
        middleCount * middleValue -
        lowCount * lowDefinition.valueCp) /
        highDefinition.valueCp
    )
  )
  const initialValue =
    highCount * highDefinition.valueCp +
    middleCount * middleValue +
    lowCount * lowDefinition.valueCp
  if (initialValue === Math.round(budgetCp))
    lowCount =
      lowCount < maximumLow
        ? lowCount + 1
        : lowCount > profile.minLowCount
          ? lowCount - 1
          : lowCount + 1
  counts.set(low, lowCount)
  counts.set(high, highCount)
  let coinCount = 0
  for (const denomination of profile.denominations) {
    const count = counts.get(denomination) ?? 0
    if (count === 0) continue
    coinCount += count
  }
  const denominations = [...counts.entries()]
    .filter(([, count]) => count > 0)
    .map(([denominationId, quantity]) => ({
      denominationId: denominationId as 'pp' | 'gp' | 'ep' | 'sp' | 'cp',
      quantity
    }))
  const name = denominations
    .map(({ denominationId, quantity }) => {
      const definition = rules.coins.denominations[denominationId]
      return `${String(quantity)} ${
        quantity === 1 ? definition.singularLabel : definition.pluralLabel
      }`
    })
    .join(', ')
  const itemId = `${treasureId}:item:${itemIndex + 1}`
  const itemReference = generatedItemReference(runId, itemId)
  return {
    id: itemId,
    treasureId,
    itemReference,
    definition: {
      reference: itemReference,
      name: name || 'Coinage',
      unitValueCp: denominations.reduce(
        (sum, coin) =>
          sum +
          coin.quantity *
            rules.coins.denominations[coin.denominationId].valueCp,
        0
      ),
      unitCapacity: coinCount / rules.packing.coinsPerCapacityUnit,
      stackable: true,
      magic: false,
      rarity: null,
      curse: null,
      components: {
        baseItemId: null,
        modifierId: null,
        componentId: null,
        magicItemId: null,
        magicVariantId: null,
        spellId: null,
        enspelledRuleId: null,
        curseId: null,
        coinProfileId: profileId,
        coinDenominations: denominations
      }
    },
    role: 'compact_value',
    quantity: 1
  }
}

function minimumCoinProfileValue(
  profile: GeneratorLootRules['coins']['profiles']['ppGp'],
  rules: GeneratorLootRules
): number {
  const high = rules.coins.denominations[profile.denominations[0]!].valueCp
  const low = rules.coins.denominations[profile.denominations.at(-1)!].valueCp
  const middle =
    profile.denominations.length === 3
      ? rules.coins.denominations[profile.denominations[1]!].valueCp
      : 0
  return high + middle + profile.minLowCount * low
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

const carrierCategoryForms = new Set<LootCategoryId>([
  'category:ingot',
  'category:art-object',
  'category:gemstone',
  'category:livestock',
  'category:clothing'
])

function valueFormCategoryId(value: string): LootCategoryId {
  if (value === 'Gemstone') return 'category:gemstone'
  if (value === 'Ingot') return 'category:ingot'
  throw new Error('invalid_compact_value_form')
}

function categoryForm(categoryId: LootCategoryId): string {
  if (categoryId === 'category:ingot') return 'Ingot'
  if (categoryId === 'category:art-object') return 'Art_Object'
  if (categoryId === 'category:gemstone') return 'Gemstone'
  if (categoryId === 'category:livestock') return 'Livestock'
  if (categoryId === 'category:clothing') return 'Clothing'
  throw new Error('invalid_carrier_category_form')
}

type ItemRandomKind = 'loot-item' | 'loot-form' | 'coin-profile' | 'modifier'

function itemUnit(
  random: RewardRandom,
  kind: ItemRandomKind,
  treasureId: string,
  slot: number,
  candidateId?: string
): number {
  return random.unit(
    itemRandomLabel(kind, treasureId, slot),
    candidateId ?? slot
  )
}

function itemModulo(
  random: RewardRandom,
  kind: ItemRandomKind,
  treasureId: string,
  slot: number,
  candidateId: string | undefined,
  modulus: number
): number {
  return random.modulo(
    itemRandomLabel(kind, treasureId, slot),
    candidateId ?? slot,
    modulus
  )
}

function itemRandomLabel(
  kind: ItemRandomKind,
  treasureId: string,
  slot: number
): string {
  return `${kind}:${treasureId}${kind === 'loot-item' ? `:${slot}` : ''}`
}
