/**
 * Encounter Utility Functions - Pure Utils for @core
 *
 * These are pure functions without side effects that can be used by all layers.
 * Feature-specific functions (createCreatureInstance, populateEncounter) remain
 * in src/features/encounter/encounter-utils.ts.
 *
 * @see docs/architecture/Core.md#entity-spezifische-utils
 * @see docs/features/Encounter-System.md
 */

import type {
  CreatureDefinition,
  EncounterType,
  WeatherState,
  TimeSegment,
  CreatureSlot,
  EncounterTriggers,
} from '@core/schemas';
import { VARIETY_REROLL_WINDOW } from '@core/schemas';
import { calculateXP, calculateEffectiveXP } from './creature-utils';

// ============================================================================
// Types
// ============================================================================

/**
 * CR comparison result - determines if combat is viable.
 * @see docs/features/Encounter-Balancing.md#cr-vergleich
 */
export type CRComparison = 'trivial' | 'manageable' | 'deadly' | 'impossible';

/**
 * Encounter difficulty levels for XP budget calculation.
 * @see docs/features/Encounter-Balancing.md#difficulty-bestimmung
 */
export type EncounterDifficulty = 'easy' | 'medium' | 'hard' | 'deadly';

/**
 * Type derivation probability matrix.
 * Maps disposition + CR comparison to encounter type probabilities.
 */
interface TypeProbabilities {
  combat: number;
  social: number;
  passing: number;
  trace: number;
}

/**
 * Result of creature selection.
 */
export interface CreatureSelectionResult {
  creature: CreatureDefinition;
  faction: { id: string };
  weight: number;
}

/**
 * Result of type derivation.
 */
export interface TypeDerivationResult {
  type: EncounterType;
  reason: string;
  crComparison: CRComparison;
}

/**
 * Result of variety validation.
 */
export interface VarietyValidationResult {
  valid: boolean;
  rerollReason?: string;
}

/**
 * Creature weight calculation result.
 */
export interface CreatureWeight {
  creature: CreatureDefinition;
  factionId: string;
  baseWeight: number;
  terrainModifier: number;
  weatherModifier: number;
  finalWeight: number;
}

/**
 * Faction weight for creature selection.
 */
export interface FactionWeight {
  factionId: string;
  weight: number;
}

/**
 * Result of companion selection for multi-creature encounters.
 */
export interface CompanionSelectionResult {
  /** All creatures including lead and companions */
  creatures: readonly CreatureDefinition[];

  /** Raw total XP (sum of individual creature XP) */
  totalXP: number;

  /** Effective XP including group multiplier */
  effectiveXP: number;
}

// ============================================================================
// Step 1: Tile-Eligibility
// ============================================================================

/**
 * Filter creatures by terrain affinity and active time.
 * Only creatures that match BOTH terrain AND time pass through.
 */
export function filterEligibleCreatures(
  creatures: readonly CreatureDefinition[],
  terrainId: string,
  timeSegment: TimeSegment
): CreatureDefinition[] {
  return creatures.filter((creature) => {
    // Must have matching terrain
    const terrainMatch = creature.terrainAffinities.some(
      (affinity) => affinity === terrainId
    );
    if (!terrainMatch) return false;

    // Must have matching time segment
    const timeMatch = creature.activeTime.includes(timeSegment);
    return timeMatch;
  });
}

// ============================================================================
// Step 2: Weighted Creature Selection
// ============================================================================

/**
 * Calculate base weight for a creature based on faction presence.
 * Creatures in dominant factions have higher weight.
 */
