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

  /** Base movement speed in feet (for Travel calculation) */
  speed: z.number().int().positive(),

  /** Strength score (for Encumbrance calculation, 1-30) */
  strength: z.number().int().min(1).max(30),

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
});

/**
 * Character type - uses z.output for type AFTER parsing (with defaults applied).
 */
export type Character = z.output<typeof characterSchema>;

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
