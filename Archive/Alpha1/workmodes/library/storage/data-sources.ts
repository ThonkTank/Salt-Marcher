// src/workmodes/library/storage/data-sources.ts
// Stellt zentral konfigurierte Datenquellen für filterbare Library-Ansichten bereit.
// Implementiert Caching mit Vault-Change-Invalidierung zur Leistungsoptimierung
import type { App, TFile } from "obsidian";
import { configurableLogger } from '@services/logging/configurable-logger';
const logger = configurableLogger.forModule('library-data-sources');
import { readFrontmatter } from "@features/data-manager/browse/frontmatter-utils";
import { listVaultPresets, watchVaultPresets } from "../../../../Presets/lib/vault-preset-loader";
import type { BaseEntry, DataSource } from "@features/data-manager";

// Re-export library types from services/domain for convenience
export type {
    FilterableLibraryMode,
    CreatureEntryMeta,
    SpellEntryMeta,
    ItemEntryMeta,
    EquipmentEntryMeta,
    TerrainEntryMeta,
    RegionEntryMeta,
    FactionEntryMeta,
    CalendarEntryMeta,
    LocationEntryMeta,
    PlaylistEntryMeta,
    EncounterTableEntryMeta,
    CharacterEntryMeta,
    LibraryEntryMetaMap,
    LibraryEntry,
    LibraryDataSourceMap,
} from "@services/domain/library-types";

// Import types for local use
import type {
    FilterableLibraryMode,
    LibraryEntryMetaMap,
    LibraryEntry,
    LibraryDataSourceMap,
} from "@services/domain/library-types";

/**
 * Caching layer for library data sources
 * Caches file listings and entries in memory to eliminate repeated folder scans
 * when switching between tabs in the Library view.
 *
 * Cache invalidation occurs on vault changes (file create/modify/delete)
 * with debouncing to handle rapid changes.
 */
class LibraryDataSourceCache {
    private static readonly CACHE_DEBOUNCE_MS = 300;
    private static readonly MAX_CACHE_ENTRIES = 10000; // Safety limit

    private fileListCache = new Map<FilterableLibraryMode, TFile[]>();
    private entryCache = new Map<FilterableLibraryMode, Map<string, BaseEntry>>();
    private invalidationTimers = new Map<FilterableLibraryMode, number>();
    private stats = {
        hits: 0,
        misses: 0,
        invalidations: 0,
    };

    /**
     * Get cached file list for entity type
     */
    getCachedFileList(mode: FilterableLibraryMode): TFile[] | undefined {
        return this.fileListCache.get(mode);
    }

    /**
     * Store file list in cache
     */
    setCachedFileList(mode: FilterableLibraryMode, files: TFile[]): void {
        this.fileListCache.set(mode, files);
        this.stats.misses++;
        logger.debug(`Populated file list cache for ${mode}: ${files.length} files`);
    }

    /**
     * Get cached entry if available
     */
    getCachedEntry(mode: FilterableLibraryMode, filepath: string): BaseEntry | undefined {
        const cache = this.entryCache.get(mode);
        if (cache?.has(filepath)) {
            this.stats.hits++;
            return cache.get(filepath);
        }
        return undefined;
    }

    /**
     * Store entry in cache
     */
    setCachedEntry(mode: FilterableLibraryMode, filepath: string, entry: BaseEntry): void {
        if (!this.entryCache.has(mode)) {
            this.entryCache.set(mode, new Map());
        }
        const cache = this.entryCache.get(mode)!;

        // Safety limit to prevent unbounded memory growth
        if (cache.size >= LibraryDataSourceCache.MAX_CACHE_ENTRIES) {
            logger.warn(`Max entries reached for ${mode}, clearing cache`);
            cache.clear();
        }

        cache.set(filepath, entry);
    }

    /**
     * Invalidate cache for a specific entity type with debouncing
     * Debouncing prevents thrashing when multiple files change rapidly
     */
    invalidateCache(mode: FilterableLibraryMode): void {
        // Clear existing timer if present
        const existingTimer = this.invalidationTimers.get(mode);
        if (existingTimer !== undefined) {
            window.clearTimeout(existingTimer);
        }

        // Schedule invalidation with debounce
        const timer = window.setTimeout(() => {
            this.fileListCache.delete(mode);
            this.entryCache.delete(mode);
            this.invalidationTimers.delete(mode);
            this.stats.invalidations++;
            logger.debug(`Invalidated cache for ${mode}`);
        }, LibraryDataSourceCache.CACHE_DEBOUNCE_MS);

        this.invalidationTimers.set(mode, timer);
    }

