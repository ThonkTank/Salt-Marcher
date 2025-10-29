// salt-marcher/tests/cartographer/editor/terrain-brush-options.test.ts
// Prüft das Terrain-Brush-Panel auf DOM-Setup und Brush-Interaktionen.
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { App } from "obsidian";
import type { RenderHandles } from "src/features/maps/hex-mapper/hex-render";
import {
    mountBrushPanel,
    type BrushPanelContext,
} from "src/workmodes/cartographer/editor/tools/terrain-brush/brush-options";
import { createMockApp, createMockTFile } from "../../../mocks/obsidian-api";

vi.mock("src/workmodes/cartographer/editor/tools/terrain-brush/brush-core", async () => {
    const actual = await vi.importActual<
        typeof import("src/workmodes/cartographer/editor/tools/terrain-brush/brush-core")
    >("src/workmodes/cartographer/editor/tools/terrain-brush/brush-core");
    return {
        ...actual,
        applyBrush: vi.fn(() => Promise.resolve()),
    };
});

vi.mock("src/features/maps/data/region-repository", () => ({
    loadRegions: vi.fn(),
}));

vi.mock("src/workmodes/library/storage/data-sources", () => ({
    LIBRARY_DATA_SOURCES: {
        factions: {
            list: vi.fn(() => Promise.resolve([])),
            load: vi.fn(),
        },
    },
}));

import { loadRegions } from "src/features/maps/data/region-repository";
import { applyBrush } from "src/workmodes/cartographer/editor/tools/terrain-brush/brush-core";

const flushPromises = async () => {
    await Promise.resolve();
    await Promise.resolve();
};

const svgNS = "http://www.w3.org/2000/svg";

const createHandles = (): RenderHandles => ({
    svg: document.createElementNS(svgNS, "svg"),
    contentG: document.createElementNS(svgNS, "g"),
    overlay: document.createElementNS(svgNS, "rect"),
    polyByCoord: new Map(),
    setFill: vi.fn(),
    ensurePolys: vi.fn(),
    setInteractionDelegate: vi.fn(),
    destroy: vi.fn(),
});

describe("terrain brush panel", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("populates regions, tracks terrain, and resets when selections disappear", async () => {
        const listeners: Record<string, () => void> = {};
        vi.mocked(loadRegions).mockResolvedValue([
            { name: "Forest", terrain: "forest" },
            { name: "Coast", terrain: "coast" },
        ]);
        const app = createMockApp();
        const workspace = {
            on: vi.fn((event: string, handler: () => void) => {
                listeners[event] = handler;
                return `${event}-token`;
            }),
            offref: vi.fn(),
        };
        app.workspace = workspace as any;

        const ctx: BrushPanelContext = {
            app,
            getFile: () => null,
            getHandles: () => null,
            getOptions: () => null,
            getAbortSignal: () => null,
            setStatus: () => {},
        };

        const root = document.createElement("div");
        const controls = mountBrushPanel(root, ctx);

        // Wait for BOTH fillOptions AND fillFactions to complete
        // They both run async and use the same fillSeq counter
        await flushPromises();
        await flushPromises();
        await flushPromises();

        expect(loadRegions).toHaveBeenCalled();

        const selects = root.querySelectorAll("select");
        const regionSelect = selects[0] as HTMLSelectElement;
        expect(regionSelect.options.length).toBe(3);

        regionSelect.value = "Forest";
        regionSelect.dispatchEvent(new Event("change"));
        expect(regionSelect.selectedOptions[0].dataset.terrain).toBe("forest");

        vi.mocked(loadRegions).mockResolvedValue([]);
        listeners["salt:regions-updated"]?.();
        await flushPromises();

        expect(regionSelect.value).toBe("");
        expect(regionSelect.options.length).toBe(1);

        controls.destroy();
        expect(workspace.offref).toHaveBeenCalledWith("salt:terrains-updated-token");
        expect(workspace.offref).toHaveBeenCalledWith("salt:regions-updated-token");
    });

    it("cancels dropdown updates when the lifecycle signal aborts", async () => {
        const abortController = new AbortController();
        let resolveRegions: ((value: unknown) => void) | null = null;
        const pending = new Promise((resolve) => {
            resolveRegions = resolve;
        });
        vi.mocked(loadRegions).mockReturnValueOnce(pending as unknown as Promise<unknown>);
        const app = createMockApp();
        const ctx: BrushPanelContext = {
            app,
            getFile: () => null,
            getHandles: () => null,
            getOptions: () => null,
            getAbortSignal: () => abortController.signal,
            setStatus: () => {},
        };

        const root = document.createElement("div");
        void mountBrushPanel(root, ctx);
        abortController.abort();
        resolveRegions?.([]);
        await flushPromises();

        const regionSelect = root.querySelector("select") as HTMLSelectElement;
        expect(regionSelect.options.length).toBe(0);
    });

    it("ensures missing polygons before applying brush actions", async () => {
        vi.mocked(loadRegions).mockResolvedValue([]);
        const handles = createHandles();
        const app = createMockApp({
            initialFiles: {
                "map.md": "---\nfolder: Hexes\n---\n# Map",
            },
        });
        const mapFile = createMockTFile("map.md");
        const ctx: BrushPanelContext = {
            app,
            getFile: () => mapFile,
            getHandles: () => handles,
            getOptions: () => ({ radius: 42 } as any),
            getAbortSignal: () => null,
            setStatus: () => {},
        };

        const root = document.createElement("div");
        const controls = mountBrushPanel(root, ctx);
        await flushPromises();

        const ensurePolys = vi.spyOn(handles, "ensurePolys");

        const coord = { r: 0, c: 0 };
        await controls.handleHexClick(coord);

        expect(ensurePolys).toHaveBeenCalled();
        expect(applyBrush).toHaveBeenCalledWith(
            ctx.app,
            ctx.getFile(),
            coord,
            expect.objectContaining({
                mode: expect.any(String),
            }),
            handles,
            expect.objectContaining({
                tool: expect.objectContaining({
                    getAbortSignal: expect.any(Function),
                    setStatus: expect.any(Function),
                }),
                toolName: "Brush",
            })
        );
    });
});
