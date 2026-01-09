// Ziel: Einzelkampf-Ausführung für NEAT Tournament System
// Siehe: docs/services/combatantAI/algorithm-approaches.md

// ============================================================================
// INFRASTRUCTURE SETUP (vor allen anderen Imports!)
// ============================================================================

import { PresetVaultAdapter } from '../../../src/infrastructure/vault/PresetVaultAdapter';
import { setVault } from '../../../src/infrastructure/vault/vaultInstance';

// Presets importieren
import actionsPresets from '../../../presets/actions/index';
import creaturesPresets from '../../../presets/creatures/index';
import factionsPresets from '../../../presets/factions/index';
import npcsPresets from '../../../presets/npcs/index';
import charactersPresets from '../../../presets/characters/index';
import { getMapConfigForScenario } from '../../../presets/combatMaps/index';

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

import type { NPC } from '../../../src/types/entities/npc';
import type { EncounterGroup } from '../../../src/types/encounterTypes';
import type { CombatStateWithLayers, CombatantWithLayers } from '../../../src/types/combat';
import type { ActionSelector } from '../../../src/services/combatantAI/selectors/types';
import {
  initialiseCombat,
  isCombatOver,
  getCurrentCombatant,
  executeAction,
  getDeathProbability,
  getGroupId,
  formatProtocolEntry,
  formatBudget,
} from '../../../src/services/combatTracking';
import {
  isAllied,
  registerCoreModifiers,
} from '../../../src/services/combatantAI';

import type { ScenarioConfig } from './scenarios';

// Register core D&D 5e modifiers
registerCoreModifiers();

// ============================================================================
// TYPES
// ============================================================================

/**
 * Konfiguration für einen einzelnen Kampf.
 */
export interface FightConfig {
  /** Maximale Runden bevor der Kampf als Draw endet (default: 50) */
  maxRounds: number;
  /** Selector für Party-Seite */
  partySelector: ActionSelector;
  /** Selector für Enemy-Seite */
  enemySelector: ActionSelector;
  /** Debug-Output aktivieren */
  verbose?: boolean;
}

/**
 * Ergebnis eines einzelnen Kampfes.
 */
export interface FightResult {
  /** Gewinner des Kampfes */
  winner: 'party' | 'enemy' | 'draw';
  /** Anzahl der Runden */
  rounds: number;
  /** Schaden, den Party angerichtet hat */
  partyDamageDealt: number;
  /** Schaden, den Party erhalten hat */
  partyDamageReceived: number;
  /** Anzahl überlebender Party-Member */
  partySurvivors: number;
  /** Anzahl überlebender Enemies */
  enemySurvivors: number;
  /** Anzahl Party-Actions */
  partyActions: number;
  /** Anzahl Enemy-Actions */
  enemyActions: number;
  /** Gesamtzeit in ms */
  timeMs: number;
}

// ============================================================================
// HELPERS
// ============================================================================

function findNPC(id: string): NPC | undefined {
  return npcsPresets.find(npc => npc.id === id);
}

/**
 * Erstellt eine minimale EncounterGroup aus NPCs.
 */
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

/**
 * Zählt überlebende Combatants einer Seite.
 */
function countSurvivors(
  state: CombatStateWithLayers,
  isParty: boolean
): number {
  return state.combatants.filter(c => {
    const groupId = getGroupId(c);
    const isPartyAlly = groupId === 'party' || isAllied('party', groupId, state.alliances);
    return isParty === isPartyAlly && getDeathProbability(c) < 0.95;
  }).length;
}

// ============================================================================
// MAIN FUNCTION
// ============================================================================

/**
 * Führt einen einzelnen Kampf zwischen Party und Enemies durch.
 * Verwendet unterschiedliche Selectors für beide Seiten.
 */
