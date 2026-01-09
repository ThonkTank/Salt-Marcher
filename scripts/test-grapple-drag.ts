// Ziel: CLI-Test für Grapple-Drag Mechanik
// Testet: getGrappledTargets, hasAbductTrait, getEffectiveSpeed, setPosition

import {
  getGrappledTargets,
  hasAbductTrait,
  getEffectiveSpeed,
  setPosition,
  createTurnBudget,
  getPosition,
} from '../src/services/combatTracking/combatState';
import type { Combatant, CombatState } from '../src/types/combat';
import type { ConditionState } from '../src/types/combat';
import { PresetVaultAdapter } from '../src/infrastructure/vault/PresetVaultAdapter';
import { setVault } from '../src/infrastructure/vault/vaultInstance';

// Presets importieren
import actionsPresets from '../presets/actions/index';
import creaturesPresets from '../presets/creatures/index';

// Vault initialisieren für getActions()
const presetVault = new PresetVaultAdapter();
presetVault.register('action', actionsPresets);
presetVault.register('creature', creaturesPresets);
setVault(presetVault);

// ============================================================================
// TEST HELPERS
// ============================================================================

function createMockNPC(
  id: string,
  name: string,
  groupId: 'party' | 'enemies',
  position: { x: number; y: number; z: number },
  creatureId: string,  // Use actual creature ID from presets
  conditions: ConditionState[] = []
): Combatant {
  return {
    id,
    name,
    maxHp: 30,
    currentHp: new Map([[30, 1.0]]),
    combatState: {
      position,
      conditions,
      isDead: false,
      groupId,
      effectLayers: [],
    },
    // NPC needs 'creature' property for isNPC() type guard
    creature: {
      id: creatureId,
    },
  } as unknown as Combatant;
}

function createMockState(combatants: Combatant[]): CombatState {
  return {
    combatants,
    turnOrder: combatants.map(c => c.id),
    currentTurnIndex: 0,
    roundNumber: 1,
    alliances: {
      party: ['party'],
      enemies: ['enemies'],
    },
    reactionBudgets: new Map(),
    terrainMap: new Map(),
  } as CombatState;
}

function logResult(testName: string, passed: boolean, details?: string) {
  const status = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`${status}: ${testName}`);
  if (details) {
    console.log(`   ${details}`);
  }
}

// ============================================================================
// TEST CASES
// ============================================================================

console.log('\n========================================');
console.log('GRAPPLE-DRAG MECHANIK TESTS');
console.log('========================================\n');

// Test 1: getGrappledTargets - findet gegrappelte Targets
console.log('--- Test 1: getGrappledTargets ---');
{
  const bugbear = createMockNPC('bugbear-1', 'Bugbear Warrior', 'enemies', { x: 5, y: 5, z: 0 }, 'bugbear-warrior');
  const victim = createMockNPC('victim-1', 'Victim', 'party', { x: 5, y: 5, z: 0 }, 'goblin', [
    { name: 'grappled', probability: 1.0, sourceId: 'bugbear-1' },
  ]);
  const bystander = createMockNPC('bystander-1', 'Bystander', 'party', { x: 10, y: 10, z: 0 }, 'goblin');

  const state = createMockState([bugbear, victim, bystander]);
  const grappledTargets = getGrappledTargets(bugbear, state);

  logResult(
    'Bugbear findet sein gegrappeltes Opfer',
    grappledTargets.length === 1 && grappledTargets[0].id === 'victim-1',
    `Found: ${grappledTargets.map(t => t.name).join(', ') || 'none'}`
  );

  const bystanderTargets = getGrappledTargets(bystander, state);
  logResult(
    'Bystander hat keine gegrappelten Targets',
    bystanderTargets.length === 0,
    `Found: ${bystanderTargets.length}`
  );
}

