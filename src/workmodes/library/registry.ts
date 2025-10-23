// src/workmodes/library/entities/registry.ts
// Central registry for all library entities: type-safe access to specs, views, and schemas

import type { CreateSpec, ListSchema } from "../../features/data-manager";
import type { LibraryEntry, FilterableLibraryMode } from "./storage/data-sources";
import type { LibraryViewConfig } from "./types";
import { generateViewConfigs, generateListSchemas } from "../../features/data-manager/browse/spec-to-config";

import { creatureSpec } from "./creatures";
import { spellSpec } from "./spells";
import { itemSpec } from "./items";
import { equipmentSpec } from "./equipment";
import { terrainSpec } from "./terrains";
import { regionSpec } from "./regions";
import { calendarSpec } from "./calendars";

// ============================================================================
// Types
// ============================================================================

export type LibraryEntity = FilterableLibraryMode;

// ============================================================================
// Registries
// ============================================================================

/** Create specs for all library entities (null for entities without modal creation) */
export const LIBRARY_CREATE_SPECS: Record<LibraryEntity, CreateSpec<any> | null> = {
    creatures: creatureSpec,
    spells: spellSpec,
    items: itemSpec,
    equipment: equipmentSpec,
    terrains: terrainSpec,
    regions: regionSpec,
    calendars: calendarSpec,
};

/**
 * View configs for all library entities.
 * Auto-generated from CreateSpecs using generateViewConfigs helper.
 */
export const LIBRARY_VIEW_CONFIGS: Record<LibraryEntity, LibraryViewConfig> = {
    ...generateViewConfigs(LIBRARY_CREATE_SPECS),
};

/**
 * List schemas for all library entities.
 * Auto-generated from CreateSpecs using generateListSchemas helper.
 */
export const LIBRARY_LIST_SCHEMAS: Record<LibraryEntity, ListSchema<LibraryEntry<LibraryEntity>>> = {
    ...generateListSchemas(LIBRARY_CREATE_SPECS) as Record<string, ListSchema<LibraryEntry<LibraryEntity>>>,
};

// ============================================================================
// Type-safe accessors
// ============================================================================

export function getCreateSpec(entity: LibraryEntity): CreateSpec<any> | null {
    return LIBRARY_CREATE_SPECS[entity];
}

export function getViewConfig(entity: LibraryEntity): LibraryViewConfig {
    return LIBRARY_VIEW_CONFIGS[entity];
}

export function getListSchema<M extends LibraryEntity>(entity: M): ListSchema<LibraryEntry<M>> {
    return LIBRARY_LIST_SCHEMAS[entity] as ListSchema<LibraryEntry<M>>;
}
