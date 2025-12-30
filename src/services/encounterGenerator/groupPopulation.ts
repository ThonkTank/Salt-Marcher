// Gruppen-Population: Template -> Slots -> Kreaturen
// Siehe: docs/services/encounter/groupPopulation.md
//
// Pipeline-Position: Step 3 (nach groupSeed, vor Flavouring)
//
// Pipeline:
// 3.0: Companion-Pool bilden (Faction/Tag-Match)
//      - für Fraktionslose Kreaturen: Sammle alle native creatures mit übereinstimmenden tags
//      - für Kreaturen mit Fraktion: Übernimm die Mitgliedsliste der Fraktion (5 Wölfe, 2 direwolfs, 5 goblin hunter... etc.)
// 3.1: Template auswählen (Faction -> Generic -> groupSize Fallback)
//      - für Fraktionslose Kreaturen: Prüfe, ob native creatures mindestens eine kreatur für jede erforderliche design slot hat
//      - für Kreaturen mit Fraktion: Prüfe, ob die Fraktion mindestens eine Gruppe kreaturen mit erforderlicher Rolle und anzahl pro slot hat.
// 3.2: Slots befüllen (Design-Rolle matchen, Kreaturen zuweisen)
// 3.3: Gruppe finalisieren (EncounterGroup zusammenbauen)
//
// DISKREPANZEN (als [HACK] oder [TODO] markiert):
// ================================================
//
// (keine)
//
// RESOLVED:
// - [2025-12-29] Funktionsname korrigiert (groupPopulation.md#kern-funktion)
//   → populate() → generateEncounterGroup()
// - [2025-12-29] Return-Typ korrigiert (groupPopulation.md#kern-funktion)
//   → PopulatedGroup | null → Result<PopulatedGroup, PopulationError>
// - [2025-12-29] Output-Schema vollständig (groupPopulation.md#output-encountergroup)
//   → groupId, templateRef, slots-Map mit EncounterCreature[], status implementiert
//   → PopulatedGroup interface exportiert
// - [2025-12-29] Gruppen-Finalisierung vollständig (groupPopulation.md#step-33-gruppen-finalisierung)
//   → groupId via crypto.randomUUID()
//   → templateRef-Tracking implementiert
//   → status: 'free' als Default
// - [2025-12-29] Slot-Befüllung vollständig implementiert (groupPopulation.md#step-32-slot-befuellung)
//   → resolveCount nutzt randomNormal für avg-Feld
//   → Design-Rolle-Matching strikt (kein Fallback - vorherige Steps garantieren Erfüllbarkeit)
// - [2025-12-29] Generic Templates implementiert (groupPopulation.md#step-31-template-auswahl)
// - [2025-12-29] Companion-Pool implementiert (groupPopulation.md#step-30-companion-pool-bildung)
//   → Faction: { creatureId, count }[] + Zeit-Filter
//   → Fraktionslos: Tag-Matching mit eligibleCreatures
// - [2025-12-29] companionPool-Typen korrigiert (groupPopulation.md#step-31-template-auswahl, #step-32-slot-befuellung)
//   → selectTemplate, canFulfillTemplate, fillSlot, fillAllSlots akzeptieren jetzt { creatureId, count }[]
//   → Vault-Lookups für designRole-Zugriff
// - [2025-12-29] fillSlot Rollen-Filterung korrigiert
//   → Seed-Kreatur nicht mehr aus roleMatches ausgeschlossen
//   → Fallback entfernt - nur Kreaturen mit passender Rolle verwenden
// - [2025-12-29] canFulfillTemplate count-Logik korrigiert
//   → Prüft jetzt Summe der count-Werte statt Anzahl der Einträge für Fraktionen

import { vault } from '@/infrastructure/vault/vaultInstance';
import { randomBetween, randomNormal, randomSelect, assertValidValue } from '@/utils';
import { TIME_SEGMENTS, type DesignRole } from '@/constants';
import { type Result, ok, err } from '#types/common/Result';
import type { CreatureDefinition, GroupTemplate, SlotCount, SlotDef, Faction } from '@/types/entities';
import type { GameDateTime } from '#types/time';

// ============================================================================
// DEBUG HELPER
// ============================================================================

const debug = (...args: unknown[]) => {
  if (process.env.DEBUG_SERVICES === 'true') {
    console.log('[groupPopulation]', ...args);
  }
};

// ============================================================================
// STEP 3.0: COMPANION-POOL BILDUNG
// Siehe: docs/services/encounter/groupPopulation.md#step-30-companion-pool-bildung
// ============================================================================

