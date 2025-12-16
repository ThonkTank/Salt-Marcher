/**
 * Gemeinsame Base Types für alle Domains
 * Branded Types für Type-Safety
 */

import { z } from 'zod';

// ═══════════════════════════════════════════════════════════════
// Branded Types
// ═══════════════════════════════════════════════════════════════

/**
 * EntityId - Typsichere ID für Entities
 * Verwendet UUID als Wert, z.B. "550e8400-e29b-41d4-a716-446655440000"
 *
 * @example
 * const characterId: EntityId<'character'> = createEntityId('character');
 * const locationId: EntityId<'location'> = createEntityId('location');
 * // characterId kann nicht locationId zugewiesen werden (Type Error)
 */
export type EntityId<T extends string> = string & { readonly __brand: T };

/**
 * Timestamp - Unix Millisekunden
 * Branded für Type-Safety
 */
export type Timestamp = number & { readonly __brand: 'Timestamp' };

// ═══════════════════════════════════════════════════════════════
// Helper Functions
// ═══════════════════════════════════════════════════════════════

/** Generate a new UUID-based EntityId */
export function createEntityId<T extends string>(type: T): EntityId<T> {
  return crypto.randomUUID() as EntityId<T>;
}

/** Convert string to EntityId (for parsing from storage) */
export function toEntityId<T extends string>(id: string): EntityId<T> {
  return id as EntityId<T>;
}

/** Get current timestamp */
export function now(): Timestamp {
  return Date.now() as Timestamp;
}

/** Convert number to Timestamp */
export function toTimestamp(ms: number): Timestamp {
  return ms as Timestamp;
}

/** Convert Date to Timestamp */
export function fromDate(date: Date): Timestamp {
  return date.getTime() as Timestamp;
}

/** Convert Timestamp to Date */
export function toDate(timestamp: Timestamp): Date {
  return new Date(timestamp);
}

// ═══════════════════════════════════════════════════════════════
// BaseEntity
// ═══════════════════════════════════════════════════════════════

/**
 * Basis-Interface für alle Entities
 * Jedes Entity hat eine eindeutige ID, einen Vault-Pfad und einen Namen
 */
export interface BaseEntity<T extends string> {
  /** Eindeutige ID (UUID) */
  id: EntityId<T>;
  /** Obsidian Vault Pfad zur Markdown-Datei */
  path: string;
  /** Anzeigename */
  name: string;
}

/**
 * Entity mit Timestamps für Created/Updated Tracking
 */
export interface TrackedEntity<T extends string> extends BaseEntity<T> {
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ═══════════════════════════════════════════════════════════════
// Zod Schemas für Branded Types
// ═══════════════════════════════════════════════════════════════

/**
 * Erstellt ein Zod-Schema für EntityId
 * @example
 * const CharacterIdSchema = entityIdSchema<'character'>();
 * const mapIdField = entityIdSchema<'map'>();
 */
export function entityIdSchema<T extends string>() {
  return z.string().transform((val) => val as EntityId<T>);
}

/** Zod-Schema für Timestamp */
export const TimestampSchema = z.number().transform((val) => val as Timestamp);

// ═══════════════════════════════════════════════════════════════
// D&D 5e Types
// ═══════════════════════════════════════════════════════════════

/**
 * Encounter difficulty level (D&D 5e)
 * Used by Encounter and Combat systems
 */
export type Difficulty = 'easy' | 'medium' | 'hard' | 'deadly';

/** All difficulty levels in order */
export const DIFFICULTY_LEVELS: readonly Difficulty[] = [
  'easy',
  'medium',
  'hard',
  'deadly',
] as const;
