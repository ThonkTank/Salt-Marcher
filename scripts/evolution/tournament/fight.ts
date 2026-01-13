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
import encounterPresets from '../../../presets/encounters/index';
import { getMapConfigForScenario } from '../../../presets/combatMaps/index';

// Vault initialisieren BEVOR andere Module geladen werden
const vaultAdapter = new PresetVaultAdapter();
vaultAdapter.register('action', actionsPresets);
vaultAdapter.register('creature', creaturesPresets);
vaultAdapter.register('faction', factionsPresets);
vaultAdapter.register('npc', npcsPresets);
vaultAdapter.register('character', charactersPresets);
vaultAdapter.register('encounter', encounterPresets);
setVault(vaultAdapter);

// ============================================================================
// IMPORTS (nach Vault-Initialisierung)
// ============================================================================

import type { CombatStateWithLayers, CombatantWithLayers } from '../../../src/types/combat';
import type { ActionSelector } from '../../../src/services/combatantAI/selectors/types';
import {
  isCombatOver,
  getCurrentCombatant,
  executeAction,
  getDeathProbability,
  getGroupId,
  formatProtocolEntry,
  formatBudget,
  getHP,
} from '../../../src/services/combatTracking';
import { getExpectedValue } from '../../../src/utils/probability';
import {
  isAllied,
  registerCoreModifiers,
} from '../../../src/services/combatantAI';

import type { EncounterPreset, AuthoredPreset } from '../../../src/types/entities/encounterPreset';
import { loadEncounterPreset } from '../../../src/services/encounterLoader';
import { getTournamentPresetByName, tournamentPresets } from '../../../presets/encounters';

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

  // === Erweiterte Statistiken ===

  /** Party-Treffer */
  partyHits: number;
  /** Party-Fehlschläge */
  partyMisses: number;
  /** Enemy-Treffer */
  enemyHits: number;
  /** Enemy-Fehlschläge */
  enemyMisses: number;
  /** Kills durch Party */
  partyKills: number;
  /** Kills durch Enemy */
  enemyKills: number;
  /** Party Start-HP */
  partyStartHP: number;
  /** Party End-HP */
  partyEndHP: number;
  /** Enemy Start-HP */
  enemyStartHP: number;
  /** Enemy End-HP */
  enemyEndHP: number;
}

// ============================================================================
// HELPERS
// ============================================================================

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

/**
 * Berechnet die aktuelle HP einer Seite (Expected Value aus PMF).
 */
function calculateCurrentHP(
  state: CombatStateWithLayers,
  isParty: boolean
): number {
  return state.combatants
    .filter(c => {
      const groupId = getGroupId(c);
      const isPartyAlly = groupId === 'party' || isAllied('party', groupId, state.alliances);
      return isParty === isPartyAlly;
    })
    .reduce((sum, c) => sum + Math.max(0, getExpectedValue(getHP(c))), 0);
}

// ============================================================================
// MAIN FUNCTION
// ============================================================================

/**
 * Führt einen einzelnen Kampf zwischen Party und Enemies durch.
 * Verwendet unterschiedliche Selectors für beide Seiten.
 */
