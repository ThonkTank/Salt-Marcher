/**
 * Encounter generation pipeline utilities.
 *
 * Implements the 5-step generation pipeline:
 * 1. Tile-Eligibility (terrain + time filter)
 * 2. Kreatur-Auswahl (weighted selection)
 * 3. Typ-Ableitung (disposition + faction + CR)
 * 4. Variety-Validation (monotony prevention)
 * 5. Encounter-Befüllung (instance creation)
 *
 * @see docs/features/Encounter-System.md
 */

import type {
  CreatureDefinition,
  EncounterType,
  EncounterInstance,
  WeatherState,
  TimeSegment,
  GameDateTime,
  CreatureInstance,
} from '@core/schemas';
import {
  VARIETY_REROLL_WINDOW,
  CR_COMBAT_THRESHOLD_FACTOR,
} from '@core/schemas';
import type {
  GenerationContext,
  CreatureSelectionResult,
  TypeDerivationResult,
  VarietyValidationResult,
  CreatureWeight,
  FactionWeight,
} from './types';
import { DEFAULT_ENCOUNTER_DESCRIPTION } from './types';

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
        faction: { id: w.factionId } as never, // Will be resolved by service
        weight: w.finalWeight,
      };
    }
  }

  // Fallback to last creature
  const last = weights[weights.length - 1];
  return {
    creature: last.creature,
    faction: { id: last.factionId } as never,
    weight: last.finalWeight,
  };
}

// ============================================================================
// Step 3: Type Derivation
// ============================================================================

/**
 * Derive encounter type from creature disposition and party level.
 *
 * Rules:
 * - hostile + CR <= party level * 2 → combat
 * - hostile + CR > party level * 2 → passing (not winnable)
 * - neutral → social (80%) or passing (20%)
 * - friendly → social
 */
export function deriveEncounterType(
  creature: CreatureDefinition,
  partyLevel: number | undefined
): TypeDerivationResult {
  const { disposition, cr } = creature;
  const effectivePartyLevel = partyLevel ?? 1;

  switch (disposition) {
    case 'hostile': {
      // Check if encounter is winnable
      const maxCombatCR = effectivePartyLevel * CR_COMBAT_THRESHOLD_FACTOR;
      if (cr <= maxCombatCR) {
        return { type: 'combat', reason: 'hostile_winnable' };
      } else {
        return { type: 'passing', reason: 'hostile_too_strong' };
      }
    }

    case 'neutral': {
      // 80% social, 20% passing
      if (Math.random() < 0.8) {
        return { type: 'social', reason: 'neutral_interaction' };
      } else {
        return { type: 'passing', reason: 'neutral_no_interaction' };
      }
    }

    case 'friendly':
      return { type: 'social', reason: 'friendly' };

    default:
      return { type: 'social', reason: 'unknown_disposition' };
  }
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
// Step 5: Encounter Population
// ============================================================================

/**
 * Generate a unique encounter ID.
 */
export function generateEncounterId(): string {
  return `enc-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Create a creature instance from a definition.
 */
export function createCreatureInstance(
  definition: CreatureDefinition,
  index: number
): CreatureInstance {
  return {
    instanceId: `${definition.id}-${index}-${Math.random().toString(36).substring(2, 7)}`,
    definitionId: definition.id,
    currentHp: definition.maxHp,
    tempHp: 0,
    conditions: [],
    hasActed: false,
  };
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

/**
 * Create a complete encounter instance.
 */
export function populateEncounter(
  creature: CreatureDefinition,
  type: EncounterType,
  context: GenerationContext,
  currentTime: GameDateTime
): EncounterInstance {
  const activity = generateActivity(creature, context.timeSegment);
  const goal = generateGoal(creature);
  const description = generateDescription(type, creature, activity);

  // Create creature instance(s)
  // For MVP: single creature per encounter
  const creatureInstance = createCreatureInstance(creature, 0);

  return {
    id: generateEncounterId(),
    type,
    state: 'pending',
    creatures: [creatureInstance],
    activity,
    goal,
    description,
    generatedAt: currentTime,
    mapId: undefined, // Will be set by service
    position: context.position,
    trigger: context.trigger,
  };
}

// ============================================================================
// XP Calculation
// ============================================================================

/**
 * CR to XP conversion table (D&D 5e).
 */
const CR_XP_TABLE: Record<number, number> = {
  0: 10,
  0.125: 25,
  0.25: 50,
  0.5: 100,
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
};

/**
 * Calculate XP reward for defeating a creature.
 */
export function calculateCreatureXP(cr: number): number {
  // Direct lookup
  if (cr in CR_XP_TABLE) {
    return CR_XP_TABLE[cr];
  }

  // Interpolate for higher CRs
  if (cr > 10) {
    return Math.floor(5900 + (cr - 10) * 1000);
  }

  // Fallback
  return 10;
}

/**
 * Calculate total XP for an encounter.
 */
export function calculateEncounterXP(
  creatures: readonly CreatureDefinition[]
): number {
  return creatures.reduce((sum, creature) => {
    return sum + calculateCreatureXP(creature.cr);
  }, 0);
}
