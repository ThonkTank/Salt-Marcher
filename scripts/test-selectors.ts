// Ziel: Performance- und Success-Rate-Tests für CombatantAI Selektoren
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
import type { Character } from '../src/types/entities/character';
import type { EncounterGroup } from '../src/types/encounterTypes';
import type { CombatStateWithLayers, CombatantWithLayers } from '../src/types/combat';
import {
  initialiseCombat,
  createTurnBudget,
  isCombatOver,
  getCurrentCombatant,
  executeAction,
  getDeathProbability,
  getGroupId,
} from '../src/services/combatTracking';
import {
  getSelector,
  getRegisteredSelectors,
  isAllied,
  registerCoreModifiers,
} from '../src/services/combatantAI';

// Register core D&D 5e modifiers (schema-based)
registerCoreModifiers();

// ============================================================================
// CONFIGURATION
// ============================================================================

// Basis-Iterationen für schnelle Selektoren
const ITERATIONS = 100;
// Reduzierte Iterationen für langsame Selektoren (iterative ~800ms/Aufruf)
const SLOW_ITERATIONS = 10;
// Langsame Selektoren (>100ms pro Aufruf erwartet)
const SLOW_SELECTORS = ['iterative'];
// Combat-Simulationen pro Selektor für Quality-Test
const QUALITY_ITERATIONS = 20;
// Langsame Selektoren für Quality-Test
const QUALITY_SLOW_ITERATIONS = 3;
// Duell-Iterationen (Party-Selector vs Enemy-Selector)
const DUEL_ITERATIONS = 10;
// Langsame Duell-Iterationen
const DUEL_SLOW_ITERATIONS = 3;

interface ScenarioConfig {
  name: string;
  partyIds: string[];
  enemyIds: string[];
}

// Szenarien verwenden nur NPCs (da diese Actions aus ihrer Creature-Definition haben)
// Für AI-Tests ist es sinnvoller, NPCs zu verwenden
const SCENARIOS: ScenarioConfig[] = [
  {
    name: '1v1 Melee',
    partyIds: ['einaeugiger-pete'],  // Thug (HP 32)
    enemyIds: ['borgrik'],           // Hobgoblin (HP 11)
  },
  {
    name: '2v4 Mixed',
    partyIds: ['einaeugiger-pete', 'schwarzer-jack'],  // Thug + Bandit
    enemyIds: ['griknak', 'snaggle', 'borgrik', 'einsamer-wolf'],  // 2 Goblins + Hobgoblin + Wolf
  },
  {
    name: '1vN Horde',
    partyIds: ['borgrik'],  // Hobgoblin als starker Einzelkämpfer
    enemyIds: ['griknak', 'snaggle', 'schwarzer-jack', 'einsamer-wolf'],  // 4 schwächere NPCs
  },
];

// ============================================================================
// TYPES
// ============================================================================

interface SelectorStats {
  selectorName: string;
  scenarioName: string;
  avgMs: number;
  minMs: number;
  maxMs: number;
  successRate: number;
  actionTypes: Record<string, number>;
}

interface QualityStats {
  selectorName: string;
  scenarioName: string;
  avgWinProb: number;
  avgTpkRisk: number;
  avgRounds: number;
  avgSimTimeMs: number;
}

interface DuelResult {
  partySelector: string;
  enemySelector: string;
  scenario: string;
  // Aggregate Stats
  partyWinProb: number;
  avgRounds: number;
  avgSimTimeMs: number;
  // Per-Selector Timing (Durchschnitt)
  avgPartyTimeMs: number;
  avgEnemyTimeMs: number;
  avgPartyTurns: number;
  avgEnemyTurns: number;
  // Winner (aus letzter Iteration, nur bei verbose sinnvoll)
  lastWinner?: 'party' | 'enemies' | 'draw';
}

// ============================================================================
// HELPERS
// ============================================================================

function findNPC(id: string): NPC | undefined {
  return npcsPresets.find(npc => npc.id === id);
}

