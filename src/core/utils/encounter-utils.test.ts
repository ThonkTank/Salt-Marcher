/**
 * Tests for encounter-utils utilities.
 * Task #2718: encounter-utils (resolveCreatureSlots, calculateEncounterXP, checkTriggers)
 */

import { describe, it, expect } from 'vitest';
import {
  checkTriggers,
  resolveCreatureSlots,
  compareCR,
  rollDifficulty,
  filterEligibleCreatures,
  calculateTypeWeights,
  createDefaultTypeMatrix,
  normalizeMatrix,
  calculateXPBudget,
  calculateEncounterXP,
  generateEncounterId,
  type TypeProbabilityMatrix,
  type EncounterHistoryEntry,
  // Task #207: Type derivation with faction relation
  isWinnable,
  getTypeProbabilities,
  deriveEncounterType,
  type FactionRelation,
  // Detection functions (Task #2951)
  getTimeVisibilityModifier,
  calculateVisualRange,
  calculateAudioRange,
  calculateScentRange,
  applyStealthAbilities,
  calculateDetection,
  calculateInitialDistance,
  type TerrainForDetection,
  type WeatherForDetection,
} from './encounter-utils';
import type { CreatureDefinition, EncounterTriggers, CreatureSlot } from '@core/schemas';

// =============================================================================
// Test Fixtures
// =============================================================================

const createMockCreature = (
  overrides: Partial<CreatureDefinition> = {}
): CreatureDefinition => ({
  id: 'creature-goblin' as CreatureDefinition['id'],
  name: 'Goblin',
  cr: 0.25,
  maxHp: 7,
  ac: 15,
  size: 'small',
  tags: ['humanoid', 'goblinoid'],
  disposition: 'hostile',
  terrainAffinities: ['terrain-forest' as never, 'terrain-cave' as never],
  activeTime: ['dawn', 'dusk', 'night'],
  lootTags: ['goblin', 'poor'],
  abilities: { str: 8, dex: 14, con: 10, int: 10, wis: 8, cha: 8 },
  speed: { walk: 30 },
  languages: ['Common', 'Goblin'],
  actions: ['Scimitar', 'Shortbow'],
  ...overrides,
});

// =============================================================================
// #2718 checkTriggers Tests
// =============================================================================

describe('#2718 checkTriggers', () => {
  it('returns true when no triggers defined', () => {
    const result = checkTriggers(undefined, {
      terrainId: 'terrain-forest',
      timeSegment: 'morning',
    });
    expect(result).toBe(true);
  });

  it('returns true when empty triggers object', () => {
    const triggers: EncounterTriggers = {};
    const result = checkTriggers(triggers, {
      terrainId: 'terrain-forest',
      timeSegment: 'morning',
    });
    expect(result).toBe(true);
  });

  describe('terrain trigger', () => {
    it('returns true when terrain matches', () => {
      const triggers: EncounterTriggers = {
        terrain: ['terrain-forest' as never, 'terrain-swamp' as never],
      };
      const result = checkTriggers(triggers, {
        terrainId: 'terrain-forest',
        timeSegment: 'morning',
      });
      expect(result).toBe(true);
    });

    it('returns false when terrain does not match', () => {
      const triggers: EncounterTriggers = {
        terrain: ['terrain-desert' as never],
      };
      const result = checkTriggers(triggers, {
        terrainId: 'terrain-forest',
        timeSegment: 'morning',
      });
      expect(result).toBe(false);
    });
  });

  describe('timeOfDay trigger', () => {
    it('returns true when time segment matches', () => {
      const triggers: EncounterTriggers = {
        timeOfDay: ['dawn', 'dusk'],
      };
      const result = checkTriggers(triggers, {
        terrainId: 'terrain-forest',
        timeSegment: 'dawn',
      });
      expect(result).toBe(true);
    });

    it('returns false when time segment does not match', () => {
      const triggers: EncounterTriggers = {
        timeOfDay: ['night'],
      };
      const result = checkTriggers(triggers, {
        terrainId: 'terrain-forest',
        timeSegment: 'morning',
      });
      expect(result).toBe(false);
    });
  });

  describe('partyLevelRange trigger', () => {
    it('returns true when party level is within range', () => {
      const triggers: EncounterTriggers = {
        partyLevelRange: { min: 3, max: 7 },
      };
      const result = checkTriggers(triggers, {
        terrainId: 'terrain-forest',
        timeSegment: 'morning',
        partyLevel: 5,
      });
      expect(result).toBe(true);
    });

    it('returns false when party level is below min', () => {
      const triggers: EncounterTriggers = {
        partyLevelRange: { min: 5 },
      };
      const result = checkTriggers(triggers, {
        terrainId: 'terrain-forest',
        timeSegment: 'morning',
        partyLevel: 3,
      });
      expect(result).toBe(false);
    });

    it('returns false when party level is above max', () => {
      const triggers: EncounterTriggers = {
        partyLevelRange: { max: 5 },
      };
      const result = checkTriggers(triggers, {
        terrainId: 'terrain-forest',
        timeSegment: 'morning',
        partyLevel: 8,
      });
      expect(result).toBe(false);
    });

    it('ignores level check when partyLevel not provided', () => {
      const triggers: EncounterTriggers = {
        partyLevelRange: { min: 5, max: 10 },
      };
      const result = checkTriggers(triggers, {
        terrainId: 'terrain-forest',
        timeSegment: 'morning',
        // partyLevel not provided
      });
      expect(result).toBe(true);
    });
  });

  describe('combined triggers', () => {
    it('returns true only when all triggers match', () => {
      const triggers: EncounterTriggers = {
        terrain: ['terrain-forest' as never],
        timeOfDay: ['night'],
        partyLevelRange: { min: 1, max: 5 },
      };

      // All match
      expect(
        checkTriggers(triggers, {
          terrainId: 'terrain-forest',
          timeSegment: 'night',
          partyLevel: 3,
        })
      ).toBe(true);

      // Terrain mismatch
      expect(
        checkTriggers(triggers, {
          terrainId: 'terrain-desert',
          timeSegment: 'night',
          partyLevel: 3,
        })
      ).toBe(false);

      // Time mismatch
      expect(
        checkTriggers(triggers, {
          terrainId: 'terrain-forest',
          timeSegment: 'morning',
          partyLevel: 3,
        })
      ).toBe(false);
    });
  });
});

