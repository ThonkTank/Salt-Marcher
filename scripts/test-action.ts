// Ziel: Combat Action Test - einzelne Aktion mit detailliertem Logging testen
//
// ============================================================================
// ⚠️ ON HOLD - Combat-Implementierung ist vorübergehend pausiert.
// Dieses Script ist aktuell nicht funktionsfähig.
// ============================================================================
//
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
import type { CombatEvent, Cost } from '../src/types/entities/combatEvent';
import type { NPC } from '../src/types/entities/npc';
import type { EncounterGroup } from '../src/types/encounterTypes';
import type { CombatStateWithLayers, Combatant, CombatInventoryItem } from '../src/types/combat';
import type { GridPosition } from '../src/utils/squareSpace/grid';
import {
  initialiseCombat,
  setPosition,
  getHP,
  getAC,
  getPosition,
  getMaxHP,
  getConditions,
  getResources,
  createTurnBudget,
} from '../src/services/combatTracking';
import { formatProtocolEntry, formatBudget } from '../src/services/combatTracking/protocolLogger';
import { runAction } from '../src/workflows/combatWorkflow';
import { getExpectedValue, createSingleValue } from '../src/utils/probability/pmf';
import { registerCoreModifiers, getAvailableActionsForCombatant } from '../src/services/combatantAI';
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

  // z: 0 ist erforderlich für 3D-Distanz-Berechnung
  return { creatureId, alliance, position: { x, y, z: 0 } };
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

function findAction(id: string): CombatEvent | undefined {
  return actionsPresets.find(a => a.id === id);
}

// Instance counter for unique NPC IDs when same creature is used multiple times
const creatureInstanceCounter = new Map<string, number>();

function getOrCreateNPC(creature: CreatureDefinition, alliance: 'party' | 'enemy'): NPC {
  // Suche existierenden NPC im Vault
  const existing = findNPCByCreature(creature.id);
  if (existing) {
    // Clone existing NPC with unique ID to avoid conflicts
    const count = (creatureInstanceCounter.get(creature.id) ?? 0) + 1;
    creatureInstanceCounter.set(creature.id, count);
    return {
      ...existing,
      id: `${existing.id}-${count}`,
      name: count > 1 ? `${existing.name} ${count}` : existing.name,
    };
  }

  // Auto-Create transient NPC with unique instance ID
  const count = (creatureInstanceCounter.get(creature.id) ?? 0) + 1;
  creatureInstanceCounter.set(creature.id, count);

  return {
    id: `test-${creature.id}-${count}`,
    name: count > 1 ? `${creature.name} ${count}` : creature.name,
    creature,
    factionId: null,
    disposition: 'hostile',
    baseDisposition: 'hostile',
    status: 'active',
    knownToParty: true,
    homeRegionId: null,
    currentRegionId: null,
    notes: '',
    currentHp: createSingleValue(creature.averageHp),
    maxHp: creature.averageHp,
  } as NPC;
}

