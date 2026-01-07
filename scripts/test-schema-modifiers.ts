#!/usr/bin/env npx tsx
// Test script for schema-defined modifiers
// Run: npx tsx scripts/test-schema-modifiers.ts

import type { SchemaModifier } from '../src/types/entities/conditionExpression';
import type { ModifierContext, CombatantContext, ModifierSimulationState } from '../src/services/combatantAI/situationalModifiers';
import { createSchemaModifierEvaluator } from '../src/services/combatantAI/schemaModifierAdapter';
import type { Action } from '../src/types/entities';

// ============================================================================
// PACK TACTICS AS SCHEMA-DEFINED MODIFIER
// ============================================================================

/**
 * Pack Tactics defined via schema instead of hardcoded TypeScript.
 *
 * D&D 5e SRD: "Advantage on attack roll if at least one of the creature's
 * allies is within 5 feet of the target and the ally doesn't have the
 * Incapacitated condition."
 */
const packTacticsSchema: SchemaModifier = {
  id: 'pack-tactics-schema',
  name: 'Pack Tactics (Schema)',
  description: 'Advantage if non-incapacitated ally adjacent to target',
  condition: {
    type: 'exists',
    entity: {
      type: 'quantified',
      quantifier: 'any',
      filter: 'ally',
      relativeTo: 'attacker',
    },
    where: {
      type: 'and',
      conditions: [
        // Ally adjacent to target (5ft = 1 cell)
        { type: 'adjacent-to', subject: 'self', object: 'target' },
        // Ally is NOT incapacitated
        { type: 'is-incapacitated', entity: 'self', negate: true },
      ],
    },
  },
  effect: { advantage: true },
  priority: 7,
};

// ============================================================================
// LONG RANGE DISADVANTAGE AS SCHEMA-DEFINED MODIFIER
// ============================================================================

/**
 * Long Range Disadvantage defined via schema.
 * Demonstrates action-range predicates.
 */
const longRangeSchema: SchemaModifier = {
  id: 'long-range-schema',
  name: 'Long Range (Schema)',
  description: 'Disadvantage when target is in long range',
  condition: {
    type: 'target-in-long-range',
  },
  effect: { disadvantage: true },
  priority: 10,
};

// ============================================================================
// RANGED IN MELEE AS SCHEMA-DEFINED MODIFIER
// ============================================================================

/**
 * Ranged in Melee Disadvantage defined via schema.
 * Demonstrates combination of action and spatial predicates.
 */
const rangedInMeleeSchema: SchemaModifier = {
  id: 'ranged-in-melee-schema',
  name: 'Ranged Attack in Melee (Schema)',
  description: 'Disadvantage on ranged attacks when enemy is adjacent',
  condition: {
    type: 'and',
    conditions: [
      { type: 'action-range-type', rangeType: 'ranged' },
      {
        type: 'exists',
        entity: {
          type: 'quantified',
          quantifier: 'any',
          filter: 'enemy',
          relativeTo: 'attacker',
        },
        where: {
          type: 'adjacent-to',
          subject: 'self',
          object: 'attacker',
        },
      },
    ],
  },
  effect: { disadvantage: true },
  priority: 10,
};

// ============================================================================
// TEST HELPERS
// ============================================================================

function createTestAction(rangeType: 'reach' | 'ranged' = 'reach', normalRange = 5, longRange?: number): Action {
  return {
    id: 'test-action',
    name: 'Test Action',
    actionType: rangeType === 'ranged' ? 'ranged-weapon' : 'melee-weapon',
    timing: { type: 'action' },
    range: { type: rangeType, normal: normalRange, long: longRange },
    targeting: { type: 'single', validTargets: 'enemy' },
    attack: { bonus: 4 },
    damage: { dice: '1d6', modifier: 2, type: 'piercing' },
  };
}