export function runFight(
  scenario: ScenarioConfig,
  config: FightConfig
): FightResult {
  const { maxRounds, partySelector, enemySelector, verbose } = config;
  const start = performance.now();

  // NPCs laden
  const partyNpcs = scenario.partyIds.map(id => {
    const npc = findNPC(id);
    if (!npc) throw new Error(`Party NPC not found: ${id}`);
    return npc;
  });

  const enemyNpcs = scenario.enemyIds.map(id => {
    const npc = findNPC(id);
    if (!npc) throw new Error(`Enemy NPC not found: ${id}`);
    return npc;
  });

  // EncounterGroups erstellen
  const groups: EncounterGroup[] = [
    createEncounterGroup(partyNpcs, 'party'),
    createEncounterGroup(enemyNpcs, 'enemies'),
  ];

  // Map-Config laden (mit bounds und spawnZones)
  const mapConfig = getMapConfigForScenario(scenario.name);

  // Combat initialisieren
  const initStart = performance.now();
  const state = initialiseCombat({
    groups,
    alliances: { party: [], enemies: [] },
    party: { level: 1, size: scenario.partyIds.length, members: [] },
    resourceBudget: 1.0,
    encounterDistanceFeet: 60,
    initiativeOrder: [...scenario.partyIds, ...scenario.enemyIds],
    mapConfig,
  }) as CombatStateWithLayers;
  const initTime = performance.now() - initStart;
  if (initTime > 100) {
    console.log(`  [Fight] Combat init took ${initTime.toFixed(0)}ms`);
  }

  // Statistiken
  let partyActions = 0;
  let enemyActions = 0;

  // Combat Loop
  let turnCount = 0;
  const MAX_ACTIONS_PER_TURN = 10; // Safeguard gegen Endlosschleifen
  let actionsThisTurn = 0;
  let lastCombatantId: string | null = null;
  let lastRound = 0;

  while (!isCombatOver(state) && state.roundNumber < maxRounds) {
    // Log round transitions (every 10 rounds or in verbose mode)
    if (state.roundNumber !== lastRound) {
      lastRound = state.roundNumber;
      const alive = state.combatants.filter(c => getDeathProbability(c) < 0.95).length;
      if (verbose || state.roundNumber % 10 === 0) {
        console.log(`    [Fight] Round ${state.roundNumber}, ${alive} alive`);
      }
    }

    const combatant = getCurrentCombatant(state) as CombatantWithLayers | undefined;
    if (!combatant) break;

    // Neuer Combatant = neuer Turn
    if (combatant.id !== lastCombatantId) {
      actionsThisTurn = 0;
      lastCombatantId = combatant.id;
    }

    // Safeguard: Wenn zu viele Actions in einem Turn, force pass
    if (actionsThisTurn >= MAX_ACTIONS_PER_TURN) {
      if (verbose) {
        console.log(`[Fight] Force pass: ${combatant.name} exceeded ${MAX_ACTIONS_PER_TURN} actions`);
      }
      executeAction(combatant, { type: 'pass' }, state);
      continue;
    }

    // Selector basierend auf Alliance wählen
    const groupId = getGroupId(combatant);
    const isPartyAlly = groupId === 'party' || isAllied('party', groupId, state.alliances);
    const selector = isPartyAlly ? partySelector : enemySelector;

    // Budget vor Action loggen
    if (verbose) {
      console.log(`  ${formatBudget(state.currentTurnBudget)}`);
    }

    const turnStart = performance.now();
    const action = selector.selectNextAction(combatant, state, state.currentTurnBudget);
    const turnTime = performance.now() - turnStart;
    turnCount++;

    executeAction(combatant, action, state);

    // Protocol-Entry loggen (einheitliches Format)
    if (verbose) {
      const entry = state.protocol[state.protocol.length - 1];
      if (entry) {
        console.log(`  ${formatProtocolEntry(entry, { selectorName: selector.name, elapsedMs: turnTime })}`);
      }
    } else if (turnTime > 100) {
      // Nur bei langsamen Turns loggen wenn nicht verbose
      console.log(`  [Fight] Turn ${turnCount} (R${state.roundNumber}) ${combatant.name} took ${turnTime.toFixed(0)}ms`);
    }

    // Actions zählen
    if (action.type === 'action') {
      actionsThisTurn++;
      if (isPartyAlly) partyActions++;
      else enemyActions++;
    }
  }

  const elapsed = performance.now() - start;

  // Winner ermitteln
  const partyDead = state.combatants
    .filter(c => {
      const gid = getGroupId(c);
      return gid === 'party' || isAllied('party', gid, state.alliances);
    })
    .every(c => getDeathProbability(c) >= 0.95);

  const enemyDead = state.combatants
    .filter(c => {
      const gid = getGroupId(c);
      return gid !== 'party' && !isAllied('party', gid, state.alliances);
    })
    .every(c => getDeathProbability(c) >= 0.95);

  let winner: 'party' | 'enemy' | 'draw';
  if (enemyDead && !partyDead) winner = 'party';
  else if (partyDead && !enemyDead) winner = 'enemy';
  else winner = 'draw';

  return {
    winner,
    rounds: state.roundNumber,
    partyDamageDealt: state.enemyDPR,   // Enemy received = Party dealt
    partyDamageReceived: state.partyDPR, // Party received = Enemy dealt
    partySurvivors: countSurvivors(state, true),
    enemySurvivors: countSurvivors(state, false),
    partyActions,
    enemyActions,
    timeMs: elapsed,
  };
}

