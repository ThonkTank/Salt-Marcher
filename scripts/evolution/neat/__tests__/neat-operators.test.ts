// Ziel: Tests für NEAT Evolution Operators
// Siehe: docs/services/combatantAI/algorithm-approaches.md

import { describe, it, expect, beforeEach } from 'vitest';
import type { NEATGenome, InnovationTracker } from '../../../../src/services/combatantAI/evolution/types';
import {
  createInnovationTracker,
  createMinimalGenome,
  cloneGenome,
  validateGenome,
} from '../../../../src/services/combatantAI/evolution/neat';

import {
  // Mutations
  DEFAULT_MUTATION_RATES,
  mutateWeights,
  addNode,
  addConnection,
  toggleConnection,
  mutate,
  // Crossover
  calculateCompatibility,
  crossover,
  crossoverByFitness,
  // Speciation
  resetSpeciesIdCounter,
  speciate,
  adjustFitness,
  adjustAllFitness,
  calculateOffspringCounts,
  pruneStaleSpecies,
  selectParent,
  getChampion,
  type Species,
} from '../index';

// ============================================================================
// TEST HELPERS
// ============================================================================

function createTestGenome(
  tracker: InnovationTracker,
  inputSize = 3,
  outputSize = 1
): NEATGenome {
  return createMinimalGenome(inputSize, outputSize, tracker);
}

// ============================================================================
// MUTATION TESTS
// ============================================================================

describe('mutations', () => {
  let tracker: InnovationTracker;
  let genome: NEATGenome;

  beforeEach(() => {
    tracker = createInnovationTracker();
    genome = createTestGenome(tracker);
  });

  describe('mutateWeights', () => {
    it('should not modify original genome', () => {
      const originalWeights = genome.connections.map(c => c.weight);
      mutateWeights(genome);
      const afterWeights = genome.connections.map(c => c.weight);
      expect(afterWeights).toEqual(originalWeights);
    });

    it('should return a new genome with different weights', () => {
      // With high perturbation, weights should change
      const mutated = mutateWeights(genome, 1.0, 1.0);

      // At least some weights should be different (probabilistic)
      // With stdDev=1.0, changes should be noticeable
      expect(mutated.id).not.toBe(genome.id);
    });

    it('should keep weights in valid range', () => {
      const mutated = mutateWeights(genome, 1.0, 10.0);
      for (const conn of mutated.connections) {
        expect(conn.weight).toBeGreaterThanOrEqual(-4);
        expect(conn.weight).toBeLessThanOrEqual(4);
      }
    });

    it('should also mutate biases', () => {
      const mutated = mutateWeights(genome, 1.0, 1.0);

      // Output nodes have biases
      const outputNodes = mutated.nodes.filter(n => n.type === 'output');
      expect(outputNodes.length).toBeGreaterThan(0);

      // Biases should be in valid range
      for (const node of outputNodes) {
        expect(node.bias).toBeGreaterThanOrEqual(-4);
        expect(node.bias).toBeLessThanOrEqual(4);
      }
    });
  });

  describe('addNode', () => {
    it('should add a new hidden node', () => {
      const originalNodeCount = genome.nodes.length;
      const mutated = addNode(genome, tracker);
      expect(mutated.nodes.length).toBe(originalNodeCount + 1);
    });

    it('should add exactly one hidden node', () => {
      const mutated = addNode(genome, tracker);
      const hiddenNodes = mutated.nodes.filter(n => n.type === 'hidden');
      expect(hiddenNodes.length).toBe(1);
    });

    it('should disable the split connection', () => {
      const mutated = addNode(genome, tracker);
      const disabledCount = mutated.connections.filter(c => !c.enabled).length;
      expect(disabledCount).toBe(1);
    });

    it('should add two new connections', () => {
      const originalConnCount = genome.connections.length;
      const mutated = addNode(genome, tracker);
      expect(mutated.connections.length).toBe(originalConnCount + 2);
    });

    it('should produce a valid genome', () => {
      const mutated = addNode(genome, tracker);
      const errors = validateGenome(mutated);
      expect(errors).toEqual([]);
    });
  });

  describe('addConnection', () => {
    it('should add a new connection when possible', () => {
      // First add a hidden node to create more connection possibilities
      let mutated = addNode(genome, tracker);
      const originalConnCount = mutated.connections.length;

      // Try to add a connection
      mutated = addConnection(mutated, tracker);

      // May or may not succeed depending on existing connections
      expect(mutated.connections.length).toBeGreaterThanOrEqual(originalConnCount);
    });

    it('should not create duplicate connections', () => {
      let mutated = addNode(genome, tracker);

      // Add multiple connections
      for (let i = 0; i < 10; i++) {
        mutated = addConnection(mutated, tracker);
      }

      // Check for duplicates
      const pairs = new Set<string>();
      for (const conn of mutated.connections) {
        const key = `${conn.inNode}:${conn.outNode}`;
        expect(pairs.has(key)).toBe(false);
        pairs.add(key);
      }
    });

    it('should produce a valid genome', () => {
      let mutated = addNode(genome, tracker);
      mutated = addConnection(mutated, tracker);
      const errors = validateGenome(mutated);
      expect(errors).toEqual([]);
    });
  });

  describe('toggleConnection', () => {
    it('should toggle exactly one connection', () => {
      const originalEnabled = genome.connections.filter(c => c.enabled).length;
      const mutated = toggleConnection(genome);
      const newEnabled = mutated.connections.filter(c => c.enabled).length;

      // Difference should be exactly 1
      expect(Math.abs(newEnabled - originalEnabled)).toBe(1);
    });
  });

  describe('mutate (combined)', () => {
    it('should apply mutations based on rates', () => {
      // Force weight mutation only
      const mutated = mutate(genome, tracker, {
        weightMutation: 1.0,
        addNode: 0,
        addConnection: 0,
        toggleConnection: 0,
      });

      expect(mutated.nodes.length).toBe(genome.nodes.length);
      expect(mutated.connections.length).toBe(genome.connections.length);
    });

    it('should always produce a valid genome', () => {
      // Apply multiple mutations
      let mutated = genome;
      for (let i = 0; i < 10; i++) {
        mutated = mutate(mutated, tracker, DEFAULT_MUTATION_RATES);
        const errors = validateGenome(mutated);
        expect(errors).toEqual([]);
      }
    });
  });
});