// =============================================================================
// #2718 resolveCreatureSlots Tests
// =============================================================================

describe('#2718 resolveCreatureSlots', () => {
  const goblin = createMockCreature({ id: 'creature-goblin' as never, name: 'Goblin', cr: 0.25 });
  const hobgoblin = createMockCreature({ id: 'creature-hobgoblin' as never, name: 'Hobgoblin', cr: 0.5 });
  const orc = createMockCreature({ id: 'creature-orc' as never, name: 'Orc', cr: 0.5 });
  const creatures = [goblin, hobgoblin, orc];

  describe('concrete slots', () => {
    it('resolves concrete slot to specific creature', () => {
      const slots: CreatureSlot[] = [
        { slotType: 'concrete', creatureId: 'creature-goblin' as never, count: 2 },
      ];

      const result = resolveCreatureSlots(slots, creatures);

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Goblin');
      expect(result[1].name).toBe('Goblin');
    });

    it('returns empty for non-existent creature', () => {
      const slots: CreatureSlot[] = [
        { slotType: 'concrete', creatureId: 'creature-dragon' as never, count: 1 },
      ];

      const result = resolveCreatureSlots(slots, creatures);

      expect(result).toHaveLength(0);
    });
  });

  describe('typed slots', () => {
    it('resolves typed slot with fixed count', () => {
      const slots: CreatureSlot[] = [
        { slotType: 'typed', creatureId: 'creature-hobgoblin' as never, count: 3 },
      ];

      const result = resolveCreatureSlots(slots, creatures);

      expect(result).toHaveLength(3);
      result.forEach((c) => expect(c.name).toBe('Hobgoblin'));
    });

    it('resolves typed slot with count range', () => {
      const slots: CreatureSlot[] = [
        { slotType: 'typed', creatureId: 'creature-orc' as never, count: { min: 2, max: 4 } },
      ];

      const result = resolveCreatureSlots(slots, creatures);

      expect(result.length).toBeGreaterThanOrEqual(2);
      expect(result.length).toBeLessThanOrEqual(4);
      result.forEach((c) => expect(c.name).toBe('Orc'));
    });
  });

  describe('budget slots', () => {
    it('fills budget with creatures', () => {
      const slots: CreatureSlot[] = [
        { slotType: 'budget', xpBudget: 100 },
      ];

      const result = resolveCreatureSlots(slots, creatures);

      // Should have at least one creature
      expect(result.length).toBeGreaterThan(0);
    });

    it('respects CR range constraint', () => {
      const slots: CreatureSlot[] = [
        {
          slotType: 'budget',
          xpBudget: 200,
          constraints: {
            crRange: { min: 0.5, max: 1 },
          },
        },
      ];

      // Only hobgoblin and orc have CR 0.5
      const result = resolveCreatureSlots(slots, creatures);

      result.forEach((c) => {
        expect(c.cr).toBeGreaterThanOrEqual(0.5);
      });
    });

    it('respects creatureTypes constraint (checks tags)', () => {
      const elf = createMockCreature({
        id: 'creature-elf' as never,
        name: 'Elf',
        tags: ['humanoid', 'elf'],
        cr: 0.25,
      });
      const creaturesWithElf = [...creatures, elf];

      const slots: CreatureSlot[] = [
        {
          slotType: 'budget',
          xpBudget: 100,
          constraints: {
            creatureTypes: ['elf'],
          },
        },
      ];

      const result = resolveCreatureSlots(slots, creaturesWithElf);

      // All creatures should have 'elf' tag
      result.forEach((c) => {
        expect(c.tags).toContain('elf');
      });
    });
  });

  describe('multiple slots', () => {
    it('resolves multiple slots in order', () => {
      const slots: CreatureSlot[] = [
        { slotType: 'concrete', creatureId: 'creature-hobgoblin' as never, count: 1 },
        { slotType: 'typed', creatureId: 'creature-goblin' as never, count: 3 },
      ];

      const result = resolveCreatureSlots(slots, creatures);

      expect(result).toHaveLength(4);
      expect(result[0].name).toBe('Hobgoblin');
      expect(result[1].name).toBe('Goblin');
    });
  });
});

// =============================================================================
// compareCR Tests
// =============================================================================

