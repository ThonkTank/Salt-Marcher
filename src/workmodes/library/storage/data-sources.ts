// src/workmodes/library/storage/data-sources.ts
// Stellt zentral konfigurierte Datenquellen für filterbare Library-Ansichten bereit.
import type { App, TFile } from "obsidian";
import type { BaseEntry, DataSource } from "../../../features/data-manager";
import { readFrontmatter } from "../../../features/data-manager/browse/frontmatter-utils";
import { listVaultPresets, watchVaultPresets } from "../../../../Presets/lib/vault-preset-loader";

export type FilterableLibraryMode = "creatures" | "spells" | "items" | "equipment" | "terrains" | "regions" | "calendars";

export interface CreatureEntryMeta {
    readonly type?: string;
    readonly cr?: string;
}

export interface SpellEntryMeta {
    readonly school?: string;
    readonly level?: number;
    readonly casting_time?: string;
    readonly duration?: string;
    readonly concentration?: boolean;
    readonly ritual?: boolean;
    readonly description?: string;
}

export interface ItemEntryMeta {
    readonly category?: string;
    readonly rarity?: string;
}

export interface EquipmentEntryMeta {
    readonly type?: string;
    readonly role?: string;
}

export interface TerrainEntryMeta {
    readonly color: string;
    readonly speed: number;
}

export interface RegionEntryMeta {
    readonly terrain: string;
    readonly encounterOdds?: number;
}

export interface CalendarEntryMeta {
    readonly id: string;
    readonly daysPerWeek: number;
    readonly monthCount?: number;
}

export interface LibraryEntryMetaMap {
    creatures: CreatureEntryMeta;
    spells: SpellEntryMeta;
    items: ItemEntryMeta;
    equipment: EquipmentEntryMeta;
    terrains: TerrainEntryMeta;
    regions: RegionEntryMeta;
    calendars: CalendarEntryMeta;
}

export type LibraryEntry<M extends FilterableLibraryMode> = BaseEntry & LibraryEntryMetaMap[M];

export type LibraryDataSourceMap = {
    [M in FilterableLibraryMode]: DataSource<M, LibraryEntry<M>>;
};

/**
 * Generic factory for creating entity loaders.
 * Reduces boilerplate by extracting the common pattern of reading frontmatter
 * and mapping it to entity metadata.
 *
 * @param extractMeta - Function that extracts entity-specific metadata from frontmatter
 * @returns Entity loader function for use in LibraryDataSource
 */
function createEntryLoader<M extends FilterableLibraryMode>(
    extractMeta: (fm: Record<string, unknown>) => LibraryEntryMetaMap[M]
): (app: App, file: TFile) => Promise<LibraryEntry<M>> {
    return async (app: App, file: TFile): Promise<LibraryEntry<M>> => {
        const fm = await readFrontmatter(app, file);
        const meta = extractMeta(fm);
        return { file: file, name: file.basename, ...meta } as LibraryEntry<M>;
    };
}

// Entity-specific metadata extractors
const loadCreatureEntry = createEntryLoader<"creatures">(fm => ({
    type: typeof fm.type === "string" ? fm.type : undefined,
    cr: typeof fm.cr === "string" ? fm.cr : typeof fm.cr === "number" ? String(fm.cr) : undefined,
}));

const loadSpellEntry = createEntryLoader<"spells">(fm => {
    const rawLevel = fm.level;
    const level = typeof rawLevel === "number"
        ? rawLevel
        : typeof rawLevel === "string"
            ? Number(rawLevel)
            : undefined;
    return {
        school: typeof fm.school === "string" ? fm.school : undefined,
        level: Number.isFinite(level) ? level : undefined,
        casting_time: typeof fm.casting_time === "string" ? fm.casting_time : undefined,
        duration: typeof fm.duration === "string" ? fm.duration : undefined,
        concentration: typeof fm.concentration === "boolean" ? fm.concentration : undefined,
        ritual: typeof fm.ritual === "boolean" ? fm.ritual : undefined,
        description: typeof fm.description === "string" ? fm.description : undefined,
    };
});

const loadItemEntry = createEntryLoader<"items">(fm => ({
    category: typeof fm.category === "string" ? fm.category : undefined,
    rarity: typeof fm.rarity === "string" ? fm.rarity : undefined,
}));

const loadEquipmentEntry = createEntryLoader<"equipment">(fm => {
    const roleCandidate = [
        fm.weapon_category,
        fm.armor_category,
        fm.tool_category,
        fm.gear_category,
    ].find((value): value is string => typeof value === "string" && value.length > 0);
    return {
        type: typeof fm.type === "string" ? fm.type : undefined,
        role: roleCandidate,
    };
});

const loadTerrainEntry = createEntryLoader<"terrains">(fm => ({
    color: typeof fm.color === "string" ? fm.color : "transparent",
    speed: typeof fm.speed === "number" ? fm.speed : 1.0,
}));

const loadRegionEntry = createEntryLoader<"regions">(fm => ({
    terrain: typeof fm.terrain === "string" ? fm.terrain : "",
    encounterOdds: typeof fm.encounter_odds === "number" ? fm.encounter_odds : undefined,
}));

const loadCalendarEntry = createEntryLoader<"calendars">(fm => {
    const months = Array.isArray(fm.months) ? fm.months : [];
    return {
        id: typeof fm.id === "string" ? fm.id : "",
        daysPerWeek: typeof fm.daysPerWeek === "number" ? fm.daysPerWeek : 7,
        monthCount: months.length,
    };
});

export const LIBRARY_DATA_SOURCES: LibraryDataSourceMap = {
    creatures: {
        id: "creatures",
        list: (app) => listVaultPresets(app, "creatures"),
        watch: (app, onChange) => watchVaultPresets(app, "creatures", onChange),
        load: loadCreatureEntry,
    },
    spells: {
        id: "spells",
        list: (app) => listVaultPresets(app, "spells"),
        watch: (app, onChange) => watchVaultPresets(app, "spells", onChange),
        load: loadSpellEntry,
    },
    items: {
        id: "items",
        list: (app) => listVaultPresets(app, "items"),
        watch: (app, onChange) => watchVaultPresets(app, "items", onChange),
        load: loadItemEntry,
    },
    equipment: {
        id: "equipment",
        list: (app) => listVaultPresets(app, "equipment"),
        watch: (app, onChange) => watchVaultPresets(app, "equipment", onChange),
        load: loadEquipmentEntry,
    },
    terrains: {
        id: "terrains",
        list: (app) => listVaultPresets(app, "terrains"),
        watch: (app, onChange) => watchVaultPresets(app, "terrains", onChange),
        load: loadTerrainEntry,
    },
    regions: {
        id: "regions",
        list: (app) => listVaultPresets(app, "regions"),
        watch: (app, onChange) => watchVaultPresets(app, "regions", onChange),
        load: loadRegionEntry,
    },
    calendars: {
        id: "calendars",
        list: (app) => listVaultPresets(app, "calendars"),
        watch: (app, onChange) => watchVaultPresets(app, "calendars", onChange),
        load: loadCalendarEntry,
    },
};
