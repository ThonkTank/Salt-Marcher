// Ziel: Test Bandit Captain Multiattack, Pistol, und Range-Mechaniken
// Test: Multiattack (2 Attacks), Long Range Disadvantage, Ranged in Melee

// ============================================================================
// INFRASTRUCTURE SETUP (vor allen anderen Imports!)
// ============================================================================

import { PresetVaultAdapter } from '../src/infrastructure/vault/PresetVaultAdapter';
import { setVault } from '../src/infrastructure/vault/vaultInstance';

// Presets importieren
import actionsPresets from '../presets/actions/index';
import creaturesPresets from '../presets/creatures/index';
import factionsPresets from '../presets/factions/index';
import npcsPresets from '../presets/npcs/index';
import charactersPresets from '../presets/characters/index';

// Vault initialisieren BEVOR andere Module geladen werden
const vaultAdapter = new PresetVaultAdapter();
vaultAdapter.register('action', actionsPresets);
vaultAdapter.register('creature', creaturesPresets);
vaultAdapter.register('faction', factionsPresets);
vaultAdapter.register('npc', npcsPresets);
vaultAdapter.register('character', charactersPresets);
setVault(vaultAdapter);

// ============================================================================
// IMPORTS (nach Vault-Initialisierung)
// ============================================================================

import type { NPC } from '../src/types/entities/npc';
import type { EncounterGroup } from '../src/types/encounterTypes';
import type { CombatStateWithLayers } from '../src/types/combat';
import {
  initialiseCombat,
  setPosition,
  executeAction,
  getActions,
  getHP,
  getAC,
  getPosition,
  getMaxHP,
  createTurnBudget,
} from '../src/services/combatTracking';
import { getExpectedValue } from '../src/utils/probability/pmf';
import { selectNextAction } from '../src/services/combatantAI/selectNextAction';
import { evaluateSituationalModifiers } from '../src/services/combatantAI/situationalModifiers';
import { registerCoreModifiers } from '../src/services/combatantAI';
import { feetToCell } from '../src/utils/squareSpace/grid';

// Core Modifiers registrieren
registerCoreModifiers();

// ============================================================================
// HELPERS
// ============================================================================

function findNPC(id: string): NPC | undefined {
  return npcsPresets.find(npc => npc.id === id);
}

function createEncounterGroup(npcs: NPC[], groupId: string): EncounterGroup {
  return {
    groupId,
    factionId: npcs[0]?.factionId ?? null,
    narrativeRole: 'threat',
    status: 'free',
    slots: { seed: npcs },
    npcIds: npcs.map(n => n.id),
  };
}

function setupCombat(partyIds: string[], enemyIds: string[]): CombatStateWithLayers {
  const partyNpcs = partyIds.map(id => {
    const npc = findNPC(id);
    if (!npc) throw new Error(`Party NPC not found: ${id}`);
    return npc;
  });

  const enemyNpcs = enemyIds.map(id => {
    const npc = findNPC(id);
    if (!npc) throw new Error(`Enemy NPC not found: ${id}`);
    return npc;
  });

  const groups: EncounterGroup[] = [
    createEncounterGroup(partyNpcs, 'party'),
    createEncounterGroup(enemyNpcs, 'enemies'),
  ];

  return initialiseCombat({
    groups,
    alliances: { party: [], enemies: [] },
    party: { level: 1, size: 0, members: [] },
    resourceBudget: 1.0,
    encounterDistanceFeet: 60,
    initiativeOrder: [...partyIds, ...enemyIds],
  }) as CombatStateWithLayers;
}

// ============================================================================
// SETUP
// ============================================================================

console.log('='.repeat(70));
console.log(' BANDIT CAPTAIN TEST SUITE');
console.log('='.repeat(70));
console.log();

// ============================================================================
// TEST 1: Verify Creature & Action Loading
// ============================================================================

console.log('TEST 1: Creature & Action Loading');
console.log('-'.repeat(50));

const state = setupCombat(['knight-aldric'], ['kapitaen-moreno']);
const captain = state.combatants.find(c => c.name === 'Kapitän Moreno');
const knight = state.combatants.find(c => c.name === 'Sir Aldric');

if (!captain || !knight) {
  console.error('FEHLER: NPCs nicht gefunden!');
  console.log('Combatants:', state.combatants.map(c => c.name));
  process.exit(1);
}

const captainPos = getPosition(captain);
console.log(`Captain: ${captain.name}`);
console.log(`  HP: ${getExpectedValue(getHP(captain)).toFixed(0)}/${getMaxHP(captain)}`);
console.log(`  AC: ${getAC(captain)}`);
console.log(`  Position: (${captainPos.x}, ${captainPos.y})`);
console.log();

// Actions laden
const actions = getActions(captain);
console.log('Actions:');
for (const action of actions) {
  console.log(`  - ${action.name} (${action.actionType})`);
  if (action.multiattack) {
    console.log(`    Multiattack: ${action.multiattack.attacks.map(a => `${a.count}x ${a.actionRef}`).join(', ')}`);
  }
  if (action.damage) {
    console.log(`    Damage: ${action.damage.dice}+${action.damage.modifier} ${action.damage.type}`);
  }
  if (action.range?.type === 'ranged') {
    console.log(`    Range: ${action.range.normal}/${action.range.long} ft`);
  }
}
console.log();

// ============================================================================
// TEST 2: Multiattack Evaluation (Normal Range)
// ============================================================================

console.log('TEST 2: Multiattack bei Normal Range (5 ft)');
console.log('-'.repeat(50));

