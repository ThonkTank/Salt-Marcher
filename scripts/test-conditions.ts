// Ziel: Test der Condition-Application im Combat System
// Führt ein einzelnes Grapple-Szenario aus und prüft ob Conditions geloggt werden.

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

import {
  getSelector,
  registerCoreModifiers,
} from '../src/services/combatantAI';
import { runFight } from './evolution/tournament/fight';
import type { ScenarioConfig } from './evolution/tournament/scenarios';

// Register core D&D 5e modifiers
registerCoreModifiers();

// ============================================================================
// TEST
// ============================================================================

async function runConditionTest() {
  console.log('='.repeat(60));
  console.log('CONDITION APPLICATION TEST');
  console.log('Scenario: Grapple (2x Scout vs 2x Bugbear)');
  console.log('='.repeat(60));
  console.log('');

  const scenario: ScenarioConfig = {
    name: 'Grapple',
    partyIds: ['scout-finn', 'scout-mira'],
    enemyIds: ['bugbear-gruk', 'bugbear-thrak'],
  };

  const selector = getSelector('greedy');

  // Run fight with verbose output
  const result = runFight(scenario, {
    maxRounds: 15,
    partySelector: selector,
    enemySelector: selector,
    verbose: true,
  });

  console.log('');
  console.log('='.repeat(60));
  console.log('RESULTS');
  console.log('='.repeat(60));
  console.log(`Winner: ${result.winner}`);
  console.log(`Rounds: ${result.rounds}`);
  console.log('');

  // Check protocol for ALL notes
  console.log('All Protocol entries with notes:');
  for (const entry of result.protocol) {
    if (entry.notes && entry.notes.length > 0) {
      console.log(`  R${entry.round} ${entry.combatantName} [${entry.action.type}]: ${entry.notes.join(', ')}`);
    }
  }

  // Check for Grab actions specifically
  console.log('');
  console.log('Grab actions in protocol:');
  for (const entry of result.protocol) {
    if (entry.action.type === 'action' && entry.action.action?.name === 'Grab') {
      console.log(`  R${entry.round} ${entry.combatantName}: Grab → ${entry.action.target?.name}`);
      console.log(`    Notes: ${entry.notes?.join(', ') || '(none)'}`);
      console.log(`    damageDealt: ${entry.damageDealt}`);
    }
  }

  // Check combatants' conditions
  console.log('');
  console.log('Final Combatant Conditions:');
  for (const c of result.finalState.combatants) {
    const conditions = c.combatState.conditions;
    console.log(`  ${c.name}: ${conditions.length > 0 ? conditions.map(cc => `${cc.name}(${(cc.probability * 100).toFixed(0)}%)`).join(', ') : 'none'}`);
  }
}

runConditionTest().catch(console.error);
