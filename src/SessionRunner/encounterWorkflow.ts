// Ziel: Encounter generieren lassen, in DetailView anzeigen wenn erhalten, encounter durchspielen, resolution abhandeln.
// Siehe: docs/orchestration/EncounterWorkflow.md

// ============================================================================
// IMPORTS
// ============================================================================

import { isErr, unwrap, unwrapErr } from '@core/types/result';

// State aus sessionState
import { getState, updateState, vault } from './sessionState';

// Typen
import type { EncounterInstance } from '@entities/encounter-instance';
import type { CombatParticipant } from '@features/Combat';

// Encounter-Service
import { generateEncounter } from '@services/encounterGenerator/encounterGenerator';

// Konfiguration
import {
  DEFAULT_ENCOUNTER_CHANCE,
  TIME_ENCOUNTER_MODIFIERS,
} from '@constants/EncounterConfig';

// ============================================================================
// TYPEN
// ============================================================================

export type EncounterTrigger = 'travel' | 'rest' | 'manual' | 'location';

// ============================================================================
// HAUPT-FUNKTION
// ============================================================================

/**
 * Prüft ob ein Encounter erscheint und generiert ihn.
 *
 * 1. Encounter-Check würfeln (außer bei forceEncounter)
 * 2. Kontext aus sessionControl sammeln
 * 3. generateEncounter aufrufen
 * 4. State aktualisieren
 *
 * Siehe: docs/orchestration/EncounterWorkflow.md#checkencounter
 */
export function checkEncounter(trigger: EncounterTrigger, forceEncounter = false): void {
  const state = getState();
  const map = vault.getEntity('map', state.activeMapId!);
  const tile = map.getTile(state.party.position);
  const terrain = vault.getEntity('terrain', tile.terrainId);

  // Step 1: Encounter-Check
  if (!forceEncounter) {
    const baseChance = terrain.encounterChance ?? DEFAULT_ENCOUNTER_CHANCE;
    const timeModifier = TIME_ENCOUNTER_MODIFIERS[state.time.daySegment] ?? 1.0;
    if (Math.random() >= baseChance * timeModifier) {
      return;
    }
  }

  // Step 2: Party-Snapshot bauen
  const members = state.party.members.map(id => {
    const char = vault.getEntity('character', id);
    return { id, level: char.level, hp: char.currentHp, maxHp: char.maxHp, ac: char.ac };
  });

  const party = {
    level: Math.max(...members.map(m => m.level)),
    size: members.length,
    members,
    position: state.party.position,
  };

  // Step 3: generateEncounter aufrufen
  const result = generateEncounter({
    position: state.party.position,
    terrain,
    timeSegment: state.time.daySegment,
    weather: state.weather!,
    party,
    factions: tile.factionPresence ?? [],
    trigger,
  });

  // Step 4: Ergebnis verarbeiten
  if (isErr(result)) {
    console.warn(`Encounter-Generierung fehlgeschlagen: ${unwrapErr(result).code}`);
    return;
  }

  // Step 5: State aktualisieren
  const encounter = unwrap(result);
  updateState(s => ({
    ...s,
    encounter: {
      status: 'preview',
      current: encounter,
      trigger,
    },
    travel: s.travel.status === 'traveling'
      ? { ...s.travel, status: 'paused' }
      : s.travel,
  }));
}

// ============================================================================
// HELPER-FUNKTIONEN
// ============================================================================

/**
 * Baut CombatParticipants aus Encounter und Party.
 */
function buildParticipants(encounter: EncounterInstance): CombatParticipant[] {
  const state = getState();
  const participants: CombatParticipant[] = [];

  // Party-Mitglieder hinzufügen
  for (const memberId of state.party.members) {
    const char = vault.getEntity('character', memberId);
    participants.push({
      id: `char-${memberId}`,
      type: 'character',
      entityId: memberId,
      name: char.name,
      initiative: 0,
      maxHp: char.maxHp,
      currentHp: char.currentHp,
      conditions: [],
      effects: [],
    });
  }

  // Kreaturen aus Encounter-Gruppen hinzufügen
  let creatureIndex = 0;
  for (const group of encounter.groups) {
    for (const creature of group.creatures) {
      creatureIndex++;
      participants.push({
        id: `creature-${creatureIndex}`,
        type: 'creature',
        entityId: creature.definitionId,
        name: creature.name ?? `${creature.definitionId} #${creatureIndex}`,
        initiative: 0,
        maxHp: creature.maxHp,
        currentHp: creature.currentHp,
        conditions: [],
        effects: [],
      });
    }
  }

  return participants;
}

// ============================================================================
// ENCOUNTER-AKTIONEN
// ============================================================================

/**
 * GM verwirft den Encounter.
 */
export function dismissEncounter(): void {
  updateState(s => ({
    ...s,
    encounter: { status: 'idle', current: null },
    travel: s.travel.status === 'paused' ? { ...s.travel, status: 'traveling' } : s.travel,
  }));
}

/**
 * GM startet Combat aus dem Encounter.
 */
export function startCombat(): void {
  const state = getState();
  if (!state.encounter.current) return;

  updateState(s => ({
    ...s,
    encounter: { ...s.encounter, status: 'active' },
    combat: { status: 'active', participants: [], currentTurn: 0, round: 1 },
  }));
}
