// Ziel: Konsolidierte Combat-Initialisierung
// Siehe: docs/services/combatTracking.md
//
// Combat-State Creation:
// 1. Party-Combatants erstellen (Characters aus Vault)
// 2. Enemy-Combatants erstellen (NPCs aus Groups)
// 3. Resources initialisieren (Spell Slots × resourceBudget)
// 4. Combat-State initialisieren (Grid, Positionen, turnOrder)

// ============================================================================
// HACK & TODO
// ============================================================================
//
// [HACK]: Keine Surprise-Prüfung
// - checkSurprise() liefert immer keine Surprise
// - Spec: difficulty.md#5.0.5 prüft Activity.awareness
//
// [HACK]: Party-Resources nicht initialisiert
// - createPartyCombatants() initialisiert keine resources für Characters
// - Spell-Slot-Tracking für PCs fehlt vollständig
// - Ideal: Character.spellSlots nutzen oder aus Class/Level ableiten
//
// [HACK]: Recharge-Timer startet immer bei 0 (verfuegbar)
// - initializeResources() setzt Timer auf 0 fuer alle Recharge-Abilities
// - Realistischer waere: resourceBudget-skalierte Wahrscheinlichkeit ob verfuegbar
//
// [HACK]: Recharge-Timer nutzt deterministischen expectedTurns statt Wuerfel
// - consumeActionResource() setzt Timer auf Math.ceil(1/probability)
// - z.B. Recharge 5-6 (33%) → 3 Runden Cooldown
//
// [HACK]: Spell Slot Skalierung kann 0 ergeben bei niedrigem Budget
// - Math.floor(maxSlots * resourceBudget) → 0 bei budget < 1/maxSlots

import type { EncounterGroup } from '@/types/encounterTypes';
import type { Character, Action } from '@/types/entities';
import type { NPC } from '@/types/entities/npc';
import type {
  Combatant,
  NPCInCombat,
  CharacterInCombat,
  CombatState,
  CombatStateWithLayers,
  SurpriseState,
  CombatResources,
} from '@/types/combat';
import { vault } from '@/infrastructure/vault/vaultInstance';
import { createSingleValue, feetToCell } from '@/utils';
import { initializeGrid, DEFAULT_ENCOUNTER_DISTANCE_FEET } from '../gridSpace';
import { getResolvedCreature, createTurnBudget } from './combatState';
import { initializeLayers, precomputeBaseResolutions } from '../combatantAI/layers';
import { calculateSpawnPositions } from '../combatTerrain';
import type { CombatMapConfig } from '@/types/combatTerrain';

// ============================================================================
// DEBUG HELPER
// ============================================================================

const debug = (...args: unknown[]) => {
  if (process.env.DEBUG_SERVICES === 'true') {
    console.log('[initialiseCombat]', ...args);
  }
};

// ============================================================================
// TYPES
// ============================================================================

/** Input-Typ für Party. */
export interface PartyInput {
  level: number;
  size: number;
  members: { id: string; level: number; hp: number; ac: number }[];
}

// ============================================================================
// RESOURCE MANAGEMENT (Combat-State, nicht AI)
// ============================================================================

/**
 * Initialisiert Combat-Resources fuer einen Combatant.
 * Skaliert Spell Slots und Per-Day Uses basierend auf resourceBudget.
 * HACK: Recharge-Timer startet bei 0, Spell Slots koennen 0 werden - siehe Header.
 *
 * @param actions Die Actions des Combatants
 * @param spellSlots Optionale Spell Slot Konfiguration (aus CreatureDefinition)
 * @param resourceBudget Budget 0-1 (1 = volle Ressourcen, 0.5 = 50%)
 * @returns Initialisierte CombatResources
 */
