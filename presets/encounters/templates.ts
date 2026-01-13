// Ziel: Template Encounter Presets (migriert von presets/scenarios/index.ts)
// Siehe: docs/types/encounter-preset.md
//
// Diese Presets verwenden Creature-IDs mit Counts statt fixer NPC-IDs.
// NPCs werden zur Runtime generiert basierend auf den Creature-Definitionen.
// Party wird von der aufrufenden Funktion uebergeben (aus Session oder Config).

import { z } from 'zod';
import { templatePresetSchema, type TemplatePreset } from '../../src/types/entities/encounterPreset';

// ============================================================================
// PRESET-SCHEMA VALIDATION
// ============================================================================

const templatePresetsSchema = z.array(templatePresetSchema);

// ============================================================================
// TEMPLATE PRESETS
// ============================================================================

const templatePresets: TemplatePreset[] = templatePresetsSchema.parse([
  {
    id: 'goblin-ambush',
    name: 'Goblin Ambush',
    description: '3 Goblins ueberraschen die Party',
    mode: 'template',
    groups: [
      {
        groupId: 'ambushers',
        creatures: [{ creatureId: 'goblin', count: 3 }],
        narrativeRole: 'threat',
      },
    ],
    tags: ['goblin', 'ambush', 'easy'],
  },
  {
    id: 'wolf-pack',
    name: 'Wolf Pack',
    description: '4 Woelfe jagen als Rudel',
    mode: 'template',
    groups: [
      {
        groupId: 'pack',
        creatures: [{ creatureId: 'wolf', count: 4 }],
        narrativeRole: 'threat',
      },
    ],
    tags: ['wolf', 'beast', 'pack-tactics'],
  },
  {
    id: 'bandit-camp',
    name: 'Bandit Encounter',
    description: 'Banditen-Trupp mit Captain',
    mode: 'template',
    groups: [
      {
        groupId: 'bandits',
        creatures: [
          { creatureId: 'bandit', count: 2 },
          { creatureId: 'bandit-captain', count: 1 },
        ],
        narrativeRole: 'threat',
        factionId: 'schmuggler',
      },
    ],
    tags: ['bandit', 'humanoid', 'leader'],
  },
  {
    id: 'owlbear-hunt',
    name: 'Owlbear Hunt',
    description: 'Einzelner Owlbear - gefaehrlicher Solo-Gegner',
    mode: 'template',
    groups: [
      {
        groupId: 'beast',
        creatures: [{ creatureId: 'owlbear', count: 1 }],
        narrativeRole: 'threat',
      },
    ],
    tags: ['owlbear', 'beast', 'solo', 'hard'],
  },
  {
    id: 'goblin-warband',
    name: 'Goblin Warband',
    description: 'Goblin-Kriegstrupp mit Hobgoblins und Boss',
    mode: 'template',
    groups: [
      {
        groupId: 'warband',
        creatures: [
          { creatureId: 'goblin', count: 4 },
          { creatureId: 'hobgoblin', count: 2 },
          { creatureId: 'goblin-boss', count: 1 },
        ],
        narrativeRole: 'threat',
        factionId: 'bergstamm',
      },
    ],
    tags: ['goblin', 'hobgoblin', 'warband', 'deadly'],
  },
  {
    id: 'skeleton-horde',
    name: 'Skeleton Horde',
    description: 'Skelett-Horde - viele schwache Untote',
    mode: 'template',
    groups: [
      {
        groupId: 'undead',
        creatures: [{ creatureId: 'skeleton', count: 6 }],
        narrativeRole: 'threat',
      },
    ],
    tags: ['skeleton', 'undead', 'horde', 'moderate'],
  },
]);

// ============================================================================
// EXPORTS
// ============================================================================

/** Alle Template Presets. */
export { templatePresets };

/** Findet ein Preset nach ID. */
export function getTemplatePresetById(id: string): TemplatePreset | undefined {
  return templatePresets.find(p => p.id === id);
}

export default templatePresets;
