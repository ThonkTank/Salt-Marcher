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
  contextTags: ('active' | 'resting')[]; // Soft-Weighting basierend auf creature.activeTime
}

// Lookup-Map für alle Activities
export const ACTIVITY_DEFINITIONS: Record<string, Activity> = {
  // Resting (bevorzugt außerhalb creature.activeTime)
  sleeping: { id: 'sleeping', name: 'Schlafen', awareness: 10, detectability: 20, contextTags: ['resting'] },
  resting: { id: 'resting', name: 'Rasten', awareness: 40, detectability: 40, contextTags: ['resting'] },
  lair: { id: 'lair', name: 'Im Bau', awareness: 60, detectability: 30, contextTags: ['resting'] },
  camp: { id: 'camp', name: 'Lagern', awareness: 50, detectability: 70, contextTags: ['resting'] },

  // Active (bevorzugt innerhalb creature.activeTime)
  traveling: { id: 'traveling', name: 'Reisen', awareness: 55, detectability: 55, contextTags: ['active'] },
  ambush: { id: 'ambush', name: 'Hinterhalt', awareness: 80, detectability: 15, contextTags: ['active'] },
  patrol: { id: 'patrol', name: 'Patrouille', awareness: 70, detectability: 60, contextTags: ['active'] },
  hunt: { id: 'hunt', name: 'Jagen', awareness: 75, detectability: 40, contextTags: ['active'] },
  scavenge: { id: 'scavenge', name: 'Plündern', awareness: 45, detectability: 55, contextTags: ['active'] },

  // Beide (kein Modifikator)
  feeding: { id: 'feeding', name: 'Fressen', awareness: 30, detectability: 50, contextTags: ['active', 'resting'] },
  wandering: { id: 'wandering', name: 'Umherziehen', awareness: 50, detectability: 50, contextTags: ['active', 'resting'] },
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

// ============================================================================
// NPC ROLE WEIGHTS (für NPC-Auswahl in Encountern)
// ============================================================================

import type { DesignRole } from './creature';

/**
 * Gewichtung der Design-Rollen als Multiplikatoren.
 * Höhere Werte = höhere Wahrscheinlichkeit als NPC ausgewählt zu werden.
 * Berechnung: weight = CR × ROLE_WEIGHT
 */
export const NPC_ROLE_WEIGHTS: Record<DesignRole, number> = {
  leader: 5.0,
  solo: 5.0,
  support: 2.0,
  controller: 2.0,
  brute: 2.0,
  artillery: 1.0,
  soldier: 1.0,
  skirmisher: 1.0,
  ambusher: 1.0,
  minion: 0.5,
} as const;

// ============================================================================
// SEED SELECTION WEIGHTS (für Creature-Pool Gewichtung)
// ============================================================================

/**
 * Decay-Rate für CR-Distanz-Gewichtung.
 * weight = 1.0 - distance × CR_DECAY_RATE
 */
export const CR_DECAY_RATE = 0.2;

/**
 * Minimales Gewicht für Kreaturen mit großer CR-Distanz.
 * Verhindert dass Kreaturen komplett ausgeschlossen werden.
 */
export const MIN_CR_WEIGHT = 0.1;

// ============================================================================
// ACTIVITY LAYER WEIGHTING (für Culture-Chain Gewichtung)
// ============================================================================

/**
 * Kaskaden-Ratio für Layer-Gewichtung.
 * Leaf bekommt 60%, Rest kaskadiert.
 * weights[layer] = remaining × LAYER_CASCADE_RATIO
 */
export const LAYER_CASCADE_RATIO = 0.6;
