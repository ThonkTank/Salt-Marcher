// Ziel: Encounter-Gruppen an Ziel-Difficulty anpassen durch XP-Multiplikatoren.
// Siehe: docs/services/encounter/balancing.md
//
// Pipeline-Übersicht:
//   1. Party-Thresholds berechnen
//   2. Ziel-Range aus Difficulty ableiten
//   3. Optionen sammeln (Activity, Disposition, Creature-Slots)
//   4. Beste Option wählen (kleinste Distanz zur Range-Mitte)
//   5. Option anwenden und iterieren bis Ziel erreicht

// ============================================================================
// HACK & TODO
// ============================================================================
//
// [HACK]: generateNPC() Inline-Vereinfachung statt npcGenerator-Service
// - Sollte npcGenerator.generateNPC() verwenden (existiert in src/services/npcGenerator/)
// - Stattdessen: statische Werte (personality='neutral', goal='survive', value='strength')
// - Keine Culture-Chain-Resolution (selectCulture + resolveAttributes)
//
// [HACK]: generateNPCName() einfaches Namens-Format
// - Format: "{CreatureName} #{000}" statt echter NPC-Namen-Generierung
// - Spec: npcGenerator.md würde kulturbasierte Namen verwenden
//
// [HACK]: generateNPC() hardcoded Encounter-Datum
// - firstEncounter/lastEncounter = { year: 1, month: 1, day: 1, hour: 12 }
// - Statt aktuelle Spielzeit aus Context
//
// [TODO]: Implementiere collectDistanceOptions() für Distance-Multiplikatoren
// - Spec: balancing.md#multiplikator-kategorien (Phase 2)
// - Input: encounterDistance-Berechnung
// - Output: AdjustmentOption[] mit distance-Typ
//
// [TODO]: Implementiere collectEnvironmentOptions() für Environment-Multiplikatoren
// - Spec: balancing.md#multiplikator-kategorien (Phase 2)
// - Input: terrain.features[]
// - Output: AdjustmentOption[] mit environment-Typ
//
// [TODO]: Implementiere collectMultiGroupOptions() für Multi-Group-Balancing
// - Spec: balancing.md#multi-group-optionen
// - Input: Fraktionen auf Tile, XP-Budget
// - Output: AdjustmentOption[] mit multi-group-Typ und role (threat/ally)
//
import type { EncounterGroup } from '@/types/encounterTypes';
import type { Faction, CreatureDefinition, NPC } from '@/types/entities';
import type { DifficultyLabel, Disposition, Activity, TimeSegment } from '@/constants';
import { ACTIVITY_DEFINITIONS, GENERIC_ACTIVITY_IDS } from '@/constants';
import { vault } from '@/infrastructure/vault/vaultInstance';
import { selectCulture, buildFactionChain } from '@/utils';
import { createSingleValue } from '@/utils/probability';
import type { Culture } from '#types/entities/culture';
import type { Species } from '#types/entities/species';
import type { GroupTemplate, SlotCount } from '@/types/entities/groupTemplate';
import { getAllCreatures } from './encounterHelpers';
import { getCompanionPool } from './fillGroups';

// ============================================================================
// TYPES
// ============================================================================

import type { PartySnapshot } from '@/types/partySnapshot';

interface DifficultyThresholds {
  easy: number;
  medium: number;
  hard: number;
  deadly: number;
}

interface Range {
  min: number;
  max: number;
}

type AdjustmentType = 'activity' | 'disposition' | 'creature-slot' | 'slot-replace';

interface AdjustmentOption {
  type: AdjustmentType;
  description: string;
  resultingXP: number;
  distanceToTarget: number;
  // Typ-spezifische Felder
  groupId?: string;
  activity?: string;
  multiplier?: number;
  disposition?: Disposition;
  slotName?: string;
  creatureId?: string;
  action?: 'add' | 'remove';
  newCreatureId?: string;  // Für slot-replace: Ziel-Creature
}

interface WorkingEncounter {
  groups: EncounterGroup[];
  generatedNPCs: NPC[];
  // Multiplikatoren werden on-the-fly aus group.activity/disposition berechnet
}

export interface BalancedEncounter {
  groups: EncounterGroup[];
  generatedNPCs: NPC[];
  balance: {
    targetDifficulty: DifficultyLabel;
    actualDifficulty: DifficultyLabel;
    adjustedXP: number;           // Für Difficulty-Klassifikation (mit Activity/Disposition)
    xpReward: number;             // Was Spieler bekommen (baseXP ohne Activity/Disposition)
    adjustmentsMade: number;
  };
}