export function calculateCreatureWeight(
  creature: CreatureDefinition,
  factionWeights: readonly FactionWeight[],
  weather: WeatherState | null,
  terrainId: string
): CreatureWeight {
  // Base weight from faction presence
  const factionId = creature.defaultFactionId ?? 'base-beasts';
  const factionEntry = factionWeights.find((fw) => fw.factionId === factionId);
  const baseWeight = factionEntry?.weight ?? 1.0;

  // Terrain modifier from preferences (if available)
  let terrainModifier = 1.0;
  if (creature.preferences?.terrain) {
    terrainModifier = creature.preferences.terrain[terrainId] ?? 1.0;
  }

  // Weather modifier (future: based on precipitation/temperature)
  let weatherModifier = 1.0;
  if (weather && creature.preferences?.weather) {
    // Simple: reduce weight in bad weather for non-adapted creatures
    if (weather.params.precipitation > 50) {
      weatherModifier = creature.preferences.weather['rain'] ?? 0.8;
    }
  }

  const finalWeight = baseWeight * terrainModifier * weatherModifier;

  return {
    creature,
    factionId,
    baseWeight,
    terrainModifier,
    weatherModifier,
    finalWeight,
  };
}

/**
 * Select a creature using weighted random selection.
 * Returns null if no eligible creatures.
 */
export function selectWeightedCreature(
  eligible: readonly CreatureDefinition[],
  factionWeights: readonly FactionWeight[],
  weather: WeatherState | null,
  terrainId: string
): CreatureSelectionResult | null {
  if (eligible.length === 0) return null;

  // Calculate weights for all eligible creatures
  const weights = eligible.map((creature) =>
    calculateCreatureWeight(creature, factionWeights, weather, terrainId)
  );

  // Sum of all weights
  const totalWeight = weights.reduce((sum, w) => sum + w.finalWeight, 0);
  if (totalWeight <= 0) return null;

  // Weighted random selection
  let random = Math.random() * totalWeight;
  for (const w of weights) {
    random -= w.finalWeight;
    if (random <= 0) {
      return {
        creature: w.creature,
        faction: { id: w.factionId },
        weight: w.finalWeight,
      };
    }
  }

  // Fallback to last creature
  const last = weights[weights.length - 1];
  return {
    creature: last.creature,
    faction: { id: last.factionId },
    weight: last.finalWeight,
  };
}

// ============================================================================
// Step 3: Type Derivation
// ============================================================================

/**
 * Compare creature CR to party level.
 *
 * @param creatureCR - The creature's Challenge Rating
 * @param partyLevel - Average party level
 * @returns CRComparison result
 *
 * Thresholds:
 * - trivial: CR < 0.25 * partyLevel (no real threat)
 * - manageable: CR <= 1.5 * partyLevel (fair fight)
 * - deadly: CR <= 3.0 * partyLevel (very dangerous but possible)
 * - impossible: CR > 3.0 * partyLevel (party cannot win)
 */
export function compareCR(
  creatureCR: number,
  partyLevel: number
): CRComparison {
  const effectiveLevel = Math.max(partyLevel, 1);
  const ratio = creatureCR / effectiveLevel;

  if (ratio < 0.25) return 'trivial';
  if (ratio <= 1.5) return 'manageable';
  if (ratio <= 3.0) return 'deadly';
  return 'impossible';
}

/**
 * Roll encounter difficulty based on D&D 5e distribution.
 *
 * Distribution:
 * - Easy: 12.5%
 * - Medium: 50%
 * - Hard: 25%
 * - Deadly: 12.5%
 */
export function rollDifficulty(): EncounterDifficulty {
  const roll = Math.random();
  if (roll < 0.125) return 'easy';
  if (roll < 0.625) return 'medium'; // 0.125 + 0.5
  if (roll < 0.875) return 'hard'; // 0.625 + 0.25
  return 'deadly';
}

/**
 * Get encounter type probability matrix.
 * @see docs/features/Encounter-System.md#wahrscheinlichkeits-matrix
 */
