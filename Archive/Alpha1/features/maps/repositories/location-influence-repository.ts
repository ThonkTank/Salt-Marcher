/**
 * src/features/maps/repositories/location-influence-repository.ts
 * Phase 9.1: Load location data and calculate influence areas for map display
 *
 * Purpose: Bridge between location library files and map UI.
 * Loads location markdown files, parses coordinates, calculates influence areas.
 * Provides functions to populate location-influence-store from vault data.
 */

import type { App, TFile } from "obsidian";
import { configurableLogger } from "@services/logging/configurable-logger";

const logger = configurableLogger.forModule("location-influence-repository");
import { parseFrontmatter } from "@services/fm-parser";
import {
    calculateInfluenceArea,
    getInfluencedHexes,
} from "../../locations/location-influence";
import type { LocationData } from "@services/domain";
import type { TileCoord } from "../data/tile-repository";
import type { LocationInfluenceAssignment } from "../state/location-influence-store";

/**
 * Load all locations from the vault and calculate their influence areas
 */
export async function loadLocationInfluences(
    app: App,
    locationFolderPath: string = "SaltMarcher/Locations"
): Promise<LocationInfluenceAssignment[]> {
    const assignments: LocationInfluenceAssignment[] = [];

    try {
        // Get all markdown files in location folder
        const locationFiles = app.vault.getMarkdownFiles().filter(file =>
            file.path.startsWith(locationFolderPath)
        );

        for (const file of locationFiles) {
            try {
                const location = await loadLocationFromFile(app, file);
                if (!location) continue;

                // Calculate influence area
                const area = calculateInfluenceArea(location);
                if (!area) continue;

                // Get all hexes influenced by this location
                const influenced = getInfluencedHexes(area);

                // Create assignments for each influenced hex
                for (const { hex, strength } of influenced) {
                    // Use axial coordinates directly (TileCoord is AxialCoord)
                    const tileCoord: TileCoord = { q: hex.q, r: hex.r };

                    assignments.push({
                        coord: tileCoord,
                        locationName: location.name,
                        locationType: location.type,
                        strength,
                        ownerType: location.owner_type,
                        ownerName: location.owner_name,
                    });
                }
            } catch (error) {
                logger.warn('[location-influence] Failed to process file', { path: file.path, error });
            }
        }
    } catch (error) {
        logger.error('[location-influence] Failed to load locations', { error });
    }

    return assignments;
}

/**
 * Load a single location from a file
 */
async function loadLocationFromFile(app: App, file: TFile): Promise<LocationData | null> {
    try {
        const content = await app.vault.read(file);
        const fm = parseFrontmatter(content);

        // Check if it's a location file
        if (fm.smType !== "Location") return null;

        // Parse location data from frontmatter
        const location: LocationData = {
            name: fm.name || file.basename,
            type: fm.type || "Gebäude",
            coordinates: fm.coordinates,
            description: fm.description || "",
            parent: fm.parent,
            owner_type: fm.owner_type || "none",
            owner_name: fm.owner_name,
            tags: Array.isArray(fm.tags) ? fm.tags : [],
            building: fm.building,
        };

        // Only return locations with valid coordinates
        if (!location.coordinates) return null;

        return location;
    } catch (error) {
        logger.warn('[location-influence] Failed to parse location file', { path: file.path, error });
        return null;
    }
}

/**
 * Reload location influences for a specific map
 * Call this when locations change
 */
export async function reloadLocationInfluences(
    app: App,
    mapFile: TFile,
    store: { setAssignments(assignments: readonly LocationInfluenceAssignment[]): void },
    locationFolderPath?: string
): Promise<void> {
    const assignments = await loadLocationInfluences(app, locationFolderPath);
    store.setAssignments(assignments);
}

/**
 * Load locations within a specific map's bounds
 * Optimized version that only loads locations that could affect the map
 */
export async function loadLocationInfluencesForMap(
    app: App,
    mapBounds: { minR: number; maxR: number; minC: number; maxC: number },
    locationFolderPath?: string
): Promise<LocationInfluenceAssignment[]> {
    // For now, just load all locations
    // TODO: Implement spatial filtering based on mapBounds
    return loadLocationInfluences(app, locationFolderPath);
}
