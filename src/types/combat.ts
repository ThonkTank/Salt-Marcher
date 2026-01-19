// Ziel: Zentrale Combat-Types für Simulation und Tracking
// Siehe: docs/services/combatTracking.md
//
// Re-exportiert Grid-Types aus @/utils und definiert Combat-spezifische Types.
// Eliminiert Duplikation zwischen combatantAI.ts und combatTracking.ts.

import type {
  CombatEvent,
  Effect,
  LegacyEffect,
  Duration,
  SaveDC,
  SchemaModifier,
  ConditionLifecycle,
} from './entities/combatEvent';
import type { NPC } from './entities/npc';
import type { Character } from './entities/character';
import type { TriggerEvent, AbilityType } from '@/constants/action';
import type { CombatCellProperties } from './combatTerrain';

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
// CONDITION LIFECYCLE REGISTRY
// ============================================================================

/**
 * Registry mapping condition names to their lifecycle configurations.
 * Built from modifierPresets at combat initialization.
 * Used for linked conditions, death triggers, and position sync.
 */
export type LifecycleRegistry = Map<string, ConditionLifecycle>;

// ============================================================================
// ACTIVE MODIFIER SYSTEM (Unified Modifier Architecture)
// ============================================================================

/**
 * Source of an active modifier.
 * Tracks where the modifier came from for duration management and UI display.
 */
export interface ModifierSource {
  type: 'condition' | 'buff' | 'trait' | 'item' | 'spell' | 'aura';
  sourceId?: string;        // Combatant-ID des Verursachers
  concentrationOf?: string; // Combatant-ID wenn Concentration-abhängig
}

/**
 * Runtime wrapper for SchemaModifier in combat.
 * Combines the modifier definition with runtime metadata.
 *
 * Uses unified Duration schema from action.ts.
 */
export interface ActiveModifier {
  /** Referenz auf SchemaModifier Definition */
  modifier: SchemaModifier;

  /** Runtime-Metadaten: Woher kommt der Modifier? */
  source: ModifierSource;

  /** Optionale Duration (wenn nicht vorhanden: permanent) */
  duration?: Duration;

  /** Für probabilistische Modifier (z.B. 80% Chance dass Condition noch aktiv) */
  probability: number;
}

// ============================================================================
// AREA EFFECTS (Cover, Auras, Zones)
// ============================================================================

/** Area shape types for zone effects */
export type AreaType = 'sphere' | 'cylinder' | 'cone' | 'line' | 'cube';

/**
 * Definition of an area for zone effects.
 * Used by AreaEffect to define the shape and position.
 */
export interface AreaDefinition {
  type: AreaType;
  radius?: number;        // Sphere, Cylinder (in feet)
  length?: number;        // Cone, Line (in feet)
  width?: number;         // Line, Cube (in feet)
  origin: 'self' | 'point';  // Zentrum am Caster oder frei platziert
  position?: GridPosition;   // Nur wenn origin === 'point'
}

/**
 * Position-based effect in combat (Cover, Auras, Zones).
 * Replaces ActiveZone with unified modifier-based architecture.
 */
export interface AreaEffect {
  id: string;
  /** Combatant der den Effect kontrolliert ('terrain' für Cover-Hindernisse) */
  ownerId: string;
  /** Action die den Effect erstellt hat */
  sourceActionId: string;
  /** Geometrie des Effekts */
  area: AreaDefinition;
  /** Der Modifier der angewendet wird (verwendet SchemaModifier direkt) */
  modifier: SchemaModifier;
  /** Combatant-IDs die diesen Turn bereits getriggert wurden (1x pro Turn) */
  triggeredThisTurn: Set<string>;
}

// ============================================================================
// CONDITION STATE (Legacy - wird durch ActiveModifier ersetzt)
// ============================================================================

/**
 * Condition-State für Combat-Tracking.
 * Effect ist offen für beliebige Effect-Namen aus Actions.
 * Value für numerische Buffs (z.B. +2 für Magic Weapon).
 */
export interface ConditionState {
  name: string;
  probability: number;
  effect: string;  // 'incapacitated', 'disadvantage', 'attack-bonus', 'damage-bonus', etc.
  value?: number;  // Numerischer Wert für Buffs
  duration?: Duration;  // Wie lange hält die Condition? (rounds, until-save, until-escape)
  sourceId?: string;  // ID des Verursachers (für contested escape checks)
  endingSave?: { dc: number; ability: AbilityType };  // Save am Turn-Ende um Condition zu beenden
}

// ============================================================================
// COMBAT PROFILE
// ============================================================================