function getTypeProbabilities(
  disposition: 'hostile' | 'neutral' | 'friendly',
  crComparison: CRComparison
): TypeProbabilities {
  // Hostile creatures
  if (disposition === 'hostile') {
    switch (crComparison) {
      case 'trivial':
        // Triviale Bedrohung → meist trace (verlassenes Lager)
        return { combat: 0.05, social: 0.05, passing: 0.2, trace: 0.7 };
      case 'manageable':
        // Fairer Kampf möglich
        return { combat: 0.7, social: 0.1, passing: 0.15, trace: 0.05 };
      case 'deadly':
        // Gefährlich aber möglich
        return { combat: 0.5, social: 0.05, passing: 0.35, trace: 0.1 };
      case 'impossible':
        // Übermächtig → passing (Drache am Horizont)
        return { combat: 0.05, social: 0.05, passing: 0.7, trace: 0.2 };
    }
  }

  // Neutral creatures
  if (disposition === 'neutral') {
    return { combat: 0.1, social: 0.5, passing: 0.25, trace: 0.15 };
  }

  // Friendly creatures
  return { combat: 0.0, social: 0.7, passing: 0.2, trace: 0.1 };
}

/**
 * Select encounter type based on probability matrix.
 */
function selectTypeFromProbabilities(probs: TypeProbabilities): EncounterType {
  const roll = Math.random();
  let cumulative = 0;

  cumulative += probs.combat;
  if (roll < cumulative) return 'combat';

  cumulative += probs.social;
  if (roll < cumulative) return 'social';

  cumulative += probs.passing;
  if (roll < cumulative) return 'passing';

  return 'trace';
}

/**
 * Derive encounter type from creature disposition and CR comparison.
 *
 * Uses probability matrix based on:
 * - Creature disposition (hostile/neutral/friendly)
 * - CR comparison result (trivial/manageable/deadly/impossible)
 *
 * @see docs/features/Encounter-System.md#typ-ableitung
 */
export function deriveEncounterType(
  creature: CreatureDefinition,
  partyLevel: number | undefined
): TypeDerivationResult {
  const { disposition, cr } = creature;
  const effectivePartyLevel = partyLevel ?? 1;

  // Calculate CR comparison
  const crComparison = compareCR(cr, effectivePartyLevel);

  // Get probability matrix and select type
  const probs = getTypeProbabilities(disposition, crComparison);
  const type = selectTypeFromProbabilities(probs);

  // Build reason string
  const reason = `${disposition}_${crComparison}`;

  return { type, reason, crComparison };
}

// ============================================================================
// Step 4: Variety Validation
// ============================================================================

/**
 * Validate that the selected creature isn't too repetitive.
 * Returns valid=false if the creature type appeared too recently.
 */