export function initializeResources(
  actions: Action[],
  spellSlots: Record<string, number> | undefined,
  resourceBudget: number
): CombatResources {
  const resources: CombatResources = {};

  // 1. Spell Slots (skaliert mit resourceBudget)
  if (spellSlots && Object.keys(spellSlots).length > 0) {
    resources.spellSlots = {};
    for (const [levelStr, maxSlots] of Object.entries(spellSlots)) {
      const level = Number(levelStr);
      resources.spellSlots[level] = Math.floor(maxSlots * resourceBudget);
    }
    debug('initializeResources: spellSlots', resources.spellSlots);
  }

  // 2. Recharge Abilities (Timer startet bei 0 = verfuegbar)
  const rechargeActions = actions.filter(a => a.recharge?.type === 'recharge');
  if (rechargeActions.length > 0) {
    resources.rechargeTimers = {};
    for (const action of rechargeActions) {
      resources.rechargeTimers[action.id] = 0;  // Startet verfuegbar
    }
    debug('initializeResources: rechargeTimers', resources.rechargeTimers);
  }

  // 3. Per-Day / Per-Rest Uses (skaliert mit resourceBudget)
  const limitedActions = actions.filter(a =>
    a.recharge?.type === 'per-day' || a.recharge?.type === 'per-rest'
  );
  if (limitedActions.length > 0) {
    resources.perDayUses = {};
    for (const action of limitedActions) {
      const recharge = action.recharge as { type: 'per-day' | 'per-rest'; uses: number };
      resources.perDayUses[action.id] = Math.floor(recharge.uses * resourceBudget);
    }
    debug('initializeResources: perDayUses', resources.perDayUses);
  }

  return resources;
}

/**
 * Konsumiert Ressourcen nach Ausfuehrung einer Action.
 * Dekrementiert Spell Slots, setzt Recharge Timer, oder dekrementiert Uses.
 * HACK: Recharge-Timer deterministisch - siehe Header.
 *
 * @param action Die ausgefuehrte Action
 * @param resources Die zu aktualisierenden Resources (mutiert!)
 */
export function consumeActionResource(
  action: Action,
  resources: CombatResources | undefined
): void {
  if (!resources) return;

  // 1. Spell Slot
  if (action.spellSlot && resources.spellSlots) {
    const level = action.spellSlot.level;
    if (resources.spellSlots[level] > 0) {
      resources.spellSlots[level]--;
      debug('consumeActionResource: spell slot', { action: action.id, level, remaining: resources.spellSlots[level] });
    }
  }

  // 2. Recharge (setzt Timer auf erwartete Runden bis Recharge)
  if (action.recharge?.type === 'recharge' && resources.rechargeTimers) {
    const [min, max] = action.recharge.range;
    const prob = (max - min + 1) / 6;  // z.B. [5,6] = 2/6 = 33%
    const expectedTurns = Math.ceil(1 / prob);  // z.B. 33% = 3 Runden
    resources.rechargeTimers[action.id] = expectedTurns;
    debug('consumeActionResource: recharge timer', { action: action.id, timer: expectedTurns });
  }

  // 3. Per-Day / Per-Rest
  if (
    (action.recharge?.type === 'per-day' || action.recharge?.type === 'per-rest') &&
    resources.perDayUses
  ) {
    if (resources.perDayUses[action.id] > 0) {
      resources.perDayUses[action.id]--;
      debug('consumeActionResource: per-day use', { action: action.id, remaining: resources.perDayUses[action.id] });
    }
  }
}

/**
 * Dekrementiert alle Recharge-Timer um 1 (zu Beginn eines Zuges aufrufen).
 * Timer bei 0 bleiben bei 0 (Action ist verfuegbar).
 *
 * @param resources Die zu aktualisierenden Resources (mutiert!)
 */
export function tickRechargeTimers(resources: CombatResources | undefined): void {
  if (!resources?.rechargeTimers) return;

  for (const actionId of Object.keys(resources.rechargeTimers)) {
    if (resources.rechargeTimers[actionId] > 0) {
      resources.rechargeTimers[actionId]--;
      debug('tickRechargeTimers:', { actionId, newTimer: resources.rechargeTimers[actionId] });
    }
  }
}

// ============================================================================
// SURPRISE (STUB)
// ============================================================================

/** Prüft Surprise-State. HACK: siehe Header (Activity.awareness nicht geprüft) */
function checkSurprise(): SurpriseState {
  return {
    partyHasSurprise: false,
    enemyHasSurprise: false,
  };
}

// ============================================================================
// INDIVIDUAL COMBATANT PREPARATION
// ============================================================================

