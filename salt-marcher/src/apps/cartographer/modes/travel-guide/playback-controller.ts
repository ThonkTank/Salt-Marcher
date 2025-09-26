import type { Sidebar } from "../../travel/ui/sidebar";
import {
    createPlaybackControls,
    type PlaybackControlsHandle,
} from "../../travel/ui/controls";
import type { LogicStateSnapshot, RouteNode } from "../../travel/domain/types";

export interface PlaybackDriver {
    play(): Promise<void> | void;
    pause(): Promise<void> | void;
    reset(): Promise<void> | void;
    setTempo?(value: number): void;
}

export class TravelPlaybackController {
    private handle: PlaybackControlsHandle | null = null;

    mount(host: Sidebar, driver: PlaybackDriver) {
        this.dispose();
        this.handle = createPlaybackControls(host.controlsHost, {
            onPlay: () => void driver.play(),
            onStop: () => void driver.pause(),
            onReset: () => void driver.reset(),
            onTempoChange: (value) => driver.setTempo?.(value),
        });
        this.reset();
    }

    sync(state: LogicStateSnapshot) {
        if (!this.handle) return;
        this.handle.setState({ playing: state.playing, route: state.route });
        (this.handle as any)?.setClock?.(state.clockHours ?? 0);
        (this.handle as any)?.setTempo?.(state.tempo ?? 1);
    }

    reset() {
        this.handle?.setState({ playing: false, route: [] as RouteNode[] });
    }

    dispose() {
        this.handle?.destroy();
        this.handle = null;
    }
}