export function validateVariety(
  creature: CreatureDefinition,
  recentCreatureTypes: readonly string[]
): VarietyValidationResult {
  // Check recent history (within reroll window)
  const recentWindow = recentCreatureTypes.slice(0, VARIETY_REROLL_WINDOW);

  if (recentWindow.includes(creature.id)) {
    return {
      valid: false,
      rerollReason: `Creature type "${creature.name}" appeared in last ${VARIETY_REROLL_WINDOW} encounters`,
    };
  }

  return { valid: true };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generate a unique encounter ID.
 */
export function generateEncounterId(): string {
  return `enc-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Generate activity description based on creature and time.
 */
export function generateActivity(
  creature: CreatureDefinition,
  timeSegment: TimeSegment
): string {
  const activities: Record<string, string[]> = {
    dawn: ['waking up', 'starting to move', 'hunting', 'preparing'],
    morning: ['patrolling', 'hunting', 'foraging', 'traveling'],
    midday: ['resting', 'eating', 'guarding', 'watching'],
    afternoon: ['patrolling', 'hunting', 'traveling', 'searching'],
    dusk: ['returning', 'settling down', 'hunting', 'gathering'],
    night: ['sleeping', 'prowling', 'hunting', 'guarding'],
  };

  const options = activities[timeSegment] ?? ['moving about'];
  return options[Math.floor(Math.random() * options.length)];
}

/**
 * Generate goal description based on creature disposition.
 */
export function generateGoal(creature: CreatureDefinition): string {
  const goals: Record<string, string[]> = {
    hostile: ['attack intruders', 'defend territory', 'hunt prey', 'raid'],
    neutral: ['survive', 'find food', 'protect young', 'rest'],
    friendly: ['trade', 'seek help', 'share news', 'offer assistance'],
  };

  const options = goals[creature.disposition] ?? ['survive'];
  return options[Math.floor(Math.random() * options.length)];
}

/**
 * Default encounter description fallback.
 */
const DEFAULT_ENCOUNTER_DESCRIPTION =
  'You encounter something in your travels.';

/**
 * Generate encounter description based on type and creature.
 */
export function generateDescription(
  type: EncounterType,
  creature: CreatureDefinition,
  activity: string
): string {
  const templates: Record<EncounterType, string[]> = {
    combat: [
      `A ${creature.name} blocks your path, ready for battle.`,
      `You are ambushed by a ${creature.name}!`,
      `A hostile ${creature.name} emerges, ${activity}.`,
    ],
    social: [
      `You encounter a ${creature.name}, ${activity}.`,
      `A ${creature.name} approaches, ${activity}.`,
      `You come across a ${creature.name} who seems willing to talk.`,
    ],
    passing: [
      `In the distance, you spot a ${creature.name}, ${activity}.`,
      `A ${creature.name} passes nearby, ${activity}.`,
      `You notice a ${creature.name} in the area, but it doesn't notice you.`,
    ],
    trace: [
      `You find signs of a ${creature.name} - fresh tracks and markings.`,
      `Evidence of a ${creature.name} is scattered here - they were ${activity}.`,
      `The area shows signs of recent ${creature.name} activity.`,
    ],
  };

  const options = templates[type] ?? [DEFAULT_ENCOUNTER_DESCRIPTION];
  return options[Math.floor(Math.random() * options.length)];
}

// ============================================================================
// XP Budget Calculation
// ============================================================================

/**
 * XP multipliers per difficulty level (per party member per level).
 * @see docs/features/Encounter-Balancing.md#xp-budget-berechnung
 */
const XP_DIFFICULTY_MULTIPLIERS: Record<EncounterDifficulty, number> = {
  easy: 25,
  medium: 50,
  hard: 75,
  deadly: 100,
};

/**
 * Calculate XP budget for an encounter based on party composition and difficulty.
 *
 * Formula: Sum of (member level × difficulty multiplier) for all party members.
 *
 * @param partyMembers - Array of party members with their levels
 * @param difficulty - The encounter difficulty level
 * @returns Total XP budget for the encounter
 *
 * @example
 * // 4 level-5 characters, medium difficulty
 * calculateXPBudget([{level: 5}, {level: 5}, {level: 5}, {level: 5}], 'medium')
 * // Returns: 4 × 5 × 50 = 1000 XP
 */
export function calculateXPBudget(
  partyMembers: readonly { level: number }[],
  difficulty: EncounterDifficulty
): number {
  const multiplier = XP_DIFFICULTY_MULTIPLIERS[difficulty];
  return partyMembers.reduce(
    (sum, member) => sum + member.level * multiplier,
    0
  );
}

/**
 * Calculate total XP for an encounter.
 * Uses calculateXP from @core/utils for individual creature XP.
 */
export function calculateEncounterXP(
  creatures: readonly CreatureDefinition[]
): number {
  return creatures.reduce((sum, creature) => {
    return sum + calculateXP(creature.cr);
  }, 0);
}

// ============================================================================
// Companion Selection (Multi-Creature Encounters)
// ============================================================================

/**
 * Budget tolerance factor for companion selection.
 * Allows slight overshoot to avoid leaving too much budget unused.
 */
const BUDGET_TOLERANCE = 1.1; // 10% tolerance

/**
 * Maximum companions to add (to prevent huge groups).
 */
const MAX_COMPANIONS = 7;