// Import type für Interface-Definitionen
import type { ProbabilityDistribution, GridPosition, SpeedBlock, GridConfig } from '@/utils';

/**
 * Runtime Resource-Tracking für Combat.
 * Spell Slots, Recharge-Timer, Per-Day Uses.
 */
export interface CombatResources {
  /** Spell Slots: Level (1-9) → verbleibende Slots */
  spellSlots?: Record<number, number>;
  /** Recharge-Timer: actionId → Runden bis verfügbar (0 = bereit) */
  rechargeTimers?: Record<string, number>;
  /** Per-Day/Per-Rest Uses: actionId → verbleibende Uses */
  perDayUses?: Record<string, number>;
}


// ============================================================================
// COMBATANT (ersetzt CombatProfile)
// ============================================================================

/**
 * Inventory-Item während Combat.
 * Kopiert aus NPC.possessions oder Character.inventory bei Combat-Start.
 * Wird bei Item-Consumption dekrementiert.
 */
export interface CombatInventoryItem {
  id: string;           // Item-ID (z.B. 'crossbow-bolt', 'healing-potion')
  quantity: number;     // Verbleibende Anzahl
  tags?: string[];      // Optional: Item-Tags für itemTag-basierte Kosten
}

/**
 * Transiente Combat-Daten für einen Combatant.
 * Wird an NPC/Character angehängt während Combat aktiv ist.
 * NICHT persistiert - wird nach Combat entfernt.
 */
export interface CombatantState {
  position: GridPosition;           // Cell-Indizes (5ft-Cells)
  conditions: ConditionState[];     // Legacy: Aktive Buffs/Debuffs
  modifiers: ActiveModifier[];      // NEU: Unified Modifier System (Conditions, Buffs, Traits)
  resources?: CombatResources;      // Spell Slots, Recharge Timer
  inventory: CombatInventoryItem[]; // Combat-Inventory (kopiert aus NPC.possessions/Character.inventory)
  concentratingOn?: string;         // Action-ID des aktiven Konzentrations-Spells
  groupId: string;                  // 'party' für PCs, UUID für Encounter-Gruppen
  isDead: boolean;                  // true wenn deathProb >= 0.95 (zentral via markDeadCombatants)
}

/**
 * NPC mit Combat-State (während Combat aktiv).
 * currentHp ist bereits ProbabilityDistribution im Base-Typ.
 */
export type NPCInCombat = NPC & { combatState: CombatantState };

/**
 * Character mit Combat-State (während Combat aktiv).
 * currentHp ist bereits ProbabilityDistribution im Base-Typ.
 */
export type CharacterInCombat = Character & { combatState: CombatantState };

/**
 * Unified Combatant-Typ für alle Kampfteilnehmer.
 * Ersetzt CombatProfile - verwendet Base-Typen + transiente CombatantState.
 */
export type Combatant = NPCInCombat | CharacterInCombat;

/**
 * Type Guard: Prüft ob Combatant ein NPC ist.
 * NPCs haben ein `creature`-Feld, Characters nicht.
 */
export function isNPC(c: Combatant): c is NPCInCombat {
  return 'creature' in c;
}

/**
 * Type Guard: Prüft ob Combatant ein Character ist.
 */
