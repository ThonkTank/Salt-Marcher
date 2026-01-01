// NPC-bezogene Konstanten
// Siehe: docs/entities/npc.md

// NPC-Lebensstatus
export const NPC_STATUSES = ['alive', 'dead'] as const;
export type NPCStatus = typeof NPC_STATUSES[number];

// ============================================================================
// NPC-GENERIERUNG KONSTANTEN
// Siehe: docs/services/npcs/NPC-Generation.md
// ============================================================================

/**
 * Fallback-Namen wenn Culture keine Naming-Config liefert.
 */
export const FALLBACK_NPC_NAMES = [
  'Stranger', 'Unknown', 'Nameless', 'Shadow', 'Wanderer'
] as const;

/**
 * Default Personality wenn kein Trait-Pool verfügbar.
 */
export const DEFAULT_PERSONALITY = {
  primary: 'neutral',
  secondary: 'reserved',
} as const;

/**
 * Fallback Goal wenn kein Goal-Pool verfügbar.
 */
export const DEFAULT_NPC_GOAL = 'survive';

/**
 * Wahrscheinlichkeit dass ein NPC einen Quirk bekommt (50%).
 */
export const QUIRK_GENERATION_CHANCE = 0.5;

/**
 * Trait-Gewichtungen für Persönlichkeits-Pool.
 * Soft-Weighting: Alle Traits sind verfügbar, aber mit unterschiedlichen Gewichten.
 */
export const TRAIT_WEIGHTS = {
  /** In culture.personality.traits gelistet */
  preferred: 5.0,
  /** Weder preferred noch forbidden */
  neutral: 1.0,
  /** In culture.personality.forbidden gelistet */
  forbidden: 0.2,
} as const;
