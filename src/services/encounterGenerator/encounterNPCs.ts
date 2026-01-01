// NPCs für ALLE Kreaturen im Encounter generieren
// Siehe: docs/services/encounter/Encounter.md#encounternpcs-step-43
//
// TASKS:
// | # | Status | Domain | Layer | Beschreibung | Prio | MVP? | Deps | Spec | Imp. |
// |--:|:------:|--------|-------|--------------|:----:|:----:|------|------|------|
// | 28 | ⬜ | NPCs | services | NPC-Matching: factionId undefined als fraktionsuebergreifend behandeln | mittel | Nein | - | NPC-Matching.md#Faction-Matching | - |
// | 29 | ⬜ | creature | entities | HP-Varianz: Trefferpunkte basierend auf Hit Dice wuerfeln statt maxHp direkt verwenden | mittel | Nein | - | creature.md#Felder | - |
// | 36 | ✅ | NPCs | services | findExistingNPC: Basis-Matching (creature.id + factionId + status) | mittel | Nein | - | NPC-Matching.md#Match-Kriterien | - |
// | 37 | ✅ | NPCs | services | NPC-Priorisierung: Distanz (primaer) + lastEncounter (sekundaer) | mittel | Nein | - | NPC-Matching.md#Priorisierung | - |
// | 38 | ✅ | Encounter | services | calculateHP: Basis-Implementation (maxHp direkt) | mittel | Nein | - | encounter.md#NPC-Zuordnung | - |
// | 39 | ✅ | Encounter | services | convertGroupWithNPCs: Output-Konversion mit HP-Expansion | mittel | Nein | - | encounter.md#NPC-Zuordnung | - |
// | 46 | ✅ | Encounter | services | matchOrGenerateNPC: Match-oder-Generate Orchestrierung | mittel | Nein | - | encounter.md#encounterNPCs (Step 4.3) | - |
// | 47 | ✅ | Encounter | services | assignEncounterNPCs: Haupt-Funktion (Pipeline-Orchestrierung) | mittel | Nein | - | encounter.md#encounterNPCs (Step 4.3) | - |
// | 48 | ✅ | NPCs | services | generateNPC: Delegation an npcGenerator-Service | mittel | Nein | - | NPC-Generation.md#API | - |
//
// Pipeline-Position: Step 5.1 (VOR groupActivity, damit NPC-Reputation in Disposition einfließt)
//
// Workflow:
// 1. Alle NPCs einmal aus Vault laden (Performance-Optimierung)
// 2. Alle Kreaturen über alle Gruppen sammeln
// 3. Für JEDE Kreatur: NPC-Matching oder NPC-Generation
// 4. npcId in jeder Kreatur setzen

import { vault } from '@/infrastructure/vault/vaultInstance';
import type { CreatureDefinition, Faction, NPC } from '@/types/entities';
import type { GameDateTime } from '#types/time';
import type { PopulatedGroup, CreatureInstance, GroupStatus } from './groupPopulation';
import type { NarrativeRole } from '@/constants';
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
// TYPES
// ============================================================================

/** Kreatur mit Gruppen-Zuordnung für NPC-Generierung */
interface CreatureForNPC {
  creature: CreatureDefinition;
  definitionId: string;
  groupId: string;
  factionId: string | null;
  instanceIndex: number;
}

/** Ergebnis der NPC-Zuweisung */
export interface AssignNPCsResult {
  matchedNPCs: NPC[];    // Existierende NPCs (nur Tracking-Update nötig)
  generatedNPCs: NPC[];  // Neue NPCs (müssen persistiert werden)
  groups: GroupWithNPCs[];
}

// ============================================================================
// KREATUREN SAMMELN
// ============================================================================

/**
 * Sammelt alle Kreatur-Instanzen aus allen Gruppen.
 * Jede Kreatur wird zu einem NPC - keine Gewichtung/Auswahl mehr.
 */
function collectAllCreaturesFlat(groups: PopulatedGroup[]): CreatureForNPC[] {
  const result: CreatureForNPC[] = [];

  for (const group of groups) {
    let instanceIndex = 0;
    for (const instances of Object.values(group.slots)) {
      for (const instance of instances) {
        const creature = vault.getEntity<CreatureDefinition>('creature', instance.definitionId);
        if (!creature) {
          debug('Creature not found:', instance.definitionId);
          continue;
        }

        result.push({
          creature,
          definitionId: instance.definitionId,
          groupId: group.groupId,
          factionId: group.factionId,
          instanceIndex,
        });
        instanceIndex++;
      }
    }
  }

  debug('Collected creatures:', result.length);
  return result;
}

// ============================================================================
// NPC-MATCHING
// Siehe: docs/services/NPCs/NPC-Matching.md
// ============================================================================

/**
 * Sucht einen existierenden NPC für die Kreatur.
 * Tracking-Update erfolgt in encounterWorkflow.acceptEncounter().
 *
 * @param allNPCs - Pre-loaded NPCs aus Vault (Performance-Optimierung)
 */
