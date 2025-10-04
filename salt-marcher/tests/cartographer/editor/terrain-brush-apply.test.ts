// salt-marcher/tests/cartographer/editor/terrain-brush-apply.test.ts
// Verifiziert Fehlerbehandlung und Rollback des Terrain-Brush beim Anwenden auf Hexfelder.
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { App, TFile } from "obsidian";
import type { RenderHandles } from "../../../src/core/hex-mapper/hex-render";
import {
    applyBrush,
    type BrushExecutionContext,
    type BrushToolAdapter,
} from "../../../src/apps/cartographer/editor/tools/terrain-brush/brush-core";

const telemetryMocks = vi.hoisted(() => ({
    reportEditorToolIssue: vi.fn(() => "issue:operation:Brush"),
}));

const noteMocks = vi.hoisted(() => ({
    saveTile: vi.fn(),
    deleteTile: vi.fn(),
    loadTile: vi.fn(),
}));

vi.mock("../../../src/apps/cartographer/editor/editor-telemetry", () => telemetryMocks);
vi.mock("../../../src/core/hex-mapper/hex-notes", () => noteMocks);

const { reportEditorToolIssue } = telemetryMocks;
const { saveTile, deleteTile, loadTile } = noteMocks;

const SVG_NS = "http://www.w3.org/2000/svg";

type TestHandles = RenderHandles & { colors: Map<string, string> };

const createHandles = (initial: Record<string, string>): TestHandles => {
    const svg = document.createElementNS(SVG_NS, "svg");
    const contentG = document.createElementNS(SVG_NS, "g");
    const overlay = document.createElementNS(SVG_NS, "rect");
    const polyByCoord = new Map<string, SVGPolygonElement>();
    const colors = new Map<string, string>();

    for (const [key, color] of Object.entries(initial)) {
        const poly = document.createElementNS(SVG_NS, "polygon");
        (poly.style as CSSStyleDeclaration).fill = color;
        polyByCoord.set(key, poly);
        colors.set(key, color);
    }

    const setFill = vi.fn((coord: { r: number; c: number }, color: string) => {
        const key = `${coord.r},${coord.c}`;
        let poly = polyByCoord.get(key);
        if (!poly) {
            poly = document.createElementNS(SVG_NS, "polygon");
            polyByCoord.set(key, poly);
        }
        (poly.style as CSSStyleDeclaration).fill = color;
        colors.set(key, color);
    });

    return {
        svg,
        contentG,
        overlay,
        polyByCoord,
        setFill,
        ensurePolys: () => {},
        setInteractionDelegate: () => {},
        destroy: () => {},
        colors,
    } satisfies TestHandles;
};

const createToolAdapter = (signal: AbortSignal | null = null): BrushToolAdapter & {
    setStatus: ReturnType<typeof vi.fn>;
} => ({
    getAbortSignal: () => signal,
    setStatus: vi.fn(),
});

const createExecutionContext = (tool: BrushToolAdapter | null): BrushExecutionContext => ({
    tool,
    toolName: "Brush",
});

