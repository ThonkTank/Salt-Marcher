// Ziel: Loot fuer Encounter generieren und auf Kreaturen verteilen
// Siehe: docs/services/encounter/encounterLoot.md
//
// Pipeline (v6, 4 Steps):
// 1. calculateWealthDiscrepancy() - Diskrepanz zwischen possessions und totalBudget
// 2. fillOpenBudget() - Offenes Budget mit distributePoolItems() fuellen (nur value)
// 3. (In Step 2 integriert) - Items werden direkt NPCs zugewiesen
// 4. selectCarriedItems() - Was NPCs gerade dabei haben (ephemer, nur weight)
//
// Beide Funktionen nutzen distributePoolItems() aus lootGenerator.ts:
// - Jeder Container (NPC) hat seinen eigenen Pool
// - Budget-Fraktionen basierend auf log10(budget)²

import type { EncounterGroup } from '@/types/encounterTypes';
import type { CreatureDefinition, Faction, NPC } from '@/types/entities';
import type { WealthTag } from '@/constants/loot';
import type { CreatureSize } from '@/constants/creature';
import type { NarrativeRole } from '@/constants/encounter';
import { vault } from '@/infrastructure/vault/vaultInstance';
import { CR_TO_XP, CARRY_CAPACITY_BY_SIZE, CR_TO_LEVEL_MAP } from '@/constants';
import {
  getWealthMultiplier,
  resolveLootPool,
  xpToGold,
  distributePoolItems,
  type Item,
  type AllocationResult,
  type ContainerWithPool,
} from '../lootGenerator/lootGenerator';

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

// ============================================================================
// NEW: CR-BASIERTES WEALTH-SYSTEM MIT CARRIED/STORED SPLIT
// ============================================================================

/**
 * Berechnet totalWealth basierend auf CR (nicht partyLevel).
 * Dies ist der gesamte Reichtum eines NPCs.
 */
function calculateTotalWealth(cr: number, xp: number, wealthMultiplier: number): number {
  const crLevel = crToEquivalentLevel(cr);
  return xpToGold(xp, crLevel) * wealthMultiplier;
}

/**
 * Berechnet expectedCarry basierend auf partyLevel.
 * Dies ist was die Party von diesem XP-Wert erwartet.
 */
function calculateExpectedCarry(xp: number, partyLevel: number): number {
  return xpToGold(xp, partyLevel);
}

/**
 * Berechnet carriedBudget basierend auf Reputation.
 * - reputation ≤ 0: nur expectedCarry
 * - reputation > 0: expectedCarry + (difference × reputation/100)
 *
 * @param totalWealth - Gesamter Reichtum (CR-basiert)
 * @param expectedCarry - Erwarteter Loot (partyLevel-basiert)
 * @param npc - Der NPC mit Reputation
 * @returns Budget für getragenes Loot
 */
function calculateCarriedBudget(
  totalWealth: number,
  expectedCarry: number,
  npc: NPC
): number {
  const partyRep = npc.reputations?.find(r => r.entityType === 'party');
  const reputation = partyRep?.value ?? 0;

  // Wenn totalWealth kleiner als expectedCarry, nur totalWealth
  if (totalWealth <= expectedCarry) {
    return totalWealth;
  }

  // Reputation ≤ 0: nur expectedCarry
  if (reputation <= 0) {
    return expectedCarry;
  }

  // Reputation > 0: expectedCarry + anteiliger Bonus
  const difference = totalWealth - expectedCarry;
  const bonus = difference * (reputation / 100);
  return expectedCarry + bonus;
}

// ============================================================================
// TYPES - NEW PIPELINE (v6)
// ============================================================================

/** Diskrepanz zwischen possessions und totalBudget */
interface WealthDiscrepancy {
  npcId: string;
  npc: NPC;
  cr: number;
  size: CreatureSize;
  narrativeRole: NarrativeRole;
  factionId: string | null;
  totalBudget: number;        // CR-basierter Gesamtreichtum
  existingValue: number;      // Wert der bestehenden possessions
  openBudget: number;         // totalBudget - existingValue (was fehlt)
  pool: Array<{ item: string; randWeighting: number }>; // Culture-basierter Pool
}

