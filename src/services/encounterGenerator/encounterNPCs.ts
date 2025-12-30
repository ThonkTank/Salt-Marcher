// NPCs für Encounter zuweisen (1-3 NPCs pro Encounter)
// Siehe: docs/services/encounter/Encounter.md#encounternpcs-step-43
//
// Pipeline-Position: Step 4.3 (nach groupActivity, vor encounterLoot)
//
// Workflow:
// 1. Alle Kreaturen über alle Gruppen sammeln
// 2. Gewicht berechnen: CR × ROLE_WEIGHT
// 3. NPC-Anzahl bestimmen (Single-Group: 1-3 würfeln, Multi-Group: min 1 pro Gruppe)
// 4. Gewichtete Zufallsauswahl ohne Zurücklegen
// 5. Pro Auswahl: NPC-Matching oder NPC-Generation
// 6. npcId in entsprechender Kreatur setzen
//
// DISKREPANZEN (als [HACK] oder [TODO] markiert):
// ================================================
//
// [HACK: NPC-Matching.md#faction-matching] factionId undefined nicht unterstützt
//   → Dokumentation: undefined = fraktionsübergreifend
//   → Code: === factionId matched undefined nie
//
// RESOLVED:
// - [2025-12-30] NPC-Tracking + Persistierung in encounterWorkflow.acceptEncounter()

import { vault } from '@/infrastructure/vault/vaultInstance';
import type { CreatureDefinition, Faction, NPC } from '@/types/entities';
import type { DesignRole } from '@/constants';
import type { GroupWithActivity } from './groupActivity';
import type { EncounterCreature, GroupStatus } from './groupPopulation';
import { generateNPC as generateNewNPC } from '../npcGenerator/npcGenerator';
import { hexDistance } from '@/utils';

// ============================================================================
// DEBUG HELPER
// ============================================================================

const debug = (...args: unknown[]) => {
  if (process.env.DEBUG_SERVICES === 'true') {
    console.log('[encounterNPCs]', ...args);
  }
};

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Gewichtung der Design-Rollen als Multiplikatoren.
 * Höhere Werte = höhere Wahrscheinlichkeit als NPC ausgewählt zu werden.
 * Berechnung: weight = CR × ROLE_WEIGHT
 */
const ROLE_WEIGHTS: Record<DesignRole, number> = {
  leader: 5.0,
  solo: 5.0,
  support: 2.0,
  controller: 2.0,
  brute: 2.0,
  artillery: 1.0,
  soldier: 1.0,
  skirmisher: 1.0,
  ambusher: 1.0,
  minion: 0.5,
};

// ============================================================================
// TYPES
// ============================================================================

/** Kreatur-Kandidat für NPC-Auswahl mit Gruppen-Zuordnung */
interface NPCCandidate {
  creature: CreatureDefinition;
  creatureId: string;
  groupId: string;
  factionId: string | null;
  slotIndex: number; // Welche Instanz dieser Kreatur (0 = erste)
  weight: number;
}

/** Ergebnis der NPC-Zuweisung */
export interface AssignNPCsResult {
  matchedNPCs: NPC[];    // Existierende NPCs (nur Tracking-Update nötig)
  generatedNPCs: NPC[];  // Neue NPCs (müssen persistiert werden)
  groups: GroupWithNPCs[];
}

// ============================================================================
// NPC-ANZAHL BESTIMMEN
// ============================================================================

/**
 * Würfelt die NPC-Anzahl für Single-Group Encounters.
 * Gewichtete Verteilung: 1 NPC häufiger als 3.
 */
function rollNPCCount(): number {
  const roll = Math.random();
  if (roll < 0.5) return 1; // 50%
  if (roll < 0.85) return 2; // 35%
  return 3; // 15%
}

/**
 * Würfelt Extra-NPCs für Multi-Group Encounters.
 * Nach dem Gruppen-Minimum können 0-1 weitere NPCs hinzukommen.
 */
function rollExtraNPCs(): number {
  return Math.random() < 0.5 ? 0 : 1;
}

// ============================================================================
// KANDIDATEN SAMMELN
// ============================================================================

/**
 * Sammelt alle Kreaturen aus allen Gruppen als NPC-Kandidaten.
 * Jede Kreatur-Instanz wird einzeln erfasst (bei count > 1).
 */
