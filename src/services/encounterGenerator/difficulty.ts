// Ziel: Difficulty-Berechnung via PMF-basierter Combat-Simulation
// Siehe: docs/services/encounter/difficulty.md
//
// Pipeline-Übersicht:
// - rollTargetDifficulty(): Würfelt Ziel-Difficulty aus Terrain-ThreatLevel
// - simulatePMF(): PMF-basierte Combat-Simulation
//   - initialiseCombat() → State aufbauen
//   - while(!isCombatOver): getCurrentCombatant → selectNextAction → executeAction
//   - calculatePartyWinProbability() → Outcome-Analyse
// - classifySimulationDifficulty(): Klassifiziert Win%/TPK → DifficultyLabel
//
// Nutzt: combatTracking/ (State + Turn Management), combatantAI/ (Decisions)

// ============================================================================
// TODO
// ============================================================================
//
// [TODO]: Implementiere calculateCombatProbability()
// - Spec: difficulty.md#5.3
// - Disposition-basierte Kampfwahrscheinlichkeit
// - Nutzt group.disposition aus groupActivity.ts
//
// [TODO]: Condition-Tracking in Simulation (Layer 1-2)
// - Spec: difficulty.md#5.1.b
// - resolveCondition() implementieren
// - conditionProbability in Damage-Cascade einbauen
//
// [TODO]: Healing/Control Actions simulieren
// - Spec: difficulty.md#5.1.b
// - resolveHealing() implementieren
// - intent !== 'damage' Branch ausfüllen (simulateRound)
//
// [TODO]: Resource Budget Integration
// - Spec: difficulty.md#5.1.c
// - calculateResourceBudget() Ergebnis in Action-Selection nutzen
// - PC Spell Slots = totalSlots × resourceBudget

import type { EncounterGroup } from '@/types/encounterTypes';
import type { ThreatLevel, CreatureDefinition } from '@/types/entities';
import type { DifficultyLabel } from '@/constants';
import { DIFFICULTY_LABELS } from '@/constants';
import {
  randomNormal,
  getExpectedValue
} from '@/utils';
import { countCreaturesInGroups } from './encounterHelpers';
import { vault } from '@/infrastructure/vault/vaultInstance';
import {
  getHP,
  getDeathProbability,
  getGroupId,
  initialiseCombat,
  executeAction,
  getCurrentCombatant,
  isCombatOver,
  type PartyInput,
} from '@/services/combatTracking';
import {
  type CombatState,
  type CombatStateWithLayers,
  type CombatantWithLayers,
} from '@/types/combat';
import { DEFAULT_ENCOUNTER_DISTANCE_FEET } from '@/services/gridSpace';
import {
  isAllied,
  isHostile,
  getDefaultSelector,
  type ActionSelector,
} from '@/services/combatantAI';

// ============================================================================
// TYPES
// ============================================================================

/**
 * SelectorMap für per-Alliance Selektor-Zuweisung.
 * Keys: 'party' (Party + Verbündete) oder 'enemies' (feindliche Gruppen)
 */
export type SelectorMap = {
  party?: ActionSelector;
  enemies?: ActionSelector;
};

/**
 * Selektor-Input: Einzelner Selektor ODER per-Alliance Map.
 */
export type SelectorInput = ActionSelector | SelectorMap;

/**
 * Prüft ob ein SelectorInput ein einzelner Selektor ist.
 */
function isSingleSelector(input: SelectorInput): input is ActionSelector {
  return 'selectNextAction' in input;
}

/**
 * Wählt den richtigen Selektor für einen Combatant basierend auf Alliance.
 */
function getSelectorForCombatant(
  combatant: CombatantWithLayers,
  state: CombatStateWithLayers,
  selectors?: SelectorInput
): ActionSelector {
  if (!selectors) return getDefaultSelector();

  // Einzelner Selektor für alle
  if (isSingleSelector(selectors)) {
    return selectors;
  }

  // Map: Lookup nach Alliance
  const groupId = getGroupId(combatant);
  const isPartyAlly = isAllied('party', groupId, state.alliances);
  const key = isPartyAlly ? 'party' : 'enemies';
  return selectors[key] ?? getDefaultSelector();
}

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * D&D 5e XP Thresholds pro Party-Level.
 * Siehe: docs/services/encounter/difficulty.md#xp-rewards
 */
