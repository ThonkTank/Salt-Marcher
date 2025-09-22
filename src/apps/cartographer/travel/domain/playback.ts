// src/apps/travel-guide/domain/playback.ts
// Abspiel-Logik (Domain): Terrain×Speed, Token animieren, passierte Knoten trimmen,
// Token-Position persistieren (Tiles). Rendering via onChange() im Host (UI ruft draw).

import type { App, TFile } from "obsidian";
import type { Coord, RouteNode, LogicStateSnapshot } from "./types";
import type { RenderAdapter } from "../infra/adapter";
import { loadTerrainSpeed } from "./terrain.service";
import { writeTokenToTiles } from "./persistence";

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
}) {
    const { app, getMapFile, adapter, store, minSecondsPerTile } = cfg;

    let playing = false;
    let currentRun: Promise<void> | null = null;

    function trimRoutePassed(token: Coord) {
        const cur = store.get();
        let i = 0;
        while (i < cur.route.length && cur.route[i].r === token.r && cur.route[i].c === token.c) i++;
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
                    adapter.ensurePolys([{ r: next.r, c: next.c }]);

                    const terr = await loadTerrainSpeed(app, mapFile, next);
                    const seconds = Math.max(minSecondsPerTile, s.tokenSpeed * terr);
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

                    const tokenRC = { r: next.r, c: next.c };
                    store.set({ tokenRC, currentTile: tokenRC });

                    await writeTokenToTiles(app, mapFile, tokenRC);
                    trimRoutePassed(tokenRC);

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

    return { play, pause };
}