// Position: Adjacent (5 ft = 1 cell)
setPosition(captain, { x: 5, y: 5 }, state);
setPosition(knight, { x: 6, y: 5 }, state);

const distanceFeet1 = 5;
console.log(`Distanz: ${distanceFeet1} ft (adjacent, normal range für beides)`);

const budget1 = createTurnBudget(captain, state);
const result1 = selectNextAction(captain, state, budget1);
if (result1.type === 'action') {
  console.log(`Gewählte Aktion: ${result1.action.name}`);
  if (result1.action.multiattack) {
    console.log(`  → Multiattack mit ${result1.action.multiattack.attacks.length} Angriffen`);
  }
  console.log(`  Score: ${result1.score?.toFixed(2) ?? 'N/A'}`);
} else {
  console.log(`Gewählte Aktion: PASS`);
}

// Modifiers prüfen (sollte Ranged in Melee Disadvantage sein bei 5ft)
const pistol = actions.find(a => a.name === 'Pistol');
if (pistol) {
  const mods1 = evaluateSituationalModifiers(captain, knight, pistol, state);
  console.log(`  Pistol Modifiers bei 5ft: disadvantage=${mods1.disadvantage}, advantage=${mods1.advantage}`);
  if (mods1.disadvantage) {
    console.log(`    ✅ ERWARTET: Ranged in Melee Disadvantage (adjacent enemy)`);
  } else {
    console.log(`    ❌ FEHLER: Ranged in Melee Disadvantage sollte angewendet werden!`);
  }
}
console.log();

// ============================================================================
// TEST 3: Long Range Disadvantage (> 30 ft, <= 90 ft)
// ============================================================================

console.log('TEST 3: Pistol Long Range Disadvantage (50 ft)');
console.log('-'.repeat(50));

// Position: 50 ft = 10 cells (bei 5ft/cell)
const longRangeCells = feetToCell(50);
setPosition(captain, { x: 0, y: 0 }, state);
setPosition(knight, { x: longRangeCells, y: 0 }, state);

console.log(`Distanz: 50 ft (${longRangeCells} cells) - Long Range für Pistol (30/90)`);

if (pistol) {
  const mods2 = evaluateSituationalModifiers(captain, knight, pistol, state);
  console.log(`Pistol Modifiers:`);
  console.log(`  disadvantage: ${mods2.disadvantage}`);
  console.log(`  advantage: ${mods2.advantage}`);
  console.log(`  effectiveAttackMod: ${mods2.effectiveAttackMod}`);

  if (mods2.disadvantage) {
    console.log(`  ✅ Long Range Disadvantage korrekt angewendet!`);
  } else {
    console.log(`  ❌ FEHLER: Disadvantage sollte bei 50ft angewendet werden!`);
  }
}

const budget2 = createTurnBudget(captain, state);
const result2 = selectNextAction(captain, state, budget2);
if (result2.type === 'action') {
  console.log(`Gewählte Aktion: ${result2.action.name}`);
  console.log(`  Score: ${result2.score?.toFixed(2) ?? 'N/A'}`);
} else {
  console.log(`Gewählte Aktion: PASS`);
}
console.log();

// ============================================================================
// TEST 4: Beyond Long Range (> 90 ft)
// ============================================================================

console.log('TEST 4: Pistol Beyond Long Range (100 ft)');
console.log('-'.repeat(50));

// Position: 100 ft = 20 cells
const beyondRangeCells = feetToCell(100);
setPosition(captain, { x: 0, y: 0 }, state);
setPosition(knight, { x: beyondRangeCells, y: 0 }, state);

console.log(`Distanz: 100 ft (${beyondRangeCells} cells) - Beyond Long Range (max 90 ft)`);

const budget3 = createTurnBudget(captain, state);
const result3 = selectNextAction(captain, state, budget3);
if (result3.type === 'action') {
  console.log(`Gewählte Aktion: ${result3.action.name}`);
  console.log(`  Score: ${result3.score?.toFixed(2) ?? 'N/A'}`);
  if (result3.action.name === 'Multiattack') {
    console.log(`  ⚠️ Multiattack gewählt - Pistol sollte nicht erreichbar sein`);
  }
} else {
  console.log(`Gewählte Aktion: PASS (Move erforderlich)`);
}
console.log();

// ============================================================================
// TEST 5: Action Execution
// ============================================================================

console.log('TEST 5: Multiattack Execution');
console.log('-'.repeat(50));

// Reset: Adjacent position
setPosition(captain, { x: 5, y: 5 }, state);
setPosition(knight, { x: 6, y: 5 }, state);

// HP vor Angriff
const hpBefore = getExpectedValue(getHP(knight));
console.log(`Knight HP vor Angriff: ${hpBefore.toFixed(0)}`);

const multiattack = actions.find(a => a.actionType === 'multiattack');
if (multiattack) {
  console.log(`Führe ${multiattack.name} aus...`);
  const execResult = executeAction(captain, multiattack, knight, state);

  const hpAfter = getExpectedValue(getHP(knight));
  const damage = hpBefore - hpAfter;

  console.log(`  Damage dealt: ${damage}`);
  console.log(`  Knight HP nach Angriff: ${hpAfter}`);
  console.log(`  Protocol Entries: ${execResult.protocol?.length ?? 0}`);

  if (execResult.protocol) {
    for (const entry of execResult.protocol) {
      console.log(`    - ${entry.attackResult ?? ''} ${entry.damageDealt ? `(${entry.damageDealt} dmg)` : ''}`);
    }
  }
}

console.log();
console.log('='.repeat(70));
console.log(' TESTS ABGESCHLOSSEN');
console.log('='.repeat(70));
