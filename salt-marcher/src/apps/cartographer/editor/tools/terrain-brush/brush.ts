// src/apps/cartographer/editor/tools/terrain-brush/brush.ts
import type { App, TFile } from "obsidian";
import type { RenderHandles } from "../../../../../core/hex-mapper/hex-render";
import { saveTile, deleteTile, loadTile } from "../../../../../core/hex-mapper/hex-notes";
import { coordsInRadius } from "./brush-math";
import { TERRAIN_COLORS } from "../../../../../core/terrain";
import type { ToolContext } from "../tools-api";
import { reportEditorToolIssue } from "../../editor-telemetry";

const ABORT_ERROR_NAME = "AbortError";

const createAbortError = () => {
    if (typeof DOMException === "function") {
        return new DOMException("Terrain brush application aborted", ABORT_ERROR_NAME);
    }
    const error = new Error("Terrain brush application aborted");
    error.name = ABORT_ERROR_NAME;
    return error;
};

const isAbortError = (error: unknown): boolean => {
    if (!error) return false;
    if (typeof DOMException === "function" && error instanceof DOMException) {
        return error.name === ABORT_ERROR_NAME;
    }
    return error instanceof Error && error.name === ABORT_ERROR_NAME;
};

type BrushOpts = {
    radius: number;               // 0 == nur die angeklickte Zelle
    terrain: string;              // z. B. "Wald" | "Meer" | "Berg" | ""
    region?: string;              // Region-Name (für Encounter/Zuordnung)
    mode?: "paint" | "erase";     // default: "paint"
};

/**
 * Wendet den Brush auf die Karte an:
 * - Verändert ausschließlich Zellen innerhalb des gegebenen Radius (odd-r Grid).
 * - "paint": legt Tiles an / aktualisiert Terrain + färbt live.
 * - "erase": löscht Tiles + setzt Fill transparent.
 * - Rollt UI- und Persistenzänderungen zurück, wenn während des Schreibens Fehler auftreten.
 * - Kein Re-Render; falls Bounds wachsen müssen, sollte der Aufrufer `ctx.refreshMap?.()` triggern.
 */
export type BrushExecutionContext = {
    tool?: ToolContext | null;
    toolName?: string | null;
};

export async function applyBrush(
    app: App,
    mapFile: TFile,
    center: { r: number; c: number },
    opts: BrushOpts,
    handles: RenderHandles,
    context?: BrushExecutionContext
): Promise<void> {
    const mode = opts.mode ?? "paint";
    const radius = Math.max(0, opts.radius | 0);

    // Nur Koordinaten im Radius (optional dedup, falls Odd-R-Shift Duplikate erzeugt)
    const raw = coordsInRadius(center, radius);
    const targets = new Map<string, { r: number; c: number }>();
    for (const coord of raw) {
        targets.set(`${coord.r},${coord.c}`, coord);
    }

    const applied: Array<{
        coord: { r: number; c: number };
        rollback: () => Promise<void> | void;
        restoreFill: () => void;
    }> = [];

    const tool = context?.tool ?? null;
    const toolName = context?.toolName ?? "brush";
    const abortSignal = tool?.getAbortSignal?.() ?? null;

    const throwIfAborted = () => {
        if (!abortSignal) return;
        if (abortSignal.aborted) {
            throw createAbortError();
        }
    };

    const getFillSnapshot = (coord: { r: number; c: number }) => {
        const key = `${coord.r},${coord.c}`;
        const poly = handles.polyByCoord.get(key);
        if (!poly) return "transparent";
        const styleFill = (poly.style as CSSStyleDeclaration | undefined)?.fill;
        const attrFill = poly.getAttribute("fill");
        const value = styleFill ?? attrFill;
        return value && value.trim().length > 0 ? value : "transparent";
    };

    try {
        throwIfAborted();
        for (const coord of targets.values()) {
            throwIfAborted();
            const key = `${coord.r},${coord.c}`;
            const previousFill = getFillSnapshot(coord);
            const previousData = await loadTile(app, mapFile, coord).catch((error) => {
                console.error(`[terrain-brush] failed to load tile ${key} before applying brush`, error);
                return null;
            });

            throwIfAborted();

            if (mode === "erase") {
                await deleteTile(app, mapFile, coord);
                handles.setFill(coord, "transparent");

                applied.push({
                    coord,
                    rollback: async () => {
                        if (!previousData) return;
                        await saveTile(app, mapFile, coord, previousData);
                    },
                    restoreFill: () => {
                        handles.setFill(coord, previousFill);
                    },
                });
                continue;
            }

            const terrain = opts.terrain ?? "";
            const region = opts.region ?? "";
            await saveTile(app, mapFile, coord, { terrain, region });
            const color = TERRAIN_COLORS[terrain] ?? "transparent";
            handles.setFill(coord, color);

            applied.push({
                coord,
                rollback: async () => {
                    if (!previousData) {
                        await deleteTile(app, mapFile, coord);
                        return;
                    }
                    await saveTile(app, mapFile, coord, previousData);
                },
                restoreFill: () => {
                    handles.setFill(coord, previousFill);
                },
            });

            throwIfAborted();
        }
    } catch (error) {
        const aborted = isAbortError(error);
        if (!aborted) {
            console.error("[terrain-brush] applyBrush failed", error);
        }
        for (const step of applied.reverse()) {
            try {
                step.restoreFill();
            } catch (restoreErr) {
                console.error("[terrain-brush] failed to restore hex fill", restoreErr);
            }
            try {
                await step.rollback();
            } catch (rollbackErr) {
                console.error("[terrain-brush] failed to rollback tile changes", rollbackErr);
            }
        }

        if (!aborted) {
            const message = reportEditorToolIssue({
                stage: "operation",
                toolId: toolName ?? "brush",
                error,
            });
            try {
                tool?.setStatus(message);
            } catch (statusErr) {
                console.error("[terrain-brush] failed to publish tool status", statusErr);
            }

            throw error;
        }
    }
}
