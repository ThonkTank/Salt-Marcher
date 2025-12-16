// src/features/maps/data/region-data-source.ts
// Feature-level data source abstraction for region loading
// Allows features layer to load regions without depending on workmodes layer

import type { App, TFile } from "obsidian";
import type { Region } from "../config/region";

/**
 * Data source interface for loading regions.
 * Abstracts the underlying storage mechanism (vault presets, etc.)
 */
export interface RegionDataSource {
    /** List all region files */
    list(app: App): Promise<TFile[]>;

    /** Watch for region file changes */
    watch(app: App, onChange: () => void): () => void;

    /** Load a single region from a file */
    load(app: App, file: TFile): Promise<RegionEntry>;
}

/**
 * Region entry with file reference
 */
export interface RegionEntry extends Region {
    file: TFile;
}

/**
 * Global registry for region data source.
 * Allows workmodes to register their implementation while features remain decoupled.
 */
let _regionDataSource: RegionDataSource | null = null;

/**
 * Register the region data source implementation.
 * Should be called during plugin initialization by workmode layer.
 */
export function registerRegionDataSource(source: RegionDataSource): void {
    _regionDataSource = source;
}

/**
 * Get the registered region data source.
 * Throws if not registered.
 */
export function getRegionDataSource(): RegionDataSource {
    if (!_regionDataSource) {
        throw new Error("Region data source not registered. Call registerRegionDataSource() during plugin initialization.");
    }
    return _regionDataSource;
}