function findActionForCreature(creature: CreatureDefinition, actionId: string): CombatEvent | undefined {
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

function formatActionInfo(action: CombatEvent): string {
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

/**
 * Logs inventory state with quantities.
 */
function logInventory(combatant: Combatant, label: string): void {
  const inventory = combatant.combatState.inventory;
  if (inventory.length === 0) {
    console.log(`  ${label}: (empty)`);
  } else {
    console.log(`  ${label}:`);
    for (const item of inventory) {
      const tags = item.tags?.length ? ` [${item.tags.join(', ')}]` : '';
      console.log(`    - ${item.id}: qty ${item.quantity}${tags}`);
    }
  }
}

// ============================================================================
// AUTO-PROVISION INVENTORY FOR CONSUME-ITEM COSTS
// ============================================================================

interface ConsumeItemCost {
  itemId?: string;
  itemTag?: string;
  quantity: number;
}

/**
 * Extracts all consume-item costs from an action (handles composite costs).
 */
function extractConsumeItemCosts(action: CombatEvent): ConsumeItemCost[] {
  const costs: ConsumeItemCost[] = [];

  function extractFromCost(cost: Cost | undefined): void {
    if (!cost) return;

    if (cost.type === 'consume-item') {
      costs.push({
        itemId: cost.itemId,
        itemTag: cost.itemTag,
        quantity: cost.quantity ?? 1,
      });
    } else if (cost.type === 'composite') {
      for (const subCost of cost.costs) {
        extractFromCost(subCost);
      }
    }
  }

  extractFromCost(action.cost);
  return costs;
}

/**
 * Provisions required items in combatant's inventory.
 * Returns list of provisioned items for logging.
 */
function provisionInventory(
  combatant: Combatant,
  consumeItemCosts: ConsumeItemCost[]
): Array<{ id: string; provisioned: number }> {
  const provisioned: Array<{ id: string; provisioned: number }> = [];
  const inventory = combatant.combatState.inventory;

  for (const cost of consumeItemCosts) {
    // Generate item ID from tag if not specified
    const itemId = cost.itemId ?? (cost.itemTag ? `${cost.itemTag}-auto` : 'unknown-item');

    // Find existing item
    let item = inventory.find(i =>
      (cost.itemId && i.id === cost.itemId) ||
      (cost.itemTag && i.tags?.includes(cost.itemTag))
    );

    // Calculate how many we need (provision 10x required for multiple uses)
    const targetQty = cost.quantity * 10;

    if (!item) {
      // Create new item
      const newItem: CombatInventoryItem = {
        id: itemId,
        quantity: targetQty,
        tags: cost.itemTag ? [cost.itemTag] : undefined,
      };
      inventory.push(newItem);
      provisioned.push({ id: itemId, provisioned: targetQty });
    } else if (item.quantity < cost.quantity) {
      // Top up existing item
      const added = targetQty - item.quantity;
      item.quantity = targetQty;
      provisioned.push({ id: item.id, provisioned: added });
    }
  }

  return provisioned;
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
  --with-condition <name>       Apply condition to caster (for testing escape actions)
  --escape-dc <dc>              DC for escape check (default: 12)
  --condition-source <id>       Source ID for condition (default: 'test-source')

Examples:
  npx tsx scripts/test-action.ts goblin:enemy@0,0 goblin-scimitar knight:party@1,0
  npx tsx scripts/test-action.ts goblin:enemy@0,0 goblin-shortbow knight:party@6,0
  npx tsx scripts/test-action.ts bandit-captain:enemy@5,5 bandit-captain-multiattack knight:party@6,5

  # Test escape from grappled condition:
  npx tsx scripts/test-action.ts goblin:party@0,0 escape-grappled goblin:party@0,0 --with-condition grappled --escape-dc 12

Available creatures:`);

  for (const c of creaturesPresets.slice(0, 10)) {
    console.log(`  - ${c.id}`);
  }
  if (creaturesPresets.length > 10) {
    console.log(`  ... and ${creaturesPresets.length - 10} more`);
  }
}

interface ConditionConfig {
  name: string;
  dc: number;
  sourceId: string;
}

function parseConditionArgs(args: string[]): ConditionConfig | null {
  const conditionIdx = args.indexOf('--with-condition');
  if (conditionIdx === -1 || conditionIdx + 1 >= args.length) return null;

  const conditionName = args[conditionIdx + 1];

  // Parse optional --escape-dc
  const dcIdx = args.indexOf('--escape-dc');
  const dc = dcIdx !== -1 && dcIdx + 1 < args.length
    ? parseInt(args[dcIdx + 1], 10)
    : 12;

  // Parse optional --condition-source
  const sourceIdx = args.indexOf('--condition-source');
  const sourceId = sourceIdx !== -1 && sourceIdx + 1 < args.length
    ? args[sourceIdx + 1]
    : 'test-source';

  return { name: conditionName, dc, sourceId };
}

function main(): void {
  const args = process.argv.slice(2);
  const verbose = args.includes('--verbose') || args.includes('-v');

  // Parse condition config before filtering
  const conditionConfig = parseConditionArgs(args);

  // Filter out all option flags and their values
  const filteredArgs = args.filter((a, i, arr) => {
    if (a === '--verbose' || a === '-v') return false;
    if (a === '--with-condition' || a === '--escape-dc' || a === '--condition-source') return false;
    // Also filter the value after these flags
    const prevArg = arr[i - 1];
    if (prevArg === '--with-condition' || prevArg === '--escape-dc' || prevArg === '--condition-source') return false;
    return true;
  });

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

  // Find action (skip for escape-* actions which are dynamically generated)
  const isDynamicEscapeAction = actionId.startsWith('escape-');
  let action = findActionForCreature(casterCreature, actionId);
  if (!action && !isDynamicEscapeAction) {
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

  // Find combatants in state by NPC ID (unique, even for same creature type)
  const caster = state.combatants.find(c => c.id === casterNpc.id);
  const target = state.combatants.find(c => c.id === targetNpc.id);

  if (!caster || !target) {
    console.error('Failed to find combatants in combat state');
    console.error(`Looking for caster ID: ${casterNpc.id}, target ID: ${targetNpc.id}`);
    console.error(`Available combatants: ${state.combatants.map(c => c.id).join(', ')}`);
    process.exit(1);
  }

  // Set positions
  setPosition(caster, casterParsed.position, state);
  setPosition(target, targetParsed.position, state);

  // Apply condition to caster if specified (for testing escape actions)
  if (conditionConfig) {
    const conditionState: import('../src/types/combat').ConditionState = {
      name: conditionConfig.name,
      probability: 1,
      effect: conditionConfig.name,  // Use condition name as effect type
      duration: {
        type: 'until-escape',
        escapeCheck: {
          type: 'dc',
          timing: 'action',
          dc: conditionConfig.dc,
          ability: 'str',
        },
      },
      sourceId: conditionConfig.sourceId,
    };
    caster.combatState.conditions = [...(caster.combatState.conditions ?? []), conditionState];
    console.log(`\n[SETUP] Applied condition '${conditionConfig.name}' to caster (escape DC ${conditionConfig.dc})`);
  }

  // Resolve action to get the actual action definition (includes dynamic escape actions)
  const allAvailableActions = getAvailableActionsForCombatant(caster);
  const resolvedAction = allAvailableActions.find(a => a.id === actionId);
  if (!resolvedAction) {
    console.error(`Action ${actionId} not found in caster's available actions`);
    console.error(`Available: ${allAvailableActions.map(a => a.id).join(', ')}`);
    process.exit(1);
  }

  // Use resolved action for everything (covers both static and dynamic actions)
  const finalAction = resolvedAction;

  // Auto-provision inventory for consume-item costs
  const consumeItemCosts = extractConsumeItemCosts(finalAction);
  const provisioned = provisionInventory(caster, consumeItemCosts);

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
  console.log(`  Action: ${finalAction.name} (${formatActionInfo(finalAction)})`);

  // Show provisioned items
  if (provisioned.length > 0) {
    console.log('\n=== AUTO-PROVISIONED ITEMS ===');
    for (const p of provisioned) {
      console.log(`  Added ${p.provisioned}x ${p.id}`);
    }
  }

  // Pre-action state
  console.log('\n=== PRE-ACTION STATE ===');
  logCombatantState(caster, 'Caster', verbose);
  logInventory(caster, 'Caster Inventory');
  logCombatantState(target, 'Target', verbose);

  // Create budget
  const budget = createTurnBudget(caster, state);
  console.log(`\n  ${formatBudget(budget)}`);

  // Execute
  const result = runAction(
    {
      actorId: caster.id,
      turnAction: {
        type: 'action',
        action: finalAction,
        target,
        position: casterParsed.position,
      },
    },
    state
  );

  // Show resolution result details in verbose mode
  if (verbose && result) {
    console.log('\n  Resolution Details:');
    console.log(`    hpChanges: ${JSON.stringify(result.hpChanges)}`);
    console.log(`    conditionsToAdd: ${result.conditionsToAdd.length}`);
    console.log(`    hit: ${result.protocolData.hit}, critical: ${result.protocolData.critical}`);
  }

  // Post-action state
  console.log('\n=== POST-ACTION STATE ===');
  logCombatantState(caster, 'Caster', verbose);
  logInventory(caster, 'Caster Inventory');
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