const XP_THRESHOLDS: Record<number, { easy: number; medium: number; hard: number; deadly: number }> = {
  1:  { easy: 25,   medium: 50,    hard: 75,    deadly: 100   },
  2:  { easy: 50,   medium: 100,   hard: 150,   deadly: 200   },
  3:  { easy: 75,   medium: 150,   hard: 225,   deadly: 400   },
  4:  { easy: 125,  medium: 250,   hard: 375,   deadly: 500   },
  5:  { easy: 250,  medium: 500,   hard: 750,   deadly: 1100  },
  6:  { easy: 300,  medium: 600,   hard: 900,   deadly: 1400  },
  7:  { easy: 350,  medium: 750,   hard: 1100,  deadly: 1700  },
  8:  { easy: 450,  medium: 900,   hard: 1400,  deadly: 2100  },
  9:  { easy: 550,  medium: 1100,  hard: 1600,  deadly: 2400  },
  10: { easy: 600,  medium: 1200,  hard: 1900,  deadly: 2800  },
  11: { easy: 800,  medium: 1600,  hard: 2400,  deadly: 3600  },
  12: { easy: 1000, medium: 2000,  hard: 3000,  deadly: 4500  },
  13: { easy: 1100, medium: 2200,  hard: 3400,  deadly: 5100  },
  14: { easy: 1250, medium: 2500,  hard: 3800,  deadly: 5700  },
  15: { easy: 1400, medium: 2800,  hard: 4300,  deadly: 6400  },
  16: { easy: 1600, medium: 3200,  hard: 4800,  deadly: 7200  },
  17: { easy: 2000, medium: 3900,  hard: 5900,  deadly: 8800  },
  18: { easy: 2100, medium: 4200,  hard: 6300,  deadly: 9500  },
  19: { easy: 2400, medium: 4900,  hard: 7300,  deadly: 10900 },
  20: { easy: 2800, medium: 5700,  hard: 8500,  deadly: 12700 },
};

/** CR zu XP Mapping (D&D 5e DMG). */
const CR_TO_XP: Record<number, number> = {
  0: 10,
  1: 200,
  2: 450,
  3: 700,
  4: 1100,
  5: 1800,
  6: 2300,
  7: 2900,
  8: 3900,
  9: 5000,
  10: 5900,
  11: 7200,
  12: 8400,
  13: 10000,
  14: 11500,
  15: 13000,
  16: 15000,
  17: 18000,
  18: 20000,
  19: 22000,
  20: 25000,
  21: 33000,
  22: 41000,
  23: 50000,
  24: 62000,
  25: 75000,
  26: 90000,
  27: 105000,
  28: 120000,
  29: 135000,
  30: 155000,
};

// ============================================================================
// TYPES
// ============================================================================

/** Simulations-Ergebnis für Difficulty-Klassifizierung. */
export interface SimulationResult {
  label: DifficultyLabel;
  winProbability: number;
  tpkRisk: number;
  rounds: number;
}

// ============================================================================
// MAIN FUNCTIONS
// ============================================================================

/** Würfelt eine Ziel-Difficulty basierend auf Terrain-ThreatLevel. */
export function rollTargetDifficulty(
  threatLevel: ThreatLevel
): DifficultyLabel {
  const avgThreat = (threatLevel.min + threatLevel.max) / 2;

  // Mappe avgThreat auf Difficulty-Index (0=trivial, 4=deadly)
  let baseIndex: number;
  if (avgThreat <= 1) {
    baseIndex = 0;
  } else if (avgThreat <= 3) {
    baseIndex = 1;
  } else if (avgThreat <= 6) {
    baseIndex = 2;
  } else if (avgThreat <= 10) {
    baseIndex = 3;
  } else {
    baseIndex = 4;
  }

  // Varianz: größerer ThreatLevel-Range = mehr Variabilität
  const range = threatLevel.max - threatLevel.min;
  const variance = Math.min(2, Math.floor(range / 3));

  const rolledIndex = randomNormal(
    Math.max(0, baseIndex - variance),
    baseIndex,
    Math.min(4, baseIndex + variance)
  );

  return DIFFICULTY_LABELS[rolledIndex];
}

/**
 * PMF-basierte Kampfsimulation.
 *
 * Einfacher Combat-Loop:
 * 1. initialiseCombat() - State + Grid + Combatants aufbauen
 * 2. while(!isCombatOver): getCurrentCombatant → selectNextAction → executeAction
 * 3. Ergebnis klassifizieren (Win%, TPK-Risk → DifficultyLabel)
 */
