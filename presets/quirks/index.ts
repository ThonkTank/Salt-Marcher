// Quirk-Presets für NPC-Generierung
// Siehe: docs/services/npcs/NPC-Generation.md#Quirk-Generierung
//
// Quirks werden per ID in Culture referenziert.
// compatibleTags filtert nach Creature-Kompatibilität (leer = alle).

import { z } from 'zod';
import { quirkSchema, type Quirk } from '../../src/types/entities/quirk';

// ============================================================================
// PRESET-SCHEMA
// ============================================================================

export const quirkPresetSchema = quirkSchema;
export const quirkPresetsSchema = z.array(quirkPresetSchema);

// ============================================================================
// PRESET-DATEN
// ============================================================================

export const quirkPresets: Quirk[] = quirkPresetsSchema.parse([
  // ──────────────────────────────────────────────────────────────────────────
  // Goblinoid-Quirks
  // ──────────────────────────────────────────────────────────────────────────
  {
    id: 'nervous_laugh',
    name: 'Nervöses Lachen',
    description: 'Kichert nervös in Stresssituationen',
    compatibleTags: ['humanoid'],
  },
  {
    id: 'hoards_shiny',
    name: 'Sammelt Glänzendes',
    description: 'Sammelt obsessiv glänzende Gegenstände',
  },
  {
    id: 'fear_of_heights',
    name: 'Höhenangst',
    description: 'Ironischerweise Höhenangst trotz Bergherkunft',
  },

  // ──────────────────────────────────────────────────────────────────────────
  // Schmuggler-/Kriminellen-Quirks
  // ──────────────────────────────────────────────────────────────────────────
  {
    id: 'counts_coins',
    name: 'Zählt Münzen',
    description: 'Zählt ständig Münzen und prüft deren Echtheit',
    compatibleTags: ['humanoid'],
  },
  {
    id: 'sea_superstition',
    name: 'See-Aberglaube',
    description: 'Abergläubisch bezüglich des Meeres',
    compatibleTags: ['humanoid'],
  },
  {
    id: 'old_scar',
    name: 'Alte Narbe',
    description: 'Reibt sich unbewusst eine alte Narbe',
  },

  // ──────────────────────────────────────────────────────────────────────────
  // Allgemeine Humanoid-Quirks
  // ──────────────────────────────────────────────────────────────────────────
  {
    id: 'whistles_tune',
    name: 'Pfeift Melodie',
    description: 'Pfeift ständig eine bestimmte Melodie',
    compatibleTags: ['humanoid'],
  },
  {
    id: 'talks_to_self',
    name: 'Selbstgespräche',
    description: 'Führt Selbstgespräche, oft über vergangene Ereignisse',
    compatibleTags: ['humanoid'],
  },
  {
    id: 'always_hungry',
    name: 'Immer hungrig',
    description: 'Isst ständig oder redet übers Essen',
  },
  {
    id: 'superstitious',
    name: 'Abergläubisch',
    description: 'Befolgt obsessiv Aberglauben und Rituale',
    compatibleTags: ['humanoid'],
  },
  {
    id: 'compulsive_liar',
    name: 'Zwanghafter Lügner',
    description: 'Lügt selbst über triviale Dinge',
    compatibleTags: ['humanoid'],
  },
  {
    id: 'fidgets',
    name: 'Zappelig',
    description: 'Kann nicht stillstehen, zappelt ständig',
  },
  {
    id: 'excessive_politeness',
    name: 'Übertrieben höflich',
    description: 'Unangemessen höflich, auch gegenüber Feinden',
    compatibleTags: ['humanoid'],
  },
  {
    id: 'paranoid_glances',
    name: 'Paranoide Blicke',
    description: 'Schaut ständig über die Schulter',
  },

  // ──────────────────────────────────────────────────────────────────────────
  // Beast/Monster-Quirks
  // ──────────────────────────────────────────────────────────────────────────
  {
    id: 'limps',
    name: 'Hinkt',
    description: 'Hinkt aufgrund einer alten Verletzung',
  },
  {
    id: 'missing_eye',
    name: 'Fehlendes Auge',
    description: 'Hat ein Auge verloren, schlechte Tiefenwahrnehmung',
  },
  {
    id: 'scarred_hide',
    name: 'Vernarbtes Fell',
    description: 'Auffällige Narben im Fell oder auf der Haut',
  },
  {
    id: 'territorial_marking',
    name: 'Territoriales Markieren',
    description: 'Markiert obsessiv sein Territorium',
    compatibleTags: ['beast', 'monstrosity'],
  },

  // ──────────────────────────────────────────────────────────────────────────
  // Goblinoid/Militär-Quirks
  // ──────────────────────────────────────────────────────────────────────────
  {
    id: 'bites_nails',
    name: 'Nagel-Kauen',
    description: 'Kaut an den Krallen oder Fingernägeln',
    compatibleTags: ['humanoid', 'goblinoid'],
  },
  {
    id: 'talks_fast',
    name: 'Schnellsprecher',
    description: 'Spricht hektisch und viel zu schnell',
    compatibleTags: ['humanoid'],
  },
  {
    id: 'counts_kills',
    name: 'Zählt Siege',
    description: 'Führt akribisch Buch über besiegte Feinde',
    compatibleTags: ['humanoid'],
  },
  {
    id: 'polishes_armor',
    name: 'Ausrüstungs-Pflege',
    description: 'Poliert ständig Waffen und Rüstung',
    compatibleTags: ['humanoid'],
  },
  {
    id: 'despises_cowards',
    name: 'Verachtet Feiglinge',
    description: 'Zeigt offene Verachtung für Feiglinge',
    compatibleTags: ['humanoid'],
  },
  {
    id: 'tells_stories',
    name: 'Geschichtenerzähler',
    description: 'Erzählt gern lange Geschichten',
    compatibleTags: ['humanoid'],
  },
  {
    id: 'nervous_tic',
    name: 'Nervöses Zucken',
    description: 'Unwillkürliches nervöses Zucken',
    compatibleTags: ['humanoid'],
  },
]);

export default quirkPresets;
