import type { EncounterEntropy } from './deterministic-order.js'
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
  return freezeStage(
    input.treasures.map((treasure) => {
      let value = 0
      const items: RewardItemDraft[] = []
      for (const [slot, role] of treasure.roles.entries()) {
        const remainingSlots = treasure.roles.length - slot
        const available = Math.max(1, treasure.targetValueCp - value)
        const slotBudget = Math.max(1, Math.round(available / remainingSlots))
        const selected = selectCatalogItem(
          role,
          treasure.theme,
          slotBudget,
          input.seed,
          treasure.id,
          slot,
          input.catalog,
          entropy,
          usedItems
        )
        if (!selected) continue
        usedItems.add(selected.id)
        const quantityGood = selected.valueForm === 'Quantity_Good'
        const quantity = quantityGood
          ? Math.max(
              1,
              Math.min(
                2000,
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
          entropy
        )
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
      if (remaining > Math.max(25, treasure.targetValueCp * 0.02))
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
          capacity: remaining / 50
        })
      const { roles: _roles, ...plan } = treasure
      void _roles
      return { ...plan, items }
    })
  )
}

function selectCatalogItem(
  role: LootRole,
  theme: LootTheme,
  budget: number,
  seed: number,
  treasureId: string,
  slot: number,
  catalog: FullSessionGenerationCatalog,
  entropy: EncounterEntropy,
  usedItems: ReadonlySet<string>
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
      !usedItems.has(item.id) &&
      roleMatches(item, role)
  )
  const themed = candidates.filter((item) => themeCategories.has(item.category))
  const pool = themed.length > 0 ? themed : candidates
  if (pool.length === 0) return null
  const budgetValue = rational(BigInt(budget))
  const upperBound = multiply(budgetValue, rational(21n, 20n))
  const lowerBound = divide(budgetValue, rational(2n))
  const fit = pool.filter(
    (item) =>
      compare(item.baseCp, upperBound) <= 0 &&
      compare(item.baseCp, lowerBound) >= 0
  )
  const affordable = pool.filter(
    (item) => compare(item.baseCp, upperBound) <= 0
  )
  return (
    (fit.length > 0 ? fit : affordable.length > 0 ? affordable : pool)
      .map((item) => ({
        item,
        delta: absolute(subtract(budgetValue, item.baseCp)),
        tie: entropy.unit(
          itemSelectionStream(seed, 'loot-item', treasureId, slot, item.id)
        )
      }))
      .toSorted(
        (left, right) =>
          compare(left.delta, right.delta) ||
          left.tie - right.tie ||
          compareText(left.item.id, right.item.id)
      )[0]?.item ?? null
  )
}

function roleMatches(item: LootCatalogItem, role: LootRole): boolean {
  if (role === 'compact_value')
    return (
      item.lootClass === 'carrier' &&
      (item.category === 'Gemstone' || item.category === 'Ingot')
    )
  if (role === 'complex_value')
    return (
      item.lootClass === 'carrier' &&
      item.category !== 'Gemstone' &&
      item.category !== 'Ingot'
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
  entropy: EncounterEntropy
) {
  if (
    role !== 'complex_value' ||
    !item.canAdorn ||
    entropy.unit(
      itemSelectionStream(seed, 'modifier-chance', treasureId, slot)
    ) >= 0.35
  )
    return null
  const candidates = catalog.modifiers.filter(
    (modifier) =>
      modifier.active &&
      (modifier.allowedCategories.includes(item.category) ||
        modifier.allowedProfiles.some((profile) =>
          item.modularProfiles.includes(profile)
        ))
  )
  return (
    candidates[
      entropy.modulo(
        itemSelectionStream(seed, 'modifier', treasureId, slot),
        Math.max(1, candidates.length)
      )
    ] ?? null
  )
}
