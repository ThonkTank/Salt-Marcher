/**
 * Journal schemas for session logging and event history.
 *
 * Based on Journal.md specification:
 * - JournalEntry: Main entity for session logs
 * - JournalCategory: Type classification (quest, encounter, travel, etc.)
 * - JournalSource: Origin of entry (auto, gm, player)
 * - JournalEntityRef: References to related entities
 */

import { z } from 'zod';
import { entityIdSchema, entityTypeSchema } from './common';
import { gameDateTimeSchema } from './time';

// ============================================================================
// JournalCategory Schema
// ============================================================================

/**
 * Category of journal entry.
 * From Journal.md lines 66-73.
 */
export const journalCategorySchema = z.enum([
  'quest', // Quest-related entries
  'encounter', // Combat protocols
  'travel', // Travel events
  'discovery', // New places, NPCs, lore discovered
  'worldevent', // World events (weather, factions)
  'session', // Session summaries
  'note', // Free-form notes
]);

export type JournalCategory = z.infer<typeof journalCategorySchema>;

// ============================================================================
// JournalSource Schema
// ============================================================================

/**
 * Source/origin of journal entry.
 * From Journal.md lines 75-78.
 */
export const journalSourceSchema = z.enum([
  'auto', // Automatically generated
  'gm', // Created by GM
  'player', // Created by player
]);

export type JournalSource = z.infer<typeof journalSourceSchema>;

// ============================================================================
// JournalEntityRef Schema
// ============================================================================

/**
 * Reference to a related entity in a journal entry.
 * From Journal.md lines 84-93.
 */
export const journalEntityRefSchema = z.object({
  /** Type of referenced entity */
  entityType: entityTypeSchema,
  /** ID of referenced entity */
  entityId: z.string().min(1),
  /** Cached display name for performance */
  displayName: z.string().optional(),
});

export type JournalEntityRef = z.infer<typeof journalEntityRefSchema>;

// ============================================================================
// JournalEntry Schema
// ============================================================================

/**
 * Main journal entry entity.
 * From Journal.md lines 41-64.
 *
 * Note: timestamp uses GameDateTime (in-game time) rather than unix timestamp
 * to support fantasy calendar systems.
 */
export const journalEntrySchema = z.object({
  /** Unique identifier */
  id: entityIdSchema('journal'),

  // === Timing ===
  /** In-game time when this event occurred */
  timestamp: gameDateTimeSchema,
  /** Optional real-world time of the session (unix ms) */
  realWorldTime: z.number().int().nonnegative().optional(),

  // === Categorization ===
  /** Entry category */
  category: journalCategorySchema,
  /** Entry source/origin */
  source: journalSourceSchema,

  // === Content ===
  /** Entry title */
  title: z.string().min(1),
  /** Markdown-formatted content */
  content: z.string(),
  /** Short summary for list views */
  summary: z.string().optional(),

  // === Relationships ===
  /** References to related entities (NPCs, quests, locations, etc.) */
  relatedEntities: z.array(journalEntityRefSchema).optional(),

  // === Metadata ===
  /** Session ID this entry belongs to */
  sessionId: z.string().optional(),
  /** User-defined tags */
  tags: z.array(z.string()).optional(),
  /** Mark as important entry */
  pinned: z.boolean().optional(),
});

export type JournalEntry = z.infer<typeof journalEntrySchema>;