function findCharacter(id: string): Character | undefined {
  return charactersPresets.find(c => c.id === id) as Character | undefined;
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
 * Initialisiert einen Combat-State aus Party- und Enemy-IDs.
 * Beide Seiten verwenden NPCs für konsistente AI-Tests.
 */
function setupScenario(partyIds: string[], enemyIds: string[]): CombatStateWithLayers {
  // Party-NPCs finden
  const partyNpcs = partyIds.map(id => {
    const npc = findNPC(id);
    if (!npc) throw new Error(`Party NPC not found: ${id}`);
    return npc;
  });

  // Enemy-NPCs finden
  const enemyNpcs = enemyIds.map(id => {
    const npc = findNPC(id);
    if (!npc) throw new Error(`Enemy NPC not found: ${id}`);
    return npc;
  });

  // Beide als EncounterGroups erstellen
  const groups: EncounterGroup[] = [
    createEncounterGroup(partyNpcs, 'party'),
    createEncounterGroup(enemyNpcs, 'enemies'),
  ];

  const state = initialiseCombat({
    groups,
    alliances: {
      party: [],
      enemies: [],
    },
    party: {
      level: 1,
      size: 0,  // Keine "echten" Characters
      members: [],
    },
    resourceBudget: 1.0,
    encounterDistanceFeet: 60,
    initiativeOrder: [...partyIds, ...enemyIds],
  }) as CombatStateWithLayers;

  return state;
}

/**
 * Berechnet Party-Siegwahrscheinlichkeit aus Death-Probabilities.
 * Verhältnis: enemyDeath / (partyDeath + enemyDeath)
 */
function calculatePartyWinProbability(state: CombatStateWithLayers): number {
  let partyDeath = 0, enemyDeath = 0;
  for (const c of state.combatants) {
    const dp = getDeathProbability(c);
    const groupId = getGroupId(c);
    if (groupId === 'party' || isAllied('party', groupId, state.alliances)) {
      partyDeath += dp;
    } else {
      enemyDeath += dp;
    }
  }
  return enemyDeath / Math.max(1, partyDeath + enemyDeath);
}

/**
 * Berechnet TPK-Risiko als Produkt der Party-Death-Probabilities.
 */
function calculateTPKRisk(state: CombatStateWithLayers): number {
  let tpk = 1;
  for (const c of state.combatants) {
    const groupId = getGroupId(c);
    if (groupId === 'party' || isAllied('party', groupId, state.alliances)) {
      tpk *= getDeathProbability(c);
    }
  }
  return tpk;
}

/**
 * Läuft einen Selektor N Mal und sammelt Statistiken.
 */
function runSelector(
  selectorName: string,
  scenarioName: string,
  partyIds: string[],
  enemyIds: string[],
  iterations: number
): SelectorStats {
  const selector = getSelector(selectorName);
  if (!selector) {
    throw new Error(`Selector not found: ${selectorName}`);
  }

  const times: number[] = [];
  const actionTypes: Record<string, number> = { pass: 0, attack: 0, dash: 0, other: 0 };
  let successCount = 0;

  for (let i = 0; i < iterations; i++) {
    const state = setupScenario(partyIds, enemyIds);

    // Teste mit dem ersten Enemy-Combatant
    const combatant = state.combatants.find(c => c.combatState.groupId !== 'party');
    if (!combatant) continue;

    const budget = createTurnBudget(combatant);

    const start = performance.now();
    const action = selector.selectNextAction(combatant, state, budget);
    const elapsed = performance.now() - start;

    times.push(elapsed);

    // Statistik sammeln
    if (action.type === 'pass') {
      actionTypes.pass++;
    } else {
      successCount++;
      const actionName = action.action.name.toLowerCase();
      if (actionName.includes('attack') || actionName.includes('strike') || actionName.includes('bite') || actionName.includes('claw')) {
        actionTypes.attack++;
      } else if (actionName.includes('dash')) {
        actionTypes.dash++;
      } else {
        actionTypes.other++;
      }
    }
  }

  return {
    selectorName,
    scenarioName,
    avgMs: times.reduce((a, b) => a + b, 0) / times.length,
    minMs: Math.min(...times),
    maxMs: Math.max(...times),
    successRate: (successCount / iterations) * 100,
    actionTypes,
  };
}

/**
 * Läuft vollständige Combat-Simulationen mit einem Selektor.
 * Misst Entscheidungsqualität statt Performance.
 * Verwendet interne Combat-Loop statt simulatePMF().
 */
function runCombatSimulation(
  selectorName: string,
  scenarioName: string,
  partyIds: string[],
  enemyIds: string[],
  iterations: number
): QualityStats {
  const selector = getSelector(selectorName);
  if (!selector) {
    throw new Error(`Selector not found: ${selectorName}`);
  }

  const results: Array<{
    winProbability: number;
    tpkRisk: number;
    rounds: number;
    timeMs: number;
  }> = [];

  // Party-NPCs finden
  const partyNpcs = partyIds.map(id => {
    const npc = findNPC(id);
    if (!npc) throw new Error(`Party NPC not found: ${id}`);
    return npc;
  });

  // Enemy-NPCs finden
  const enemyNpcs = enemyIds.map(id => {
    const npc = findNPC(id);
    if (!npc) throw new Error(`Enemy NPC not found: ${id}`);
    return npc;
  });

  // Beide als EncounterGroups erstellen
  const groups: EncounterGroup[] = [
    createEncounterGroup(partyNpcs, 'party'),
    createEncounterGroup(enemyNpcs, 'enemies'),
  ];

  for (let i = 0; i < iterations; i++) {
    const start = performance.now();

    // State initialisieren
    const state = initialiseCombat({
      groups,
      alliances: { party: [], enemies: [] },
      party: { level: 1, size: partyIds.length, members: [] },
      resourceBudget: 1.0,
      encounterDistanceFeet: 60,
      initiativeOrder: [...partyIds, ...enemyIds],
    }) as CombatStateWithLayers;

    // Combat Loop
    while (!isCombatOver(state)) {
      const combatant = getCurrentCombatant(state) as CombatantWithLayers | undefined;
      if (!combatant) break;

      const action = selector.selectNextAction(combatant, state, state.currentTurnBudget);
      executeAction(combatant, action, state);
    }

    const elapsed = performance.now() - start;

    results.push({
      winProbability: calculatePartyWinProbability(state),
      tpkRisk: calculateTPKRisk(state),
      rounds: state.roundNumber,
      timeMs: elapsed,
    });
  }

  // Durchschnitte berechnen
  const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;

  return {
    selectorName,
    scenarioName,
    avgWinProb: avg(results.map(r => r.winProbability)) * 100,
    avgTpkRisk: avg(results.map(r => r.tpkRisk)) * 100,
    avgRounds: avg(results.map(r => r.rounds)),
    avgSimTimeMs: avg(results.map(r => r.timeMs)),
  };
}

/**
 * Läuft Selector-vs-Selector Duelle.
 * Party verwendet partySelectorName, Enemies verwenden enemySelectorName.
 * Bei verbose=true: Console-Output pro Turn + Winner-Anzeige.
 */
function runSelectorDuel(
  partySelectorName: string,
  enemySelectorName: string,
  scenarioName: string,
  partyIds: string[],
  enemyIds: string[],
  iterations: number,
  verbose: boolean = false
): DuelResult {
  const partySelector = getSelector(partySelectorName);
  const enemySelector = getSelector(enemySelectorName);
  if (!partySelector) throw new Error(`Party selector not found: ${partySelectorName}`);
  if (!enemySelector) throw new Error(`Enemy selector not found: ${enemySelectorName}`);

  const results: Array<{
    winProbability: number;
    rounds: number;
    timeMs: number;
    partyTimeMs: number;
    enemyTimeMs: number;
    partyTurns: number;
    enemyTurns: number;
    winner: 'party' | 'enemies' | 'draw';
  }> = [];

  // Party-NPCs finden
  const partyNpcs = partyIds.map(id => {
    const npc = findNPC(id);
    if (!npc) throw new Error(`Party NPC not found: ${id}`);
    return npc;
  });

  // Enemy-NPCs finden
  const enemyNpcs = enemyIds.map(id => {
    const npc = findNPC(id);
    if (!npc) throw new Error(`Enemy NPC not found: ${id}`);
    return npc;
  });

  // Beide als EncounterGroups erstellen
  const groups: EncounterGroup[] = [
    createEncounterGroup(partyNpcs, 'party'),
    createEncounterGroup(enemyNpcs, 'enemies'),
  ];

  for (let i = 0; i < iterations; i++) {
    const start = performance.now();

    // State initialisieren
    const state = initialiseCombat({
      groups,
      alliances: { party: [], enemies: [] },
      party: { level: 1, size: partyIds.length, members: [] },
      resourceBudget: 1.0,
      encounterDistanceFeet: 60,
      initiativeOrder: [...partyIds, ...enemyIds],
    }) as CombatStateWithLayers;

    // Per-Selector Timing
    let partyTimeMs = 0;
    let enemyTimeMs = 0;
    let partyTurns = 0;
    let enemyTurns = 0;

    // Combat Loop mit per-Alliance Selector
    while (!isCombatOver(state)) {
      const combatant = getCurrentCombatant(state) as CombatantWithLayers | undefined;
      if (!combatant) break;

      // Selector basierend auf Alliance wählen
      const groupId = getGroupId(combatant);
      const isPartyAlly = groupId === 'party' || isAllied('party', groupId, state.alliances);
      const selector = isPartyAlly ? partySelector : enemySelector;

      const turnStart = performance.now();
      const action = selector.selectNextAction(combatant, state, state.currentTurnBudget);
      const turnElapsed = performance.now() - turnStart;

      // Timing akkumulieren
      if (isPartyAlly) {
        partyTimeMs += turnElapsed;
        if (action.type === 'action') partyTurns++;
      } else {
        enemyTimeMs += turnElapsed;
        if (action.type === 'action') enemyTurns++;
      }

      // Verbose Output
      if (verbose && action.type === 'action' && action.target) {
        const selectorName = selector.name.slice(0, 3).toUpperCase();
        const targetDeath = (getDeathProbability(action.target) * 100).toFixed(0);
        console.log(`[TURN] R${state.roundNumber} ${selectorName} ${combatant.name}: ${action.action?.name ?? '?'} → ${action.target.name} [${targetDeath}%☠] (${turnElapsed.toFixed(1)}ms)`);
      }

      executeAction(combatant, action, state);
    }

    const elapsed = performance.now() - start;

    // Winner ermitteln
    const partyDead = state.combatants
      .filter(c => getGroupId(c) === 'party' || isAllied('party', getGroupId(c), state.alliances))
      .every(c => getDeathProbability(c) >= 0.95);
    const enemyDead = state.combatants
      .filter(c => getGroupId(c) !== 'party' && !isAllied('party', getGroupId(c), state.alliances))
      .every(c => getDeathProbability(c) >= 0.95);

    let winner: 'party' | 'enemies' | 'draw';
    if (enemyDead && !partyDead) winner = 'party';
    else if (partyDead && !enemyDead) winner = 'enemies';
    else winner = 'draw';

    // Verbose Summary
    if (verbose) {
      console.log(`\n>>> WINNER: ${winner.toUpperCase()} | Rounds: ${state.roundNumber} | Party: ${partyTurns} turns (${partyTimeMs.toFixed(0)}ms, ${(partyTimeMs / Math.max(1, partyTurns)).toFixed(1)}ms/turn) | Enemies: ${enemyTurns} turns (${enemyTimeMs.toFixed(0)}ms, ${(enemyTimeMs / Math.max(1, enemyTurns)).toFixed(1)}ms/turn)\n`);
    }

    results.push({
      winProbability: calculatePartyWinProbability(state),
      rounds: state.roundNumber,
      timeMs: elapsed,
      partyTimeMs,
      enemyTimeMs,
      partyTurns,
      enemyTurns,
      winner,
    });
  }

  const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;

  return {
    partySelector: partySelectorName,
    enemySelector: enemySelectorName,
    scenario: scenarioName,
    partyWinProb: avg(results.map(r => r.winProbability)) * 100,
    avgRounds: avg(results.map(r => r.rounds)),
    avgSimTimeMs: avg(results.map(r => r.timeMs)),
    avgPartyTimeMs: avg(results.map(r => r.partyTimeMs)),
    avgEnemyTimeMs: avg(results.map(r => r.enemyTimeMs)),
    avgPartyTurns: avg(results.map(r => r.partyTurns)),
    avgEnemyTurns: avg(results.map(r => r.enemyTurns)),
    lastWinner: results[results.length - 1]?.winner,
  };
}

// ============================================================================
// OUTPUT
// ============================================================================

function printTable(results: SelectorStats[]) {
  console.log('\n');
  console.log('='.repeat(85));
  console.log(' CombatantAI Selector Performance Test');
  console.log('='.repeat(85));
  console.log(`Iterations per test: ${ITERATIONS}`);
  console.log('');

  // Header
  const header = [
    'Scenario'.padEnd(12),
    'Selector'.padEnd(12),
    'avgMs'.padStart(8),
    'minMs'.padStart(8),
    'maxMs'.padStart(8),
    'Success%'.padStart(10),
    'Actions'.padEnd(20),
  ].join(' | ');

  console.log(header);
  console.log('-'.repeat(85));

  // Rows
  for (const r of results) {
    const actionSummary = `A:${r.actionTypes.attack} D:${r.actionTypes.dash} O:${r.actionTypes.other} P:${r.actionTypes.pass}`;
    const row = [
      r.scenarioName.padEnd(12),
      r.selectorName.padEnd(12),
      r.avgMs.toFixed(2).padStart(8),
      r.minMs.toFixed(2).padStart(8),
      r.maxMs.toFixed(2).padStart(8),
      `${r.successRate.toFixed(1)}%`.padStart(10),
      actionSummary.padEnd(20),
    ].join(' | ');
    console.log(row);
  }

  console.log('='.repeat(85));
  console.log('');
  console.log('Legend: A=Attack, D=Dash, O=Other, P=Pass');
  console.log('');
}

function printQualityTable(results: QualityStats[]) {
  console.log('\n');
  console.log('='.repeat(95));
  console.log(' CombatantAI Selector QUALITY Comparison');
  console.log('='.repeat(95));
  console.log(`Simulations per test: ${QUALITY_ITERATIONS} (slow: ${QUALITY_SLOW_ITERATIONS})`);
  console.log('');

  // Header
  const header = [
    'Scenario'.padEnd(12),
    'Selector'.padEnd(12),
    'WinProb'.padStart(10),
    'TPK Risk'.padStart(10),
    'Rounds'.padStart(8),
    'SimTime'.padStart(10),
  ].join(' | ');

  console.log(header);
  console.log('-'.repeat(95));

  // Rows
  for (const r of results) {
    const row = [
      r.scenarioName.padEnd(12),
      r.selectorName.padEnd(12),
      `${r.avgWinProb.toFixed(1)}%`.padStart(10),
      `${r.avgTpkRisk.toFixed(1)}%`.padStart(10),
      r.avgRounds.toFixed(1).padStart(8),
      `${r.avgSimTimeMs.toFixed(0)}ms`.padStart(10),
    ].join(' | ');
    console.log(row);
  }

  console.log('='.repeat(95));
  console.log('');
  console.log('WinProb = Party-Siegwahrscheinlichkeit (höher = besser für Party)');
  console.log('TPK Risk = Total Party Kill Risiko (niedriger = sicherer)');
  console.log('Rounds = Durchschnittliche Kampfdauer');
  console.log('');
}

function printDuelMatrix(results: DuelResult[], selectors: string[], scenarioName: string) {
  console.log('');
  console.log('='.repeat(80));
  console.log(` Duell-Matrix: ${scenarioName}`);
  console.log('='.repeat(80));
  console.log('');
  console.log('Party-WinProb% (Zeile = Party-Selector, Spalte = Enemy-Selector)');
  console.log('');

  // Build matrix data
  const matrix: Record<string, Record<string, number>> = {};
  for (const r of results) {
    if (r.scenario !== scenarioName) continue;
    if (!matrix[r.partySelector]) matrix[r.partySelector] = {};
    matrix[r.partySelector][r.enemySelector] = r.partyWinProb;
  }

  // Header row
  const colWidth = 10;
  const headerRow = ['Party\\Enemy'.padEnd(12), ...selectors.map(s => s.padStart(colWidth))].join(' | ');
  console.log(headerRow);
  console.log('-'.repeat(headerRow.length));

  // Data rows
  for (const partyS of selectors) {
    const cells = selectors.map(enemyS => {
      const val = matrix[partyS]?.[enemyS];
      if (val === undefined) return '-'.padStart(colWidth);
      // Highlight diagonal (same selector)
      const str = `${val.toFixed(1)}%`;
      return partyS === enemyS ? `[${str}]`.padStart(colWidth) : str.padStart(colWidth);
    });
    console.log([partyS.padEnd(12), ...cells].join(' | '));
  }

  console.log('');
  console.log('[] = Gleicher Selektor auf beiden Seiten (Baseline)');
  console.log('>50% = Party-Selektor überlegen, <50% = Enemy-Selektor überlegen');
  console.log('');
}

function printDuelSummary(results: DuelResult[], selectors: string[]) {
  console.log('');
  console.log('='.repeat(80));
  console.log(' Selector-Ranking (Durchschnitt über alle Szenarien)');
  console.log('='.repeat(80));
  console.log('');

  // Calculate average win rate as Party for each selector
  const avgAsParty: Record<string, { total: number; count: number }> = {};
  const avgAsEnemy: Record<string, { total: number; count: number }> = {};

  for (const s of selectors) {
    avgAsParty[s] = { total: 0, count: 0 };
    avgAsEnemy[s] = { total: 0, count: 0 };
  }

  for (const r of results) {
    avgAsParty[r.partySelector].total += r.partyWinProb;
    avgAsParty[r.partySelector].count++;
    avgAsEnemy[r.enemySelector].total += (100 - r.partyWinProb);  // Enemy win = 100 - Party win
    avgAsEnemy[r.enemySelector].count++;
  }

  // Sort by average win rate as Party
  const ranked = selectors
    .map(s => ({
      name: s,
      avgWinAsParty: avgAsParty[s].count > 0 ? avgAsParty[s].total / avgAsParty[s].count : 0,
      avgWinAsEnemy: avgAsEnemy[s].count > 0 ? avgAsEnemy[s].total / avgAsEnemy[s].count : 0,
    }))
    .sort((a, b) => b.avgWinAsParty - a.avgWinAsParty);

  console.log('Selector'.padEnd(12) + ' | ' + 'Avg Win% (Party)'.padStart(18) + ' | ' + 'Avg Win% (Enemy)'.padStart(18));
  console.log('-'.repeat(55));

  for (const r of ranked) {
    console.log(
      r.name.padEnd(12) + ' | ' +
      `${r.avgWinAsParty.toFixed(1)}%`.padStart(18) + ' | ' +
      `${r.avgWinAsEnemy.toFixed(1)}%`.padStart(18)
    );
  }

  console.log('');
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  const selectors = getRegisteredSelectors();
  const args = process.argv.slice(2);
  const runPerf = args.length === 0 || args.includes('--perf');
  const runQuality = args.length === 0 || args.includes('--quality');
  const runDuel = args.includes('--duel');
  const runDetailed = args.includes('--detailed');

  // Determine mode string
  const modes: string[] = [];
  if (runPerf && !runDuel && !runDetailed) modes.push('performance');
  if (runQuality && !runDuel && !runDetailed) modes.push('quality');
  if (runDuel) modes.push('duel');
  if (runDetailed) modes.push('detailed');

  console.log('Starting CombatantAI Selector Tests...');
  console.log(`Selectors: ${selectors.join(', ')}`);
  console.log(`Scenarios: ${SCENARIOS.map(s => s.name).join(', ')}`);
  console.log(`Mode: ${modes.join(', ') || 'all'}`);

  // =========================================================================
  // PERFORMANCE TEST
  // =========================================================================
  if (runPerf) {
    console.log('\n' + '='.repeat(60));
    console.log(' PHASE 1: Performance Test');
    console.log('='.repeat(60));

    const perfResults: SelectorStats[] = [];

    for (const scenario of SCENARIOS) {
      console.log(`\nTesting scenario: ${scenario.name}`);
      for (const selectorName of selectors) {
        const isSlow = SLOW_SELECTORS.includes(selectorName);
        const iterations = isSlow ? SLOW_ITERATIONS : ITERATIONS;
        process.stdout.write(`  ${selectorName} (${iterations}x)... `);
        try {
          const stats = runSelector(
            selectorName,
            scenario.name,
            scenario.partyIds,
            scenario.enemyIds,
            iterations
          );
          perfResults.push(stats);
          console.log(`done (avg: ${stats.avgMs.toFixed(2)}ms)`);
        } catch (err) {
          console.log(`FAILED: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    }

    printTable(perfResults);
  }

  // =========================================================================
  // QUALITY TEST (Combat Simulation)
  // =========================================================================
  if (runQuality) {
    console.log('\n' + '='.repeat(60));
    console.log(' PHASE 2: Quality Test (Combat Simulation)');
    console.log('='.repeat(60));

    const qualityResults: QualityStats[] = [];

    for (const scenario of SCENARIOS) {
      console.log(`\nSimulating scenario: ${scenario.name}`);
      for (const selectorName of selectors) {
        const isSlow = SLOW_SELECTORS.includes(selectorName);
        const iterations = isSlow ? QUALITY_SLOW_ITERATIONS : QUALITY_ITERATIONS;
        process.stdout.write(`  ${selectorName} (${iterations}x)... `);
        try {
          const stats = runCombatSimulation(
            selectorName,
            scenario.name,
            scenario.partyIds,
            scenario.enemyIds,
            iterations
          );
          qualityResults.push(stats);
          console.log(`done (WinProb: ${stats.avgWinProb.toFixed(1)}%, SimTime: ${stats.avgSimTimeMs.toFixed(0)}ms)`);
        } catch (err) {
          console.log(`FAILED: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    }

    printQualityTable(qualityResults);
  }

  // =========================================================================
  // DUEL TEST (Selector vs Selector)
  // =========================================================================
  if (runDuel) {
    console.log('\n' + '='.repeat(60));
    console.log(' PHASE 3: Duel Test (Selector vs Selector)');
    console.log('='.repeat(60));

    const duelResults: DuelResult[] = [];

    // Deterministische Selektoren für Duelle (random ist nur Benchmark)
    const duelSelectors = selectors.filter(s => s !== 'random');

    for (const scenario of SCENARIOS) {
      console.log(`\nDuel scenario: ${scenario.name}`);

      // All selector pairs (deterministisch → 1 Iteration reicht)
      for (const partyS of duelSelectors) {
        for (const enemyS of duelSelectors) {
          console.log(`\n  ${partyS.toUpperCase()} vs ${enemyS.toUpperCase()}:`);
          try {
            const result = runSelectorDuel(
              partyS,
              enemyS,
              scenario.name,
              scenario.partyIds,
              scenario.enemyIds,
              1,    // Deterministisch: 1 Iteration reicht
              true  // Verbose: Turn-by-Turn Output
            );
            duelResults.push(result);
          } catch (err) {
            console.log(`FAILED: ${err instanceof Error ? err.message : String(err)}`);
          }
        }
      }
    }

    // Print matrices for each scenario
    for (const scenario of SCENARIOS) {
      printDuelMatrix(duelResults, duelSelectors, scenario.name);
    }

    // Print summary ranking
    printDuelSummary(duelResults, duelSelectors);
  }

  // =========================================================================
  // DETAILED DUEL TEST (einzelne Kämpfe mit Turn-by-Turn Output)
  // =========================================================================
  if (runDetailed) {
    console.log('\n' + '='.repeat(60));
    console.log(' DETAILED DUEL TEST (Turn-by-Turn)');
    console.log('='.repeat(60));

    // Parse optionale Argumente: --detailed greedy random
    const detailedArgs = args.slice(args.indexOf('--detailed') + 1).filter(a => !a.startsWith('--'));
    const partyS = detailedArgs[0] ?? 'greedy';
    const enemyS = detailedArgs[1] ?? 'greedy';

    // Nur erstes Szenario für Detailansicht
    const scenario = SCENARIOS[0];

    console.log(`\n${partyS.toUpperCase()} (Party) vs ${enemyS.toUpperCase()} (Enemies)`);
    console.log(`Scenario: ${scenario.name}`);
    console.log('-'.repeat(60));

    try {
      runSelectorDuel(partyS, enemyS, scenario.name, scenario.partyIds, scenario.enemyIds, 1, true);
    } catch (err) {
      console.log(`FAILED: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  console.log('All tests completed.');
}

main().catch(console.error);