function createCombatantContext(
  id: string,
  groupId: string,
  position: { x: number; y: number; z?: number },
  conditions: Array<{ name: string; effect?: string }> = []
): CombatantContext {
  return {
    participantId: id,
    groupId,
    position: { x: position.x, y: position.y, z: position.z ?? 0 },
    conditions: conditions.map(c => ({ name: c.name, effect: c.effect ?? c.name, remainingRounds: -1 })),
    ac: 15,
    hp: 20,
  };
}

function createModifierContext(
  attacker: CombatantContext,
  target: CombatantContext,
  action: Action,
  additionalProfiles: CombatantContext[] = []
): ModifierContext {
  const state: ModifierSimulationState = {
    profiles: [attacker, target, ...additionalProfiles],
    alliances: {
      [attacker.groupId]: [attacker.groupId], // Self-allied
      [target.groupId]: [target.groupId],
    },
  };

  return {
    attacker,
    target,
    action,
    state,
  };
}

// ============================================================================
// TEST RUNNER
// ============================================================================

let testsPassed = 0;
let totalTests = 0;

function test(name: string, condition: boolean) {
  totalTests++;
  const result = condition ? '✓' : '✗';
  if (condition) testsPassed++;
  console.log(`  ${result} ${name}`);
}

// ============================================================================
// PACK TACTICS TESTS
// ============================================================================

console.log('\n=== Pack Tactics (Schema) Tests ===\n');

const packTacticsEvaluator = createSchemaModifierEvaluator(packTacticsSchema);
console.log(`Created evaluator: ${packTacticsEvaluator.name}`);
console.log(`  ID: ${packTacticsEvaluator.id}`);
console.log(`  Priority: ${packTacticsEvaluator.priority}\n`);

const meleeAction = createTestAction('reach');

// Test 1: No ally
{
  const attacker = createCombatantContext('wolf-1', 'wolves', { x: 0, y: 0 });
  const target = createCombatantContext('player-1', 'party', { x: 1, y: 0 });
  const ctx = createModifierContext(attacker, target, meleeAction);
  test('No ally present → false', !packTacticsEvaluator.isActive(ctx));
}

// Test 2: Ally adjacent to target
{
  const attacker = createCombatantContext('wolf-1', 'wolves', { x: 0, y: 0 });
  const target = createCombatantContext('player-1', 'party', { x: 1, y: 0 });
  const ally = createCombatantContext('wolf-2', 'wolves', { x: 2, y: 0 }); // Adjacent to target
  const ctx = createModifierContext(attacker, target, meleeAction, [ally]);
  test('Ally adjacent to target → true', packTacticsEvaluator.isActive(ctx));
}

// Test 3: Ally incapacitated
{
  const attacker = createCombatantContext('wolf-1', 'wolves', { x: 0, y: 0 });
  const target = createCombatantContext('player-1', 'party', { x: 1, y: 0 });
  const ally = createCombatantContext('wolf-2', 'wolves', { x: 2, y: 0 }, [{ name: 'stunned' }]);
  const ctx = createModifierContext(attacker, target, meleeAction, [ally]);
  test('Ally stunned (incapacitated) → false', !packTacticsEvaluator.isActive(ctx));
}

// Test 4: Ally too far
{
  const attacker = createCombatantContext('wolf-1', 'wolves', { x: 0, y: 0 });
  const target = createCombatantContext('player-1', 'party', { x: 1, y: 0 });
  const ally = createCombatantContext('wolf-2', 'wolves', { x: 3, y: 0 }); // 2 cells from target
  const ctx = createModifierContext(attacker, target, meleeAction, [ally]);
  test('Ally 2 cells from target → false', !packTacticsEvaluator.isActive(ctx));
}

// Test 5: Effect output
{
  const attacker = createCombatantContext('wolf-1', 'wolves', { x: 0, y: 0 });
  const target = createCombatantContext('player-1', 'party', { x: 1, y: 0 });
  const ally = createCombatantContext('wolf-2', 'wolves', { x: 2, y: 0 });
  const ctx = createModifierContext(attacker, target, meleeAction, [ally]);
  const effect = packTacticsEvaluator.getEffect(ctx);
  test('Effect has advantage: true', effect.advantage === true);
}