// ============================================================================
// STEP 1: WEALTH DISCREPANCY CALCULATION (v6)
// ============================================================================

/**
 * Summiert den Wert aller Items in possessions.
 */
function sumPossessionsValue(possessions: Array<{ id: string; quantity: number }> | undefined): number {
  if (!possessions || possessions.length === 0) return 0;

  let total = 0;
  for (const entry of possessions) {
    const item = vault.getEntity<Item>('item', entry.id);
    if (item) {
      total += item.value * entry.quantity;
    }
  }
  return total;
}

/**
 * Step 1: Berechnet die Diskrepanz zwischen bestehenden possessions und totalBudget.
 *
 * Für jeden NPC:
 * - totalBudget = CR-basierter Gesamtreichtum
 * - existingValue = Summe der Werte in possessions
 * - openBudget = max(0, totalBudget - existingValue)
 *
 * NPCs mit openBudget > 0 brauchen neue Items.
 */
function calculateWealthDiscrepancy(
  groups: EncounterGroup[],
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _context: { partyLevel: number }
): WealthDiscrepancy[] {
  const results: WealthDiscrepancy[] = [];

  for (const group of groups) {
    const faction = group.factionId
      ? vault.getEntity<Faction>('faction', group.factionId)
      : null;

    for (const npc of Object.values(group.slots).flat()) {
      const def = vault.getEntity<CreatureDefinition>('creature', npc.creature.id);
      if (!def) continue;

      // Nur NPCs mit carriesLoot
      if (def.carriesLoot === false) continue;

      const xp = CR_TO_XP[def.cr] ?? 0;
      const wealthMultiplier = getWealthMultiplier(def);
      const totalBudget = calculateTotalWealth(def.cr, xp, wealthMultiplier);
      const existingValue = sumPossessionsValue(npc.possessions);
      const openBudget = Math.max(0, totalBudget - existingValue);

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

      results.push({
        npcId: npc.id,
        npc,
        cr: def.cr,
        size: (def.size as CreatureSize) ?? 'medium',
        narrativeRole: group.narrativeRole,
        factionId: group.factionId ?? null,
        totalBudget,
        existingValue,
        openBudget,
        pool,
      });

      debug('WealthDiscrepancy:', npc.id.slice(0, 8), {
        totalBudget: totalBudget.toFixed(0),
        existingValue: existingValue.toFixed(0),
        openBudget: openBudget.toFixed(0),
      });
    }
  }

  return results;
}

// ============================================================================
// STEP 2: FILL OPEN BUDGET (v6)
// ============================================================================

/**
 * Step 2: Füllt offenes Budget mit neuen Items.
 *
 * Verwendet distributePoolItems() mit NUR value-Dimension.
 * Jeder NPC hat seinen eigenen Pool (Culture-basiert).
 * Neue Items werden direkt zu npc.possessions hinzugefügt.
 *
 * @returns Die generierten Items (für spätere Persistierung nach Encounter-Ende)
 */