// ============================================================================
// CONSTANTS
// ============================================================================

const MAX_ITERATIONS = 10;

/** D&D 5e XP Thresholds pro Party-Level. */
const XP_THRESHOLDS: Record<number, DifficultyThresholds> = {
  1:  { easy: 25,   medium: 50,    hard: 75,    deadly: 100   },
  2:  { easy: 50,   medium: 100,   hard: 150,   deadly: 200   },
  3:  { easy: 75,   medium: 150,   hard: 225,   deadly: 400   },
  4:  { easy: 125,  medium: 250,   hard: 375,   deadly: 500   },
  5:  { easy: 250,  medium: 500,   hard: 750,   deadly: 1100  },
  6:  { easy: 300,  medium: 600,   hard: 900,   deadly: 1400  },
  7:  { easy: 350,  medium: 750,   hard: 1100,  deadly: 1700  },
  8:  { easy: 450,  medium: 900,   hard: 1400,  deadly: 2100  },
  9:  { easy: 550,  medium: 1100,  hard: 1600,  deadly: 2400  },
  10: { easy: 600,  medium: 1200,  hard: 1900,  deadly: 2800  },
  11: { easy: 800,  medium: 1600,  hard: 2400,  deadly: 3600  },
  12: { easy: 1000, medium: 2000,  hard: 3000,  deadly: 4500  },
  13: { easy: 1100, medium: 2200,  hard: 3400,  deadly: 5100  },
  14: { easy: 1250, medium: 2500,  hard: 3800,  deadly: 5700  },
  15: { easy: 1400, medium: 2800,  hard: 4300,  deadly: 6400  },
  16: { easy: 1600, medium: 3200,  hard: 4800,  deadly: 7200  },
  17: { easy: 2000, medium: 3900,  hard: 5900,  deadly: 8800  },
  18: { easy: 2100, medium: 4200,  hard: 6300,  deadly: 9500  },
  19: { easy: 2400, medium: 4900,  hard: 7300,  deadly: 10900 },
  20: { easy: 2800, medium: 5700,  hard: 8500,  deadly: 12700 },
};

/** CR zu XP Mapping (D&D 5e DMG). */
const CR_TO_XP: Record<number, number> = {
  0: 10, 0.125: 25, 0.25: 50, 0.5: 100,
  1: 200, 2: 450, 3: 700, 4: 1100,
  5: 1800, 6: 2300, 7: 2900, 8: 3900,
  9: 5000, 10: 5900, 11: 7200, 12: 8400,
  13: 10000, 14: 11500, 15: 13000, 16: 15000,
  17: 18000, 18: 20000, 19: 22000, 20: 25000,
  21: 33000, 22: 41000, 23: 50000, 24: 62000,
  25: 75000, 26: 90000, 27: 105000, 28: 120000,
  29: 135000, 30: 155000,
};

/** Disposition-Multiplikatoren. Spec: balancing.md#disposition-multiplikator */
const DISPOSITION_MULTIPLIERS: Record<Disposition, number> = {
  hostile: 1.0,
  unfriendly: 0.9,
  indifferent: 0.7,
  friendly: 0.4,
  allied: 0.1,
};

/** Alle Dispositions in Reihenfolge (für Option-Generierung). */
const DISPOSITION_ORDER: Disposition[] = ['hostile', 'unfriendly', 'indifferent', 'friendly', 'allied'];

// ============================================================================
// MAIN FUNCTION
// ============================================================================

/**
 * Passt Encounter-Gruppen an die Ziel-Difficulty an.
 * Verwendet XP-Multiplikatoren statt Win-Probability.
 * Gibt beste erreichbare Difficulty zurück wenn Ziel nicht erreichbar.
 */
