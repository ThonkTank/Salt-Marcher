/**
 * NPC schema definitions.
 *
 * NPCs are named, persistent creature instances with personality.
 * They are created during encounters and stored in EntityRegistry.
 *
 * @see docs/domain/NPC-System.md
 */

import { z } from 'zod';
import { entityIdSchema } from './common';
import { gameDateTimeSchema } from './time';
import { creatureRefSchema } from './creature';

// ============================================================================
// Personality Schema
// ============================================================================

/**
 * NPC personality traits.
 */
export const personalityTraitsSchema = z.object({
  /** Primary personality trait (e.g., "suspicious", "curious") */
  primary: z.string().min(1),

  /** Secondary personality trait (e.g., "greedy", "loyal") */
  secondary: z.string().min(1),
});

export type PersonalityTraits = z.infer<typeof personalityTraitsSchema>;

// ============================================================================
// NPC Status
// ============================================================================

/**
 * NPC status - simplified to alive/dead for MVP.
 * GM can track complex states (missing, imprisoned) in notes.
 */
export const npcStatusSchema = z.enum(['alive', 'dead']);

export type NpcStatus = z.infer<typeof npcStatusSchema>;

// ============================================================================
// NPC Schema
// ============================================================================

/**
 * Schema for a named, persistent NPC.
 * NPCs are created during encounters and stored for reuse.
 */
export const npcSchema = z.object({
  /** Unique NPC identifier */
  id: entityIdSchema('npc'),

  // === Base Data ===

  /** NPC name (e.g., "Griknak der Hinkende") */
  name: z.string().min(1),

  /** Reference to creature template (statblock) */
  creature: creatureRefSchema,

  /** Faction this NPC belongs to (required) */
  factionId: entityIdSchema('faction'),

  // === Personality (generated from faction culture) ===

  /** Personality traits */
  personality: personalityTraitsSchema,

  /** Optional quirk */
  quirk: z.string().optional(),

  /** Personal goal (for RP) */
  personalGoal: z.string().min(1),

  // === Status ===

  /** Current status */
  status: npcStatusSchema,

  // === Tracking (for recurring encounters) ===

  /** When party first encountered this NPC */
  firstEncounter: gameDateTimeSchema,

  /** When party last encountered this NPC */
  lastEncounter: gameDateTimeSchema,

  /** Total number of encounters */
  encounterCount: z.number().int().nonnegative(),

  // === Optional Location ===

  /** If set, NPC is at this specific POI. Otherwise uses faction territory. */
  currentPOI: entityIdSchema('poi').optional(),

  // === GM Notes ===

  /** GM notes for this NPC */
  gmNotes: z.string().optional(),
});

export type NPC = z.infer<typeof npcSchema>;

// ============================================================================
// NPC Match Criteria (for encounter system)
// ============================================================================

/**
 * Criteria for finding an existing NPC for an encounter.
 */
export const npcMatchCriteriaSchema = z.object({
  /** Creature type must match */
  creatureType: z.string().min(1),

  /** Faction must match */
  factionId: entityIdSchema('faction'),
});

export type NpcMatchCriteria = z.infer<typeof npcMatchCriteriaSchema>;

// ============================================================================
// Encounter Lead NPC (for encounter display)
// ============================================================================

/**
 * NPC data formatted for encounter display.
 */
export const encounterLeadNpcSchema = z.object({
  /** Reference to the NPC entity */
  npcId: entityIdSchema('npc'),

  /** Display name */
  name: z.string().min(1),

  /** Personality traits */
  personality: personalityTraitsSchema,

  /** Personal goal */
  personalGoal: z.string().min(1),

  /** Quirk if any */
  quirk: z.string().optional(),

  /** Whether this NPC has been encountered before */
  isRecurring: z.boolean(),
});

export type EncounterLeadNpc = z.infer<typeof encounterLeadNpcSchema>;

// ============================================================================
// Constants
// ============================================================================

/**
 * Minimum score threshold for NPC match.
 */
export const NPC_MATCH_THRESHOLD = 0;

/**
 * Days since last encounter scoring.
 */
export const NPC_RECENCY_PENALTIES = {
  /** Penalty if encountered less than 3 days ago */
  TOO_RECENT_DAYS: 3,
  TOO_RECENT_PENALTY: -30,

  /** Bonus if encountered more than 30 days ago */
  LONG_AGO_DAYS: 30,
  LONG_AGO_BONUS: 10,
} as const;