function fillOpenBudget(
  groups: EncounterGroup[],
  discrepancies: WealthDiscrepancy[]
): AllocationResult<Item>[] {
  // Nur NPCs mit openBudget > 0
  const npcsWithOpenBudget = discrepancies.filter(d => d.openBudget > 0);

  if (npcsWithOpenBudget.length === 0) {
    debug('fillOpenBudget: No NPCs with open budget');
    return [];
  }

  // Containers mit eigenen Pools bauen (neu: jeder NPC hat seinen eigenen Pool)
  const containers: ContainerWithPool<Item>[] = [];
  for (const d of npcsWithOpenBudget) {
    // Pool mit Dimensionen laden (nur value, kein weight für diesen Step)
    const pool: Array<{ item: Item; randWeighting: number; dimensions: Record<string, number> }> = [];
    for (const entry of d.pool) {
      const itemId = entry.item as string;
      const item = vault.getEntity<Item>('item', itemId);
      if (!item) continue;

      pool.push({
        item,
        randWeighting: entry.randWeighting,
        dimensions: {
          value: item.value,  // Per-unit value
        },
      });
    }

    if (pool.length > 0) {
      containers.push({
        id: d.npcId,
        pool,
        budgets: { value: d.openBudget },
      });
    }
  }

  if (containers.length === 0) {
    debug('fillOpenBudget: No containers with pools');
    return [];
  }

  // Generische Allokation über Container mit eigenen Pools
  const allocations = distributePoolItems(containers, {
    maxIterations: 100,
    getItemKey: (item) => item.id,
  });

  debug('fillOpenBudget:', allocations.length, 'items generated');

  // Items zu possessions hinzufügen (temporär, Persistierung nach Encounter-Ende)
  for (const allocation of allocations) {
    addToPossessions(groups, allocation.containerId, allocation.item.id, allocation.quantity);
  }

  return allocations;
}

/**
 * Fügt ein Item zu NPC.possessions hinzu.
 */
function addToPossessions(
  groups: EncounterGroup[],
  npcId: string,
  itemId: string,
  quantity: number
): void {
  for (const group of groups) {
    for (const npc of Object.values(group.slots).flat()) {
      if (npc.id === npcId) {
        npc.possessions = npc.possessions ?? [];
        const existing = npc.possessions.find(p => p.id === itemId);
        if (existing) {
          existing.quantity += quantity;
        } else {
          npc.possessions.push({ id: itemId, quantity });
        }
        debug('Added to possessions:', itemId, '×', quantity, '→ NPC', npcId.slice(0, 8));
        return;
      }
    }
  }
}

// ============================================================================
// STEP 4: SELECT CARRIED ITEMS (v6 - EPHEMERAL)
// ============================================================================

/**
 * Step 4: Bestimmt welche Items ein NPC gerade bei sich trägt.
 *
 * - Alle possessions als equal-weight Pool laden
 * - distributePoolItems() mit nur weight-Dimension (per-unit!)
 * - Ergebnis: npc.carriedPossessions = was NPC gerade dabei hat (ephemer, nicht persistiert)
 *
 * @param npc - Der NPC mit possessions
 * @param carryCapacity - Tragkapazität in lbs
 * @returns Array von Items die der NPC trägt
 */
function selectCarriedItems(
  npc: NPC,
  carryCapacity: number
): Array<{ id: string; quantity: number }> {
  if (!npc.possessions || npc.possessions.length === 0) {
    return [];
  }

  if (carryCapacity <= 0) {
    return [];
  }

  // Pool mit per-unit Dimensions (WICHTIG: nicht skaliert!)
  const pool: Array<{ item: Item; randWeighting: number; dimensions: Record<string, number> }> = [];
  for (const p of npc.possessions) {
    const item = vault.getEntity<Item>('item', p.id);
    if (!item) continue;

    pool.push({
      item,
      randWeighting: 1,  // Alle gleich wahrscheinlich
      dimensions: {
        weight: item.pounds ?? 0,  // PER-UNIT weight, nicht × quantity!
      },
    });
  }

  if (pool.length === 0) {
    return [];
  }

  // Ein Container: der NPC selbst mit seinem Pool
  const container: ContainerWithPool<Item> = {
    id: npc.id,
    pool,
    budgets: { weight: carryCapacity },
  };

  // Allokation über distributePoolItems (korrekte Budget-Fraktionierung)
  const carried = distributePoolItems([container], {
    maxIterations: pool.length,
    getItemKey: (item) => item.id,
  });

  // Ergebnis als loot-Format mit korrekten Mengen
  const result: Array<{ id: string; quantity: number }> = [];
  for (const allocation of carried) {
    // Die Quantity aus der Allokation entspricht der Menge die getragen werden kann
    // Aber wir sollten nicht mehr tragen als der NPC besitzt
    const original = npc.possessions.find(p => p.id === allocation.item.id);
    if (original) {
      const maxQuantity = original.quantity;
      const carriedQuantity = Math.min(allocation.quantity, maxQuantity);
      result.push({ id: allocation.item.id, quantity: carriedQuantity });
    }
  }

  debug('selectCarriedItems:', npc.id.slice(0, 8), '→', result.length, 'item types carried');
  return result;
}