export function adjust(
  groups: EncounterGroup[],
  targetDifficulty: DifficultyLabel,
  context: {
    terrain: { id: string };
    timeSegment: string;
  },
  party: PartySnapshot
): BalancedEncounter | null {
  if (groups.length === 0) {
    debug('adjust: No groups provided');
    return null;
  }

  const thresholds = calculatePartyThresholds(party);
  const targetRange = getDifficultyRange(thresholds, targetDifficulty);

  let working: WorkingEncounter = {
    groups: structuredClone(groups),
    generatedNPCs: [],
  };

  // Multiplikatoren werden on-the-fly aus group.activity/disposition berechnet
  let currentXP = calculateAdjustedXP(working);
  let iterations = 0;

  debug('adjust: Starting', {
    targetDifficulty,
    targetRange,
    initialXP: currentXP,
    thresholds,
  });

  while (!isInRange(currentXP, targetRange) && iterations < MAX_ITERATIONS) {
    const options = [
      ...collectActivityOptions(working, targetRange, context),
      ...collectDispositionOptions(working, targetRange),
      ...collectCreatureSlotOptions(working, targetRange, context),
      ...collectSlotReplaceOptions(working, targetRange, context),
    ];

    debug(`adjust: Iteration ${iterations}`, {
      currentXP,
      optionsCount: options.length,
    });

    if (options.length === 0) {
      debug('adjust: No more options available');
      break;
    }

    const best = selectBestOption(options);
    working = applyOption(working, best, context);
    currentXP = calculateAdjustedXP(working);
    iterations++;

    debug(`adjust: Applied option`, {
      type: best.type,
      description: best.description,
      newXP: currentXP,
    });
  }

  return buildBalancedEncounter(working, currentXP, targetDifficulty, thresholds, iterations);
}

// ============================================================================
// THRESHOLD & RANGE CALCULATION
// ============================================================================

/** Berechnet summierte XP-Thresholds für die Party. */
function calculatePartyThresholds(party: PartySnapshot): DifficultyThresholds {
  // Verwende members.level falls vorhanden, sonst party.level × party.size
  const levels = party.members?.length > 0
    ? party.members.map(m => m.level)
    : Array(party.size).fill(party.level);

  const thresholds: DifficultyThresholds = { easy: 0, medium: 0, hard: 0, deadly: 0 };

  for (const level of levels) {
    const t = XP_THRESHOLDS[Math.max(1, Math.min(20, level))];
    thresholds.easy += t.easy;
    thresholds.medium += t.medium;
    thresholds.hard += t.hard;
    thresholds.deadly += t.deadly;
  }

  return thresholds;
}

/** Mappt DifficultyLabel auf XP-Range. Spec: balancing.md#ziel-range */
function getDifficultyRange(thresholds: DifficultyThresholds, difficulty: DifficultyLabel): Range {
  switch (difficulty) {
    case 'trivial':  return { min: 0, max: thresholds.easy * 0.5 };
    case 'easy':     return { min: thresholds.easy * 0.5, max: thresholds.medium };
    case 'medium': return { min: thresholds.medium, max: thresholds.hard };
    case 'hard':     return { min: thresholds.hard, max: thresholds.deadly };
    case 'deadly':   return { min: thresholds.deadly, max: Infinity };
  }
}

/** Prüft ob XP im Ziel-Range liegt. */
function isInRange(xp: number, range: Range): boolean {
  return xp >= range.min && xp < range.max;
}

/** Klassifiziert XP zu DifficultyLabel. */
function classifyDifficulty(xp: number, thresholds: DifficultyThresholds): DifficultyLabel {
  if (xp < thresholds.easy * 0.5) return 'trivial';
  if (xp < thresholds.medium) return 'easy';
  if (xp < thresholds.hard) return 'medium';
  if (xp < thresholds.deadly) return 'hard';
  return 'deadly';
}

// ============================================================================
// XP CALCULATION
// ============================================================================

/**
 * Berechnet adjustedXP mit per-group Multiplikatoren.
 * Group-Multiplier (D&D 5e) ist global, Activity/Disposition per-group.
 */
function calculateAdjustedXP(working: WorkingEncounter): number {
  // 1. Gesamt-Count für D&D 5e Group-Multiplier
  const totalCount = countAllCreatures(working.groups);
  const groupMultiplier = getGroupMultiplier(totalCount);

  // 2. Per-Group: rawXP × groupMult × activityMult × dispositionMult
  let totalAdjustedXP = 0;
  for (const group of working.groups) {
    const groupRawXP = sumGroupRawXP(group);
    const activityMult = getGroupActivityMultiplier(group);
    const dispositionMult = getGroupDispositionMultiplier(group);
    totalAdjustedXP += groupRawXP * groupMultiplier * activityMult * dispositionMult;
  }

  return Math.round(totalAdjustedXP);
}

/** Berechnet Activity-Multiplikator für eine Gruppe. */
function getGroupActivityMultiplier(group: EncounterGroup): number {
  if (!group.activity) return 1;
  const activity = ACTIVITY_DEFINITIONS[group.activity];
  return activity ? getActivityMultiplier(activity) : 1;
}