describe('#2718 compareCR', () => {
  it('returns trivial for very low CR', () => {
    expect(compareCR(0.25, 5)).toBe('trivial'); // 0.05 ratio
    expect(compareCR(1, 5)).toBe('trivial'); // 0.2 ratio
  });

  it('returns manageable for fair fights', () => {
    expect(compareCR(2, 4)).toBe('manageable'); // 0.5 ratio
    expect(compareCR(5, 5)).toBe('manageable'); // 1.0 ratio
    expect(compareCR(6, 4)).toBe('manageable'); // 1.5 ratio
  });

  it('returns deadly for dangerous fights', () => {
    expect(compareCR(8, 4)).toBe('deadly'); // 2.0 ratio
    expect(compareCR(12, 4)).toBe('deadly'); // 3.0 ratio
  });

  it('returns impossible for overwhelming fights', () => {
    expect(compareCR(16, 4)).toBe('impossible'); // 4.0 ratio
    expect(compareCR(20, 3)).toBe('impossible'); // 6.67 ratio
  });

  it('handles party level 0 by using 1', () => {
    expect(compareCR(0.5, 0)).toBe('manageable');
  });
});

// =============================================================================
// #207 isWinnable Tests
// =============================================================================

describe('#207 isWinnable', () => {
  it('returns true for manageable encounters', () => {
    expect(isWinnable('manageable')).toBe(true);
  });

  it('returns true for deadly encounters', () => {
    expect(isWinnable('deadly')).toBe(true);
  });

  it('returns false for trivial encounters', () => {
    expect(isWinnable('trivial')).toBe(false);
  });

  it('returns false for impossible encounters', () => {
    expect(isWinnable('impossible')).toBe(false);
  });
});

// =============================================================================
// #207 getTypeProbabilities Tests (3-parameter version)
// =============================================================================

describe('#207 getTypeProbabilities', () => {
  describe('hostile disposition + hostile faction', () => {
    it('returns high combat for winnable encounters', () => {
      const probs = getTypeProbabilities('hostile', 'hostile', true);
      expect(probs.combat).toBe(0.8);
      expect(probs.social).toBe(0.05);
      expect(probs.passing).toBe(0.1);
      expect(probs.trace).toBe(0.05);
    });

    it('returns low combat for unwinnable encounters', () => {
      const probs = getTypeProbabilities('hostile', 'hostile', false);
      expect(probs.combat).toBe(0.05);
      expect(probs.social).toBe(0.05);
      expect(probs.passing).toBe(0.7);
      expect(probs.trace).toBe(0.2);
    });
  });

  describe('hostile disposition + neutral/friendly faction', () => {
    it('returns moderate combat for winnable encounters', () => {
      const probs = getTypeProbabilities('hostile', 'neutral', true);
      expect(probs.combat).toBe(0.6);
      expect(probs.social).toBe(0.1);
      expect(probs.passing).toBe(0.2);
      expect(probs.trace).toBe(0.1);
    });

    it('returns low combat for unwinnable encounters', () => {
      const probs = getTypeProbabilities('hostile', 'neutral', false);
      expect(probs.combat).toBe(0.05);
      expect(probs.social).toBe(0.1);
      expect(probs.passing).toBe(0.65);
      expect(probs.trace).toBe(0.2);
    });

    it('uses same probabilities for friendly faction as neutral', () => {
      const neutralProbs = getTypeProbabilities('hostile', 'neutral', true);
      const friendlyProbs = getTypeProbabilities('hostile', 'friendly', true);
      expect(friendlyProbs).toEqual(neutralProbs);
    });
  });

  describe('neutral disposition', () => {
    it('returns balanced probabilities regardless of faction', () => {
      const probs = getTypeProbabilities('neutral', 'hostile', true);
      expect(probs.combat).toBe(0.1);
      expect(probs.social).toBe(0.5);
      expect(probs.passing).toBe(0.25);
      expect(probs.trace).toBe(0.15);
    });

    it('ignores winnable flag for neutral creatures', () => {
      const winnableProbs = getTypeProbabilities('neutral', 'neutral', true);
      const unwinnableProbs = getTypeProbabilities('neutral', 'neutral', false);
      expect(winnableProbs).toEqual(unwinnableProbs);
    });
  });

  describe('friendly disposition', () => {
    it('returns zero combat probability', () => {
      const probs = getTypeProbabilities('friendly', 'friendly', true);
      expect(probs.combat).toBe(0.0);
      expect(probs.social).toBe(0.7);
      expect(probs.passing).toBe(0.2);
      expect(probs.trace).toBe(0.1);
    });

    it('ignores faction and winnable for friendly creatures', () => {
      const hostile = getTypeProbabilities('friendly', 'hostile', false);
      const friendly = getTypeProbabilities('friendly', 'friendly', true);
      expect(hostile).toEqual(friendly);
    });
  });

  it('all probabilities sum to 1.0', () => {
    const testCases: Array<['hostile' | 'neutral' | 'friendly', FactionRelation, boolean]> = [
      ['hostile', 'hostile', true],
      ['hostile', 'hostile', false],
      ['hostile', 'neutral', true],
      ['neutral', 'neutral', true],
      ['friendly', 'friendly', true],
    ];

    for (const [disposition, faction, winnable] of testCases) {
      const probs = getTypeProbabilities(disposition, faction, winnable);
      const sum = probs.combat + probs.social + probs.passing + probs.trace;
      expect(sum).toBeCloseTo(1.0);
    }
  });
});

// =============================================================================
// #207 deriveEncounterType Tests (with faction relation)
// =============================================================================