// ============================================================================
// MAIN FUNCTION (v6 - NEW PIPELINE)
// ============================================================================

/**
 * Generiert Loot für alle Encounter-Gruppen.
 *
 * NEW v6 Pipeline:
 * 1. calculateWealthDiscrepancy() - Diskrepanz zwischen possessions und totalBudget
 * 2. fillOpenBudget() - Offenes Budget mit Items füllen (nur value-Dimension)
 * 3. selectCarriedItems() - Pro NPC bestimmen was sie gerade dabei haben (ephemer)
 *
 * Wichtige Änderungen:
 * - npc.possessions: Alle Besitztümer (persistiert nach Encounter-Ende)
 * - npc.carriedPossessions: Was NPC gerade dabei hat (ephemer, berechnet aus possessions + capacity)
 * - Neue Items werden erst nach Encounter-Ende persistiert (Party könnte sie looten)
 */
export function generateEncounterLoot(
  groups: EncounterGroup[],
  context: {
    terrain: { id: string };
    partyLevel: number;
  }
): EncounterGroup[] {
  // -------------------------------------------------------------------------
  // Step 1: Diskrepanz ermitteln
  // -------------------------------------------------------------------------
  const discrepancies = calculateWealthDiscrepancy(groups, context);

  if (discrepancies.length === 0) {
    debug('No NPCs with loot pools, returning empty loot');
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

  const totalOpenBudget = discrepancies.reduce((sum, d) => sum + d.openBudget, 0);
  debug('Step 1 - Discrepancies:', discrepancies.length, 'NPCs, total open budget:', totalOpenBudget.toFixed(0));

  // -------------------------------------------------------------------------
  // Step 2: Offenes Budget füllen (nur value-Dimension)
  // -------------------------------------------------------------------------
  const newAllocations = fillOpenBudget(groups, discrepancies);
  debug('Step 2 - New items generated:', newAllocations.length);

  // -------------------------------------------------------------------------
  // Step 4: Carry-Selection pro NPC (ephemer)
  // -------------------------------------------------------------------------
  for (const discrepancy of discrepancies) {
    const carryCapacity = CARRY_CAPACITY_BY_SIZE[discrepancy.size];
    const carriedItems = selectCarriedItems(discrepancy.npc, carryCapacity);

    // npc.carriedPossessions setzen (ephemer, nicht persistiert)
    discrepancy.npc.carriedPossessions = carriedItems;
  }

  debug('Step 4 - Carried items calculated for', discrepancies.length, 'NPCs');

  // -------------------------------------------------------------------------
  // Gruppen zusammenbauen mit partyObtainableValue
  // -------------------------------------------------------------------------
  const result: EncounterGroup[] = [];

  // Für Victim-Reward-Ratio: XP pro Role sammeln
  let threatXP = 0;
  let victimXP = 0;
  for (const d of discrepancies) {
    const xp = CR_TO_XP[d.cr] ?? 0;
    if (d.narrativeRole === 'threat') threatXP += xp;
    if (d.narrativeRole === 'victim') victimXP += xp;
  }
  const victimRewardRatio = calculateVictimRewardRatio(threatXP, victimXP);

  for (const group of groups) {
    const countsTowardsBudget =
      group.narrativeRole === 'threat' || group.narrativeRole === 'victim';

    // Alle Items der Gruppe sammeln (aus npc.carriedPossessions)
    const groupItems: { id: string; quantity: number }[] = [];
    let groupValue = 0;
    let partyObtainableValue = 0;

    for (const npc of Object.values(group.slots).flat()) {
      if (npc.carriedPossessions) {
        for (const lootEntry of npc.carriedPossessions) {
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
      case 'victim':
        partyObtainableValue = groupValue * victimRewardRatio; // 10-50%
        break;
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