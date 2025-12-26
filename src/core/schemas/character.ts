/**
 * Character schema definitions.
 *
 * Characters represent Player Characters (PCs) with stats for:
 * - Combat (HP, AC)
 * - Travel (speed)
 * - Encounter balancing (level)
 *
 * @see docs/features/Character-System.md
 */

import { z } from 'zod';
import { entityIdSchema, timestampSchema } from './common';
import { inventorySlotSchema } from './item';

// ============================================================================
// Character Schema
// ============================================================================

/**
 * Schema for Player Character data.
 *
 * MVP fields focus on what's needed for:
 * - Encounter balancing (level, maxHp)
 * - Travel calculation (speed)
 * - Combat tracking (currentHp, ac)
 * - Encumbrance (strength) - reserved for future use
 */
export const characterSchema = z.object({
  /** Unique character identifier */
  id: entityIdSchema('character'),

  /** Character name */
  name: z.string().min(1),

  /** Character level (1-20, for XP/Encounter balancing) */
  level: z.number().int().min(1).max(20),

  /** Character class (Fighter, Wizard, etc.) */
  class: z.string().min(1),

  /** Maximum HP (for Encounter balancing) */
  maxHp: z.number().int().positive(),

  /** Current HP (tracked during play) */
  currentHp: z.number().int().min(0),

  /** Armor Class */
  ac: z.number().int().positive(),

  /** Base movement speed in feet (for Travel calculation, must be multiple of 5) */
  speed: z.number().int().positive().refine(
    (val) => val % 5 === 0,
    { message: 'Speed muss ein Vielfaches von 5 sein (z.B. 25, 30, 35)' }
  ),

  /** Strength score (for Encumbrance calculation, 1-30) */
  strength: z.number().int().min(1).max(30),

  /** Wisdom score (for Passive Perception calculation, 1-30) */
  wisdom: z.number().int().min(1).max(30),

  /**
   * Inventory slots with typed items.
   * Each slot references an item by ID with quantity.
   * @see docs/features/Inventory-System.md
   */
  inventory: z.array(inventorySlotSchema).default([]),

  /** Creation timestamp */
  createdAt: timestampSchema.optional(),

  /** Last update timestamp */
  updatedAt: timestampSchema.optional(),
}).superRefine((data, ctx) => {
  // Validate currentHp <= maxHp
  if (data.currentHp > data.maxHp) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Current HP darf nicht größer als Max HP sein',
      path: ['currentHp'],
    });
  }
});

/**
 * Character type - uses z.output for type AFTER parsing (with defaults applied).
 */
export type Character = z.output<typeof characterSchema>;

// ============================================================================
// Encounter Balancing
// ============================================================================

/**
 * Input for Encounter balancing calculations.
 * @see docs/features/Character-System.md#encounter-balancing
 * @see docs/features/Encounter-Balancing.md
 */
export interface EncounterBalancingInput {
  /** Average party level (rounded) */
  partyLevel: number;
  /** Number of characters in party */
  partySize: number;
  /** Sum of all maxHp values */
  totalPartyHp: number;
}

// ============================================================================
// Character Helpers
// ============================================================================

/**
 * Calculate average party level from characters.
 * Used for Encounter balancing.
 *
 * @param characters - Array of characters
 * @returns Rounded average level, or 1 if empty
 */
export function calculatePartyLevel(characters: readonly Character[]): number {
  if (characters.length === 0) return 1;
  const sum = characters.reduce((acc, c) => acc + c.level, 0);
  return Math.round(sum / characters.length);
}

/**
 * Calculate party speed (slowest member).
 * Used for Travel calculations.
 *
 * @param characters - Array of characters
 * @returns Minimum speed, or 30 (default human speed) if empty
 */
export function calculatePartySpeed(characters: readonly Character[]): number {
  if (characters.length === 0) return 30;
  return Math.min(...characters.map((c) => c.speed));
}

/**
 * Calculate total party HP (sum of all maxHp).
 * Used for Encounter balancing.
 *
 * @param characters - Array of characters
 * @returns Sum of maxHp values
 */
export function calculateTotalPartyHp(characters: readonly Character[]): number {
  return characters.reduce((acc, c) => acc + c.maxHp, 0);
}

/**
 * Calculate encounter balancing input from party characters.
 *
 * @param characters - Array of party characters
 * @returns EncounterBalancingInput with partyLevel, partySize, totalPartyHp
 * @see docs/features/Character-System.md#encounter-balancing
 */
export function getBalancingInput(
  characters: readonly Character[]
): EncounterBalancingInput {
  return {
    partyLevel: calculatePartyLevel(characters),
    partySize: characters.length,
    totalPartyHp: calculateTotalPartyHp(characters),
  };
}
