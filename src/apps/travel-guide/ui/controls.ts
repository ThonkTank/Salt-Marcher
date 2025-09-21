// src/apps/travel-guide/ui/controls.ts
// Playback-Buttons (Play/Pause/Reset) unter dem Header. Kapselt nur DOM + Button-State.

import { setIcon } from "obsidian";
import { applyMapButtonStyle } from "../../../ui/map-workflows";
import type { LogicStateSnapshot } from "../domain/types";

export type PlaybackControlsCallbacks = {
    onPlay: () => void | Promise<void>;
    onPause: () => void | Promise<void>;
    onReset: () => void | Promise<void>;
};

export type PlaybackControlsHandle = {
    readonly root: HTMLElement;
    setState(state: Pick<LogicStateSnapshot, "playing" | "route">): void;
    destroy(): void;
};

export function createPlaybackControls(
    host: HTMLElement,
    callbacks: PlaybackControlsCallbacks,
): PlaybackControlsHandle {
    const root = host.createDiv({ cls: "sm-travel-guide__controls" });
    const inner = root.createDiv({ cls: "sm-tg-controls__inner" });

    const playBtn = inner.createEl("button", {
        cls: "sm-tg-controls__btn sm-tg-controls__btn--play",
        text: "Play",
    });
    setIcon(playBtn, "play");
    applyMapButtonStyle(playBtn);
    playBtn.addEventListener("click", (ev) => {
        ev.preventDefault();
        if (playBtn.disabled) return;
        void callbacks.onPlay?.();
    });

    const pauseBtn = inner.createEl("button", {
        cls: "sm-tg-controls__btn sm-tg-controls__btn--pause",
        text: "Pause",
    });
    setIcon(pauseBtn, "pause");
    applyMapButtonStyle(pauseBtn);
    pauseBtn.addEventListener("click", (ev) => {
        ev.preventDefault();
        if (pauseBtn.disabled) return;
        void callbacks.onPause?.();
    });

    const resetBtn = inner.createEl("button", {
        cls: "sm-tg-controls__btn sm-tg-controls__btn--reset",
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
        pauseBtn.disabled = !state.playing;
        resetBtn.disabled = !hasRoute && !state.playing;
    };

    setState({ playing: false, route: [] });

    const destroy = () => {
        playBtn.replaceWith();
        pauseBtn.replaceWith();
        resetBtn.replaceWith();
        root.remove();
    };

    return {
        root,
        setState,
        destroy,
    };
}
