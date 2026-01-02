// Ziel: Gruppen mit NPCs befüllen (kombiniert groupPopulation + encounterNPCs)
// Siehe: docs/services/encounter/fillGroups.md
//
// Pipeline-Position: Step 3 (nach groupSeed, vor groupActivity)
//
// Pipeline:
// 3.0: Companion-Pool bilden (Faction/Tag-Match)
// 3.1: Template auswählen (Faction -> Generic -> groupSize Fallback)
// 3.2: Slots befüllen mit Creature-Typen + Anzahl würfeln
// 3.3: Für JEDEN Slot-Eintrag: NPC matchen/generieren (mit HP + Loot)
// 3.4: npcIds Index aufbauen
// 3.5: EncounterGroup zurückgeben + generatedNPCs separat

import { vault } from '@/infrastructure/vault/vaultInstance';
import { randomBetween, randomNormal, randomSelect, assertValidValue, hexDistance } from '@/utils';
import { TIME_SEGMENTS, type NarrativeRole } from '@/constants';
import { type Result, ok, err } from '#types/common/Result';
import type { CreatureDefinition, GroupTemplate, SlotCount, SlotDef, Faction, NPC } from '@/types/entities';
import type { EncounterGroup } from '@/types/encounterTypes';
import type { GameDateTime } from '#types/time';
import type { HexCoordinate } from '#types/hexCoordinate';
import { generateNPC as generateNewNPC } from '../npcGenerator/npcGenerator';

// ============================================================================
// DEBUG HELPER
// ============================================================================

const debug = (...args: unknown[]) => {
  if (process.env.DEBUG_SERVICES === 'true') {
    console.log('[fillGroups]', ...args);
  }
};

// ============================================================================
// TYPES
// ============================================================================

/** Output von fillGroup() */
export interface FillGroupResult {
  group: EncounterGroup;
  generatedNPCs: NPC[];  // Neue NPCs (müssen im Vault erstellt werden)
  matchedNPCs: NPC[];    // Existierende NPCs (nur Tracking-Update nötig)
}

/** Error-Typ für fillGroup() */
export type FillGroupError = { code: 'SEED_CREATURE_NOT_FOUND' };

/** Kontext für fillGroup() */
export interface FillGroupContext {
  terrain: { id: string };
  timeSegment: GameDateTime['segment'];
  eligibleCreatures: CreatureDefinition[];
  position?: HexCoordinate;
  time: GameDateTime;
}

/** Interner Kontext für NPC-Erstellung */
interface NPCContext {
  position?: HexCoordinate;
  time: GameDateTime;
}

/** Ergebnis von fillSlots() */
interface FillSlotsResult {
  slots: Record<string, NPC[]>;
  generatedNPCs: NPC[];
  matchedNPCs: NPC[];
}

// ============================================================================
// STEP 3.0: COMPANION-POOL BILDUNG
// ============================================================================

/**
 * Lädt Companion-Kandidaten für die Seed-Kreatur.
 */
function getCompanionPool(
  seed: { creatureId: string; factionId: string | null },
  context: { eligibleCreatures: CreatureDefinition[]; timeSegment: GameDateTime['segment'] }
): { creatureId: string; count: number }[] {
  if (seed.factionId) {
    const faction = vault.getEntity<Faction>('faction', seed.factionId);
    if (!faction) {
      debug('Companion pool: faction not found', seed.factionId);
      return [];
    }
    const totalCount = faction.creatures.reduce((sum, e) => sum + e.count, 0);
    debug('Companion pool (faction):', seed.factionId, '→', faction.creatures.length, 'types,', totalCount, 'total');
    return faction.creatures;
  }

  const seedCreature = vault.getEntity<CreatureDefinition>('creature', seed.creatureId);
  if (!seedCreature) {
    debug('Companion pool: seed creature not found', seed.creatureId);
    return [];
  }

  const tagMatches = context.eligibleCreatures.filter(c =>
    c.tags.some(tag => seedCreature.tags.includes(tag))
  );
  debug('Companion pool (tag-match):', seedCreature.tags, '→', tagMatches.length, 'unique creatures');
  return tagMatches.map(c => ({ creatureId: c.id, count: 1 }));
}

// ============================================================================
// STEP 3.1: TEMPLATE-AUSWAHL
// ============================================================================

function hasSlotForRole(template: GroupTemplate, role: string): boolean {
  return Object.values(template.slots).some(slot => slot.designRole === role);
}

function canFulfillTemplate(
  companionPool: { creatureId: string; count: number }[],
  template: GroupTemplate,
  isFactionBased: boolean
): boolean {
  for (const slot of Object.values(template.slots)) {
    const creaturesWithRole = companionPool.filter(entry => {
      const creature = vault.getEntity<CreatureDefinition>('creature', entry.creatureId);
      return creature?.designRole === slot.designRole;
    });

    if (isFactionBased) {
      const minRequired = typeof slot.count === 'number' ? slot.count : slot.count.min;
      const totalCount = creaturesWithRole.reduce((sum, entry) => sum + entry.count, 0);
      if (totalCount < minRequired) {
        debug('canFulfill FAILED:', slot.designRole, '- need', minRequired, 'have', totalCount);
        return false;
      }
    } else {
      if (creaturesWithRole.length === 0) {
        debug('canFulfill FAILED:', slot.designRole, '- no creatures with role');
        return false;
      }
    }
  }
  debug('canFulfill OK:', template.id);
  return true;
}

