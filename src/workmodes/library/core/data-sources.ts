// src/workmodes/library/core/data-sources.ts
// Stellt zentral konfigurierte Datenquellen für filterbare Library-Ansichten bereit.
import type { App, TFile } from "obsidian";
import { readFrontmatter } from "../../../features/data-manager/browse/frontmatter-utils";
import { listCreatureFiles, watchCreatureDir } from "./creature-files";
import { listSpellFiles, watchSpellDir } from "./spell-files";
import { listItemFiles, watchItemDir } from "./item-files";
import { listEquipmentFiles, watchEquipmentDir } from "./equipment-files";

export type FilterableLibraryMode = "creatures" | "spells" | "items" | "equipment";

export interface LibraryEntryBase {
    readonly file: TFile;
    readonly name: string;
}

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

export interface LibraryEntryMetaMap {
    creatures: CreatureEntryMeta;
    spells: SpellEntryMeta;
    items: ItemEntryMeta;
    equipment: EquipmentEntryMeta;
}

export type LibraryEntry<M extends FilterableLibraryMode> = LibraryEntryBase & LibraryEntryMetaMap[M];

export interface LibraryDataSource<M extends FilterableLibraryMode> {
    readonly id: M;
    list(app: App): Promise<TFile[]>;
    watch(app: App, onChange: () => void): () => void;
    load(app: App, file: TFile): Promise<LibraryEntry<M>>;
}

export type LibraryDataSourceMap = {
    [M in FilterableLibraryMode]: LibraryDataSource<M>;
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
        return { file, name: file.basename, ...meta } as LibraryEntry<M>;
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

export const LIBRARY_DATA_SOURCES: LibraryDataSourceMap = {
    creatures: {
        id: "creatures",
        list: (app) => listCreatureFiles(app),
        watch: (app, onChange) => watchCreatureDir(app, onChange),
        load: loadCreatureEntry,
    },
    spells: {
        id: "spells",
        list: (app) => listSpellFiles(app),
        watch: (app, onChange) => watchSpellDir(app, onChange),
        load: loadSpellEntry,
    },
    items: {
        id: "items",
        list: (app) => listItemFiles(app),
        watch: (app, onChange) => watchItemDir(app, onChange),
        load: loadItemEntry,
    },
    equipment: {
        id: "equipment",
        list: (app) => listEquipmentFiles(app),
        watch: (app, onChange) => watchEquipmentDir(app, onChange),
        load: loadEquipmentEntry,
    },
};