/**
 * Führt mehrere Kämpfe desselben Szenarios durch.
 * Nützlich für nicht-deterministische Selektoren.
 */
export function runFights(
  scenario: ScenarioConfig,
  config: FightConfig,
  iterations: number
): FightResult[] {
  const results: FightResult[] = [];
  for (let i = 0; i < iterations; i++) {
    results.push(runFight(scenario, config));
  }
  return results;
}

/**
 * Aggregiert mehrere FightResults zu Durchschnittswerten.
 */
export function aggregateFightResults(results: FightResult[]): {
  wins: number;
  losses: number;
  draws: number;
  avgRounds: number;
  totalDamageDealt: number;
  totalDamageReceived: number;
  avgSurvivors: number;
} {
  let wins = 0, losses = 0, draws = 0;
  let totalRounds = 0, totalDealt = 0, totalReceived = 0, totalSurvivors = 0;

  for (const r of results) {
    if (r.winner === 'party') wins++;
    else if (r.winner === 'enemy') losses++;
    else draws++;

    totalRounds += r.rounds;
    totalDealt += r.partyDamageDealt;
    totalReceived += r.partyDamageReceived;
    totalSurvivors += r.partySurvivors;
  }

  const n = results.length;
  return {
    wins,
    losses,
    draws,
    avgRounds: n > 0 ? totalRounds / n : 0,
    totalDamageDealt: totalDealt,
    totalDamageReceived: totalReceived,
    avgSurvivors: n > 0 ? totalSurvivors / n : 0,
  };
}

// ============================================================================
// CLI ENTRY POINT (disabled when bundled)
// ============================================================================

// Guard: Only run CLI when executed directly as TypeScript (not bundled)
// esbuild bundles import.meta.url differently, so we check for tsx
const isDirectExecution = typeof process !== 'undefined' &&
  process.argv[1]?.endsWith('.ts') &&
  import.meta.url === `file://${process.argv[1]}`;

if (isDirectExecution) {
  // Dynamische Imports für CLI
  import('../../../src/services/combatantAI').then(({ getSelector }) => {
    const args = process.argv.slice(2);
    const scenarioName = args[0] ?? '1v1 Melee';
    const partyName = args[1] ?? 'greedy';
    const enemyName = args[2] ?? 'random';

    // Lazy import scenarios to avoid circular dependency
    import('./scenarios').then(({ SCENARIOS }) => {
      const scenario = SCENARIOS.find(s => s.name === scenarioName);
      if (!scenario) {
        console.error(`Scenario not found: ${scenarioName}`);
        console.error(`Available: ${SCENARIOS.map(s => s.name).join(', ')}`);
        process.exit(1);
      }

      const partySelector = getSelector(partyName);
      const enemySelector = getSelector(enemyName);
      if (!partySelector || !enemySelector) {
        console.error(`Selector not found: ${partyName} or ${enemyName}`);
        process.exit(1);
      }

      console.log(`Fight: ${scenarioName}`);
      console.log(`Party: ${partyName}, Enemy: ${enemyName}`);
      console.log('');

      const result = runFight(scenario, {
        maxRounds: 50,
        partySelector,
        enemySelector,
        verbose: true,
      });

      console.log('');
      console.log(`Winner: ${result.winner}`);
      console.log(`Rounds: ${result.rounds}`);
      console.log(`Party Damage: dealt=${result.partyDamageDealt.toFixed(0)}, received=${result.partyDamageReceived.toFixed(0)}`);
      console.log(`Survivors: party=${result.partySurvivors}, enemy=${result.enemySurvivors}`);
      console.log(`Time: ${result.timeMs.toFixed(0)}ms`);
    });
  });
}
