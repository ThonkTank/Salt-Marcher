// src/features/maps/config/store-interfaces.ts
// Interface definitions for map stores to break circular dependencies.
//
// This file contains only interfaces that can be imported without creating
// circular dependencies between repositories and stores.

import type { AxialCoord } from "@geometry";

/**
 * Coordinate in axial coordinates
 */
export type TileCoord = AxialCoord;

/**
 * Tile data structure (subset of fields needed by stores)
 */
export interface TileDataInterface {
    terrain?: string;
    flora?: string;
    backgroundColor?: string;
    region?: string;
    faction?: string;
    manualFactionEdit?: boolean;
    note?: string;
    locationMarker?: string;
    elevation?: number;
    moisture?: string;
    terrainVariants?: number[];
    floraVariants?: number[];
    climate?: any;
}

/**
 * Faction overlay assignment (for tile → faction mapping)
 */
export interface FactionOverlayAssignment {
    coord: TileCoord;
    factionId: string;
    factionName?: string;
    strength?: number;
    color?: string;
    tags?: string[];
    sourceId?: string;
}


/**
 * FactionOverlayStore interface - core operations needed by repositories
 */
export interface IFactionOverlayStore {
    setAssignments(assignments: readonly FactionOverlayAssignment[]): void;
    clear(): void;
    get(coord: TileCoord): any | null;
    list(): any[];
    getColorForFaction(factionId: string): string;
}

/**
 * LocationMarkerStore interface - core operations needed by repositories
 */
export interface ILocationMarkerStore {
    clear(): void;
    // Add other methods as needed
}

/**
 * LocationInfluenceStore interface - core operations needed by repositories
 */
export interface ILocationInfluenceStore {
    clear(): void;
    // Add other methods as needed
}

/**
 * TerrainFeatureStore interface - core operations needed by repositories
 */
export interface ITerrainFeatureStore {
    clear(): void;
    load(): Promise<void>;
    save(): Promise<void>;
    // Add other methods as needed
}

/**
 * WeatherOverlayStore interface - core operations needed by repositories
 */
export interface IWeatherOverlayStore {
    clear(): void;
    // Add other methods as needed
}

