// src/workmodes/session-runner/view/controllers/playback-controller.ts
// Steuert Wiedergabe-UI des Reise-Modus.
import type { LogicStateSnapshot, RouteNode } from "../../travel/engine/travel-engine-types";
import type { Sidebar } from "../../travel/ui/sidebar";

export interface PlaybackDriver {
    play(): Promise<void> | void;
    pause(): Promise<void> | void;
    reset(): Promise<void> | void;
    setTempo?(value: number): void;
    onRandomEncounter?(): Promise<void> | void;
}

export class TravelPlaybackController {
    private sidebar: Sidebar | null = null;

    mount(host: Sidebar, driver: PlaybackDriver) {
        this.dispose();
        this.sidebar = host;
        // Sidebar now handles playback controls internally via travel-controls
        // No need to create controls separately anymore
        this.reset();
    }

    sync(state: LogicStateSnapshot) {
        if (!this.sidebar) return;
        this.sidebar.setPlaybackState({ playing: state.playing, route: state.route, tokenCoord: state.tokenCoord });

        // Note: Timestamp display is updated via sidebar.refreshCalendar() in onTimeAdvance callback
        // (experience.ts:650). No need to update here as it would show stale cached data.

        this.sidebar.setTempo(state.tempo ?? 1);
    }

    reset() {
        if (!this.sidebar) return;
        this.sidebar.setPlaybackState({ playing: false, route: [] as RouteNode[], tokenCoord: { q: 0, r: 0 } });
    }

    dispose() {
        this.sidebar = null;
    }
}