function findExistingNPC(
  creature: CreatureDefinition,
  factionId: string | null,
  allNPCs: NPC[],
  position?: { q: number; r: number }
): NPC | null {
  debug('NPC-Matching: searching', allNPCs.length, 'NPCs for', creature.id, 'faction:', factionId);

  // 1. Kandidaten filtern: creature.id + factionId + status='alive'
  // TODO(#28): factionId undefined sollte fraktionsuebergreifend matchen
  const candidates = allNPCs.filter(
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
  options: {
    position?: { q: number; r: number };
    time: GameDateTime;
  }
): NPC | null {
  const faction = factionId ? vault.getEntity<Faction>('faction', factionId) : null;

  debug('NPC-Generation: generating for', creature.id, 'faction:', faction?.id ?? 'none');

  return generateNewNPC(creature, faction, {
    position: options.position,
    time: options.time,
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
 *
 * @param creatureData - Kreatur mit Gruppen-Zuordnung
 * @param allNPCs - Pre-loaded NPCs für Matching
 * @param context - Position und Zeit
 */
function matchOrGenerateNPC(
  creatureData: CreatureForNPC,
  allNPCs: NPC[],
  context: { position?: { q: number; r: number }; time: GameDateTime }
): MatchOrGenerateResult {
  // 1. Existierenden NPC suchen
  const matched = findExistingNPC(
    creatureData.creature,
    creatureData.factionId,
    allNPCs,
    context.position
  );
  if (matched) return { npc: matched, isGenerated: false };

  // 2. Neuen NPC generieren
  const generated = generateNPC(creatureData.creature, creatureData.factionId, context);
  return { npc: generated, isGenerated: true };
}

// ============================================================================
// OUTPUT INTERFACES
// ============================================================================

/**
 * Kreatur-Instanz mit HP und optionaler NPC-Referenz.
 * HP sind bereits in CreatureInstance gesetzt (groupPopulation).
 */
export interface EncounterCreatureInstance {
  instanceId: string; // Eindeutige Instanz-ID
  definitionId: string;
  currentHp: number;
  maxHp: number;
  npcId?: string; // Referenz auf NPC falls zugewiesen
  loot?: { id: string; quantity: number }[]; // Zugewiesene Loot-Items
  slotName?: string; // Slot-Zuordnung (leader, follower, etc.)
}

/**
 * Output von assignEncounterNPCs - Gruppe mit npcId in creatures.
 * Activity/Goal/Disposition werden SPÄTER in groupActivity zugewiesen.
 */
export interface GroupWithNPCs {
  groupId: string;
  templateRef?: string;
  factionId: string | null;
  slots: { [slotName: string]: CreatureInstance[] };
  narrativeRole: NarrativeRole;
  status: GroupStatus;
  creatures: EncounterCreatureInstance[];  // Mit npcId (falls NPC zugewiesen)
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
 * Activity/Goal/Disposition werden SPÄTER in groupActivity zugewiesen.
 *
 * @param groups - Alle Gruppen des Encounters (PopulatedGroup)
 * @param context - Kontext mit Position für NPC-Matching und Zeit für NPC-Generierung
 */
export function assignEncounterNPCs(
  groups: PopulatedGroup[],
  context: {
    position?: { q: number; r: number };
    time: GameDateTime;
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
    selected.map(s => `${s.item.definitionId} (group: ${s.item.groupId}, weight: ${s.randWeighting.toFixed(2)})`)
  );

  // 4. Für jeden: Match oder Generate
  const npcAssignments: { candidate: NPCCandidate; npc: NPC | null; isGenerated: boolean }[] =
    selected.map(s => {
      const result = matchOrGenerateNPC(s, context.position, context.time);
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
 * Konvertiert eine Gruppe zu GroupWithNPCs.
 * Instanzen haben bereits HP - hier wird nur npcId hinzugefügt.
 * Activity/Goal/Disposition werden SPÄTER in groupActivity zugewiesen.
 */
function convertGroupWithNPCs(
  group: PopulatedGroup,
  npcAssignments: { candidate: NPCCandidate; npc: NPC | null; isGenerated: boolean }[]
): GroupWithNPCs {
  const creatures: EncounterCreatureInstance[] = [];
  let instanceIndex = 0;

  // Über Slots iterieren um slotName zu erhalten
  for (const [slotName, instances] of Object.entries(group.slots)) {
    for (const instance of instances) {
      // Prüfen ob diese Instanz ein NPC ist
      const assignment = npcAssignments.find(
        a => a.candidate.item.groupId === group.groupId && a.candidate.item.instanceIndex === instanceIndex
      );

      creatures.push({
        definitionId: instance.definitionId,
        currentHp: instance.currentHp,
        maxHp: instance.maxHp,
        npcId: assignment?.npc?.id,
        slotName,
      });

      instanceIndex++;
    }
  }

  return {
    groupId: group.groupId,
    templateRef: group.templateRef,
    factionId: group.factionId,
    slots: group.slots,
    narrativeRole: group.narrativeRole,
    status: group.status,
    creatures,
  };
}
