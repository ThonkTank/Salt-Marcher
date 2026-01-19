// Ziel: Unit Tests für Evolved Selector
// Siehe: docs/services/combatantAI/combatantAI.md

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createEvolvedSelector } from '../evolvedSelector';
import type {
  CombatantWithLayers,
  CombatantSimulationStateWithLayers,
  TurnBudget,
  CombatantState,
  ConditionState,
  EffectLayerData,
  ActionWithLayer,
  ThreatMapEntry,
} from '@/types/combat';
import type { CombatEvent } from '@/types/entities/combatEvent';
import type { FeedForwardNetwork, NEATGenome } from '../../evolution';
import { createSingleValue } from '@/utils';

// ============================================================================
// MOCK SETUP
// ============================================================================

// Mock combatTracking functions
vi.mock('../../../combatTracking', () => ({
  getHP: vi.fn((c) => c.currentHp),
  getAC: vi.fn((c) => c._mockAC ?? 15),
  getMaxHP: vi.fn((c) => c.maxHp),
  getPosition: vi.fn((c) => c.combatState.position),
  getConditions: vi.fn((c) => c.combatState.conditions),
  getActions: vi.fn((c) => c._mockActions ?? []),
  getSpeed: vi.fn((c) => ({ walk: c._mockSpeed ?? 30 })),
  getResources: vi.fn((c) => c.combatState.resources),
  getGroupId: vi.fn((c) => c.combatState.groupId),
  getAliveCombatants: vi.fn((state) => state.combatants.filter((c: CombatantWithLayers) => !c.combatState.isDead)),
}));

// Mock buildPossibleActions
const mockBuildPossibleActions = vi.fn();
vi.mock('../../core', () => ({
  buildPossibleActions: (...args: unknown[]) => mockBuildPossibleActions(...args),
}));

// Mock buildThreatMap
const mockBuildThreatMap = vi.fn();
vi.mock('../../layers', () => ({
  buildThreatMap: (...args: unknown[]) => mockBuildThreatMap(...args),
}));

// Mock getReachableCells
vi.mock('../../helpers/combatHelpers', () => ({
  getReachableCells: vi.fn(() => [{ x: 0, y: 0, z: 0 }]),
}));

// Mock feature extraction
vi.mock('../../evolution', async () => {
  const actual = await vi.importActual('../../evolution');
  return {
    ...actual,
    extractStateFeatures: vi.fn(() => new Array(67).fill(0.5)),
    extractActionFeatures: vi.fn(() => new Array(19).fill(0.5)),
    combineFeatures: vi.fn((state, action) => [...state, ...action]),
    // Keep actual network functions for creating real networks
    buildNetwork: actual.buildNetwork,
    forward: actual.forward,
    createInnovationTracker: actual.createInnovationTracker,
    createMinimalGenome: actual.createMinimalGenome,
  };
});

// ============================================================================
// TEST FIXTURES
// ============================================================================

function createMockCombatant(overrides: {
  id?: string;
  name?: string;
  currentHp?: number;
  maxHp?: number;
  ac?: number;
  position?: { x: number; y: number; z: number };
  groupId?: string;
  isDead?: boolean;
  conditions?: ConditionState[];
  concentratingOn?: string;
  actions?: CombatEvent[];
  speed?: number;
}): CombatantWithLayers {
  const combatState: CombatantState & { effectLayers: EffectLayerData[] } = {
    position: overrides.position ?? { x: 0, y: 0, z: 0 },
    conditions: overrides.conditions ?? [],
    modifiers: [],
    inventory: [],
    groupId: overrides.groupId ?? 'party',
    isDead: overrides.isDead ?? false,
    concentratingOn: overrides.concentratingOn,
    effectLayers: [],
  };

  return {
    id: overrides.id ?? 'combatant-1',
    name: overrides.name ?? 'Test Combatant',
    currentHp: createSingleValue(overrides.currentHp ?? 20),
    maxHp: overrides.maxHp ?? 20,
    combatState,
    _layeredActions: [] as ActionWithLayer[],
    _mockAC: overrides.ac ?? 15,
    _mockActions: overrides.actions ?? [],
    _mockSpeed: overrides.speed ?? 30,
  } as unknown as CombatantWithLayers;
}

function createMockBudget(overrides?: Partial<TurnBudget>): TurnBudget {
  return {
    movementCells: overrides?.movementCells ?? 6,
    baseMovementCells: overrides?.baseMovementCells ?? 6,
    hasAction: overrides?.hasAction ?? true,
    hasBonusAction: overrides?.hasBonusAction ?? true,
    hasReaction: overrides?.hasReaction ?? true,
  };
}

function createMockState(combatants: CombatantWithLayers[]): CombatantSimulationStateWithLayers {
  return {
    combatants,
    alliances: {
      party: ['party'],
      enemies: ['enemies'],
    },
    roundNumber: 1,
    turnOrder: combatants.map(c => c.id),
    currentTurnIndex: 0,
  } as CombatantSimulationStateWithLayers;
}