/**
 * Lädt Companion-Kandidaten für die Seed-Kreatur.
 *
 * - Faction-basiert: Fraktionsliste direkt aus der Fraktion (Wölfe: 5, Direwolfs: 3... etc.)
 * - Fraktionslos: Native Kreaturen mit mind. einem tag welches mit der seed Kreatur übereinstimmt.
 */
function getCompanionPool(
  seed: { creatureId: string; factionId: string | null },
  context: { eligibleCreatures: CreatureDefinition[]; timeSegment: GameDateTime['segment'] }
): { creatureId: string; count: number }[] {
  // 1. Faction-basiert: creature-Liste direkt übernehmen (keine Zeit-Filterung)
  // Zeit-Präferenz wird bereits bei Seed-Auswahl in groupSeed.ts angewendet.
  // Companions sind Fraktionsmitglieder - deren Verfügbarkeit ist nicht zeitabhängig.
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

  // 2. Tag-basiert (fraktionslos): Tag-Match mit Seed
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
// Siehe: docs/services/encounter/groupPopulation.md#step-31-template-auswahl
// ============================================================================

/**
 * Prüft ob ein Template einen Slot für die gegebene Design-Rolle hat.
 */
function hasSlotForRole(template: GroupTemplate, role: DesignRole): boolean {
  return Object.values(template.slots).some(slot => slot.designRole === role);
}

/**
 * Prüft ob der Companion-Pool ein Template erfüllen kann.
 *
 * - Faction-basiert: Für jeden Slot muss die Fraktion genug Kreaturen haben
 * - Fraktionslos: Für jeden Slot muss mindestens EINE Kreatur mit passender Rolle existieren
 *   (unbegrenzt instanziierbar)
 */
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
      // Fraktion: Prüfe ob genug Kreaturen vorhanden (Summe der counts)
      const minRequired = typeof slot.count === 'number'
        ? slot.count
        : slot.count.min;
      const totalCount = creaturesWithRole.reduce((sum, entry) => sum + entry.count, 0);

      debug('canFulfill slot check:', {
        role: slot.designRole,
        required: minRequired,
        available: totalCount,
        creatures: creaturesWithRole.map(e => e.creatureId),
      });

      if (totalCount < minRequired) {
        debug('canFulfill FAILED:', slot.designRole, '- need', minRequired, 'have', totalCount);
        return false;
      }
    } else {
      // Fraktionslos: Nur prüfen ob IRGENDEINE Kreatur die Rolle erfüllt
      debug('canFulfill slot check:', {
        role: slot.designRole,
        required: 1,
        available: creaturesWithRole.length,
        creatures: creaturesWithRole.map(e => e.creatureId),
      });

      if (creaturesWithRole.length === 0) {
        debug('canFulfill FAILED:', slot.designRole, '- no creatures with role');
        return false;
      }
    }
  }
  debug('canFulfill OK:', template.id);
  return true;
}

/**
 * Wählt ein passendes Template für die Seed-Kreatur.
 *
 * Priorität:
 * 1. Faction-Templates (wenn vorhanden und erfüllbar)
 * 2. Generic Templates (TODO: nicht implementiert)
 * 3. undefined = groupSize Fallback
 */
function selectTemplate(
  seedCreature: CreatureDefinition,
  companionPool: { creatureId: string; count: number }[],
  faction: Faction | null
): GroupTemplate | undefined {
  const isFactionBased = faction !== null;

  // 1. Faction-Templates prüfen
  if (faction?.encounterTemplates) {
    const viableTemplates = faction.encounterTemplates.filter(t =>
      hasSlotForRole(t, seedCreature.designRole) &&
      canFulfillTemplate(companionPool, t, isFactionBased)
    );

    debug('Faction templates:', {
      checked: faction.encounterTemplates.length,
      viable: viableTemplates.length,
      ids: viableTemplates.map(t => t.id),
    });

    if (viableTemplates.length > 0) {
      const selected = randomSelect(viableTemplates);
      debug('Template selected (Faction):', selected?.id);
      return selected ?? undefined;
    }
  }

  // 2. Generic Templates
  const genericTemplates = vault.getAllEntities<GroupTemplate>('group-template');
  debug('Generic templates loaded:', genericTemplates.length);

  const viableGeneric = genericTemplates.filter(t =>
    hasSlotForRole(t, seedCreature.designRole) &&
    canFulfillTemplate(companionPool, t, isFactionBased)
  );
  debug('Viable generic templates:', viableGeneric.length, viableGeneric.map(t => t.id));

  if (viableGeneric.length > 0) {
    const selected = randomSelect(viableGeneric);
    debug('Template selected (Generic):', selected?.id);
    return selected ?? undefined;
  }

  // 3. Kein Template -> groupSize Fallback
  debug('Template selected: none (groupSize fallback)');
  return undefined;
}