/** Berechnet Disposition-Multiplikator für eine Gruppe. */
function getGroupDispositionMultiplier(group: EncounterGroup): number {
  return group.disposition ? DISPOSITION_MULTIPLIERS[group.disposition] ?? 1 : 1;
}

/** Summiert Raw-XP für eine einzelne Gruppe (ohne Multiplikatoren). */
function sumGroupRawXP(group: EncounterGroup): number {
  let total = 0;
  for (const npc of getAllCreatures(group)) {
    const creature = vault.getEntity<CreatureDefinition>('creature', npc.creature.id);
    if (creature) {
      total += crToXP(creature.cr);
    }
  }
  return total;
}

/** Berechnet Basis-XP (vor Multiplikatoren) aus allen NPCs. */
function calculateBaseXP(groups: EncounterGroup[]): number {
  let totalXP = 0;
  let totalCount = 0;

  for (const group of groups) {
    for (const npc of getAllCreatures(group)) {
      const creature = vault.getEntity<CreatureDefinition>('creature', npc.creature.id);
      if (creature) {
        totalXP += crToXP(creature.cr);
        totalCount++;
      }
    }
  }

  const groupMultiplier = getGroupMultiplier(totalCount);
  return Math.floor(totalXP * groupMultiplier);
}

/** Konvertiert CR zu XP. */
function crToXP(cr: number): number {
  // Direkte Lookup für bekannte CRs
  if (CR_TO_XP[cr] !== undefined) {
    return CR_TO_XP[cr];
  }

  // Interpolation für unbekannte CRs
  const floorCR = Math.floor(cr);
  const ceilCR = Math.ceil(cr);
  const floorXP = CR_TO_XP[floorCR] ?? 10;
  const ceilXP = CR_TO_XP[ceilCR] ?? floorXP;
  const fraction = cr - floorCR;

  return Math.floor(floorXP + (ceilXP - floorXP) * fraction);
}

/** D&D 5e Gruppen-Multiplikator. */
function getGroupMultiplier(count: number): number {
  if (count <= 1) return 1.0;
  if (count === 2) return 1.5;
  if (count <= 6) return 2.0;
  if (count <= 10) return 2.5;
  if (count <= 14) return 3.0;
  return 4.0;
}

// ============================================================================
// ACTIVITY OPTIONS
// ============================================================================

/**
 * Activity-Multiplikator-Formel.
 * Spec: balancing.md#activity-multiplikator
 */
function getActivityMultiplier(activity: Activity): number {
  return 0.4 + (activity.awareness / 100) * 0.8;
}

/**
 * Baut Activity-Pool aus Culture-Chain.
 * Spec: groupActivity.md#buildActivityPool
 */
export function buildActivityPool(
  group: EncounterGroup,
  context: { terrain: { id: string }; timeSegment: string },
  faction?: Faction
): Activity[] {
  const npcs = getAllCreatures(group);
  const seedNPC = npcs[0];

  // Seed-Kreatur's Definition und Species holen
  const creatureDef = seedNPC
    ? vault.getEntity<CreatureDefinition>('creature', seedNPC.creature.id)
    : null;

  const species = creatureDef?.species
    ? vault.getEntity<Species>('species', creatureDef.species)
    : null;

  // Kultur auswählen
  const cultures = vault.getAllEntities<Culture>('culture');
  const culture = selectCulture(creatureDef, species, faction ?? null, cultures);

  // Faction-Kette für influence.activities
  const factionChain = faction ? buildFactionChain(faction) : [];
  const factionActivities = factionChain.flatMap(f => f.influence?.activities ?? []);

  // Activities sammeln (ohne Duplikate)
  const activityIds = new Set<string>();

  // 1. Generic Activities
  for (const id of GENERIC_ACTIVITY_IDS) {
    activityIds.add(id);
  }

  // 2. Culture Activities
  for (const id of culture.activities ?? []) {
    activityIds.add(id);
  }

  // 3. Faction.influence Activities
  for (const id of factionActivities) {
    activityIds.add(id);
  }

  // Activity-Objekte sammeln
  const activities: Activity[] = [];
  for (const id of activityIds) {
    const activity = ACTIVITY_DEFINITIONS[id];
    if (activity) {
      activities.push(activity);
    }
  }

  return activities;
}

