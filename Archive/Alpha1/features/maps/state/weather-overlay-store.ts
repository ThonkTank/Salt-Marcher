// src/features/maps/state/weather-overlay-store.ts
// Weather overlay store for map rendering
//
// Generates and caches procedural weather per hex based on region climate.
// Integrates with calendar system for time-based weather progression.
//
// NOTE: This store uses TileCache via TileCacheProvider injection to break circular dependency.
// The provider is set during bootstrap via setTileCacheProvider().

import type { App} from "obsidian";
import { TFile, normalizePath } from "obsidian";
import { writable, type WritableStore } from "@services/state";
import { getStoreManager } from "@services/state/store-manager";
import { getClimateTemplate } from "../../weather/climate-templates";
import { generateWeather } from "../../weather/weather-generator";
import type { WeatherType, Season } from "../../weather/weather-types";
import type { AxialCoord } from "@geometry";
import { coordToKey, type CoordKey } from "@geometry";
import type { TileData } from "@domain";
import type { TileCache } from "../data/tile-cache";

/**
 * Weather overlay entry for a single hex
 */
export interface WeatherOverlayEntry {
    coord: AxialCoord;
    key: string; // Coordinate key "q,r"
    weatherType: WeatherType;
    severity: number; // 0-1 scale
    temperature: number; // Celsius
    lastUpdate: string; // ISO date string
}

/**
 * Weather overlay store state
 */
export interface WeatherOverlayState {
    mapPath: string;
    loaded: boolean;
    entries: Map<string, WeatherOverlayEntry>;
    previousWeather: Map<string, WeatherType>; // Track previous weather per hex for Markov transitions
    currentSeason: Season;
    currentDayOfYear: number;
    version: number;
}

/**
 * Weather overlay store interface
 */
export interface WeatherOverlayStore {
    readonly state: WritableStore<WeatherOverlayState>;
    generateWeatherForHex(coord: AxialCoord, climate?: string): Promise<void>;
    generateWeatherForAllTiles(): Promise<void>;
    updateSeason(season: Season, dayOfYear: number): Promise<void>;
    clear(): void;
    get(coord: AxialCoord): WeatherOverlayEntry | null;
    list(): WeatherOverlayEntry[];
}

const weatherRegistry = new WeakMap<App, Map<string, WeatherOverlayStore>>();

/**
 * Function type for providing a TileCache.
 * Used for dependency injection to break circular dependency.
 */
export type TileCacheProvider = (app: App, mapFile: TFile) => TileCache;

// Injected TileCache provider - set during bootstrap
let tileCacheProvider: TileCacheProvider | null = null;

/**
 * Inject the TileCache provider function.
 * Called during bootstrap to break circular dependency.
 *
 * Idempotent: Skips if provider is already set (e.g., during hot reload).
 */
export function setTileCacheProvider(provider: TileCacheProvider): void {
    if (tileCacheProvider !== null) {
        // Provider already set (e.g., during hot reload) - skip re-injection
        return;
    }
    tileCacheProvider = provider;
}

/**
 * Get the injected TileCache provider.
 * Throws if not yet initialized.
 */
function getTileCacheProvider(): TileCacheProvider {
    if (!tileCacheProvider) {
        throw new Error(
            "[weather-overlay-store] TileCacheProvider not initialized. " +
            "Call setTileCacheProvider() during bootstrap."
        );
    }
    return tileCacheProvider;
}

/**
 * Get current season based on day of year
 * Simple northern hemisphere seasons
 */
function getSeason(dayOfYear: number): Season {
    if (dayOfYear < 80 || dayOfYear >= 355) return "winter";
    if (dayOfYear < 172) return "spring";
    if (dayOfYear < 266) return "summer";
    return "autumn";
}

/**
 * Get or create weather overlay store for a map file
 */
export function getWeatherOverlayStore(
    app: App,
    mapFile: TFile
): WeatherOverlayStore {
    let storesByApp = weatherRegistry.get(app);
    if (!storesByApp) {
        storesByApp = new Map();
        weatherRegistry.set(app, storesByApp);
    }

    const mapPath = normalizePath(mapFile.path);
    let store = storesByApp.get(mapPath);
    if (!store) {
        store = createWeatherOverlayStore(app, mapFile);
        storesByApp.set(mapPath, store);
    }

    return store;
}

/**
 * Create weather overlay store instance
 */
