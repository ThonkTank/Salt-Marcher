// Generische Encounter-Templates (Fallback fuer fraktionslose Encounters)
// Siehe: docs/services/encounter/groupPopulation.md#generische-templates

import { z } from 'zod';
import { groupTemplateSchema } from '../../src/types/entities/groupTemplate';

// ============================================================================
// PRESET-SCHEMA
// ============================================================================

/**
 * Generic Templates nutzen das gleiche Schema wie Faction-Templates.
 * Der Unterschied ist nur der Verwendungskontext:
 * - Faction-Templates: gehoeren zu einer Faction
 * - Generic Templates: Fallback fuer fraktionslose Kreaturen
 */
export const genericGroupTemplateSchema = groupTemplateSchema;
export const genericGroupTemplatesSchema = z.array(genericGroupTemplateSchema);

// ============================================================================
// PRESET-DATEN
// ============================================================================

export const genericGroupTemplates = genericGroupTemplatesSchema.parse([
  // ──────────────────────────────────────────────────────────────────────────
  // SOLO - Einzelne maechtige Kreatur
  // ──────────────────────────────────────────────────────────────────────────
  {
    id: 'solo',
    name: 'Einzelgaenger',
    description: 'Eine einzelne maechtige Kreatur, die alleine kaempft',
    slots: {
      creature: { designRole: 'solo', count: 1 },
    },
  },

  // ──────────────────────────────────────────────────────────────────────────
  // PAIR - Zwei gleichstarke Kreaturen
  // ──────────────────────────────────────────────────────────────────────────
  {
    id: 'pair',
    name: 'Paar',
    description: 'Zwei Kreaturen, oft ein Paarung oder Partner',
    slots: {
      creatures: { designRole: 'soldier', count: 2 },
    },
  },

  // ──────────────────────────────────────────────────────────────────────────
  // PACK - Mobiles Rudel
  // ──────────────────────────────────────────────────────────────────────────
  {
    id: 'pack',
    name: 'Rudel',
    description: 'Mobiles Rudel von Jaegern oder Raeubern',
    slots: {
      hunters: { designRole: 'skirmisher', count: { min: 3, avg: 5, max: 8 } },
    },
  },

  // ──────────────────────────────────────────────────────────────────────────
  // HORDE - Masse schwacher Kreaturen
  // ──────────────────────────────────────────────────────────────────────────
  {
    id: 'horde',
    name: 'Horde',
    description: 'Grosse Masse schwacher Kreaturen',
    slots: {
      minions: { designRole: 'minion', count: { min: 6, avg: 12, max: 20 } },
    },
  },

  // ──────────────────────────────────────────────────────────────────────────
  // LEADER-MINIONS - Klassisches D&D Setup
  // ──────────────────────────────────────────────────────────────────────────
  {
    id: 'leader-minions',
    name: 'Anfuehrer mit Gefolge',
    description: 'Ein Anfuehrer mit einer Gruppe von Untergebenen',
    slots: {
      leader: { designRole: 'leader', count: 1 },
      followers: { designRole: 'minion', count: { min: 2, avg: 4, max: 6 } },
    },
  },

  // ──────────────────────────────────────────────────────────────────────────
  // SQUAD - Taktische Einheit
  // ──────────────────────────────────────────────────────────────────────────
  {
    id: 'squad',
    name: 'Taktische Einheit',
    description: 'Organisierte Gruppe mit verschiedenen Rollen',
    slots: {
      frontline: { designRole: 'soldier', count: { min: 1, max: 2 } },
      ranged: { designRole: 'artillery', count: { min: 1, max: 2 } },
      support: { designRole: 'support', count: { min: 0, max: 1 } },
    },
  },

  // ──────────────────────────────────────────────────────────────────────────
  // AMBUSH - Hinterhalt-Gruppe
  // ──────────────────────────────────────────────────────────────────────────
  {
    id: 'ambush',
    name: 'Hinterhalt',
    description: 'Versteckte Jaeger, die auf Beute warten',
    slots: {
      ambushers: { designRole: 'ambusher', count: { min: 2, avg: 3, max: 5 } },
    },
  },

  // ──────────────────────────────────────────────────────────────────────────
  // BRUTE-PACK - Gruppe von Brutalos
  // ──────────────────────────────────────────────────────────────────────────
  {
    id: 'brute-pack',
    name: 'Brutalo-Rudel',
    description: 'Kleine Gruppe schwerer Schlaeger',
    slots: {
      brutes: { designRole: 'brute', count: { min: 2, max: 4 } },
    },
  },
]);

export default genericGroupTemplates;
