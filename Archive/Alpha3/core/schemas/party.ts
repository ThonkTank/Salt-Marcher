/**
 * Party Schema
 *
 * Zod schemas for party composition and configuration.
 * Used by Encounter system and future Party Manager.
 */

import { z } from 'zod';

// ═══════════════════════════════════════════════════════════════
// Schemas
// ═══════════════════════════════════════════════════════════════

/**
 * Schema for a single party member
 */
export const PartyMemberSchema = z.object({
  /** Character name */
  name: z.string().min(1),
  /** Character level (1-20) */
  level: z.number().int().min(1).max(20),
});

/**
 * Schema for a party (array of members)
 */
export const PartySchema = z.array(PartyMemberSchema);

/**
 * Schema for party configuration
 */
export const PartyConfigSchema = z.object({
  /** Party members */
  members: PartySchema,
});

// ═══════════════════════════════════════════════════════════════
// Inferred Types
// ═══════════════════════════════════════════════════════════════

export type PartyMember = z.infer<typeof PartyMemberSchema>;
export type Party = z.infer<typeof PartySchema>;
export type PartyConfig = z.infer<typeof PartyConfigSchema>;

// ═══════════════════════════════════════════════════════════════
// Default Configuration
// ═══════════════════════════════════════════════════════════════

/**
 * Default party configuration: 4 level 3 characters
 * Placeholder until Party Manager is implemented
 */
export const DEFAULT_PARTY_CONFIG: PartyConfig = {
  members: [
    { name: 'Character 1', level: 3 },
    { name: 'Character 2', level: 3 },
    { name: 'Character 3', level: 3 },
    { name: 'Character 4', level: 3 },
  ],
};
