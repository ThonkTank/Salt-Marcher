// Ziel: Encounter generieren lassen, in DetailView anzeigen wenn erhalten, encounter durchspielen, resolution abhandeln.
// Siehe: docs/orchestration/EncounterWorkflow.md

// ============================================================================
// IMPORTS
// ============================================================================

// State aus Infrastructure-Layer (für CLI-Testbarkeit)
import { getState, updateState } from '@/infrastructure/state/sessionState';
import { vault } from '@/infrastructure/vault/vaultInstance';

// Typen
import type { EncounterInstance } from '#types/encounterTypes';
import type { EncounterTrigger } from '@/constants/encounter';
import type { NPC } from '#types/entities/npc';
import type { HexCoordinate } from '#types/hexCoordinate';
import type { GameDateTime } from '#types/time';

// Encounter-Service
import { generateEncounter } from '@/services/encounterGenerator/encounterGenerator';

// Konfiguration
import {
  DEFAULT_ENCOUNTER_CHANCE,
  TIME_ENCOUNTER_MODIFIERS,
} from '@/constants/encounterConfig';

// ============================================================================
// RESULT HELPERS
// ============================================================================

import { type Result, isErr, unwrap, unwrapErr } from '#types/common/Result';

// ============================================================================
// COMBAT PARTICIPANT (inline - TODO: move to Combat feature when ready)
// ============================================================================

interface CombatParticipant {
  id: string;
  type: 'character' | 'creature';
  entityId: string;
  name: string;
  initiative: number;
  maxHp: number;
  currentHp: number;
  conditions: string[];
  effects: string[];
}

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
    const timeModifier = TIME_ENCOUNTER_MODIFIERS[state.time.segment as keyof typeof TIME_ENCOUNTER_MODIFIERS] ?? 1.0;
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
  // CR-Budget: tile.crBudget überschreibt terrain.defaultCrBudget
  const effectiveCrBudget = tile.crBudget ?? terrain.defaultCrBudget;

  const result = generateEncounter({
    position: state.party.position,
    terrain,
    crBudget: effectiveCrBudget,
    timeSegment: state.time.segment,
    time: state.time,
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
  const { encounter, generatedNPCs } = unwrap(result);
  updateState(s => ({
    ...s,
    encounter: {
      status: 'preview',
      current: encounter,
      generatedNPCs,
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

      // Name via NPC-Lookup falls npcId gesetzt, sonst generischer Name
      let creatureName = `${creature.definitionId} #${creatureIndex}`;
      if (creature.npcId) {
        const npc = vault.getEntity<NPC>('npc', creature.npcId);
        if (npc) {
          creatureName = npc.name;
        }
      }

      participants.push({
        id: `creature-${creatureIndex}`,
        type: 'creature',
        entityId: creature.definitionId,
        name: creatureName,
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

/**
 * Aktualisiert NPC-Tracking-Felder für alle NPCs im Encounter.
 * Siehe: docs/services/NPCs/NPC-Matching.md#nach-erfolgreichem-match
 */
function updateNPCTracking(
  encounter: EncounterInstance,
  position: HexCoordinate,
  time: GameDateTime
): void {
  for (const group of encounter.groups) {
    for (const creature of group.creatures) {
      if (creature.npcId) {
        const npc = vault.getEntity<NPC>('npc', creature.npcId);
        if (npc) {
          vault.saveEntity('npc', {
            ...npc,
            lastEncounter: time,
            encounterCount: npc.encounterCount + 1,
            lastKnownPosition: position,
            lastSeenAt: time,
          });
        }
      }
    }
  }
}

// ============================================================================
// ENCOUNTER-AKTIONEN
// ============================================================================

/**
 * GM verwirft den Encounter.
 * Generierte NPCs werden verworfen (nicht persistiert).
 */
export function dismissEncounter(): void {
  updateState(s => ({
    ...s,
    encounter: { status: 'idle', current: null, generatedNPCs: [] },
    travel: s.travel.status === 'paused' ? { ...s.travel, status: 'traveling' } : s.travel,
  }));
}

/**
 * GM akzeptiert den Encounter.
 * Persistiert neue NPCs, das Encounter, und aktualisiert NPC-Tracking.
 *
 * Aufruf: Vor startCombat() für Combat-Encounters, oder direkt für Social/Passing.
 */
export function acceptEncounter(): void {
  const state = getState();
  const encounter = state.encounter.current;
  const generatedNPCs = state.encounter.generatedNPCs;

  if (!encounter) return;

  // 1. Neue NPCs persistieren
  for (const npc of generatedNPCs) {
    vault.saveEntity('npc', npc);
  }

  // 2. Encounter persistieren
  vault.saveEntity('encounter', encounter);

  // 3. NPC-Tracking aktualisieren (für alle NPCs im Encounter)
  updateNPCTracking(encounter, state.party.position, state.time);

  // 4. Status aktualisieren
  updateState(s => ({
    ...s,
    encounter: {
      ...s.encounter,
      status: 'accepted',
      generatedNPCs: [],  // Geleert nach Persistierung
    },
  }));
}

/**
 * GM startet Combat aus dem Encounter.
 */
export function startCombat(): void {
  const state = getState();
  const encounter = state.encounter.current;
  if (!encounter) return;

  const participants = buildParticipants(encounter);

  updateState(s => ({
    ...s,
    encounter: { ...s.encounter, status: 'active' },
    combat: { status: 'active', participants, currentTurn: 0, round: 1 },
  }));
}