function collectAllCandidates(groups: GroupWithActivity[]): NPCCandidate[] {
  const candidates: NPCCandidate[] = [];

  for (const group of groups) {
    const allCreatures = Object.values(group.slots).flat();

    for (const entry of allCreatures) {
      const creature = vault.getEntity<CreatureDefinition>('creature', entry.creatureId);
      if (!creature) {
        debug('Creature not found:', entry.creatureId);
        continue;
      }

      // Gewicht berechnen: CR × ROLE_WEIGHT
      const roleWeight = ROLE_WEIGHTS[creature.designRole] ?? 1.0;
      const weight = Math.max(0.01, creature.cr * roleWeight);

      // Jede Instanz als separaten Kandidaten erfassen
      for (let i = 0; i < entry.count; i++) {
        candidates.push({
          creature,
          creatureId: entry.creatureId,
          groupId: group.groupId,
          factionId: group.factionId,
          slotIndex: i,
          weight,
        });
      }
    }
  }

  debug('Collected candidates:', candidates.length);
  return candidates;
}

// ============================================================================
// GEWICHTETE AUSWAHL
// ============================================================================

/**
 * Gewichtete Zufallsauswahl eines einzelnen Elements.
 */
function weightedSelectOne<T extends { weight: number }>(items: T[]): T | null {
  if (items.length === 0) return null;

  const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
  if (totalWeight <= 0) return null;

  let roll = Math.random() * totalWeight;

  for (const item of items) {
    roll -= item.weight;
    if (roll <= 0) return item;
  }

  return items[items.length - 1];
}

/**
 * Gewichtete Zufallsauswahl ohne Zurücklegen.
 * Wählt `count` Elemente aus `items`.
 */
function weightedSampleWithoutReplacement<T extends { weight: number }>(
  items: T[],
  count: number
): T[] {
  const remaining = [...items];
  const selected: T[] = [];

  for (let i = 0; i < count && remaining.length > 0; i++) {
    const pick = weightedSelectOne(remaining);
    if (!pick) break;

    selected.push(pick);
    const idx = remaining.indexOf(pick);
    if (idx !== -1) remaining.splice(idx, 1);
  }

  return selected;
}

/**
 * Wählt NPCs mit Gruppen-Constraint (Multi-Group).
 * Erst 1 NPC pro Gruppe, dann Rest global auffüllen.
 */
function selectWithGroupConstraint(
  candidates: NPCCandidate[],
  groups: GroupWithActivity[],
  totalCount: number
): NPCCandidate[] {
  const selected: NPCCandidate[] = [];
  const remaining = [...candidates];

  // 1. Erst 1 NPC pro Gruppe (gewichtet innerhalb der Gruppe)
  for (const group of groups) {
    const groupCandidates = remaining.filter(c => c.groupId === group.groupId);
    if (groupCandidates.length === 0) continue;

    const pick = weightedSelectOne(groupCandidates);
    if (pick) {
      selected.push(pick);
      const idx = remaining.indexOf(pick);
      if (idx !== -1) remaining.splice(idx, 1);
    }
  }

  // 2. Rest global auffüllen (falls totalCount > groups.length)
  const extraCount = totalCount - selected.length;
  if (extraCount > 0 && remaining.length > 0) {
    const extras = weightedSampleWithoutReplacement(remaining, extraCount);
    selected.push(...extras);
  }

  return selected;
}

// ============================================================================
// NPC-MATCHING
// Siehe: docs/services/NPCs/NPC-Matching.md
// ============================================================================

/**
 * Sucht einen existierenden NPC für die Kreatur.
 * Tracking-Update erfolgt in encounterWorkflow.acceptEncounter().
 */
