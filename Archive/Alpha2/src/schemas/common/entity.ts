/**
 * Entity Base Types
 *
 * Common interfaces for entities with ID and name.
 * Reduces repetitive type definitions across schemas.
 *
 * @module schemas/common/entity
 */

// ============================================================================
// Base Entity Types
// ============================================================================

/**
 * Minimal entity with unique identifier and name.
 * Use as base for all persistable entities.
 *
 * @example
 * type Creature = EntityBase & { hp: number; ac: number };
 */
export type EntityBase = {
	id: string;
	name: string;
};

/**
 * Entity with optional metadata fields.
 * Use for entities that track creation/modification times.
 *
 * @example
 * type MapEntry = EntityWithMetadata & { radius: number };
 */
export type EntityWithMetadata = EntityBase & {
	description?: string;
	createdAt?: number;
	modifiedAt?: number;
};

// ============================================================================
// Entity Reference Types
// ============================================================================

/**
 * Reference to an entity by ID only.
 * Use instead of embedding full objects to reduce duplication.
 *
 * @example
 * type EncounterGroup = {
 *     creature: EntityRef;
 *     count: number;
 * };
 */
export type EntityRef = {
	id: string;
};

/**
 * Branded entity reference for type-safe ID references.
 *
 * @example
 * type CreatureId = BrandedEntityRef<'Creature'>;
 * type LocationId = BrandedEntityRef<'Location'>;
 */
export type BrandedEntityRef<Brand extends string> = {
	id: string & { readonly __entityBrand: Brand };
};

// Note: IndexEntry is defined in schemas/library.ts with domain-specific fields.
// Use EntityBase or EntityWithMetadata for generic entity patterns.