/** Sammelt Activity-Optionen für alle Gruppen (per-group Berechnung). */
function collectActivityOptions(
  working: WorkingEncounter,
  targetRange: Range,
  context: { terrain: { id: string }; timeSegment: string }
): AdjustmentOption[] {
  const options: AdjustmentOption[] = [];

  for (const group of working.groups) {
    // Faction laden falls vorhanden
    const faction = group.factionId
      ? vault.getEntity<Faction>('faction', group.factionId)
      : undefined;

    const activityPool = buildActivityPool(group, context, faction ?? undefined);

    for (const activity of activityPool) {
      // Nur hinzufügen wenn anders als aktuell
      if (group.activity === activity.id) continue;

      // Simuliere XP mit neuer Activity für diese Gruppe
      const resultingXP = calculateXPWithModifiedGroup(
        working,
        group.groupId,
        { activity: activity.id }
      );

      options.push({
        type: 'activity',
        description: `Set ${group.groupId} activity to ${activity.id}`,
        groupId: group.groupId,
        activity: activity.id,
        multiplier: getActivityMultiplier(activity),
        resultingXP,
        distanceToTarget: distanceToRange(resultingXP, targetRange),
      });
    }
  }

  return options;
}

/**
 * Berechnet XP mit einer modifizierten Gruppe (für Option-Simulation).
 * Ändert nicht den tatsächlichen State.
 */
function calculateXPWithModifiedGroup(
  working: WorkingEncounter,
  groupId: string,
  modifications: { activity?: string; disposition?: Disposition }
): number {
  const totalCount = countAllCreatures(working.groups);
  const groupMultiplier = getGroupMultiplier(totalCount);

  let totalAdjustedXP = 0;
  for (const group of working.groups) {
    const groupRawXP = sumGroupRawXP(group);

    // Activity-Multiplikator (mit optionaler Modifikation)
    let activityMult: number;
    if (group.groupId === groupId && modifications.activity !== undefined) {
      const activity = ACTIVITY_DEFINITIONS[modifications.activity];
      activityMult = activity ? getActivityMultiplier(activity) : 1;
    } else {
      activityMult = getGroupActivityMultiplier(group);
    }

    // Disposition-Multiplikator (mit optionaler Modifikation)
    let dispositionMult: number;
    if (group.groupId === groupId && modifications.disposition !== undefined) {
      dispositionMult = DISPOSITION_MULTIPLIERS[modifications.disposition] ?? 1;
    } else {
      dispositionMult = getGroupDispositionMultiplier(group);
    }

    totalAdjustedXP += groupRawXP * groupMultiplier * activityMult * dispositionMult;
  }

  return Math.round(totalAdjustedXP);
}

// ============================================================================
// DISPOSITION OPTIONS
// ============================================================================

/** Sammelt Disposition-Optionen für alle Gruppen (per-group Berechnung). */
function collectDispositionOptions(
  working: WorkingEncounter,
  targetRange: Range
): AdjustmentOption[] {
  const options: AdjustmentOption[] = [];

  for (const group of working.groups) {
    for (const disposition of DISPOSITION_ORDER) {
      // Nur hinzufügen wenn anders als aktuell
      if (group.disposition === disposition) continue;

      // Simuliere XP mit neuer Disposition für diese Gruppe
      const resultingXP = calculateXPWithModifiedGroup(
        working,
        group.groupId,
        { disposition }
      );

      options.push({
        type: 'disposition',
        description: `Set ${group.groupId} disposition to ${disposition}`,
        groupId: group.groupId,
        disposition,
        multiplier: DISPOSITION_MULTIPLIERS[disposition],
        resultingXP,
        distanceToTarget: distanceToRange(resultingXP, targetRange),
      });
    }
  }

  return options;
}

// ============================================================================
// CREATURE-SLOT OPTIONS
// ============================================================================