// ============================================================================
// STEP 3.2: SLOT-BEFÜLLUNG
// Siehe: docs/services/encounter/groupPopulation.md#step-32-slot-befuellung
// ============================================================================

/**
 * Löst einen SlotCount zu einer konkreten Zahl auf.
 *
 * - Feste Zahl: direkt zurückgeben
 * - Uniform Range { min, max }: randomBetween(min, max)
 * - Normal Range { min, avg, max }: randomNormal(min, avg, max)
 */
function resolveCount(count: SlotCount): number {
  if (typeof count === 'number') {
    debug('resolveCount: fixed', count);
    return count;
  }
  if ('avg' in count) {
    const result = randomNormal(count.min, count.avg, count.max);
    debug('resolveCount: normal', { min: count.min, avg: count.avg, max: count.max }, '→', result);
    return result;
  }
  const result = randomBetween(count.min, count.max);
  debug('resolveCount: uniform', { min: count.min, max: count.max }, '→', result);
  return result;
}

/**
 * Befüllt einen einzelnen Slot mit Kreaturen.
 *
 * @param slot - Slot-Definition mit designRole und count
 * @param seedCreature - Die Seed-Kreatur (wird platziert wenn Rolle passt)
 * @param companionPool - Pool verfügbarer Companions
 * @param isSeedSlot - Ob dieser Slot die Seed-Kreatur enthält
 */
function fillSlot(
  slot: SlotDef,
  seedCreature: CreatureDefinition,
  companionPool: { creatureId: string; count: number }[],
  isSeedSlot: boolean
): { creatureId: string; count: number }[] {
  const slotCount = resolveCount(slot.count);
  if (slotCount === 0) return [];

  const result: { creatureId: string; count: number }[] = [];
  let remainingCount = slotCount;

  // Seed platzieren wenn dieser Slot sie enthält
  if (isSeedSlot) {
    result.push({ creatureId: seedCreature.id, count: 1 });
    remainingCount--;
    debug('Slot: placed seed', seedCreature.id);
  }

  if (remainingCount <= 0) return result;

  // Companions nach Design-Rolle filtern (Seed NICHT ausschließen)
  const roleMatches = companionPool.filter(entry => {
    const creature = vault.getEntity<CreatureDefinition>('creature', entry.creatureId);
    return creature?.designRole === slot.designRole;
  });

  debug('fillSlot candidates:', {
    role: slot.designRole,
    targetCount: slotCount,
    candidates: roleMatches.length,
    ids: roleMatches.map(e => e.creatureId),
  });

  // Kein Fallback - nur Kreaturen mit passender Rolle verwenden
  if (roleMatches.length === 0) {
    debug('Slot: no creatures match role', slot.designRole);
    return result;
  }

  const candidates = roleMatches;

  // Verbleibende Plätze mit Companions füllen
  for (let i = 0; i < remainingCount; i++) {
    const entry = randomSelect(candidates);
    if (!entry) break;

    const existing = result.find(r => r.creatureId === entry.creatureId);
    if (existing) {
      existing.count++;
    } else {
      result.push({ creatureId: entry.creatureId, count: 1 });
    }
  }

  debug('Slot filled:', slot.designRole, '->', result.map(r => `${r.creatureId}x${r.count}`).join(', '));
  return result;
}

/**
 * Befüllt alle Slots eines Templates.
 * Gibt slots-Map zurück (slotName -> EncounterCreature[]).
 */
function fillAllSlots(
  template: GroupTemplate,
  seedCreature: CreatureDefinition,
  companionPool: { creatureId: string; count: number }[]
): { [slotName: string]: { creatureId: string; count: number }[] } {
  const slots: { [slotName: string]: { creatureId: string; count: number }[] } = {};

  for (const [slotName, slot] of Object.entries(template.slots)) {
    const isSeedSlot = slot.designRole === seedCreature.designRole;

    const slotCreatures = fillSlot(slot, seedCreature, companionPool, isSeedSlot);
    slots[slotName] = slotCreatures;

    debug('Slot', slotName, 'filled:', slotCreatures.length, 'entries');
  }

  return slots;
}

