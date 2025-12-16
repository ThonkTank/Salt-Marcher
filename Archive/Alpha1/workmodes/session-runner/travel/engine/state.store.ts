// src/workmodes/session-runner/travel/engine/state.store.ts
// Einfacher Zustandsspeicher für Travel-Logik.
import type { LogicStateSnapshot } from './calendar-types';

export type Store = {
    get(): LogicStateSnapshot;
    set(patch: Partial<LogicStateSnapshot>): void;
    replace(next: LogicStateSnapshot): void;
    subscribe(fn: (s: LogicStateSnapshot) => void): () => void;
    emit(): void;
};

export function createStore(): Store {
    let state: LogicStateSnapshot = {
        tokenCoord: { q: 0, r: 0 },
        route: [],
        editIdx: null,
        tokenSpeed: 3, // mph default party speed
        currentTile: null,
        playing: false,
        tempo: 1,
        // Party data now managed by shared party-store
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
