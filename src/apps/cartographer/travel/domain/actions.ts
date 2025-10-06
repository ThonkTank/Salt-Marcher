// src/apps/cartographer/travel/domain/actions.ts
// State- und Playback-Logik für den Travel-Modus.
import type { App, TFile } from "obsidian";
import type { RenderAdapter } from "../infra/adapter";
import { createStore, type Store } from "./state.store";
import type { Coord, RouteNode, LogicStateSnapshot } from "./types";
import { asAutoNode, asUserNode, expandCoords, rebuildFromAnchors } from "./expansion";
import { createPlayback } from "./playback";
import { loadTokenCoordFromMap, writeTokenToTiles } from "./persistence";

export type TravelLogic = {
    // State
    getState(): LogicStateSnapshot;

    // Auswahl / Edit
    selectDot(idx: number | null): void;

    // Setzen
    handleHexClick(rc: Coord): void; // neuen user-Punkt setzen

    // Drag-Commit
    moveSelectedTo(rc: Coord): void;  // Punkt verschieben, auto generieren
    moveTokenTo(rc: Coord): void;     // token versetzen, auto neu

    // Löschen
    deleteUserAt(idx: number): void;  // nur user

    // Reise
    play(): Promise<void>;
    pause(): void;
    reset(): Promise<void>;
    setTokenSpeed(v: number): void;
    setTempo?(v: number): void;

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
}): TravelLogic {
    const store = createStore();
    let adapter = cfg.adapter;

    // UI-Callback koppeln
    const unsub = store.subscribe((s) => {
        cfg.onChange?.(s);
        adapter.draw(s.route, s.tokenRC);
    });

    const playback = createPlayback({
        app: cfg.app,
        getMapFile: cfg.getMapFile,
        store,
        adapter,
        minSecondsPerTile: cfg.minSecondsPerTile,
        onEncounter: cfg.onEncounter,
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

    const handleHexClick = (rc: Coord) => {
        const s = store.get();
        const source = lastUserAnchor() ?? s.tokenRC;
        if (source.r === rc.r && source.c === rc.c) return;

        const seg = expandCoords(source, rc); // EXKL source, INKL rc
        ensurePolys(seg);

        const autos = seg.slice(0, Math.max(0, seg.length - 1)).map(asAutoNode);
        const user = asUserNode(rc);
        const route = [...s.route, ...autos, user];

        store.set({ route });
    };

    const moveSelectedTo = (rc: Coord) => {
        const s = store.get();
        const i = s.editIdx;
        if (i == null || i < 0 || i >= s.route.length) return;

        // prevUser / nextUser finden
        const users = userIndices();
        const prevUserIdx = [...users].reverse().find((u) => u < i) ?? -1;
        const nextUserIdx = users.find((u) => u > i) ?? -1;

        const prevAnchor: Coord = prevUserIdx >= 0 ? s.route[prevUserIdx] : s.tokenRC;
        const head = prevUserIdx >= 0 ? s.route.slice(0, prevUserIdx + 1) : [];

        // Links: prevAnchor -> rc (Autos, Ende rc NICHT in autos)
        const leftSeg = expandCoords(prevAnchor, rc);
        const leftAutos = leftSeg.slice(0, Math.max(0, leftSeg.length - 1)).map(asAutoNode);

        // Mitte: moved als user
        const moved = asUserNode(rc);

        // Rechts: rc -> nextUser (Autos bis vor nextUser)
        let rightAutos: RouteNode[] = [];
        let tail: RouteNode[] = [];
        if (nextUserIdx >= 0) {
            const nextAnchor = s.route[nextUserIdx];
            const rightSeg = expandCoords(rc, nextAnchor);
            rightAutos = rightSeg.slice(0, Math.max(0, rightSeg.length - 1)).map(asAutoNode);
            tail = s.route.slice(nextUserIdx); // nextUser bleibt erhalten (liegt am Beginn von tail)
        }

        const newRoute = [...head, ...leftAutos, moved, ...rightAutos, ...tail];

        ensurePolys([rc, ...leftSeg, ...rightAutos.map(({ r, c }) => ({ r, c }))]);
        // neuen Index des moved bestimmen
        const newIdx = newRoute.findIndex((n) => n.kind === "user" && n.r === rc.r && n.c === rc.c);

        store.set({ route: newRoute, editIdx: newIdx >= 0 ? newIdx : null });
    };

    async function moveTokenTo(rc: Coord) {
        if (!adapter) return;

        const prev = store.get();
        const anchors = prev.route
            .filter((n) => n.kind === "user")
            .map(({ r, c }) => ({ r, c }));
        const route = rebuildFromAnchors(rc, anchors);

        const routeCoords = route.map(({ r, c }) => ({ r, c }));
        adapter.ensurePolys([rc, ...routeCoords]);

        const ctr = adapter.centerOf(rc);
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
                    (n) => n.kind === prevNode.kind && n.r === prevNode.r && n.c === prevNode.c,
                );
                editIdx = matchIdx >= 0 ? matchIdx : null;
            }
        }

        store.set({ tokenRC: rc, route, editIdx });

        const mapFile = cfg.getMapFile();
        if (mapFile) await writeTokenToTiles(cfg.app, mapFile, rc);
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

            const prevAnchor: Coord = prevUserIdx >= 0 ? s.route[prevUserIdx] : s.tokenRC;
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
        const tokenRC = found ?? prev.tokenRC ?? { r: 0, c: 0 };

        const anchors = prev.route
            .filter((n) => n.kind === "user")
            .map(({ r, c }) => ({ r, c }));
        const route = rebuildFromAnchors(tokenRC, anchors);

        const routeCoords = route.map(({ r, c }) => ({ r, c }));
        adapter.ensurePolys([tokenRC, ...routeCoords]);

        const ctr = adapter.centerOf(tokenRC);
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
                    (n) => n.kind === prevNode.kind && n.r === prevNode.r && n.c === prevNode.c,
                );
                editIdx = matchIdx >= 0 ? matchIdx : null;
            }
        }

        store.set({ tokenRC, route, editIdx });

        if (!found) await writeTokenToTiles(cfg.app, mapFile, tokenRC);
    }

            const persistTokenToTiles = async () => {
                const mf = cfg.getMapFile();
                if (!mf) return;
                await writeTokenToTiles(cfg.app, mf, store.get().tokenRC);
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
                bindAdapter,
                initTokenFromTiles,
                persistTokenToTiles,
            };
}