    /**
     * Get cache statistics for debugging
     */
    getStats() {
        const hitRate = this.stats.hits + this.stats.misses > 0
            ? ((this.stats.hits / (this.stats.hits + this.stats.misses)) * 100).toFixed(1)
            : "0.0";
        return {
            hits: this.stats.hits,
            misses: this.stats.misses,
            hitRate: `${hitRate}%`,
            invalidations: this.stats.invalidations,
            cachedTypes: this.fileListCache.size,
        };
    }

    /**
     * Clear all caches
     */
    clear(): void {
        // Clear all timers
        for (const timer of this.invalidationTimers.values()) {
            window.clearTimeout(timer);
        }

        this.fileListCache.clear();
        this.entryCache.clear();
        this.invalidationTimers.clear();
        logger.debug(`All caches cleared`);
    }
}

// Global cache instance
const LIBRARY_CACHE = new LibraryDataSourceCache();

// Export for testing
export { LIBRARY_CACHE, LibraryDataSourceCache };

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

function extractTokenValues(raw: unknown): string[] {
    if (!Array.isArray(raw)) return [];
    const result: string[] = [];
    for (const entry of raw) {
        if (typeof entry === "string" && entry.trim()) {
            result.push(entry.trim());
        } else if (entry && typeof entry === "object") {
            const value = (entry as Record<string, unknown>).value;
            if (typeof value === "string" && value.trim()) {
                result.push(value.trim());
            }
        }
    }
    return result;
}

const loadFactionEntry = createEntryLoader<"factions">(fm => {
    const influenceTags = extractTokenValues(fm.influence_tags);
    const members = Array.isArray(fm.members) ? fm.members : [];

    return {
        influence: influenceTags[0],
        headquarters: typeof fm.headquarters === "string" ? fm.headquarters : undefined,
        memberCount: members.length,
    };
});

const loadCalendarEntry = createEntryLoader<"calendars">(fm => {
    const months = Array.isArray(fm.months) ? fm.months : [];
    return {
        id: typeof fm.id === "string" ? fm.id : "",
        daysPerWeek: typeof fm.daysPerWeek === "number" ? fm.daysPerWeek : 7,
        monthCount: months.length,
    };
});

const loadLocationEntry = createEntryLoader<"locations">(fm => {
    const ownerType = typeof fm.owner_type === "string" ? fm.owner_type : "none";
    const ownerName = typeof fm.owner_name === "string" ? fm.owner_name.trim() : "";
    const owner = ownerType !== "none" && ownerName ? `${ownerType}: ${ownerName}` : undefined;

    const locationType = typeof fm.type === "string" ? fm.type : "Unknown";
    let gridSize: string | undefined = undefined;

    // For dungeons, add grid size badge
    if (locationType === "Dungeon") {
        const gridWidth = typeof fm.grid_width === "number" ? fm.grid_width : undefined;
        const gridHeight = typeof fm.grid_height === "number" ? fm.grid_height : undefined;
        if (gridWidth && gridHeight) {
            gridSize = `${gridWidth}×${gridHeight}`;
        }
    }

    return {
        type: locationType,
        owner,
        parent: typeof fm.parent === "string" ? fm.parent : undefined,
        grid_size: gridSize,
    };
});

const loadPlaylistEntry = createEntryLoader<"playlists">(fm => {
    const type = typeof fm.type === "string" && (fm.type === "ambience" || fm.type === "music")
        ? fm.type
        : "ambience";

    const tracks = Array.isArray(fm.tracks) ? fm.tracks : [];

    return {
        type,
        track_count: tracks.length,
        terrain_tags: extractTokenValues(fm.terrain_tags),
        weather_tags: extractTokenValues(fm.weather_tags),
        time_of_day_tags: extractTokenValues(fm.time_of_day_tags),
        faction_tags: extractTokenValues(fm.faction_tags),
        situation_tags: extractTokenValues(fm.situation_tags),
    };
});

