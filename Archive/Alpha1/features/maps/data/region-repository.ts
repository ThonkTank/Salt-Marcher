// src/features/maps/data/region-repository.ts
import type { App} from "obsidian";
import { TFile, normalizePath } from "obsidian";
import { configurableLogger } from "@services/logging/configurable-logger";
import { getRegionDataSource } from "./region-data-source";

const logger = configurableLogger.forModule("region-repository");
import type { Region } from "../config/region";

export type { Region };

// Legacy constants for backwards compatibility
// NOTE: These are kept for migration tools only. New code should use vault preset system.
export const REGIONS_FILE = "SaltMarcher/Regions.md";

/**
 * Ensure legacy Regions.md file exists
 * @deprecated Use vault preset files instead
 */
export async function ensureRegionsFile(app: App): Promise<TFile> {
    const path = normalizePath(REGIONS_FILE);
    const existing = app.vault.getAbstractFileByPath(path);
    if (existing instanceof TFile) {
        return existing;
    }

    const dir = path.split("/").slice(0, -1).join("/");
    if (dir) {
        await app.vault.createFolder(dir).catch(() => {});
    }

    const body = [
        "---",
        "smList: true",
        "---",
        "# Regions",
        "",
        "```regions",
        "# Name: Terrain",
        "# Beispiel:",
        "# Saltmarsh: Küste",
        "```",
        "",
    ].join("\n");

    return await app.vault.create(path, body);
}

/**
 * Load regions from vault preset files (YAML frontmatter format).
 * Replaces old region-store.ts approach which used single Regions.md file.
 */
export async function loadRegions(app: App): Promise<Region[]> {
    try {
        // Use feature-level data source abstraction
        const dataSource = getRegionDataSource();
        const files = await dataSource.list(app);
        const regions: Region[] = [];

        for (const file of files) {
            try {
                const entry = await dataSource.load(app, file);
                regions.push({
                    name: entry.name,
                    terrain: entry.terrain,
                    encounterOdds: entry.encounterOdds,
                });
            } catch (err) {
                logger.warn(`Failed to load region from ${file.path}:`, err);
                // Continue loading other regions
            }
        }

        return regions;
    } catch (err) {
        logger.error("Failed to load regions from vault:", err);
        return [];
    }
}

/**
 * Watch for changes to region files in vault.
 * Uses feature-level data source abstraction.
 */
export function watchRegions(app: App, onChange: () => void): () => void {
    const dataSource = getRegionDataSource();
    return dataSource.watch(app, onChange);
}
