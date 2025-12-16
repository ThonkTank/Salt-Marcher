// src/workmodes/session-runner/travel/engine/playback.ts
// Abspiel-Logik (Domain): Terrain×Speed, Token animieren, passierte Knoten trimmen,
// Token-Position persistieren (Tiles). Rendering via onChange() im Host (UI ruft draw).
// OPTIMIZED: Added terrain speed cache to prevent redundant tile loads during playback

import type { App, TFile } from "obsidian";
import { configurableLogger } from "@services/logging/configurable-logger";

const logger = configurableLogger.forModule("session-playback");
import { writeTokenToTiles } from "./persistence";
import { loadTerrainSpeed } from "./terrain.service";
import type { Coord, RouteNode, LogicStateSnapshot } from './calendar-types';
import type { RenderAdapter } from "../infra/adapter";

type Store = {
    get(): LogicStateSnapshot & { route: RouteNode[]; playing: boolean };
    set(patch: Partial<LogicStateSnapshot & { route: RouteNode[]; playing: boolean }>): void;
};

export function createPlayback(cfg: {
    app: App;
    getMapFile: () => TFile | null;
    adapter: RenderAdapter;
    store: Store;
    minSecondsPerTile: number;
    onEncounter?: () => void | Promise<void>;
    onTimeAdvance?: (hours: number) => Promise<void>;
    onHexChange?: (coord: Coord) => void | Promise<void>;
}) {
    const { app, getMapFile, adapter, store, minSecondsPerTile, onEncounter, onTimeAdvance, onHexChange } = cfg;

    let playing = false;
    let currentRun: Promise<void> | null = null;

    // OPTIMIZED: Terrain speed cache to prevent redundant tile loads during playback
    // Key: "q,r" coordinate string, Value: terrain speed modifier
    const terrainSpeedCache = new Map<string, number>();
    const getCacheKey = (coord: Coord): string => `${coord.q},${coord.r}`;

    function trimRoutePassed(token: Coord) {
        const cur = store.get();
        let i = 0;
        while (i < cur.route.length && cur.route[i].q === token.q && cur.route[i].r === token.r) i++;
        if (i > 0) store.set({ route: cur.route.slice(i) });
    }

    async function play() {
        if (playing) return;

        if (currentRun) {
            try {
                await currentRun;
            } catch {
                // vorheriger Lauf bereits abgebrochen → ignorieren
            }
        }

        const mapFile = getMapFile();
        if (!mapFile) return;

        const s0 = store.get();
        if (s0.route.length === 0) return;

        const run = (async () => {
            playing = true;
            store.set({ playing: true });

            try {
                while (playing) {
                    const s = store.get();
                    if (s.route.length === 0) break;

                    const next = s.route[0];
                    adapter.ensurePolys([{ q: next.q, r: next.r }]);

                    // OPTIMIZED: Check terrain cache first before loading from tiles
                    const cacheKey = getCacheKey(next);
                    let terr = terrainSpeedCache.get(cacheKey);
                    if (terr === undefined) {
                        terr = await loadTerrainSpeed(app, mapFile, next);
                        terrainSpeedCache.set(cacheKey, terr); // Cache for future tiles
                    }

                    const mph = Math.max(0.1, s.tokenSpeed); // party speed mph
                    const hoursPerTile = 3 / (mph * terr); // 3 miles per tile, adjusted by terrain speed modifier
                    const tempo = Math.max(0.1, Math.min(10, s.tempo || 1));
                    const seconds = Math.max(minSecondsPerTile, hoursPerTile / tempo);
                    const dur = seconds * 1000;

                    const ctr = adapter.centerOf(next);
                    let cancelled = false;
                    if (ctr) {
                        try {
                            await adapter.token.moveTo(ctr.x, ctr.y, dur);
                        } catch (err) {
                            if (err instanceof Error && err.name === "TokenMoveCancelled") {
                                cancelled = true;
                            } else {
                                throw err;
                            }
                        }
                    }

                    if (cancelled) break;

                    const tokenCoord = { q: next.q, r: next.r };
                    store.set({ tokenCoord, currentTile: tokenCoord });

                    await writeTokenToTiles(app, mapFile, tokenCoord);
                    trimRoutePassed(tokenCoord);

                    // Notify about hex change for real-time habitat synchronization
                    if (onHexChange) {
                        try {
                            await onHexChange(tokenCoord);
                        } catch (err) {
                            logger.error("[playback] onHexChange callback failed", err);
                        }
                    }

                    // Advance calendar time by actual travel duration
                    if (onTimeAdvance) {
                        try {
                            await onTimeAdvance(hoursPerTile);
                        } catch (err) {
                            logger.error("[travel] Failed to advance time", err);
                        }
                    }

                    // Encounter checks based on actual travel time
                    await checkEncountersForTile(hoursPerTile);

                    if (!playing) break;
                }
            } finally {
                playing = false;
                store.set({ playing: false });
            }
        })();

        currentRun = run;
        try {
            await run;
        } finally {
            if (currentRun === run) currentRun = null;
        }
    }

    function pause() {
        if (!playing && !currentRun) {
            adapter.token.stop?.();
            return;
        }

        playing = false;
        store.set({ playing: false });
        adapter.token.stop?.();
    }

    /**
     * Checks for encounters based on actual travel time through a hex.
     * Performs one check per full hour, plus a fractional check for remaining time.
     *
     * Example: 2.5 hours = 2 full checks + 1 check at 50% probability
     */
    async function checkEncountersForTile(hoursPerTile: number) {
        try {
            const fullHours = Math.floor(hoursPerTile);
            const fractionalHour = hoursPerTile - fullHours;

            // Check for each full hour (1/8 chance each)
            for (let i = 0; i < fullHours; i++) {
                const roll = Math.floor(Math.random() * 8) + 1;
                if (roll === 1) {
                    logger.info(`[travel] Encounter triggered during hour ${i + 1}/${fullHours} of tile traversal`);
                    if (onEncounter) {
                        await onEncounter();
                        // Stop further checks if encounter occurred
                        return;
                    }
                }
            }

            // Check fractional hour with proportional probability
            // Example: 0.5 hours = 50% of normal 1/8 chance = 1/16 chance
            if (fractionalHour > 0) {
                const adjustedChance = 8 / fractionalHour; // e.g., 0.5 hours → roll d16
                const roll = Math.floor(Math.random() * adjustedChance) + 1;
                if (roll === 1) {
                    logger.info(`[travel] Encounter triggered during fractional hour (${fractionalHour.toFixed(2)}h)`);
                    if (onEncounter) {
                        await onEncounter();
                    }
                }
            }
        } catch (err) {
            logger.error("[travel] encounter check failed", err);
        }
    }

    return { play, pause };
}