function selectTemplate(
  seedCreature: CreatureDefinition,
  companionPool: { creatureId: string; count: number }[],
  faction: Faction | null
): GroupTemplate | undefined {
  const isFactionBased = faction !== null;

  if (faction?.encounterTemplates) {
    const viableTemplates = faction.encounterTemplates.filter(t =>
      hasSlotForRole(t, seedCreature.designRole) &&
      canFulfillTemplate(companionPool, t, isFactionBased)
    );
    if (viableTemplates.length > 0) {
      const selected = randomSelect(viableTemplates);
      debug('Template selected (Faction):', selected?.id);
      return selected ?? undefined;
    }
  }

  const genericTemplates = vault.getAllEntities<GroupTemplate>('group-template');
  const viableGeneric = genericTemplates.filter(t =>
    hasSlotForRole(t, seedCreature.designRole) &&
    canFulfillTemplate(companionPool, t, isFactionBased)
  );
  if (viableGeneric.length > 0) {
    const selected = randomSelect(viableGeneric);
    debug('Template selected (Generic):', selected?.id);
    return selected ?? undefined;
  }

  debug('Template selected: none (groupSize fallback)');
  return undefined;
}

// ============================================================================
// STEP 3.2: UTILITIES
// ============================================================================

function resolveCount(count: SlotCount): number {
  if (typeof count === 'number') return count;
  if ('avg' in count) return randomNormal(count.min, count.avg, count.max);
  return randomBetween(count.min, count.max);
}

function resolveGroupSize(creature: CreatureDefinition): number {
  const groupSize = creature.groupSize;
  if (typeof groupSize === 'number') return groupSize;
  if (groupSize) return randomBetween(groupSize.min, groupSize.max);
  return 1;
}

// ============================================================================
// STEP 3.3: NPC-MATCHING + GENERATION
// ============================================================================

function findExistingNPC(
  creature: CreatureDefinition,
  factionId: string | null,
  allNPCs: NPC[],
  usedNPCIds: Set<string>,
  position?: HexCoordinate
): NPC | null {
  const candidates = allNPCs.filter(
    npc =>
      npc.creature.id === creature.id &&
      npc.factionId === factionId &&
      npc.status === 'alive' &&
      !usedNPCIds.has(npc.id)
  );

  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0];

  const sorted = candidates.sort((a, b) => {
    if (position) {
      const distA = a.lastKnownPosition ? hexDistance(position, a.lastKnownPosition) : Infinity;
      const distB = b.lastKnownPosition ? hexDistance(position, b.lastKnownPosition) : Infinity;
      if (distA !== distB) return distA - distB;
    }
    const dayDiff = a.lastEncounter.day - b.lastEncounter.day;
    if (dayDiff !== 0) return dayDiff;
    return a.lastEncounter.hour - b.lastEncounter.hour;
  });

  return sorted[0];
}

interface MatchOrGenerateResult {
  npc: NPC;
  isGenerated: boolean;
}

function matchOrGenerateNPC(
  creature: CreatureDefinition,
  factionId: string | null,
  allNPCs: NPC[],
  usedNPCIds: Set<string>,
  context: NPCContext
): MatchOrGenerateResult {
  const matched = findExistingNPC(creature, factionId, allNPCs, usedNPCIds, context.position);
  if (matched) return { npc: matched, isGenerated: false };

  const faction = factionId ? vault.getEntity<Faction>('faction', factionId) : null;
  const generated = generateNewNPC(creature, faction, {
    position: context.position,
    time: context.time,
  });
  return { npc: generated, isGenerated: true };
}

// ============================================================================
// STEP 3.3: SLOT-BEFÜLLUNG (2 Funktionen)
// ============================================================================

/**
 * Erstellt N NPCs für einen Slot.
 */
function createNPCsForSlot(
  count: number,
  creaturePool: CreatureDefinition[],
  placeSeed: boolean,
  seedCreature: CreatureDefinition,
  factionId: string | null,
  context: NPCContext,
  allNPCs: NPC[],
  usedNPCIds: Set<string>
): { npcs: NPC[]; generatedNPCs: NPC[]; matchedNPCs: NPC[] } {
  if (count === 0) return { npcs: [], generatedNPCs: [], matchedNPCs: [] };

  const npcs: NPC[] = [];
  const generatedNPCs: NPC[] = [];
  const matchedNPCs: NPC[] = [];
  let remaining = count;

  // Seed zuerst platzieren
  if (placeSeed && remaining > 0) {
    const result = matchOrGenerateNPC(seedCreature, factionId, allNPCs, usedNPCIds, context);
    usedNPCIds.add(result.npc.id);
    npcs.push(result.npc);
    (result.isGenerated ? generatedNPCs : matchedNPCs).push(result.npc);
    remaining--;
  }

  // Restliche Plätze mit Pool-Kreaturen füllen
  for (let i = 0; i < remaining; i++) {
    const creature = randomSelect(creaturePool);
    if (!creature) break;

    const result = matchOrGenerateNPC(creature, factionId, allNPCs, usedNPCIds, context);
    usedNPCIds.add(result.npc.id);
    npcs.push(result.npc);
    (result.isGenerated ? generatedNPCs : matchedNPCs).push(result.npc);
  }

  return { npcs, generatedNPCs, matchedNPCs };
}

