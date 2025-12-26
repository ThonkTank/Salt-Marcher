/**
 * Party Utils Tests
 */

import { describe, it, expect } from 'vitest';
import {
  getHealthCategory,
  calculateHealthSummary,
  createEmptyHealthSummary,
} from './party-utils';
import type { Character } from '@core/schemas';

// Helper to create a character with specific HP values
function createCharacter(
  currentHp: number,
  maxHp: number,
  name = 'Test'
): Character {
  return {
    id: `character:${name}` as Character['id'],
    name,
    level: 1,
    class: 'Fighter',
    maxHp,
    currentHp,
    ac: 15,
    speed: 30,
    strength: 10,
    wisdom: 10,
    inventory: [],
  };
}

describe('#2339 getHealthCategory', () => {
  it('returns "ok" when at full HP', () => {
    const char = createCharacter(20, 20);
    expect(getHealthCategory(char)).toBe('ok');
  });

  it('returns "wounded" when above 25% but below max', () => {
    // 50% HP
    const char50 = createCharacter(10, 20);
    expect(getHealthCategory(char50)).toBe('wounded');

    // 26% HP (just above threshold)
    const char26 = createCharacter(26, 100);
    expect(getHealthCategory(char26)).toBe('wounded');
  });

  it('returns "critical" when at or below 25%', () => {
    // Exactly 25%
    const char25 = createCharacter(25, 100);
    expect(getHealthCategory(char25)).toBe('critical');

    // 10% HP
    const char10 = createCharacter(2, 20);
    expect(getHealthCategory(char10)).toBe('critical');

    // 1 HP (but alive)
    const char1 = createCharacter(1, 100);
    expect(getHealthCategory(char1)).toBe('critical');
  });

  it('returns "down" when at 0 HP', () => {
    const char = createCharacter(0, 20);
    expect(getHealthCategory(char)).toBe('down');
  });

  it('returns "down" when below 0 HP', () => {
    const char = createCharacter(-5, 20);
    expect(getHealthCategory(char)).toBe('down');
  });
});

describe('#2339 calculateHealthSummary', () => {
  it('returns empty summary for no characters', () => {
    const summary = calculateHealthSummary([]);
    expect(summary.ok).toBe(0);
    expect(summary.wounded).toBe(0);
    expect(summary.critical).toBe(0);
    expect(summary.down).toBe(0);
    expect(summary.display).toBe('All OK');
  });

  it('returns "All OK" when all characters are at full HP', () => {
    const chars = [
      createCharacter(20, 20, 'Fighter'),
      createCharacter(15, 15, 'Wizard'),
    ];
    const summary = calculateHealthSummary(chars);
    expect(summary.ok).toBe(2);
    expect(summary.display).toBe('All OK');
  });

  it('counts wounded characters correctly', () => {
    const chars = [
      createCharacter(20, 20, 'Fighter'),
      createCharacter(15, 20, 'Rogue'), // wounded
    ];
    const summary = calculateHealthSummary(chars);
    expect(summary.ok).toBe(1);
    expect(summary.wounded).toBe(1);
    expect(summary.display).toBe('1 Wounded');
  });

  it('counts critical characters correctly', () => {
    const chars = [
      createCharacter(20, 20, 'Fighter'),
      createCharacter(5, 20, 'Wizard'), // 25% = critical
    ];
    const summary = calculateHealthSummary(chars);
    expect(summary.ok).toBe(1);
    expect(summary.critical).toBe(1);
    expect(summary.display).toBe('1 Critical');
  });

  it('counts down characters correctly', () => {
    const chars = [
      createCharacter(20, 20, 'Fighter'),
      createCharacter(0, 20, 'Cleric'), // down
    ];
    const summary = calculateHealthSummary(chars);
    expect(summary.ok).toBe(1);
    expect(summary.down).toBe(1);
    expect(summary.display).toBe('1 Down');
  });

  it('displays multiple categories in severity order', () => {
    const chars = [
      createCharacter(20, 20, 'Fighter'), // ok
      createCharacter(15, 20, 'Rogue'), // wounded
      createCharacter(3, 20, 'Wizard'), // critical
      createCharacter(0, 20, 'Cleric'), // down
    ];
    const summary = calculateHealthSummary(chars);
    expect(summary.ok).toBe(1);
    expect(summary.wounded).toBe(1);
    expect(summary.critical).toBe(1);
    expect(summary.down).toBe(1);
    expect(summary.display).toBe('1 Down, 1 Critical, 1 Wounded');
  });

  it('displays multiple of same category', () => {
    const chars = [
      createCharacter(0, 20, 'Fighter'),
      createCharacter(0, 20, 'Rogue'),
    ];
    const summary = calculateHealthSummary(chars);
    expect(summary.down).toBe(2);
    expect(summary.display).toBe('2 Down');
  });
});

describe('#2339 createEmptyHealthSummary', () => {
  it('returns summary with "No Party" display', () => {
    const summary = createEmptyHealthSummary();
    expect(summary.ok).toBe(0);
    expect(summary.wounded).toBe(0);
    expect(summary.critical).toBe(0);
    expect(summary.down).toBe(0);
    expect(summary.display).toBe('No Party');
  });
});
