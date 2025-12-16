// src/workmodes/session-runner/travel/engine/actions.ts
// State- und Playback-Logik für den Travel-Modus.
import type { App, TFile } from "obsidian";
import { asAutoNode, asUserNode, expandCoords, rebuildFromAnchors } from "./expansion";
import { loadTokenCoordFromMap, writeTokenToTiles } from "./persistence";
import { createPlayback } from "./playback";
import { createStore } from "./state.store";
import { setTravelStore, clearTravelStore } from "./travel-store-registry";
import type { Coord, RouteNode, LogicStateSnapshot } from './calendar-types';
import type { RenderAdapter } from "../infra/adapter";

export type TravelLogic = {
    // State
    getState(): LogicStateSnapshot;

    // Auswahl / Edit
    selectDot(idx: number | null): void;

    // Setzen
    handleHexClick(coord: Coord): void; // neuen user-Punkt setzen

    // Drag-Commit
    moveSelectedTo(coord: Coord): void;  // Punkt verschieben, auto generieren
    moveTokenTo(coord: Coord): void;     // token versetzen, auto neu

    // Löschen
    deleteUserAt(idx: number): void;  // nur user

    // Reise
    play(): Promise<void>;
    pause(): void;
    reset(): Promise<void>;
    setTokenSpeed(v: number): void;
    setTempo?(v: number): void;
    // Party data now managed by shared party-store (src/services/state/party-store.ts)

    // Adapterwechsel
    bindAdapter(adapter: RenderAdapter): void;

    // Token-Persistenz
    initTokenFromTiles(): Promise<void>;
    persistTokenToTiles(): Promise<void>;
};