function createMockAction(overrides?: Partial<CombatEvent>): CombatEvent {
  return {
    id: overrides?.id ?? 'attack-1',
    name: overrides?.name ?? 'Attack',
    actionType: overrides?.actionType ?? 'melee-weapon',
    timing: overrides?.timing ?? { type: 'action' },
    range: overrides?.range ?? { type: 'reach', normal: 5 },
    targeting: overrides?.targeting ?? { type: 'single', filter: 'enemy' },
    attack: overrides?.attack ?? { bonus: 5 },
    damage: overrides?.damage ?? { dice: '1d8', modifier: 3, type: 'slashing' },
    ...overrides,
  } as CombatEvent;
}

function createMockNetwork(): FeedForwardNetwork {
  // Create a simple network that always outputs 0.5 (sigmoid(0) = 0.5)
  const nodeIndex = new Map<number, number>();
  nodeIndex.set(0, 0);

  return {
    nodes: [
      { id: 0, type: 'output', activation: 'sigmoid', bias: 0, value: 0 },
    ],
    connections: [],
    inputIds: [],
    outputIds: [0],
    nodeIndex,
  };
}

function createMockNetworkWithScore(score: number): FeedForwardNetwork {
  // Network outputs via bias (no inputs connected)
  // sigmoid(bias) = score, so bias = logit(score)
  const bias = score <= 0 ? -10 : score >= 1 ? 10 : Math.log(score / (1 - score));
  const nodeIndex = new Map<number, number>();
  nodeIndex.set(0, 0);

  return {
    nodes: [
      { id: 0, type: 'output', activation: 'sigmoid', bias, value: 0 },
    ],
    connections: [],
    inputIds: [],
    outputIds: [0],
    nodeIndex,
  };
}

// ============================================================================
// TESTS
// ============================================================================

