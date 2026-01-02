// Ziel: Loot-Generierung mit Budget-Tracking, DefaultLoot und Culture-Resolution-Kaskade
// Siehe: docs/services/Loot.md

import { GOLD_PER_XP_BY_LEVEL, WEALTH_MULTIPLIERS, type WealthTag } from '@/constants/loot';
import { vault } from '@/infrastructure/vault/vaultInstance';
import {
  resolveCultureChain,
  mergeWeightedPool,
  type CultureLayer,
} from '@/utils/cultureResolution';
import type { WeightedItem } from '#types/common/counting';
import type { CreatureDefinition } from '#entities/creature';
import type { Faction, CultureData } from '#entities/faction';

// ============================================================================
// DEBUG HELPER
// ============================================================================

const debug = (...args: unknown[]) => {
  if (process.env.DEBUG_SERVICES === 'true') {
    console.log('[lootGenerator]', ...args);
  }
};

// ============================================================================
// TYPES (inline, per Services.md)
// ============================================================================

/** Placeholder Item-Type bis types/loot.ts existiert */
export interface Item {
  id: string;
  name: string;
  value: number;
  pounds?: number;                    // physical weight in lbs, default 0
  carryCapacityMultiplier?: number;   // multiplies creature's carry capacity (e.g. 1.2 = +20%)
  tags?: string[];
}

/** SelectedItem für Loot-Output */
interface SelectedItem {
  item: Item;
  quantity: number;
}

/** GeneratedLoot Output */
interface GeneratedLoot {
  items: SelectedItem[];
  totalValue: number;
}

/** LootBudgetState Placeholder */
interface LootBudgetState {
  accumulated: number;
  distributed: number;
  balance: number;
  debt: number;
}

/** Creature für Wealth-Berechnung und Loot-Pool-Resolution */
interface CreatureWithLoot {
  id: string;
  wealthTier?: WealthTag;
  lootPool?: string[];
  species?: string;
  tags?: string[];
}

// ============================================================================
// BUDGET FUNCTIONS (Stubs)
// ============================================================================

/**
 * Gold pro XP basierend auf Party-Level (DMG-Tabelle).
 * Clampt Level auf 1-20 und gibt entsprechenden Multiplikator zurück.
 */
export function getGoldPerXP(partyLevel: number): number {
  const clamped = Math.min(20, Math.max(1, partyLevel));
  const ratio = GOLD_PER_XP_BY_LEVEL[clamped as keyof typeof GOLD_PER_XP_BY_LEVEL];
  debug('getGoldPerXP:', partyLevel, '→ clamped:', clamped, '→', ratio);
  return ratio ?? 0.5;
}

/**
 * Konvertiert XP zu Gold basierend auf Party-Level.
 * Verwendet DMG-Tabelle für Gold-pro-XP-Ratio.
 */
export function xpToGold(xp: number, partyLevel: number): number {
  return xp * getGoldPerXP(partyLevel);
}

// ============================================================================
// WEALTH FUNCTIONS (Stubs)
// ============================================================================

/**
 * Wealth-Multiplikator aus Creature-wealthTier lesen.
 * Default: 1.0 (average)
 */
export function getWealthMultiplier(creature: CreatureWithLoot): number {
  if (!creature.wealthTier) {
    debug('getWealthMultiplier:', creature.id, 'no wealthTier → default 1.0');
    return 1.0;
  }

  const multiplier = WEALTH_MULTIPLIERS[creature.wealthTier];
  debug('getWealthMultiplier:', creature.id, 'wealthTier:', creature.wealthTier, '→', multiplier);
  return multiplier ?? 1.0;
}

/**
 * Durchschnittlicher Wealth-Multiplikator über alle Kreaturen.
 * Summiert getWealthMultiplier() und teilt durch Anzahl.
 */
export function calculateAverageWealthMultiplier(
  creatures: CreatureWithLoot[]
): number {
  if (creatures.length === 0) {
    debug('calculateAverageWealthMultiplier: empty array → default 1.0');
    return 1.0;
  }

  const total = creatures.reduce(
    (sum, creature) => sum + getWealthMultiplier(creature),
    0
  );
  const avg = total / creatures.length;

  debug('calculateAverageWealthMultiplier:', creatures.length, 'creatures → avg', avg);
  return avg;
}

