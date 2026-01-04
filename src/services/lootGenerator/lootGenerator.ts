// Ziel: Loot-Generierung mit Budget-Tracking und Container-Pool-Allokation
// Siehe: docs/services/Loot.md

import { GOLD_PER_XP_BY_LEVEL, WEALTH_MULTIPLIERS, type WealthTag } from '@/constants/loot';
import { vault } from '@/infrastructure/vault/vaultInstance';
import { aggregateWeightedPools, randomBetween, weightedRandomSelect } from '@/utils';
import type { WeightedItem } from '#types/common/counting';
import type { Faction } from '#entities/faction';

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
// LOOT POOL RESOLUTION
// ============================================================================

/**
 * Löst den Loot-Pool für eine Kreatur auf.
 *
 * Aktuell: Nur Creature.lootPool (Culture-Kaskade nicht implementiert,
 * da keine Culture-Presets lootPools definiert haben).
 *
 * @param creature - Die Kreatur mit optionalem lootPool
 * @param _faction - Die Fraktion (unused, für spätere Culture-Kaskade)
 * @returns Gewichteter Pool von Item-IDs
 */
export function resolveLootPool(
  creature: CreatureWithLoot,
  _faction: Faction | null
): Array<{ item: string; randWeighting: number }> {
  if (!creature.lootPool || creature.lootPool.length === 0) {
    debug('resolveLootPool:', creature.id, '→ no lootPool defined');
    return [];
  }

  // Uniform weight für alle Items im Creature-lootPool
  const pool = creature.lootPool.map(itemId => ({
    item: itemId,
    randWeighting: 1.0,
  }));

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


/**
 * Ergebnis einer Item-Allokation.
 */
export interface AllocationResult<T> {
  containerId: string;
  item: T;
  quantity: number;
  dimensions: Record<string, number>; // Item-Dimensionen × Quantity
}

// ============================================================================
// CONTAINER-POOL ALLOCATION (Unified)
// ============================================================================

/**
 * Container mit eigenem Pool für distributePoolItems().
 * Jeder Container bringt seinen eigenen Pool mit.
 */
export interface ContainerWithPool<T> {
  id: string;
  pool: Array<{ item: T; randWeighting: number; dimensions: Record<string, number> }>;
  budgets: Record<string, number>;  // z.B. { value: 100, weight: 50 }
}

/**
 * Interne Tracking-Struktur für Container während der Allokation.
 */
interface ContainerState<T> {
  id: string;
  pool: Map<string, { item: T; randWeighting: number; dimensions: Record<string, number> }>;
  budgets: Record<string, number>;
  received: Record<string, number>;
}

/**
 * Berechnet Budget-Fraktionen basierend auf logarithmischer Skalierung.
 *
 * Ziel: Item-Anzahl skaliert logarithmisch mit Budget:
 * - 1000 Gold → 4-13 Items
 * - 10000 Gold → 8-24 Items
 * - 100000 Gold → 12-37 Items
 */
function calcBudgetFraction(
  totalBudget: number,
  poolSize: number
): number {
  if (totalBudget <= 0 || poolSize <= 0) return 0;

  // Ziel-Item-Anzahl: log10(budget)² ergibt schöne Skalierung
  const logBudget = Math.log10(Math.max(10, totalBudget));
  const targetItems = Math.max(1, Math.floor(logBudget * logBudget));

  // Prozent-Range für Varianz (±50% um target)
  const maxPercent = 100 / (targetItems * 0.5);   // Weniger Items = höhere %
  const minPercent = 100 / (targetItems * 1.5);   // Mehr Items = niedrigere %

  // Pool-Size Constraint (nicht mehr als Pool erlaubt)
  const adjustedMinPercent = Math.max(minPercent, 100 / poolSize);

  // Random zwischen min und max
  const percent = randomBetween(
    Math.floor(adjustedMinPercent),
    Math.ceil(maxPercent)
  );

  const fraction = totalBudget * (percent / 100);
  debug('calcBudgetFraction: budget', totalBudget, 'poolSize', poolSize, '→', percent.toFixed(1), '% →', fraction.toFixed(1));
  return fraction;
}

/**
 * Prüft ob ein Container mindestens ein Budget erschöpft hat.
 * Ein Container ist "inaktiv" wenn received >= budget für irgendeine Dimension.
 */
function hasExhaustedBudget<T>(state: ContainerState<T>): boolean {
  return Object.keys(state.budgets).some(dim =>
    (state.received[dim] ?? 0) >= state.budgets[dim]
  );
}

/**
 * Verteilt Items aus Container-eigenen Pools auf ALLE passenden Container.
 *
 * Algorithmus:
 * 1. Initialisiere states, startTotalBudget, usedTotalBudget
 * 2. LOOP:
 *    a. Filter activeStates = states wo KEIN Budget erschöpft (received >= budget)
 *    b. IF usedTotalBudget >= startTotalBudget für irgendein dim → RETURN
 *    c. IF activeStates leer → RETURN
 *    d. Aggregiere pools NUR von activeStates → aggregatedPool
 *    e. Berechne Budget-Fraktion pro Dimension (von startTotalBudget!)
 *    f. Wähle Item das in Fraktionen passt
 *    g. Berechne baseQuantity = min(fraction / itemDim) für alle dims
 *    h. Finde eligibleContainers: activeStates wo Item im Pool + nicht exhausted
 *    i. Verteile auf ALLE eligibleContainers (gewichtet nach remaining budget)
 *    j. Entferne Item aus ALLEN Pools
 *    k. Erhöhe usedTotalBudget
 *    l. GOTO 2
 *
 * @param containers - Container mit eigenen Pools und Budgets
 * @param options - Optionale Konfiguration
 * @returns Allokations-Ergebnisse für alle Container
 */
export function distributePoolItems<T>(
  containers: ContainerWithPool<T>[],
  options?: {
    maxIterations?: number;
    getItemKey?: (item: T) => string;
  }
): AllocationResult<T>[] {
  if (containers.length === 0) {
    debug('distributePoolItems: no containers');
    return [];
  }

  const maxIterations = options?.maxIterations ?? 100;
  const getItemKey = options?.getItemKey ?? ((item: T) =>
    typeof item === 'object' && item !== null && 'id' in item
      ? String((item as { id: unknown }).id)
      : JSON.stringify(item)
  );

  const results: AllocationResult<T>[] = [];

  // Step 1: Initialize container states with Map-based pools
  const states: ContainerState<T>[] = containers.map(c => ({
    id: c.id,
    pool: new Map(c.pool.map(entry => [getItemKey(entry.item), entry])),
    budgets: { ...c.budgets },
    received: Object.fromEntries(Object.keys(c.budgets).map(k => [k, 0])),
  }));

  // Calculate start total budgets across all containers (immutable reference)
  const startTotalBudget: Record<string, number> = {};
  for (const state of states) {
    for (const [dim, budget] of Object.entries(state.budgets)) {
      startTotalBudget[dim] = (startTotalBudget[dim] ?? 0) + budget;
    }
  }

  // Track used budgets globally
  const usedTotalBudget: Record<string, number> = {};

  debug('distributePoolItems: starting with', containers.length, 'containers, startTotal:', startTotalBudget);

  let iterations = 0;
  while (iterations++ < maxIterations) {
    // Step 2a: Filter to containers with NO exhausted budget
    const activeStates = states.filter(s => !hasExhaustedBudget(s));

    // Step 2b: Check global budget exhaustion
    const globalExhausted = Object.entries(usedTotalBudget).some(([dim, used]) =>
      startTotalBudget[dim] !== undefined && used >= startTotalBudget[dim]
    );
    if (globalExhausted) {
      debug('distributePoolItems: global budget exhausted');
      break;
    }

    // Step 2c: Check if any active containers remain
    if (activeStates.length === 0) {
      debug('distributePoolItems: no active containers');
      break;
    }

    // Step 2d: Aggregate pools from ACTIVE states only
    const allPools = activeStates.map(s => Array.from(s.pool.values()));
    const aggregatedPool = aggregateWeightedPools(allPools, getItemKey);

    if (aggregatedPool.length === 0) {
      debug('distributePoolItems: aggregated pool empty');
      break;
    }

    // Step 2e: Calculate budget fractions from START total budget
    const targetBudgets: Record<string, number> = {};
    for (const [dim, total] of Object.entries(startTotalBudget)) {
      targetBudgets[dim] = calcBudgetFraction(total, aggregatedPool.length);
    }

    // Step 2f: Find items that fit in target budgets
    const eligibleItems = aggregatedPool.filter(entry => {
      for (const state of activeStates) {
        const poolEntry = state.pool.get(getItemKey(entry.item));
        if (poolEntry) {
          let fits = true;
          for (const [dim, target] of Object.entries(targetBudgets)) {
            const itemDim = poolEntry.dimensions[dim] ?? 0;
            if (itemDim > target) {
              fits = false;
              break;
            }
          }
          if (fits) return true;
        }
      }
      return false;
    });

    if (eligibleItems.length === 0) {
      debug('distributePoolItems: no items fit target budgets', targetBudgets);
      break;
    }

    // Select item via weighted random
    const selectedItem = weightedRandomSelect(
      eligibleItems.map(e => ({ item: e.item, randWeighting: e.randWeighting })),
      'distributePoolItems'
    );
    if (!selectedItem) {
      debug('distributePoolItems: weightedRandomSelect returned null');
      break;
    }

    const itemKey = getItemKey(selectedItem);

    // Get full item dimensions from first active container that has it
    let itemDimensions: Record<string, number> = {};
    for (const state of activeStates) {
      const poolEntry = state.pool.get(itemKey);
      if (poolEntry) {
        itemDimensions = poolEntry.dimensions;
        break;
      }
    }

    // Step 2g: Calculate baseQuantity and track limiting dimension
    let baseQuantity = Infinity;
    let limitingDim = '';
    for (const [dim, target] of Object.entries(targetBudgets)) {
      const itemDim = itemDimensions[dim];
      if (itemDim && itemDim > 0) {
        const qty = Math.floor(target / itemDim);
        if (qty < baseQuantity) {
          baseQuantity = qty;
          limitingDim = dim;
        }
      }
    }
    baseQuantity = Math.max(1, isFinite(baseQuantity) ? baseQuantity : 1);

    // Step 2h: Find ALL eligible containers (active + has item in pool)
    const eligibleContainers = activeStates.filter(state =>
      state.pool.has(itemKey) && !hasExhaustedBudget(state)
    );

    if (eligibleContainers.length === 0) {
      debug('distributePoolItems: no container can receive item', itemKey);
      // Remove item from all pools and continue
      for (const state of states) {
        state.pool.delete(itemKey);
      }
      continue;
    }

    // Step 2i: Distribute to ALL eligible containers
    // Weight = remaining budget in limiting dimension
    const containerWeights = eligibleContainers.map(state => ({
      state,
      weight: Math.max(0.01, state.budgets[limitingDim] - (state.received[limitingDim] ?? 0)),
    }));
    const totalWeight = containerWeights.reduce((sum, c) => sum + c.weight, 0);

    for (const { state, weight } of containerWeights) {
      // Quantity for this container based on weight ratio
      const containerQuantity = Math.max(1, Math.round(baseQuantity * (weight / totalWeight)));

      // Calculate dimensions for this allocation
      const allocDimensions: Record<string, number> = {};
      for (const [dim, value] of Object.entries(itemDimensions)) {
        allocDimensions[dim] = value * containerQuantity;
      }

      // Record allocation
      results.push({
        containerId: state.id,
        item: selectedItem,
        quantity: containerQuantity,
        dimensions: allocDimensions,
      });

      // Update container's received
      for (const [dim, value] of Object.entries(allocDimensions)) {
        state.received[dim] = (state.received[dim] ?? 0) + value;
      }

      // Step 2k: Update global usedTotalBudget
      for (const [dim, value] of Object.entries(allocDimensions)) {
        usedTotalBudget[dim] = (usedTotalBudget[dim] ?? 0) + value;
      }

      debug('distributePoolItems: allocated', itemKey, '×', containerQuantity, 'to', state.id);
    }

    // Step 2j: Remove item from ALL pools
    for (const state of states) {
      state.pool.delete(itemKey);
    }
  }

  debug('distributePoolItems: completed with', results.length, 'allocations after', iterations - 1, 'iterations');
  return results;
}