function createWeatherOverlayStore(
    app: App,
    mapFile: TFile
): WeatherOverlayStore {
    const mapPath = normalizePath(mapFile.path);
    const storeId = `weather-overlay:${mapPath}`;

    // Get or register writable store
    const storeManager = getStoreManager();
    let state: WritableStore<WeatherOverlayState>;

    if (storeManager.has(storeId)) {
        state = storeManager.get(storeId) as WritableStore<WeatherOverlayState>;
    } else {
        const initialState: WeatherOverlayState = {
            mapPath,
            loaded: false,
            entries: new Map(),
            previousWeather: new Map(),
            currentSeason: "spring",
            currentDayOfYear: 1,
            version: 1,
        };
        state = writable(initialState);
        storeManager.register(storeId, state, "writable");
    }

    // Get TileCache via injected provider (breaks circular dependency)
    const tileCache = getTileCacheProvider()(app, mapFile);

    /**
     * Improved seed generation using Cantor pairing for smoother hex-to-hex variation
     * Adjacent hexes will have more similar seeds than with q * 1000 + r
     */
    const coordToSeed = (coord: AxialCoord, dayOfYear: number): number => {
        // Cantor pairing function for coordinate hashing
        const paired = ((coord.q + coord.r) * (coord.q + coord.r + 1)) / 2 + coord.r;
        // Combine with day of year for temporal variation
        return paired * 1000 + dayOfYear;
    };

    /**
     * Generate weather for a specific hex
     */
    const generateWeatherForHex = async (coord: AxialCoord, climate?: string): Promise<void> => {
        const key = coordToKey(coord);

        // Get tile data to determine region/climate
        const tileData = tileCache.get(key);
        let climateName = climate || "Temperate";

        if (!climate && tileData?.region) {
            // Try to load region data to get climate_template
            const regionPath = `SaltMarcher/Regions/${tileData.region}.md`;
            const regionFile = app.vault.getAbstractFileByPath(regionPath);
            if (regionFile instanceof TFile) {
                try {
                    const content = await app.vault.cachedRead(regionFile);
                    const frontmatterMatch = content.match(/^---\n([\s\S]+?)\n---/);
                    if (frontmatterMatch) {
                        const frontmatter = frontmatterMatch[1];
                        const climateMatch = frontmatter.match(/climate_template:\s*(.+)/);
                        if (climateMatch && climateMatch[1].trim()) {
                            climateName = climateMatch[1].trim();
                        }
                    }
                } catch (error) {
                    // Fallback to Temperate if region file can't be read
                }
            }
        }

        const climateTemplate = getClimateTemplate(climateName);

        // Generate weather and update state
        state.update(s => {
            // Get previous weather for this hex (if any) for Markov transitions
            const prevWeatherType = s.previousWeather.get(key);
            const previousWeather = prevWeatherType ? { type: prevWeatherType, severity: 0.5, duration: 24 } : undefined;

            const weatherState = generateWeather({
                climate: climateTemplate,
                season: s.currentSeason,
                previousWeather,
                dayOfYear: s.currentDayOfYear,
                seed: coordToSeed(coord, s.currentDayOfYear),
            });

            const entry: WeatherOverlayEntry = {
                coord,
                key,
                weatherType: weatherState.currentWeather.type,
                severity: weatherState.currentWeather.severity,
                temperature: weatherState.temperature,
                lastUpdate: new Date().toISOString(),
            };

            s.entries.set(key, entry);
            // Store current weather as previous for next generation
            s.previousWeather.set(key, weatherState.currentWeather.type);
            s.loaded = true;
            s.version++;

            return s;
        });
    };

    /**
     * Generate weather for all tiles in the map
     */
    const generateWeatherForAllTiles = async (): Promise<void> => {
        // Get all tiles from TileCache state
        const cacheState = tileCache.getState();
        const allTiles: Array<{ coord: AxialCoord; data: TileData }> = [];
        for (const [key, record] of cacheState.tiles) {
            allTiles.push({ coord: record.coord, data: record.data });
        }

        // Pre-load all region climate templates
        const regionClimateCache = new Map<string, string>();
        for (const tile of allTiles) {
            if (tile.data.region && !regionClimateCache.has(tile.data.region)) {
                const regionPath = `SaltMarcher/Regions/${tile.data.region}.md`;
                const regionFile = app.vault.getAbstractFileByPath(regionPath);
                if (regionFile instanceof TFile) {
                    try {
                        const content = await app.vault.cachedRead(regionFile);
                        const frontmatterMatch = content.match(/^---\n([\s\S]+?)\n---/);
                        if (frontmatterMatch) {
                            const frontmatter = frontmatterMatch[1];
                            const climateMatch = frontmatter.match(/climate_template:\s*(.+)/);
                            if (climateMatch && climateMatch[1].trim()) {
                                regionClimateCache.set(tile.data.region, climateMatch[1].trim());
                            }
                        }
                    } catch (error) {
                        // Fallback to default
                    }
                }
            }
        }

        state.update(s => {
            for (const tile of allTiles) {
                const key = coordToKey(tile.coord);

                // Get climate from tile region
                const tileData = tile.data;
                const climateName = tileData.region ? (regionClimateCache.get(tileData.region) || "Temperate") : "Temperate";
                const climateTemplate = getClimateTemplate(climateName);

                // Get previous weather for Markov transitions
                const prevWeatherType = s.previousWeather.get(key);
                const previousWeather = prevWeatherType ? { type: prevWeatherType, severity: 0.5, duration: 24 } : undefined;

                const weatherState = generateWeather({
                    climate: climateTemplate,
                    season: s.currentSeason,
                    previousWeather,
                    dayOfYear: s.currentDayOfYear,
                    seed: coordToSeed(tile.coord, s.currentDayOfYear),
                });

                const entry: WeatherOverlayEntry = {
                    coord: tile.coord,
                    key,
                    weatherType: weatherState.currentWeather.type,
                    severity: weatherState.currentWeather.severity,
                    temperature: weatherState.temperature,
                    lastUpdate: new Date().toISOString(),
                };

                s.entries.set(key, entry);
                // Store current weather as previous for next generation
                s.previousWeather.set(key, weatherState.currentWeather.type);
            }

            s.loaded = true;
            s.version++;
            return s;
        });
    };

    /**
     * Update season and regenerate all weather
     */
    const updateSeason = async (season: Season, dayOfYear: number): Promise<void> => {
        // Get all tiles from TileCache and create lookup map
        const cacheState = tileCache.getState();
        const tileDataMap = new Map<string, TileData>();
        for (const [key, record] of cacheState.tiles) {
            tileDataMap.set(key, record.data);
        }

        // Pre-load all region climate templates
        const regionClimateCache = new Map<string, string>();
        const currentEntries = Array.from(state.get().entries.values());

        for (const entry of currentEntries) {
            const tileData = tileDataMap.get(entry.key);
            if (tileData?.region && !regionClimateCache.has(tileData.region)) {
                const regionPath = `SaltMarcher/Regions/${tileData.region}.md`;
                const regionFile = app.vault.getAbstractFileByPath(regionPath);
                if (regionFile instanceof TFile) {
                    try {
                        const content = await app.vault.cachedRead(regionFile);
                        const frontmatterMatch = content.match(/^---\n([\s\S]+?)\n---/);
                        if (frontmatterMatch) {
                            const frontmatter = frontmatterMatch[1];
                            const climateMatch = frontmatter.match(/climate_template:\s*(.+)/);
                            if (climateMatch && climateMatch[1].trim()) {
                                regionClimateCache.set(tileData.region, climateMatch[1].trim());
                            }
                        }
                    } catch (error) {
                        // Fallback to default
                    }
                }
            }
        }

        state.update(s => {
            s.currentSeason = season;
            s.currentDayOfYear = dayOfYear;

            // Regenerate weather for all hexes with new season
            for (const [key, entry] of s.entries) {
                const tileData = tileDataMap.get(entry.key);
                const climateName = tileData?.region ? (regionClimateCache.get(tileData.region) || "Temperate") : "Temperate";
                const climateTemplate = getClimateTemplate(climateName);

                // Get previous weather for Markov transitions
                const prevWeatherType = s.previousWeather.get(key);
                const previousWeather = prevWeatherType ? { type: prevWeatherType, severity: 0.5, duration: 24 } : undefined;

                const weatherState = generateWeather({
                    climate: climateTemplate,
                    season,
                    previousWeather,
                    dayOfYear,
                    seed: coordToSeed(entry.coord, dayOfYear),
                });

                entry.weatherType = weatherState.currentWeather.type;
                entry.severity = weatherState.currentWeather.severity;
                entry.temperature = weatherState.temperature;
                entry.lastUpdate = new Date().toISOString();

                // Store current weather as previous for next generation
                s.previousWeather.set(key, weatherState.currentWeather.type);
            }

            s.version++;
            return s;
        });
    };

    /**
     * Clear all weather data
     */
    const clear = (): void => {
        state.update(s => {
            s.entries.clear();
            s.previousWeather.clear();
            s.loaded = false;
            s.version++;
            return s;
        });
    };

    /**
     * Get weather for specific coordinate
     */
    const get = (coord: AxialCoord): WeatherOverlayEntry | null => {
        let result: WeatherOverlayEntry | null = null;
        const unsubscribe = state.subscribe(s => {
            const key = coordToKey(coord);
            result = s.entries.get(key) ?? null;
        });
        unsubscribe();
        return result;
    };

    /**
     * List all weather entries
     */
    const list = (): WeatherOverlayEntry[] => {
        let result: WeatherOverlayEntry[] = [];
        const unsubscribe = state.subscribe(s => {
            result = Array.from(s.entries.values());
        });
        unsubscribe();
        return result;
    };

    return {
        state,
        generateWeatherForHex,
        generateWeatherForAllTiles,
        updateSeason,
        clear,
        get,
        list,
    };
}

/**
 * Reset weather overlay store for a map (for testing)
 */
export function resetWeatherOverlayStore(app: App, mapFile: TFile): void {
    const storesByApp = weatherRegistry.get(app);
    if (!storesByApp) return;

    const mapPath = normalizePath(mapFile.path);
    const store = storesByApp.get(mapPath);
    if (store) {
        store.clear();
        storesByApp.delete(mapPath);
    }
}
