// src/apps/encounter/presenter.ts
// Presenter orchestrating encounter state, persistence and updates from the
// session-store. It is intentionally UI-agnostic so it can be unit-tested and
// reused by different view implementations (Obsidian ItemView, future mobile UI,
// etc.).

import { publishEncounterEvent, subscribeToEncounterEvents, type EncounterEvent } from "./session-store";

export interface EncounterPersistedState {
    session: EncounterSessionState | null;
}

export interface EncounterSessionState {
    event: EncounterEvent;
    notes: string;
    status: EncounterResolutionStatus;
    resolvedAt?: string | null;
}

export type EncounterResolutionStatus = "pending" | "resolved";

export interface EncounterPresenterDeps {
    now?(): string;
}

export interface EncounterViewState extends EncounterPersistedState {}

export type EncounterStateListener = (state: EncounterViewState) => void;

const defaultDeps: Required<EncounterPresenterDeps> = {
    now: () => new Date().toISOString(),
};

export class EncounterPresenter {
    private state: EncounterPersistedState;
    private readonly deps: Required<EncounterPresenterDeps>;
    private readonly listeners = new Set<EncounterStateListener>();
    private unsubscribeStore?: () => void;

    constructor(initial?: EncounterPersistedState | null, deps?: EncounterPresenterDeps) {
        this.deps = { ...defaultDeps, ...deps };
        this.state = EncounterPresenter.normalise(initial);
        this.unsubscribeStore = subscribeToEncounterEvents((event) => this.applyEvent(event));
    }

    dispose() {
        this.unsubscribeStore?.();
        this.listeners.clear();
    }

    /** Restores persisted state (e.g. when `setViewData` fires before `onOpen`). */
    restore(state: EncounterPersistedState | null) {
        this.state = EncounterPresenter.normalise(state);
        this.emit();
    }

    getState(): EncounterViewState {
        return this.state;
    }

    subscribe(listener: EncounterStateListener): () => void {
        this.listeners.add(listener);
        listener(this.state);
        return () => {
            this.listeners.delete(listener);
        };
    }

    setNotes(notes: string) {
        if (!this.state.session) return;
        if (this.state.session.notes === notes) return;
        this.state = {
            session: {
                ...this.state.session,
                notes,
            },
        };
        this.emit();
    }

    markResolved() {
        const session = this.state.session;
        if (!session) return;
        if (session.status === "resolved") return;
        this.state = {
            session: {
                ...session,
                status: "resolved",
                resolvedAt: this.deps.now(),
            },
        };
        this.emit();
    }

    reset() {
        if (!this.state.session) return;
        this.state = { session: null };
        this.emit();
    }

    private applyEvent(event: EncounterEvent) {
        const prev = this.state.session;
        if (!prev || prev.event.id !== event.id) {
            // New encounter: wipe notes/resolution state.
            this.state = {
                session: {
                    event,
                    notes: "",
                    status: "pending",
                },
            };
        } else {
            // Same encounter (e.g. view reopened) → keep notes/resolution.
            this.state = {
                session: {
                    ...prev,
                    event,
                },
            };
        }
        this.emit();
    }

    private emit() {
        for (const listener of [...this.listeners]) {
            listener(this.state);
        }
    }

    private static normalise(initial?: EncounterPersistedState | null): EncounterPersistedState {
        if (!initial || !initial.session || !initial.session.event) {
            return { session: null };
        }
        const { event, notes, status, resolvedAt } = initial.session;
        return {
            session: {
                event,
                notes: notes ?? "",
                status: status === "resolved" ? "resolved" : "pending",
                resolvedAt: resolvedAt ?? null,
            },
        };
    }
}

// Convenience helper for tests & manual triggers.
export function publishManualEncounter(event: Omit<EncounterEvent, "source">) {
    publishEncounterEvent({ ...event, source: "manual" });
}