const loadEncounterTableEntry = createEntryLoader<"encounter-tables">(fm => {
    const entries = Array.isArray(fm.entries) ? fm.entries : [];

    const crRange = fm.crRange && typeof fm.crRange === "object"
        ? {
            min: typeof (fm.crRange as any).min === "number" ? (fm.crRange as any).min : undefined,
            max: typeof (fm.crRange as any).max === "number" ? (fm.crRange as any).max : undefined,
        }
        : undefined;

    return {
        entry_count: entries.length,
        terrain_tags: extractTokenValues(fm.terrain_tags),
        weather_tags: extractTokenValues(fm.weather_tags),
        time_of_day_tags: extractTokenValues(fm.time_of_day_tags),
        faction_tags: extractTokenValues(fm.faction_tags),
        situation_tags: extractTokenValues(fm.situation_tags),
        crRange,
    };
});

const loadCharacterEntry = createEntryLoader<"characters">(fm => ({
    level: typeof fm.level === "number" ? fm.level : 1,
    characterClass: typeof fm.characterClass === "string" ? fm.characterClass : "Unknown",
    maxHp: typeof fm.maxHp === "number" ? fm.maxHp : 0,
    ac: typeof fm.ac === "number" ? fm.ac : 10,
}));

/**
 * Creates a cached data source wrapper that uses the library cache
 * to avoid repeated folder scans when switching between tabs.
 *
 * The wrapper:
 * 1. Returns cached file list if available (typically <20ms)
 * 2. Falls back to listVaultPresets if cache miss (typically 100-200ms)
 * 3. Stores result in cache for next tab switch
 * 4. Watches for vault changes to invalidate cache
 */
function createCachedDataSource<M extends FilterableLibraryMode>(
    mode: M,
    loader: (app: App, file: TFile) => Promise<LibraryEntry<M>>
): DataSource<M, LibraryEntry<M>> {
    return {
        id: mode,
        // List files with cache check
        list: async (app: App): Promise<TFile[]> => {
            const cached = LIBRARY_CACHE.getCachedFileList(mode);
            if (cached) {
                logger.debug(`[Library:${mode}] Cache hit for file list (${cached.length} files)`);
                return cached;
            }

            // Cache miss: load from vault
            const startTime = performance.now();
            const files = await listVaultPresets(app, mode);
            const duration = performance.now() - startTime;

            LIBRARY_CACHE.setCachedFileList(mode, files);
            logger.info(`[Library:${mode}] Loaded ${files.length} files in ${duration.toFixed(1)}ms`);

            return files;
        },
        // Watch for changes and invalidate cache
        watch: (app: App, onChange: () => void): (() => void) => {
            // Wrap onChange to also invalidate cache before calling original
            const wrappedOnChange = () => {
                LIBRARY_CACHE.invalidateCache(mode);
                onChange();
            };

            // Setup original watcher with wrapped callback
            const unsubscribeOriginal = watchVaultPresets(app, mode, wrappedOnChange);

            // Return cleanup function that unsubscribes from both
            return () => {
                unsubscribeOriginal();
            };
        },
        // Load entry with cache check (optional - only if needed)
        load: loader,
    };
}

export const LIBRARY_DATA_SOURCES: LibraryDataSourceMap = {
    creatures: createCachedDataSource("creatures", loadCreatureEntry),
    spells: createCachedDataSource("spells", loadSpellEntry),
    items: createCachedDataSource("items", loadItemEntry),
    equipment: createCachedDataSource("equipment", loadEquipmentEntry),
    terrains: createCachedDataSource("terrains", loadTerrainEntry),
    regions: createCachedDataSource("regions", loadRegionEntry),
    factions: createCachedDataSource("factions", loadFactionEntry),
    calendars: createCachedDataSource("calendars", loadCalendarEntry),
    locations: createCachedDataSource("locations", loadLocationEntry),
    playlists: createCachedDataSource("playlists", loadPlaylistEntry),
    "encounter-tables": createCachedDataSource("encounter-tables", loadEncounterTableEntry),
    characters: createCachedDataSource("characters", loadCharacterEntry),
};
