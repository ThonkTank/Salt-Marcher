// Ziel: Unit Tests für NEAT Core Infrastructure
// Siehe: docs/services/combatantAI/combatantAI.md

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createInnovationTracker,
  createMinimalGenome,
  buildNetwork,
  forward,
  serializeGenome,
  deserializeGenome,
  validateGenome,
  getNetworkComplexity,
} from '../index';

describe('NEAT Core Infrastructure', () => {
  describe('InnovationTracker', () => {
    it('assigns consistent innovation numbers', () => {
      const tracker = createInnovationTracker();

      const first = tracker.getInnovation(0, 4);
      const second = tracker.getInnovation(1, 4);
      const firstAgain = tracker.getInnovation(0, 4);

      expect(first).toBe(firstAgain);
      expect(first).not.toBe(second);
    });

    it('generates unique node IDs', () => {
      const tracker = createInnovationTracker();

      const id1 = tracker.getNextNodeId();
      const id2 = tracker.getNextNodeId();
      const id3 = tracker.getNextNodeId();

      expect(id1).toBe(0);
      expect(id2).toBe(1);
      expect(id3).toBe(2);
    });

    it('tracks counts correctly', () => {
      const tracker = createInnovationTracker();

      tracker.getInnovation(0, 1);
      tracker.getInnovation(0, 2);
      tracker.getNextNodeId();

      expect(tracker.getInnovationCount()).toBe(2);
      expect(tracker.getNodeCount()).toBe(1);
    });
  });

  describe('createMinimalGenome', () => {
    it('creates correct number of nodes and connections', () => {
      const tracker = createInnovationTracker();
      const genome = createMinimalGenome(4, 2, tracker);

      expect(genome.nodes).toHaveLength(6); // 4 input + 2 output
      expect(genome.connections).toHaveLength(8); // 4 × 2 = 8

      const inputNodes = genome.nodes.filter(n => n.type === 'input');
      const outputNodes = genome.nodes.filter(n => n.type === 'output');

      expect(inputNodes).toHaveLength(4);
      expect(outputNodes).toHaveLength(2);
    });

    it('assigns unique node IDs', () => {
      const tracker = createInnovationTracker();
      const genome = createMinimalGenome(4, 2, tracker);

      const nodeIds = genome.nodes.map(n => n.id);
      const uniqueIds = new Set(nodeIds);

      expect(uniqueIds.size).toBe(nodeIds.length);
    });

    it('creates all connections enabled', () => {
      const tracker = createInnovationTracker();
      const genome = createMinimalGenome(4, 2, tracker);

      const allEnabled = genome.connections.every(c => c.enabled);
      expect(allEnabled).toBe(true);
    });

    it('initializes fitness to 0', () => {
      const tracker = createInnovationTracker();
      const genome = createMinimalGenome(4, 2, tracker);

      expect(genome.fitness).toBe(0);
    });
  });

  describe('buildNetwork', () => {
    it('creates network with correct structure', () => {
      const tracker = createInnovationTracker();
      const genome = createMinimalGenome(4, 2, tracker);
      const network = buildNetwork(genome);

      expect(network.inputIds).toHaveLength(4);
      expect(network.outputIds).toHaveLength(2);
      expect(network.connections).toHaveLength(8);
    });

    it('topologically sorts nodes (inputs before outputs)', () => {
      const tracker = createInnovationTracker();
      const genome = createMinimalGenome(4, 2, tracker);
      const network = buildNetwork(genome);

      // Find positions of input and output nodes in sorted array
      const inputPositions = network.inputIds.map(id => network.nodeIndex.get(id)!);
      const outputPositions = network.outputIds.map(id => network.nodeIndex.get(id)!);

      // All inputs should come before all outputs
      const maxInputPos = Math.max(...inputPositions);
      const minOutputPos = Math.min(...outputPositions);

      expect(maxInputPos).toBeLessThan(minOutputPos);
    });
  });

  describe('forward', () => {
    it('produces output values in valid range (sigmoid)', () => {
      const tracker = createInnovationTracker();
      const genome = createMinimalGenome(4, 2, tracker);
      const network = buildNetwork(genome);

      const outputs = forward(network, [1, 0, 0, 0]);

      expect(outputs).toHaveLength(2);
      outputs.forEach(out => {
        expect(out).toBeGreaterThanOrEqual(0);
        expect(out).toBeLessThanOrEqual(1);
      });
    });

    it('produces different outputs for different inputs', () => {
      const tracker = createInnovationTracker();
      const genome = createMinimalGenome(4, 2, tracker);
      const network = buildNetwork(genome);

      const outputs1 = forward(network, [1, 0, 0, 0]);
      const outputs2 = forward(network, [0, 1, 0, 0]);

      // At least one output should differ
      const allSame = outputs1.every((v, i) => Math.abs(v - outputs2[i]) < 0.0001);
      expect(allSame).toBe(false);
    });

    it('handles missing inputs gracefully', () => {
      const tracker = createInnovationTracker();
      const genome = createMinimalGenome(4, 2, tracker);
      const network = buildNetwork(genome);

      // Provide fewer inputs than expected
      const outputs = forward(network, [1, 0]);

      expect(outputs).toHaveLength(2);
      outputs.forEach(out => {
        expect(typeof out).toBe('number');
        expect(Number.isNaN(out)).toBe(false);
      });
    });
  });

  describe('Serialization', () => {
    it('roundtrip preserves genome', () => {
      const tracker = createInnovationTracker();
      const original = createMinimalGenome(4, 2, tracker);
      original.fitness = 42;
      original.species = 5;
      original.generation = 10;

      const json = serializeGenome(original);
      const restored = deserializeGenome(json);

      expect(restored.id).toBe(original.id);
      expect(restored.fitness).toBe(42);
      expect(restored.species).toBe(5);
      expect(restored.generation).toBe(10);
      expect(restored.nodes).toHaveLength(original.nodes.length);
      expect(restored.connections).toHaveLength(original.connections.length);
    });

    it('produces valid JSON', () => {
      const tracker = createInnovationTracker();
      const genome = createMinimalGenome(4, 2, tracker);

      const json = serializeGenome(genome);

      expect(() => JSON.parse(json)).not.toThrow();
    });
  });

  describe('validateGenome', () => {
    it('validates correct genome', () => {
      const tracker = createInnovationTracker();
      const genome = createMinimalGenome(4, 2, tracker);

      const errors = validateGenome(genome);

      expect(errors).toHaveLength(0);
    });

    it('detects missing input nodes', () => {
      const genome = {
        id: 'test',
        nodes: [{ id: 0, type: 'output' as const, activation: 'sigmoid' as const, bias: 0 }],
        connections: [],
        fitness: 0,
        species: 0,
        generation: 0,
      };

      const errors = validateGenome(genome);

      expect(errors.some(e => e.includes('no input'))).toBe(true);
    });

    it('detects invalid connection references', () => {
      const tracker = createInnovationTracker();
      const genome = createMinimalGenome(4, 2, tracker);

      // Add invalid connection
      genome.connections.push({
        innovation: 999,
        inNode: 999, // Non-existent
        outNode: 0,
        weight: 1,
        enabled: true,
      });

      const errors = validateGenome(genome);

      expect(errors.some(e => e.includes('non-existent'))).toBe(true);
    });
  });

  describe('getNetworkComplexity', () => {
    it('reports correct complexity for minimal genome', () => {
      const tracker = createInnovationTracker();
      const genome = createMinimalGenome(4, 2, tracker);
      const network = buildNetwork(genome);

      const complexity = getNetworkComplexity(network);

      expect(complexity.nodeCount).toBe(6);
      expect(complexity.connectionCount).toBe(8);
      expect(complexity.hiddenCount).toBe(0);
    });
  });
});
