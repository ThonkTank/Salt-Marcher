/**
 * Library Schema Types
 *
 * Shared types for the library entity system.
 * Used by SaltMarcherCore and extension plugins.
 *
 * @module Shared/schemas/library
 */

// ============================================================================
// Types
// ============================================================================

/**
 * Supported entity types
 */
export type EntityType = 'creature' | 'terrain';

/**
 * Index entry for quick listing/searching
 */
export type IndexEntry = {
	id: string;
	name: string;
	modifiedAt?: number; // Optional for bundled presets
	// Creature-specific
	cr?: string;
	type?: string;
	xp?: string;
	terrainPreference?: string[];
	// Terrain-specific
	color?: string;
	// Source flag
	isPreset?: boolean; // True for bundled presets (read-only)
};

/**
 * Loaded entity with body content
 */
export type LoadedEntity<T> = {
	data: T;
	body: string;
};

// ============================================================================
// Store Interface
// ============================================================================

/**
 * Interface for library entity persistence.
 * Allows dependency injection - adapters implement, orchestrators consume.
 */
export interface ILibraryStore {
	list(type: EntityType): Promise<IndexEntry[]>;
	load<T>(type: EntityType, id: string): Promise<LoadedEntity<T> | null>;
	save<T extends Record<string, unknown>>(
		type: EntityType,
		id: string,
		data: T,
		body?: string
	): Promise<void>;
	delete(type: EntityType, id: string): Promise<void>;
	rebuildIndex(type: EntityType): Promise<void>;
}