describe('#207 deriveEncounterType', () => {
  const hostileCreature = createMockCreature({
    disposition: 'hostile',
    cr: 2, // manageable for level 3-4 party
  });

  const friendlyCreature = createMockCreature({
    disposition: 'friendly',
    cr: 1,
  });

  describe('without faction relation (backwards compatibility)', () => {
    it('uses neutral as default faction relation', () => {
      const result = deriveEncounterType(hostileCreature, 4);
      // Should work without faction relation parameter
      expect(['combat', 'social', 'passing', 'trace']).toContain(result.type);
      expect(result.reason).toContain('neutral');
    });
  });

  describe('with faction relation', () => {
    it('includes faction relation in reason', () => {
      const result = deriveEncounterType(hostileCreature, 4, 'hostile');
      expect(result.reason).toContain('hostile');
      expect(result.reason).toContain('winnable');
    });

    it('reflects unwinnable in reason for impossible CR', () => {
      const strongCreature = createMockCreature({
        disposition: 'hostile',
        cr: 15,
      });
      const result = deriveEncounterType(strongCreature, 3, 'hostile');
      expect(result.reason).toContain('unwinnable');
    });

    it('never returns combat for friendly creatures', () => {
      for (let i = 0; i < 50; i++) {
        const result = deriveEncounterType(friendlyCreature, 4, 'friendly');
        expect(result.type).not.toBe('combat');
      }
    });

    it('returns correct crComparison', () => {
      // Trivial: CR 0.25 vs level 10 = 0.025 ratio
      const trivialCreature = createMockCreature({ disposition: 'hostile', cr: 0.25 });
      expect(deriveEncounterType(trivialCreature, 10, 'neutral').crComparison).toBe('trivial');

      // Manageable: CR 2 vs level 4 = 0.5 ratio
      expect(deriveEncounterType(hostileCreature, 4, 'neutral').crComparison).toBe('manageable');

      // Impossible: CR 15 vs level 3 = 5.0 ratio
      const impossibleCreature = createMockCreature({ disposition: 'hostile', cr: 15 });
      expect(deriveEncounterType(impossibleCreature, 3, 'neutral').crComparison).toBe('impossible');
    });
  });

  describe('faction relation impact on probabilities', () => {
    it('hostile faction increases combat probability for hostile creatures', () => {
      // This is a statistical test - run many times
      let hostileCombatCount = 0;
      let neutralCombatCount = 0;

      for (let i = 0; i < 500; i++) {
        if (deriveEncounterType(hostileCreature, 4, 'hostile').type === 'combat') {
          hostileCombatCount++;
        }
        if (deriveEncounterType(hostileCreature, 4, 'neutral').type === 'combat') {
          neutralCombatCount++;
        }
      }

      // Hostile faction should result in more combat (80% vs 60%)
      expect(hostileCombatCount).toBeGreaterThan(neutralCombatCount);
    });
  });
});

// =============================================================================
// rollDifficulty Tests
// =============================================================================

describe('#2718 rollDifficulty', () => {
  it('returns a valid difficulty', () => {
    for (let i = 0; i < 100; i++) {
      const result = rollDifficulty();
      expect(['easy', 'medium', 'hard', 'deadly']).toContain(result);
    }
  });
});

// =============================================================================
// filterEligibleCreatures Tests
// =============================================================================

describe('#2718 filterEligibleCreatures', () => {
  const dayCreature = createMockCreature({
    id: 'creature-daybird' as never,
    activeTime: ['morning', 'midday', 'afternoon'],
    terrainAffinities: ['terrain-forest' as never],
  });

  const nightCreature = createMockCreature({
    id: 'creature-nightowl' as never,
    activeTime: ['dusk', 'night'],
    terrainAffinities: ['terrain-forest' as never],
  });

  const desertCreature = createMockCreature({
    id: 'creature-scorpion' as never,
    activeTime: ['morning', 'midday'],
    terrainAffinities: ['terrain-desert' as never],
  });

  const creatures = [dayCreature, nightCreature, desertCreature];

  it('filters by terrain', () => {
    const result = filterEligibleCreatures(creatures, 'terrain-forest', 'morning');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('creature-daybird');
  });

  it('filters by time segment', () => {
    const result = filterEligibleCreatures(creatures, 'terrain-forest', 'night');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('creature-nightowl');
  });

  it('returns empty when no match', () => {
    const result = filterEligibleCreatures(creatures, 'terrain-mountain', 'morning');
    expect(result).toHaveLength(0);
  });

  it('requires both terrain AND time to match', () => {
    const result = filterEligibleCreatures(creatures, 'terrain-desert', 'night');
    expect(result).toHaveLength(0);
  });
});

// =============================================================================
// calculateTypeWeights Tests (Task #209)
// =============================================================================

describe('#209 calculateTypeWeights', () => {
  it('returns normalized base matrix for empty history', () => {
    const baseMatrix: TypeProbabilityMatrix = {
      combat: 0.4,
      social: 0.3,
      passing: 0.2,
      trace: 0.1,
    };
    const result = calculateTypeWeights([], baseMatrix);

    // Should be normalized to sum to 1.0
    const sum = result.combat + result.social + result.passing + result.trace;
    expect(sum).toBeCloseTo(1.0);
  });

  it('applies exponential decay to recent encounters', () => {
    const baseMatrix = createDefaultTypeMatrix();
    const history: EncounterHistoryEntry[] = [
      { type: 'combat', sequence: 3 },
      { type: 'combat', sequence: 2 },
      { type: 'combat', sequence: 1 },
    ];

    const result = calculateTypeWeights(history, baseMatrix);

    // Combat weight: 1.0 + 0.5 + 0.25 = 1.75 > 1.5 threshold
    // Should be dampened
    expect(result.combat).toBeLessThan(baseMatrix.combat);
  });

  it('does not dampen types below threshold', () => {
    const baseMatrix = createDefaultTypeMatrix();
    const history: EncounterHistoryEntry[] = [
      { type: 'combat', sequence: 1 },
    ];

    const result = calculateTypeWeights(history, baseMatrix);

    // Combat weight: 1.0 (exactly at threshold, no dampening)
    // Other types should remain relatively similar
    const sum = result.combat + result.social + result.passing + result.trace;
    expect(sum).toBeCloseTo(1.0);
  });

  it('normalizes output to sum to 1.0', () => {
    const baseMatrix: TypeProbabilityMatrix = {
      combat: 1.0,
      social: 1.0,
      passing: 1.0,
      trace: 1.0,
    };
    const history: EncounterHistoryEntry[] = [
      { type: 'combat', sequence: 3 },
      { type: 'combat', sequence: 2 },
      { type: 'social', sequence: 1 },
    ];

    const result = calculateTypeWeights(history, baseMatrix);

    const sum = result.combat + result.social + result.passing + result.trace;
    expect(sum).toBeCloseTo(1.0);
  });
});