// ============================================================================
// LOOT POOL RESOLUTION (Culture-Kaskade)
// ============================================================================

/**
 * Löst den Loot-Pool für eine Kreatur über die Culture-Resolution-Kaskade auf.
 *
 * Kaskade (60%-Gewichtung):
 * 1. Type/Species Culture
 * 2. Faction(s) via parentId-Kette
 * 3. Creature-eigener lootPool (höchste Priorität)
 *
 * @param creature - Die Kreatur mit optionalem lootPool
 * @param faction - Die Fraktion (optional)
 * @returns Gewichteter Pool von Item-IDs
 */
export function resolveLootPool(
  creature: CreatureWithLoot,
  faction: Faction | null
): Array<{ item: string; randWeighting: number }> {
  // 1. Culture-Chain aufbauen (Type/Species → Faction(s))
  const creatureDef = creature as unknown as CreatureDefinition;
  const cultureLayers = resolveCultureChain(creatureDef, faction);

  // 2. Creature als unterste Layer hinzufügen (höchste Priorität)
  const layers: CultureLayer[] = [...cultureLayers];
  if (creature.lootPool && creature.lootPool.length > 0) {
    layers.push({
      source: 'type', // Wird als 'creature' behandelt, aber Type für Kompatibilität
      culture: { lootPool: creature.lootPool } as CultureData,
    });
  }

  // 3. mergeWeightedPool() für lootPool
  const pool = mergeWeightedPool(
    layers,
    (culture) => culture.lootPool,
    () => 1.0 // Basis-Gewicht
  );

  debug('resolveLootPool:', creature.id, '→', pool.length, 'items in pool');
  return pool;
}

// ============================================================================
// LOOT VALUE CALCULATION (Stub)
// ============================================================================

/**
 * Berechnet den Ziel-Loot-Wert für ein Encounter.
 * Formel: totalXP × goldPerXP(partyLevel) × avgWealth
 */
export function calculateLootValue(encounter: {
  totalXP: number;
  creatures: CreatureWithLoot[];
  partyLevel: number;
}): number {
  const goldPerXP = getGoldPerXP(encounter.partyLevel);
  const baseValue = encounter.totalXP * goldPerXP;
  const avgWealth = calculateAverageWealthMultiplier(encounter.creatures);
  const value = Math.round(baseValue * avgWealth);

  debug('calculateLootValue:', encounter.totalXP, 'XP × goldPerXP', goldPerXP, '× avgWealth', avgWealth, '→', value, 'Gold');
  return value;
}


// ============================================================================
// GENERIC ALLOCATION TYPES
// ============================================================================

/**
 * Item im Pool mit beliebigen Dimensionen.
 * Generisch typisiert für verschiedene Item-Typen.
 */
export interface PoolEntry<T> {
  item: T;
  randWeighting: number;
  dimensions: Record<string, number>;  // z.B. { value: 10, weight: 2 }
}

/**
 * Container der Items empfängt.
 * Gewichtung ergibt sich aus Budget-Verhältnissen (remaining/total).
 */
export interface AllocationContainer {
  id: string;
  budgets: Record<string, number>;    // z.B. { value: 100, weight: 50 }
  received: Record<string, number>;   // Tracking: { value: 0, weight: 0 }
}

/**
 * Ergebnis einer Item-Allokation.
 */
export interface AllocationResult<T> {
  containerId: string;
  item: T;
  quantity: number;
  dimensions: Record<string, number>; // Item-Dimensionen × Quantity
}

/**
 * Ergebnis von selectPoolItem (generisch).
 */
export interface PoolItemSelection<T> {
  item: T;
  quantity: number;
  dimensions: Record<string, number>;
}

// ============================================================================
// GENERIC ALLOCATION FUNCTIONS
// ============================================================================

/**
 * Wählt das nächste Item aus einem generischen Pool.
 *
 * Algorithmus:
 * 1. Filter: Items deren Dimensionen ≤ targetBudgets (alle Dimensionen)
 * 2. Weighted Random Selection aus eligible Items
 * 3. Quantity = min(targetBudget[dim] / item.dimension[dim]) für alle Dimensionen
 * 4. Item aus Pool entfernen (variety)
 *
 * @param pool - Mutabler Pool (wird modifiziert!)
 * @param targetBudgets - Ziel-Budgets pro Dimension für diese Iteration
 * @returns Item + Quantity + Dimensions, oder null wenn nichts passt
 */
