// Ziel: Preset → EncounterGroup[] Resolution
// Siehe: docs/services/encounterLoader.md
//
// Transformiert EncounterPreset in runtime-faehige EncounterGroups:
// - authored: Laedt NPCs per ID aus Vault
// - template: Generiert NPCs aus Creature-IDs
// - embedded: Passiert Groups durch

import type { EncounterGroup } from '@/types/encounterTypes';
import type { NPC } from '@/types/entities/npc';
import type { CreatureDefinition, SlotCount } from '@/types/entities';
import type {
  EncounterPreset,
  AuthoredPreset,
  TemplatePreset,
  EmbeddedPreset,
  AuthoredGroup,
  TemplateGroup,
} from '@/types/entities/encounterPreset';
import { vault } from '@/infrastructure/vault/vaultInstance';
import { randomBetween, randomNormal } from '@/utils/probability';
import type { ProbabilityDistribution } from '@/utils/probability';

// ============================================================================
// DEBUG HELPER
// ============================================================================

const debug = (...args: unknown[]) => {
  if (process.env.DEBUG_SERVICES === 'true') {
    console.log('[encounterLoader]', ...args);
  }
};

// ============================================================================
// SLOT COUNT RESOLUTION
// ============================================================================

/**
 * Loest SlotCount zu einer konkreten Anzahl auf.
 * Kopiert aus fillGroups.ts fuer Konsistenz.
 */
function resolveCount(count: SlotCount): number {
  if (typeof count === 'number') return count;
  if ('avg' in count) return randomNormal(count.min, count.avg, count.max);
  return randomBetween(count.min, count.max);
}

// ============================================================================
// NPC GENERATION (fuer Template Mode)
// ============================================================================

let npcCounter = 0;

/**
 * Generiert eine minimale NPC-Instanz aus einer CreatureDefinition.
 * Fuer Template-Mode: Ephemere NPCs ohne Persistenz.
 */
function generateNPC(creatureId: string, factionId?: string): NPC {
  const creature = vault.getEntity<CreatureDefinition>('creature', creatureId);
  if (!creature) {
    throw new Error(`Creature not found: ${creatureId}`);
  }

  const id = `generated-${creatureId}-${++npcCounter}`;
  // creature.averageHp is already a number (ceil of dice avg)
  const averageHp = creature.averageHp;

  // currentHp is a ProbabilityDistribution (Map<number, probability>)
  const currentHpMap: ProbabilityDistribution = new Map([[averageHp, 1]]);

  // Minimal date for generated NPCs (ephemeral, not persisted)
  const now = { year: 1, month: 1, day: 1, hour: 12, segment: 'midday' as const };

  return {
    id,
    name: `${creature.name} #${npcCounter}`,
    creature: { type: creature.id, id: creature.id },
    factionId: factionId,  // undefined if not provided
    status: 'alive',
    currentHp: currentHpMap,
    maxHp: averageHp,
    encounterCount: 1,
    // Required fields with sensible defaults for generated NPCs
    personality: 'neutral',
    value: 'survival',
    goal: 'combat',
    firstEncounter: now,
    lastEncounter: now,
    reputations: [],
    possessions: [],
  };
}

// ============================================================================
// MODE-SPECIFIC RESOLUTION
// ============================================================================

/**
 * Authored Mode: Laedt NPCs per ID aus Vault.
 */
function resolveAuthoredGroups(preset: AuthoredPreset): EncounterGroup[] {
  debug('Resolving authored preset:', preset.id);

  return preset.groups.map((group: AuthoredGroup) => {
    const npcs: NPC[] = group.npcIds.map(npcId => {
      const npc = vault.getEntity<NPC>('npc', npcId);
      if (!npc) {
        throw new Error(`NPC not found: ${npcId}`);
      }
      return npc;
    });

    debug('  Group', group.groupId, '→', npcs.length, 'NPCs');

    return {
      groupId: group.groupId,
      factionId: group.factionId ?? npcs[0]?.factionId ?? null,
      narrativeRole: group.narrativeRole ?? 'threat',
      status: 'free' as const,
      slots: { authored: npcs },
      npcIds: group.npcIds,
    };
  });
}

/**
 * Template Mode: Generiert NPCs aus Creature-IDs.
 */
function resolveTemplateGroups(preset: TemplatePreset): EncounterGroup[] {
  debug('Resolving template preset:', preset.id);

  return preset.groups.map((group: TemplateGroup) => {
    const npcs: NPC[] = [];

    for (const entry of group.creatures) {
      const count = resolveCount(entry.count);
      debug('  Creature', entry.creatureId, '×', count);

      for (let i = 0; i < count; i++) {
        npcs.push(generateNPC(entry.creatureId, group.factionId));
      }
    }

    return {
      groupId: group.groupId,
      factionId: group.factionId ?? null,
      narrativeRole: group.narrativeRole ?? 'threat',
      status: 'free' as const,
      slots: { template: npcs },
      npcIds: npcs.map(n => n.id),
    };
  });
}

/**
 * Embedded Mode: Groups werden direkt durchgereicht.
 */
function resolveEmbeddedGroups(preset: EmbeddedPreset): EncounterGroup[] {
  debug('Resolving embedded preset:', preset.id);
  return preset.groups;
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Transformiert ein EncounterPreset in runtime-faehige EncounterGroups.
 *
 * @param preset Das zu resolvende Preset
 * @returns Array von EncounterGroups fuer initialiseCombat()
 * @throws Error wenn NPCs/Creatures nicht gefunden werden
 */
export function resolvePreset(preset: EncounterPreset): EncounterGroup[] {
  switch (preset.mode) {
    case 'authored':
      return resolveAuthoredGroups(preset as AuthoredPreset);
    case 'template':
      return resolveTemplateGroups(preset as TemplatePreset);
    case 'embedded':
      return resolveEmbeddedGroups(preset as EmbeddedPreset);
    default:
      throw new Error(`Unknown preset mode: ${(preset as { mode: string }).mode}`);
  }
}

/**
 * Berechnet Default-Allianzen basierend auf narrativeRole.
 * - 'ally' Groups sind mit 'party' verbuendet
 * - Alle anderen sind Feinde
 */
export function calculateDefaultAlliances(
  groups: EncounterGroup[]
): Record<string, string[]> {
  const alliances: Record<string, string[]> = {
    party: [],
  };

  for (const group of groups) {
    if (group.narrativeRole === 'ally') {
      // Allies sind mit Party verbuendet
      alliances.party.push(group.groupId);
      alliances[group.groupId] = ['party'];
    } else {
      // Feinde sind untereinander verbuendet (nach Faction)
      alliances[group.groupId] = groups
        .filter(g =>
          g.groupId !== group.groupId &&
          g.narrativeRole !== 'ally' &&
          (g.factionId === group.factionId || !g.factionId || !group.factionId)
        )
        .map(g => g.groupId);
    }
  }

  return alliances;
}

/**
 * Setzt den NPC-Counter zurueck (fuer Tests).
 */
export function resetNpcCounter(): void {
  npcCounter = 0;
}