/** Sammelt Creature-Slot-Optionen (Add/Remove) innerhalb Template-Grenzen (per-group). */
function collectCreatureSlotOptions(
  working: WorkingEncounter,
  targetRange: Range,
  _context: { terrain: { id: string }; timeSegment: string }
): AdjustmentOption[] {
  const options: AdjustmentOption[] = [];
  const currentXP = calculateAdjustedXP(working);
  const needHarder = currentXP < targetRange.min;

  for (const group of working.groups) {
    // Ohne Template keine Slot-Optionen
    if (!group.templateRef) continue;

    const template = vault.getEntity<GroupTemplate>('groupTemplate', group.templateRef);
    if (!template) continue;

    for (const [slotName, slotDef] of Object.entries(template.slots)) {
      const currentNPCs = group.slots[slotName] ?? [];
      const currentCount = currentNPCs.length;
      const { min, max } = getSlotRange(slotDef.count);

      // Add-Option: wenn unter max und needHarder
      if (needHarder && currentCount < max && currentNPCs.length > 0) {
        const creatureId = currentNPCs[0].creature.id;
        const creature = vault.getEntity<CreatureDefinition>('creature', creatureId);

        if (creature) {
          const resultingXP = calculateXPWithCreatureChange(working, group.groupId, crToXP(creature.cr), 'add');

          options.push({
            type: 'creature-slot',
            description: `Add ${creatureId} to ${group.groupId}/${slotName}`,
            groupId: group.groupId,
            slotName,
            creatureId,
            action: 'add',
            resultingXP,
            distanceToTarget: distanceToRange(resultingXP, targetRange),
          });
        }
      }

      // Remove-Option: wenn über min und !needHarder
      if (!needHarder && currentCount > min && currentNPCs.length > 0) {
        const lastNPC = currentNPCs[currentNPCs.length - 1];
        const creature = vault.getEntity<CreatureDefinition>('creature', lastNPC.creature.id);

        if (creature) {
          const resultingXP = calculateXPWithCreatureChange(working, group.groupId, crToXP(creature.cr), 'remove');

          options.push({
            type: 'creature-slot',
            description: `Remove from ${group.groupId}/${slotName}`,
            groupId: group.groupId,
            slotName,
            action: 'remove',
            resultingXP,
            distanceToTarget: distanceToRange(resultingXP, targetRange),
          });
        }
      }
    }
  }

  return options;
}

/**
 * Berechnet XP mit hinzugefügter/entfernter Kreatur (per-group Berechnung).
 */
function calculateXPWithCreatureChange(
  working: WorkingEncounter,
  groupId: string,
  creatureXP: number,
  action: 'add' | 'remove'
): number {
  const delta = action === 'add' ? 1 : -1;
  const xpDelta = action === 'add' ? creatureXP : -creatureXP;

  // Neuer Group-Multiplier basierend auf neuer Gesamt-Anzahl
  const newTotalCount = Math.max(1, countAllCreatures(working.groups) + delta);
  const newGroupMultiplier = getGroupMultiplier(newTotalCount);

  let totalAdjustedXP = 0;
  for (const group of working.groups) {
    // Raw XP für diese Gruppe (mit optionaler Änderung)
    let groupRawXP = sumGroupRawXP(group);
    if (group.groupId === groupId) {
      groupRawXP = Math.max(0, groupRawXP + xpDelta);
    }

    const activityMult = getGroupActivityMultiplier(group);
    const dispositionMult = getGroupDispositionMultiplier(group);
    totalAdjustedXP += groupRawXP * newGroupMultiplier * activityMult * dispositionMult;
  }

  return Math.round(totalAdjustedXP);
}

/** Extrahiert min/max aus SlotCount. */
function getSlotRange(count: SlotCount): { min: number; max: number } {
  if (typeof count === 'number') return { min: count, max: count };
  return { min: count.min, max: count.max };
}

/** Zählt alle Kreaturen in allen Gruppen. */
function countAllCreatures(groups: EncounterGroup[]): number {
  let count = 0;
  for (const group of groups) {
    count += getAllCreatures(group).length;
  }
  return count;
}

/** Summiert Raw-XP (ohne Gruppen-Multiplikator). */
function sumRawXP(groups: EncounterGroup[]): number {
  let total = 0;
  for (const group of groups) {
    for (const npc of getAllCreatures(group)) {
      const creature = vault.getEntity<CreatureDefinition>('creature', npc.creature.id);
      if (creature) {
        total += crToXP(creature.cr);
      }
    }
  }
  return total;
}

// ============================================================================
// SLOT-REPLACE OPTIONS
// ============================================================================

/**
 * Sammelt Slot-Replace-Optionen (Creature-Typ-Swap innerhalb designRole).
 * Verwendet getCompanionPool() aus fillGroups für konsistente Kandidaten-Auswahl.
 */