export function selectPoolItem<T>(
  pool: PoolEntry<T>[],
  targetBudgets: Record<string, number>
): PoolItemSelection<T> | null {
  if (pool.length === 0) {
    debug('selectPoolItem: pool empty');
    return null;
  }

  // Step 1: Filter - Items deren Dimensionen ≤ targetBudgets (alle Dimensionen)
  const eligible = pool.filter(entry => {
    for (const [dim, targetValue] of Object.entries(targetBudgets)) {
      const itemValue = entry.dimensions[dim] ?? 0;
      if (itemValue > targetValue) {
        return false;
      }
    }
    return true;
  });

  if (eligible.length === 0) {
    debug('selectPoolItem: no eligible items for targetBudgets:', targetBudgets);
    return null;
  }

  // Step 2: Weighted random selection (inline to preserve full PoolEntry)
  const totalWeight = eligible.reduce((sum, entry) => sum + entry.randWeighting, 0);
  if (totalWeight <= 0) {
    debug('selectPoolItem: total weight is 0');
    return null;
  }

  let roll = Math.random() * totalWeight;
  let selected: PoolEntry<T> | null = null;
  for (const entry of eligible) {
    roll -= entry.randWeighting;
    if (roll <= 0) {
      selected = entry;
      break;
    }
  }
  if (!selected) {
    selected = eligible[eligible.length - 1]; // Fallback
  }

  // Step 3: Calculate quantity = min(targetBudget[dim] / item.dimension[dim])
  let quantity = Infinity;
  for (const [dim, targetValue] of Object.entries(targetBudgets)) {
    const itemValue = selected.dimensions[dim];
    if (itemValue && itemValue > 0) {
      const qtyForDim = Math.floor(targetValue / itemValue);
      quantity = Math.min(quantity, qtyForDim);
    }
  }
  quantity = Math.max(1, isFinite(quantity) ? quantity : 1);

  // Step 4: Remove from pool (variety)
  const poolIndex = pool.findIndex(entry => entry === selected);
  if (poolIndex !== -1) {
    pool.splice(poolIndex, 1);
  }

  // Dimensions × Quantity
  const totalDimensions: Record<string, number> = {};
  for (const [dim, value] of Object.entries(selected.dimensions)) {
    totalDimensions[dim] = value * quantity;
  }

  debug('selectPoolItem: selected item ×', quantity, 'dimensions:', totalDimensions);

  return {
    item: selected.item,
    quantity,
    dimensions: totalDimensions,
  };
}

/**
 * Wählt einen Container für ein Item basierend auf Budget-Verhältnissen.
 *
 * Gewichtung pro Container:
 * - Pro Dimension: (remaining / total) = (budgets[dim] - received[dim]) / totals[dim]
 * - Kombiniertes Gewicht: Durchschnitt aller Dimensionen
 *
 * @param dimensions - Item-Dimensionen × Quantity
 * @param containers - Verfügbare Container (received wird NICHT modifiziert)
 * @param totals - Gesamt-Budgets für Gewichtungsberechnung
 * @returns Container oder null wenn keiner passt
 */
