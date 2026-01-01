// Gruppen-Population: Template -> Slots -> Kreaturen
// Siehe: docs/services/encounter/groupPopulation.md
//
// TASKS:
// | # | Status | Domain | Layer | Beschreibung | Prio | MVP? | Deps | Spec | Imp. |
// |--:|:------:|--------|-------|--------------|:----:|:----:|------|------|------|
// | 9 | ✅ | encounter | services | generateEncounterGroup: Funktionsname + Return-Typ (populate→generateEncounterGroup, null→Result) | mittel | Nein | - | groupPopulation.md#kern-funktion | - |
// | 16 | ✅ | encounter | services | Gruppen-Finalisierung: crypto.randomUUID(), templateRef-Tracking, status default | mittel | Nein | - | groupPopulation.md#Step 3.3: Gruppen-Finalisierung | - |
// | 17 | ✅ | encounter | services | Slot-Befüllung: resolveCount mit randomNormal, Design-Rolle-Matching strikt | mittel | Nein | - | groupPopulation.md#Step 3.2: Slot-Befuellung | - |
// | 18 | ✅ | encounter | services | Generic Templates aus Vault laden und prüfen | mittel | Nein | - | groupPopulation.md#Step 3.1: Template-Auswahl | - |
// | 19 | ✅ | encounter | services | Companion-Pool: Faction-Liste + Tag-Matching für fraktionslose Kreaturen | mittel | Nein | - | groupPopulation.md#Step 3.0: Companion-Pool Bildung | - |
// | 20 | ✅ | encounter | services | canFulfillTemplate: count-Summe statt Eintrags-Anzahl für Fraktionen | mittel | Nein | - | groupPopulation.md#Step 3.1: Template-Auswahl | - |
// | 21 | ✅ | encounter | services | PopulatedGroup Output-Schema: groupId, templateRef, slots-Map, status | mittel | Nein | - | groupPopulation.md#Output: PopulatedGroup | - |
// | 22 | ✅ | encounter | services | companionPool-Typen: {creatureId,count}[] für selectTemplate, canFulfillTemplate, fillSlot | mittel | Nein | - | groupPopulation.md#Step 3.1: Template-Auswahl | - |
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

import { vault } from '@/infrastructure/vault/vaultInstance';
import { randomBetween, randomNormal, randomSelect, assertValidValue, rollDice } from '@/utils';
import { TIME_SEGMENTS, type DesignRole, type NarrativeRole } from '@/constants';
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
 * 2. Generic Templates (vault: group-template)
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
 * Erstellt eine Kreatur-Instanz mit individuell gewürfelten HP und eindeutiger ID.
 */
function createInstance(creature: CreatureDefinition): CreatureInstance {
  const hp = rollDice(creature.hitDice);
  const instanceId = crypto.randomUUID();
  debug('Instance created:', creature.id, 'HP:', hp, 'ID:', instanceId.slice(0, 8));
  return {
    instanceId,
    definitionId: creature.id,
    currentHp: hp,
    maxHp: hp,
  };
}

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
 * Befüllt einen einzelnen Slot mit Kreatur-Instanzen (individuell gewürfelte HP).
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
): CreatureInstance[] {
  const slotCount = resolveCount(slot.count);
  if (slotCount === 0) return [];

  const instances: CreatureInstance[] = [];
  let remainingCount = slotCount;

  // Seed platzieren wenn dieser Slot sie enthält
  if (isSeedSlot) {
    instances.push(createInstance(seedCreature));
    remainingCount--;
    debug('Slot: placed seed', seedCreature.id);
  }

  if (remainingCount <= 0) return instances;

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
    return instances;
  }

  // Verbleibende Plätze mit Companions füllen
  for (let i = 0; i < remainingCount; i++) {
    const entry = randomSelect(roleMatches);
    if (!entry) break;

    const creature = vault.getEntity<CreatureDefinition>('creature', entry.creatureId);
    if (creature) {
      instances.push(createInstance(creature));
    }
  }

  debug('Slot filled:', slot.designRole, '->', instances.length, 'instances');
  return instances;
}

/**
 * Befüllt alle Slots eines Templates.
 * Gibt slots-Map zurück (slotName -> CreatureInstance[]).
 */
function fillAllSlots(
  template: GroupTemplate,
  seedCreature: CreatureDefinition,
  companionPool: { creatureId: string; count: number }[]
): { [slotName: string]: CreatureInstance[] } {
  const slots: { [slotName: string]: CreatureInstance[] } = {};

  for (const [slotName, slot] of Object.entries(template.slots)) {
    const isSeedSlot = slot.designRole === seedCreature.designRole;

    const slotInstances = fillSlot(slot, seedCreature, companionPool, isSeedSlot);
    slots[slotName] = slotInstances;

    debug('Slot', slotName, 'filled:', slotInstances.length, 'instances');
  }

  return slots;
}

/**
 * Generiert Gruppe basierend auf Creature.groupSize (kein Template).
 * Erstellt individuelle Instanzen mit gewürfelten HP.
 */
function fillFromGroupSize(
  seedCreature: CreatureDefinition
): { [slotName: string]: CreatureInstance[] } {
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

  // Individuelle Instanzen mit HP erstellen
  const instances: CreatureInstance[] = [];
  for (let i = 0; i < count; i++) {
    instances.push(createInstance(seedCreature));
  }

  return { default: instances };
}

// ============================================================================
// HAUPT-FUNKTION
// ============================================================================

/** GroupStatus für Encounter-Gruppen */
export type GroupStatus = 'free' | 'captive' | 'incapacitated' | 'fleeing';

/** CreatureInstance - Kreatur mit individuell gewürfelten HP und eindeutiger ID */
export interface CreatureInstance {
  instanceId: string;
  definitionId: string;
  currentHp: number;
  maxHp: number;
}

/** PopulatedGroup - Output von generateEncounterGroup() */
export interface PopulatedGroup {
  groupId: string;
  templateRef?: string;
  factionId: string | null;
  slots: { [slotName: string]: CreatureInstance[] };
  creatureIds: string[]; // Alle instanceIds (flat) für einfachen Zugriff
  narrativeRole: NarrativeRole;
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
  role: NarrativeRole
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
  let slots: { [slotName: string]: CreatureInstance[] };

  if (template) {
    slots = fillAllSlots(template, seedCreature, companionPool);
  } else {
    slots = fillFromGroupSize(seedCreature);
  }

  // -------------------------------------------------------------------------
  // Step 3.3: Gruppe finalisieren
  // -------------------------------------------------------------------------

  // Sammle alle instanceIds über alle Slots
  const creatureIds = Object.values(slots).flat().map(c => c.instanceId);

  const result: PopulatedGroup = {
    groupId: crypto.randomUUID(),
    templateRef: template?.id,
    factionId: seed.factionId,
    slots,
    creatureIds,
    narrativeRole: role,
    status: 'free',
  };

  debug('Output:', {
    groupId: result.groupId,
    templateRef: result.templateRef,
    slots: Object.keys(slots).length,
    creatureCount: creatureIds.length,
    role: result.narrativeRole,
  });

  return ok(result);
}