export function isCharacter(c: Combatant): c is CharacterInCombat {
  return !('creature' in c);
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
// ACTIVE ZONES (Spirit Guardians, etc.)
// ============================================================================

/**
 * Zone Effect - specialized effect type for active zones.
 * Contains the zone definition and optional trigger/damage/save properties.
 */
export interface ZoneEffect {
  type: 'create-zone';
  zone?: {
    id?: string;
    shape?: 'sphere' | 'cylinder' | 'cone' | 'cube' | 'line';
    origin?: 'self' | 'point' | 'target';
    radius?: number;
    speedModifier?: number;
    targetFilter?: 'all' | 'enemies' | 'allies';
    damage?: { dice: string; modifier?: number; type?: string };
    save?: { ability: AbilityType; dc: number; onSave?: 'none' | 'half' | 'special' };
    condition?: string;
  };
  trigger?: 'on-enter' | 'on-leave' | 'on-start-turn' | 'on-end-turn';
  // Legacy flat properties for backwards compatibility
  damage?: { dice: string; modifier?: number; type?: string };
  save?: { ability: AbilityType; dc: number; onSave?: 'none' | 'half' | 'special' };
  condition?: string;
}

/**
 * Runtime-Zustand einer aktiven Zone (z.B. Spirit Guardians).
 * Zones sind Action-Effects mit trigger-basierten Auslösern die bei
 * Movement (on-enter) oder Turn-Events (on-start-turn) evaluiert werden.
 */
export interface ActiveZone {
  /** Unique ID dieser Zone-Instance. */
  id: string;
  /** Die Action die diese Zone erstellt hat. */
  sourceActionId: string;
  /** Der Combatant der die Zone kontrolliert. */
  ownerId: string;
  /** Der Effect aus der Action-Definition (enthält zone, trigger, damage, etc.). */
  effect: ZoneEffect;
  /** Combatant-IDs die diesen Turn bereits von dieser Zone getriggert wurden (1x pro Turn). */
  triggeredThisTurn: Set<string>;
}

// ============================================================================
// SIMULATION STATE
// ============================================================================

/**
 * Simulation State für Combat-AI.
 * Enthält alle Combatants und deren Allianzen.
 */
export interface CombatantSimulationState {
  combatants: Combatant[];
  alliances: Record<string, string[]>;  // groupId → verbündete groupIds
  rangeCache?: RangeCache;
  /** Optionale Terrain-Map für Cover/LoS-Berechnung. */
  terrainMap?: Map<string, CombatCellProperties>;
  /** Optionale Map-Grenzen für Grid-Boundary-Enforcement. */
  mapBounds?: { minX: number; maxX: number; minY: number; maxY: number };
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
 * Combat State für Tracking und Simulation.
 * Enthält Grid, Round-Number, Surprise-Status, Initiative und Protocol.
 */
export interface CombatState extends CombatantSimulationState {
  grid: GridConfig;
  roundNumber: number;
  surprise: SurpriseState;
  resourceBudget: number;

  // Initiative & Turn Tracking
  turnOrder: string[];        // Combatant-IDs in Initiative-Reihenfolge
  currentTurnIndex: number;   // Index in turnOrder

  // Turn Budget des aktuellen Combatants
  currentTurnBudget: TurnBudget;

  // Reaction Budgets für alle Combatants (persistiert über Turns)
  // Reset bei Start des eigenen Turns
  reactionBudgets: Map<string, { hasReaction: boolean }>;

  // DPR-Tracking für Outcome-Analyse
  partyDPR: number;
  enemyDPR: number;

  // Hit/Miss-Tracking für Trefferquoten-Analyse
  partyHits: number;
  partyMisses: number;
  enemyHits: number;
  enemyMisses: number;

  // Kill-Tracking für Body Count
  partyKills: number;   // Party hat Enemy getötet
  enemyKills: number;   // Enemy hat Party getötet

  // HP-Tracking für Start/End Vergleich
  partyStartHP: number;
  enemyStartHP: number;

  // Combat Protocol
  protocol: CombatProtocolEntry[];

  // Terrain Map (Sparse: nur nicht-default Cells)
  terrainMap: Map<string, CombatCellProperties>;  // positionToKey → Properties

  // Map Bounds (optional, für Grid-Boundary-Enforcement)
  mapBounds?: { minX: number; maxX: number; minY: number; maxY: number };

  // === ACTIVE ZONES (Spirit Guardians, etc.) ===
  /** Legacy: Aktive Zonen (Auras, Spell-Effects) - werden bei Movement/Turn-Events evaluiert. */
  activeZones: ActiveZone[];

  /** NEU: Position-basierte Effekte (Cover, Auras, Zones) - Unified Modifier Architecture */
  areaEffects: AreaEffect[];

  // === SHARED RESOURCE POOLS (Divine Aid, etc.) ===
  /** Shared Resource Pools: combatantId → poolId → remaining uses. */
  resourcePools: Map<string, Map<string, number>>;

  // === CONDITION LIFECYCLE REGISTRY ===
  /**
   * Registry for condition lifecycle behaviors.
   * Built from modifierPresets at combat initialization.
   * Used for linked conditions, death triggers, and position sync.
   */
  lifecycleRegistry: LifecycleRegistry;
}

// ============================================================================
// PROTOCOL TYPES
// ============================================================================

/** HP-Änderung eines Combatants während einer Aktion. */
export interface HPChange {
  combatantId: string;
  combatantName: string;
  delta: number;  // negativ = Schaden, positiv = Heilung
  source: 'attack' | 'terrain' | 'reaction' | 'heal' | 'effect' | 'zone';
  sourceDetail?: string;  // z.B. "fire-damage", "zone:spirit-guardians"
}

/** Angewendeter Modifier während einer Aktion. */
export interface AppliedModifier {
  type: string;  // 'cover', 'advantage', 'pack-tactics', etc.
  value?: number;  // z.B. +2 für half-cover
}

/** Protokoll-Eintrag für eine einzelne Aktion im Combat. */
export interface CombatProtocolEntry {
  round: number;
  combatantId: string;
  combatantName: string;
  action: TurnAction;        // Einzelne Aktion (nicht Array)
  damageDealt: number;
  damageReceived: number;
  healingDone: number;
  positionBefore: GridPosition;
  positionAfter: GridPosition;
  notes: string[];           // "Critical hit", "Killed Goblin #2", etc.
  /** Reactions die während dieser Aktion auftraten */
  reactionEntries?: ReactionProtocolEntry[];

  // Strukturierte Effekt-Daten für Logging
  /** HP-Änderungen aller betroffenen Combatants */
  hpChanges: HPChange[];
  /** Angewendete Modifiers (Cover, Advantage, etc.) - nur wenn aktiv */
  modifiersApplied: AppliedModifier[];
  /** Todeswahrscheinlichkeit des Targets nach dem Angriff */
  targetDeathProbability?: number;
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
  hasBonusAction: boolean;    // Bonus Action verfügbar
  hasReaction: boolean;       // Reaction verfügbar (für OA, Shield, etc.)
}

// ============================================================================
// ACTION TYPES
// ============================================================================

/** Intent einer Action: damage, healing, control, buff, oder escape. */
export type ActionIntent = 'damage' | 'healing' | 'control' | 'buff' | 'escape';

/** Combat-Präferenz für Positioning. */
export type CombatPreference = 'melee' | 'ranged' | 'hybrid';

/** Score-Ergebnis für eine (Action, Target)-Kombination. */
export interface ActionTargetScore {
  action: CombatEvent;
  target: Combatant;
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
 * - action: Jede Action (Angriff, Dash, Dodge, etc.) mit Position
 * - pass: Zug beenden
 *
 * Movement ist implizit: fromPosition definiert von wo aus die Action ausgeführt wird.
 * Wenn fromPosition !== aktuelle Position, bewegt sich der Combatant zuerst dorthin.
 *
 * Das Combat-System prüft action.effects für spezifisches Verhalten:
 * - grantMovement: Dash-ähnliche Aktionen (extra Movement)
 * - movementBehavior: Disengage-ähnliche Aktionen
 * - incomingModifiers: Dodge-ähnliche Aktionen
 */
export type TurnAction =
  | { type: 'action'; action: CombatEvent; target?: Combatant; position: GridPosition }
  | { type: 'pass' };

/**
 * Interner Kandidat für Action-Auswahl.
 * Kombiniert Action, Target und Position in einem Tupel für einheitliches Scoring.
 */
export interface ActionCandidate {
  action: CombatEvent;
  target?: Combatant;
  targetCell?: GridPosition;  // für AoE-Zentrum
  position: GridPosition;     // Position von der aus die Action ausgeführt wird
  score: number;              // Bewertung dieser Kombination
}

/**
 * Ergebnis der Turn-Exploration mit optionalen Metriken.
 * Intern verwendet fuer Debugging und Performance-Analyse.
 */
export interface TurnExplorationResult {
  actions: TurnAction[];
  finalCell: GridPosition;
  totalValue: number;
  candidatesEvaluated?: number;  // Anzahl evaluierter Aktionskandidaten
  candidatesPruned?: number;     // Anzahl durch 50%-Threshold geprunter Kandidaten
}

/**
 * Kandidat im iterativen Pruning-Prozess.
 * Repräsentiert einen partiellen Turn-Pfad während der Exploration.
 */
export interface TurnCandidate {
  cell: GridPosition;              // Aktuelle Position
  budgetRemaining: TurnBudget;     // Verbleibendes Budget
  actions: TurnAction[];           // Bisherige Aktionen in diesem Pfad
  cumulativeValue: number;         // Summe aller bisherigen Action-Scores
  priorActions: CombatEvent[];          // Für Bonus-Action Requirements (z.B. TWF)
}

/**
 * Globale Best-Scores pro ActionSlot für Pruning-Schätzung.
 * Ermöglicht aggressive Elimination: maxGain = action + bonus + movement
 */
export interface GlobalBestByType {
  action: number;      // Bester Attack/Spell-Score global
  bonusAction: number; // Bester Bonus-Action-Score global
  movement: number;    // Beste Danger-Reduktion durch Movement
}

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

// ============================================================================
// ACTION BASE VALUES CACHE
// ============================================================================

/**
 * Gecachte Base-Values für Action-Target-Paarungen.
 * Ermöglicht Trennung von stabilen Werten (gecacht) und situativen Modifiern (per Position).
 *
 * Cache-Key Format: {casterBaseName}-{actionId}:{targetId}
 * z.B. "goblin-scimitar:fighter", "cleric-cure-wounds:wizard"
 */
export interface ActionBaseValues {
  // Damage Component (Attack Roll)
  baseDamageEV?: number;        // Expected Value des Damage (Würfel + Modifier)
  baseHitChance?: number;       // Hit-Chance gegen Standard-AC (ohne situative Modifiers)

  // Damage Component (Save-based, z.B. Fireball)
  baseSaveFailChance?: number;  // Save-Fail-Chance (1 - typischer Save-Bonus / DC)

  // Healing Component
  baseHealEV?: number;          // Expected Value des Heals (Würfel + Modifier)

  // Control Component
  baseControlDuration?: number; // Erwartete Condition-Duration (Runden)
  baseSuccessProb?: number;     // Wahrscheinlichkeit dass Condition angewendet wird

  // Buff Component
  baseOffensiveMultiplier?: number;  // z.B. 0.125 für Bless (+2.5 to-hit × 0.05)
  baseDefensiveMultiplier?: number;  // z.B. 0.10 für Shield of Faith (+2 AC × 0.05)
  baseExtraActions?: number;         // z.B. 1 für Haste
  baseDuration?: number;             // Erwartete Buff-Duration (Runden)
}

// ============================================================================
// THREAT MAP TYPES (für Position-Evaluation)
// ============================================================================

/**
 * Threat-Daten für eine Cell.
 * Kombiniert negative (Gegner-Schaden) und positive (Ally-Support) Faktoren.
 * Inkludiert Pfad-Kosten (OA-Risiko) von der aktuellen Position.
 */
export interface ThreatMapEntry {
  threat: number;      // Negativ: erwarteter Schaden von Gegnern + OA-Kosten
  support: number;     // Positiv: Heilung/Buff-Potential von Allies
  net: number;         // threat + support (Gesamtbewertung, negativ = schlecht)
}

// ============================================================================
// LAYER SYSTEM TYPES (für influenceMaps.ts)
// ============================================================================

/** Cell-spezifische Range-Daten (pre-computed) */
export interface CellRangeData {
  inRange: boolean;
  inNormalRange: boolean;         // false = Long Range Disadvantage
  distance: number;
}

/**
 * Base Resolution für Action gegen Target-Typ (persistiert im ActionLayer).
 * Enthält nur deterministische Werte - keine situativen Modifier.
 * Key: combatantType (z.B. "goblin")
 */
export interface BaseResolvedData {
  targetType: string;                       // combatantType des Ziels
  targetAC: number;                         // AC aus CreatureDefinition (konstant)
  baseHitChance: number;                    // d20-Mathe: attackBonus vs AC, ohne Advantage
  baseDamagePMF: ProbabilityDistribution;   // Damage-Würfel ohne Hit-Chance
  attackBonus: number;                      // Für spätere Modifier-Anwendung
}

/**
 * Finale Resolution mit situativen Modifiern (dynamisch berechnet, nie gecacht).
 * Kombiniert BaseResolvedData mit aktuellen Positions- und Condition-Daten.
 */
export interface FinalResolvedData {
  targetId: string;                         // participantId des konkreten Ziels
  base: BaseResolvedData;                   // Referenz auf gecachte Base-Daten
  // Dynamisch berechnet:
  finalHitChance: number;                   // Mit Advantage/Disadvantage
  effectiveDamagePMF: ProbabilityDistribution; // baseDamagePMF × finalHitChance
  netAdvantage: 'advantage' | 'disadvantage' | 'normal';
  activeEffects: string[];                  // ["pack-tactics", "long-range", "prone-target"]
}

/** Layer-Daten für eine Action (Runtime-Erweiterung) */
export interface ActionLayerData {
  sourceKey: string;                              // "participantId:actionId"
  rangeCells: number;                             // feetToCell(range.long ?? range.normal)
  normalRangeCells?: number;                      // feetToCell(range.normal) für Long Range
  sourcePosition: GridPosition;                   // Position des Angreifers
  grid: Map<string, CellRangeData>;               // Cell → Range-Info
  againstTarget: Map<string, BaseResolvedData>;   // Key: combatantType, lazy computed
}

/** CombatEvent mit Layer-Daten (zur Runtime) */
export type ActionWithLayer = CombatEvent & { _layer: ActionLayerData };

/** Type Guard für ActionWithLayer */
export function hasLayerData(action: CombatEvent): action is ActionWithLayer {
  return '_layer' in action;
}

/** Bedingung für Effect-Aktivierung */
export type EffectCondition =
  // Passive Effects (Always-On when condition met)
  | { type: 'ally-adjacent-to-target' }           // Pack Tactics
  | { type: 'ally-opposite-side' }                // Flanking
  | { type: 'obstacle-between' }                  // Cover
  | { type: 'target-has-condition'; condition: string }  // Prone, Restrained
  | { type: 'always' }                            // Unconditional
  // Reaction Triggers (Schema-driven via action.timing.triggerCondition)
  | { type: 'trigger'; event: TriggerEvent };     // 'leaves-reach', 'attacked', etc.

/**
 * Base state type that both legacy and new layer states satisfy.
 * Used by EffectLayerData.isActiveAt to accept both state types.
 */
export interface LayerStateBase {
  alliances: Record<string, string[]>;
}

/**
 * Kontext für Reaction-Evaluation.
 * Beschreibt das auslösende Event und alle relevanten Informationen.
 */
export interface ReactionContext {
  /** Das auslösende Event (attacked, damaged, spell-cast, leaves-reach, etc.) */
  event: TriggerEvent;
  /** Der Auslöser (Angreifer, Spell-Caster, sich bewegende Kreatur) */
  source: Combatant;
  /** Optional: Das Ziel des Triggers (bei attacked/damaged der Verteidiger) */
  target?: Combatant;
  /** Optional: Die auslösende Action */
  action?: CombatEvent;
  /** Optional: Bereits zugefügter Schaden (bei 'damaged' Event) */
  damage?: number;
  /** Optional: Spell-Level (bei 'spell-cast' Event für Counterspell) */
  spellLevel?: number;
  /** Optional: Bewegungs-Kontext für leaves-reach/enters-reach */
  movement?: { from: GridPosition; to: GridPosition };
}

/**
 * Effekte einer Reaction.
 * Ausgelagert für Wiederverwendung in ReactionResult und ReactionTurnResult.
 */
export interface ReactionEffect {
  /** Schaden der zugefügt wurde (OA, Hellish Rebuke) */
  damage?: number;
  /** AC-Bonus der gewährt wurde (Shield) */
  acBonus?: number;
  /** Ob ein Spell gecountert wurde (Counterspell) */
  spellCountered?: boolean;
  /** Ob Bewegung gestoppt wurde (Sentinel) */
  stopsMovement?: boolean;
}

export interface ReactionResult {
  /** Der Reactor (wer hat reagiert) */
  reactor: Combatant;
  /** Die verwendete Reaction */
  reaction?: CombatEvent;
  /** Ob die Reaction ausgeführt wurde */
  executed: boolean;
  /** Optionale Effekte der Reaction */
  effect?: ReactionEffect;
}

// ============================================================================
// REACTION TURN TYPES (Mini-Turn für Reaction-Entscheidung)
// ============================================================================

/**
 * Repräsentiert einen Mini-Turn für Reaction-Resolution.
 * Der Reactor kann seine Reaction ausführen oder passen.
 */
export interface ReactionTurn {
  /** Der Reactor der diesen Mini-Turn bekommt */
  reactor: Combatant;
  /** Verfügbare Reactions für diesen Trigger */
  availableReactions: CombatEvent[];
  /** Kontext des auslösenden Events */
  context: ReactionContext;
}

/**
 * Ergebnis eines Reaction Mini-Turns.
 */
export interface ReactionTurnResult {
  /** Ob eine Reaction ausgeführt wurde */
  executed: boolean;
  /** Die verwendete Reaction (falls ausgeführt) */
  reaction?: CombatEvent;
  /** Effekte der Reaction */
  effect?: ReactionEffect;
}

/**
 * Protocol-Eintrag für Reaction-Events.
 */
export interface ReactionProtocolEntry {
  type: 'reaction';
  round: number;
  reactorId: string;
  reactorName: string;
  reaction: CombatEvent;
  trigger: TriggerEvent;
  triggeredBy: string;
  damageDealt?: number;
  notes: string[];
}

/** Layer-Daten für einen Effect/Trait (Runtime-Erweiterung) */
export interface EffectLayerData {
  effectId: string;                               // "pack-tactics", "flanking", "reaction:opp-attack"
  effectType: 'advantage' | 'disadvantage' | 'ac-bonus' | 'attack-bonus' | 'reaction';
  effectValue?: number;                           // Für Bonuses: +2, +5
  range: number;                                  // Effekt-Range in Cells (für Reactions: Reach)
  condition: EffectCondition;
  isActiveAt: (                                   // Prüf-Funktion
    attackerPos: GridPosition,
    targetPos: GridPosition,
    state: LayerStateBase
  ) => boolean;
  // Reaction-spezifische Felder (nur wenn effectType === 'reaction')
  reactionAction?: CombatEvent;                   // Die zugehörige Reaction-Action
}

/** Filter für Layer-Abfragen */
export type LayerFilter = (action: ActionWithLayer) => boolean;

// ============================================================================
// COMBATANT LAYER TYPES
// ============================================================================

/**
 * Combatant mit Layer-Daten auf Actions.
 * Ermöglicht situative Modifier (Advantage/Disadvantage) basierend auf Position.
 */
export type CombatantWithLayers = (NPCInCombat | CharacterInCombat) & {
  combatState: CombatantState & {
    effectLayers: EffectLayerData[];
  };
  /** Actions mit Layer-Daten (überschreibt getActions). */
  _layeredActions: ActionWithLayer[];
  /** Alias for migration - same as _layeredActions. */
  _layeredCombatEvents?: ActionWithLayer[];
};

/** Type Guard für CombatantWithLayers */
export function combatantHasLayers(c: Combatant): c is CombatantWithLayers {
  return '_layeredActions' in c && Array.isArray(c._layeredActions);
}

/** SimulationState mit Layer-erweiterten Combatants */
export interface CombatantSimulationStateWithLayers extends Omit<CombatantSimulationState, 'combatants'> {
  combatants: CombatantWithLayers[];
}

/** CombatState mit Layer-erweiterten Combatants */
export interface CombatStateWithLayers extends Omit<CombatState, 'combatants'> {
  combatants: CombatantWithLayers[];
}

// ============================================================================
// RESOLUTION PIPELINE TYPES (findTargets → getModifiers → resolveEffects)
// ============================================================================

/**
 * Manual roll data from GM input.
 * When present, resolution uses deterministic values instead of probability.
 */
export interface ManualRollData {
  /** The natural d20 roll (1-20), not the total */
  attackRoll?: number;
  /** The damage dice result (before modifiers) */
  damageRoll?: number;
  /** Direct result selection (bypasses roll calculation) */
  resultOverride?: 'hit' | 'miss' | 'crit';
}

/**
 * Trigger type for resolution context.
 * Determines HOW the resolution was triggered, not WHAT happens.
 */
export type TriggerType =
  | 'active'                        // Player/AI chooses action
  | 'zone-enter'                    // Movement into zone
  | 'zone-leave'                    // Movement out of zone (incl. OA)
  | 'zone-start-turn'               // Turn start in zone
  | 'zone-end-turn'                 // Turn end in zone
  | 'reaction-attacked'             // Reaction: Shield
  | 'reaction-damaged'              // Reaction: Hellish Rebuke
  | 'reaction-spell-cast';          // Reaction: Counterspell

/**
 * Context for the entire resolution pipeline.
 * READ-ONLY input for findTargets → getModifiers → resolveEffects.
 */
export interface ResolutionContext {
  /** The combatant performing the action */
  actor: Combatant;
  /** The action being performed */
  action: CombatEvent;
  /** Combat state (READ-ONLY!) */
  state: Readonly<CombatState>;
  /** How this resolution was triggered */
  trigger: TriggerType;
  /** Pre-selected target (for single-target actions) */
  explicitTarget?: Combatant;
  /** Target position (for AoE actions) */
  position?: GridPosition;
  /** Manual roll data from GM (bypasses probabilistic calculation) */
  manualRolls?: ManualRollData;
}

/**
 * Result of success determination per target.
 * Internal type used between determineSuccess and resolveEffects.
 */
export interface SuccessResult {
  target: Combatant;
  /** Whether the attack hit or save failed */
  hit: boolean;
  /** Whether a critical hit was rolled (nat 20) */
  critical: boolean;
  /** Exact hit probability (for protocol) */
  hitProbability: number;
  /** Exact crit probability (for protocol) */
  critProbability: number;
  /** For save-based actions: whether the save succeeded */
  saveSucceeded?: boolean;
  /** For contested checks: whether the contest was won */
  contestWon?: boolean;
  /**
   * Whether the primary check succeeded.
   * Used by effect resolvers to determine if effects should be applied.
   * - Attack: checkSucceeded = hit
   * - Target-Save: checkSucceeded = !saveSucceeded (effect applies on failed save)
   * - Contested: checkSucceeded = contestWon
   * - Actor-Check (self-targeting save): checkSucceeded = check >= DC
   * - Auto-hit: checkSucceeded = true
   */
  checkSucceeded: boolean;
  /** Damage multiplier: 1.0 normal, 0.5 save-half, 2.0 crit dice. Used only for damage calculation. */
  damageMultiplier: number;
  /** True if this result came from manual GM input */
  isManual?: boolean;
  /** Actual attack roll total (when manual, for protocol display) */
  actualAttackRoll?: number;
}

/**
 * HP change entry in resolution result.
 * Different from existing HPChange - includes expected values and resolution metadata.
 */
export interface ResolutionHPChange {
  combatantId: string;
  combatantName: string;
  /** HP before this action (expected value) */
  previousHP: number;
  /** HP after this action (expected value) */
  newHP: number;
  /** Delta: negative = damage, positive = healing */
  change: number;
  /** Source description (action name, zone name, etc.) */
  source: string;
  /** Damage type for resistance/vulnerability display */
  damageType?: string;
}

/**
 * Condition to be applied to a target.
 * Includes probability after any saves.
 */
export interface ConditionApplication {
  targetId: string;
  targetName: string;
  /** Full condition state to apply */
  condition: ConditionState;
  /** Probability that condition is applied (0-1, after save) */
  probability: number;
}

/**
 * Condition to be removed from a target.
 */
export interface ConditionRemoval {
  targetId: string;
  conditionName: string;
}

/**
 * Forced movement entry in resolution result.
 */
export interface ForcedMovementEntry {
  targetId: string;
  type: 'push' | 'pull' | 'slide';
  /** Distance in feet */
  distance: number;
  /** Optional: direction vector (normalized) */
  direction?: GridPosition;
}

/**
 * Zone activation data for creating new zones.
 */
export interface ZoneActivation {
  actionId: string;
  ownerId: string;
  /** Radius in feet */
  radius: number;
  /** Filter for affected targets */
  targetFilter: string;
  /** Trigger type for zone */
  trigger: string;
  /** Effect definition from action (LegacyEffect for backwards compatibility) */
  effect: LegacyEffect;
}

/**
 * Protocol data for combat logging.
 * Structured data that can be formatted into CombatProtocolEntry.
 */
export interface ResolutionProtocolData {
  roundNumber: number;
  actorId: string;
  actorName: string;
  actionName: string;
  targetIds: string[];
  targetNames: string[];
  hit: boolean;
  critical: boolean;
  damageDealt: number;
  healingDone: number;
  damageType?: string;
  conditionsApplied: string[];
  trigger: TriggerType;
}

/**
 * Final resolution result - PURE DATA, NO STATE MUTATION.
 * Output of resolveEffects(), input for combatWorkflow.applyResult().
 */
export interface ResolutionResult {
  /** HP changes for all affected combatants */
  hpChanges: ResolutionHPChange[];
  /** Conditions to be applied (with probability) */
  conditionsToAdd: ConditionApplication[];
  /** Conditions to be removed */
  conditionsToRemove: ConditionRemoval[];
  /** Forced movement entries */
  forcedMovement: ForcedMovementEntry[];
  /** Zone to be activated (e.g., Spirit Guardians) */
  zoneActivation?: ZoneActivation;
  /** Combatant ID whose concentration should break */
  concentrationBreak?: string;
  /** Protocol data for logging */
  protocolData: ResolutionProtocolData;
}

/**
 * Budget costs for an action.
 * Extracted from action for application in workflow.
 */
export interface ActionBudgetCosts {
  movement: number;        // Movement cells consumed
  action: boolean;         // Consumes action
  bonusAction: boolean;    // Consumes bonus action
  reaction: boolean;       // Consumes reaction
}

/**
 * Result from resolveAction() in combatTracking (pure, no mutation).
 * Contains everything needed for combatWorkflow to apply the result.
 */
export interface ActionResult {
  /** Resolution result (HP changes, conditions, etc.) */
  resolution: ResolutionResult;
  /** Budget costs to apply */
  budgetCosts: ActionBudgetCosts;
  /** Success results per target (for advanced logging) */
  successResults: SuccessResult[];
}

// ============================================================================
// COMBAT EVENT ALIASES (Migration Support)
// ============================================================================

/** Alias for ActionBaseValues - used in CombatStateWithScoring cache */
export type CombatEventBaseValues = ActionBaseValues;

/** Alias for ActionIntent - used in action scoring */
export type CombatEventIntent = ActionIntent;

/** Alias for ActionTargetScore - used in action selection */
export type CombatEventTargetScore = ActionTargetScore;

/** Alias for TurnAction - used in action enumeration */
export type TurnCombatEvent = TurnAction;
