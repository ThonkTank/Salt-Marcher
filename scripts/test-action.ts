// Ziel: Combat Action Test - einzelne Aktion mit detailliertem Logging testen
// Usage: npx tsx scripts/test-action.ts <caster>:<alliance>@<x>,<y> <action-id> <target>:<alliance>@<x>,<y> [--verbose]
//
// Beispiele:
//   npx tsx scripts/test-action.ts goblin:enemy@0,0 goblin-scimitar knight:party@1,0
//   npx tsx scripts/test-action.ts goblin:enemy@0,0 goblin-shortbow knight:party@6,0
//   npx tsx scripts/test-action.ts bandit-captain:enemy@5,5 bandit-captain-multiattack knight:party@6,5

// ============================================================================
// INFRASTRUCTURE SETUP
// ============================================================================

import { PresetVaultAdapter } from '../src/infrastructure/vault/PresetVaultAdapter';
import { setVault } from '../src/infrastructure/vault/vaultInstance';

import actionsPresets from '../presets/actions/index';
import creaturesPresets from '../presets/creatures/index';
import factionsPresets from '../presets/factions/index';
import npcsPresets from '../presets/npcs/index';
import charactersPresets from '../presets/characters/index';
import modifiersPresets from '../presets/modifiers/index';

const vaultAdapter = new PresetVaultAdapter();
vaultAdapter.register('action', actionsPresets);
vaultAdapter.register('creature', creaturesPresets);
vaultAdapter.register('faction', factionsPresets);
vaultAdapter.register('npc', npcsPresets);
vaultAdapter.register('character', charactersPresets);
vaultAdapter.register('modifier', modifiersPresets);
setVault(vaultAdapter);

// ============================================================================
// IMPORTS (nach Vault-Initialisierung)
// ============================================================================

import type { CreatureDefinition } from '../src/types/entities/creature';
import type { ActionDefinition } from '../src/types/entities/action';
import type { NPC } from '../src/types/entities/npc';
import type { EncounterGroup } from '../src/types/encounterTypes';
import type { CombatStateWithLayers, Combatant } from '../src/types/combat';
import type { GridPosition } from '../src/utils/squareSpace/grid';
import {
  initialiseCombat,
  setPosition,
  getActions,
  getHP,
  getAC,
  getPosition,
  getMaxHP,
  getConditions,
  getResources,
  createTurnBudget,
  executeAction,
} from '../src/services/combatTracking';
import { formatProtocolEntry, formatBudget } from '../src/services/combatTracking/protocolLogger';
import { getExpectedValue } from '../src/utils/probability/pmf';
import { registerCoreModifiers } from '../src/services/combatantAI';
import { cellToFeet } from '../src/utils/squareSpace/grid';

registerCoreModifiers();

// ============================================================================
// TYPES
// ============================================================================

interface ParsedCombatant {
  creatureId: string;
  alliance: 'party' | 'enemy';
  position: GridPosition;
}

// ============================================================================
// ARGUMENT PARSING
// ============================================================================

function parseCombatantArg(arg: string): ParsedCombatant {
  // Format: "goblin:enemy@0,0"
  const atIndex = arg.indexOf('@');
  if (atIndex === -1) {
    throw new Error(`Invalid combatant format: "${arg}". Expected: <creature>:<alliance>@<x>,<y>`);
  }

  const creatureAlliance = arg.slice(0, atIndex);
  const posStr = arg.slice(atIndex + 1);

  const colonIndex = creatureAlliance.indexOf(':');
  if (colonIndex === -1) {
    throw new Error(`Invalid combatant format: "${arg}". Missing alliance. Expected: <creature>:<alliance>@<x>,<y>`);
  }

  const creatureId = creatureAlliance.slice(0, colonIndex);
  const alliance = creatureAlliance.slice(colonIndex + 1);

  if (alliance !== 'party' && alliance !== 'enemy') {
    throw new Error(`Invalid alliance: "${alliance}". Expected: party or enemy`);
  }

  const [xStr, yStr] = posStr.split(',');
  const x = parseInt(xStr, 10);
  const y = parseInt(yStr, 10);

  if (isNaN(x) || isNaN(y)) {
    throw new Error(`Invalid position: "${posStr}". Expected: <x>,<y> (numbers)`);
  }

  return { creatureId, alliance, position: { x, y } };
}

// ============================================================================
// HELPERS
// ============================================================================

function findCreature(id: string): CreatureDefinition | undefined {
  return creaturesPresets.find(c => c.id === id);
}

function findNPCByCreature(creatureId: string): NPC | undefined {
  return npcsPresets.find(npc => npc.creature.id === creatureId);
}

function findAction(id: string): ActionDefinition | undefined {
  return actionsPresets.find(a => a.id === id);
}

function getOrCreateNPC(creature: CreatureDefinition, alliance: 'party' | 'enemy'): NPC {
  // Suche existierenden NPC
  const existing = findNPCByCreature(creature.id);
  if (existing) return existing;

  // Auto-Create transient NPC
  return {
    id: `test-${creature.id}`,
    name: creature.name,
    creature,
    factionId: null,
    disposition: 'hostile',
    baseDisposition: 'hostile',
    status: 'active',
    knownToParty: true,
    homeRegionId: null,
    currentRegionId: null,
    notes: '',
  } as NPC;
}

