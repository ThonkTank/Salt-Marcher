// src/features/data-manager/browse/types.ts
// Generic type definitions for the browse infrastructure

import type { App, TFile } from "obsidian";
import type { FilterDefinition, SortDefinition } from "./filter-controls";
import type { WorkmodeTileMetadata, WorkmodeTileAction } from "./list-renderer";

/**
 * Base entry type that all browsable entities must implement.
 * Minimum requirement: name and file reference.
 */
export interface BaseEntry {
    readonly name: string;
    readonly file: TFile;
}

/**
 * Generic data source interface for loading and watching entities.
 * Implementations handle file system access and change detection.
 *
 * @template M - Mode identifier type (e.g., "creatures" | "spells")
 * @template E - Entry type extending BaseEntry
 */
export interface DataSource<M extends string, E extends BaseEntry> {
    readonly id: M;
    list(app: App): Promise<TFile[]>;
    watch(app: App, onChange: () => void): () => void;
    load(app: App, file: TFile): Promise<E>;
}

/**
 * Generic view configuration for rendering entity lists.
 * Defines metadata fields, actions, and creation handler.
 *
 * @template E - Entry type extending BaseEntry
 * @template C - Action context type (defaults to any)
 */
export interface ViewConfig<E extends BaseEntry, C = any> {
    readonly metadataFields: WorkmodeTileMetadata<E>[];
    readonly actions: WorkmodeTileAction<E, C>[];
    readonly handleCreate: (context: C, name: string) => Promise<void>;
}

/**
 * Complete schema for filter, sort, and search configuration.
 *
 * @template E - Entry type extending BaseEntry
 */
export interface ListSchema<E extends BaseEntry> {
    readonly filters: FilterDefinition<E>[];
    readonly sorts: SortDefinition<E>[];
    readonly search: (entry: E) => string[];
}

/**
 * Generic source watcher hub for coordinating file system watchers.
 * Ensures only one watcher per mode exists and handles cleanup.
 *
 * @template M - Mode identifier type
 */
export interface SourceWatcherHub<M extends string = string> {
    subscribe(
        mode: M,
        watch: (onChange: () => void) => () => void,
        onChange: () => void
    ): () => void;
}

/**
 * Configuration object for GenericListRenderer.
 * Bundles all necessary dependencies for rendering a list view.
 *
 * @template M - Mode identifier type
 * @template E - Entry type extending BaseEntry
 * @template C - Action context type
 */
export interface GenericListRendererConfig<M extends string, E extends BaseEntry, C = any> {
    readonly mode: M;
    readonly source: DataSource<M, E>;
    readonly schema: ListSchema<E>;
    readonly viewConfig: ViewConfig<E, C>;
    readonly watchers: SourceWatcherHub<M>;
}
