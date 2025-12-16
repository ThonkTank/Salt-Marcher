// src/workmodes/library/core/sources.ts
// Konsolidiert Bibliotheksquellen samt Setup- und Beschreibungs-Utilities.
import type { App } from "obsidian";
import { normalizePath } from "obsidian";
import { ENTITY_REGISTRY } from "../../../../Presets/lib/entity-registry";
import {
    ensureRegionsFile,
    REGIONS_FILE,
    ensureTerrainFile,
    TERRAIN_FILE,
} from "@features/maps";

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
const ensureFactionDir = (app: App) => ensureDir(app, ENTITY_REGISTRY.factions.directory);
const ensureCalendarDir = (app: App) => ensureDir(app, ENTITY_REGISTRY.calendars.directory);
const ensurePlaylistDir = (app: App) => ensureDir(app, ENTITY_REGISTRY.playlists.directory);
const ensureCharacterDir = (app: App) => ensureDir(app, ENTITY_REGISTRY.characters.directory);

export type LibrarySourceId = "creatures" | "spells" | "items" | "equipment" | "terrains" | "regions" | "factions" | "calendars" | "locations" | "playlists" | "encounter-tables" | "characters";

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
    factions: {
        ensure: ensureFactionDir,
        description: `${ENTITY_REGISTRY.factions.directory}/`,
    },
    calendars: {
        ensure: ensureCalendarDir,
        description: `${ENTITY_REGISTRY.calendars.directory}/`,
    },
    locations: {
        ensure: (app: App) => ensureDir(app, "SaltMarcher/Locations"),
        description: "SaltMarcher/Locations/",
    },
    playlists: {
        ensure: ensurePlaylistDir,
        description: `${ENTITY_REGISTRY.playlists.directory}/`,
    },
    "encounter-tables": {
        ensure: (app: App) => ensureDir(app, "SaltMarcher/EncounterTables"),
        description: "SaltMarcher/EncounterTables/",
    },
    characters: {
        ensure: ensureCharacterDir,
        description: `${ENTITY_REGISTRY.characters.directory}/`,
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