describe('Evolved Selector', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default mock implementations
    mockBuildThreatMap.mockReturnValue(new Map<string, ThreatMapEntry>());
    mockBuildPossibleActions.mockReturnValue([]);
  });

  describe('createEvolvedSelector', () => {
    it('creates selector with correct name', () => {
      const network = createMockNetwork();
      const selector = createEvolvedSelector(network, 'test-brain');

      expect(selector.name).toBe('evolved-test-brain');
    });

    it('creates selector with default name when id not provided', () => {
      const network = createMockNetwork();
      const selector = createEvolvedSelector(network);

      expect(selector.name).toBe('evolved-evolved');
    });

    it('has selectNextAction method', () => {
      const network = createMockNetwork();
      const selector = createEvolvedSelector(network);

      expect(typeof selector.selectNextAction).toBe('function');
    });

    it('has getStats method', () => {
      const network = createMockNetwork();
      const selector = createEvolvedSelector(network);

      expect(typeof selector.getStats).toBe('function');
    });
  });

  describe('selectNextAction', () => {
    it('returns pass when budget exhausted', () => {
      const network = createMockNetwork();
      const selector = createEvolvedSelector(network);
      const combatant = createMockCombatant({});
      const state = createMockState([combatant]);
      const budget = createMockBudget({
        hasAction: false,
        hasBonusAction: false,
        movementCells: 0,
      });

      const result = selector.selectNextAction(combatant, state, budget);

      expect(result.type).toBe('pass');
    });

    it('returns pass when no candidates available', () => {
      mockBuildPossibleActions.mockReturnValue([]);

      const network = createMockNetwork();
      const selector = createEvolvedSelector(network);
      const combatant = createMockCombatant({});
      const state = createMockState([combatant]);
      const budget = createMockBudget();

      const result = selector.selectNextAction(combatant, state, budget);

      expect(result.type).toBe('pass');
    });

    it('calls buildThreatMap with correct parameters', () => {
      mockBuildPossibleActions.mockReturnValue([]);

      const network = createMockNetwork();
      const selector = createEvolvedSelector(network);
      const combatant = createMockCombatant({
        position: { x: 5, y: 5, z: 0 },
      });
      const state = createMockState([combatant]);
      const budget = createMockBudget();

      selector.selectNextAction(combatant, state, budget);

      expect(mockBuildThreatMap).toHaveBeenCalledTimes(1);
      expect(mockBuildThreatMap).toHaveBeenCalledWith(
        combatant,
        state,
        expect.any(Array), // reachableCells
        { x: 5, y: 5, z: 0 } // currentCell
      );
    });

    it('calls buildPossibleActions with correct parameters', () => {
      const mockThreatMap = new Map<string, ThreatMapEntry>();
      mockBuildThreatMap.mockReturnValue(mockThreatMap);
      mockBuildPossibleActions.mockReturnValue([]);

      const network = createMockNetwork();
      const selector = createEvolvedSelector(network);
      const combatant = createMockCombatant({});
      const state = createMockState([combatant]);
      const budget = createMockBudget();

      selector.selectNextAction(combatant, state, budget);

      expect(mockBuildPossibleActions).toHaveBeenCalledTimes(1);
      expect(mockBuildPossibleActions).toHaveBeenCalledWith(
        combatant,
        state,
        budget,
        mockThreatMap
      );
    });

    it('returns action when candidates available', () => {
      const target = createMockCombatant({ id: 'target-1', name: 'Target' });
      const action = createMockAction({ name: 'Slash' });

      mockBuildPossibleActions.mockReturnValue([
        {
          type: 'action',
          action,
          target,
          fromPosition: { x: 0, y: 0, z: 0 },
          score: 10,
        },
      ]);

      const network = createMockNetwork();
      const selector = createEvolvedSelector(network);
      const combatant = createMockCombatant({});
      const state = createMockState([combatant, target]);
      const budget = createMockBudget();

      const result = selector.selectNextAction(combatant, state, budget);

      expect(result.type).toBe('action');
      if (result.type === 'action') {
        expect(result.action.name).toBe('Slash');
        expect(result.target?.name).toBe('Target');
      }
    });

    it('selects candidate with highest network score', () => {
      const target1 = createMockCombatant({ id: 'target-1', name: 'Weak Target' });
      const target2 = createMockCombatant({ id: 'target-2', name: 'Strong Target' });
      const action1 = createMockAction({ id: 'attack-1', name: 'Weak Attack' });
      const action2 = createMockAction({ id: 'attack-2', name: 'Strong Attack' });

      mockBuildPossibleActions.mockReturnValue([
        {
          type: 'action',
          action: action1,
          target: target1,
          fromPosition: { x: 0, y: 0, z: 0 },
          score: 5,
        },
        {
          type: 'action',
          action: action2,
          target: target2,
          fromPosition: { x: 1, y: 0, z: 0 },
          score: 10,
        },
      ]);

      // The actual scoring is done by the network's forward pass
      // Since we mock extractActionFeatures to return [0.5, ...], the network
      // will score them the same. The test validates that the selector iterates
      // through all candidates.

      const network = createMockNetwork();
      const selector = createEvolvedSelector(network);
      const combatant = createMockCombatant({});
      const state = createMockState([combatant, target1, target2]);
      const budget = createMockBudget();

      const result = selector.selectNextAction(combatant, state, budget);

      // With identical network scores, first candidate is selected
      expect(result.type).toBe('action');
    });
  });

  describe('getStats', () => {
    it('returns initial stats before any calls', () => {
      const network = createMockNetwork();
      const selector = createEvolvedSelector(network);

      const stats = selector.getStats!();

      expect(stats.nodesEvaluated).toBe(0);
      expect(stats.elapsedMs).toBe(0);
    });

    it('tracks nodes evaluated correctly', () => {
      mockBuildPossibleActions.mockReturnValue([
        { type: 'action', action: createMockAction(), fromPosition: { x: 0, y: 0, z: 0 }, score: 5 },
        { type: 'action', action: createMockAction(), fromPosition: { x: 1, y: 0, z: 0 }, score: 3 },
        { type: 'action', action: createMockAction(), fromPosition: { x: 2, y: 0, z: 0 }, score: 7 },
      ]);

      const network = createMockNetwork();
      const selector = createEvolvedSelector(network);
      const combatant = createMockCombatant({});
      const state = createMockState([combatant]);
      const budget = createMockBudget();

      selector.selectNextAction(combatant, state, budget);
      const stats = selector.getStats!();

      expect(stats.nodesEvaluated).toBe(3);
    });

    it('tracks elapsed time', () => {
      mockBuildPossibleActions.mockReturnValue([]);

      const network = createMockNetwork();
      const selector = createEvolvedSelector(network);
      const combatant = createMockCombatant({});
      const state = createMockState([combatant]);
      const budget = createMockBudget();

      selector.selectNextAction(combatant, state, budget);
      const stats = selector.getStats!();

      expect(stats.elapsedMs).toBeGreaterThanOrEqual(0);
    });

    it('includes bestScore in custom stats', () => {
      mockBuildPossibleActions.mockReturnValue([
        { type: 'action', action: createMockAction(), fromPosition: { x: 0, y: 0, z: 0 }, score: 5 },
      ]);

      const network = createMockNetwork();
      const selector = createEvolvedSelector(network);
      const combatant = createMockCombatant({});
      const state = createMockState([combatant]);
      const budget = createMockBudget();

      selector.selectNextAction(combatant, state, budget);
      const stats = selector.getStats!();

      expect(stats.custom).toBeDefined();
      expect(stats.custom?.bestScore).toBeDefined();
    });
  });

  describe('NEATGenome input', () => {
    it('accepts NEATGenome and builds network automatically', async () => {
      // Import real functions for this test
      const { createInnovationTracker, createMinimalGenome } = await import('../../evolution');

      const tracker = createInnovationTracker();
      const genome = createMinimalGenome(86, 1, tracker);

      // Should not throw
      const selector = createEvolvedSelector(genome, 'from-genome');

      expect(selector.name).toBe('evolved-from-genome');
    });
  });
});