describe("applyBrush", () => {
    const app = {} as App;
    const mapFile = { path: "map.md" } as unknown as TFile;

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("rolls back painted tiles and fills when a save fails", async () => {
        const handles = createHandles({ "0,0": "#0288d1" });
        const tool = createToolAdapter();
        const error = new Error("save failed");

        loadTile.mockResolvedValueOnce({ terrain: "Meer", region: "Old" });
        loadTile.mockResolvedValueOnce(null);
        saveTile.mockResolvedValueOnce({} as TFile);
        saveTile.mockRejectedValueOnce(error);

        await expect(
            applyBrush(
                app,
                mapFile,
                { r: 0, c: 0 },
                { radius: 1, terrain: "Wald", mode: "paint" },
                handles,
                createExecutionContext(tool)
            )
        ).rejects.toThrow(error);

        expect(reportEditorToolIssue).toHaveBeenCalledWith({
            stage: "operation",
            toolId: "Brush",
            error,
        });
        expect(tool.setStatus).toHaveBeenCalledWith("issue:operation:Brush");

        expect(handles.colors.get("0,0")).toBe("#0288d1");
        expect(saveTile).toHaveBeenNthCalledWith(3, app, mapFile, { r: 0, c: 0 }, { terrain: "Meer", region: "Old" });
        expect(deleteTile).not.toHaveBeenCalled();
    });

    it("restores deleted tiles when an erase fails", async () => {
        const handles = createHandles({ "0,0": "#0288d1" });
        const tool = createToolAdapter();
        const error = new Error("delete failed");

        loadTile.mockResolvedValueOnce({ terrain: "Meer", region: "Old" });
        loadTile.mockResolvedValueOnce({ terrain: "Wald", region: "Alt" });
        deleteTile.mockResolvedValueOnce();
        deleteTile.mockRejectedValueOnce(error);
        saveTile.mockResolvedValue({} as TFile);

        await expect(
            applyBrush(
                app,
                mapFile,
                { r: 0, c: 0 },
                { radius: 1, terrain: "", mode: "erase" },
                handles,
                createExecutionContext(tool)
            )
        ).rejects.toThrow(error);

        expect(reportEditorToolIssue).toHaveBeenCalledWith({
            stage: "operation",
            toolId: "Brush",
            error,
        });
        expect(tool.setStatus).toHaveBeenCalledWith("issue:operation:Brush");

        expect(handles.colors.get("0,0")).toBe("#0288d1");
        expect(saveTile).toHaveBeenCalledWith(app, mapFile, { r: 0, c: 0 }, { terrain: "Meer", region: "Old" });
    });

    it("applies changes without telemetry when all operations succeed", async () => {
        const handles = createHandles({ "0,0": "transparent" });
        const tool = createToolAdapter();

        loadTile.mockResolvedValue(null);
        saveTile.mockResolvedValue({} as TFile);

        await applyBrush(
            app,
            mapFile,
            { r: 0, c: 0 },
            { radius: 0, terrain: "Wald", mode: "paint" },
            handles,
            createExecutionContext(tool)
        );

        expect(reportEditorToolIssue).not.toHaveBeenCalled();
        expect(tool.setStatus).not.toHaveBeenCalled();
        expect(handles.colors.get("0,0")).toBe("#2e7d32");
    });

    it("returns early without side effects when the context signal is already aborted", async () => {
        const handles = createHandles({ "0,0": "transparent" });
        const controller = new AbortController();
        controller.abort();
        const tool = createToolAdapter(controller.signal);

        await expect(
            applyBrush(
                app,
                mapFile,
                { r: 0, c: 0 },
                { radius: 0, terrain: "Wald", mode: "paint" },
                handles,
                createExecutionContext(tool)
            )
        ).resolves.toBeUndefined();

        expect(loadTile).not.toHaveBeenCalled();
        expect(saveTile).not.toHaveBeenCalled();
        expect(deleteTile).not.toHaveBeenCalled();
        expect(reportEditorToolIssue).not.toHaveBeenCalled();
        expect(tool.setStatus).not.toHaveBeenCalled();
        expect(handles.colors.get("0,0")).toBe("transparent");
    });

    it("rolls back changes and suppresses telemetry when the operation aborts mid-application", async () => {
        const handles = createHandles({ "0,0": "transparent" });
        const controller = new AbortController();
        const tool = createToolAdapter(controller.signal);

        loadTile.mockResolvedValue(null);
        saveTile.mockImplementationOnce(async () => {
            controller.abort();
            return {} as TFile;
        });

        await expect(
            applyBrush(
                app,
                mapFile,
                { r: 0, c: 0 },
                { radius: 1, terrain: "Wald", mode: "paint" },
                handles,
                createExecutionContext(tool)
            )
        ).resolves.toBeUndefined();

        expect(loadTile).toHaveBeenCalledTimes(1);
        expect(saveTile).toHaveBeenCalledTimes(1);
        expect(handles.colors.get("0,0")).toBe("transparent");
        expect(reportEditorToolIssue).not.toHaveBeenCalled();
        expect(tool.setStatus).not.toHaveBeenCalled();
    });
});
