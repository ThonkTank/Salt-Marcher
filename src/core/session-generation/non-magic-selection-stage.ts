import type { EncounterEntropy } from './deterministic-order.js'
import type {
  ItemDefinition,
  ItemReference
} from '../../shared/contracts/loot.js'
import type { GeneratorLootRules } from '../../shared/contracts/generator-loot-rules.js'
import { defaultGeneratorLootRules } from '../../shared/generator/default-loot-rules.js'
import { compareText } from './deterministic-order.js'
import { itemSelectionStream } from './entropy-streams.js'
import type {
  FullSessionGenerationCatalog,
  LootCatalogItem,
  LootModifier,
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
  runId: string
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
            input.runId,
            treasure.id,
            items.length,
            slotBudget,
            rules,
            input.seed,
            slot,
            entropy,
            null
          )
          items.push(coinage)
          value += coinage.definition.unitValueCp * coinage.quantity
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
        const enhancement = resolveEnhancement(
          selected,
          role,
          slotBudget,
          input.seed,
          treasure.id,
          slot,
          input.catalog,
          rules,
          desiredForm === 'Adorned' &&
            enhancedCount < enhancedCap(treasure.roles.length, rules),
          entropy
        )
        if (enhancement.modifier) enhancedCount += 1
        const unitValueCp = Math.max(
          0,
          roundHalfUp(
            add(
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
          )
        )
        const totalValueCp = unitValueCp * quantity
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
      const remaining = Math.round(treasure.targetValueCp) - value
      if (remaining > 0)
        items.push(
          createCoinage(
            input.runId,
            treasure.id,
            items.length,
            remaining,
            rules,
            input.seed,
            treasure.roles.length,
            entropy,
            ['cp']
          )
        )
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

function resolveEnhancement(
  item: LootCatalogItem,
  role: LootRole,
  budgetCp: number,
  seed: number,
  treasureId: string,
  slot: number,
  catalog: FullSessionGenerationCatalog,
  rules: GeneratorLootRules,
  force: boolean,
  entropy: EncounterEntropy
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
  const candidates = catalog.modifiers.filter(
    (modifier) =>
      modifier.active &&
      modifier.kind === requiredKind &&
      (modifier.allowedCategories.some(
        (category) => relationKey(category) === relationKey(item.category)
      ) ||
        modifier.allowedProfiles.some((profile) =>
          item.modularProfiles.some(
            (itemProfile) => relationKey(itemProfile) === relationKey(profile)
          )
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
    candidates,
    (candidate) => roundHalfUp(candidate.flatValueCp),
    remainingBudgetCp,
    policy,
    shortlistSize,
    (candidate) => candidate.id,
    (candidate) =>
      entropy.unit(
        itemSelectionStream(seed, 'modifier', treasureId, slot, candidate.id)
      )
  )
  const modifier =
    shortlist[
      entropy.modulo(
        itemSelectionStream(seed, 'modifier', treasureId, slot),
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
          entropy.modulo(
            itemSelectionStream(seed, 'modifier', treasureId, slot, 'detail'),
            detailOptions.length
          )
        ]!
      : null
  if (!modifier.componentType || modifier.componentType === 'none')
    return { modifier, component: null, componentQuantity: 0, detail }
  const componentPolicy = rules.selection.adornedComponent
  const componentBudgetCp = Math.max(
    0,
    remainingBudgetCp - roundHalfUp(modifier.flatValueCp)
  )
  const minimum = Math.max(1, Math.floor(modifier.minQuantity))
  const componentCandidates = valueShortlist(
    catalog.items.filter(
      (candidate) =>
        candidate.active &&
        compare(candidate.baseCp, rational(0n)) > 0 &&
        relationKey(candidate.category).includes(
          relationKey(modifier.componentType!)
        )
    ),
    (candidate) => roundHalfUp(candidate.baseCp) * minimum,
    componentBudgetCp,
    componentPolicy,
    componentPolicy.shortlistSize,
    (candidate) => candidate.id,
    (candidate) =>
      entropy.unit(
        itemSelectionStream(
          seed,
          'modifier',
          treasureId,
          slot,
          `component:${candidate.id}`
        )
      )
  )
  const component =
    componentCandidates[
      entropy.modulo(
        itemSelectionStream(seed, 'modifier', treasureId, slot, 'component'),
        Math.max(1, componentCandidates.length)
      )
    ] ?? null
  if (!component)
    return { modifier, component: null, componentQuantity: 0, detail }
  const maximum = Math.max(minimum, Math.floor(modifier.maxQuantity))
  const affordable = Math.max(
    minimum,
    Math.floor(
      Math.max(0, budgetCp - roundHalfUp(item.baseCp)) /
        Math.max(1, roundHalfUp(component.baseCp))
    )
  )
  const boundedMaximum = Math.max(minimum, Math.min(maximum, affordable))
  const componentQuantity =
    minimum +
    entropy.modulo(
      itemSelectionStream(seed, 'modifier', treasureId, slot, 'component-qty'),
      boundedMaximum - minimum + 1
    )
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
  runId: string,
  treasureId: string,
  itemIndex: number,
  budgetCp: number,
  rules: GeneratorLootRules,
  seed: number,
  slot: number,
  entropy: EncounterEntropy,
  forcedDenominations: readonly ('pp' | 'gp' | 'ep' | 'sp' | 'cp')[] | null
): RewardItemDraft {
  const profiles = Object.entries(rules.coins.profiles).filter(
    ([, profile]) => budgetCp <= profile.maxBudgetCp
  )
  const pool = (
    profiles.length > 0 ? profiles : Object.entries(rules.coins.profiles)
  ).slice(0, rules.selection.coinage.shortlistSize)
  const profile = forcedDenominations
    ? {
        denominations: [...forcedDenominations],
        minLowCount: 0,
        maxLowCount: 0,
        maxMiddleCount: 0,
        maxBudgetCp: Number.MAX_SAFE_INTEGER,
        allowedContainers: Object.values(rules.coins.profiles).flatMap(
          (entry) => entry.allowedContainers
        )
      }
    : pool[
        entropy.modulo(
          itemSelectionStream(seed, 'coin-profile', treasureId, slot),
          pool.length
        )
      ]![1]
  let remainder = budgetCp
  let coinCount = 0
  const counts = new Map<string, number>()
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
    const count = counts.get(denomination) ?? 0
    if (count === 0) continue
    coinCount += count
  }
  if (remainder > 0) {
    coinCount += remainder
    counts.set('cp', (counts.get('cp') ?? 0) + remainder)
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
      unitValueCp: budgetCp,
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
        coinDenominations: denominations
      }
    },
    role: 'compact_value',
    quantity: 1
  }
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

function relationKey(value: string): string {
  return (value.includes(':') ? value.slice(value.indexOf(':') + 1) : value)
    .toLowerCase()
    .replaceAll('_', '-')
}
