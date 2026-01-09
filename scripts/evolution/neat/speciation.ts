// Ziel: NEAT Speciation - Species-Management und Fitness-Sharing
// Siehe: docs/services/combatantAI/algorithm-approaches.md
//
// Speciation schützt strukturelle Innovation durch:
// - Gruppierung ähnlicher Topologien in Species
// - Fitness-Sharing innerhalb Species (verhindert Dominanz)
// - Stale Species werden entfernt (keine Verbesserung)

import type { NEATGenome } from '../../../src/services/combatantAI/evolution/types';
import { calculateCompatibility, type CompatibilityCoefficients } from './crossover';

// ============================================================================
// TYPES
// ============================================================================

/**
 * A species groups similar genomes together.
 */
export interface Species {
  /** Unique species identifier */
  id: number;
  /** Representative genome (used for compatibility comparisons) */
  representative: NEATGenome;
  /** All member genomes in this species */
  members: NEATGenome[];
  /** Generations since last fitness improvement */
  staleness: number;
  /** Best fitness ever achieved by this species */
  bestFitness: number;
  /** Average adjusted fitness of members */
  avgAdjustedFitness: number;
}

/**
 * Configuration for speciation.
 */
export interface SpeciationConfig {
  /** Distance threshold for species membership (default: 3.0) */
  compatibilityThreshold: number;
  /** Target number of species (for dynamic threshold) */
  targetSpeciesCount: number;
  /** Generations without improvement before pruning (default: 15) */
  staleThreshold: number;
  /** Minimum species to keep even if stale (default: 2) */
  minSpecies: number;
  /** Compatibility coefficients */
  coefficients: CompatibilityCoefficients;
}

/**
 * Default speciation configuration.
 */
