// src/apps/encounter/session-store.ts
// Lightweight pub/sub store bridging travel events and the encounter workspace.
// Keeps the most recent encounter payload so that freshly mounted presenters can
// render the last travel hand-off without waiting for another event.

import type { Coord } from "../cartographer/travel/domain/types";

export type EncounterEventSource = "travel" | "manual";

export interface EncounterEvent {
    /** Stable identifier for deduplication across store/presenter instances. */
    readonly id: string;
    /** Origin of the encounter (e.g. travel hand-off). */
    readonly source: EncounterEventSource;
    /** ISO timestamp of the triggering moment. */
    readonly triggeredAt: string;
    readonly coord: Coord | null;
    readonly regionName?: string;
    readonly mapPath?: string;
    readonly mapName?: string;
    readonly encounterOdds?: number;
    readonly travelClockHours?: number;
}

export type EncounterEventListener = (event: EncounterEvent) => void;

let latestEvent: EncounterEvent | null = null;
const listeners = new Set<EncounterEventListener>();

export function publishEncounterEvent(event: EncounterEvent) {
    latestEvent = event;
    for (const listener of [...listeners]) {
        try {
            listener(event);
        } catch (err) {
            console.error("[encounter] listener failed", err);
        }
    }
}

export function subscribeToEncounterEvents(listener: EncounterEventListener): () => void {
    listeners.add(listener);
    if (latestEvent) {
        try {
            listener(latestEvent);
        } catch (err) {
            console.error("[encounter] listener failed", err);
        }
    }
    return () => {
        listeners.delete(listener);
    };
}

export function peekLatestEncounterEvent(): EncounterEvent | null {
    return latestEvent;
}

// Test utility to avoid leaking state between vitest runs. Not exported publicly
// in bundles (tree-shaken when unused in production code).
export function __resetEncounterEventStore() {
    latestEvent = null;
    listeners.clear();
}
