// Ziel: Unit Tests für Feature Extraction
// Siehe: docs/services/combatantAI/combatantAI.md

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  FEATURE_DIMENSIONS,
  extractStateFeatures,
  extractActionFeatures,
  combineFeatures,
} from '../featureExtraction';
import type {
  CombatantWithLayers,
  CombatantSimulationStateWithLayers,
  TurnBudget,
  CombatantState,
  ConditionState,
  EffectLayerData,
  ActionWithLayer,
} from '@/types/combat';
import type { Action } from '@/types/entities';
import type { NPC } from '@/types/entities/npc';
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
  actions?: Action[];
  speed?: number;
  spellSlots?: Record<number, number>;
}): CombatantWithLayers {
  const combatState: CombatantState & { effectLayers: EffectLayerData[] } = {
    position: overrides.position ?? { x: 0, y: 0, z: 0 },
    conditions: overrides.conditions ?? [],
    groupId: overrides.groupId ?? 'party',
    isDead: overrides.isDead ?? false,
    concentratingOn: overrides.concentratingOn,
    resources: overrides.spellSlots ? { spellSlots: overrides.spellSlots } : undefined,
    effectLayers: [],
  };

  return {
    id: overrides.id ?? 'combatant-1',
    name: overrides.name ?? 'Test Combatant',
    currentHp: createSingleValue(overrides.currentHp ?? 20),
    maxHp: overrides.maxHp ?? 20,
    combatState,
    _layeredActions: [] as ActionWithLayer[],
    // Mock fields for our mocked functions
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

function createMockAction(overrides?: Partial<Action>): Action {
  return {
    id: overrides?.id ?? 'attack-1',
    name: overrides?.name ?? 'Attack',
    actionType: overrides?.actionType ?? 'melee-weapon',
    timing: overrides?.timing ?? { type: 'action' },
    range: overrides?.range ?? { type: 'reach', normal: 5 },
    targeting: overrides?.targeting ?? { type: 'single', validTargets: 'enemies' },
    attack: overrides?.attack ?? { bonus: 5 },
    damage: overrides?.damage ?? { dice: '1d8', modifier: 3, type: 'slashing' },
    ...overrides,
  } as Action;
}

// ============================================================================
// TESTS
// ============================================================================

describe('Feature Extraction', () => {
  describe('FEATURE_DIMENSIONS', () => {
    it('has correct total', () => {
      const expected = FEATURE_DIMENSIONS.self +
        FEATURE_DIMENSIONS.enemies +
        FEATURE_DIMENSIONS.allies +
        FEATURE_DIMENSIONS.action +
        FEATURE_DIMENSIONS.target +
        FEATURE_DIMENSIONS.context;

      expect(FEATURE_DIMENSIONS.total).toBe(expected);
    });

    it('matches documented values', () => {
      expect(FEATURE_DIMENSIONS.self).toBe(15);
      expect(FEATURE_DIMENSIONS.enemies).toBe(32);  // 8 × 4
      expect(FEATURE_DIMENSIONS.allies).toBe(12);   // 4 × 3
      expect(FEATURE_DIMENSIONS.action).toBe(10);
      expect(FEATURE_DIMENSIONS.target).toBe(9);
      expect(FEATURE_DIMENSIONS.context).toBe(8);
      expect(FEATURE_DIMENSIONS.total).toBe(86);
    });
  });

  describe('extractStateFeatures', () => {
    it('returns correct number of features', () => {
      const combatant = createMockCombatant({});
      const state = createMockState([combatant]);
      const budget = createMockBudget();

      const features = extractStateFeatures(combatant, state, budget);

      const expectedLength = FEATURE_DIMENSIONS.self +
        FEATURE_DIMENSIONS.enemies +
        FEATURE_DIMENSIONS.allies +
        FEATURE_DIMENSIONS.context;

      expect(features).toHaveLength(expectedLength);
      expect(features).toHaveLength(67);
    });

    it('extracts HP percentage correctly', () => {
      const combatant = createMockCombatant({ currentHp: 15, maxHp: 30 });
      const state = createMockState([combatant]);
      const budget = createMockBudget();

      const features = extractStateFeatures(combatant, state, budget);

      // First feature is HP%
      expect(features[0]).toBeCloseTo(0.5, 5);
    });

    it('extracts budget flags correctly', () => {
      const combatant = createMockCombatant({});
      const state = createMockState([combatant]);
      const budget = createMockBudget({
        hasAction: true,
        hasBonusAction: false,
        hasReaction: true,
      });

      const features = extractStateFeatures(combatant, state, budget);

      // Budget flags start at index 4 (after HP, AC, posX, posY)
      expect(features[4]).toBe(1);  // hasAction
      expect(features[5]).toBe(0);  // hasBonusAction
      expect(features[6]).toBe(1);  // hasReaction
    });

    it('pads enemy features when no enemies present', () => {
      const combatant = createMockCombatant({});
      const state = createMockState([combatant]);
      const budget = createMockBudget();

      const features = extractStateFeatures(combatant, state, budget);

      // Enemy features start at index 15 (after self features)
      // Should all be 0 (padding)
      const enemyFeatures = features.slice(15, 15 + 32);
      expect(enemyFeatures.every(f => f === 0)).toBe(true);
    });

    it('pads ally features when no allies present', () => {
      const combatant = createMockCombatant({});
      const state = createMockState([combatant]);
      const budget = createMockBudget();

      const features = extractStateFeatures(combatant, state, budget);

      // Ally features start at index 47 (15 + 32)
      // Should all be 0 (padding)
      const allyFeatures = features.slice(47, 47 + 12);
      expect(allyFeatures.every(f => f === 0)).toBe(true);
    });

    it('extracts enemy features when enemies present', () => {
      const combatant = createMockCombatant({ groupId: 'party' });
      const enemy = createMockCombatant({
        id: 'enemy-1',
        groupId: 'enemies',
        currentHp: 10,
        maxHp: 20,
        position: { x: 2, y: 0, z: 0 },
      });
      const state = createMockState([combatant, enemy]);
      const budget = createMockBudget();

      const features = extractStateFeatures(combatant, state, budget);

      // First enemy's HP% should be 0.5
      expect(features[15]).toBeCloseTo(0.5, 5);
    });
  });

  describe('extractActionFeatures', () => {
    it('returns correct number of features', () => {
      const combatant = createMockCombatant({});
      const target = createMockCombatant({ id: 'target-1' });
      const state = createMockState([combatant, target]);
      const action = createMockAction();

      const features = extractActionFeatures(action, target, combatant, state);

      const expectedLength = FEATURE_DIMENSIONS.action + FEATURE_DIMENSIONS.target;
      expect(features).toHaveLength(expectedLength);
      expect(features).toHaveLength(19);
    });

    it('extracts damage EV correctly', () => {
      const combatant = createMockCombatant({});
      const target = createMockCombatant({ id: 'target-1' });
      const state = createMockState([combatant, target]);
      const action = createMockAction({
        damage: { dice: '2d6', modifier: 4, type: 'slashing' },
      });

      const features = extractActionFeatures(action, target, combatant, state);

      // 2d6 + 4 = 7 + 4 = 11 average, /20 = 0.55
      expect(features[0]).toBeCloseTo(0.55, 1);
    });

    it('extracts healing EV correctly', () => {
      const combatant = createMockCombatant({});
      const target = createMockCombatant({ id: 'target-1' });
      const state = createMockState([combatant, target]);
      const action = createMockAction({
        damage: undefined,
        healing: { dice: '2d8', modifier: 3 },
      });

      const features = extractActionFeatures(action, target, combatant, state);

      // 2d8 + 3 = 9 + 3 = 12 average, /20 = 0.6
      expect(features[1]).toBeCloseTo(0.6, 1);
    });

    it('handles no target (self-buff)', () => {
      const combatant = createMockCombatant({});
      const state = createMockState([combatant]);
      const action = createMockAction();

      const features = extractActionFeatures(action, undefined, combatant, state);

      expect(features).toHaveLength(19);
      // Target features should all be 0
      const targetFeatures = features.slice(10);
      expect(targetFeatures.every(f => f === 0)).toBe(true);
    });

    it('detects AoE actions', () => {
      const combatant = createMockCombatant({});
      const target = createMockCombatant({ id: 'target-1' });
      const state = createMockState([combatant, target]);
      const action = createMockAction({
        targeting: {
          type: 'area',
          validTargets: 'enemies',
          aoe: { shape: 'sphere', size: 20, origin: 'point' },
        },
      });

      const features = extractActionFeatures(action, target, combatant, state);

      // isAoE is at index 3
      expect(features[3]).toBe(1);
    });

    it('detects concentration requirement', () => {
      const combatant = createMockCombatant({});
      const target = createMockCombatant({ id: 'target-1' });
      const state = createMockState([combatant, target]);
      const action = createMockAction({
        concentration: true,
        effects: [{ duration: { type: 'concentration', value: 10 }, affectsTarget: 'target' }],
      });

      const features = extractActionFeatures(action, target, combatant, state);

      // requiresConcentration is at index 9
      expect(features[9]).toBe(1);
    });
  });

  describe('combineFeatures', () => {
    it('combines features correctly', () => {
      const stateFeatures = new Array(67).fill(0.5);
      const actionFeatures = new Array(19).fill(0.3);

      const combined = combineFeatures(stateFeatures, actionFeatures);

      expect(combined).toHaveLength(86);
      expect(combined.slice(0, 67)).toEqual(stateFeatures);
      expect(combined.slice(67)).toEqual(actionFeatures);
    });

    it('returns correct total dimension', () => {
      const stateFeatures = new Array(67).fill(0);
      const actionFeatures = new Array(19).fill(0);

      const combined = combineFeatures(stateFeatures, actionFeatures);

      expect(combined).toHaveLength(FEATURE_DIMENSIONS.total);
    });
  });

  describe('Feature Value Ranges', () => {
    it('produces values mostly in [0, 1] range', () => {
      const combatant = createMockCombatant({
        currentHp: 15,
        maxHp: 30,
        ac: 18,
        position: { x: 5, y: 5, z: 0 },
      });
      const enemy = createMockCombatant({
        id: 'enemy-1',
        groupId: 'enemies',
        position: { x: 8, y: 5, z: 0 },
      });
      const ally = createMockCombatant({
        id: 'ally-1',
        groupId: 'party',
        position: { x: 3, y: 5, z: 0 },
      });
      const state = createMockState([combatant, enemy, ally]);
      const budget = createMockBudget();
      const action = createMockAction();

      const stateFeatures = extractStateFeatures(combatant, state, budget);
      const actionFeatures = extractActionFeatures(action, enemy, combatant, state);
      const combined = combineFeatures(stateFeatures, actionFeatures);

      // Most values should be in [0, 1], allow some > 1 for damage/counts
      const inRange = combined.filter(v => v >= 0 && v <= 1.5);
      expect(inRange.length).toBeGreaterThanOrEqual(combined.length * 0.9);
    });
  });
});