// Test 2: hasAbductTrait - erkennt Abduct Trait
console.log('\n--- Test 2: hasAbductTrait ---');
{
  const bugbear = createMockNPC('bugbear-1', 'Bugbear Warrior', 'enemies', { x: 5, y: 5, z: 0 }, 'bugbear-warrior');
  const goblin = createMockNPC('goblin-1', 'Goblin', 'enemies', { x: 10, y: 10, z: 0 }, 'goblin');

  logResult(
    'Bugbear hat Abduct Trait',
    hasAbductTrait(bugbear) === true,
    `hasAbductTrait: ${hasAbductTrait(bugbear)}`
  );

  logResult(
    'Goblin hat kein Abduct Trait',
    hasAbductTrait(goblin) === false,
    `hasAbductTrait: ${hasAbductTrait(goblin)}`
  );
}

// Test 3: getEffectiveSpeed - Speed-Halbierung ohne Abduct
console.log('\n--- Test 3: getEffectiveSpeed mit Grapple-Drag ---');
{
  // Grappler OHNE Abduct (goblin) - Speed sollte halbiert werden
  const grappler = createMockNPC('grappler-1', 'Grappler', 'enemies', { x: 5, y: 5, z: 0 }, 'goblin');
  const victim = createMockNPC('victim-1', 'Victim', 'party', { x: 5, y: 5, z: 0 }, 'goblin', [
    { name: 'grappled', probability: 1.0, sourceId: 'grappler-1' },
  ]);
  const state = createMockState([grappler, victim]);

  const speedWithGrapple = getEffectiveSpeed(grappler, state);
  const speedWithoutState = getEffectiveSpeed(grappler);

  logResult(
    'Grappler ohne Abduct: Speed halbiert (30 → 15)',
    speedWithGrapple === 15,
    `Speed mit State: ${speedWithGrapple}, Speed ohne State: ${speedWithoutState}`
  );

  // Bugbear MIT Abduct - Speed sollte NICHT halbiert werden
  const bugbear = createMockNPC('bugbear-1', 'Bugbear Warrior', 'enemies', { x: 5, y: 5, z: 0 }, 'bugbear-warrior');
  const victim2 = createMockNPC('victim-2', 'Victim 2', 'party', { x: 5, y: 5, z: 0 }, 'goblin', [
    { name: 'grappled', probability: 1.0, sourceId: 'bugbear-1' },
  ]);
  const state2 = createMockState([bugbear, victim2]);

  const bugbearSpeed = getEffectiveSpeed(bugbear, state2);

  logResult(
    'Bugbear mit Abduct: Speed NICHT halbiert (30)',
    bugbearSpeed === 30,
    `Speed: ${bugbearSpeed}`
  );
}

// Test 4: setPosition - Grappled Target folgt
console.log('\n--- Test 4: setPosition mit Grapple-Drag ---');
{
  const bugbear = createMockNPC('bugbear-1', 'Bugbear Warrior', 'enemies', { x: 5, y: 5, z: 0 }, 'bugbear-warrior');
  const victim = createMockNPC('victim-1', 'Victim', 'party', { x: 5, y: 5, z: 0 }, 'goblin', [
    { name: 'grappled', probability: 1.0, sourceId: 'bugbear-1' },
  ]);
  const bystander = createMockNPC('bystander-1', 'Bystander', 'party', { x: 10, y: 10, z: 0 }, 'goblin');

  const state = createMockState([bugbear, victim, bystander]);

  // Bugbear bewegt sich
  const newPos = { x: 8, y: 8, z: 0 };
  setPosition(bugbear, newPos, state);

  const bugbearPos = getPosition(bugbear);
  const victimPos = getPosition(victim);
  const bystanderPos = getPosition(bystander);

  logResult(
    'Bugbear bewegt sich zu (8, 8)',
    bugbearPos.x === 8 && bugbearPos.y === 8,
    `Bugbear Position: (${bugbearPos.x}, ${bugbearPos.y})`
  );

  logResult(
    'Victim folgt zu (8, 8)',
    victimPos.x === 8 && victimPos.y === 8,
    `Victim Position: (${victimPos.x}, ${victimPos.y})`
  );

  logResult(
    'Bystander bleibt bei (10, 10)',
    bystanderPos.x === 10 && bystanderPos.y === 10,
    `Bystander Position: (${bystanderPos.x}, ${bystanderPos.y})`
  );
}