function findExistingNPC(
  creature: CreatureDefinition,
  factionId: string | null,
  position?: { q: number; r: number }
): NPC | null {
  const npcs = vault.getAllEntities<NPC>('npc');

  debug('NPC-Matching: searching', npcs.length, 'NPCs for', creature.id, 'faction:', factionId);

  // 1. Kandidaten filtern: creature.id + factionId + status='alive'
  // [HACK: NPC-Matching.md#faction-matching] factionId undefined matched nie
  const candidates = npcs.filter(
    npc =>
      npc.creature.id === creature.id && npc.factionId === factionId && npc.status === 'alive'
  );

  debug('NPC-Matching: found', candidates.length, 'candidates');

  if (candidates.length === 0) return null;
  if (candidates.length === 1) {
    debug('NPC-Matching: single match:', candidates[0].id, candidates[0].name);
    return candidates[0];
  }

  // 2. Priorisieren: geografisch nächster (primär), länger nicht gesehen (sekundär)
  const sorted = candidates.sort((a, b) => {
    // Primär: Geografisch nächster NPC (falls Position gegeben)
    if (position) {
      const distA = a.lastKnownPosition ? hexDistance(position, a.lastKnownPosition) : Infinity;
      const distB = b.lastKnownPosition ? hexDistance(position, b.lastKnownPosition) : Infinity;
      if (distA !== distB) return distA - distB;
    }

    // Sekundär: Länger nicht gesehen bevorzugen
    const dayDiff = a.lastEncounter.day - b.lastEncounter.day;
    if (dayDiff !== 0) return dayDiff;
    return a.lastEncounter.hour - b.lastEncounter.hour;
  });

  debug('NPC-Matching: prioritized match:', sorted[0].id, sorted[0].name);
  return sorted[0];
}

// ============================================================================
// NPC-GENERATION
// Siehe: docs/services/NPCs/NPC-Generation.md
// ============================================================================

/**
 * Generiert einen neuen NPC für die Kreatur.
 * Delegiert an den npcGenerator-Service.
 */
function generateNPC(
  creature: CreatureDefinition,
  factionId: string | null,
  options?: {
    position?: { q: number; r: number };
  }
): NPC | null {
  // Faction laden falls vorhanden
  const faction = factionId ? vault.getEntity<Faction>('faction', factionId) : null;

  debug('NPC-Generation: generating for', creature.id, 'faction:', faction?.id ?? 'none');

  return generateNewNPC(creature, faction, {
    position: options?.position,
  });
}

/** Ergebnis von matchOrGenerateNPC */
interface MatchOrGenerateResult {
  npc: NPC | null;
  isGenerated: boolean;
}

/**
 * Versucht NPC zu matchen oder zu generieren.
 * Gibt zusätzlich an, ob der NPC neu generiert wurde.
 */
function matchOrGenerateNPC(
  candidate: NPCCandidate,
  position?: { q: number; r: number }
): MatchOrGenerateResult {
  // 1. Existierenden NPC suchen
  const matched = findExistingNPC(candidate.creature, candidate.factionId, position);
  if (matched) return { npc: matched, isGenerated: false };

  // 2. Neuen NPC generieren (falls implementiert)
  const generated = generateNPC(candidate.creature, candidate.factionId, { position });
  return { npc: generated, isGenerated: true };
}

// ============================================================================
// HP-BERECHNUNG
// ============================================================================

/**
 * Berechnet die HP für eine Kreatur-Instanz.
 *
 * [HACK: creature.md] HP direkt aus maxHp, keine Varianz
 * → Post-MVP: HP-Varianz basierend auf Hit Dice
 */
function calculateHP(creature: CreatureDefinition): { currentHp: number; maxHp: number } {
  return {
    currentHp: creature.maxHp,
    maxHp: creature.maxHp,
  };
}

// ============================================================================
// OUTPUT INTERFACES
// ============================================================================

/**
 * Kreatur-Instanz mit HP und optionaler NPC-Referenz.
 */
export interface EncounterCreatureInstance {
  definitionId: string;
  currentHp: number;
  maxHp: number;
  npcId?: string; // Referenz auf NPC falls zugewiesen
}

/**
 * Output von assignEncounterNPCs - Gruppe mit HP-expanded creatures.
 */
export interface GroupWithNPCs {
  groupId: string;
  templateRef?: string;
  factionId: string | null;
  slots: { [slotName: string]: EncounterCreature[] };
  narrativeRole: 'threat' | 'victim' | 'neutral' | 'ally';
  status: GroupStatus;
  activity: string;
  goal: string;
  disposition: 'hostile' | 'neutral' | 'friendly';
  creatures: EncounterCreatureInstance[];
}

// ============================================================================
// HAUPT-FUNKTION
// ============================================================================