describe('#209 createDefaultTypeMatrix', () => {
  it('creates matrix with equal probabilities', () => {
    const matrix = createDefaultTypeMatrix();

    expect(matrix.combat).toBe(0.25);
    expect(matrix.social).toBe(0.25);
    expect(matrix.passing).toBe(0.25);
    expect(matrix.trace).toBe(0.25);
  });
});

describe('#209 normalizeMatrix', () => {
  it('normalizes matrix to sum to 1.0', () => {
    const matrix: TypeProbabilityMatrix = {
      combat: 2,
      social: 2,
      passing: 2,
      trace: 2,
    };

    const result = normalizeMatrix(matrix);

    expect(result.combat).toBe(0.25);
    expect(result.social).toBe(0.25);
    expect(result.passing).toBe(0.25);
    expect(result.trace).toBe(0.25);
  });

  it('returns default matrix for zero-sum input', () => {
    const matrix: TypeProbabilityMatrix = {
      combat: 0,
      social: 0,
      passing: 0,
      trace: 0,
    };

    const result = normalizeMatrix(matrix);

    expect(result.combat).toBe(0.25);
    expect(result.social).toBe(0.25);
  });
});

// =============================================================================
// calculateXPBudget Tests
// =============================================================================

describe('#2718 calculateXPBudget', () => {
  it('calculates budget for easy difficulty', () => {
    const party = [{ level: 5 }, { level: 5 }, { level: 5 }, { level: 5 }];
    const result = calculateXPBudget(party, 'easy');
    expect(result).toBe(500); // 4 × 5 × 25
  });

  it('calculates budget for medium difficulty', () => {
    const party = [{ level: 5 }, { level: 5 }, { level: 5 }, { level: 5 }];
    const result = calculateXPBudget(party, 'medium');
    expect(result).toBe(1000); // 4 × 5 × 50
  });

  it('calculates budget for hard difficulty', () => {
    const party = [{ level: 5 }, { level: 5 }, { level: 5 }, { level: 5 }];
    const result = calculateXPBudget(party, 'hard');
    expect(result).toBe(1500); // 4 × 5 × 75
  });

  it('calculates budget for deadly difficulty', () => {
    const party = [{ level: 5 }, { level: 5 }, { level: 5 }, { level: 5 }];
    const result = calculateXPBudget(party, 'deadly');
    expect(result).toBe(2000); // 4 × 5 × 100
  });

  it('handles mixed party levels', () => {
    const party = [{ level: 3 }, { level: 5 }, { level: 7 }];
    const result = calculateXPBudget(party, 'medium');
    expect(result).toBe(750); // (3 + 5 + 7) × 50
  });
});

// =============================================================================
// calculateEncounterXP Tests
// =============================================================================

describe('#2718 calculateEncounterXP', () => {
  it('calculates total XP for creatures', () => {
    const creatures = [
      createMockCreature({ cr: 0.25 }), // 50 XP
      createMockCreature({ cr: 0.5 }), // 100 XP
      createMockCreature({ cr: 1 }), // 200 XP
    ];

    const result = calculateEncounterXP(creatures);

    expect(result).toBe(350);
  });

  it('returns 0 for empty array', () => {
    expect(calculateEncounterXP([])).toBe(0);
  });
});

// =============================================================================
// generateEncounterId Tests
// =============================================================================

describe('#2718 generateEncounterId', () => {
  it('generates unique IDs', () => {
    const id1 = generateEncounterId();
    const id2 = generateEncounterId();

    expect(id1).not.toBe(id2);
    expect(id1).toMatch(/^enc-\d+-[a-z0-9]+$/);
  });
});

// =============================================================================
// #210 deriveEncounterTypeWithVariety Tests
// =============================================================================

import { deriveEncounterTypeWithVariety } from './encounter-utils';

