// Ziel: Difficulty-Berechnung via PMF-basierter Combat-Simulation
// Siehe: docs/services/encounter/difficulty.md
//
// Pipeline-Übersicht:
// - rollTargetDifficulty(): Würfelt Ziel-Difficulty aus Terrain-ThreatLevel
// - simulatePMF(): PMF-basierte Combat-Simulation
//   - runSimulationLoop(): Autonomer Runden-Loop
//   - simulateRound(): Eine Runde simulieren
//   - calculatePartyWinProbability(): Outcome-Analyse
// - classifySimulationDifficulty(): Klassifiziert Win%/TPK → DifficultyLabel
//
// Nutzt: combatTracking/ (State + Resolution), combatantAI.ts (Decisions)

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
  resolveAttack,
  createTurnBudget,
  getHP,
  getDeathProbability,
  getGroupId,
  setPosition,
  getAbilities,
  getCR,
  getMaxHP,
  getCombatantType,
  isCharacter,
  type PartyInput,
  type CombatState,
  type RoundResult,
  type Combatant,
} from '@/services/combatTracking';
import type {
  CombatStateWithLayers,
  CombatantWithLayers,
} from '@/types/combat';
import { DEFAULT_ENCOUNTER_DISTANCE_FEET } from '@/services/gridSpace';
import { isAllied, isHostile } from '@/services/combatantAI/combatHelpers';
import {
  // Turn Action System
  type TurnAction,
  executeTurn,
} from '@/services/combatantAI/combatantAI';
import { initialiseCombat } from '@/services/combatTracking';

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

