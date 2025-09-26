// src/apps/cartographer/editor/tools/tools-api.ts
import type { App, TFile } from "obsidian";
import type { RenderHandles } from "../../../../core/hex-mapper/hex-render";
import type { HexOptions } from "../../../../core/options";

export type CleanupFn = () => void;

export type ToolContext = {
    app: App;
    getFile(): TFile | null;
    getHandles(): RenderHandles | null;
    getOptions(): HexOptions | null;
    /**
     * Provides the lifecycle abort signal for the hosting editor mode. Tools can use this to
     * short-circuit async work (e.g. dropdown reloads) once the mode transitions away.
     */
    getAbortSignal(): AbortSignal | null;
    setStatus(msg: string): void;          // optional: Status-/Tooltip-Ausgabe
};

export type ToolModule = {
    id: "brush" | string;
    label: string;
    /** Panel in den Options-Bereich mounten; Rückgabe: Cleanup */
    mountPanel(root: HTMLElement, ctx: ToolContext): CleanupFn;
    /** Aktivierung/Deaktivierung (z. B. Kreis anzeigen/verstecken) */
    onActivate?(ctx: ToolContext): void;
    onDeactivate?(ctx: ToolContext): void;
    /** Nach Karten-Render (Handles verfügbar) */
    onMapRendered?(ctx: ToolContext): void;
    /** Hex-Klick abfangen. true = handled (Editor öffnet nichts mehr) */
    onHexClick?(rc: { r: number; c: number }, ctx: ToolContext): Promise<boolean | void> | boolean | void;
};

export type ToolManager = {
    /** Returns the currently active tool (if any). */
    getActive(): ToolModule | null;
    /** Switches to the requested tool and initialises its panel lifecycle. */
    switchTo(id: string): Promise<void>;
    /** Notifies the active tool that render handles are available. */
    notifyMapRendered(): void;
    /** Performs a hard teardown of the active tool. */
    deactivate(): void;
    /** Aborts pending work and clears all internal state. */
    destroy(): void;
};