describe('#210 deriveEncounterTypeWithVariety', () => {
  const hostileCreature = createMockCreature({
    disposition: 'hostile',
    cr: 1, // manageable for level 3-4 party
  });

  const friendlyCreature = createMockCreature({
    disposition: 'friendly',
    cr: 0.5,
  });

  describe('without history (empty array)', () => {
    it('returns valid encounter type', () => {
      const result = deriveEncounterTypeWithVariety(hostileCreature, 4, []);

      expect(['combat', 'social', 'passing', 'trace']).toContain(result.type);
      expect(result.crComparison).toBe('manageable');
    });

    it('does not include "dampened" in reason when no history', () => {
      const result = deriveEncounterTypeWithVariety(hostileCreature, 4, []);

      expect(result.reason).not.toContain('dampened');
    });
  });

  describe('with history (variety dampening)', () => {
    it('includes "dampened" in reason when history is present', () => {
      const history: EncounterHistoryEntry[] = [
        { type: 'combat', sequence: 1 },
      ];

      const result = deriveEncounterTypeWithVariety(hostileCreature, 4, history);

      expect(result.reason).toContain('dampened');
    });

    it('still returns valid encounter type with heavy combat history', () => {
      // 3x combat in a row should dampen combat probability
      const heavyCombatHistory: EncounterHistoryEntry[] = [
        { type: 'combat', sequence: 3 },
        { type: 'combat', sequence: 2 },
        { type: 'combat', sequence: 1 },
      ];

      // Run multiple times to verify we still get valid types
      for (let i = 0; i < 20; i++) {
        const result = deriveEncounterTypeWithVariety(hostileCreature, 4, heavyCombatHistory);
        expect(['combat', 'social', 'passing', 'trace']).toContain(result.type);
      }
    });

    it('uses CR comparison correctly', () => {
      // Trivial CR for party level 10
      const result = deriveEncounterTypeWithVariety(hostileCreature, 10, []);
      expect(result.crComparison).toBe('trivial');

      // Deadly CR for party level 1
      const result2 = deriveEncounterTypeWithVariety(
        createMockCreature({ cr: 4, disposition: 'hostile' }),
        1,
        []
      );
      expect(result2.crComparison).toBe('impossible');
    });
  });

  describe('friendly creatures', () => {
    it('never returns combat for friendly creatures', () => {
      // Friendly creatures have 0% combat probability
      for (let i = 0; i < 50; i++) {
        const result = deriveEncounterTypeWithVariety(friendlyCreature, 4, []);
        expect(result.type).not.toBe('combat');
      }
    });
  });

  describe('party level handling', () => {
    it('handles undefined party level by using 1', () => {
      const result = deriveEncounterTypeWithVariety(hostileCreature, undefined, []);

      // CR 1 vs level 1 = manageable (ratio 1.0)
      expect(result.crComparison).toBe('manageable');
    });
  });

  describe('faction relation (Task #207)', () => {
    it('accepts optional faction relation parameter', () => {
      // Should work with 4 parameters
      const result = deriveEncounterTypeWithVariety(hostileCreature, 4, [], 'hostile');
      expect(['combat', 'social', 'passing', 'trace']).toContain(result.type);
    });

    it('defaults to neutral when faction relation not provided', () => {
      const result = deriveEncounterTypeWithVariety(hostileCreature, 4, []);
      expect(result.reason).toContain('neutral');
    });

    it('includes faction relation in reason', () => {
      const result = deriveEncounterTypeWithVariety(hostileCreature, 4, [], 'hostile');
      expect(result.reason).toContain('hostile');
    });

    it('hostile faction increases combat chance for hostile creatures', () => {
      // Statistical test
      let hostileCombatCount = 0;
      let neutralCombatCount = 0;

      for (let i = 0; i < 300; i++) {
        if (deriveEncounterTypeWithVariety(hostileCreature, 4, [], 'hostile').type === 'combat') {
          hostileCombatCount++;
        }
        if (deriveEncounterTypeWithVariety(hostileCreature, 4, [], 'neutral').type === 'combat') {
          neutralCombatCount++;
        }
      }

      // Hostile faction: 80% combat, Neutral faction: 60% combat
      expect(hostileCombatCount).toBeGreaterThan(neutralCombatCount);
    });

    it('variety dampening works with faction relation', () => {
      const history: EncounterHistoryEntry[] = [
        { type: 'combat', sequence: 3 },
        { type: 'combat', sequence: 2 },
        { type: 'combat', sequence: 1 },
      ];

      const result = deriveEncounterTypeWithVariety(hostileCreature, 4, history, 'hostile');
      expect(result.reason).toContain('dampened');
    });
  });
});

// =============================================================================
// #2951 Multi-Sense Detection System Tests
// =============================================================================

describe('#2951 getTimeVisibilityModifier', () => {
  const baseWeather: WeatherForDetection = {
    visibilityModifier: 1.0,
    precipitation: 0,
    windStrength: 0,
    cloudCover: 0,
    moonPhase: 'full',
  };

  describe('daytime segments', () => {
    it('returns full visibility at midday with clear sky', () => {
      const modifier = getTimeVisibilityModifier('midday', baseWeather);
      expect(modifier).toBe(1.0);
    });

    it('returns full visibility for morning and afternoon', () => {
      expect(getTimeVisibilityModifier('morning', baseWeather)).toBe(1.0);
      expect(getTimeVisibilityModifier('afternoon', baseWeather)).toBe(1.0);
    });

    it('reduces visibility with cloud cover during day', () => {
      const cloudyWeather = { ...baseWeather, cloudCover: 1.0 };
      // 1.0 * (1 - 1.0 * 0.3) = 0.7
      expect(getTimeVisibilityModifier('midday', cloudyWeather)).toBeCloseTo(0.7);
    });
  });

  describe('twilight segments', () => {
    it('returns reduced visibility at dawn', () => {
      const modifier = getTimeVisibilityModifier('dawn', baseWeather);
      // 0.6 base + moonlight effect
      expect(modifier).toBeGreaterThan(0.5);
      expect(modifier).toBeLessThan(1.0);
    });

    it('returns reduced visibility at dusk', () => {
      const modifier = getTimeVisibilityModifier('dusk', baseWeather);
      expect(modifier).toBeGreaterThan(0.5);
      expect(modifier).toBeLessThan(1.0);
    });
  });

  describe('night segment', () => {
    it('returns low visibility at night without moonlight', () => {
      const noMoonWeather = { ...baseWeather, moonPhase: 'new' as const };
      const modifier = getTimeVisibilityModifier('night', noMoonWeather);
      expect(modifier).toBeCloseTo(0.1);
    });

    it('increases visibility with full moon', () => {
      const fullMoonWeather = { ...baseWeather, moonPhase: 'full' as const };
      const modifier = getTimeVisibilityModifier('night', fullMoonWeather);
      // 0.1 + 0.3 * (1 - 0) = 0.4
      expect(modifier).toBeCloseTo(0.4);
    });

    it('reduces moonlight effect with cloud cover', () => {
      const cloudyNight = { ...baseWeather, moonPhase: 'full' as const, cloudCover: 0.5 };
      const modifier = getTimeVisibilityModifier('night', cloudyNight);
      // 0.1 + 0.3 * (1 - 0.5) = 0.25
      expect(modifier).toBeCloseTo(0.25);
    });
  });
});

