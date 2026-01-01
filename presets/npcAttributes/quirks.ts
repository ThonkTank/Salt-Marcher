// Quirk-Presets für NPC-Generierung
// Siehe: docs/services/npcs/NPC-Generation.md
//
// Quirks sind kleine Eigenheiten und Verhaltensweisen.
// Werden per ID in Culture.quirks referenziert.
// compatibleTags filtert nach Creature-Kompatibilität (leer = alle).

import { z } from 'zod';

// ============================================================================
// SCHEMA
// ============================================================================

export const quirkAttributeSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  compatibleTags: z.array(z.string()).optional(),
});

export type QuirkAttribute = z.infer<typeof quirkAttributeSchema>;

// ============================================================================
// PRESET-DATEN
// ============================================================================

export const quirkPresets: QuirkAttribute[] = [
  // ──────────────────────────────────────────────────────────────────────────
  // Nervöse Gewohnheiten
  // ──────────────────────────────────────────────────────────────────────────
  {
    id: 'nervous_laugh',
    name: 'Nervöses Lachen',
    description: 'Kichert nervös in Stresssituationen',
    compatibleTags: ['humanoid'],
  },
  {
    id: 'fidgets',
    name: 'Zappelig',
    description: 'Kann nicht stillstehen, zappelt ständig',
  },
  {
    id: 'bites_nails',
    name: 'Nagel-Kauen',
    description: 'Kaut an den Krallen oder Fingernägeln',
    compatibleTags: ['humanoid', 'goblinoid'],
  },
  {
    id: 'nervous_tic',
    name: 'Nervöses Zucken',
    description: 'Unwillkürliches nervöses Zucken',
    compatibleTags: ['humanoid'],
  },
  {
    id: 'paranoid_glances',
    name: 'Paranoide Blicke',
    description: 'Schaut ständig über die Schulter',
  },

  // ──────────────────────────────────────────────────────────────────────────
  // Sprach-/Kommunikationsgewohnheiten
  // ──────────────────────────────────────────────────────────────────────────
  {
    id: 'talks_to_self',
    name: 'Selbstgespräche',
    description: 'Führt Selbstgespräche, oft über vergangene Ereignisse',
    compatibleTags: ['humanoid'],
  },
  {
    id: 'talks_fast',
    name: 'Schnellsprecher',
    description: 'Spricht hektisch und viel zu schnell',
    compatibleTags: ['humanoid'],
  },
  {
    id: 'whistles_tune',
    name: 'Pfeift Melodie',
    description: 'Pfeift ständig eine bestimmte Melodie',
    compatibleTags: ['humanoid'],
  },
  {
    id: 'tells_stories',
    name: 'Geschichtenerzähler',
    description: 'Erzählt gern lange Geschichten',
    compatibleTags: ['humanoid'],
  },
  {
    id: 'excessive_politeness',
    name: 'Übertrieben höflich',
    description: 'Unangemessen höflich, auch gegenüber Feinden',
    compatibleTags: ['humanoid'],
  },
  {
    id: 'compulsive_liar',
    name: 'Zwanghafter Lügner',
    description: 'Lügt selbst über triviale Dinge',
    compatibleTags: ['humanoid'],
  },

  // ──────────────────────────────────────────────────────────────────────────
  // Sammel-/Obsessionen
  // ──────────────────────────────────────────────────────────────────────────
  {
    id: 'hoards_shiny',
    name: 'Sammelt Glänzendes',
    description: 'Sammelt obsessiv glänzende Gegenstände',
  },
  {
    id: 'counts_coins',
    name: 'Zählt Münzen',
    description: 'Zählt ständig Münzen und prüft deren Echtheit',
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

  // ──────────────────────────────────────────────────────────────────────────
  // Aberglaube/Rituale
  // ──────────────────────────────────────────────────────────────────────────
  {
    id: 'superstitious',
    name: 'Abergläubisch',
    description: 'Befolgt obsessiv Aberglauben und Rituale',
    compatibleTags: ['humanoid'],
  },
  {
    id: 'sea_superstition',
    name: 'See-Aberglaube',
    description: 'Abergläubisch bezüglich des Meeres',
    compatibleTags: ['humanoid'],
  },

  // ──────────────────────────────────────────────────────────────────────────
  // Essgewohnheiten
  // ──────────────────────────────────────────────────────────────────────────
  {
    id: 'always_hungry',
    name: 'Immer hungrig',
    description: 'Isst ständig oder redet übers Essen',
  },

  // ──────────────────────────────────────────────────────────────────────────
  // Physische Eigenheiten
  // ──────────────────────────────────────────────────────────────────────────
  {
    id: 'old_scar',
    name: 'Alte Narbe',
    description: 'Reibt sich unbewusst eine alte Narbe',
  },
  {
    id: 'limps',
    name: 'Hinkt',
    description: 'Hinkt aufgrund einer alten Verletzung',
  },
  {
    id: 'scarred_hide',
    name: 'Vernarbtes Fell',
    description: 'Auffällige Narben im Fell oder auf der Haut',
  },

  // ──────────────────────────────────────────────────────────────────────────
  // Tierische Verhaltensweisen
  // ──────────────────────────────────────────────────────────────────────────
  {
    id: 'territorial_marking',
    name: 'Territoriales Markieren',
    description: 'Markiert obsessiv sein Territorium',
    compatibleTags: ['beast', 'monstrosity'],
  },

  // ──────────────────────────────────────────────────────────────────────────
  // Soziale Eigenheiten
  // ──────────────────────────────────────────────────────────────────────────
  {
    id: 'despises_cowards',
    name: 'Verachtet Feiglinge',
    description: 'Zeigt offene Verachtung für Feiglinge',
    compatibleTags: ['humanoid'],
  },
  {
    id: 'fear_of_heights',
    name: 'Höhenangst',
    description: 'Hat Höhenangst trotz Bergherkunft',
  },
];

export default quirkPresets;