/**
 * Befüllt Slots mit NPCs (Template oder groupSize Fallback).
 */
function fillSlots(
  template: GroupTemplate | null,
  seedCreature: CreatureDefinition,
  companionPool: { creatureId: string; count: number }[],
  factionId: string | null,
  context: NPCContext,
  allNPCs: NPC[],
  usedNPCIds: Set<string>
): FillSlotsResult {
  const slots: Record<string, NPC[]> = {};
  const allGeneratedNPCs: NPC[] = [];
  const allMatchedNPCs: NPC[] = [];

  // Fallback: groupSize (kein Template)
  if (!template) {
    const count = resolveGroupSize(seedCreature);
    debug('GroupSize fallback:', seedCreature.id, '->', count);

    const result = createNPCsForSlot(
      count,
      [seedCreature],
      true,
      seedCreature,
      factionId,
      context,
      allNPCs,
      usedNPCIds
    );

    return {
      slots: { default: result.npcs },
      generatedNPCs: result.generatedNPCs,
      matchedNPCs: result.matchedNPCs,
    };
  }

  // Template-basiert: Loop über alle Slots
  for (const [slotName, slot] of Object.entries(template.slots)) {
    const count = resolveCount(slot.count);
    const isSeedSlot = slot.designRole === seedCreature.designRole;

    // Pool für diesen Slot: Kreaturen mit passender Design-Rolle
    const rolePool = companionPool
      .map(entry => vault.getEntity<CreatureDefinition>('creature', entry.creatureId))
      .filter((c): c is CreatureDefinition => c?.designRole === slot.designRole);

    const result = createNPCsForSlot(
      count,
      rolePool,
      isSeedSlot,
      seedCreature,
      factionId,
      context,
      allNPCs,
      usedNPCIds
    );

    slots[slotName] = result.npcs;
    allGeneratedNPCs.push(...result.generatedNPCs);
    allMatchedNPCs.push(...result.matchedNPCs);

    debug('Slot', slotName, 'filled:', result.npcs.length, 'NPCs');
  }

  return { slots, generatedNPCs: allGeneratedNPCs, matchedNPCs: allMatchedNPCs };
}

// ============================================================================
// HAUPT-FUNKTION
// ============================================================================

/**
 * Befüllt eine Encounter-Gruppe mit NPCs.
 *
 * Pipeline: groupSeed.ts -> fillGroup -> groupActivity.ts
 */
export function fillGroup(
  seed: { creatureId: string; factionId: string | null },
  context: FillGroupContext,
  role: NarrativeRole
): Result<FillGroupResult, FillGroupError> {
  debug('Input:', { seed: seed.creatureId, faction: seed.factionId, terrain: context.terrain.id, role });

  assertValidValue(context.timeSegment, TIME_SEGMENTS, 'timeSegment');

  // Seed-Kreatur laden
  const seedCreature = vault.getEntity<CreatureDefinition>('creature', seed.creatureId);
  if (!seedCreature) {
    debug('Seed creature not found:', seed.creatureId);
    return err({ code: 'SEED_CREATURE_NOT_FOUND' });
  }

  // Alle NPCs vorladen (Performance)
  const allNPCs = vault.getAllEntities<NPC>('npc');
  const usedNPCIds = new Set<string>();

  // Step 3.0: Companion-Pool
  const companionPool = getCompanionPool(seed, context);

  // Step 3.1: Template auswählen
  const faction = seed.factionId ? vault.getEntity<Faction>('faction', seed.factionId) : null;
  const template = selectTemplate(seedCreature, companionPool, faction);

  // Step 3.2 + 3.3: Slots befüllen
  const npcContext: NPCContext = { position: context.position, time: context.time };
  const { slots, generatedNPCs, matchedNPCs } = fillSlots(
    template ?? null,
    seedCreature,
    companionPool,
    seed.factionId,
    npcContext,
    allNPCs,
    usedNPCIds
  );

  // Step 3.4: npcIds Index
  const npcIds = Object.values(slots).flat().map(npc => npc.id);

  // Step 3.5: EncounterGroup
  const group: EncounterGroup = {
    groupId: crypto.randomUUID(),
    templateRef: template?.id,
    factionId: seed.factionId,
    slots,
    npcIds,
    narrativeRole: role,
    status: 'free',
  };

  debug('Output:', {
    groupId: group.groupId,
    templateRef: group.templateRef,
    slots: Object.keys(slots).length,
    npcCount: npcIds.length,
    generated: generatedNPCs.length,
    matched: matchedNPCs.length,
  });

  return ok({ group, generatedNPCs, matchedNPCs });
}
