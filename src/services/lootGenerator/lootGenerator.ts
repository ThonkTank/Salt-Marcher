// Ziel: Loot-Generierung mit Budget-Tracking, DefaultLoot und Culture-Resolution-Kaskade
// Siehe: docs/services/Loot.md
//
// TASKS:
// |  # | Status | Domain | Layer    | Beschreibung                                                           |  Prio  | MVP? | Deps     | Spec                         | Imp.                                                                             |
// |--:|:----:|:-----|:-------|:---------------------------------------------------------------------|:----:|:--:|:-------|:---------------------------|:-------------------------------------------------------------------------------|
// | 70 |   ✅    | Loot   | services | getGoldPerXP() - Lookup in DMG-Tabelle, clamp 1-20                     | mittel | Nein | #69      | Loot.md#budget-berechnung    | services/lootGenerator/lootGenerator.ts.getGoldPerXP() [neu]                     |
// | 73 |   ✅    | Loot   | services | getWealthMultiplier() - Wealth-Tag aus Creature lesen, default 1.0     | mittel | Nein | #72      | Loot.md#wealth-system        | services/lootGenerator/lootGenerator.ts.getWealthMultiplier() [neu]              |
// | 74 |   ✅    | Loot   | services | calculateAverageWealthMultiplier() - Durchschnitt ueber alle Kreaturen | mittel | Nein | #73      | Loot.md#wealth-system        | services/lootGenerator/lootGenerator.ts.calculateAverageWealthMultiplier() [neu] |
// | 75 |   ✅    | Loot   | services | calculateLootValue() - totalXP * LOOT_MULTIPLIER * avgWealth           | mittel | Nein | #74      | Loot.md#loot-wert-berechnung | services/lootGenerator/lootGenerator.ts.calculateLootValue() [neu]               |
// | 79 |   ✅    | Loot   | services | generateLoot(pool, budget) - Pool-basiertes Loot bis Budget erschoepft | mittel | Nein | #75      | Loot.md#item-auswahl         | services/lootGenerator/lootGenerator.ts.generateLoot() [neu]                     |
//
// Pipeline: Placeholder-Stubs für MVP-Iteration

import { GOLD_PER_XP_BY_LEVEL, WEALTH_MULTIPLIERS, type WealthTag } from '@/constants/loot';
import { vault } from '@/infrastructure/vault/vaultInstance';
import {
  resolveCultureChain,
  mergeWeightedPool,
  type CultureLayer,
} from '@/utils/cultureResolution';
import { weightedRandomSelect } from '@/utils/random';
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
// LOOT POOL TYPES
// ============================================================================

/** Geladener Pool-Eintrag (Item bereits aus Vault geladen) */
export interface LoadedPoolEntry {
  item: Item;
  randWeighting: number;
}

/** Ergebnis von selectNextItem */
export interface ItemSelection {
  item: Item;
  quantity: number;
}

// ============================================================================
// POOL LOADING
// ============================================================================

/**
 * Lädt Items aus dem Vault und erstellt einen mutablen Pool.
 * Items die nicht im Vault existieren werden übersprungen.
 *
 * @param pool - Gewichteter Pool von Item-IDs
 * @returns Geladener Pool (mutable für Variety-Entfernung)
 */
export function loadPool(
  pool: Array<{ itemId: string; randWeighting: number }>
): LoadedPoolEntry[] {
  const loadedPool = pool
    .map(entry => {
      const item = vault.getEntity<Item>('item', entry.itemId);
      return item ? { item, randWeighting: entry.randWeighting } : null;
    })
    .filter((x): x is LoadedPoolEntry => x !== null);

  debug('loadPool: loaded', loadedPool.length, 'of', pool.length, 'items from vault');
  return loadedPool;
}

// ============================================================================
// SINGLE-STEP ITEM SELECTION
// ============================================================================