function collectSlotReplaceOptions(
  working: WorkingEncounter,
  targetRange: Range,
  context: { terrain: { id: string }; timeSegment: string; eligibleCreatures?: CreatureDefinition[] }
): AdjustmentOption[] {
  const options: AdjustmentOption[] = [];

  for (const group of working.groups) {
    // Ohne Template keine Slot-Replace-Optionen
    if (!group.templateRef) continue;

    const template = vault.getEntity<GroupTemplate>('groupTemplate', group.templateRef);
    if (!template) continue;

    // Seed-Creature für Companion-Pool ermitteln
    const allCreatures = getAllCreatures(group);
    const seedCreatureId = allCreatures[0]?.creature.id;
    if (!seedCreatureId) continue;

    // Companion Pool über fillGroups laden
    const companionPool = getCompanionPool(
      { creatureId: seedCreatureId, factionId: group.factionId },
      { eligibleCreatures: context.eligibleCreatures ?? [], timeSegment: context.timeSegment as TimeSegment }
    );

    for (const [slotName, slotDef] of Object.entries(template.slots)) {
      const currentNPCs = group.slots[slotName] ?? [];
      if (currentNPCs.length === 0) continue;

      const currentCreatureId = currentNPCs[0].creature.id;
      const slotRole = slotDef.designRole;

      // Kandidaten: gleiche designRole, anderer Creature-Typ
      const candidates = companionPool
        .map(entry => vault.getEntity<CreatureDefinition>('creature', entry.creatureId))
        .filter((c): c is CreatureDefinition =>
          c !== null && c !== undefined &&
          c.designRole === slotRole &&
          c.id !== currentCreatureId
        );

      for (const candidate of candidates) {
        // XP-Differenz berechnen: altes Creature raus, neues Creature rein (gleiche Anzahl)
        const oldCreature = vault.getEntity<CreatureDefinition>('creature', currentCreatureId);
        if (!oldCreature) continue;

        const oldXP = crToXP(oldCreature.cr) * currentNPCs.length;
        const newXP = crToXP(candidate.cr) * currentNPCs.length;
        const xpDelta = newXP - oldXP;

        const resultingXP = calculateXPWithCreatureChange(
          working,
          group.groupId,
          xpDelta,
          'add'  // 'add' mit delta funktioniert auch für negative Werte
        );

        options.push({
          type: 'slot-replace',
          description: `Replace ${currentCreatureId} with ${candidate.id} in ${group.groupId}/${slotName}`,
          groupId: group.groupId,
          slotName,
          creatureId: currentCreatureId,
          newCreatureId: candidate.id,
          resultingXP,
          distanceToTarget: distanceToRange(resultingXP, targetRange),
        });
      }
    }
  }

  return options;
}

// ============================================================================
// OPTION SELECTION & APPLICATION
// ============================================================================

/** Berechnet Distanz zum Ziel-Range-Mittelpunkt. */
function distanceToRange(xp: number, range: Range): number {
  if (isInRange(xp, range)) return 0;

  // Für "deadly" (Infinity max) nehmen wir nur Distanz zum Minimum
  if (range.max === Infinity) {
    return xp < range.min ? range.min - xp : 0;
  }

  const mid = (range.min + range.max) / 2;
  return Math.abs(xp - mid);
}

/** Wählt die beste Option (kleinste Distanz zum Ziel). */
function selectBestOption(options: AdjustmentOption[]): AdjustmentOption {
  return options.reduce((best, opt) =>
    opt.distanceToTarget < best.distanceToTarget ? opt : best
  );
}

