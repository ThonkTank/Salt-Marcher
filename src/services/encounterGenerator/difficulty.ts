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
// Nutzt: combatResolver.ts (State + Resolution), combatantAI.ts (Decisions)

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
  createPartyProfiles,
  createEnemyProfiles,
  createCombatState,
  resolveAttack,
  DEFAULT_ENCOUNTER_DISTANCE_FEET,
  type PartyInput,
  type SimulationState,
  type RoundResult,
  // Turn Budget System
  type TurnBudget,
  createTurnBudget,
  hasBudgetRemaining,
  consumeMovement,
  consumeAction,
  applyDash,
} from '@/services/combatSimulator/combatResolver';
import {
  isAllied,
  isHostile,
  // Turn Action System
  type TurnAction,
  type CombatProfile,
  generateActionCandidates,
  calculateTurnActionEV,
} from '@/services/combatSimulator/combatantAI';
import { calculateGroupRelations } from '@/services/encounterGenerator/groupActivity';

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
  groups: EncounterGroup[],
  party: PartyInput,
  encounterDistance: number = DEFAULT_ENCOUNTER_DISTANCE_FEET
): SimulationResult {
  // Profiles erstellen
  const partyProfiles = createPartyProfiles(party);
  const enemyProfiles = createEnemyProfiles(groups);

  // Allianzen berechnen
  const alliances = calculateGroupRelations(groups);

  // Resource Budget berechnen
  const encounterXP = aggregateGroupXP(groups);
  const resourceBudget = calculateResourceBudget(encounterXP, party.level, party.size);

  // Simulation State erstellen
  const initialState = createCombatState(
    partyProfiles,
    enemyProfiles,
    alliances,
    encounterDistance,
    resourceBudget
  );

  // Simulation durchführen
  const { state, rounds } = runSimulationLoop(initialState);

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
  profile: CombatProfile,
  state: SimulationState
): { damageDealt: number } {
  let damageDealt = 0;

  switch (turnAction.type) {
    case 'move':
      profile.position = turnAction.targetCell;
      break;

    case 'attack': {
      const resolution = resolveAttack(profile, turnAction.target, turnAction.action);
      if (resolution) {
        turnAction.target.hp = resolution.newTargetHP;
        turnAction.target.deathProbability = resolution.newDeathProbability;
        damageDealt = resolution.damageDealt;
      }
      break;
    }

    case 'dash':
      // Dash-Effekt wird in consumeBudget via applyDash behandelt
      break;

    case 'pass':
      // Nichts zu tun
      break;
  }

  return { damageDealt };
}

/**
 * Verbraucht Budget basierend auf ausgeführter Aktion.
 */
function consumeBudget(budget: TurnBudget, turnAction: TurnAction): void {
  switch (turnAction.type) {
    case 'move':
      consumeMovement(budget, 1);
      break;
    case 'attack':
      consumeAction(budget);
      break;
    case 'dash':
      applyDash(budget);  // Verdoppelt Movement und konsumiert Action
      break;
    case 'pass':
      // Pass beendet den Zug - leere das Budget
      budget.movementCells = 0;
      budget.hasAction = false;
      budget.hasBonusAction = false;
      break;
  }
}

/**
 * Simuliert einen vollständigen Zug eines Combatants.
 * Nutzt Turn-Budget-System für D&D 5e Aktionsökonomie.
 * Siehe: Plan cosmic-tinkering-unicorn.md#Step-5
 */
function simulateTurn(
  profile: CombatProfile,
  state: SimulationState
): { damageDealt: number } {
  const budget = createTurnBudget(profile);
  let totalDamageDealt = 0;

  debug('simulateTurn: starting', {
    participantId: profile.participantId,
    budget: { ...budget },
  });

  while (hasBudgetRemaining(budget)) {
    // 1. Alle möglichen Aktionen generieren
    const candidates = generateActionCandidates(profile, state, budget);

    // 2. EV für jede Aktion berechnen und scoren
    const scored = candidates.map(action => ({
      action,
      score: calculateTurnActionEV(action, profile, state),
    }));

    // 3. Beste Aktion auswählen
    const best = scored.reduce((a, b) => a.score > b.score ? a : b);

    // 4. Abbrechen wenn beste Aktion pass ist oder negativer Score
    if (best.action.type === 'pass' || best.score <= 0) {
      debug('simulateTurn: ending turn (pass or negative EV)', {
        participantId: profile.participantId,
        bestScore: best.score,
        bestType: best.action.type,
      });
      break;
    }

    // 5. Aktion ausführen
    const result = executeAction(best.action, profile, state);
    totalDamageDealt += result.damageDealt;

    // 6. Budget verbrauchen
    consumeBudget(budget, best.action);

    debug('simulateTurn: executed action', {
      participantId: profile.participantId,
      actionType: best.action.type,
      score: best.score,
      damageDealt: result.damageDealt,
      remainingBudget: { ...budget },
    });
  }

  debug('simulateTurn: completed', {
    participantId: profile.participantId,
    totalDamageDealt,
  });

  return { damageDealt: totalDamageDealt };
}