/**
 * Bereitet einen Character für Combat vor.
 * Fügt CombatantState hinzu.
 *
 * @param character Der Character aus dem Vault
 * @returns CharacterInCombat mit combatState
 */
function prepareCharacterForCombat(character: Character): CharacterInCombat {
  return {
    ...character,
    combatState: {
      position: { x: 0, y: 0, z: 0 },
      conditions: [],
      modifiers: [],
      groupId: 'party',
      isDead: false,
    },
  };
}

/**
 * Bereitet einen NPC für Combat vor.
 * Fügt CombatantState hinzu und initialisiert Resources.
 *
 * @param npc Der NPC aus dem Encounter
 * @param groupId Die Encounter-Gruppen-ID (UUID)
 * @param resourceBudget Budget 0-1 für Ressourcen
 * @returns NPCInCombat mit combatState
 */
function prepareNPCForCombat(
  npc: NPC,
  groupId: string,
  resourceBudget: number = 1.0
): NPCInCombat {
  const { actions } = getResolvedCreature(npc.creature.id);
  const creature = getResolvedCreature(npc.creature.id).definition;

  const resources = initializeResources(
    actions,
    creature.spellSlots,
    resourceBudget
  );

  return {
    ...npc,
    combatState: {
      position: { x: 0, y: 0, z: 0 },
      conditions: [],
      modifiers: [],
      resources,
      groupId,
      isDead: false,
    },
  };
}

// ============================================================================
// BATCH COMBATANT CREATION
// ============================================================================

/**
 * Erstellt Party-Combatants für die Combat-Simulation.
 * Verwendet prepareCharacterForCombat für jeden Party-Member.
 * @param party Party-Input mit Members
 * @returns CharacterInCombat[] für die Simulation
 */
function createPartyCombatants(party: PartyInput): CharacterInCombat[] {
  return party.members.map((member) => {
    try {
      const character = vault.getEntity<Character>('character', member.id);
      return prepareCharacterForCombat(character);
    } catch {
      // Character nicht im Vault - erstelle minimalen Combatant
      debug('createPartyCombatants: character not found, creating minimal', { memberId: member.id });
      const minimalCharacter: Character = {
        id: member.id,
        name: member.id,
        currentHp: createSingleValue(member.hp), // PMF: single value
        maxHp: member.hp,
        class: 'unknown',
        ac: member.ac,
        speed: 30,
        passivePerception: 10,
        level: member.level,
        passiveStealth: 10,
        abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
        inventory: [],
      };
      return prepareCharacterForCombat(minimalCharacter);
    }
  });
}

/**
 * Erstellt Enemy-Combatants aus Encounter-Gruppen.
 * Verwendet prepareNPCForCombat für jeden NPC.
 * @param groups Encounter-Gruppen mit NPCs
 * @param resourceBudget Budget 0-1 für Ressourcen
 * @returns NPCInCombat[] für die Simulation
 */
function createEnemyCombatants(
  groups: EncounterGroup[],
  resourceBudget: number = 1.0
): NPCInCombat[] {
  const combatants: NPCInCombat[] = [];

  for (const group of groups) {
    for (const npcs of Object.values(group.slots)) {
      for (const npc of npcs) {
        const prepared = prepareNPCForCombat(npc, group.groupId, resourceBudget);
        combatants.push(prepared);
        debug('createEnemyCombatants:', { npcId: npc.id, groupId: group.groupId });
      }
    }
  }

  return combatants;
}

// ============================================================================
// STATE INITIALIZATION
// ============================================================================

/**
 * Erstellt CombatState aus Combatants.
 * Initialisiert Grid und positioniert Combatants.
 *
 * @param combatants Alle Combatants (Party + Enemies)
 * @param alliances Allianz-Map (groupId → verbündete groupIds)
 * @param encounterDistanceFeet Distanz in Feet
 * @param resourceBudget Budget 0-1 für Ressourcen
 * @param initiativeOrder Sortierte Combatant-IDs (von averageInitiative())
 * @param mapConfig Optional: CombatMapConfig mit Terrain und Spawn-Zonen
 */
