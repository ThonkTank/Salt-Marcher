/**
 * Common Zod schemas for validation.
 */

import { z } from 'zod';
import type { EntityType, EntityId, Timestamp } from '../types';

// ============================================================================
// Entity ID Schema
// ============================================================================

/**
 * Create a Zod schema for EntityId of a specific type.
 * Validates that the value is a non-empty string.
 */
export function entityIdSchema<T extends EntityType>(
  _entityType: T
): z.ZodType<EntityId<T>> {
  return z.string().min(1) as unknown as z.ZodType<EntityId<T>>;
}

// ============================================================================
// Timestamp Schema
// ============================================================================

/**
 * Schema for Unix milliseconds timestamp.
 * Validates that the value is a positive number.
 */
export const timestampSchema: z.ZodType<Timestamp> = z
  .number()
  .int()
  .nonnegative() as unknown as z.ZodType<Timestamp>;

// ============================================================================
// Entity Type Schema
// ============================================================================

/**
 * Schema for EntityType union (16 MVP types).
 */
export const entityTypeSchema = z.enum([
  'creature',
  'character',
  'npc',
  'faction',
  'item',
  'map',
  'poi',
  'maplink',
  'terrain',
  'quest',
  'encounter',
  'shop',
  'party',
  'calendar',
  'journal',
  'worldevent',
  'track',
]);

// ============================================================================
// Time Segment Schema
// ============================================================================

/**
 * Schema for TimeSegment union.
 */
export const timeSegmentSchema = z.enum([
  'dawn',
  'morning',
  'midday',
  'afternoon',
  'dusk',
  'night',
]);

// ============================================================================
// AppError Schema
// ============================================================================

/**
 * Schema for AppError.
 */
export const appErrorSchema = z.object({
  code: z.string().min(1),
  message: z.string(),
  details: z.unknown().optional(),
});