describe('#2951 calculateVisualRange', () => {
  const clearWeather: WeatherForDetection = {
    visibilityModifier: 1.0,
    precipitation: 0,
    windStrength: 0,
    cloudCover: 0,
    moonPhase: 'full',
  };

  const openTerrain: TerrainForDetection = {
    encounterVisibility: 1000,
  };

  it('calculates full range in clear conditions at midday', () => {
    const range = calculateVisualRange(openTerrain, clearWeather, 'midday');
    expect(range).toBe(1000);
  });

  it('reduces range with weather modifier', () => {
    const foggyWeather = { ...clearWeather, visibilityModifier: 0.5 };
    const range = calculateVisualRange(openTerrain, foggyWeather, 'midday');
    expect(range).toBe(500);
  });

  it('reduces range at night', () => {
    const noMoonWeather = { ...clearWeather, moonPhase: 'new' as const };
    const range = calculateVisualRange(openTerrain, noMoonWeather, 'night');
    // 1000 * 1.0 * 0.1 = 100
    expect(range).toBe(100);
  });

  it('floors the result', () => {
    const terrain: TerrainForDetection = { encounterVisibility: 333 };
    const weather = { ...clearWeather, visibilityModifier: 0.7 };
    const range = calculateVisualRange(terrain, weather, 'midday');
    expect(Number.isInteger(range)).toBe(true);
  });
});

describe('#2951 calculateAudioRange', () => {
  const calmWeather: WeatherForDetection = {
    visibilityModifier: 1.0,
    precipitation: 0,
    windStrength: 0,
    cloudCover: 0,
  };

  it('returns 0 for silent creatures', () => {
    expect(calculateAudioRange('silent', calmWeather)).toBe(0);
  });

  it('returns base range for quiet creatures in calm weather', () => {
    expect(calculateAudioRange('quiet', calmWeather)).toBe(30);
  });

  it('returns base range for normal creatures in calm weather', () => {
    expect(calculateAudioRange('normal', calmWeather)).toBe(60);
  });

  it('returns base range for loud creatures in calm weather', () => {
    expect(calculateAudioRange('loud', calmWeather)).toBe(200);
  });

  it('returns base range for deafening creatures in calm weather', () => {
    expect(calculateAudioRange('deafening', calmWeather)).toBe(500);
  });

  it('reduces range with wind', () => {
    const windyWeather = { ...calmWeather, windStrength: 0.6 };
    // Above 0.5 threshold = reduced
    expect(calculateAudioRange('normal', windyWeather)).toBe(30);
  });

  it('reduces range with rain', () => {
    const rainyWeather = { ...calmWeather, precipitation: 0.4 };
    // Above 0.3 threshold = reduced
    expect(calculateAudioRange('normal', rainyWeather)).toBe(30);
  });
});

describe('#2951 calculateScentRange', () => {
  const calmWeather: WeatherForDetection = {
    visibilityModifier: 1.0,
    precipitation: 0,
    windStrength: 0,
    cloudCover: 0,
  };

  it('returns 0 for scentless creatures', () => {
    expect(calculateScentRange('none', calmWeather)).toBe(0);
  });

  it('returns base range for faint scent in calm weather', () => {
    expect(calculateScentRange('faint', calmWeather)).toBe(30);
  });

  it('returns base range for moderate scent in calm weather', () => {
    expect(calculateScentRange('moderate', calmWeather)).toBe(60);
  });

  it('returns base range for strong scent in calm weather', () => {
    expect(calculateScentRange('strong', calmWeather)).toBe(150);
  });

  it('returns base range for overwhelming scent in calm weather', () => {
    expect(calculateScentRange('overwhelming', calmWeather)).toBe(300);
  });

  it('reduces range with wind', () => {
    const windyWeather = { ...calmWeather, windStrength: 0.6 };
    expect(calculateScentRange('moderate', windyWeather)).toBe(30);
  });

  it('eliminates faint scent with wind', () => {
    const windyWeather = { ...calmWeather, windStrength: 0.6 };
    expect(calculateScentRange('faint', windyWeather)).toBe(0);
  });
});