/**
 * Select companion creatures to fill an XP budget.
 *
 * Uses a greedy algorithm:
 * 1. Start with lead creature
 * 2. Filter eligible companions (CR <= lead CR)
 * 3. Repeatedly select random companion until budget exhausted
 *
 * @param lead - The lead creature for this encounter
 * @param budget - Total XP budget to fill
 * @param eligibleCreatures - Creatures that can be selected as companions
 * @returns Selected creatures with XP totals
 *
 * @see docs/features/Encounter-Balancing.md#companion-selection
 */
export function selectCompanions(
  lead: CreatureDefinition,
  budget: number,
  eligibleCreatures: readonly CreatureDefinition[]
): CompanionSelectionResult {
  const leadXP = calculateXP(lead.cr);
  const creatures: CreatureDefinition[] = [lead];
  let totalXP = leadXP;

  // All eligible creatures can be companions - budget logic handles selection
  const potentialCompanions = [...eligibleCreatures];

  // If no companions available or budget already exceeded, return just lead
  if (potentialCompanions.length === 0) {
    return {
      creatures,
      totalXP,
      effectiveXP: calculateEffectiveXP([{ xp: leadXP }]),
    };
  }

  // Greedy selection: add companions while budget allows
  let attempts = 0;
  const maxAttempts = potentialCompanions.length * 2; // Prevent infinite loop

  while (creatures.length <= MAX_COMPANIONS && attempts < maxAttempts) {
    attempts++;

    // Select a random companion (weighted selection would be better, but simple random for MVP)
    const randomIndex = Math.floor(Math.random() * potentialCompanions.length);
    const candidate = potentialCompanions[randomIndex];
    const candidateXP = calculateXP(candidate.cr);

    // Calculate what effective XP would be with this companion
    const newCreatures = [...creatures, candidate];
    const newTotalXP = totalXP + candidateXP;
    const newEffectiveXP = calculateEffectiveXP(
      newCreatures.map((c) => ({ xp: calculateXP(c.cr) }))
    );

    // Check if adding this companion would exceed budget tolerance
    if (newEffectiveXP > budget * BUDGET_TOLERANCE) {
      // Try smaller creatures first before giving up
      const smallerCompanions = potentialCompanions.filter(
        (c) => calculateXP(c.cr) < candidateXP
      );

      if (smallerCompanions.length === 0) {
        // No smaller companions available, we're done
        break;
      }
      // Continue loop to try again (will pick random, might get smaller)
      continue;
    }

    // Add the companion
    creatures.push(candidate);
    totalXP = newTotalXP;

    // If we're at or over budget, stop
    if (newEffectiveXP >= budget * 0.9) {
      break;
    }
  }

  const effectiveXP = calculateEffectiveXP(
    creatures.map((c) => ({ xp: calculateXP(c.cr) }))
  );

  return {
    creatures,
    totalXP,
    effectiveXP,
  };
}

// ============================================================================
// NEW: Trigger Checking
// ============================================================================

/**
 * Check if encounter triggers are satisfied.
 *
 * Triggers define conditions under which an encounter can occur:
 * - terrain: Current terrain must be in the list
 * - timeOfDay: Current time segment must be in the list
 * - partyLevelRange: Party level must be within range
 *
 * @param triggers - The encounter trigger configuration (undefined = always valid)
 * @param context - Current game context
 * @returns true if all triggers are satisfied (or no triggers defined)
 */
export function checkTriggers(
  triggers: EncounterTriggers | undefined,
  context: { terrainId: string; timeSegment: TimeSegment; partyLevel?: number }
): boolean {
  // No triggers = always valid
  if (!triggers) return true;

  // Terrain check (cast to string for comparison since EntityId is branded string)
  if (triggers.terrain && triggers.terrain.length > 0) {
    const terrainStrings = triggers.terrain.map((t) => String(t));
    if (!terrainStrings.includes(context.terrainId)) return false;
  }

  // Time of day check
  if (triggers.timeOfDay && triggers.timeOfDay.length > 0) {
    if (!triggers.timeOfDay.includes(context.timeSegment)) return false;
  }

  // Party level range check
  if (triggers.partyLevelRange && context.partyLevel !== undefined) {
    const { min, max } = triggers.partyLevelRange;
    if (min !== undefined && context.partyLevel < min) return false;
    if (max !== undefined && context.partyLevel > max) return false;
  }

  return true;
}