/** Wendet eine Option auf das Working-Encounter an (ohne multipliers-Cache). */
function applyOption(
  working: WorkingEncounter,
  option: AdjustmentOption,
  context: { terrain: { id: string }; timeSegment: string }
): WorkingEncounter {
  const result: WorkingEncounter = {
    groups: structuredClone(working.groups),
    generatedNPCs: [...working.generatedNPCs],
  };

  switch (option.type) {
    case 'activity': {
      if (option.groupId && option.activity) {
        const group = result.groups.find(g => g.groupId === option.groupId);
        if (group) {
          group.activity = option.activity;
          // Kein Cache-Update mehr - Multiplikator wird on-the-fly berechnet
        }
      }
      break;
    }

    case 'disposition': {
      if (option.groupId && option.disposition) {
        const group = result.groups.find(g => g.groupId === option.groupId);
        if (group) {
          group.disposition = option.disposition;
          // Kein Cache-Update mehr - Multiplikator wird on-the-fly berechnet
        }
      }
      break;
    }

    case 'creature-slot': {
      if (option.groupId && option.slotName) {
        const group = result.groups.find(g => g.groupId === option.groupId);
        if (group) {
          if (option.action === 'add' && option.creatureId) {
            // NPC generieren und hinzufügen
            const newNPC = generateNPC(option.creatureId, group.factionId, context);
            if (!group.slots[option.slotName]) {
              group.slots[option.slotName] = [];
            }
            group.slots[option.slotName].push(newNPC);
            group.npcIds.push(newNPC.id);
            result.generatedNPCs.push(newNPC);
          } else if (option.action === 'remove') {
            // Letzten NPC aus Slot entfernen
            const slot = group.slots[option.slotName];
            if (slot && slot.length > 0) {
              const removed = slot.pop()!;
              group.npcIds = group.npcIds.filter(id => id !== removed.id);
            }
          }
        }
      }
      break;
    }

    case 'slot-replace': {
      if (option.groupId && option.slotName && option.newCreatureId) {
        const group = result.groups.find(g => g.groupId === option.groupId);
        if (group) {
          const slot = group.slots[option.slotName];
          if (slot && slot.length > 0) {
            // Alle NPCs im Slot durch neue Creature-Type ersetzen
            const count = slot.length;
            const oldNpcIds = slot.map(npc => npc.id);

            // Alte NPCs aus npcIds entfernen
            group.npcIds = group.npcIds.filter(id => !oldNpcIds.includes(id));

            // Neue NPCs generieren
            const newNPCs: NPC[] = [];
            for (let i = 0; i < count; i++) {
              const newNPC = generateNPC(option.newCreatureId, group.factionId, context);
              newNPCs.push(newNPC);
              group.npcIds.push(newNPC.id);
              result.generatedNPCs.push(newNPC);
            }

            // Slot mit neuen NPCs ersetzen
            group.slots[option.slotName] = newNPCs;
          }
        }
      }
      break;
    }
  }

  return result;
}

// ============================================================================
// NPC GENERATION
// ============================================================================

/**
 * Generiert einen vollständigen NPC. HACK: siehe Header
 * Spec: fillGroups.md#generateNPC
 */
export function generateNPC(
  creatureId: string,
  factionId: string | null,
  _context: { terrain: { id: string }; timeSegment: string }
): NPC {
  const creature = vault.getEntity<CreatureDefinition>('creature', creatureId);

  // HP aus hitDice-Durchschnitt
  const maxHp = creature?.averageHp ?? 10;
  const now = { year: 1, month: 1, day: 1, hour: 12, segment: 'midday' as const };

  return {
    id: crypto.randomUUID(),
    name: generateNPCName(creatureId),
    creature: { type: 'creature', id: creatureId },
    factionId: factionId ?? undefined,
    currentHp: createSingleValue(maxHp),
    maxHp,
    // Persönlichkeits-Felder (vereinfacht - würden normalerweise generiert)
    personality: 'neutral',
    quirk: undefined,
    appearance: undefined,
    goal: 'survive',
    value: 'strength',
    reputations: [],
    status: 'alive',
    firstEncounter: now,
    lastEncounter: now,
    encounterCount: 0,
    possessions: [],
  };
}

/** Generiert einen einfachen NPC-Namen. HACK: siehe Header */
function generateNPCName(creatureId: string): string {
  const creature = vault.getEntity<CreatureDefinition>('creature', creatureId);
  const baseName = creature?.name ?? creatureId;
  const suffix = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `${baseName} #${suffix}`;
}

// ============================================================================
// RESULT BUILDING
// ============================================================================

/** Baut das finale BalancedEncounter-Objekt (ohne appliedMultipliers). */
function buildBalancedEncounter(
  working: WorkingEncounter,
  finalXP: number,
  targetDifficulty: DifficultyLabel,
  thresholds: DifficultyThresholds,
  iterations: number
): BalancedEncounter {
  const actualDifficulty = classifyDifficulty(finalXP, thresholds);
  const xpReward = calculateBaseXP(working.groups);

  return {
    groups: working.groups,
    generatedNPCs: working.generatedNPCs,
    balance: {
      targetDifficulty,
      actualDifficulty,
      adjustedXP: finalXP,
      xpReward,
      adjustmentsMade: iterations,
    },
  };
}

// ============================================================================
// DEBUG HELPER
// ============================================================================

const debug = (...args: unknown[]) => {
  if (process.env.DEBUG_SERVICES === 'true') {
    console.log('[balancing]', ...args);
  }
};
