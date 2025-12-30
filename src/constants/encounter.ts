// Encounter-bezogene Konstanten
// Siehe: docs/services/encounter/Encounter.md

// Encounter-Auslöser
export const ENCOUNTER_TRIGGERS = ['travel', 'rest', 'manual', 'location'] as const;
export type EncounterTrigger = typeof ENCOUNTER_TRIGGERS[number];

// Narrative Rollen für Encounter-Gruppen
export const NARRATIVE_ROLES = ['threat', 'victim', 'neutral', 'ally'] as const;
export type NarrativeRole = typeof NARRATIVE_ROLES[number];

// D&D 5e Encounter-Schwierigkeitsgrade
export const DIFFICULTY_LABELS = ['trivial', 'easy', 'moderate', 'hard', 'deadly'] as const;
export type DifficultyLabel = typeof DIFFICULTY_LABELS[number];

// Activity-Definition für Encounter-Gruppen
export interface Activity {
  id: string;
  name: string;
  awareness: number; // 0-100
  detectability: number; // 0-100
  contextTags: string[]; // active, resting, movement, stealth, aquatic
}

// Lookup-Map für alle Activities
export const ACTIVITY_DEFINITIONS: Record<string, Activity> = {
  // Resting (nur außerhalb creature.activeTime)
  sleeping: { id: 'sleeping', name: 'Schlafen', awareness: 10, detectability: 20, contextTags: ['resting'] },
  resting: { id: 'resting', name: 'Rasten', awareness: 40, detectability: 40, contextTags: ['resting'] },
  lair: { id: 'lair', name: 'Im Bau', awareness: 60, detectability: 30, contextTags: ['resting'] },
  camp: { id: 'camp', name: 'Lagern', awareness: 50, detectability: 70, contextTags: ['resting'] },

  // Active (nur innerhalb creature.activeTime)
  traveling: { id: 'traveling', name: 'Reisen', awareness: 55, detectability: 55, contextTags: ['active', 'movement'] },
  ambush: { id: 'ambush', name: 'Hinterhalt', awareness: 80, detectability: 15, contextTags: ['active', 'stealth'] },
  patrol: { id: 'patrol', name: 'Patrouille', awareness: 70, detectability: 60, contextTags: ['active', 'movement'] },
  hunt: { id: 'hunt', name: 'Jagen', awareness: 75, detectability: 40, contextTags: ['active', 'movement'] },
  scavenge: { id: 'scavenge', name: 'Plündern', awareness: 45, detectability: 55, contextTags: ['active'] },

  // Beide (immer möglich)
  feeding: { id: 'feeding', name: 'Fressen', awareness: 30, detectability: 50, contextTags: ['active', 'resting'] },
  wandering: { id: 'wandering', name: 'Umherziehen', awareness: 50, detectability: 50, contextTags: ['active', 'resting', 'movement'] },
};

// IDs der generischen Activities (Basis-Pool)
export const GENERIC_ACTIVITY_IDS = ['sleeping', 'resting', 'feeding', 'traveling', 'wandering'] as const;
export type GenericActivityId = (typeof GENERIC_ACTIVITY_IDS)[number];

// Gewichtungs-Faktoren für Kreatur-Auswahl
export const CREATURE_WEIGHTS = {
  // Activity Time: Kreatur aktiv zur aktuellen Tageszeit?
  activeTimeMatch: 2.0,
  activeTimeMismatch: 0.5,
  // Weather: Kreatur bevorzugt/meidet aktuelles Wetter?
  weatherPrefers: 2.0,
  weatherAvoids: 0.5,
} as const;