function createCombatState(
  combatants: Combatant[],
  alliances: Record<string, string[]>,
  encounterDistanceFeet: number = DEFAULT_ENCOUNTER_DISTANCE_FEET,
  resourceBudget: number = 0.5,
  initiativeOrder: string[] = [],
  mapConfig?: CombatMapConfig
): CombatState {
  const encounterDistanceCells = feetToCell(encounterDistanceFeet);
  const grid = initializeGrid({ encounterDistanceCells });

  // Combatants nach Gruppe trennen
  const partyCombatants = combatants.filter(c => c.combatState.groupId === 'party');
  const enemyCombatants = combatants.filter(c => c.combatState.groupId !== 'party');

  // Positionierung: Terrain-aware wenn mapConfig vorhanden, sonst Legacy
  if (mapConfig) {
    // Terrain-aware Positionierung mit Spawn-Zonen
    const [partySpawns, enemySpawns] = calculateSpawnPositions(
      mapConfig.bounds,
      mapConfig.spawnZones,
      mapConfig.terrainMap,
      partyCombatants.length,
      enemyCombatants.length
    );

    partyCombatants.forEach((c, i) => {
      c.combatState.position = partySpawns[i] ?? { x: i, y: 0, z: 0 };
    });
    enemyCombatants.forEach((c, i) => {
      c.combatState.position = enemySpawns[i] ?? { x: mapConfig.bounds.maxX - i, y: 0, z: 0 };
    });

    debug('createCombatState: terrain-aware spawning', {
      partySpawns: partySpawns.map(p => `(${p.x},${p.y})`),
      enemySpawns: enemySpawns.map(p => `(${p.x},${p.y})`),
    });
  } else {
    // Legacy-Positionierung: Party links, Enemies rechts
    let partyX = 0;
    let enemyX = encounterDistanceCells;

    for (const combatant of combatants) {
      if (combatant.combatState.groupId === 'party') {
        combatant.combatState.position = { x: partyX++, y: 0, z: 0 };
      } else {
        combatant.combatState.position = { x: enemyX++, y: 0, z: 0 };
      }
    }
  }

  const surprise = checkSurprise();

  // Initiales Budget für ersten Combatant
  const firstCombatantId = initiativeOrder[0];
  const firstCombatant = combatants.find(c => c.id === firstCombatantId);
  const initialBudget = firstCombatant
    ? createTurnBudget(firstCombatant)
    : { movementCells: 6, baseMovementCells: 6, hasAction: true, hasBonusAction: false, hasReaction: true };

  debug('createCombatState:', {
    combatantCount: combatants.length,
    partyCount: partyCombatants.length,
    enemyCount: enemyCombatants.length,
    encounterDistanceFeet,
    encounterDistanceCells,
    hasMapConfig: !!mapConfig,
  });

  // Reaction Budgets für alle Combatants initialisieren
  const reactionBudgets = new Map<string, { hasReaction: boolean }>();
  for (const combatant of combatants) {
    reactionBudgets.set(combatant.id, { hasReaction: true });
  }

  return {
    combatants,
    alliances,
    grid,
    roundNumber: 0,
    surprise,
    resourceBudget,
    // Initiative & Turn Tracking
    turnOrder: initiativeOrder,
    currentTurnIndex: 0,
    // Turn Budget des aktuellen Combatants
    currentTurnBudget: initialBudget,
    // Reaction Budgets (persistieren über Turns, Reset bei eigenem Turn-Start)
    reactionBudgets,
    // DPR-Tracking
    partyDPR: 0,
    enemyDPR: 0,
    // Hit/Miss-Tracking
    partyHits: 0,
    partyMisses: 0,
    enemyHits: 0,
    enemyMisses: 0,
    // Kill-Tracking
    partyKills: 0,
    enemyKills: 0,
    // HP-Tracking (Start-HP = Summe aller maxHp)
    partyStartHP: partyCombatants.reduce((sum, c) => sum + c.maxHp, 0),
    enemyStartHP: enemyCombatants.reduce((sum, c) => sum + c.maxHp, 0),
    // Combat Protocol
    protocol: [],
    // Terrain Map (aus mapConfig oder leer)
    terrainMap: mapConfig?.terrainMap ?? new Map(),
    // Map Bounds (optional, für Boundary-Enforcement)
    mapBounds: mapConfig?.bounds,
    // Active Zones (Spirit Guardians, Moonbeam, etc.) - werden bei Spell-Cast aktiviert
    activeZones: [],
    // Area Effects (Cover, Auras, Zones) - Unified Modifier Architecture
    areaEffects: [],
    // Shared Resource Pools (Divine Aid, etc.) - combatantId → poolId → remaining uses
    resourcePools: new Map(),
  };
}

