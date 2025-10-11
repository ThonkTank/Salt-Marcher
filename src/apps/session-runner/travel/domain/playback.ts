// src/apps/session-runner/travel/domain/playback.ts
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
    onEncounter?: () => void | Promise<void>;
}) {
    const { app, getMapFile, adapter, store, minSecondsPerTile, onEncounter } = cfg;

    let playing = false;
    let currentRun: Promise<void> | null = null;
    let clockTimer: number | null = null;
    let hourAcc = 0; // accumulate fractional hours for encounter checks

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
            // start clock
            if (clockTimer == null) {
                clockTimer = window.setInterval(() => {
                    const s = store.get();
                    const tempo = Math.max(0.1, Math.min(10, s.tempo || 1));
                    const nextHours = (s.clockHours || 0) + tempo;
                    hourAcc += tempo;
                    // Encounter check per full hour elapsed
                    while (hourAcc >= 1) {
                        hourAcc -= 1;
                        void checkEncounter();
                    }
                    store.set({ clockHours: nextHours });
                }, 1000);
            }

            try {
                while (playing) {
                    const s = store.get();
                    if (s.route.length === 0) break;

                    const next = s.route[0];
                    adapter.ensurePolys([{ r: next.r, c: next.c }]);

                    const terr = await loadTerrainSpeed(app, mapFile, next);
                    const mph = Math.max(0.1, s.tokenSpeed); // party speed mph
                    const hoursPerTile = (3 / mph) * terr; // 3 miles per tile
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

                    const tokenRC = { r: next.r, c: next.c };
                    store.set({ tokenRC, currentTile: tokenRC });

                    await writeTokenToTiles(app, mapFile, tokenRC);
                    trimRoutePassed(tokenRC);

                    if (!playing) break;
                }
            } finally {
                playing = false;
                store.set({ playing: false });
                if (clockTimer != null) { clearInterval(clockTimer); clockTimer = null; }
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
        if (clockTimer != null) { clearInterval(clockTimer); clockTimer = null; }
    }

    async function checkEncounter() {
        try {
            const mapFile = getMapFile(); if (!mapFile) return;
            const s = store.get();
            const cur = s.currentTile || s.tokenRC;
            if (!cur) return;
            const { loadTile } = await import("../../../../core/hex-mapper/hex-notes");
            const tile = await loadTile(app, mapFile, cur).catch(() => null);
            const regionName = (tile as any)?.region as string | undefined;
            if (!regionName) return; // no region → skip
            const { loadRegions } = await import("../../../../core/regions-store");
            const regions = await loadRegions(app);
            const region = regions.find(r => (r.name || "").toLowerCase() === regionName.toLowerCase());
            const odds = (region as any)?.encounterOdds as number | undefined;
            const n = Number.isFinite(odds) && (odds as number) > 0 ? (odds as number) : undefined;
            if (!n) return;
            const roll = Math.floor(Math.random() * n) + 1;
            if (roll === 1) {
                onEncounter && (await onEncounter());
            }
        } catch (err) {
            console.error("[travel] encounter check failed", err);
        }
    }

    return { play, pause };
}
