// Ziel: Loot fuer Encounter generieren und auf Kreaturen verteilen
// Siehe: docs/services/encounter/encounterLoot.md
//
// Pipeline (3 Steps):
// 1. Pools aggregieren + Budget berechnen (aggregatePools)
// 2. generateLoot() einmal aufrufen
// 3. Items auf Kreaturen verteilen (distributeItems)
//
// TASKS:
// |  # | Status | Domain    | Layer    | Beschreibung                                                        |  Prio  | MVP? | Deps | Spec                                                        | Imp.                                         |
// |--:|:----:|:--------|:-------|:------------------------------------------------------------------|:----:|:--:|:---|:----------------------------------------------------------|:-------------------------------------------|
// | 83 |   ✅    | Encounter | services | aggregatePools() - Creature-Pools kombinieren mit CR-Gewichtung     | mittel | Nein | -    | encounterLoot.md#step-1-pools-aggregieren--budget-berechnen | encounterGenerator/encounterLoot.ts [ändern] |
// | 84 |   ✅    | Encounter | services | distributeItems() - Items auf Creatures verteilen (CR × Pool-Match) | mittel | Nein | -    | encounterLoot.md#step-3-items-auf-kreaturen-verteilen       | encounterGenerator/encounterLoot.ts [ändern] |

import type { EncounterCreatureInstance } from './encounterNPCs';
import type { GroupWithActivity } from './groupActivity';
import type { CreatureDefinition, Faction } from '@/types/entities';
import type { WealthTag } from '@/constants/loot';
import type { CreatureSize } from '@/constants/creature';
import type { NarrativeRole } from '@/constants/encounter';
import { vault } from '@/infrastructure/vault/vaultInstance';
import { CR_TO_XP, CARRY_CAPACITY_BY_SIZE, CR_TO_LEVEL_MAP } from '@/constants';
import {
  calculateLootValue,
  generateLoot,
  getWealthMultiplier,
  resolveLootPool,
  xpToGold,
  loadPool,
  selectNextItem,
  type Item,
  type LoadedPoolEntry,
} from '../lootGenerator/lootGenerator';
import { aggregateWeightedPools } from '@/utils';

// ============================================================================
// DEBUG HELPER
// ============================================================================