/** PMF-basierte Kampfsimulation. */
export function simulatePMF(
  encounter: { groups: EncounterGroup[]; alliances: Record<string, string[]> },
  party: PartyInput,
  encounterDistance: number = DEFAULT_ENCOUNTER_DISTANCE_FEET
): SimulationResult {
  // Resource Budget berechnen (Difficulty-Concern)
  const encounterXP = aggregateGroupXP(encounter.groups);
  const resourceBudget = calculateResourceBudget(encounterXP, party.level, party.size);

  // Combatants initialisieren (konsolidiert in combatTracking/initialiseCombat)
  const stateWithLayers = initialiseCombat({
    groups: encounter.groups,
    alliances: encounter.alliances,
    party,
    resourceBudget,
    encounterDistanceFeet: encounterDistance,
    initiativeOrder: [], // Wird separat via averageInitiative() gesetzt
  });

  // Simulation durchführen
  const { state, rounds } = runSimulationLoop(stateWithLayers);

  // Ergebnis berechnen
  const winProbability = calculatePartyWinProbability(state);
  const tpkRisk = calculateTPKRisk(state);
  const label = classifySimulationDifficulty(winProbability, tpkRisk);

  return {
    label,
    winProbability,
    tpkRisk,
    rounds,
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
  // k = index + 1 (1-basiert für Order Statistics)
  // Offset = (n + 1 - 2k) / (n + 1) * 10.5
  // Vereinfacht: (count - 2*index - 1) / (count + 1) * 10.5
  return ((count - 2 * index - 1) / (count + 1)) * 10.5;
}

/**
 * Berechnet deterministische Initiative-Reihenfolge für Combat.
 *
 * Basis: 10 + DEX-Modifier
 * Spread: Bei mehreren gleichen Creature-Types wird die erwartete Würfelverteilung
 *         deterministisch angewendet (höchster erwartet zuerst).
 *
 * Tiebreaker (bei gleicher Initiative):
 * 1. Höchster DEX-Score (nicht Modifier)
 * 2. Höchste CR
 * 3. Höchste HP
 * 4. Spieler vor Monstern
 * 5. Alphabetisch nach Name
 *
 * @param combatants Alle Combatants im Combat
 * @returns Geordnete Liste von Combatant-IDs (höchste Initiative zuerst)
 */
export function averageInitiative(combatants: Combatant[]): string[] {
  // Schritt 1: Gruppiere nach Creature-Type
  const byType = new Map<string, Combatant[]>();
  for (const c of combatants) {
    const type = getCombatantType(c);
    if (!byType.has(type)) {
      byType.set(type, []);
    }
    byType.get(type)!.push(c);
  }

  // Schritt 2: Berechne Initiative für jeden Combatant
  interface InitiativeEntry {
    id: string;
    initiative: number;
    dex: number;
    cr: number;
    hp: number;
    isPlayer: boolean;
    name: string;
  }

  const entries: InitiativeEntry[] = [];

  for (const [_type, group] of byType) {
    // Sortiere Gruppe nach DEX (für konsistente Spread-Zuweisung)
    const sorted = [...group].sort((a, b) => getAbilities(b).dex - getAbilities(a).dex);

    for (let i = 0; i < sorted.length; i++) {
      const c = sorted[i];
      const abilities = getAbilities(c);
      const dexMod = Math.floor((abilities.dex - 10) / 2);
      const baseInit = 10 + dexMod;
      const offset = expectedInitiativeOffset(i, sorted.length);
      const initiative = Math.round(baseInit + offset);

      entries.push({
        id: c.id,
        initiative,
        dex: abilities.dex,
        cr: getCR(c),
        hp: getMaxHP(c),
        isPlayer: isCharacter(c),
        name: c.name,
      });
    }
  }

  // Schritt 3: Sortiere mit Tiebreakern
  entries.sort((a, b) => {
    // Höchste Initiative zuerst
    if (a.initiative !== b.initiative) return b.initiative - a.initiative;
    // Tiebreaker 1: Höchster DEX-Score
    if (a.dex !== b.dex) return b.dex - a.dex;
    // Tiebreaker 2: Höchste CR
    if (a.cr !== b.cr) return b.cr - a.cr;
    // Tiebreaker 3: Höchste HP
    if (a.hp !== b.hp) return b.hp - a.hp;
    // Tiebreaker 4: Spieler vor Monstern
    if (a.isPlayer !== b.isPlayer) return a.isPlayer ? -1 : 1;
    // Tiebreaker 5: Alphabetisch
    return a.name.localeCompare(b.name);
  });

  return entries.map(e => e.id);
}

// ============================================================================
// SIMULATION LOOP (von combatResolver.ts hierher verschoben)
// ============================================================================

const MAX_ROUNDS = 10;

const debug = (...args: unknown[]) => {
  if (process.env.DEBUG_SERVICES === 'true') {
    console.log('[difficulty]', ...args);
  }
};

// ============================================================================
// TURN-BASED SIMULATION (neu: Turn Budget System)
// ============================================================================

/**
 * Führt eine Aktion aus und aktualisiert State.
 * Siehe: Plan cosmic-tinkering-unicorn.md#Step-5
 */
function executeAction(
  turnAction: TurnAction,
  combatant: Combatant,
  state: CombatState
): { damageDealt: number } {
  let damageDealt = 0;

  switch (turnAction.type) {
    case 'move':
      setPosition(combatant, turnAction.targetCell);
      break;

    case 'action': {
      // Prüfe ob die Action ein Angriff ist (hat Target und ist kein Dash)
      if (turnAction.target && turnAction.action.damage) {
        const resolution = resolveAttack(combatant, turnAction.target, turnAction.action);
        if (resolution) {
          // Resolution updates are applied to the target by resolveAttack
          damageDealt = resolution.damageDealt;
        }
      }
      // grantMovement Actions (Dash) werden von executeTurn via applyDash behandelt
      // targetCell Updates werden dort bereits gemacht
      if (turnAction.targetCell) {
        setPosition(combatant, turnAction.targetCell);
      }
      break;
    }

    case 'pass':
      // Nichts zu tun
      break;
  }

  return { damageDealt };
}

/**
 * Simuliert einen vollständigen Zug eines Combatants.
 * Delegiert an executeTurn() für Cell-basierte Entscheidungen.
 */
function simulateTurn(
  combatant: CombatantWithLayers,
  state: CombatStateWithLayers
): { damageDealt: number } {
  const budget = createTurnBudget(combatant);

  debug('simulateTurn: starting', {
    id: combatant.id,
    budget: { ...budget },
  });

  // executeTurn() entscheidet Movement + Actions via Cell-Evaluation
  const { actions } = executeTurn(combatant, state, budget);

  // Aktionen ausführen und Damage tracken
  let totalDamageDealt = 0;
  for (const action of actions) {
    const result = executeAction(action, combatant, state);
    totalDamageDealt += result.damageDealt;

    debug('simulateTurn: executed action', {
      id: combatant.id,
      actionType: action.type,
      damageDealt: result.damageDealt,
    });
  }

  debug('simulateTurn: completed', {
    id: combatant.id,
    totalDamageDealt,
    actionCount: actions.length,
  });

  return { damageDealt: totalDamageDealt };
}

/** Führt vollständige Kampfsimulation durch. */
function runSimulationLoop(initialState: CombatStateWithLayers): { state: CombatStateWithLayers; rounds: number } {
  const state = initialState;
  let rounds = 0;

  debug('runSimulationLoop: starting');

  for (let round = 1; round <= MAX_ROUNDS; round++) {
    if (isSimulationOver(state)) {
      debug('runSimulationLoop: simulation over at round', round);
      break;
    }

    simulateRound(state, round);
    rounds = round;
  }

  debug('runSimulationLoop: completed', { rounds });
  return { state, rounds };
}

/**
 * Simuliert eine Runde.
 * Nutzt Turn-Budget-System für jeden Combatant.
 * Siehe: Plan cosmic-tinkering-unicorn.md#Step-6
 */
function simulateRound(state: CombatStateWithLayers, roundNumber: number): RoundResult {
  let partyDPR = 0;
  let enemyDPR = 0;

  debug('simulateRound: starting round', roundNumber);

  for (const combatant of state.combatants) {
    // Skip wenn tot
    if (getDeathProbability(combatant) >= 0.95) continue;

    // Skip wenn surprised in Runde 1
    if (roundNumber === 1) {
      const combatantGroupId = getGroupId(combatant);
      const isPartyAlly = isAllied('party', combatantGroupId, state.alliances);
      if (
        (isPartyAlly && state.surprise.enemyHasSurprise) ||
        (!isPartyAlly && state.surprise.partyHasSurprise)
      ) {
        continue;
      }
    }

    // Simuliere den vollständigen Zug mit Turn-Budget-System
    const turnResult = simulateTurn(combatant, state);

    // DPR tracken (Party-Allianz vs Feinde)
    const combatantGroupId = getGroupId(combatant);
    if (isAllied('party', combatantGroupId, state.alliances)) {
      partyDPR += turnResult.damageDealt;
    } else {
      enemyDPR += turnResult.damageDealt;
    }
  }

  const result: RoundResult = {
    round: roundNumber,
    partyDPR,
    enemyDPR,
    partyHPRemaining: calculateAllianceHP(state, 'party'),
    enemyHPRemaining: calculateEnemyHP(state),
  };

  debug('simulateRound: completed', result);
  return result;
}

// ============================================================================
// OUTCOME ANALYSIS (von combatResolver.ts hierher verschoben)
// ============================================================================

/** Berechnet erwartete HP einer Allianz. */
function calculateAllianceHP(state: CombatState, referenceGroupId: string): number {
  return state.combatants
    .filter(c => isAllied(referenceGroupId, getGroupId(c), state.alliances))
    .reduce((sum, c) => sum + getExpectedValue(getHP(c)), 0);
}

/** Berechnet erwartete HP aller Feinde der Party. */
function calculateEnemyHP(state: CombatState): number {
  return state.combatants
    .filter(c => isHostile('party', getGroupId(c), state.alliances))
    .reduce((sum, c) => sum + getExpectedValue(getHP(c)), 0);
}

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

/** Prüft ob Simulation beendet ist (Party-Allianz oder alle Feinde >95% tot). */
function isSimulationOver(state: CombatState): boolean {
  const partyAllianceDeathProb = calculateAllianceDeathProbability(state, 'party');
  const enemyDeathProb = calculateEnemyDeathProbability(state);
  return partyAllianceDeathProb > 0.95 || enemyDeathProb > 0.95;
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