/**
 * Generiert Gruppe basierend auf Creature.groupSize (kein Template).
 * Wraps creatures in a synthetic 'default' slot.
 */
function fillFromGroupSize(
  seedCreature: CreatureDefinition
): { [slotName: string]: { creatureId: string; count: number }[] } {
  const groupSize = seedCreature.groupSize;

  let count: number;
  if (typeof groupSize === 'number') {
    count = groupSize;
  } else if (groupSize) {
    count = randomBetween(groupSize.min, groupSize.max);
  } else {
    count = 1; // Solo als letzter Fallback
  }

  debug('GroupSize fallback:', seedCreature.id, '->', count);
  return { default: [{ creatureId: seedCreature.id, count }] };
}

// ============================================================================
// HAUPT-FUNKTION
// ============================================================================

/** GroupStatus für Encounter-Gruppen */
export type GroupStatus = 'free' | 'captive' | 'incapacitated' | 'fleeing';

/** EncounterCreature für Slot-Einträge */
export interface EncounterCreature {
  creatureId: string;
  count: number;
  npcId?: string;
}

/** PopulatedGroup - Output von generateEncounterGroup() */
export interface PopulatedGroup {
  groupId: string;
  templateRef?: string;
  factionId: string | null;
  slots: { [slotName: string]: EncounterCreature[] };
  narrativeRole: 'threat' | 'victim' | 'neutral' | 'ally';
  status: GroupStatus;
}

/** Error-Typ für generateEncounterGroup() */
export type PopulationError = { code: 'SEED_CREATURE_NOT_FOUND' };

/**
 * Befüllt eine Encounter-Gruppe basierend auf Seed und Template.
 *
 * Pipeline: groupSeed.ts -> generateEncounterGroup -> groupActivity.ts
 *
 * @param seed - Seed-Auswahl von groupSeed.ts
 * @param context - Terrain-Kontext
 * @param role - Narrative Rolle der Gruppe
 */
export function generateEncounterGroup(
  seed: { creatureId: string; factionId: string | null },
  context: {
    terrain: { id: string };
    timeSegment: GameDateTime['segment'];
    eligibleCreatures: CreatureDefinition[];
  },
  role: 'threat' | 'victim' | 'neutral' | 'ally'
): Result<PopulatedGroup, PopulationError> {
  debug('Input:', {
    seed: seed.creatureId,
    faction: seed.factionId,
    terrain: context.terrain.id,
    role,
  });

  // Input-Validierung
  assertValidValue(context.timeSegment, TIME_SEGMENTS, 'timeSegment');

  // -------------------------------------------------------------------------
  // Seed-Kreatur laden
  // -------------------------------------------------------------------------
  const seedCreature = vault.getEntity<CreatureDefinition>('creature', seed.creatureId);
  if (!seedCreature) {
    debug('Seed creature not found:', seed.creatureId);
    return err({ code: 'SEED_CREATURE_NOT_FOUND' });
  }

  // -------------------------------------------------------------------------
  // Step 3.0: Companion-Pool bilden
  // -------------------------------------------------------------------------
  const companionPool = getCompanionPool(seed, context);

  // -------------------------------------------------------------------------
  // Step 3.1: Template auswählen
  // -------------------------------------------------------------------------
  const faction = seed.factionId
    ? vault.getEntity<Faction>('faction', seed.factionId)
    : null;

  const template = selectTemplate(seedCreature, companionPool, faction);

  // -------------------------------------------------------------------------
  // Step 3.2: Slots befüllen
  // -------------------------------------------------------------------------
  let slots: { [slotName: string]: { creatureId: string; count: number }[] };

  if (template) {
    slots = fillAllSlots(template, seedCreature, companionPool);
  } else {
    slots = fillFromGroupSize(seedCreature);
  }

  // -------------------------------------------------------------------------
  // Step 3.3: Gruppe finalisieren
  // -------------------------------------------------------------------------
  const result: PopulatedGroup = {
    groupId: crypto.randomUUID(),
    templateRef: template?.id,
    factionId: seed.factionId,
    slots,
    narrativeRole: role,
    status: 'free',
  };

  // Debug: Zähle alle Kreaturen über alle Slots
  const totalCreatures = Object.values(slots).flat();
  const totalCount = totalCreatures.reduce((sum, c) => sum + c.count, 0);

  debug('Output:', {
    groupId: result.groupId,
    templateRef: result.templateRef,
    slots: Object.keys(slots).length,
    creatures: totalCreatures.length,
    total: totalCount,
    role: result.narrativeRole,
  });

  return ok(result);
}