export function runFight(
  preset: AuthoredPreset,
  config: FightConfig
): FightResult {
  const { maxRounds, partySelector, enemySelector, verbose } = config;
  const start = performance.now();

  // Map-Config laden (mit bounds und spawnZones)
  const mapConfig = preset.combat?.mapId
    ? getMapConfigForScenario(preset.combat.mapId)
    : undefined;

  // Combat via Preset-System initialisieren
  const initStart = performance.now();
  const state = loadEncounterPreset(
    preset,
    { level: 1, size: 0, members: [] },  // Leere Party (beide Seiten sind NPCs)
    { overrideMapConfig: mapConfig }
  ) as CombatStateWithLayers;
  const initTime = performance.now() - initStart;
  if (initTime > 100) {
    console.log(`  [Fight] Combat init took ${initTime.toFixed(0)}ms`);
  }

  // Statistiken
  let partyActions = 0;
  let enemyActions = 0;

  // Combat Loop (identisch mit runFight)
  let turnCount = 0;
  const MAX_ACTIONS_PER_TURN = 10;
  let actionsThisTurn = 0;
  let lastCombatantId: string | null = null;
  let lastRound = 0;

  while (!isCombatOver(state) && state.roundNumber < maxRounds) {
    if (state.roundNumber !== lastRound) {
      lastRound = state.roundNumber;
      const alive = state.combatants.filter(c => getDeathProbability(c) < 0.95).length;
      if (verbose || state.roundNumber % 10 === 0) {
        console.log(`    [Fight] Round ${state.roundNumber}, ${alive} alive`);
      }
    }

    const combatant = getCurrentCombatant(state) as CombatantWithLayers | undefined;
    if (!combatant) break;

    if (combatant.id !== lastCombatantId) {
      actionsThisTurn = 0;
      lastCombatantId = combatant.id;
    }

    if (actionsThisTurn >= MAX_ACTIONS_PER_TURN) {
      if (verbose) {
        console.log(`[Fight] Force pass: ${combatant.name} exceeded ${MAX_ACTIONS_PER_TURN} actions`);
      }
      executeAction(combatant, { type: 'pass' }, state);
      continue;
    }

    const groupId = getGroupId(combatant);
    const isPartyAlly = groupId === 'party' || isAllied('party', groupId, state.alliances);
    const selector = isPartyAlly ? partySelector : enemySelector;

    if (verbose) {
      console.log(`  ${formatBudget(state.currentTurnBudget)}`);
    }

    const turnStart = performance.now();
    const action = selector.selectNextAction(combatant, state, state.currentTurnBudget);
    const turnTime = performance.now() - turnStart;
    turnCount++;

    executeAction(combatant, action, state);

    if (verbose) {
      const entry = state.protocol[state.protocol.length - 1];
      if (entry) {
        console.log(`  ${formatProtocolEntry(entry, { selectorName: selector.name, elapsedMs: turnTime })}`);
      }
    } else if (turnTime > 100) {
      console.log(`  [Fight] Turn ${turnCount} (R${state.roundNumber}) ${combatant.name} took ${turnTime.toFixed(0)}ms`);
    }

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
    partyDamageDealt: state.partyDPR,
    partyDamageReceived: state.enemyDPR,
    partySurvivors: countSurvivors(state, true),
    enemySurvivors: countSurvivors(state, false),
    partyActions,
    enemyActions,
    timeMs: elapsed,
    partyHits: state.partyHits,
    partyMisses: state.partyMisses,
    enemyHits: state.enemyHits,
    enemyMisses: state.enemyMisses,
    partyKills: state.partyKills,
    enemyKills: state.enemyKills,
    partyStartHP: state.partyStartHP,
    partyEndHP: calculateCurrentHP(state, true),
    enemyStartHP: state.enemyStartHP,
    enemyEndHP: calculateCurrentHP(state, false),
  };
}

/**
 * Führt mehrere Kämpfe desselben Szenarios durch.
 * Nützlich für nicht-deterministische Selektoren.
 */
export function runFights(
  preset: EncounterPreset,
  config: FightConfig,
  iterations: number
): FightResult[] {
  const results: FightResult[] = [];
  for (let i = 0; i < iterations; i++) {
    results.push(runFight(preset as AuthoredPreset, config));
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
  // Erweiterte Statistiken
  totalHits: number;
  totalMisses: number;
  hitRate: number;
  totalKills: number;
  totalDeaths: number;
  avgHPLostPercent: number;
  avgEnemyHPLostPercent: number;
} {
  let wins = 0, losses = 0, draws = 0;
  let totalRounds = 0, totalDealt = 0, totalReceived = 0, totalSurvivors = 0;
  // Erweiterte Zähler
  let totalHits = 0, totalMisses = 0;
  let totalKills = 0, totalDeaths = 0;
  let totalHPLostPercent = 0, totalEnemyHPLostPercent = 0;

  for (const r of results) {
    if (r.winner === 'party') wins++;
    else if (r.winner === 'enemy') losses++;
    else draws++;

    totalRounds += r.rounds;
    totalDealt += r.partyDamageDealt;
    totalReceived += r.partyDamageReceived;
    totalSurvivors += r.partySurvivors;

    // Erweiterte Statistiken aggregieren
    totalHits += r.partyHits;
    totalMisses += r.partyMisses;
    totalKills += r.partyKills;
    totalDeaths += r.enemyKills;  // Enemy kills = Party deaths

    // HP-Lost Prozent (sicher gegen Division durch 0)
    if (r.partyStartHP > 0) {
      totalHPLostPercent += (r.partyStartHP - r.partyEndHP) / r.partyStartHP;
    }
    if (r.enemyStartHP > 0) {
      totalEnemyHPLostPercent += (r.enemyStartHP - r.enemyEndHP) / r.enemyStartHP;
    }
  }

  const n = results.length;
  const totalAttempts = totalHits + totalMisses;

  return {
    wins,
    losses,
    draws,
    avgRounds: n > 0 ? totalRounds / n : 0,
    totalDamageDealt: totalDealt,
    totalDamageReceived: totalReceived,
    avgSurvivors: n > 0 ? totalSurvivors / n : 0,
    // Erweiterte Statistiken
    totalHits,
    totalMisses,
    hitRate: totalAttempts > 0 ? totalHits / totalAttempts : 0,
    totalKills,
    totalDeaths,
    avgHPLostPercent: n > 0 ? totalHPLostPercent / n : 0,
    avgEnemyHPLostPercent: n > 0 ? totalEnemyHPLostPercent / n : 0,
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

    // Preset aus tournamentPresets suchen
    const preset = getTournamentPresetByName(scenarioName);
    if (!preset) {
      console.error(`Preset not found: ${scenarioName}`);
      console.error(`Available: ${tournamentPresets.map(p => p.name).join(', ')}`);
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

    const result = runFight(preset, {
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
}
