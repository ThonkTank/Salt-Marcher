#!/usr/bin/env npx tsx
/**
 * Combat AI Verhaltensanalyse
 * Tests für Movement-Entscheidungen, Target Selection, Pruning
 */

import { actionPresets, standardActions } from '../presets/actions';
import { initializeLayers } from '../src/services/combatantAI/influenceMaps';
import { executeTurn } from '../src/services/combatantAI/turnExecution';
import { selectBestActionAndTarget } from '../src/services/combatantAI/actionScoring';
import type { CombatProfile, SimulationState, TurnBudget, GridPosition } from '../src/types/combat';
import { feetToCell } from '../src/utils';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getActionById(id: string) {
  return actionPresets.find(a => a.id === id) ?? standardActions.find(a => a.id === id);
}

function createGoblin(id: string, position: GridPosition, groupId = 'enemies'): CombatProfile {
  const scimitar = getActionById('goblin-scimitar')!;
  const shortbow = getActionById('goblin-shortbow')!;

  return {
    participantId: id,
    groupId,
    hp: new Map([[7, 1]]),  // ProbabilityDistribution: 7 HP with 100% probability
    deathProbability: 0,
    ac: 15,
    speed: { walk: 30 },
    actions: [scimitar, shortbow],
    position,
  };
}

function createFighter(id: string, position: GridPosition, groupId = 'party'): CombatProfile {
  return {
    participantId: id,
    groupId,
    hp: new Map([[45, 1]]),  // 45 HP with 100% probability
    deathProbability: 0,
    ac: 18,
    speed: { walk: 30 },
    actions: [{
      id: 'longsword',
      name: 'Longsword',
      actionType: 'melee-weapon',
      timing: { type: 'action' },
      range: { type: 'reach', normal: 5 },
      targeting: { type: 'single' },
      attack: { bonus: 7 },
      damage: { dice: '1d8', modifier: 4, type: 'slashing' },
    }],
    position,
  };
}

function createBudget(): TurnBudget {
  return {
    movementCells: feetToCell(30),
    baseMovementCells: feetToCell(30),
    hasAction: true,
    hasBonusAction: true,
    hasReaction: true,
    hasDashed: false,
  };
}

// ============================================================================
// TEST SCENARIOS
// ============================================================================

console.log('='.repeat(80));
console.log('COMBAT AI VERHALTENSANALYSE');
console.log('='.repeat(80));

// TEST B1: Approach
console.log('\n--- TEST B1: Approach-Verhalten (Goblin 60ft von Fighter) ---\n');

const testB1 = () => {
  const goblin = createGoblin('goblin-1', { x: 0, y: 0, z: 0 });
  const fighter = createFighter('fighter-1', { x: 12, y: 0, z: 0 });

  const state: SimulationState = {
    profiles: [goblin, fighter],
    alliances: { 'enemies': ['enemies'], 'party': ['party'] },
  };

  const stateWithLayers = initializeLayers(state);
  const goblinWithLayers = stateWithLayers.profiles[0];

  console.log('Setup:');
  console.log('  Goblin: (0,0), Fighter: (12,0) = 60ft');
  console.log('  Shortbow Range: 80/320ft');

  const budget = createBudget();
  const result = executeTurn(goblinWithLayers, stateWithLayers, budget);

  console.log('\nErgebnis:');
  result.actions.forEach((action, i) => {
    if (action.type === 'move') {
      console.log(`  [${i}] MOVE to (${action.targetCell.x}, ${action.targetCell.y})`);
    } else if (action.type === 'action') {
      console.log(`  [${i}] ACTION: ${action.action.name} vs ${action.target?.participantId ?? 'self'}`);
    } else {
      console.log(`  [${i}] PASS`);
    }
  });
  console.log(`  Final: (${result.finalCell.x}, ${result.finalCell.y}), Value: ${result.totalValue.toFixed(2)}`);
  console.log(`  Evaluated: ${result.candidatesEvaluated}, Pruned: ${result.candidatesPruned}`);
};

testB1();

// TEST B2: Retreat
console.log('\n--- TEST B2: Retreat (Goblin in Melee) ---\n');

import { calculatePairScore } from '../src/services/combatantAI/actionScoring';
import { calculateEffectiveDamagePotential } from '../src/services/combatantAI/combatHelpers';
import { calculateExpectedOADamage } from '../src/services/combatantAI/turnExecution';