// ============================================================================
// NEW: CreatureSlot Resolution
// ============================================================================

/**
 * Generate a random integer in range [min, max] (inclusive).
 */
function randomInRange(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Filter creatures by BudgetCreatureSlot constraints.
 */
function filterByConstraints(
  creatures: readonly CreatureDefinition[],
  constraints?: {
    factionId?: string;
    creatureTypes?: string[];
    crRange?: { min?: number; max?: number };
    tags?: string[];
  }
): CreatureDefinition[] {
  if (!constraints) return [...creatures];

  return creatures.filter((c) => {
    // Faction filter
    if (constraints.factionId && c.defaultFactionId !== constraints.factionId) {
      return false;
    }

    // Creature type filter (checks against creature tags)
    if (
      constraints.creatureTypes &&
      constraints.creatureTypes.length > 0
    ) {
      const creatureTags = c.tags ?? [];
      const hasMatchingType = constraints.creatureTypes.some((type) =>
        creatureTags.includes(type)
      );
      if (!hasMatchingType) {
        return false;
      }
    }

    // CR range filter
    if (constraints.crRange) {
      if (constraints.crRange.min !== undefined && c.cr < constraints.crRange.min) {
        return false;
      }
      if (constraints.crRange.max !== undefined && c.cr > constraints.crRange.max) {
        return false;
      }
    }

    // Tags filter (creature must have ALL specified tags)
    if (constraints.tags && constraints.tags.length > 0) {
      const creatureTags = c.tags ?? [];
      if (!constraints.tags.every((tag) => creatureTags.includes(tag))) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Resolve CreatureSlots to concrete CreatureDefinitions.
 *
 * Handles all three slot types:
 * - concrete: Finds specific creature by ID, repeats count times
 * - typed: Finds creature type, determines random count from range
 * - budget: Fills XP budget using selectCompanions algorithm
 *
 * @param slots - The creature slots to resolve
 * @param allCreatures - Available creatures to select from
 * @param _context - Optional context (partyLevel, xpBudget) - currently unused but reserved
 * @returns Array of resolved creature definitions
 */
export function resolveCreatureSlots(
  slots: readonly CreatureSlot[],
  allCreatures: readonly CreatureDefinition[],
  _context?: { partyLevel?: number; xpBudget?: number }
): CreatureDefinition[] {
  const result: CreatureDefinition[] = [];

  for (const slot of slots) {
    switch (slot.slotType) {
      case 'concrete': {
        // Find specific creature by ID
        const creature = allCreatures.find((c) => c.id === slot.creatureId);
        if (creature) {
          for (let i = 0; i < slot.count; i++) {
            result.push(creature);
          }
        }
        break;
      }
      case 'typed': {
        // Find creature type, determine count
        const creature = allCreatures.find((c) => c.id === slot.creatureId);
        if (creature) {
          const count =
            typeof slot.count === 'number'
              ? slot.count
              : randomInRange(slot.count.min, slot.count.max);
          for (let i = 0; i < count; i++) {
            result.push(creature);
          }
        }
        break;
      }
      case 'budget': {
        // Fill XP budget using selectCompanions algorithm
        const filtered = filterByConstraints(allCreatures, slot.constraints);
        if (filtered.length > 0) {
          // Pick a random lead creature
          const lead = filtered[Math.floor(Math.random() * filtered.length)];
          const companions = selectCompanions(lead, slot.xpBudget, filtered);
          result.push(...companions.creatures);
        }
        break;
      }
    }
  }

  return result;
}