/** Führt vollständige Kampfsimulation durch. */
function runSimulationLoop(initialState: SimulationState): { state: SimulationState; rounds: number } {
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
function simulateRound(state: SimulationState, roundNumber: number): RoundResult {
  let partyDPR = 0;
  let enemyDPR = 0;

  debug('simulateRound: starting round', roundNumber);

  for (const profile of state.profiles) {
    // Skip wenn tot
    if (profile.deathProbability >= 0.95) continue;

    // Skip wenn surprised in Runde 1
    if (roundNumber === 1) {
      const isPartyAlly = isAllied('party', profile.groupId, state.alliances);
      if (
        (isPartyAlly && state.surprise.enemyHasSurprise) ||
        (!isPartyAlly && state.surprise.partyHasSurprise)
      ) {
        continue;
      }
    }

    // Simuliere den vollständigen Zug mit Turn-Budget-System
    const turnResult = simulateTurn(profile, state);

    // DPR tracken (Party-Allianz vs Feinde)
    if (isAllied('party', profile.groupId, state.alliances)) {
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
function calculateAllianceHP(state: SimulationState, referenceGroupId: string): number {
  return state.profiles
    .filter(p => isAllied(referenceGroupId, p.groupId, state.alliances))
    .reduce((sum, p) => sum + getExpectedValue(p.hp), 0);
}

/** Berechnet erwartete HP aller Feinde der Party. */
function calculateEnemyHP(state: SimulationState): number {
  return state.profiles
    .filter(p => isHostile('party', p.groupId, state.alliances))
    .reduce((sum, p) => sum + getExpectedValue(p.hp), 0);
}

/** Berechnet Todeswahrscheinlichkeit einer Allianz (Produkt). */
function calculateAllianceDeathProbability(
  state: SimulationState,
  referenceGroupId: string
): number {
  const alliedProfiles = state.profiles.filter(p =>
    isAllied(referenceGroupId, p.groupId, state.alliances)
  );
  if (alliedProfiles.length === 0) return 1;

  // P(alle tot) = Produkt der individuellen Todeswahrscheinlichkeiten
  return alliedProfiles.reduce((prob, p) => prob * p.deathProbability, 1.0);
}

/** Berechnet Todeswahrscheinlichkeit aller Feinde der Party. */
function calculateEnemyDeathProbability(state: SimulationState): number {
  const enemyProfiles = state.profiles.filter(p =>
    isHostile('party', p.groupId, state.alliances)
  );
  if (enemyProfiles.length === 0) return 1;

  return enemyProfiles.reduce((prob, p) => prob * p.deathProbability, 1.0);
}

/** Prüft ob Simulation beendet ist (Party-Allianz oder alle Feinde >95% tot). */
function isSimulationOver(state: SimulationState): boolean {
  const partyAllianceDeathProb = calculateAllianceDeathProbability(state, 'party');
  const enemyDeathProb = calculateEnemyDeathProbability(state);
  return partyAllianceDeathProb > 0.95 || enemyDeathProb > 0.95;
}

/** Berechnet Party-Siegwahrscheinlichkeit. */
function calculatePartyWinProbability(state: SimulationState): number {
  const partyAllianceDeathProb = calculateAllianceDeathProbability(state, 'party');
  const enemyDeathProb = calculateEnemyDeathProbability(state);

  // Win = Feinde tot UND Party-Allianz nicht tot
  return enemyDeathProb * (1 - partyAllianceDeathProb);
}

/** Berechnet TPK-Risiko (Tod der gesamten Party-Allianz). */
function calculateTPKRisk(state: SimulationState): number {
  return calculateAllianceDeathProbability(state, 'party');
}