function findActionForCreature(creature: CreatureDefinition, actionId: string): ActionDefinition | undefined {
  // Suche in creature.actionIds
  if (creature.actionIds.includes(actionId)) {
    return findAction(actionId);
  }

  // Suche Standard-Actions
  if (actionId.startsWith('std-')) {
    return findAction(actionId);
  }

  // Suche direkt im Vault
  return findAction(actionId);
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

// ============================================================================
// LOGGING HELPERS
// ============================================================================

function logCombatantState(c: Combatant, label: string, verbose: boolean): void {
  const hp = getHP(c);
  const maxHp = getMaxHP(c);
  const expectedHp = getExpectedValue(hp);
  const pos = getPosition(c);
  const ac = getAC(c);
  const conditions = getConditions(c);
  const resources = getResources(c);

  console.log(`  ${label}:`);
  console.log(`    HP: ${expectedHp.toFixed(1)}/${maxHp} (${((expectedHp / maxHp) * 100).toFixed(0)}%)`);
  console.log(`    AC: ${ac}`);
  console.log(`    Position: (${pos.x},${pos.y})`);
  console.log(`    Conditions: [${conditions.map(c => c.name).join(', ') || 'none'}]`);

  if (verbose && resources) {
    console.log(`    Resources: ${JSON.stringify(resources)}`);
  }
}

function formatActionInfo(action: ActionDefinition): string {
  const parts: string[] = [];

  // Action type
  if (action.range?.type === 'melee') {
    parts.push('melee');
  } else if (action.range?.type === 'ranged') {
    parts.push('ranged');
  }

  if (action.attack) {
    parts.push(`+${action.attack.bonus} to hit`);
  }

  if (action.damage) {
    const dmg = action.damage;
    const mod = dmg.modifier >= 0 ? `+${dmg.modifier}` : `${dmg.modifier}`;
    parts.push(`${dmg.dice}${mod} ${dmg.type}`);
  }

  if (action.save) {
    parts.push(`DC ${action.save.dc} ${action.save.ability.toUpperCase()}`);
  }

  return parts.join(', ');
}

// ============================================================================
// MAIN
// ============================================================================

function printUsage(): void {
  console.log(`
Usage: npx tsx scripts/test-action.ts <caster>:<alliance>@<x>,<y> <action-id> <target>:<alliance>@<x>,<y> [--verbose]

Arguments:
  <caster>:<alliance>@<x>,<y>   Caster creature-id, alliance (party|enemy), grid position
  <action-id>                   Action ID from creature's actionIds or standard actions
  <target>:<alliance>@<x>,<y>   Target creature-id, alliance (party|enemy), grid position

Options:
  --verbose                     Show detailed internal state

Examples:
  npx tsx scripts/test-action.ts goblin:enemy@0,0 goblin-scimitar knight:party@1,0
  npx tsx scripts/test-action.ts goblin:enemy@0,0 goblin-shortbow knight:party@6,0
  npx tsx scripts/test-action.ts bandit-captain:enemy@5,5 bandit-captain-multiattack knight:party@6,5

Available creatures:`);

  for (const c of creaturesPresets.slice(0, 10)) {
    console.log(`  - ${c.id}`);
  }
  if (creaturesPresets.length > 10) {
    console.log(`  ... and ${creaturesPresets.length - 10} more`);
  }
}

function main(): void {
  const args = process.argv.slice(2);
  const verbose = args.includes('--verbose') || args.includes('-v');
  const filteredArgs = args.filter(a => a !== '--verbose' && a !== '-v');

  if (filteredArgs.length < 3 || filteredArgs[0] === '--help' || filteredArgs[0] === '-h') {
    printUsage();
    process.exit(0);
  }

  const [casterArg, actionId, targetArg] = filteredArgs;

  // Parse arguments
  let casterParsed: ParsedCombatant;
  let targetParsed: ParsedCombatant;

  try {
    casterParsed = parseCombatantArg(casterArg);
    targetParsed = parseCombatantArg(targetArg);
  } catch (e) {
    console.error(`Error: ${e instanceof Error ? e.message : e}`);
    printUsage();
    process.exit(1);
  }

  // Find creatures
  const casterCreature = findCreature(casterParsed.creatureId);
  if (!casterCreature) {
    console.error(`Caster creature not found: ${casterParsed.creatureId}`);
    process.exit(1);
  }

  const targetCreature = findCreature(targetParsed.creatureId);
  if (!targetCreature) {
    console.error(`Target creature not found: ${targetParsed.creatureId}`);
    process.exit(1);
  }

  // Find action
  const action = findActionForCreature(casterCreature, actionId);
  if (!action) {
    console.error(`Action not found: ${actionId}`);
    console.error(`Available actions for ${casterCreature.id}: ${casterCreature.actionIds.join(', ')}`);
    process.exit(1);
  }

  // Create NPCs
  const casterNpc = getOrCreateNPC(casterCreature, casterParsed.alliance);
  const targetNpc = getOrCreateNPC(targetCreature, targetParsed.alliance);

  // Build groups based on alliance
  const partyNpcs: NPC[] = [];
  const enemyNpcs: NPC[] = [];

  if (casterParsed.alliance === 'party') {
    partyNpcs.push(casterNpc);
  } else {
    enemyNpcs.push(casterNpc);
  }

  if (targetParsed.alliance === 'party') {
    partyNpcs.push(targetNpc);
  } else {
    enemyNpcs.push(targetNpc);
  }

  // Build groups (may be empty)
  const groups: EncounterGroup[] = [];
  if (partyNpcs.length > 0) {
    groups.push(createEncounterGroup(partyNpcs, 'party'));
  }
  if (enemyNpcs.length > 0) {
    groups.push(createEncounterGroup(enemyNpcs, 'enemies'));
  }

  // Build alliances
  const alliances: Record<string, string[]> = {};
  if (partyNpcs.length > 0) {
    alliances.party = ['party'];
  }
  if (enemyNpcs.length > 0) {
    alliances.enemies = ['enemies'];
  }

  // Calculate distance (simple Chebyshev for 2D)
  const dx = Math.abs(casterParsed.position.x - targetParsed.position.x);
  const dy = Math.abs(casterParsed.position.y - targetParsed.position.y);
  const distance = Math.max(dx, dy);
  const distanceFeet = cellToFeet(distance);

  // Initialize combat
  const state = initialiseCombat({
    groups,
    alliances,
    party: { level: 1, size: 0, members: [] },
    resourceBudget: 1.0,
    encounterDistanceFeet: distanceFeet,
    initiativeOrder: [casterNpc.id, targetNpc.id],
  }) as CombatStateWithLayers;

  // Find combatants in state
  const caster = state.combatants.find(c => c.creature.id === casterParsed.creatureId);
  const target = state.combatants.find(c => c.creature.id === targetParsed.creatureId);

  if (!caster || !target) {
    console.error('Failed to find combatants in combat state');
    process.exit(1);
  }

  // Set positions
  setPosition(caster, casterParsed.position, state);
  setPosition(target, targetParsed.position, state);

  // ============================================================================
  // OUTPUT
  // ============================================================================

  console.log('='.repeat(70));
  console.log(` ACTION TEST: ${casterCreature.name} (${actionId}) -> ${targetCreature.name}`);
  console.log('='.repeat(70));

  // Setup info
  console.log('\n=== SETUP ===');
  console.log(`  Caster: ${casterCreature.name} @ (${casterParsed.position.x},${casterParsed.position.y}) [${casterParsed.alliance}]`);
  console.log(`  Target: ${targetCreature.name} @ (${targetParsed.position.x},${targetParsed.position.y}) [${targetParsed.alliance}]`);
  console.log(`  Distance: ${distance} cells (${distanceFeet}ft)`);
  console.log(`  Action: ${action.name} (${formatActionInfo(action)})`);

  // Pre-action state
  console.log('\n=== PRE-ACTION STATE ===');
  logCombatantState(caster, 'Caster', verbose);
  logCombatantState(target, 'Target', verbose);

  // Create budget
  const budget = createTurnBudget(caster, state);
  console.log(`\n  ${formatBudget(budget)}`);

  // Execute action
  console.log('\n=== EXECUTING ACTION ===');

  // Resolve action to get the actual action definition
  const resolvedAction = getActions(caster).find(a => a.id === actionId);
  if (!resolvedAction) {
    console.error(`Action ${actionId} not found in caster's resolved actions`);
    console.error(`Available: ${getActions(caster).map(a => a.id).join(', ')}`);
    process.exit(1);
  }

  // Execute
  executeAction(
    caster,
    {
      type: 'action',
      action: resolvedAction,
      target,
      position: casterParsed.position,
    },
    state
  );

  // Post-action state
  console.log('\n=== POST-ACTION STATE ===');
  logCombatantState(caster, 'Caster', verbose);
  logCombatantState(target, 'Target', verbose);

  // Combat log
  if (state.protocol.length > 0) {
    console.log('\n=== COMBAT LOG ===');
    for (const entry of state.protocol) {
      console.log(formatProtocolEntry(entry));
    }
  }

  // Summary
  console.log('\n=== SUMMARY ===');
  const targetHpAfter = getExpectedValue(getHP(target));
  const targetMaxHp = getMaxHP(target);
  const damageDealt = targetMaxHp - targetHpAfter;

  console.log(`  Action executed successfully`);
  console.log(`  Expected damage dealt: ${damageDealt.toFixed(1)}`);
  console.log(`  Target HP: ${targetHpAfter.toFixed(1)}/${targetMaxHp}`);

  const lastEntry = state.protocol[state.protocol.length - 1];
  if (lastEntry?.targetDeathProbability !== undefined) {
    console.log(`  Target death probability: ${(lastEntry.targetDeathProbability * 100).toFixed(0)}%`);
  }

  console.log();
}

main();