export function simulatePMF(
  encounter: { groups: EncounterGroup[]; alliances: Record<string, string[]> },
  party: PartyInput,
  encounterDistance: number = DEFAULT_ENCOUNTER_DISTANCE_FEET,
  selectors?: SelectorInput
): SimulationResult {
  // Resource Budget berechnen (Difficulty-Concern)
  const encounterXP = aggregateGroupXP(encounter.groups);
  const resourceBudget = calculateResourceBudget(encounterXP, party.level, party.size);

  // Initiative VOR Combatant-Erstellung berechnen
  const initiativeOrder = calculateInitiativeFromGroups(encounter.groups);

  // Combatants initialisieren (konsolidiert in combatTracking/initialiseCombat)
  const state = initialiseCombat({
    groups: encounter.groups,
    alliances: encounter.alliances,
    party,
    resourceBudget,
    encounterDistanceFeet: encounterDistance,
    initiativeOrder,
  });

  debug('simulatePMF: starting simulation', { initiativeOrder });

  // Combat Loop - extrem simpel
  while (!isCombatOver(state)) {
    const combatant = getCurrentCombatant(state) as CombatantWithLayers | undefined;
    if (!combatant) break;

    const selector = getSelectorForCombatant(combatant, state, selectors);
    const action = selector.selectNextAction(combatant, state, state.currentTurnBudget);
    executeAction(combatant, action, state);
  }

  debug('simulatePMF: simulation complete', { rounds: state.roundNumber });

  // Ergebnis berechnen
  const winProbability = calculatePartyWinProbability(state);
  const tpkRisk = calculateTPKRisk(state);

  return {
    label: classifySimulationDifficulty(winProbability, tpkRisk),
    winProbability,
    tpkRisk,
    rounds: state.roundNumber,
  };
}