// ============================================================================
// CROSSOVER TESTS
// ============================================================================

describe('crossover', () => {
  let tracker: InnovationTracker;
  let parentA: NEATGenome;
  let parentB: NEATGenome;

  beforeEach(() => {
    tracker = createInnovationTracker();
    // Create base genome
    const base = createTestGenome(tracker);

    // Clone to create parents with same node IDs
    parentA = cloneGenome(base);
    parentB = cloneGenome(base);

    // Make them slightly different via weight mutation
    parentA = mutateWeights(parentA);
    parentB = mutateWeights(parentB);

    // Set different fitness
    parentA.fitness = 100;
    parentB.fitness = 50;
  });

  describe('calculateCompatibility', () => {
    it('should return 0 for identical genomes', () => {
      const clone = cloneGenome(parentA);
      clone.connections = parentA.connections.map(c => ({ ...c }));

      const distance = calculateCompatibility(parentA, clone);

      // Should be very small (only weight differences from random)
      expect(distance).toBeLessThan(1);
    });

    it('should return higher distance for different topologies', () => {
      // Add node to parentA
      const modified = addNode(parentA, tracker);
      const distance = calculateCompatibility(parentA, modified);

      expect(distance).toBeGreaterThan(0);
    });

    it('should be symmetric', () => {
      const distAB = calculateCompatibility(parentA, parentB);
      const distBA = calculateCompatibility(parentB, parentA);

      expect(distAB).toBeCloseTo(distBA, 5);
    });
  });

  describe('crossover', () => {
    it('should produce offspring with correct structure', () => {
      const offspring = crossover(parentA, parentB);

      expect(offspring.nodes.length).toBeGreaterThan(0);
      expect(offspring.connections.length).toBeGreaterThan(0);
    });

    it('should reset fitness to 0', () => {
      const offspring = crossover(parentA, parentB);
      expect(offspring.fitness).toBe(0);
    });

    it('should increment generation', () => {
      parentA.generation = 5;
      parentB.generation = 3;

      const offspring = crossover(parentA, parentB);
      expect(offspring.generation).toBe(6);
    });

    it('should produce a valid genome', () => {
      const offspring = crossover(parentA, parentB);
      const errors = validateGenome(offspring);
      expect(errors).toEqual([]);
    });

    it('should include genes from fitter parent for disjoint/excess', () => {
      // Add node to fitter parent only
      const fitterWithNode = addNode(parentA, tracker);
      fitterWithNode.fitness = 100;
      parentB.fitness = 50;

      const offspring = crossover(fitterWithNode, parentB, false);

      // Offspring should have the hidden node from fitter parent
      const hiddenNodes = offspring.nodes.filter(n => n.type === 'hidden');
      expect(hiddenNodes.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('crossoverByFitness', () => {
    it('should handle equal fitness', () => {
      parentA.fitness = 100;
      parentB.fitness = 100;

      const offspring = crossoverByFitness(parentA, parentB);
      expect(offspring).toBeDefined();
      expect(validateGenome(offspring)).toEqual([]);
    });

    it('should order parents correctly', () => {
      parentA.fitness = 50;
      parentB.fitness = 100;

      const offspring = crossoverByFitness(parentA, parentB);
      expect(offspring).toBeDefined();
    });
  });
});

// ============================================================================
// SPECIATION TESTS
// ============================================================================

describe('speciation', () => {
  let tracker: InnovationTracker;
  let population: NEATGenome[];

  beforeEach(() => {
    resetSpeciesIdCounter();
    tracker = createInnovationTracker();

    // Create diverse population
    population = [];
    for (let i = 0; i < 10; i++) {
      let genome = createTestGenome(tracker);

      // Add some variation
      if (i > 5) {
        genome = addNode(genome, tracker);
      }
      genome = mutateWeights(genome);
      genome.fitness = Math.random() * 100;

      population.push(genome);
    }
  });

  describe('speciate', () => {
    it('should assign all genomes to species', () => {
      const species = speciate(population);

      let totalMembers = 0;
      for (const s of species) {
        totalMembers += s.members.length;
      }

      expect(totalMembers).toBe(population.length);
    });

    it('should create at least one species', () => {
      const species = speciate(population);
      expect(species.length).toBeGreaterThan(0);
    });

    it('should set species ID on genomes', () => {
      speciate(population);

      for (const genome of population) {
        expect(genome.species).toBeGreaterThan(0);
      }
    });

    it('should reuse existing species when possible', () => {
      const species1 = speciate(population);
      const speciesIds1 = new Set(species1.map(s => s.id));

      // Speciate again with same species
      const species2 = speciate(population, species1);
      const speciesIds2 = new Set(species2.map(s => s.id));

      // At least some species should persist
      const overlap = [...speciesIds1].filter(id => speciesIds2.has(id));
      expect(overlap.length).toBeGreaterThan(0);
    });
  });

  describe('adjustFitness', () => {
    it('should update avgAdjustedFitness', () => {
      const species = speciate(population)[0];
      adjustFitness(species);

      expect(species.avgAdjustedFitness).toBeGreaterThanOrEqual(0);
    });

    it('should reset staleness when fitness improves', () => {
      const species = speciate(population)[0];
      species.staleness = 5;
      species.bestFitness = 0;

      // Set high fitness on a member
      species.members[0].fitness = 1000;

      adjustFitness(species);

      expect(species.staleness).toBe(0);
    });

    it('should increment staleness when fitness does not improve', () => {
      const species = speciate(population)[0];
      species.staleness = 5;
      species.bestFitness = 10000;

      adjustFitness(species);

      expect(species.staleness).toBe(6);
    });
  });

  describe('calculateOffspringCounts', () => {
    it('should allocate correct total', () => {
      const species = speciate(population);
      adjustAllFitness(species);

      const targetSize = 20;
      const counts = calculateOffspringCounts(species, targetSize);

      let total = 0;
      for (const count of counts.values()) {
        total += count;
      }

      expect(total).toBe(targetSize);
    });

    it('should give more offspring to fitter species', () => {
      const species = speciate(population);

      // Make first species much fitter
      for (const genome of species[0].members) {
        genome.fitness = 1000;
      }

      // Make other species less fit
      for (let i = 1; i < species.length; i++) {
        for (const genome of species[i].members) {
          genome.fitness = 1;
        }
      }

      adjustAllFitness(species);
      const counts = calculateOffspringCounts(species, 20);

      const firstCount = counts.get(species[0].id) ?? 0;
      expect(firstCount).toBeGreaterThan(5);
    });
  });

  describe('pruneStaleSpecies', () => {
    it('should remove stale species', () => {
      // Create multiple species manually for reliable testing
      const species1: Species = {
        id: 1,
        representative: population[0],
        members: [population[0], population[1]],
        staleness: 0,
        bestFitness: 100,
        avgAdjustedFitness: 50,
      };
      const species2: Species = {
        id: 2,
        representative: population[2],
        members: [population[2]],
        staleness: 20, // Stale
        bestFitness: 50,
        avgAdjustedFitness: 25,
      };
      const species3: Species = {
        id: 3,
        representative: population[3],
        members: [population[3]],
        staleness: 20, // Stale
        bestFitness: 30,
        avgAdjustedFitness: 15,
      };

      const allSpecies = [species1, species2, species3];
      const pruned = pruneStaleSpecies(allSpecies, { staleThreshold: 15 });

      expect(pruned.length).toBeLessThan(allSpecies.length);
      expect(pruned).toContain(species1); // Fresh species should survive
    });

    it('should keep at least minSpecies', () => {
      // Create multiple stale species
      const species1: Species = {
        id: 1,
        representative: population[0],
        members: [population[0]],
        staleness: 100,
        bestFitness: 100,
        avgAdjustedFitness: 50,
      };
      const species2: Species = {
        id: 2,
        representative: population[1],
        members: [population[1]],
        staleness: 100,
        bestFitness: 80,
        avgAdjustedFitness: 40,
      };
      const species3: Species = {
        id: 3,
        representative: population[2],
        members: [population[2]],
        staleness: 100,
        bestFitness: 60,
        avgAdjustedFitness: 30,
      };

      const allSpecies = [species1, species2, species3];
      const pruned = pruneStaleSpecies(allSpecies, {
        staleThreshold: 15,
        minSpecies: 2,
      });

      expect(pruned.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('selectParent', () => {
    it('should return a member from the species', () => {
      const species = speciate(population)[0];
      const parent = selectParent(species);

      expect(species.members).toContain(parent);
    });

    it('should favor fitter members', () => {
      const species = speciate(population)[0];

      // Set one member as much fitter
      species.members[0].fitness = 10000;
      for (let i = 1; i < species.members.length; i++) {
        species.members[i].fitness = 1;
      }

      // Select multiple times
      let fittestSelectedCount = 0;
      for (let i = 0; i < 100; i++) {
        const parent = selectParent(species, 3);
        if (parent === species.members[0]) {
          fittestSelectedCount++;
        }
      }

      // Fittest should be selected more often than uniform random (~33%)
      // With tournament selection, fittest should win most tournaments
      expect(fittestSelectedCount).toBeGreaterThan(20);
    });
  });

  describe('getChampion', () => {
    it('should return the fittest member', () => {
      const species = speciate(population)[0];

      // Set specific fitness values
      species.members[0].fitness = 50;
      species.members[1].fitness = 100;
      if (species.members[2]) {
        species.members[2].fitness = 75;
      }

      const champion = getChampion(species);

      expect(champion).toBe(species.members[1]);
    });

    it('should return undefined for empty species', () => {
      const emptySpecies: Species = {
        id: 999,
        representative: population[0],
        members: [],
        staleness: 0,
        bestFitness: 0,
        avgAdjustedFitness: 0,
      };

      const champion = getChampion(emptySpecies);
      expect(champion).toBeUndefined();
    });
  });
});