const testB2 = () => {
  const goblin = createGoblin('goblin-1', { x: 1, y: 0, z: 0 });
  const fighter = createFighter('fighter-1', { x: 0, y: 0, z: 0 });

  const state: SimulationState = {
    profiles: [goblin, fighter],
    alliances: { 'enemies': ['enemies'], 'party': ['party'] },
  };

  const stateWithLayers = initializeLayers(state);
  const goblinWithLayers = stateWithLayers.profiles[0];
  const fighterWithLayers = stateWithLayers.profiles[1];

  console.log('Setup: Goblin adjacent to Fighter (Melee)');

  // Vergleiche Action-Scores
  const scimitar = goblinWithLayers.actions.find(a => a.name === 'Scimitar')!;
  const shortbow = goblinWithLayers.actions.find(a => a.name === 'Shortbow')!;

  const scimitarScore = calculatePairScore(goblinWithLayers, scimitar, fighterWithLayers, 1, stateWithLayers);
  const shortbowScore = calculatePairScore(goblinWithLayers, shortbow, fighterWithLayers, 1, stateWithLayers);

  console.log('\nAction-Scores bei aktueller Position (adjacent):');
  console.log(`  Scimitar: ${scimitarScore?.score.toFixed(2) ?? 'N/A'}`);
  console.log(`  Shortbow: ${shortbowScore?.score.toFixed(2) ?? 'N/A'}`);

  // Shortbow from 2 cells away (nach Retreat)
  const shortbowFrom2 = calculatePairScore(goblinWithLayers, shortbow, fighterWithLayers, 2, stateWithLayers);
  console.log(`  Shortbow (von 2 cells): ${shortbowFrom2?.score.toFixed(2) ?? 'N/A'}`);

  // OA-Kosten für Retreat
  const oaDamage = calculateExpectedOADamage(
    goblinWithLayers,
    { x: 1, y: 0, z: 0 }, // from
    { x: 2, y: 0, z: 0 }, // to
    stateWithLayers
  );
  console.log(`\nOA-Kosten für Retreat: ${oaDamage.toFixed(2)}`);
  console.log(`  Fighter Effective DPR: ${calculateEffectiveDamagePotential(fighter.actions, goblin.ac).toFixed(2)}`);

  // Netto-Vergleich
  const scimitarNet = scimitarScore?.score ?? 0;
  const shortbowNet = (shortbowFrom2?.score ?? 0) - oaDamage;
  console.log(`\nNetto-Vergleich:`);
  console.log(`  Scimitar (melee): ${scimitarNet.toFixed(2)}`);
  console.log(`  Shortbow - OA: ${shortbowNet.toFixed(2)}`);
  console.log(`  → Besser: ${scimitarNet > shortbowNet ? 'Scimitar (Melee)' : 'Shortbow (Retreat)'}`);

  const budget = createBudget();
  const result = executeTurn(goblinWithLayers, stateWithLayers, budget);

  console.log('\nErgebnis:');
  result.actions.forEach((action, i) => {
    if (action.type === 'move') {
      console.log(`  [${i}] MOVE to (${action.targetCell.x}, ${action.targetCell.y})`);
    } else if (action.type === 'action') {
      console.log(`  [${i}] ACTION: ${action.action.name} vs ${action.target?.participantId ?? 'self'}`);
    } else {
      console.log(`  [${i}] PASS`);
    }
  });
  console.log(`  Final: (${result.finalCell.x}, ${result.finalCell.y}), Value: ${result.totalValue.toFixed(2)}`);

  const movedAway = result.finalCell.x > 1;
  console.log(`\n  Retreat? ${movedAway ? 'JA' : 'NEIN'}`);
};

testB2();

// TEST C1: Target Priority
console.log('\n--- TEST C1: Target-Priorisierung ---\n');

const testC1 = () => {
  const goblin = createGoblin('goblin-1', { x: 0, y: 0, z: 0 });
  const wizard: CombatProfile = {
    participantId: 'wizard-1',
    groupId: 'party',
    hp: new Map([[12, 1]]),  // 12 HP with 100% probability
    deathProbability: 0,
    ac: 12,
    speed: { walk: 30 },
    actions: [{
      id: 'fire-bolt',
      name: 'Fire Bolt',
      actionType: 'ranged-spell',
      timing: { type: 'action' },
      range: { type: 'ranged', normal: 120 },
      targeting: { type: 'single' },
      attack: { bonus: 5 },
      damage: { dice: '1d10', type: 'fire', modifier: 0 },
    }],
    position: { x: 2, y: 2, z: 0 },
  };
  const fighter = createFighter('fighter-1', { x: 2, y: -2, z: 0 });

  const state: SimulationState = {
    profiles: [goblin, wizard, fighter],
    alliances: { 'enemies': ['enemies'], 'party': ['party'] },
  };

  const stateWithLayers = initializeLayers(state);
  const goblinWithLayers = stateWithLayers.profiles[0];

  console.log('Setup:');
  console.log('  Wizard: HP=12, AC=12 (weak)');
  console.log('  Fighter: HP=45, AC=18 (strong)');

  const bestAction = selectBestActionAndTarget(goblinWithLayers, stateWithLayers);
  console.log('\nAction Selection:');
  if (bestAction) {
    console.log(`  Target: ${bestAction.target.participantId}, Score: ${bestAction.score.toFixed(2)}`);
  }

  const budget = createBudget();
  const result = executeTurn(goblinWithLayers, stateWithLayers, budget);

  console.log('\nTurn:');
  result.actions.forEach((action, i) => {
    if (action.type === 'action') {
      console.log(`  [${i}] ${action.action.name} vs ${action.target?.participantId}`);
    }
  });
};

testC1();

// TEST D1: Pruning Stats
console.log('\n--- TEST D1: Pruning-Statistik ---\n');

const testD1 = () => {
  const goblin = createGoblin('goblin-1', { x: 10, y: 10, z: 0 });
  const fighter = createFighter('fighter-1', { x: 0, y: 0, z: 0 });

  const state: SimulationState = {
    profiles: [goblin, fighter],
    alliances: { 'enemies': ['enemies'], 'party': ['party'] },
  };

  const stateWithLayers = initializeLayers(state);
  const goblinWithLayers = stateWithLayers.profiles[0];

  console.log('Setup: Goblin weit entfernt, viele Movement-Optionen');

  const budget = createBudget();
  const startTime = performance.now();
  const result = executeTurn(goblinWithLayers, stateWithLayers, budget);
  const endTime = performance.now();

  console.log(`\nPerformance: ${(endTime - startTime).toFixed(2)}ms`);
  console.log(`  Evaluated: ${result.candidatesEvaluated}`);
  console.log(`  Pruned: ${result.candidatesPruned}`);
  const total = (result.candidatesEvaluated ?? 0) + (result.candidatesPruned ?? 0);
  console.log(`  Pruning Ratio: ${total > 0 ? ((result.candidatesPruned ?? 0) / total * 100).toFixed(1) : 0}%`);
};

testD1();

console.log('\n' + '='.repeat(80));
console.log('ANALYSE ABGESCHLOSSEN');
console.log('='.repeat(80));
