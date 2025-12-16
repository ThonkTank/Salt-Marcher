/**
 * Party schema definitions.
 *
 * Party represents the player group with position, transport mode, and members.
 * Used by Travel-Feature for movement and time calculation.
 */

import { z } from 'zod';
import { entityIdSchema, timestampSchema } from './common';
import { hexCoordSchema } from './map';

// ============================================================================
// Transport Mode Schema
// ============================================================================

/**
 * Available transport modes.
 * From Travel-System.md:
 * - foot: 3 mph, no restrictions
 * - mounted: 6 mph, blocked by dense forest/swamp
 * - carriage: 4 mph, roads only
 * - boat: 4 mph, water only
 */
export const transportModeSchema = z.enum(['foot', 'mounted', 'carriage', 'boat']);
export type TransportMode = z.infer<typeof transportModeSchema>;

/**
 * Base speed in miles per hour for each transport mode.
 */
export const TRANSPORT_BASE_SPEEDS: Record<TransportMode, number> = {
  foot: 3,
  mounted: 6,
  carriage: 4,
  boat: 4,
};

// ============================================================================
// Party Schema
// ============================================================================

/**
 * Schema for party data.
 * Party is a session-level entity that tracks player group state.
 */
export const partySchema = z.object({
  /** Unique party identifier */
  id: entityIdSchema('party'),

  /** Party name (e.g., "The Adventurers") */
  name: z.string().min(1),

  /** Current map the party is on */
  currentMapId: entityIdSchema('map'),

  /** Current hex position on the map */
  position: hexCoordSchema,

  /** Currently active transport mode */
  activeTransport: transportModeSchema.default('foot'),

  /** Transport modes available to the party */
  availableTransports: z.array(transportModeSchema).default(['foot']),

  /** Party member character IDs */
  members: z.array(entityIdSchema('character')).default([]),

  /** Creation timestamp */
  createdAt: timestampSchema.optional(),

  /** Last update timestamp */
  updatedAt: timestampSchema.optional(),
});

/**
 * Party type - uses z.output to get the type AFTER parsing
 * (with defaults applied), not the input type.
 */
export type Party = z.output<typeof partySchema>;

// ============================================================================
// Party State (for Travel Feature)
// ============================================================================

/**
 * Minimal party state needed for travel calculations.
 * Extracted from full Party for performance.
 */
export interface PartyTravelState {
  readonly position: { q: number; r: number };
  readonly activeTransport: TransportMode;
  readonly availableTransports: readonly TransportMode[];
}
