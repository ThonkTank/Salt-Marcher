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
  validateVariety,
  calculateXPBudget,
  calculateEncounterXP,
  generateEncounterId,
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
// validateVariety Tests
// =============================================================================

describe('#2718 validateVariety', () => {
  const goblin = createMockCreature({ id: 'creature-goblin' as never });

  it('returns valid when creature not in recent history', () => {
    const result = validateVariety(goblin, ['creature-orc', 'creature-wolf']);
    expect(result.valid).toBe(true);
  });

  it('returns invalid when creature in recent history', () => {
    const result = validateVariety(goblin, ['creature-goblin', 'creature-orc']);
    expect(result.valid).toBe(false);
    expect(result.rerollReason).toContain('Goblin');
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