// ============================================================================
// LONG RANGE TESTS
// ============================================================================

console.log('\n=== Long Range (Schema) Tests ===\n');

const longRangeEvaluator = createSchemaModifierEvaluator(longRangeSchema);
console.log(`Created evaluator: ${longRangeEvaluator.name}`);
console.log(`  ID: ${longRangeEvaluator.id}\n`);

const bowAction = createTestAction('ranged', 80, 320);

// Test 1: Target in normal range
{
  const attacker = createCombatantContext('archer', 'party', { x: 0, y: 0 });
  const target = createCombatantContext('goblin', 'enemies', { x: 3, y: 0 }); // 15ft (3 cells)
  const ctx = createModifierContext(attacker, target, bowAction);
  test('Target in normal range (15ft) → false', !longRangeEvaluator.isActive(ctx));
}

// Test 2: Target in long range
{
  const attacker = createCombatantContext('archer', 'party', { x: 0, y: 0 });
  const target = createCombatantContext('goblin', 'enemies', { x: 20, y: 0 }); // 100ft (20 cells)
  const ctx = createModifierContext(attacker, target, bowAction);
  test('Target in long range (100ft) → true', longRangeEvaluator.isActive(ctx));
}

// Test 3: No long range on action
{
  const shortBowAction = createTestAction('ranged', 80); // No long range
  const attacker = createCombatantContext('archer', 'party', { x: 0, y: 0 });
  const target = createCombatantContext('goblin', 'enemies', { x: 20, y: 0 });
  const ctx = createModifierContext(attacker, target, shortBowAction);
  test('Action has no long range → false', !longRangeEvaluator.isActive(ctx));
}

// ============================================================================
// RANGED IN MELEE TESTS
// ============================================================================

console.log('\n=== Ranged in Melee (Schema) Tests ===\n');

const rangedInMeleeEvaluator = createSchemaModifierEvaluator(rangedInMeleeSchema);
console.log(`Created evaluator: ${rangedInMeleeEvaluator.name}`);
console.log(`  ID: ${rangedInMeleeEvaluator.id}\n`);

// Test 1: Ranged attack, no enemy adjacent
{
  const attacker = createCombatantContext('archer', 'party', { x: 0, y: 0 });
  const target = createCombatantContext('goblin', 'enemies', { x: 10, y: 0 });
  const ctx = createModifierContext(attacker, target, bowAction);
  test('Ranged attack, no enemy adjacent → false', !rangedInMeleeEvaluator.isActive(ctx));
}

// Test 2: Ranged attack, enemy adjacent
{
  const attacker = createCombatantContext('archer', 'party', { x: 0, y: 0 });
  const target = createCombatantContext('goblin-far', 'enemies', { x: 10, y: 0 });
  const adjacentEnemy = createCombatantContext('goblin-close', 'enemies', { x: 1, y: 0 });
  const ctx = createModifierContext(attacker, target, bowAction, [adjacentEnemy]);
  test('Ranged attack, enemy adjacent → true', rangedInMeleeEvaluator.isActive(ctx));
}

// Test 3: Melee attack, enemy adjacent (should not trigger)
{
  const attacker = createCombatantContext('fighter', 'party', { x: 0, y: 0 });
  const target = createCombatantContext('goblin', 'enemies', { x: 1, y: 0 });
  const ctx = createModifierContext(attacker, target, meleeAction);
  test('Melee attack → false', !rangedInMeleeEvaluator.isActive(ctx));
}

// ============================================================================
// SUMMARY
// ============================================================================

console.log('\n' + '='.repeat(50));
console.log(`\nTests passed: ${testsPassed}/${totalTests}`);

if (testsPassed === totalTests) {
  console.log('\n✓ All tests passed! Schema modifier system works correctly.\n');
  process.exit(0);
} else {
  console.log(`\n✗ ${totalTests - testsPassed} tests failed.\n`);
  process.exit(1);
}
