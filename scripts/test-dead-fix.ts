// Quick test for dead combatant fix
// Verifies that combat ends properly when combatants die

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

// Vault initialisieren BEVOR andere Module geladen werden
const vaultAdapter = new PresetVaultAdapter();
vaultAdapter.register('action', actionsPresets);
vaultAdapter.register('creature', creaturesPresets);
vaultAdapter.register('faction', factionsPresets);
vaultAdapter.register('npc', npcsPresets);
setVault(vaultAdapter);

// ============================================================================
// IMPORTS (nach Vault-Initialisierung)
// ============================================================================

import type { NPC } from '../src/types/entities/npc';
import type { EncounterGroup } from '../src/types/encounterTypes';
import type { CombatStateWithLayers } from '../src/types/combat';
import {
  initialiseCombat,
  isCombatOver,
  getCurrentCombatant,
  executeAction,
  getDeathProbability,
  getAliveCombatants,
} from '../src/services/combatTracking';
import { selectNextAction, registerCoreModifiers } from '../src/services/combatantAI';

registerCoreModifiers();

// ============================================================================
// TEST SETUP
// ============================================================================

const partyIds = ['einaeugiger-pete', 'schwarzer-jack'];
const enemyIds = ['griknak', 'snaggle', 'borgrik', 'einsamer-wolf'];

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

// Beide Seiten verwenden NPCs (haben Actions aus Creature-Definition)
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

const partyGroup = createEncounterGroup(partyNpcs, 'party');
const enemyGroup = createEncounterGroup(enemyNpcs, 'enemies');

const state = initialiseCombat({
  groups: [partyGroup, enemyGroup],  // Beide als NPC-Gruppen
  alliances: { party: [], enemies: [] },  // Party-Array leer (keine echten Characters)
  party: {
    level: 1,
    size: 0,  // Keine echten Characters
    members: [],
  },
  resourceBudget: 1.0,
  initiativeOrder: [...partyIds, ...enemyIds],
}) as CombatStateWithLayers;

// ============================================================================
// RUN COMBAT
// ============================================================================

const MAX_ROUNDS = 100;

console.log('Starting 2v4 combat test (dead combatant fix)...');
console.log('Party:', partyIds.join(', '));
console.log('Enemies:', enemyIds.join(', '));
console.log('');

while (!isCombatOver(state) && state.roundNumber < MAX_ROUNDS) {
  const current = getCurrentCombatant(state);
  if (!current) break;

  const action = selectNextAction(current, state, state.currentTurnBudget);
  if (!action) break;

  const deathProb = Math.round(getDeathProbability(current) * 100);
  const isDead = current.combatState.isDead;
  const targetName = action.type === 'action' && action.target ? action.target.name : '-';
  const targetDeath = action.type === 'action' && action.target ? Math.round(getDeathProbability(action.target) * 100) : 0;

  console.log(
    `R${String(state.roundNumber).padStart(2)} ` +
    `${current.name.substring(0, 12).padEnd(12)} ` +
    `[${String(deathProb).padStart(3)}%${isDead ? '☠' : ' '}] → ` +
    `${targetName.substring(0, 10).padEnd(10)} [${String(targetDeath).padStart(3)}%]`
  );

  executeAction(current, action, state);
}

const alive = getAliveCombatants(state);
console.log('');
console.log(`Combat ended after ${state.roundNumber} rounds`);
console.log(`Alive: ${alive.map(c => c.name).join(', ') || 'none'}`);
console.log(`Result: ${state.roundNumber < MAX_ROUNDS ? 'SUCCESS' : 'FAILED (hit max rounds)'}`);
