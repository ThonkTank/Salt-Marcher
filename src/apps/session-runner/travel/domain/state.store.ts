// src/apps/session-runner/travel/domain/state.store.ts
// Einfacher Zustandsspeicher für Travel-Logik.
import type { LogicStateSnapshot, Coord, RouteNode } from "./types";

export type Store = {
    get(): LogicStateSnapshot;
    set(patch: Partial<LogicStateSnapshot>): void;
    replace(next: LogicStateSnapshot): void;
    subscribe(fn: (s: LogicStateSnapshot) => void): () => void;
    emit(): void;
};

export function createStore(): Store {
    let state: LogicStateSnapshot = {
        tokenRC: { r: 0, c: 0 },
        route: [],
        editIdx: null,
        tokenSpeed: 3, // mph default party speed
        currentTile: null,
        playing: false,
        tempo: 1,
        clockHours: 0,
    };

    const subs = new Set<(s: LogicStateSnapshot) => void>();

    const get = () => state;

    const set = (patch: Partial<LogicStateSnapshot>) => {
        state = { ...state, ...patch };
        emit();
    };

    const replace = (next: LogicStateSnapshot) => {
        state = next;
        emit();
    };

    const subscribe = (fn: (s: LogicStateSnapshot) => void) => {
        subs.add(fn);
        fn(state);
        return () => subs.delete(fn);
    };

    const emit = () => {
        for (const fn of subs) fn(state);
    };

        return { get, set, replace, subscribe, emit };
}