export function createTravelLogic(cfg: {
    app: App;
    minSecondsPerTile: number;
    getMapFile: () => TFile | null;
    adapter: RenderAdapter;
    onChange?: (s: LogicStateSnapshot) => void;
    onEncounter?: () => void | Promise<void>;
    onTimeAdvance?: (hours: number) => Promise<void>;
    onHexChange?: (coord: Coord) => void | Promise<void>;
}): TravelLogic {
    const store = createStore();
    let adapter = cfg.adapter;

    // Register store globally for reactive subscriptions (e.g., EncounterCoordinator)
    const mapFile = cfg.getMapFile();
    if (mapFile) {
        setTravelStore(store, mapFile.path);
    }

    // UI-Callback koppeln
    const unsub = store.subscribe((s) => {
        cfg.onChange?.(s);
        adapter.draw(s.route, s.tokenCoord);
    });

    const playback = createPlayback({
        app: cfg.app,
        getMapFile: cfg.getMapFile,
        store,
        adapter,
        minSecondsPerTile: cfg.minSecondsPerTile,
        onEncounter: cfg.onEncounter,
        onTimeAdvance: cfg.onTimeAdvance,
        onHexChange: cfg.onHexChange,
    });

    const getState = () => store.get();

    const bindAdapter = (a: RenderAdapter) => {
        adapter = a;
    };

    const selectDot = (idx: number | null) => {
        const len = store.get().route.length;
        const safe = idx == null ? null : Math.max(0, Math.min(idx, len - 1));
        store.set({ editIdx: safe });
    };

    // Hilfsfunktionen -----------------------------------------------------------

    const lastUserAnchor = (): Coord | null => {
        const r = store.get().route;
        for (let i = r.length - 1; i >= 0; i--) {
            if (r[i].kind === "user") return r[i];
        }
        return null;
    };

    const userIndices = (): number[] => {
        const out: number[] = [];
        store.get().route.forEach((n, i) => { if (n.kind === "user") out.push(i); });
        return out;
    };

    const ensurePolys = (coords: Coord[]) => adapter.ensurePolys(coords);

    // Aktionen ------------------------------------------------------------------

    const handleHexClick = (coord: Coord) => {
        const s = store.get();
        const source = lastUserAnchor() ?? s.tokenCoord;
        if (source.q === coord.q && source.r === coord.r) return;

        const seg = expandCoords(source, coord); // EXKL source, INKL coord
        ensurePolys(seg);

        const autos = seg.slice(0, Math.max(0, seg.length - 1)).map(asAutoNode);
        const user = asUserNode(coord);
        const route = [...s.route, ...autos, user];

        store.set({ route });
    };

    const moveSelectedTo = (coord: Coord) => {
        const s = store.get();
        const i = s.editIdx;
        if (i == null || i < 0 || i >= s.route.length) return;

        // prevUser / nextUser finden
        const users = userIndices();
        const prevUserIdx = [...users].reverse().find((u) => u < i) ?? -1;
        const nextUserIdx = users.find((u) => u > i) ?? -1;

        const prevAnchor: Coord = prevUserIdx >= 0 ? s.route[prevUserIdx] : s.tokenCoord;
        const head = prevUserIdx >= 0 ? s.route.slice(0, prevUserIdx + 1) : [];

        // Links: prevAnchor -> coord (Autos, Ende coord NICHT in autos)
        const leftSeg = expandCoords(prevAnchor, coord);
        const leftAutos = leftSeg.slice(0, Math.max(0, leftSeg.length - 1)).map(asAutoNode);

        // Mitte: moved als user
        const moved = asUserNode(coord);

        // Rechts: coord -> nextUser (Autos bis vor nextUser)
        let rightAutos: RouteNode[] = [];
        let tail: RouteNode[] = [];
        if (nextUserIdx >= 0) {
            const nextAnchor = s.route[nextUserIdx];
            const rightSeg = expandCoords(coord, nextAnchor);
            rightAutos = rightSeg.slice(0, Math.max(0, rightSeg.length - 1)).map(asAutoNode);
            tail = s.route.slice(nextUserIdx); // nextUser bleibt erhalten (liegt am Beginn von tail)
        }

        const newRoute = [...head, ...leftAutos, moved, ...rightAutos, ...tail];

        ensurePolys([coord, ...leftSeg, ...rightAutos.map(({ q, r }) => ({ q, r }))]);
        // neuen Index des moved bestimmen
        const newIdx = newRoute.findIndex((n) => n.kind === "user" && n.q === coord.q && n.r === coord.r);

        store.set({ route: newRoute, editIdx: newIdx >= 0 ? newIdx : null });
    };

    async function moveTokenTo(coord: Coord) {
        if (!adapter) return;

        const prev = store.get();
        const anchors = prev.route
            .filter((n) => n.kind === "user")
            .map(({ q, r }) => ({ q, r }));
        const route = rebuildFromAnchors(coord, anchors);

        const routeCoords = route.map(({ q, r }) => ({ q, r }));
        adapter.ensurePolys([coord, ...routeCoords]);

        const ctr = adapter.centerOf(coord);
        if (ctr) {
            adapter.token.setPos(ctr.x, ctr.y);
            adapter.token.show();
        }

        let editIdx: number | null = prev.editIdx;
        if (editIdx != null) {
            const prevNode = prev.route[editIdx];
            if (!prevNode) {
                editIdx = null;
            } else {
                const matchIdx = route.findIndex(
                    (n) => n.kind === prevNode.kind && n.q === prevNode.q && n.r === prevNode.r,
                );
                editIdx = matchIdx >= 0 ? matchIdx : null;
            }
        }

        store.set({ tokenCoord: coord, route, editIdx });

        const mapFile = cfg.getMapFile();
        if (mapFile) await writeTokenToTiles(cfg.app, mapFile, coord);
    }


        const deleteUserAt = (idx: number) => {
            const s = store.get();
            if (idx < 0 || idx >= s.route.length) return;
            if (s.route[idx].kind !== "user") return;

            // Nachbar-User bestimmen
            const users = userIndices();
            const myUserPos = users.indexOf(idx);
            const prevUserIdx = myUserPos > 0 ? users[myUserPos - 1] : -1;
            const nextUserIdx = myUserPos < users.length - 1 ? users[myUserPos + 1] : -1;

            const prevAnchor: Coord = prevUserIdx >= 0 ? s.route[prevUserIdx] : s.tokenCoord;
            const nextAnchor: Coord | null = nextUserIdx >= 0 ? s.route[nextUserIdx] : null;

            const head = prevUserIdx >= 0 ? s.route.slice(0, prevUserIdx + 1) : [];

            // auto(prev -> this) + user(this) + auto(this -> next) entfernen:
            // => alles zwischen prevUserIdx+1 .. (nextUserIdx-1) verwerfen + den user selbst
            const tail = nextUserIdx >= 0 ? s.route.slice(nextUserIdx) : [];

            // Bridge neu generieren, falls es einen rechten Anker gibt
            let bridge: RouteNode[] = [];
            if (nextAnchor) {
                const seg = expandCoords(prevAnchor, nextAnchor);
                const autos = seg.slice(0, Math.max(0, seg.length - 1)).map(asAutoNode);
                bridge = [...autos]; // nextAnchor bleibt durch 'tail' erhalten
                ensurePolys(seg);
            }

            const newRoute = [...head, ...bridge, ...tail];

            // editIdx neu bestimmen
            const newEdit = null;
            store.set({ route: newRoute, editIdx: newEdit });
        };

        const setTokenSpeed = (v: number) => {
            const val = Number.isFinite(v) && v > 0 ? v : 1;
            store.set({ tokenSpeed: val });
        };
        const setTempo = (v: number) => {
            const val = Number.isFinite(v) ? Math.max(0.1, Math.min(10, v)) : 1;
            store.set({ tempo: val });
        };
        // setParty removed - party data now managed by shared party-store

        const play = async () => playback.play();
        const pause = () => playback.pause();

        const reset = async () => {
            playback.pause();
            store.set({
                route: [],
                editIdx: null,
                currentTile: null,
                playing: false,
            });
            await initTokenFromTiles();
        };

        // Token I/O ---------------------------------------------------------------

    async function initTokenFromTiles() {
        const mapFile = cfg.getMapFile();
        if (!mapFile || !adapter) return;

        const prev = store.get();
        const found = await loadTokenCoordFromMap(cfg.app, mapFile);
        const tokenCoord = found ?? prev.tokenCoord ?? { q: 0, r: 0 };

        const anchors = prev.route
            .filter((n) => n.kind === "user")
            .map(({ q, r }) => ({ q, r }));
        const route = rebuildFromAnchors(tokenCoord, anchors);

        const routeCoords = route.map(({ q, r }) => ({ q, r }));
        adapter.ensurePolys([tokenCoord, ...routeCoords]);

        const ctr = adapter.centerOf(tokenCoord);
        if (ctr) {
            adapter.token.setPos(ctr.x, ctr.y);
            adapter.token.show();
        }

        let editIdx: number | null = prev.editIdx;
        if (editIdx != null) {
            const prevNode = prev.route[editIdx];
            if (!prevNode) {
                editIdx = null;
            } else {
                const matchIdx = route.findIndex(
                    (n) => n.kind === prevNode.kind && n.q === prevNode.q && n.r === prevNode.r,
                );
                editIdx = matchIdx >= 0 ? matchIdx : null;
            }
        }

        store.set({ tokenCoord, route, editIdx });

        if (!found) await writeTokenToTiles(cfg.app, mapFile, tokenCoord);
    }

            const persistTokenToTiles = async () => {
                const mf = cfg.getMapFile();
                if (!mf) return;
                await writeTokenToTiles(cfg.app, mf, store.get().tokenCoord);
            };

            // Public API --------------------------------------------------------------

            return {
                getState: () => store.get(),
                selectDot,
                handleHexClick,
                moveSelectedTo,
                moveTokenTo,
                deleteUserAt,
                play,
                pause,
                reset,
                setTokenSpeed,
                setTempo,
                // setParty removed - party data now managed by shared party-store
                bindAdapter,
                initTokenFromTiles,
                persistTokenToTiles,
            };
}