/** Klassifiziert Difficulty basierend auf Simulation. */
export function classifySimulationDifficulty(winProbability: number, tpkRisk: number): DifficultyLabel {
  // TPK-Risk hat Vorrang
  if (tpkRisk > 0.30) return 'deadly';
  if (tpkRisk > 0.15) return 'hard';

  // Dann Win-Probability
  if (winProbability > 0.95) return 'trivial';
  if (winProbability > 0.85) return 'easy';
  if (winProbability > 0.70) return 'moderate';
  if (winProbability > 0.50) return 'hard';

  return 'deadly';
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/** Aggregiert XP aller Kreaturen in allen Gruppen via Vault-Lookup. */
function aggregateGroupXP(groups: EncounterGroup[]): number {
  let totalXP = 0;

  for (const group of groups) {
    for (const npcs of Object.values(group.slots)) {
      for (const npc of npcs) {
        const creature = vault.getEntity<CreatureDefinition>('creature', npc.creature.id);
        totalXP += crToXP(creature.cr);
      }
    }
  }

  const totalCount = countCreaturesInGroups(groups);
  const multiplier = getGroupMultiplier(totalCount);

  return Math.floor(totalXP * multiplier);
}

/** Konvertiert CR zu XP (mit linearer Interpolation für Bruch-CRs). */
function crToXP(cr: number): number {
  if (cr <= 0) return 10;

  const floorCR = Math.floor(cr);
  const ceilCR = Math.ceil(cr);

  if (floorCR === ceilCR) {
    return CR_TO_XP[floorCR] ?? 10;
  }

  // Lineare Interpolation zwischen Floor und Ceil
  const floorXP = CR_TO_XP[floorCR] ?? 10;
  const ceilXP = CR_TO_XP[ceilCR] ?? CR_TO_XP[floorCR] ?? 10;
  const fraction = cr - floorCR;

  return Math.floor(floorXP + (ceilXP - floorXP) * fraction);
}

/**
 * Gruppen-Multiplikator basierend auf Gegner-Anzahl.
 * Siehe: docs/services/encounter/difficulty.md#gruppen-multiplikatoren
 */
function getGroupMultiplier(count: number): number {
  if (count <= 1) return 1.0;
  if (count === 2) return 1.5;
  if (count <= 6) return 2.0;
  if (count <= 10) return 2.5;
  if (count <= 14) return 3.0;
  return 4.0;
}

/** Berechnet Resource Budget (0-1) für Spell-Slot Skalierung. */
function calculateResourceBudget(encounterXP: number, partyLevel: number, partySize: number): number {
  const thresholds = XP_THRESHOLDS[Math.max(1, Math.min(20, partyLevel))];
  // Daily XP Budget = 6-8 medium encounters
  const dailyXPBudget = 6 * thresholds.medium * partySize;
  return Math.min(1.0, encounterXP / dailyXPBudget);
}

// ============================================================================
// INITIATIVE SYSTEM
// ============================================================================

/**
 * Berechnet den erwarteten Offset für den i-ten Wert bei n d20-Würfen.
 * Verwendet Order Statistics für deterministische Spread-Berechnung.
 *
 * Für n unabhängige d20-Würfe ist der Erwartungswert des k-ten höchsten:
 * E[X_(k)] ≈ 10.5 + 10.5 * (n + 1 - 2k) / (n + 1)
 *
 * @param index 0-basierter Index (0 = höchster erwartet)
 * @param count Anzahl gleicher Combatants
 * @returns Offset zum Base-Initiative-Wert
 */
function expectedInitiativeOffset(index: number, count: number): number {
  if (count <= 1) return 0;
  return ((count - 2 * index - 1) / (count + 1)) * 10.5;
}

/**
 * Berechnet deterministische Initiative-Reihenfolge aus Encounter-Gruppen.
 *
 * Liest DEX, CR, HP direkt aus Creature-Definitionen im Vault.
 * Ergebnis wird an initialiseCombat() übergeben.
 *
 * **Berechnung:** Initiative = 10 + DEX-Mod + statistischer Spread
 *
 * **Tiebreaker:** DEX → CR → HP → Name (alphabetisch)
 *
 * @param groups Encounter-Gruppen mit NPCs
 * @returns NPC-IDs sortiert nach Initiative (höchste zuerst)
 */
export function calculateInitiativeFromGroups(groups: EncounterGroup[]): string[] {
  const entries: { id: string; init: number; dex: number; cr: number; hp: number; name: string; type: string }[] = [];

  // NPCs aus Gruppen extrahieren
  for (const group of groups) {
    for (const npcs of Object.values(group.slots)) {
      for (const npc of npcs) {
        const creature = vault.getEntity<CreatureDefinition>('creature', npc.creature.id);
        entries.push({
          id: npc.id,
          init: 0,
          dex: creature.abilities.dex,
          cr: creature.cr,
          hp: creature.hp,
          name: npc.name,
          type: npc.creature.id,
        });
      }
    }
  }

  // Gruppiere nach Creature-Type für Spread-Berechnung
  const byType = new Map<string, typeof entries>();
  for (const e of entries) {
    if (!byType.has(e.type)) byType.set(e.type, []);
    byType.get(e.type)!.push(e);
  }

  // Berechne Initiative mit Spread
  for (const group of byType.values()) {
    group.sort((a, b) => b.dex - a.dex);
    for (let i = 0; i < group.length; i++) {
      const dexMod = Math.floor((group[i].dex - 10) / 2);
      group[i].init = Math.round(10 + dexMod + expectedInitiativeOffset(i, group.length));
    }
  }

  // Sortiere mit Tiebreakern
  entries.sort((a, b) =>
    b.init - a.init || b.dex - a.dex || b.cr - a.cr || b.hp - a.hp || a.name.localeCompare(b.name)
  );

  return entries.map(e => e.id);
}

// ============================================================================
// DEBUG HELPER
// ============================================================================

const debug = (...args: unknown[]) => {
  if (process.env.DEBUG_SERVICES === 'true') {
    console.log('[difficulty]', ...args);
  }
};

// ============================================================================
// OUTCOME ANALYSIS
// ============================================================================

/** Berechnet Todeswahrscheinlichkeit einer Allianz (Produkt). */
function calculateAllianceDeathProbability(
  state: CombatState,
  referenceGroupId: string
): number {
  const alliedCombatants = state.combatants.filter(c =>
    isAllied(referenceGroupId, getGroupId(c), state.alliances)
  );
  if (alliedCombatants.length === 0) return 1;

  // P(alle tot) = Produkt der individuellen Todeswahrscheinlichkeiten
  return alliedCombatants.reduce((prob, c) => prob * getDeathProbability(c), 1.0);
}

/** Berechnet Todeswahrscheinlichkeit aller Feinde der Party. */
function calculateEnemyDeathProbability(state: CombatState): number {
  const enemyCombatants = state.combatants.filter(c =>
    isHostile('party', getGroupId(c), state.alliances)
  );
  if (enemyCombatants.length === 0) return 1;

  return enemyCombatants.reduce((prob, c) => prob * getDeathProbability(c), 1.0);
}

/** Berechnet Party-Siegwahrscheinlichkeit. */
function calculatePartyWinProbability(state: CombatState): number {
  const partyAllianceDeathProb = calculateAllianceDeathProbability(state, 'party');
  const enemyDeathProb = calculateEnemyDeathProbability(state);

  // Win = Feinde tot UND Party-Allianz nicht tot
  return enemyDeathProb * (1 - partyAllianceDeathProb);
}

/** Berechnet TPK-Risiko (Tod der gesamten Party-Allianz). */
function calculateTPKRisk(state: CombatState): number {
  return calculateAllianceDeathProbability(state, 'party');
}
