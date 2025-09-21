// src/apps/map-editor/tools-api.ts
import type { App, TFile } from "obsidian";
import type { RenderHandles } from "../../../core/hex-mapper/hex-render";
import type { HexOptions } from "../../../core/options";

export type CleanupFn = () => void;

export type ToolContext = {
    app: App;
    getFile(): TFile | null;
    getHandles(): RenderHandles | null;
    getOpts(): HexOptions;
    setStatus(msg: string): void;          // optional: Status-/Tooltip-Ausgabe
    refreshMap?: () => Promise<void>;      // NEU: kompletten Re-Render anstoßen (z. B. nach Brush)
};

export type ToolModule = {
    id: "brush" | "inspektor" | string;
    label: string;
    /** Panel in den Options-Bereich mounten; Rückgabe: Cleanup */
    mountPanel(root: HTMLElement, ctx: ToolContext): CleanupFn;
    /** Aktivierung/Deaktivierung (z. B. Kreis anzeigen/verstecken) */
    onActivate?(ctx: ToolContext): void;
    onDeactivate?(ctx: ToolContext): void;
    /** Nach Karten-Render (Handles verfügbar) */
    onMapRendered?(ctx: ToolContext): void;
    /** Hex-Klick abfangen. true = handled (Editor öffnet nichts mehr) */
    onHexClick?(rc: { r: number; c: number }, ctx: ToolContext): Promise<boolean> | boolean;
};
