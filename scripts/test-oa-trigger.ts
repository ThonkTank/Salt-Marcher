// Ziel: Integration Test für Opportunity Attack Trigger
// Siehe: docs/services/combatantAI/combatantAI.md

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
import type { CombatStateWithLayers, CombatantWithLayers } from '../src/types/combat';
import {
  initialiseCombat,
  getCurrentCombatant,
  executeAction,
} from '../src/services/combatTracking';
import {
  getSelector,
  registerCoreModifiers,
} from '../src/services/combatantAI';

// Register core D&D 5e modifiers (schema-based)
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

// ============================================================================
// OA TRIGGER TEST
// ============================================================================

// Custom Map: Scout + Goblin in Melee Range
// Scout und Goblin starten nebeneinander (1 Zelle = 5ft)
const oaTestMapConfig = {
  terrainMap: new Map(),  // Leere Map = offenes Feld
  bounds: { minX: 0, maxX: 10, minY: 0, maxY: 10 },
  spawnZones: {
    party: { minX: 5, maxX: 5, minY: 5, maxY: 5 },    // Scout startet hier (5,5)
    enemies: { minX: 6, maxX: 6, minY: 5, maxY: 5 },  // Goblin direkt daneben (6,5) = 5ft
  },
};

function runOATest() {
  console.log('='.repeat(60));
  console.log(' OA TRIGGER TEST');
  console.log('='.repeat(60));
  console.log('');
  console.log('Scenario: Scout (ranged) starts adjacent to Goblin (melee)');
  console.log('Expected: Scout moves away → Goblin triggers OA');
  console.log('');

  // Find NPCs
  const scout = findNPC('scout-finn');
  const goblin = findNPC('griknak');
  if (!scout || !goblin) throw new Error('NPCs not found');

  // Create encounter groups
  const groups: EncounterGroup[] = [
    createEncounterGroup([scout], 'party'),
    createEncounterGroup([goblin], 'enemies'),
  ];

  // Initialize combat with custom positions
  const state = initialiseCombat({
    groups,
    alliances: { party: [], enemies: [] },
    party: { level: 1, size: 1, members: [] },
    resourceBudget: 1.0,
    encounterDistanceFeet: 5,  // Start in melee
    initiativeOrder: [scout.id, goblin.id],  // Scout geht zuerst
    mapConfig: oaTestMapConfig,
  }) as CombatStateWithLayers;

  // Log initial positions
  console.log('Initial Positions:');
  for (const c of state.combatants) {
    const pos = c.combatState.position;
    console.log(`  ${c.name}: (${pos.x}, ${pos.y}) - HP: ${c.combatState.currentHp}/${c.maxHp}`);
  }
  console.log('');

  // Check if combatants are adjacent (distance = 1 cell = 5ft)
  const scoutPos = state.combatants.find(c => c.name.includes('Finn'))?.combatState.position;
  const goblinPos = state.combatants.find(c => c.name.includes('Griknak'))?.combatState.position;
  if (scoutPos && goblinPos) {
    const dx = Math.abs(scoutPos.x - goblinPos.x);
    const dy = Math.abs(scoutPos.y - goblinPos.y);
    const dist = Math.max(dx, dy);
    console.log(`Distance between Scout and Goblin: ${dist} cell(s) = ${dist * 5}ft`);
    if (dist <= 1) {
      console.log('✓ Combatants are in melee range (≤1 cell)');
    } else {
      console.log('✗ Combatants are NOT in melee range!');
    }
  }
  console.log('');

  // Debug: Check Effect Layers
  console.log('\n--- Effect Layers Debug ---');
  for (const c of state.combatants as CombatantWithLayers[]) {
    const effectLayers = c.combatState.effectLayers ?? [];
    console.log(`${c.name}: ${effectLayers.length} effect layers`);
    for (const layer of effectLayers) {
      console.log(`  - ${layer.effectId}: type=${layer.effectType}, range=${layer.range}, hasReactionAction=${!!layer.reactionAction}`);
      if (layer.reactionAction) {
        console.log(`    Action: ${layer.reactionAction.name}, damage=${JSON.stringify(layer.reactionAction.damage)}, attack=${JSON.stringify(layer.reactionAction.attack)}`);
      }
    }
  }
  console.log('');

  // Run first turn (Scout's turn)
  const selector = getSelector('greedy');
  if (!selector) throw new Error('Selector not found');

  const scoutCombatant = getCurrentCombatant(state) as CombatantWithLayers | undefined;
  if (!scoutCombatant) throw new Error('No current combatant');

  console.log(`--- ${scoutCombatant.name}'s Turn ---`);
  console.log(`Current budget: action=${state.currentTurnBudget.action}, bonus=${state.currentTurnBudget.bonusAction}, move=${state.currentTurnBudget.movement}`);
  console.log('');

  // Select action
  const action = selector.selectNextAction(scoutCombatant, state, state.currentTurnBudget);

  if (action.type === 'action') {
    console.log(`Selected Action: ${action.action?.name ?? '?'}`);
    if (action.target) {
      console.log(`Target: ${action.target.name}`);
    }
    if (action.cell) {
      console.log(`Move to: (${action.cell.x}, ${action.cell.y})`);
    }
    if (action.score !== undefined) {
      console.log(`Score: ${action.score.toFixed(2)}`);
    }
  } else {
    console.log('Selected Action: PASS');
  }
  console.log('');

  // Execute and check for OA in protocol
  const beforeProtocolLen = state.protocol.length;
  executeAction(scoutCombatant, action, state);

  // Check protocol for reaction entries
  console.log('Protocol entries after execution:');
  let oaTriggered = false;
  for (let i = beforeProtocolLen; i < state.protocol.length; i++) {
    const entry = state.protocol[i] as {
      type?: string;
      combatantName?: string;
      actionName?: string;
      hpChanges?: { combatantName: string; delta: number }[];
      reactionEntries?: { type: string; reactorName: string; trigger: string; damageDealt?: number }[];
    };
    const hpInfo = entry.hpChanges?.map(h => `${h.combatantName} ${h.delta > 0 ? '+' : ''}${h.delta}HP`).join(', ') || '';
    console.log(`  [${entry.type ?? 'action'}] ${entry.combatantName}: ${entry.actionName ?? 'unknown'}${hpInfo ? ` (${hpInfo})` : ''}`);

    // Check nested reactionEntries for OA
    if (entry.reactionEntries && entry.reactionEntries.length > 0) {
      for (const reaction of entry.reactionEntries) {
        console.log(`    >>> REACTION: [${reaction.type}] ${reaction.reactorName}: ${reaction.trigger}, damage=${reaction.damageDealt}`);
        if (reaction.type === 'reaction' && reaction.trigger === 'leaves-reach') {
          oaTriggered = true;
          console.log('    >>> OA TRIGGERED! <<<');
        }
      }
    }
  }
  console.log('');

  // Final positions
  console.log('Final Positions:');
  for (const c of state.combatants) {
    const pos = c.combatState.position;
    console.log(`  ${c.name}: (${pos.x}, ${pos.y}) - HP: ${c.combatState.currentHp}/${c.maxHp}`);
  }
  console.log('');

  // Summary
  console.log('='.repeat(60));
  console.log(' TEST SUMMARY');
  console.log('='.repeat(60));

  const finalScoutPos = state.combatants.find(c => c.name.includes('Finn'))?.combatState.position;
  const scoutMoved = finalScoutPos && scoutPos && (finalScoutPos.x !== scoutPos.x || finalScoutPos.y !== scoutPos.y);

  console.log(`Scout moved away: ${scoutMoved ? '✓ YES' : '✗ NO'}`);
  console.log(`OA triggered: ${oaTriggered ? '✓ YES' : '✗ NO'}`);

  // Check Scout HP for OA damage
  const finalScoutHp = state.combatants.find(c => c.name.includes('Finn'))?.combatState.currentHp;
  const initialScoutHp = scout.currentHp?.[0]?.[0] ?? 16;
  const hpLost = initialScoutHp - (finalScoutHp ?? initialScoutHp);
  if (hpLost > 0) {
    console.log(`Scout HP lost: ${hpLost} (OA damage from Goblin's Scimitar: 1d6+2 = 3-8)`);
  }

  console.log('');
  if (scoutMoved && oaTriggered) {
    console.log('✓ TEST PASSED: OA correctly triggered when Scout left Goblin\'s reach');
  } else if (!scoutMoved) {
    console.log('? Scout decided not to move (AI may prefer melee or consider OA cost too high)');
  } else {
    console.log('✗ TEST FAILED: Scout moved but OA was not triggered');
  }
}

runOATest();
