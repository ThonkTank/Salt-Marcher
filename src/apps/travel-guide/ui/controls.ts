// src/apps/travel-guide/ui/controls.ts
// Playback-Buttons (Start/Stopp/Reset) im Sidebar-Controls-Host. Kapselt nur DOM + Button-State.

import { setIcon } from "obsidian";
import { applyMapButtonStyle } from "../../../ui/map-workflows";
import type { LogicStateSnapshot } from "../domain/types";

export type PlaybackControlsCallbacks = {
    onPlay: () => void | Promise<void>;
    onStop: () => void | Promise<void>;
    onReset: () => void | Promise<void>;
};

export type PlaybackControlsHandle = {
    readonly root: HTMLElement;
    setState(state: Pick<LogicStateSnapshot, "playing" | "route">): void;
    destroy(): void;
};

export function createPlaybackControls(host: HTMLElement, callbacks: PlaybackControlsCallbacks): PlaybackControlsHandle {
    const root = host.createDiv({ cls: "sm-cartographer__travel-buttons" });

    const playBtn = root.createEl("button", {
        cls: "sm-cartographer__travel-button sm-cartographer__travel-button--play",
        text: "Start",
    });
    setIcon(playBtn, "play");
    applyMapButtonStyle(playBtn);
    playBtn.addEventListener("click", (ev) => {
        ev.preventDefault();
        if (playBtn.disabled) return;
        void callbacks.onPlay?.();
    });

    const stopBtn = root.createEl("button", {
        cls: "sm-cartographer__travel-button sm-cartographer__travel-button--stop",
        text: "Stopp",
    });
    setIcon(stopBtn, "square");
    applyMapButtonStyle(stopBtn);
    stopBtn.addEventListener("click", (ev) => {
        ev.preventDefault();
        if (stopBtn.disabled) return;
        void callbacks.onStop?.();
    });

    const resetBtn = root.createEl("button", {
        cls: "sm-cartographer__travel-button sm-cartographer__travel-button--reset",
        text: "Reset",
    });
    setIcon(resetBtn, "rotate-ccw");
    applyMapButtonStyle(resetBtn);
    resetBtn.addEventListener("click", (ev) => {
        ev.preventDefault();
        if (resetBtn.disabled) return;
        void callbacks.onReset?.();
    });

    const setState = (state: Pick<LogicStateSnapshot, "playing" | "route">) => {
        const hasRoute = state.route.length > 0;
        playBtn.disabled = state.playing || !hasRoute;
        stopBtn.disabled = !state.playing;
        resetBtn.disabled = !hasRoute && !state.playing;
    };

    setState({ playing: false, route: [] });

    const destroy = () => {
        playBtn.replaceWith();
        stopBtn.replaceWith();
        resetBtn.replaceWith();
        root.remove();
    };

    return {
        root,
        setState,
        destroy,
    };
}