/**
 * Wählt das nächste Item aus dem Pool (Single-Step, kein Loop).
 *
 * Algorithmus:
 * 1. Filter: affordable (value ≤ budget) + carryable (pounds ≤ capacity)
 * 2. Weighted Random Selection aus eligible Items
 * 3. Quantity: min(qtyByValue, qtyByPounds) basierend auf 10-30% Targets
 * 4. Item aus Pool entfernen (Variety: jedes Item max. einmal)
 *
 * WICHTIG: Der Loop ist in encounterLoot.ts - diese Funktion wird pro Item aufgerufen.
 * Nach Rückgabe muss der Caller:
 * - Item der Ziel-Kreatur zuweisen
 * - Bei carryCapacityMultiplier: Kreatur-Kapazität anpassen
 * - Budget aktualisieren
 *
 * @param pool - Mutabler Pool (bereits geladen via loadPool())
 * @param remainingBudget - Verbleibendes Budget in Gold
 * @param totalCapacity - Gesamt-Tragkapazität aller Carriers in lb
 * @returns Ausgewähltes Item mit Menge, oder null wenn Pool erschöpft
 */
export function selectNextItem(
  pool: LoadedPoolEntry[],
  remainingBudget: number,
  totalCapacity: number
): ItemSelection | null {
  if (pool.length === 0) {
    debug('selectNextItem: pool empty');
    return null;
  }

  // Step 1: Filter affordable + carryable
  const eligible = pool.filter(entry => {
    const itemPounds = entry.item.pounds ?? 0;
    const affordable = entry.item.value <= remainingBudget;
    const carryable = itemPounds === 0 || itemPounds <= totalCapacity;
    return affordable && carryable;
  });

  if (eligible.length === 0) {
    debug('selectNextItem: no eligible items (budget:', remainingBudget, 'capacity:', totalCapacity, ')');
    return null;
  }

  // Step 2: Weighted random selection
  const selected = weightedRandomSelect(eligible, 'selectNextItem');

  if (!selected) {
    debug('selectNextItem: weightedRandomSelect returned null');
    return null;
  }

  // Step 3: Calculate quantity (10-30% of remaining budget/capacity)
  const itemPounds = selected.pounds ?? 0;
  const targetValue = remainingBudget * (0.1 + Math.random() * 0.2);
  const targetPounds = totalCapacity * (0.1 + Math.random() * 0.2);

  const qtyByValue = Math.floor(targetValue / selected.value);
  const qtyByPounds = itemPounds > 0
    ? Math.floor(targetPounds / itemPounds)
    : Infinity;

  const quantity = Math.max(1, Math.min(qtyByValue, qtyByPounds));

  // Step 4: Remove from pool (variety - jedes Item max. einmal)
  const poolIndex = pool.findIndex(entry => entry.item === selected);
  if (poolIndex !== -1) {
    pool.splice(poolIndex, 1);
  }

  debug('selectNextItem:', selected.id, '×', quantity);

  return { item: selected, quantity };
}

// ============================================================================
// LEGACY WRAPPER (für Backward-Compatibility)
// ============================================================================

/**
 * @deprecated Use selectNextItem() in a loop instead.
 * Diese Funktion existiert für Backward-Compatibility.
 */
export function generateLoot(
  pool: Array<{ itemId: string; randWeighting: number }>,
  budget: number,
  carryCapacity: number = Infinity
): GeneratedLoot {
  debug('generateLoot [DEPRECATED]: use selectNextItem() loop instead');

  const loadedPool = loadPool(pool);
  const selectedItems: SelectedItem[] = [];
  let remainingBudget = budget;
  let remainingCapacity = carryCapacity;

  let iterations = 0;
  const MAX_ITERATIONS = 100;

  while (iterations++ < MAX_ITERATIONS && remainingBudget > 0) {
    const selection = selectNextItem(loadedPool, remainingBudget, remainingCapacity);
    if (!selection) break;

    selectedItems.push(selection);

    // Update remaining (ohne Multiplikator - legacy behavior)
    remainingBudget -= selection.item.value * selection.quantity;
    const itemPounds = selection.item.pounds ?? 0;
    remainingCapacity -= itemPounds * selection.quantity;
  }

  const totalValue = budget - remainingBudget;
  debug('generateLoot: total', totalValue.toFixed(0), 'from', selectedItems.length, 'items');

  return { items: selectedItems, totalValue };
}
