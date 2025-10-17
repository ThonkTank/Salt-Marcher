// src/workmodes/library/entities/registry.ts
// Central registry for all library entities: type-safe access to specs, views, and schemas

import type { CreateSpec } from "../../../features/data-manager/edit/types";
import type { LibraryListSchema } from "../../../features/data-manager/browse/schema-builder";
import type { LibraryEntry, FilterableLibraryMode } from "../storage/data-sources";

import { creatureSpec, creatureViewConfig, creatureListSchema } from "./creatures";
import { spellSpec, spellViewConfig, spellListSchema } from "./spells";
import { itemSpec, itemViewConfig, itemListSchema } from "./items";
import { equipmentSpec, equipmentViewConfig, equipmentListSchema } from "./equipment";

import type { LibraryViewConfig } from "./creatures/view-config";

// ============================================================================
// Types
// ============================================================================

export type LibraryEntity = FilterableLibraryMode;

// ============================================================================
// Registries
// ============================================================================

/** Create specs for all library entities */
export const LIBRARY_CREATE_SPECS: Record<LibraryEntity, CreateSpec<any>> = {
    creatures: creatureSpec,
    spells: spellSpec,
    items: itemSpec,
    equipment: equipmentSpec,
};

/** View configs for all library entities */
export const LIBRARY_VIEW_CONFIGS: Record<LibraryEntity, LibraryViewConfig> = {
    creatures: creatureViewConfig,
    spells: spellViewConfig,
    items: itemViewConfig,
    equipment: equipmentViewConfig,
};

/** List schemas for all library entities */
export const LIBRARY_LIST_SCHEMAS: Record<LibraryEntity, LibraryListSchema<LibraryEntry<LibraryEntity>>> = {
    creatures: creatureListSchema as LibraryListSchema<LibraryEntry<LibraryEntity>>,
    spells: spellListSchema as LibraryListSchema<LibraryEntry<LibraryEntity>>,
    items: itemListSchema as LibraryListSchema<LibraryEntry<LibraryEntity>>,
    equipment: equipmentListSchema as LibraryListSchema<LibraryEntry<LibraryEntity>>,
};

// ============================================================================
// Type-safe accessors
// ============================================================================

export function getCreateSpec(entity: LibraryEntity): CreateSpec<any> {
    return LIBRARY_CREATE_SPECS[entity];
}

export function getViewConfig(entity: LibraryEntity): LibraryViewConfig {
    return LIBRARY_VIEW_CONFIGS[entity];
}

export function getListSchema<M extends LibraryEntity>(entity: M): LibraryListSchema<LibraryEntry<M>> {
    return LIBRARY_LIST_SCHEMAS[entity] as LibraryListSchema<LibraryEntry<M>>;
}
