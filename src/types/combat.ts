// Ziel: Zentrale Combat-Types für Simulation und Tracking
// Siehe: docs/services/combatTracking.md
//
// Re-exportiert Grid-Types aus @/utils und definiert Combat-spezifische Types.
// Eliminiert Duplikation zwischen combatantAI.ts und combatTracking.ts.

import type { Action } from './entities/action';

// ============================================================================
// RE-EXPORTS aus @/utils (Single Source of Truth)
// ============================================================================

export type {
  ProbabilityDistribution,
} from '@/utils';

export type {
  GridPosition,
  GridConfig,
  SpeedBlock,
} from '@/utils';

// ============================================================================
// CONDITION STATE
// ============================================================================

/** Condition-State für Incapacitation-Layer. */
export interface ConditionState {
  name: string;
  probability: number;
  effect: 'incapacitated' | 'disadvantage' | 'other';
}

// ============================================================================
// COMBAT PROFILE
// ============================================================================

// Import type für Interface-Definitionen
import type { ProbabilityDistribution, GridPosition, SpeedBlock, GridConfig } from '@/utils';

/**
 * Combat Profile für einen Kampfteilnehmer.
 * Unified für Simulation (PMF-basiert) und Tracking.
 *
 * HP ist immer PMF - deterministische Werte als Single-Value-PMF.
 */
export interface CombatProfile {
  participantId: string;
  groupId: string;  // 'party' für PCs, UUID für Encounter-Gruppen
  hp: ProbabilityDistribution;
  deathProbability: number;
  ac: number;
  speed: SpeedBlock;
  actions: Action[];
  conditions?: ConditionState[];
  position: GridPosition;  // Cell-Indizes, nicht Feet
  environmentBonus?: number;
}

// ============================================================================
// RANGE CACHE
// ============================================================================

/**
 * Cache für optimale Reichweiten pro Matchup.
 * Vermeidet redundante Berechnungen bei gleichen Combatant-Typen.
 * z.B. "goblin-fighter" → 5ft (Melee optimal gegen Fighter-AC).
 */
export interface RangeCache {
  get(attackerId: string, targetId: string): number | undefined;
  set(attackerId: string, targetId: string, range: number): void;
}

/** Einfache Map-basierte RangeCache-Implementierung. */
export function createRangeCache(): RangeCache {
  const cache = new Map<string, number>();
  return {
    get(attackerId: string, targetId: string): number | undefined {
      return cache.get(`${attackerId}-${targetId}`);
    },
    set(attackerId: string, targetId: string, range: number): void {
      cache.set(`${attackerId}-${targetId}`, range);
    },
  };
}

// ============================================================================
// SIMULATION STATE
// ============================================================================

/**
 * Simulation State für Combat-AI.
 * Minimaler State für Entscheidungslogik.
 */
export interface SimulationState {
  profiles: CombatProfile[];
  alliances: Record<string, string[]>;  // groupId → verbündete groupIds
  rangeCache?: RangeCache;
}

// ============================================================================
// COMBAT STATE (Extended)
// ============================================================================

/** Surprise-State für Runde 1. */
export interface SurpriseState {
  partyHasSurprise: boolean;
  enemyHasSurprise: boolean;
}

/**
 * Combat State für Tracking (extended SimulationState).
 * Enthält zusätzliche Felder für UI und Round-Tracking.
 */
export interface CombatState extends SimulationState {
  grid: GridConfig;
  roundNumber: number;
  surprise: SurpriseState;
  resourceBudget: number;
}

// ============================================================================
// TURN BUDGET
// ============================================================================

/**
 * Action-Budget pro Zug. D&D 5e Aktionsökonomie.
 */
export interface TurnBudget {
  movementCells: number;      // Verbleibende Movement-Cells
  baseMovementCells: number;  // Ursprüngliche Speed in Cells (für Dash)
  hasAction: boolean;         // 1 Action (kann Multi-Attack sein)
  hasDashed: boolean;         // Dash bereits verwendet in diesem Zug
  hasBonusAction: boolean;    // TODO: Stub, immer false
  hasReaction: boolean;       // TODO: Stub, für OA später
}

// ============================================================================
// ACTION TYPES
// ============================================================================

/** Intent einer Action: damage, healing, oder control. */
export type ActionIntent = 'damage' | 'healing' | 'control';

/** Combat-Präferenz für Positioning. */
export type CombatPreference = 'melee' | 'ranged' | 'hybrid';

/** Score-Ergebnis für eine (Action, Target)-Kombination. */
export interface ActionTargetScore {
  action: Action;
  target: CombatProfile;
  score: number;
  intent: ActionIntent;
}

// ============================================================================
// CELL EVALUATION
// ============================================================================

/** Score für einen Cell im Grid. */
export interface CellScore {
  position: GridPosition;
  attractionScore: number;  // Wie gut kann ich von hier angreifen?
  dangerScore: number;      // Wie gefährlich ist es hier?
  allyScore: number;        // Ally-Positioning Bonus
  combinedScore: number;    // attractionScore + allyScore - dangerScore × weight
}

/** Ergebnis der Zellbewertung. */
export interface CellEvaluation {
  cells: Map<string, CellScore>;  // positionToKey → CellScore
  bestCell: CellScore | null;
  bestAction: ActionTargetScore | null;
}

// ============================================================================
// TURN ACTIONS
// ============================================================================

/**
 * Vereinfachter TurnAction-Typ.
 * - move: Normale Bewegung ohne Action-Verbrauch
 * - action: Jede Action (Angriff, Dash, Dodge, etc.) - Effect-Felder bestimmen Verhalten
 * - pass: Zug beenden
 *
 * Das Combat-System prüft action.effects für spezifisches Verhalten:
 * - grantMovement: Dash-ähnliche Aktionen (extra Movement)
 * - movementBehavior: Disengage-ähnliche Aktionen
 * - incomingModifiers: Dodge-ähnliche Aktionen
 */
export type TurnAction =
  | { type: 'move'; targetCell: GridPosition }
  | { type: 'action'; action: Action; target?: CombatProfile; targetCell?: GridPosition }
  | { type: 'pass' };

// ============================================================================
// ATTACK RESOLUTION
// ============================================================================

/** Ergebnis einer Attack-Resolution. */
export interface AttackResolution {
  newTargetHP: ProbabilityDistribution;
  damageDealt: number;
  newDeathProbability: number;
}

/** Ergebnis einer einzelnen Runde. */
export interface RoundResult {
  round: number;
  partyDPR: number;
  enemyDPR: number;
  partyHPRemaining: number;
  enemyHPRemaining: number;
}