// ============================================================================
// MAIN ENTRY POINT
// ============================================================================

/**
 * Konsolidierte Combat-Initialisierung.
 *
 * Erstellt aus Encounter-Gruppen und Party vollständige Combatants mit:
 * - CombatantState (Position, Conditions, Resources)
 * - Grid-Positionierung (terrain-aware wenn mapConfig vorhanden)
 * - Turn Tracking (turnOrder, currentTurnIndex, protocol)
 * - AI Layer-Daten (_layeredActions, effectLayers)
 * - Pre-Computed Base Resolutions für Scoring
 *
 * @param context.groups Encounter-Gruppen mit NPCs
 * @param context.alliances Gruppen-Allianzen (aus groupActivity.calculateGroupRelations)
 * @param context.party Party-Input mit Members
 * @param context.resourceBudget Resource-Budget 0-1 (aus difficulty.calculateResourceBudget)
 * @param context.encounterDistanceFeet Encounter-Distanz in Feet (Legacy, ignoriert wenn mapConfig)
 * @param context.initiativeOrder Sortierte Combatant-IDs (von averageInitiative())
 * @param context.mapConfig Optional: CombatMapConfig mit Terrain, Bounds und Spawn-Zonen
 * @param context.terrainMap Deprecated: Verwende mapConfig stattdessen
 * @returns CombatStateWithLayers mit vollständig initialisierten AI-Daten
 */
export function initialiseCombat(context: {
  groups: EncounterGroup[];
  alliances: Record<string, string[]>;
  party: PartyInput;
  resourceBudget: number;
  encounterDistanceFeet?: number;
  initiativeOrder: string[];
  mapConfig?: CombatMapConfig;
  /** @deprecated Verwende mapConfig stattdessen */
  terrainMap?: Map<string, import('@/types/combatTerrain').CombatCellProperties>;
}): CombatStateWithLayers {
  const {
    groups,
    alliances,
    party,
    resourceBudget,
    encounterDistanceFeet = DEFAULT_ENCOUNTER_DISTANCE_FEET,
    initiativeOrder,
    mapConfig,
    terrainMap,
  } = context;

  // Backward-Compatibility: terrainMap in mapConfig wrappen
  const effectiveMapConfig: CombatMapConfig | undefined = mapConfig ?? (terrainMap ? {
    terrainMap,
    bounds: { minX: -100, maxX: 100, minY: -100, maxY: 100 },  // Unbegrenzt für Legacy
  } : undefined);

  // Step 1: Party Combatants erstellen (Characters aus Vault laden)
  const partyCombatants = createPartyCombatants(party);

  // Step 2: Enemy Combatants erstellen (NPCs aus Groups mit resourceBudget)
  const enemyCombatants = createEnemyCombatants(groups, resourceBudget);

  // Step 3: Combat State initialisieren (Grid, Positionen, Turn Tracking)
  const allCombatants = [...partyCombatants, ...enemyCombatants];
  const state = createCombatState(
    allCombatants,
    alliances,
    encounterDistanceFeet,
    resourceBudget,
    initiativeOrder,
    effectiveMapConfig
  );

  // Step 4: AI Layer System initialisieren (NACH Positionen)
  const stateWithLayers = initializeLayers(state);

  // Step 5: Pre-Compute Base Resolutions für alle Action/Target Kombinationen
  precomputeBaseResolutions(stateWithLayers);

  debug('initialiseCombat:', {
    partyCount: partyCombatants.length,
    enemyCount: enemyCombatants.length,
    resourceBudget,
    allianceGroups: Object.keys(alliances).length,
    initiativeOrderLength: initiativeOrder.length,
  });

  return stateWithLayers;
}
