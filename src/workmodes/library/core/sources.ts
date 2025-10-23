// src/workmodes/library/core/sources.ts
// Konsolidiert Bibliotheksquellen samt Setup- und Beschreibungs-Utilities.
import type { App } from "obsidian";
import { normalizePath } from "obsidian";
import { ensureTerrainFile, TERRAIN_FILE } from "../../../features/maps/data/terrain-repository";
import { ensureRegionsFile, REGIONS_FILE } from "../../../features/maps/data/region-repository";
import { ENTITY_REGISTRY } from "../../../../Presets/lib/entity-registry";

// Simple directory ensure functions
async function ensureDir(app: App, dir: string): Promise<void> {
    const normalizedDir = normalizePath(dir);
    const folder = app.vault.getAbstractFileByPath(normalizedDir);
    if (!folder) {
        await app.vault.createFolder(normalizedDir).catch(() => {});
    }
}

const ensureCreatureDir = (app: App) => ensureDir(app, ENTITY_REGISTRY.creatures.directory);
const ensureSpellDir = (app: App) => ensureDir(app, ENTITY_REGISTRY.spells.directory);
const ensureItemDir = (app: App) => ensureDir(app, ENTITY_REGISTRY.items.directory);
const ensureEquipmentDir = (app: App) => ensureDir(app, ENTITY_REGISTRY.equipment.directory);
const ensureCalendarDir = (app: App) => ensureDir(app, ENTITY_REGISTRY.calendars.directory);

export type LibrarySourceId = "creatures" | "spells" | "items" | "equipment" | "terrains" | "regions" | "calendars";

type SourceSpec = {
    ensure(app: App): Promise<unknown>;
    description: string;
};

const SOURCE_MAP: Record<LibrarySourceId, SourceSpec> = Object.freeze({
    creatures: {
        ensure: ensureCreatureDir,
        description: `${ENTITY_REGISTRY.creatures.directory}/`,
    },
    spells: {
        ensure: ensureSpellDir,
        description: `${ENTITY_REGISTRY.spells.directory}/`,
    },
    items: {
        ensure: ensureItemDir,
        description: `${ENTITY_REGISTRY.items.directory}/`,
    },
    equipment: {
        ensure: ensureEquipmentDir,
        description: `${ENTITY_REGISTRY.equipment.directory}/`,
    },
    terrains: {
        ensure: ensureTerrainFile,
        description: TERRAIN_FILE,
    },
    regions: {
        ensure: ensureRegionsFile,
        description: REGIONS_FILE,
    },
    calendars: {
        ensure: ensureCalendarDir,
        description: `${ENTITY_REGISTRY.calendars.directory}/`,
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