/**
 * Weist 1-3 NPCs für das gesamte Encounter zu.
 *
 * - Single-Group: 1-3 NPCs (50%/35%/15%)
 * - Multi-Group: min 1 NPC pro Gruppe, dann auffüllen bis max 3
 *
 * NPCs werden via npcId in den creatures markiert.
 *
 * @param groups - Alle Gruppen des Encounters
 * @param context - Kontext mit Position für NPC-Matching
 */
export function assignEncounterNPCs(
  groups: GroupWithActivity[],
  context: {
    position?: { q: number; r: number };
  }
): AssignNPCsResult {
  debug('Input:', {
    groups: groups.length,
    isMultiGroup: groups.length > 1,
  });

  // 1. Alle Kreaturen sammeln
  const candidates = collectAllCandidates(groups);
  if (candidates.length === 0) {
    debug('No candidates found');
    return {
      matchedNPCs: [],
      generatedNPCs: [],
      groups: groups.map(g => convertGroupWithNPCs(g, [])),
    };
  }

  // 2. NPC-Anzahl bestimmen
  const isMultiGroup = groups.length > 1;
  const count = isMultiGroup
    ? Math.min(3, groups.length + rollExtraNPCs())
    : rollNPCCount();

  debug('NPC count:', count, isMultiGroup ? '(multi-group)' : '(single-group)');

  // 3. NPCs auswählen
  const selected = isMultiGroup
    ? selectWithGroupConstraint(candidates, groups, count)
    : weightedSampleWithoutReplacement(candidates, count);

  debug(
    'Selected:',
    selected.map(s => `${s.creatureId} (group: ${s.groupId}, weight: ${s.weight.toFixed(2)})`)
  );

  // 4. Für jeden: Match oder Generate
  const npcAssignments: { candidate: NPCCandidate; npc: NPC | null; isGenerated: boolean }[] =
    selected.map(s => {
      const result = matchOrGenerateNPC(s, context.position);
      return {
        candidate: s,
        npc: result.npc,
        isGenerated: result.isGenerated,
      };
    });

  // 5. NPCs in matched vs generated aufteilen
  const matchedNPCs = npcAssignments
    .filter(a => a.npc !== null && !a.isGenerated)
    .map(a => a.npc as NPC);

  const generatedNPCs = npcAssignments
    .filter(a => a.npc !== null && a.isGenerated)
    .map(a => a.npc as NPC);

  debug('NPCs resolved:', matchedNPCs.length, 'matched,', generatedNPCs.length, 'generated');

  // 6. Gruppen mit creatures und npcId erstellen
  const updatedGroups = groups.map(group => convertGroupWithNPCs(group, npcAssignments));

  return { matchedNPCs, generatedNPCs, groups: updatedGroups };
}

/**
 * Konvertiert eine Gruppe zu GroupWithNPCs mit HP-expanded creatures.
 */
function convertGroupWithNPCs(
  group: GroupWithActivity,
  npcAssignments: { candidate: NPCCandidate; npc: NPC | null; isGenerated: boolean }[]
): GroupWithNPCs {
  const allCreatures = Object.values(group.slots).flat();

  // Creatures mit HP-Werten konvertieren
  const creatures: EncounterCreatureInstance[] = allCreatures.flatMap(entry => {
    const creature = vault.getEntity<CreatureDefinition>('creature', entry.creatureId);
    if (!creature) {
      debug('Creature not found:', entry.creatureId);
      return [];
    }

    const hp = calculateHP(creature);

    return Array.from({ length: entry.count }, (_, i) => {
      // Prüfen ob diese Kreatur-Instanz ein NPC ist
      const assignment = npcAssignments.find(
        a =>
          a.candidate.groupId === group.groupId &&
          a.candidate.creatureId === entry.creatureId &&
          a.candidate.slotIndex === i
      );

      return {
        definitionId: entry.creatureId,
        currentHp: hp.currentHp,
        maxHp: hp.maxHp,
        npcId: assignment?.npc?.id,
      };
    });
  });

  return {
    groupId: group.groupId,
    templateRef: group.templateRef,
    factionId: group.factionId,
    slots: group.slots,
    narrativeRole: group.narrativeRole,
    status: group.status,
    activity: group.activity,
    goal: group.goal,
    disposition: group.disposition,
    creatures,
  };
}