describe('#2951 applyStealthAbilities', () => {
  it('returns unchanged ranges for creature without stealth abilities', () => {
    const result = applyStealthAbilities(100, 60, 30, undefined);
    expect(result).toEqual({ visual: 100, audio: 60, scent: 30 });
  });

  it('returns unchanged ranges for empty stealth abilities', () => {
    const result = applyStealthAbilities(100, 60, 30, []);
    expect(result).toEqual({ visual: 100, audio: 60, scent: 30 });
  });

  it('eliminates visual detection for burrowing creatures', () => {
    const result = applyStealthAbilities(100, 60, 30, ['burrowing']);
    expect(result.visual).toBe(0);
    expect(result.audio).toBe(60);
    expect(result.scent).toBe(30);
  });

  it('eliminates visual detection for invisible creatures', () => {
    const result = applyStealthAbilities(100, 60, 30, ['invisibility']);
    expect(result.visual).toBe(0);
    expect(result.audio).toBe(60);
    expect(result.scent).toBe(30);
  });

  it('eliminates all detection for ethereal creatures', () => {
    const result = applyStealthAbilities(100, 60, 30, ['ethereal']);
    expect(result).toEqual({ visual: 0, audio: 0, scent: 0 });
  });

  it('handles multiple stealth abilities', () => {
    const result = applyStealthAbilities(100, 60, 30, ['burrowing', 'invisibility']);
    expect(result.visual).toBe(0);
    expect(result.audio).toBe(60);
  });
});

describe('#2951 calculateDetection', () => {
  const terrain: TerrainForDetection = { encounterVisibility: 500 };
  const clearWeather: WeatherForDetection = {
    visibilityModifier: 1.0,
    precipitation: 0,
    windStrength: 0,
    cloudCover: 0,
    moonPhase: 'full',
  };

  const createProfile = (
    noiseLevel: 'silent' | 'quiet' | 'normal' | 'loud' | 'deafening' = 'normal',
    scentStrength: 'none' | 'faint' | 'moderate' | 'strong' | 'overwhelming' = 'faint'
  ) => ({
    noiseLevel,
    scentStrength,
  });

  it('returns visual as primary method for visible creatures at day', () => {
    const result = calculateDetection(
      createProfile('normal', 'faint'),
      terrain,
      clearWeather,
      'midday'
    );
    expect(result.method).toBe('visual');
    expect(result.range).toBe(500);
  });

  it('uses audio detection at night for loud creatures', () => {
    const nightWeather = { ...clearWeather, moonPhase: 'new' as const };
    const result = calculateDetection(
      createProfile('loud', 'none'),
      terrain,
      nightWeather,
      'night'
    );
    // Visual: 500 * 1.0 * 0.1 = 50
    // Audio: 200 (loud)
    expect(result.method).toBe('auditory');
    expect(result.range).toBe(200);
  });

  it('uses scent detection for smelly but silent creatures', () => {
    const result = calculateDetection(
      createProfile('silent', 'strong'),
      { encounterVisibility: 100 },
      clearWeather,
      'midday'
    );
    // Visual: 100
    // Audio: 0 (silent)
    // Scent: 150 (strong)
    expect(result.method).toBe('olfactory');
    expect(result.range).toBe(150);
  });

  it('handles ethereal creatures returning 0 range', () => {
    const profile = {
      noiseLevel: 'loud' as const,
      scentStrength: 'strong' as const,
      stealthAbilities: ['ethereal' as const],
    };
    const result = calculateDetection(profile, terrain, clearWeather, 'midday');
    expect(result.range).toBe(0);
  });

  it('handles invisible creatures still detectable by audio', () => {
    const profile = {
      noiseLevel: 'deafening' as const,
      scentStrength: 'none' as const,
      stealthAbilities: ['invisibility' as const],
    };
    const result = calculateDetection(profile, terrain, clearWeather, 'midday');
    expect(result.method).toBe('auditory');
    expect(result.range).toBe(500);
  });
});

describe('#2951 calculateInitialDistance', () => {
  // Note: calculateInitialDistance takes (detectionRange: number, encounterType: EncounterType)
  // The encounter types are: combat, social, passing, trace
  // Not: random, ambush, lair, patrol, scripted (those are generation types)

  it('returns variable distance for combat encounter', () => {
    // Combat: 30-80% of detection range
    const distance = calculateInitialDistance(300, 'combat');
    expect(distance).toBeGreaterThanOrEqual(90); // 300 * 0.3
    expect(distance).toBeLessThanOrEqual(240); // 300 * 0.8
  });

  it('returns variable distance for social encounter', () => {
    // Social: 50-100% of detection range
    const distance = calculateInitialDistance(300, 'social');
    expect(distance).toBeGreaterThanOrEqual(150); // 300 * 0.5
    expect(distance).toBeLessThanOrEqual(300); // 300 * 1.0
  });

  it('returns variable distance for passing encounter', () => {
    // Passing: 70-100% of detection range (observed from afar)
    const distance = calculateInitialDistance(300, 'passing');
    expect(distance).toBeGreaterThanOrEqual(210); // 300 * 0.7
    expect(distance).toBeLessThanOrEqual(300); // 300 * 1.0
  });

  it('returns fixed small distance for trace encounter', () => {
    // Trace: 10-30 feet (stumbled upon traces)
    const distance = calculateInitialDistance(300, 'trace');
    expect(distance).toBeGreaterThanOrEqual(10);
    expect(distance).toBeLessThanOrEqual(30);
  });

  it('floors the result for combat encounters', () => {
    // Using odd values to ensure flooring
    const distance = calculateInitialDistance(333, 'combat');
    expect(Number.isInteger(distance)).toBe(true);
  });

  it('floors the result for social encounters', () => {
    const distance = calculateInitialDistance(333, 'social');
    expect(Number.isInteger(distance)).toBe(true);
  });
});
