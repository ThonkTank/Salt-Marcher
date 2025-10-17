// src/workmodes/library/core/sources.ts
// Konsolidiert Bibliotheksquellen samt Setup- und Beschreibungs-Utilities.
import type { App } from "obsidian";
import { ensureCreatureDir } from "../storage/creatures";
import { ensureSpellDir } from "../storage/spells";
import { ensureItemDir } from "../storage/items";
import { ensureEquipmentDir } from "../storage/equipment";
import { ensureTerrainFile, TERRAIN_FILE } from "../../../features/maps/data/terrain-repository";
import { ensureRegionsFile, REGIONS_FILE } from "../../../features/maps/data/region-repository";
import { ENTITY_REGISTRY } from "./entity-registry";

export type LibrarySourceId = "creatures" | "spells" | "items" | "equipment" | "terrains" | "regions";

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

