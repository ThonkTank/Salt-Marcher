// src/apps/travel-guide/ui/controls.ts
// Playback-Buttons (Start/Stopp/Reset) im Sidebar-Controls-Host. Kapselt nur DOM + Button-State.

import { setIcon } from "obsidian";
import { applyMapButtonStyle } from "../../../../ui/map-workflows";
import type { LogicStateSnapshot } from "../domain/types";

export type PlaybackControlsCallbacks = {
    onPlay: () => void | Promise<void>;
    onStop: () => void | Promise<void>;
    onReset: () => void | Promise<void>;
    onTempoChange?: (tempo: number) => void | Promise<void>;
};

export type PlaybackControlsHandle = {
    readonly root: HTMLElement;
    setState(state: Pick<LogicStateSnapshot, "playing" | "route">): void;
    setClock(hours: number): void;
    setTempo(tempo: number): void;
    destroy(): void;
};

export function createPlaybackControls(host: HTMLElement, callbacks: PlaybackControlsCallbacks): PlaybackControlsHandle {
    const root = host.createDiv({ cls: "sm-cartographer__travel-buttons" });

    // Clock display
    const clock = root.createEl("div", { cls: "sm-cartographer__travel-clock", text: "00h" });

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

    // Tempo slider (x0.1 .. x10)
    const tempoWrap = root.createDiv({ cls: "sm-cartographer__travel-tempo" });
    const tempoLabel = tempoWrap.createSpan({ text: "x1.0" });
    const tempoInput = tempoWrap.createEl("input", {
        type: "range",
        attr: { min: "0.1", max: "10", step: "0.1" },
    }) as HTMLInputElement;
    tempoInput.value = "1";
    tempoInput.oninput = () => {
        const v = Math.max(0.1, Math.min(10, parseFloat(tempoInput.value) || 1));
        tempoLabel.setText(`x${v.toFixed(1)}`);
        callbacks.onTempoChange?.(v);
    };

    const setState = (state: Pick<LogicStateSnapshot, "playing" | "route">) => {
        const hasRoute = state.route.length > 0;
        playBtn.disabled = state.playing || !hasRoute;
        stopBtn.disabled = !state.playing;
        resetBtn.disabled = !hasRoute && !state.playing;
    };

    setState({ playing: false, route: [] });

    const setClock = (hours: number) => {
        const h = Math.floor(hours);
        clock.setText(`${h}h`);
    };

    const setTempo = (tempo: number) => {
        const v = Math.max(0.1, Math.min(10, tempo));
        tempoInput.value = String(v);
        tempoLabel.setText(`x${v.toFixed(1)}`);
    };

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
        setClock,
        setTempo,
    };
}
