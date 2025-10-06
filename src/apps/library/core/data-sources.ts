// src/apps/library/core/data-sources.ts
// Stellt zentral konfigurierte Datenquellen für filterbare Library-Ansichten bereit.
import type { App, TFile } from "obsidian";
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

async function readFrontmatter(app: App, file: TFile): Promise<Record<string, unknown>> {
    const cached = app.metadataCache.getFileCache(file)?.frontmatter;
    if (cached && typeof cached === "object") {
        return cached as Record<string, unknown>;
    }
    const content = await app.vault.read(file);
    const match = content.match(/^---\n([\s\S]*?)\n---/);
    if (!match) return {};
    const lines = match[1].split(/\r?\n/);
    const data: Record<string, unknown> = {};
    for (const line of lines) {
        const idx = line.indexOf(":");
        if (idx === -1) continue;
        const rawKey = line.slice(0, idx).trim();
        if (!rawKey) continue;
        let rawValue = line.slice(idx + 1).trim();
        if (!rawValue) {
            data[rawKey] = rawValue;
            continue;
        }
        if (/^".*"$/.test(rawValue)) {
            rawValue = rawValue.slice(1, -1);
        }
        const num = Number(rawValue);
        data[rawKey] = Number.isFinite(num) && rawValue === String(num)
            ? num
            : rawValue;
    }
    return data;
}

async function loadCreatureEntry(app: App, file: TFile): Promise<LibraryEntry<"creatures">> {
    const fm = await readFrontmatter(app, file);
    const type = typeof fm.type === "string" ? fm.type : undefined;
    const crValue = typeof fm.cr === "string" ? fm.cr : typeof fm.cr === "number" ? String(fm.cr) : undefined;
    return { file, name: file.basename, type, cr: crValue };
}

async function loadSpellEntry(app: App, file: TFile): Promise<LibraryEntry<"spells">> {
    const fm = await readFrontmatter(app, file);
    const school = typeof fm.school === "string" ? fm.school : undefined;
    const rawLevel = fm.level;
    const level = typeof rawLevel === "number"
        ? rawLevel
        : typeof rawLevel === "string"
            ? Number(rawLevel)
            : undefined;
    const casting_time = typeof fm.casting_time === "string" ? fm.casting_time : undefined;
    const duration = typeof fm.duration === "string" ? fm.duration : undefined;
    const concentration = typeof fm.concentration === "boolean" ? fm.concentration : undefined;
    const ritual = typeof fm.ritual === "boolean" ? fm.ritual : undefined;
    const description = typeof fm.description === "string" ? fm.description : undefined;
    return {
        file,
        name: file.basename,
        school,
        level: Number.isFinite(level) ? level : undefined,
        casting_time,
        duration,
        concentration,
        ritual,
        description,
    };
}

async function loadItemEntry(app: App, file: TFile): Promise<LibraryEntry<"items">> {
    const fm = await readFrontmatter(app, file);
    const category = typeof fm.category === "string" ? fm.category : undefined;
    const rarity = typeof fm.rarity === "string" ? fm.rarity : undefined;
    return { file, name: file.basename, category, rarity };
}

async function loadEquipmentEntry(app: App, file: TFile): Promise<LibraryEntry<"equipment">> {
    const fm = await readFrontmatter(app, file);
    const type = typeof fm.type === "string" ? fm.type : undefined;
    const roleCandidate = [
        fm.weapon_category,
        fm.armor_category,
        fm.tool_category,
        fm.gear_category,
    ].find((value): value is string => typeof value === "string" && value.length > 0);
    return { file, name: file.basename, type, role: roleCandidate };
}

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
