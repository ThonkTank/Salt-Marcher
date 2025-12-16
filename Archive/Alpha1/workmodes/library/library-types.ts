// src/workmodes/library/library-types.ts
// Shared types for all library entity view configurations
// Eliminates duplication across entity-specific view-config files

import type { App } from "obsidian";
import type { ViewConfig, WorkmodeTileMetadata, WorkmodeTileAction } from "../../../features/data-manager";
import type { LibraryEntry, FilterableLibraryMode } from "../storage/data-sources";

/**
 * Context passed to all library entity actions.
 * Provides access to app instance, entry reloading, and filter state.
 */
export interface LibraryActionContext {
    readonly app: App;
    reloadEntries: () => Promise<void>;
    getRenderer: () => ViewConfig<LibraryEntry<any>, LibraryActionContext>;
    getFilterSelection?: (id: string) => string | undefined;
}

/**
 * Generic metadata field for library list tiles.
 * Type-safe wrapper around WorkmodeTileMetadata.
 */
export type LibraryMetadataField<M extends FilterableLibraryMode> = WorkmodeTileMetadata<LibraryEntry<M>>;

/**
 * Generic action definition for library list tiles.
 * Type-safe wrapper around WorkmodeTileAction.
 */
export type LibraryAction<M extends FilterableLibraryMode> = WorkmodeTileAction<LibraryEntry<M>, LibraryActionContext>;

/**
 * Complete view configuration for a library entity.
 * Uses generic ViewConfig from data-manager.
 */
export type LibraryViewConfig<M extends FilterableLibraryMode = any> = ViewConfig<LibraryEntry<M>, LibraryActionContext>;
