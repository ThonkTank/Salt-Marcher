// Encounter-Konfiguration
// Editierbar über Plugin-Optionen
// Siehe: docs/services/encounter/Encounter.md

// ============================================================================
// MULTI-GROUP
// ============================================================================

/**
 * Wahrscheinlichkeit für Multi-Group-Encounters (~17%)
 * Siehe: Encounter.md#multi-group-szenarien
 */
export const MULTI_GROUP_PROBABILITY = 0.17;

/**
 * Maximale Anzahl Gruppen pro Encounter (MVP-Limit)
 * Post-MVP: 3+ Gruppen für komplexere Szenarien
 */
export const MAX_GROUPS = 2;

// ============================================================================
// SEKUNDÄRE ROLLEN
// ============================================================================

/**
 * Gewichtung für sekundäre Gruppen-Rollen (kumulative Schwellwerte)
 *
 * Roll < 0.4 → victim (40%)
 * Roll < 0.7 → neutral (30%)
 * Roll < 0.9 → ally (20%)
 * Roll >= 0.9 → threat (10%, Dual-Hostile)
 */
export const SECONDARY_ROLE_THRESHOLDS = {
  victim: 0.4,    // 40% - Bedrohte Partei (z.B. Händler)
  neutral: 0.7,   // 30% - Unbeteiligte (z.B. Pilger)
  ally: 0.9,      // 20% - Potenzielle Verbündete (z.B. Wachen)
  threat: 1.0,    // 10% - Zweite Bedrohung (Drei-Wege-Kampf)
} as const;

export type SecondaryRoleThresholds = typeof SECONDARY_ROLE_THRESHOLDS;

// ============================================================================
// BALANCING
// ============================================================================

/**
 * Maximale Iterationen für Balancing-Loop.
 * Verhindert Endlosschleifen wenn Ziel-Difficulty nicht erreichbar.
 */
export const MAX_BALANCING_ITERATIONS = 10;

// ============================================================================
// ENCOUNTER-CHECK
// ============================================================================

/**
 * Standard-Encounter-Chance wenn Terrain keine definiert.
 */
export const DEFAULT_ENCOUNTER_CHANCE = 0.15;

/**
 * Zeit-Modifikatoren für Encounter-Chance.
 */
export const TIME_ENCOUNTER_MODIFIERS = {
  dawn: 1.25,
  morning: 1.0,
  midday: 1.0,
  afternoon: 1.0,
  dusk: 1.25,
  night: 1.5,
} as const;

export type TimeEncounterModifiers = typeof TIME_ENCOUNTER_MODIFIERS;

// ============================================================================
// PERCEPTION/DISTANCE
// ============================================================================

/**
 * Standard-Distanz für Encounter-Wahrnehmung (in Fuß).
 * Wird verwendet wenn Perception-Berechnung keine Distanz ermitteln kann.
 */
export const DEFAULT_PERCEPTION_DISTANCE = 60;
