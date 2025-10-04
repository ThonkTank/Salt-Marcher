// src/apps/cartographer/editor/tools/terrain-brush/brush-core.ts
// Kapselt Distanz- und Schreibhelfer des Terrain-Brush für Wiederverwendung im Editor.
import type { App, TFile } from "obsidian";
import { saveTile, deleteTile, loadTile } from "../../../../../core/hex-mapper/hex-notes";
import type { RenderHandles } from "../../../../../core/hex-mapper/hex-render";
import { TERRAIN_COLORS } from "../../../../../core/terrain";
import { reportEditorToolIssue } from "../../editor-telemetry";

export type BrushCoord = { r: number; c: number };

export type BrushOptions = {
    /** Hex-Radius (0 = nur das Zentrum). */
    radius: number;
    /** Terrain-Schlüssel zur Farbzuordnung. */
    terrain: string;
    /** Optionale Region, die dem Hex zugeordnet wird. */
    region?: string;
    /** Betriebsmodus – "paint" legt Tiles an, "erase" löscht sie. */
    mode?: "paint" | "erase";
};

export type BrushToolAdapter = {
    /** Liefert das aktuelle AbortSignal des Editor-Lifecycles. */
    getAbortSignal?: () => AbortSignal | null;
    /** Veröffentlicht Statusmeldungen im Panel. */
    setStatus?: (message: string) => void;
};

export type BrushExecutionContext = {
    tool?: BrushToolAdapter | null;
    toolName?: string | null;
};

// --- Odd-R (horizontal) ⇄ Axial Helpers ---
const oddRToAxial = (rc: BrushCoord): { q: number; r: number } => {
    const q = rc.c - ((rc.r - (rc.r & 1)) >> 1);
    return { q, r: rc.r };
};

const axialDistance = (a: { q: number; r: number }, b: { q: number; r: number }): number => {
    const dq = Math.abs(a.q - b.q);
    const dr = Math.abs(a.r - b.r);
    const ds = Math.abs((-a.q - a.r) - (-b.q - b.r));
    return Math.max(dq, dr, ds);
};

/**
 * Liefert die Odd-R-Distanz zwischen zwei Hex-Koordinaten.
 */
export const hexDistanceOddR = (a: BrushCoord, b: BrushCoord): number => {
    return axialDistance(oddRToAxial(a), oddRToAxial(b));
};

/**
 * Gibt alle Koordinaten innerhalb (inkl.) eines Radius im Odd-R-Grid zurück.
 * Sortierung: Distanz → Zeile → Spalte, stabil für Tests.
 */
export const coordsInRadius = (center: BrushCoord, radius: number): BrushCoord[] => {
    const out: BrushCoord[] = [];
    for (let dr = -radius; dr <= radius; dr++) {
        for (let dc = -radius; dc <= radius; dc++) {
            const r = center.r + dr;
            const c = center.c + dc + ((center.r & 1) ? Math.floor((dr + 1) / 2) : Math.floor(dr / 2));
            if (hexDistanceOddR(center, { r, c }) <= radius) {
                out.push({ r, c });
            }
        }
    }
    out.sort((A, B) => {
        const da = hexDistanceOddR(center, A);
        const db = hexDistanceOddR(center, B);
        if (da !== db) return da - db;
        if (A.r !== B.r) return A.r - B.r;
        return A.c - B.c;
    });
    return out;
};

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

/**
 * Wendet den Brush auf die Karte an und rollt Änderungen bei Fehlern zurück.
 */
export async function applyBrush(
    app: App,
    mapFile: TFile,
    center: BrushCoord,
    opts: BrushOptions,
    handles: RenderHandles,
    context?: BrushExecutionContext
): Promise<void> {
    const mode = opts.mode ?? "paint";
    const radius = Math.max(0, opts.radius | 0);
    const targets = new Map<string, BrushCoord>();
    for (const coord of coordsInRadius(center, radius)) {
        targets.set(`${coord.r},${coord.c}`, coord);
    }

    const applied: Array<{
        coord: BrushCoord;
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

    const getFillSnapshot = (coord: BrushCoord) => {
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
            if (typeof error === "object" && error) {
                (error as Record<string, unknown>).__smToolMessage = message;
            }
            try {
                tool?.setStatus?.(message);
            } catch (statusErr) {
                console.error("[terrain-brush] failed to publish tool status", statusErr);
            }
            throw error;
        }
    }
}
