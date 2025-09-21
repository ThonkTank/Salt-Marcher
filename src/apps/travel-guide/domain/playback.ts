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
    baseMs: number;
    onChange: () => void; // UI zeichnet im onChange()-Handler
}) {
    const { app, getMapFile, adapter, store, baseMs, onChange } = cfg;

    let playing = false;

    function trimRoutePassed(token: Coord) {
        const cur = store.get();
        let i = 0;
        while (i < cur.route.length && cur.route[i].r === token.r && cur.route[i].c === token.c) i++;
        if (i > 0) store.set({ route: cur.route.slice(i) });
    }

    async function play() {
        const mapFile = getMapFile();
        if (!mapFile) return;

        const s0 = store.get();
        if (s0.route.length === 0) return;

        playing = true;
        store.set({ playing: true });
        onChange();

        while (playing) {
            const s = store.get();
            if (s.route.length === 0) break;

            // Immer das nächste Ziel vom aktuellen State nehmen (Route beginnt NACH dem Token)
            const next = s.route[0];

            // Sicherstellen, dass Geometrie vorhanden ist
            adapter.ensurePolys([{ r: next.r, c: next.c }]);

            // Dauer = baseMs / (Terrain × TokenSpeed)
            const terr = await loadTerrainSpeed(app, mapFile, next);
            const eff = Math.max(0.05, terr * s.tokenSpeed);
            const dur = baseMs / eff;

            const ctr = adapter.centerOf(next);
            if (ctr) {
                await adapter.token.moveTo(ctr.x, ctr.y, dur);
            }

            // Token angekommen → State aktualisieren
            const tokenRC = { r: next.r, c: next.c };
            store.set({ tokenRC, currentTile: tokenRC });

            // Persistieren in Tiles (Domain-only)
            await writeTokenToTiles(app, mapFile, tokenRC);

            // Passierte Knoten entfernen (Pfad beginnt immer am Token)
            trimRoutePassed(tokenRC);

            onChange();

            // Abbruch prüfen
            if (!playing) break;
        }

        playing = false;
        store.set({ playing: false });
        onChange();
    }

    function pause() {
        playing = false;
        store.set({ playing: false });
        onChange();
    }

    return { play, pause };
}
