// src/apps/cartographer/travel/infra/encounter-sync.ts
// Synchronisiert Travel-Playback mit Encounter-Events: liest Travel-State,
// pausiert Wiedergabe und öffnet Encounter-Ansicht sobald externe Ereignisse
// eintreffen oder Travel selbst eines auslöst.

import type { TFile } from "obsidian";
import type { LogicStateSnapshot } from "../domain/types";
import type { TravelEncounterContext } from "../../../encounter/event-builder";
import {
    peekLatestEncounterEvent,
    subscribeToEncounterEvents,
    type EncounterEvent,
} from "../../../encounter/session-store";

export type EncounterSync = {
    handleTravelEncounter(): Promise<void>;
    dispose(): void;
};

type Config = {
    getMapFile(): TFile | null;
    getState(): LogicStateSnapshot;
    pausePlayback(): void;
    openEncounter(context?: TravelEncounterContext): Promise<boolean>;
    onExternalEncounter?: (event: EncounterEvent) => boolean | void;
};

export function createEncounterSync(cfg: Config): EncounterSync {
    let disposed = false;
    let lastHandledId: string | null = peekLatestEncounterEvent()?.id ?? null;

    const unsubscribe = subscribeToEncounterEvents((event) => {
        if (disposed) return;
        if (event.id === lastHandledId) return;
        lastHandledId = event.id;
        if (event.source === "travel") {
            return;
        }
        cfg.pausePlayback();
        const shouldOpen = cfg.onExternalEncounter?.(event);
        if (shouldOpen === false) {
            return;
        }
        void cfg.openEncounter();
    });

    return {
        async handleTravelEncounter() {
            cfg.pausePlayback();
            const context: TravelEncounterContext = {
                mapFile: cfg.getMapFile(),
                state: cfg.getState(),
            };
            const ok = await cfg.openEncounter(context);
            if (!ok) return;
            const latest = peekLatestEncounterEvent();
            if (latest) {
                lastHandledId = latest.id;
            }
        },
        dispose() {
            if (disposed) return;
            disposed = true;
            unsubscribe();
        },
    };
}