export const DEFAULT_SPECIATION_CONFIG: SpeciationConfig = {
  compatibilityThreshold: 3.0,
  targetSpeciesCount: 10,
  staleThreshold: 15,
  minSpecies: 2,
  coefficients: {
    c1: 1.0,
    c2: 1.0,
    c3: 0.4,
  },
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

let nextSpeciesId = 1;

/**
 * Generates a unique species ID.
 */
function generateSpeciesId(): number {
  return nextSpeciesId++;
}

/**
 * Resets the species ID counter (for testing).
 */
export function resetSpeciesIdCounter(): void {
  nextSpeciesId = 1;
}

/**
 * Gets a random genome from an array.
 */
function randomChoice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ============================================================================
// SPECIATION
// ============================================================================

/**
 * Assigns genomes to species based on compatibility distance.
 *
 * Process:
 * 1. Clear member lists from existing species
 * 2. For each genome:
 *    - Compare with species representatives
 *    - Assign to first compatible species (distance < threshold)
 *    - Or create new species if none compatible
 * 3. Remove empty species
 * 4. Update representatives (random member from each species)
 *
 * @param population - All genomes to speciate
 * @param existingSpecies - Species from previous generation
 * @param config - Speciation configuration
 * @returns Updated species array
 */
export function speciate(
  population: NEATGenome[],
  existingSpecies: Species[] = [],
  config: Partial<SpeciationConfig> = {}
): Species[] {
  const cfg = { ...DEFAULT_SPECIATION_CONFIG, ...config };

  // Clear members from existing species
  for (const species of existingSpecies) {
    species.members = [];
  }

  // Assign each genome to a species
  for (const genome of population) {
    let assigned = false;

    // Try existing species
    for (const species of existingSpecies) {
      const distance = calculateCompatibility(
        genome,
        species.representative,
        cfg.coefficients
      );

      if (distance < cfg.compatibilityThreshold) {
        species.members.push(genome);
        genome.species = species.id;
        assigned = true;
        break;
      }
    }

    // Create new species if no match
    if (!assigned) {
      const newSpecies: Species = {
        id: generateSpeciesId(),
        representative: genome,
        members: [genome],
        staleness: 0,
        bestFitness: genome.fitness,
        avgAdjustedFitness: 0,
      };
      genome.species = newSpecies.id;
      existingSpecies.push(newSpecies);
    }
  }

  // Remove empty species
  const activeSpecies = existingSpecies.filter(s => s.members.length > 0);

  // Update representatives (random member from each species)
  for (const species of activeSpecies) {
    species.representative = randomChoice(species.members);
  }

  return activeSpecies;
}

/**
 * Adjusts fitness using fitness sharing within species.
 *
 * Each genome's adjusted fitness = raw fitness / species size
 * This prevents large species from dominating.
 *
 * Also updates species statistics.
 *
 * @param species - Species to adjust
 */
export function adjustFitness(species: Species): void {
  const speciesSize = species.members.length;
  if (speciesSize === 0) return;

  let totalAdjusted = 0;
  let maxFitness = -Infinity;

  for (const genome of species.members) {
    // Adjusted fitness = raw fitness / species size
    const adjustedFitness = genome.fitness / speciesSize;
    totalAdjusted += adjustedFitness;

    if (genome.fitness > maxFitness) {
      maxFitness = genome.fitness;
    }
  }

  species.avgAdjustedFitness = totalAdjusted / speciesSize;

  // Update staleness
  if (maxFitness > species.bestFitness) {
    species.bestFitness = maxFitness;
    species.staleness = 0;
  } else {
    species.staleness++;
  }
}

/**
 * Adjusts fitness for all species.
 */
export function adjustAllFitness(speciesList: Species[]): void {
  for (const species of speciesList) {
    adjustFitness(species);
  }
}

// ============================================================================
// OFFSPRING ALLOCATION
// ============================================================================

/**
 * Calculates how many offspring each species should produce.
 *
 * Offspring count is proportional to species' total adjusted fitness.
 *
 * @param speciesList - All species
 * @param populationSize - Target population size
 * @returns Map from species ID to offspring count
 */
export function calculateOffspringCounts(
  speciesList: Species[],
  populationSize: number
): Map<number, number> {
  const counts = new Map<number, number>();

  // Calculate total adjusted fitness
  let totalAdjustedFitness = 0;
  for (const species of speciesList) {
    // Sum of adjusted fitness for all members
    const speciesTotal = species.members.reduce(
      (sum, g) => sum + g.fitness / species.members.length,
      0
    );
    totalAdjustedFitness += speciesTotal;
  }

  // Avoid division by zero
  if (totalAdjustedFitness === 0) {
    // Equal distribution
    const perSpecies = Math.floor(populationSize / speciesList.length);
    let remaining = populationSize;

    for (const species of speciesList) {
      const count = Math.min(perSpecies, remaining);
      counts.set(species.id, count);
      remaining -= count;
    }

    // Distribute remainder
    if (remaining > 0 && speciesList.length > 0) {
      const first = speciesList[0];
      counts.set(first.id, (counts.get(first.id) ?? 0) + remaining);
    }

    return counts;
  }

  // Proportional allocation
  let allocated = 0;
  for (const species of speciesList) {
    const speciesTotal = species.members.reduce(
      (sum, g) => sum + g.fitness / species.members.length,
      0
    );
    const proportion = speciesTotal / totalAdjustedFitness;
    const offspring = Math.floor(proportion * populationSize);
    counts.set(species.id, offspring);
    allocated += offspring;
  }

  // Distribute remainder to species with highest adjusted fitness
  let remaining = populationSize - allocated;
  const sortedSpecies = [...speciesList].sort(
    (a, b) => b.avgAdjustedFitness - a.avgAdjustedFitness
  );

  for (const species of sortedSpecies) {
    if (remaining <= 0) break;
    counts.set(species.id, (counts.get(species.id) ?? 0) + 1);
    remaining--;
  }

  return counts;
}

// ============================================================================
// SPECIES PRUNING
// ============================================================================

/**
 * Removes species that have not improved for too long.
 *
 * Always keeps at least minSpecies, even if stale.
 *
 * @param speciesList - All species
 * @param config - Speciation configuration
 * @returns Pruned species list
 */
export function pruneStaleSpecies(
  speciesList: Species[],
  config: Partial<SpeciationConfig> = {}
): Species[] {
  const cfg = { ...DEFAULT_SPECIATION_CONFIG, ...config };

  // Sort by fitness (best first) for tie-breaking
  const sorted = [...speciesList].sort((a, b) => b.bestFitness - a.bestFitness);

  const kept: Species[] = [];
  const stale: Species[] = [];

  for (const species of sorted) {
    if (species.staleness >= cfg.staleThreshold) {
      stale.push(species);
    } else {
      kept.push(species);
    }
  }

  // Keep at least minSpecies
  while (kept.length < cfg.minSpecies && stale.length > 0) {
    // Add best stale species back
    kept.push(stale.shift()!);
  }

  return kept;
}

// ============================================================================
// DYNAMIC THRESHOLD
// ============================================================================

/**
 * Adjusts compatibility threshold to maintain target species count.
 *
 * If too many species: increase threshold
 * If too few species: decrease threshold
 *
 * @param currentThreshold - Current threshold
 * @param currentCount - Current number of species
 * @param targetCount - Target number of species
 * @param delta - Adjustment step (default: 0.1)
 * @returns New threshold
 */
export function adjustThreshold(
  currentThreshold: number,
  currentCount: number,
  targetCount: number,
  delta = 0.1
): number {
  if (currentCount > targetCount) {
    return currentThreshold + delta;
  } else if (currentCount < targetCount) {
    return Math.max(0.1, currentThreshold - delta);
  }
  return currentThreshold;
}

// ============================================================================
// SPECIES SELECTION
// ============================================================================

/**
 * Selects a parent from a species using tournament selection.
 *
 * @param species - Species to select from
 * @param tournamentSize - Number of candidates (default: 3)
 * @returns Selected genome
 */
export function selectParent(species: Species, tournamentSize = 3): NEATGenome {
  if (species.members.length === 0) {
    throw new Error('Cannot select from empty species');
  }

  if (species.members.length === 1) {
    return species.members[0];
  }

  // Tournament selection
  const candidates: NEATGenome[] = [];
  for (let i = 0; i < Math.min(tournamentSize, species.members.length); i++) {
    candidates.push(randomChoice(species.members));
  }

  // Return fittest candidate
  return candidates.reduce((best, curr) =>
    curr.fitness > best.fitness ? curr : best
  );
}

/**
 * Gets the champion (fittest member) of a species.
 */
export function getChampion(species: Species): NEATGenome | undefined {
  if (species.members.length === 0) return undefined;

  return species.members.reduce((best, curr) =>
    curr.fitness > best.fitness ? curr : best
  );
}

/**
 * Gets champions from all species.
 */
export function getAllChampions(speciesList: Species[]): NEATGenome[] {
  const champions: NEATGenome[] = [];

  for (const species of speciesList) {
    const champion = getChampion(species);
    if (champion) {
      champions.push(champion);
    }
  }

  return champions;
}
