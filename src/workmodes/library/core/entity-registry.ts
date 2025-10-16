// src/workmodes/library/core/entity-registry.ts
// Central registry for all Library entity types
// Single source of truth for entity configuration

/**
 * Base configuration for a Library entity type.
 * Contains all metadata needed to work with an entity across the application.
 */
export interface EntityMetadata {
    /** Unique identifier (e.g., "creatures") */
    readonly id: string;

    /** Human-readable display name (e.g., "Creatures") */
    readonly displayName: string;

    /** Vault directory path (e.g., "SaltMarcher/Creatures") */
    readonly directory: string;

    /** Default base name for new files */
    readonly defaultBaseName: string;

    /** Singular form (e.g., "creature") for labels */
    readonly singular: string;

    /** Plural form (e.g., "creatures") for labels */
    readonly plural: string;
}

/**
 * Central registry of all Library entity types.
 * Adding a new entity requires only adding it here.
 */
export const ENTITY_REGISTRY = {
    creatures: {
        id: "creatures",
        displayName: "Creatures",
        directory: "SaltMarcher/Creatures",
        defaultBaseName: "Creature",
        singular: "creature",
        plural: "creatures",
    },
    spells: {
        id: "spells",
        displayName: "Spells",
        directory: "SaltMarcher/Spells",
        defaultBaseName: "Spell",
        singular: "spell",
        plural: "spells",
    },
    items: {
        id: "items",
        displayName: "Items",
        directory: "SaltMarcher/Items",
        defaultBaseName: "Item",
        singular: "item",
        plural: "items",
    },
    equipment: {
        id: "equipment",
        displayName: "Equipment",
        directory: "SaltMarcher/Equipment",
        defaultBaseName: "Equipment",
        singular: "equipment",
        plural: "equipment",
    },
} as const;

// Type helpers
export type EntityId = keyof typeof ENTITY_REGISTRY;
export type EntityRegistry = typeof ENTITY_REGISTRY;

/**
 * Get entity configuration by ID
 */
export function getEntityConfig<T extends EntityId>(id: T): EntityMetadata {
    return ENTITY_REGISTRY[id];
}

/**
 * List all registered entity IDs
 */
export function getAllEntityIds(): EntityId[] {
    return Object.keys(ENTITY_REGISTRY) as EntityId[];
}

/**
 * Check if a string is a valid entity ID
 */
export function isEntityId(value: string): value is EntityId {
    return value in ENTITY_REGISTRY;
}