export function selectTargetContainer(
  dimensions: Record<string, number>,
  containers: AllocationContainer[],
  totals: Record<string, number>
): AllocationContainer | null {
  if (containers.length === 0) {
    debug('selectTargetContainer: no containers');
    return null;
  }

  // Step 1: Filter - Container wo Item reinpasst
  const eligible: Array<{ container: AllocationContainer; weight: number }> = [];

  for (const container of containers) {
    // Prüfen: Passt Item in alle Dimensionen?
    let fits = true;
    for (const [dim, itemValue] of Object.entries(dimensions)) {
      const budget = container.budgets[dim] ?? 0;
      const received = container.received[dim] ?? 0;
      const remaining = budget - received;
      if (itemValue > remaining) {
        fits = false;
        break;
      }
    }
    if (!fits) continue;

    // Step 2: Gewicht berechnen = Durchschnitt aller (remaining / total)
    let weightSum = 0;
    let dimCount = 0;
    for (const dim of Object.keys(dimensions)) {
      const budget = container.budgets[dim] ?? 0;
      const received = container.received[dim] ?? 0;
      const remaining = budget - received;
      const total = totals[dim] ?? 1;
      const ratio = remaining / Math.max(1, total);
      weightSum += ratio;
      dimCount++;
    }
    const weight = dimCount > 0 ? weightSum / dimCount : 0.1;

    eligible.push({ container, weight: Math.max(0.01, weight) });
  }

  if (eligible.length === 0) {
    debug('selectTargetContainer: no eligible containers for dimensions:', dimensions);
    return null;
  }

  // Step 3: Weighted random selection
  const totalWeight = eligible.reduce((sum, e) => sum + e.weight, 0);
  let roll = Math.random() * totalWeight;

  for (const { container, weight } of eligible) {
    roll -= weight;
    if (roll <= 0) {
      debug('selectTargetContainer: selected', container.id, '(weight:', weight.toFixed(3), ')');
      return container;
    }
  }

  // Fallback
  return eligible[0].container;
}

/**
 * Generische Item-Allokation auf Container.
 * Iteriert intern bis eines der Budgets erschöpft ist.
 *
 * @param pool - Pool mit Items und Dimensionen (wird mutiert!)
 * @param containers - Container mit Budgets (received wird aktualisiert)
 * @param options - Optionen
 * @returns Allokations-Ergebnisse
 */
export function allocateItems<T>(
  pool: PoolEntry<T>[],
  containers: AllocationContainer[],
  options: {
    maxIterations?: number;
    /**
     * Berechnet targetBudgets für jeden Iterationsschritt.
     * @param remainingBudgets - Summe aller verbleibenden Container-Budgets
     * @param poolSize - Aktuelle Pool-Größe
     * @returns Target-Budgets für diese Iteration
     */
    calcTargetBudgets: (
      remainingBudgets: Record<string, number>,
      poolSize: number
    ) => Record<string, number>;
  }
): AllocationResult<T>[] {
  const maxIterations = options.maxIterations ?? 100;
  const results: AllocationResult<T>[] = [];

  // Totals berechnen (Summe aller Container-Budgets pro Dimension)
  const totals: Record<string, number> = {};
  for (const container of containers) {
    for (const [dim, budget] of Object.entries(container.budgets)) {
      totals[dim] = (totals[dim] ?? 0) + budget;
    }
  }

  // Remaining Budgets initialisieren (= totals)
  const remainingBudgets: Record<string, number> = { ...totals };

  debug('allocateItems: starting with totals:', totals, 'pool size:', pool.length);

  let iterations = 0;
  while (iterations++ < maxIterations && pool.length > 0) {
    // 1. Target-Budgets für diese Iteration berechnen
    const targetBudgets = options.calcTargetBudgets(remainingBudgets, pool.length);

    // 2. Item auswählen
    const selection = selectPoolItem(pool, targetBudgets);
    if (!selection) {
      debug('allocateItems: no more eligible items');
      break;
    }

    // 3. Container auswählen
    const container = selectTargetContainer(selection.dimensions, containers, totals);
    if (!container) {
      debug('allocateItems: no container fits item, stopping');
      break;
    }

    // 4. Allokation speichern
    results.push({
      containerId: container.id,
      item: selection.item,
      quantity: selection.quantity,
      dimensions: selection.dimensions,
    });

    // 5. Container.received aktualisieren
    for (const [dim, value] of Object.entries(selection.dimensions)) {
      container.received[dim] = (container.received[dim] ?? 0) + value;
    }

    // 6. RemainingBudgets aktualisieren
    for (const [dim, value] of Object.entries(selection.dimensions)) {
      remainingBudgets[dim] = (remainingBudgets[dim] ?? 0) - value;
    }

    // 7. Abbruch wenn EIN Budget erschöpft (≤ 0)
    const exhausted = Object.entries(remainingBudgets).some(([dim, val]) => {
      // Nur Dimensionen prüfen die auch Budgets haben
      return totals[dim] !== undefined && val <= 0;
    });
    if (exhausted) {
      debug('allocateItems: budget exhausted, stopping');
      break;
    }
  }

  debug('allocateItems: completed with', results.length, 'allocations after', iterations - 1, 'iterations');
  return results;
}
