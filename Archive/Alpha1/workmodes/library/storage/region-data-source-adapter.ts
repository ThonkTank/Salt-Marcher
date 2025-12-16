// src/workmodes/library/storage/region-data-source-adapter.ts
// Adapter that implements feature-level RegionDataSource using workmode-level LIBRARY_DATA_SOURCES
// This decouples features from workmodes while allowing workmodes to provide implementations.

import type { App, TFile } from "obsidian";
import { LIBRARY_DATA_SOURCES } from "./data-sources";
import type { RegionDataSource, RegionEntry } from "@features/maps/data/region-data-source";

/**
 * Workmode-level adapter that bridges LIBRARY_DATA_SOURCES to feature-level RegionDataSource.
 * Converts LibraryEntry<"regions"> to RegionEntry format.
 */
export const regionDataSourceAdapter: RegionDataSource = {
    list(app: App): Promise<TFile[]> {
        return LIBRARY_DATA_SOURCES.regions.list(app);
    },

    watch(app: App, onChange: () => void): () => void {
        return LIBRARY_DATA_SOURCES.regions.watch(app, onChange);
    },

    async load(app: App, file: TFile): Promise<RegionEntry> {
        const libraryEntry = await LIBRARY_DATA_SOURCES.regions.load(app, file);
        return {
            file: libraryEntry.file,
            name: libraryEntry.name,
            terrain: libraryEntry.terrain,
            encounterOdds: libraryEntry.encounterOdds,
        };
    },
};
