// Activity-Presets für Encounter-Gruppen
// Siehe: docs/entities/activity.md
//
// Activities werden im Vault gespeichert und in Cultures per ID referenziert.
// Context-Tags:
// - 'active': Nur wenn Kreatur zur aktuellen Tageszeit aktiv ist
// - 'resting': Nur wenn Kreatur zur aktuellen Tageszeit ruht
// - 'movement': Bewegungs-Activity
// - 'stealth': Versteckte Activity
// - 'aquatic': Nur bei Wasser-Terrain

import { z } from 'zod';
import { activitySchema } from '../../src/types/entities/activity';

// ============================================================================
// PRESET-SCHEMA
// ============================================================================

export const activityPresetSchema = activitySchema;
export const activityPresetsSchema = z.array(activityPresetSchema);

// ============================================================================
// ACTIVITY-PRESETS
// ============================================================================

export const activityPresets = activityPresetsSchema.parse([
  // ──────────────────────────────────────────────────────────────────────────
  // Resting Activities (nur außerhalb creature.activeTime)
  // ──────────────────────────────────────────────────────────────────────────
  {
    id: 'sleeping',
    name: 'Schlafen',
    awareness: 10,
    detectability: 20,
    contextTags: ['resting'],
    description: 'Tief schlafend, kaum Wahrnehmung',
  },
  {
    id: 'resting',
    name: 'Rasten',
    awareness: 40,
    detectability: 40,
    contextTags: ['resting'],
    description: 'Entspannt, aber wachsam',
  },
  {
    id: 'lair',
    name: 'Im Bau',
    awareness: 60,
    detectability: 30,
    contextTags: ['resting'],
    description: 'In der Höhle/Unterschlupf, teilweise verborgen',
  },
  {
    id: 'camp',
    name: 'Lagern',
    awareness: 50,
    detectability: 70,
    contextTags: ['resting'],
    description: 'Am Lagerfeuer, Licht und Rauch sichtbar',
  },

  // ──────────────────────────────────────────────────────────────────────────
  // Active Activities (nur innerhalb creature.activeTime)
  // ──────────────────────────────────────────────────────────────────────────
  {
    id: 'traveling',
    name: 'Reisen',
    awareness: 55,
    detectability: 55,
    contextTags: ['active', 'movement'],
    description: 'Unterwegs von A nach B',
  },
  {
    id: 'ambush',
    name: 'Hinterhalt',
    awareness: 80,
    detectability: 15,
    contextTags: ['active', 'stealth'],
    description: 'Versteckt, lauert auf Beute',
  },
  {
    id: 'patrol',
    name: 'Patrouille',
    awareness: 70,
    detectability: 60,
    contextTags: ['active', 'movement'],
    description: 'Wachsam auf festgelegter Route',
  },
  {
    id: 'hunt',
    name: 'Jagen',
    awareness: 75,
    detectability: 40,
    contextTags: ['active', 'movement'],
    description: 'Aktiv auf Beutejagd',
  },
  {
    id: 'scavenge',
    name: 'Plündern',
    awareness: 45,
    detectability: 55,
    contextTags: ['active'],
    description: 'Durchsucht Gegend nach Verwertbarem',
  },
  {
    id: 'guard',
    name: 'Wache',
    awareness: 85,
    detectability: 65,
    contextTags: ['active'],
    description: 'Bewacht einen festen Punkt',
  },
  {
    id: 'command',
    name: 'Anführen',
    awareness: 60,
    detectability: 70,
    contextTags: ['active'],
    description: 'Koordiniert andere, gibt Befehle',
  },
  {
    id: 'intimidate',
    name: 'Einschüchtern',
    awareness: 50,
    detectability: 80,
    contextTags: ['active'],
    description: 'Macht Drohgebärden, laut',
  },

  // ──────────────────────────────────────────────────────────────────────────
  // Hybrid Activities (active + resting, immer möglich)
  // ──────────────────────────────────────────────────────────────────────────
  {
    id: 'feeding',
    name: 'Fressen',
    awareness: 30,
    detectability: 50,
    contextTags: ['active', 'resting'],
    description: 'Beim Essen, abgelenkt',
  },
  {
    id: 'wandering',
    name: 'Umherziehen',
    awareness: 50,
    detectability: 50,
    contextTags: ['active', 'resting', 'movement'],
    description: 'Ziellos unterwegs, durchschnittlich wachsam',
  },
]);

export default activityPresets;