const debug = (...args: unknown[]) => {
  if (process.env.DEBUG_SERVICES === 'true') {
    console.log('[encounterLoot]', ...args);
  }
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Konvertiert Creature CR zu äquivalentem Character Level.
 * Für party-unabhängige Loot-Berechnung (Ally, Victim, Neutral).
 */
function crToEquivalentLevel(cr: number): number {
  return CR_TO_LEVEL_MAP[cr] ?? Math.max(1, Math.min(20, Math.round(cr)));
}

/**
 * Berechnet Reward-Anteil den Victim-Gruppe an Party abgibt.
 * Je stärker die Threat relativ zur Victim, desto mehr Reward.
 *
 * @param threatXP - Gesamt-XP der Threat-Gruppe(n)
 * @param victimXP - Gesamt-XP der Victim-Gruppe
 * @returns Faktor 0.1-0.5 (10-50% des Victim-Besitzes)
 */
function calculateVictimRewardRatio(threatXP: number, victimXP: number): number {
  if (victimXP === 0) return 0.1;
  const threatStrength = threatXP / victimXP;
  // Stärkere Threat → mehr Reward (max 50%)
  return Math.max(0.1, Math.min(0.5, threatStrength * 0.4));
}

/**
 * Berechnet das Budget-Level für eine Creature basierend auf NarrativeRole.
 */
function getBudgetLevel(
  cr: number,
  narrativeRole: NarrativeRole,
  partyLevel: number
): number {
  switch (narrativeRole) {
    case 'threat':
      return partyLevel;
    case 'victim':
    case 'ally':
      return crToEquivalentLevel(cr);
    case 'neutral':
      return Math.round((crToEquivalentLevel(cr) + partyLevel) / 2);
    default:
      return partyLevel;
  }
}

// ============================================================================
// TYPES
// ============================================================================

/**
 * Wählt eine Ziel-Kreatur für ein einzelnes Item aus.
 * Gewichtung: poolEntry.randWeighting × budgetFactor
 *
 * @returns CreaturePoolEntry oder null wenn keine eligible
 */
function selectTargetCreature(
  item: Item,
  _quantity: number,
  creaturePools: CreaturePoolEntry[]
): CreaturePoolEntry | null {
  if (creaturePools.length === 0) return null;

  // Step 1: Finde eligible Kreaturen (haben Item im Pool)
  const eligible: { entry: CreaturePoolEntry; weight: number }[] = [];

  for (const cp of creaturePools) {
    const poolEntry = cp.pool.find(p => p.itemId === item.id);
    if (!poolEntry) continue;

    // Remaining Budget Factor: mehr offenes Budget = höheres Gewicht
    const remaining = cp.budget - cp.receivedValue;
    const budgetFactor = Math.max(0.1, remaining / Math.max(1, cp.budget));

    // Kombiniertes Gewicht = Pool-Weight × Budget-Factor
    const weight = poolEntry.randWeighting * budgetFactor;
    eligible.push({ entry: cp, weight });
  }

  // Fallback: Niemand hat Item im Pool → alle Carriers nach Budget verteilen
  if (eligible.length === 0) {
    for (const cp of creaturePools) {
      if (cp.pool.length === 0) continue;
      const remaining = cp.budget - cp.receivedValue;
      const weight = Math.max(0.1, remaining / Math.max(1, cp.budget));
      eligible.push({ entry: cp, weight });
    }
  }

  if (eligible.length === 0) return null;

  // Step 2: Weighted random selection
  const totalWeight = eligible.reduce((sum, e) => sum + e.weight, 0);
  if (totalWeight === 0) return null;

  let roll = Math.random() * totalWeight;
  for (const { entry, weight } of eligible) {
    roll -= weight;
    if (roll <= 0) {
      debug('selectTargetCreature:', item.id, '→ creature', entry.creatureIndex, '(weight:', weight.toFixed(2), ')');
      return entry;
    }
  }

  // Fallback: erster eligible
  return eligible[0].entry;
}

/** Output von generateEncounterLoot - GroupWithActivity erweitert um Loot */
export interface GroupWithLoot extends Omit<GroupWithActivity, 'creatures'> {
  creatures: EncounterCreatureInstance[]; // Creatures mit loot-Feld
  loot: {
    items: { id: string; quantity: number }[];
    totalValue: number;
    partyObtainableValue: number; // Was die Party tatsächlich bekommt
    countsTowardsBudget: boolean;
  };
}

/** Internes Tracking für Creature-Pools (für Item-Verteilung) */
interface CreaturePoolEntry {
  creatureIndex: number;
  pool: Array<{ itemId: string; randWeighting: number }>;
  cr: number;
  size: CreatureSize;         // Für Carry-Capacity-Berechnung
  narrativeRole: NarrativeRole;
  budget: number;             // Gesamt-Budget der Kreatur
  partyContribution: number;  // Anteil der zum Party-Budget zählt
  receivedValue: number;      // Tracking während Verteilung
  baseCapacity: number;       // Basis-Tragkapazität (aus Size)
  currentCapacity: number;    // Aktuelle Kapazität (mit Multiplikatoren)
}

// ============================================================================
// STEP 1: POOLS AGGREGIEREN + BUDGET BERECHNEN
// ============================================================================

/**
 * Aggregiert alle Creature-Pools zu einem kombinierten Pool.
 * Pool-Weights werden einfach summiert (via aggregateWeightedPools).
 * Berechnet auch die Gesamt-Tragkapazität aller Carriers.
 *
 * Zwei-Pass-Ansatz:
 * 1. XP pro NarrativeRole sammeln (für VictimRewardRatio)
 * 2. Budget pro Creature berechnen + Pools sammeln
 */
function aggregatePools(
  groups: GroupWithActivity[],
  context: { partyLevel: number }
): {
  aggregatedPool: Array<{ itemId: string; randWeighting: number }>;
  creaturePools: CreaturePoolEntry[];
  partyBudget: number;       // threat (100%) + victim (Reward-Anteil)
  independentBudget: number; // ally + neutral + victim (Habseligkeiten)
  totalCapacity: number;
} {
  // -------------------------------------------------------------------------
  // Pass 1: XP pro NarrativeRole sammeln
  // -------------------------------------------------------------------------
  let threatXP = 0;
  let victimXP = 0;

  for (const group of groups) {
    for (const creature of group.creatures) {
      const def = vault.getEntity<CreatureDefinition>('creature', creature.definitionId);
      if (!def) continue;
      const xp = CR_TO_XP[def.cr] ?? 0;
      if (group.narrativeRole === 'threat') threatXP += xp;
      if (group.narrativeRole === 'victim') victimXP += xp;
    }
  }

  const victimRewardRatio = calculateVictimRewardRatio(threatXP, victimXP);
  debug('Pass 1 - XP by role:', { threatXP, victimXP, victimRewardRatio });

  // -------------------------------------------------------------------------
  // Pass 2: Budget pro Creature berechnen + Pools sammeln
  // -------------------------------------------------------------------------
  const creaturePools: CreaturePoolEntry[] = [];
  const allPools: Array<Array<{ item: string; randWeighting: number }>> = [];
  let partyBudget = 0;
  let independentBudget = 0;

  let creatureIndex = 0;
  for (const group of groups) {
    const faction = group.factionId
      ? vault.getEntity<Faction>('faction', group.factionId)
      : null;

    for (const creature of group.creatures) {
      const def = vault.getEntity<CreatureDefinition>('creature', creature.definitionId);
      if (!def) {
        creatureIndex++;
        continue;
      }

      const xp = CR_TO_XP[def.cr] ?? 0;

      // Budget-Level basierend auf NarrativeRole
      const budgetLevel = getBudgetLevel(def.cr, group.narrativeRole, context.partyLevel);
      const creatureBudget = xpToGold(xp, budgetLevel) * getWealthMultiplier(def);

      // Party-Contribution basierend auf NarrativeRole
      let partyContribution: number;
      switch (group.narrativeRole) {
        case 'threat':
          partyContribution = creatureBudget; // 100%
          partyBudget += partyContribution;
          break;
        case 'victim':
          partyContribution = creatureBudget * victimRewardRatio; // 10-50%
          partyBudget += partyContribution;
          independentBudget += creatureBudget - partyContribution; // Rest sind Habseligkeiten
          break;
        case 'ally':
        case 'neutral':
        default:
          partyContribution = 0;
          independentBudget += creatureBudget;
          break;
      }

      // Nur Creatures mit carriesLoot bekommen Pool
      if (def.carriesLoot === false) {
        creatureIndex++;
        continue;
      }

      // Pool via Culture-Kaskade auflösen
      const pool = resolveLootPool(
        {
          id: def.id,
          lootPool: def.lootPool,
          species: def.species,
          tags: def.tags,
        },
        faction
      );

      // Pool zu { itemId, randWeighting } konvertieren (für creaturePools)
      const normalizedPool = pool.map(p => ({ itemId: p.item, randWeighting: p.randWeighting }));

      const size = (def.size as CreatureSize) ?? 'medium';
      const baseCapacity = CARRY_CAPACITY_BY_SIZE[size];

      creaturePools.push({
        creatureIndex,
        pool: normalizedPool,
        cr: def.cr,
        size,
        narrativeRole: group.narrativeRole,
        budget: creatureBudget,
        partyContribution,
        receivedValue: 0,
        baseCapacity,
        currentCapacity: baseCapacity, // Startet mit Basis, wird durch Multiplikatoren erhöht
      });

      // Pool für Aggregation sammeln
      allPools.push(pool);

      creatureIndex++;
    }
  }

  // Alle Pools aggregieren via cultureResolution Utility
  const mergedPool = aggregateWeightedPools(allPools, (item) => item);
  const aggregatedPool = mergedPool.map(p => ({ itemId: p.item as string, randWeighting: p.randWeighting }));

  // Gesamt-Tragkapazität aller Carriers berechnen
  const totalCapacity = creaturePools.reduce(
    (sum, cp) => sum + CARRY_CAPACITY_BY_SIZE[cp.size],
    0
  );

  debug('aggregatePools:', {
    partyBudget,
    independentBudget,
    totalCapacity,
    poolSize: aggregatedPool.length,
    creaturePools: creaturePools.length,
  });

  return { aggregatedPool, creaturePools, partyBudget, independentBudget, totalCapacity };
}

// ============================================================================
// STEP 3: ITEMS AUF KREATUREN VERTEILEN
// ============================================================================

/**
 * Verteilt generierte Items auf Creatures basierend auf Pool-Weight und Budget.
 *
 * Gewicht = poolEntry.weight × budgetFactor
 * budgetFactor = max(0.1, remainingBudget / creatureBudget)
 *
 * Items werden batch-weise verteilt (alle Items einer ID zusammen),
 * proportional auf eligible Creatures aufgeteilt.
 */
function distributeItems(
  items: Array<{ itemId: string; quantity: number }>,
  creaturePools: CreaturePoolEntry[],
  groups: GroupWithActivity[]
): void {
  if (creaturePools.length === 0) {
    debug('distributeItems: no carriers available');
    return;
  }

  for (const { itemId, quantity } of items) {
    if (quantity === 0) continue;

    // Item-Wert holen
    const item = vault.getEntity<{ value: number }>('item', itemId);
    const itemValue = item?.value ?? 1;

    // Step 1: Finde eligible Kreaturen (haben Item im Pool)
    const eligible: { idx: number; weight: number }[] = [];

    for (const cp of creaturePools) {
      const poolEntry = cp.pool.find(p => p.itemId === itemId);
      if (!poolEntry) continue;

      // Remaining Budget Factor: mehr offenes Budget = höheres Gewicht
      const remaining = cp.budget - cp.receivedValue;
      const budgetFactor = Math.max(0.1, remaining / Math.max(1, cp.budget));

      // Kombiniertes Gewicht = Pool-Weight × Budget-Factor
      const weight = poolEntry.randWeighting * budgetFactor;
      eligible.push({ idx: cp.creatureIndex, weight });
    }

    // Fallback: Niemand hat Item im Pool → alle Carriers nach Budget verteilen
    if (eligible.length === 0) {
      for (const cp of creaturePools) {
        if (cp.pool.length === 0) continue;
        const remaining = cp.budget - cp.receivedValue;
        const weight = Math.max(0.1, remaining / Math.max(1, cp.budget));
        eligible.push({ idx: cp.creatureIndex, weight });
      }
    }

    if (eligible.length === 0) continue;

    // Step 2: Proportionale Batch-Verteilung
    const totalWeight = eligible.reduce((sum, e) => sum + e.weight, 0);
    if (totalWeight === 0) continue;

    const allocations = eligible.map(e => ({
      creatureIndex: e.idx,
      ideal: (e.weight / totalWeight) * quantity,
      floor: 0,
      remainder: 0,
    }));

    // Floor-Werte und Remainders berechnen
    let distributed = 0;
    for (const alloc of allocations) {
      alloc.floor = Math.floor(alloc.ideal);
      alloc.remainder = alloc.ideal - alloc.floor;
      distributed += alloc.floor;
    }

    // Remaining Items nach Remainder-Größe verteilen
    allocations.sort((a, b) => b.remainder - a.remainder);
    const remaining = quantity - distributed;
    for (let i = 0; i < remaining && i < allocations.length; i++) {
      allocations[i].floor++;
    }

    // Step 3: Zuweisen + Budget tracken
    for (const alloc of allocations) {
      if (alloc.floor > 0) {
        assignItemToCreature(groups, alloc.creatureIndex, itemId, alloc.floor);

        // receivedValue updaten
        const cp = creaturePools.find(c => c.creatureIndex === alloc.creatureIndex);
        if (cp) cp.receivedValue += itemValue * alloc.floor;
      }
    }

    debug('distributeItems:', itemId, '×', quantity, '→', allocations.filter(a => a.floor > 0).length, 'creatures');
  }

  debug('distributeItems: distributed', items.length, 'unique item types');
}

/**
 * Weist Items einer Creature zu.
 */
function assignItemToCreature(
  groups: GroupWithActivity[],
  creatureIndex: number,
  itemId: string,
  quantity: number
): void {
  let idx = 0;
  for (const group of groups) {
    for (const creature of group.creatures) {
      if (idx === creatureIndex) {
        creature.loot = creature.loot ?? [];
        // Existierendes Item erhöhen oder neues hinzufügen
        const existing = creature.loot.find(l => l.id === itemId);
        if (existing) {
          existing.quantity += quantity;
        } else {
          creature.loot.push({ id: itemId, quantity });
        }
        return;
      }
      idx++;
    }
  }
}

// ============================================================================
// MAIN FUNCTION
// ============================================================================

/**
 * Generiert Loot für alle Encounter-Gruppen.
 *
 * Pipeline (mit carryCapacityMultiplier-Support):
 * 1. Pools aggregieren + Budget berechnen
 * 2. Loop: selectNextItem() → distribute → apply multiplier → repeat
 *
 * Budget nach NarrativeRole:
 * - threat: 100% Party-Budget (party-level-basiert)
 * - victim: CR-basiert + Reward (10-50% basierend auf Threat-Stärke)
 * - ally: CR-basiert, 0% Party
 * - neutral: Durchschnitt (CR + Party-Level), 0% Party
 */
export function generateEncounterLoot(
  groups: GroupWithActivity[],
  context: {
    terrain: { id: string };
    partyLevel: number;
  }
): GroupWithLoot[] {
  // -------------------------------------------------------------------------
  // Step 1: Pools aggregieren + Budget berechnen
  // -------------------------------------------------------------------------
  const { aggregatedPool, creaturePools, partyBudget, independentBudget } = aggregatePools(
    groups,
    context
  );

  // Gesamtbudget für Loot-Generierung (Party + Independent)
  let remainingBudget = partyBudget + independentBudget;

  if (remainingBudget === 0 || aggregatedPool.length === 0) {
    debug('No budget or empty pool, returning empty loot');
    return groups.map(g => ({
      ...g,
      loot: {
        items: [],
        totalValue: 0,
        partyObtainableValue: 0,
        countsTowardsBudget: g.narrativeRole === 'threat' || g.narrativeRole === 'victim',
      },
    }));
  }

  // -------------------------------------------------------------------------
  // Step 2: Item-Auswahl-Loop mit sofortiger Verteilung
  // -------------------------------------------------------------------------
  const loadedPool = loadPool(aggregatedPool);

  let iterations = 0;
  const MAX_ITERATIONS = 100;

  while (iterations++ < MAX_ITERATIONS && remainingBudget > 0 && loadedPool.length > 0) {
    // Gesamt-Tragkapazität aller Carriers (mit aktuellen Multiplikatoren)
    const totalCapacity = creaturePools.reduce((sum, cp) => sum + cp.currentCapacity, 0);

    // Nächstes Item auswählen
    const selection = selectNextItem(loadedPool, remainingBudget, totalCapacity);
    if (!selection) break;

    const { item, quantity } = selection;

    // Item verteilen (wie bisherige distributeItems-Logik, aber single item)
    const targetCreature = selectTargetCreature(item, quantity, creaturePools);

    if (targetCreature) {
      // Item zuweisen
      assignItemToCreature(groups, targetCreature.creatureIndex, item.id, quantity);

      // Budget tracken
      targetCreature.receivedValue += item.value * quantity;

      // carryCapacityMultiplier anwenden
      if (item.carryCapacityMultiplier && item.carryCapacityMultiplier > 1) {
        const oldCapacity = targetCreature.currentCapacity;
        targetCreature.currentCapacity *= item.carryCapacityMultiplier;
        debug('Multiplier applied:', item.id, 'on creature', targetCreature.creatureIndex,
          '- capacity:', oldCapacity.toFixed(0), '→', targetCreature.currentCapacity.toFixed(0));
      }
    }

    // Budget aktualisieren
    remainingBudget -= item.value * quantity;

    debug('Loop iteration:', item.id, '×', quantity, '- remaining budget:', remainingBudget.toFixed(0));
  }

  const totalValue = (partyBudget + independentBudget) - remainingBudget;
  debug('Loop complete:', iterations - 1, 'iterations, total value:', totalValue.toFixed(0));

  // -------------------------------------------------------------------------
  // Gruppen zusammenbauen mit partyObtainableValue
  // -------------------------------------------------------------------------
  const result: GroupWithLoot[] = [];

  for (const group of groups) {
    const countsTowardsBudget =
      group.narrativeRole === 'threat' || group.narrativeRole === 'victim';

    // Alle Items der Gruppe sammeln
    const groupItems: { id: string; quantity: number }[] = [];
    let groupValue = 0;
    let partyObtainableValue = 0;

    for (const creature of group.creatures) {
      if (creature.loot) {
        for (const lootEntry of creature.loot) {
          const item = vault.getEntity<{ value: number }>('item', lootEntry.id);
          const itemValue = (item?.value ?? 1) * lootEntry.quantity;
          groupValue += itemValue;

          // Zu Gruppen-Items hinzufügen (aggregiert)
          const existing = groupItems.find(i => i.id === lootEntry.id);
          if (existing) {
            existing.quantity += lootEntry.quantity;
          } else {
            groupItems.push({ id: lootEntry.id, quantity: lootEntry.quantity });
          }
        }
      }
    }

    // partyObtainableValue basierend auf NarrativeRole
    switch (group.narrativeRole) {
      case 'threat':
        partyObtainableValue = groupValue; // 100%
        break;
      case 'victim': {
        // Reward-Anteil berechnen (gleiche Ratio wie bei Budget)
        const groupCreaturePools = creaturePools.filter(cp => cp.narrativeRole === 'victim');
        if (groupCreaturePools.length > 0) {
          const totalBudgetForRole = groupCreaturePools.reduce((sum, cp) => sum + cp.budget, 0);
          const totalContribution = groupCreaturePools.reduce((sum, cp) => sum + cp.partyContribution, 0);
          const ratio = totalBudgetForRole > 0 ? totalContribution / totalBudgetForRole : 0;
          partyObtainableValue = groupValue * ratio;
        }
        break;
      }
      case 'ally':
      case 'neutral':
      default:
        partyObtainableValue = 0;
        break;
    }

    result.push({
      ...group,
      loot: {
        items: groupItems,
        totalValue: groupValue,
        partyObtainableValue,
        countsTowardsBudget,
      },
    });
  }

  debug('Final result:', result.length, 'groups');
  return result;
}