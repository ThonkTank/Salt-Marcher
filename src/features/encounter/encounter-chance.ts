/**
 * Encounter chance utilities for travel integration.
 *
 * Implements the 12.5% base chance per hour with population modifiers.
 *
 * @see docs/features/Travel-System.md#encounter-checks-waehrend-reisen
 */

import type { HexCoordinate, FactionPresence } from '@core/schemas';

// ============================================================================
// Constants
// ============================================================================

/**
 * Base encounter chance per hour of travel (12.5%).
 * At this rate, expect ~1 encounter per 8 hours of travel.
 */
export const BASE_ENCOUNTER_CHANCE_PER_HOUR = 0.125;

/**
 * Population factors that modify encounter chance.
 * Higher population = more encounters.
 */
export const POPULATION_FACTORS: Record<number, number> = {
  0: 0.25,   // Deserted → ~32h between encounters
  25: 0.5,   // Sparse → ~16h between encounters
  50: 1.0,   // Normal → ~8h between encounters
  75: 1.5,   // Dense → ~5h between encounters
  100: 2.0,  // Crowded → ~4h between encounters
};

/**
 * Default population when no faction presence data available.
 */
export const DEFAULT_POPULATION = 50;

// ============================================================================
// Chance Calculation
// ============================================================================

/**
 * Get the population factor for a given population value.
 * Interpolates between defined breakpoints.
 */
export function getPopulationFactor(population: number): number {
  // Clamp to valid range
  const clamped = Math.max(0, Math.min(100, population));

  // Find bracketing values
  const breakpoints = Object.keys(POPULATION_FACTORS)
    .map(Number)
    .sort((a, b) => a - b);

  // Exact match
  if (clamped in POPULATION_FACTORS) {
    return POPULATION_FACTORS[clamped];
  }

  // Find surrounding breakpoints
  let lower = 0;
  let upper = 100;

  for (const bp of breakpoints) {
    if (bp < clamped) lower = bp;
    if (bp > clamped) {
      upper = bp;
      break;
    }
  }

  // Linear interpolation
  const lowerFactor = POPULATION_FACTORS[lower];
  const upperFactor = POPULATION_FACTORS[upper];
  const t = (clamped - lower) / (upper - lower);

  return lowerFactor + t * (upperFactor - lowerFactor);
}

/**
 * Calculate encounter chance for a given travel duration.
 *
 * Formula: chance = timeCostHours × BASE_CHANCE × populationFactor
 *
 * Example: 2 hours travel, normal population (50)
 * chance = 2 × 0.125 × 1.0 = 0.25 (25%)
 *
 * @param timeCostHours - Duration of travel in hours
 * @param population - Population level (0-100), defaults to 50
 * @returns Encounter probability (0-1, capped at 0.95)
 */
export function calculateEncounterChance(
  timeCostHours: number,
  population: number = DEFAULT_POPULATION
): number {
  if (timeCostHours <= 0) return 0;

  const populationFactor = getPopulationFactor(population);
  const rawChance = timeCostHours * BASE_ENCOUNTER_CHANCE_PER_HOUR * populationFactor;

  // Cap at 95% to always allow some chance of no encounter
  return Math.min(rawChance, 0.95);
}

/**
 * Roll for encounter based on calculated chance.
 *
 * @param chance - Probability of encounter (0-1)
 * @returns True if encounter should occur
 */
export function rollEncounter(chance: number): boolean {
  return Math.random() < chance;
}

// ============================================================================
// Population Derivation (MVP)
// ============================================================================

/**
 * Derive population from faction presences at a position.
 *
 * MVP Implementation: Simple sum of faction strengths, capped at 100.
 * Post-MVP: Consider faction territories, POI proximity, etc.
 *
 * @param position - Hex coordinate (currently unused in MVP)
 * @param factionPresences - Faction presence data
 * @returns Population level (0-100)
 */
export function derivePopulation(
  _position: HexCoordinate,
  factionPresences: readonly FactionPresence[]
): number {
  if (factionPresences.length === 0) {
    return DEFAULT_POPULATION;
  }

  // Sum faction strengths (0-100 each)
  const totalStrength = factionPresences.reduce(
    (sum, fp) => sum + fp.strength,
    0
  );

  // Normalize: more factions = higher population, capped at 100
  // MVP: Simple average with a minimum
  const avgStrength = totalStrength / factionPresences.length;
  const factionBonus = Math.min(factionPresences.length * 10, 30);

  return Math.min(Math.round(avgStrength + factionBonus), 100);
}