// Test 5: createTurnBudget - Movement Cells basierend auf Speed
console.log('\n--- Test 5: createTurnBudget mit Grapple-Drag ---');
{
  const grappler = createMockNPC('grappler-1', 'Grappler', 'enemies', { x: 5, y: 5, z: 0 }, 'goblin');
  const victim = createMockNPC('victim-1', 'Victim', 'party', { x: 5, y: 5, z: 0 }, 'goblin', [
    { name: 'grappled', probability: 1.0, sourceId: 'grappler-1' },
  ]);
  const state = createMockState([grappler, victim]);

  const budgetWithState = createTurnBudget(grappler, state);
  const budgetWithoutState = createTurnBudget(grappler);

  logResult(
    'Grappler ohne Abduct: Movement Cells = 3 (15ft / 5)',
    budgetWithState.movementCells === 3,
    `Movement Cells mit State: ${budgetWithState.movementCells}, ohne State: ${budgetWithoutState.movementCells}`
  );

  // Bugbear mit Abduct
  const bugbear = createMockNPC('bugbear-1', 'Bugbear Warrior', 'enemies', { x: 5, y: 5, z: 0 }, 'bugbear-warrior');
  const victim2 = createMockNPC('victim-2', 'Victim 2', 'party', { x: 5, y: 5, z: 0 }, 'goblin', [
    { name: 'grappled', probability: 1.0, sourceId: 'bugbear-1' },
  ]);
  const state2 = createMockState([bugbear, victim2]);

  const bugbearBudget = createTurnBudget(bugbear, state2);

  logResult(
    'Bugbear mit Abduct: Movement Cells = 6 (30ft / 5)',
    bugbearBudget.movementCells === 6,
    `Movement Cells: ${bugbearBudget.movementCells}`
  );
}

// Test 6: Multiple grappled targets
console.log('\n--- Test 6: Multiple Grappled Targets ---');
{
  const bigGrappler = createMockNPC('big-1', 'Big Grappler', 'enemies', { x: 5, y: 5, z: 0 }, 'ogre');
  const victim1 = createMockNPC('victim-1', 'Victim 1', 'party', { x: 5, y: 5, z: 0 }, 'goblin', [
    { name: 'grappled', probability: 1.0, sourceId: 'big-1' },
  ]);
  const victim2 = createMockNPC('victim-2', 'Victim 2', 'party', { x: 5, y: 5, z: 0 }, 'goblin', [
    { name: 'grappled', probability: 1.0, sourceId: 'big-1' },
  ]);

  const state = createMockState([bigGrappler, victim1, victim2]);

  const grappledTargets = getGrappledTargets(bigGrappler, state);
  logResult(
    'Big Grappler hat 2 gegrappelte Targets',
    grappledTargets.length === 2,
    `Found: ${grappledTargets.length}`
  );

  // Move and verify both follow
  setPosition(bigGrappler, { x: 10, y: 10, z: 0 }, state);

  const pos1 = getPosition(victim1);
  const pos2 = getPosition(victim2);

  logResult(
    'Beide Victims folgen zu (10, 10)',
    pos1.x === 10 && pos1.y === 10 && pos2.x === 10 && pos2.y === 10,
    `Victim1: (${pos1.x}, ${pos1.y}), Victim2: (${pos2.x}, ${pos2.y})`
  );
}

console.log('\n========================================');
console.log('TESTS ABGESCHLOSSEN');
console.log('========================================\n');
