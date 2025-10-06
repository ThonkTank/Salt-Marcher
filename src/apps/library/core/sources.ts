// src/apps/library/core/sources.ts
// Konsolidiert Bibliotheksquellen samt Setup- und Beschreibungs-Utilities.
import type { App } from "obsidian";
import { ensureCreatureDir, CREATURES_DIR } from "./creature-files";
import { ensureSpellDir, SPELLS_DIR } from "./spell-files";
import { ensureItemDir, ITEMS_DIR } from "./item-files";
import { ensureEquipmentDir, EQUIPMENT_DIR } from "./equipment-files";
import { ensureTerrainFile, TERRAIN_FILE } from "../../../core/terrain-store";
import { ensureRegionsFile, REGIONS_FILE } from "../../../core/regions-store";

export type LibrarySourceId = "creatures" | "spells" | "items" | "equipment" | "terrains" | "regions";

type SourceSpec = {
    ensure(app: App): Promise<unknown>;
    description: string;
};

const SOURCE_MAP: Record<LibrarySourceId, SourceSpec> = Object.freeze({
    creatures: {
        ensure: ensureCreatureDir,
        description: `${CREATURES_DIR}/`,
    },
    spells: {
        ensure: ensureSpellDir,
        description: `${SPELLS_DIR}/`,
    },
    items: {
        ensure: ensureItemDir,
        description: `${ITEMS_DIR}/`,
    },
    equipment: {
        ensure: ensureEquipmentDir,
        description: `${EQUIPMENT_DIR}/`,
    },
    terrains: {
        ensure: ensureTerrainFile,
        description: TERRAIN_FILE,
    },
    regions: {
        ensure: ensureRegionsFile,
        description: REGIONS_FILE,
    },
});

export const LIBRARY_SOURCE_IDS = Object.freeze(Object.keys(SOURCE_MAP) as LibrarySourceId[]);

export async function ensureLibrarySource(app: App, source: LibrarySourceId): Promise<void> {
    const spec = SOURCE_MAP[source];
    if (!spec) throw new Error(`Unknown library source: ${source}`);
    await spec.ensure(app);
}

export async function ensureLibrarySources(app: App, sources?: Iterable<LibrarySourceId>): Promise<void> {
    const requested = sources ? Array.from(new Set(sources)) : LIBRARY_SOURCE_IDS;
    await Promise.all(requested.map(source => ensureLibrarySource(app, source)));
}

export function describeLibrarySource(source: LibrarySourceId): string {
    const spec = SOURCE_MAP[source];
    if (!spec) throw new Error(`Unknown library source: ${source}`);
    return spec.description;
}

