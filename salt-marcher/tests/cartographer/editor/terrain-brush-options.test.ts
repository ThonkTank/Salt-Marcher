// salt-marcher/tests/cartographer/editor/terrain-brush-options.test.ts
// Prüft das Terrain-Brush-Panel auf DOM-Setup und Brush-Interaktionen.
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { App } from "obsidian";
import type { RenderHandles } from "../../../src/core/hex-mapper/hex-render";
import {
    mountBrushPanel,
    type BrushPanelContext,
} from "../../../src/apps/cartographer/editor/tools/terrain-brush/brush-options";

const ensureObsidianDomHelpers = () => {
    const proto = HTMLElement.prototype as any;
    if (!proto.createEl) {
        proto.createEl = function (tag: string, options?: { text?: string; cls?: string; attr?: Record<string, string> }) {
            const el = document.createElement(tag);
            if (options?.text) el.textContent = options.text;
            if (options?.cls) {
                for (const cls of options.cls.split(/\s+/).filter(Boolean)) {
                    el.classList.add(cls);
                }
            }
            if (options?.attr) {
                for (const [key, value] of Object.entries(options.attr)) {
                    el.setAttribute(key, value);
                }
            }
            this.appendChild(el);
            return el;
        };
    }
    if (!proto.createDiv) {
        proto.createDiv = function (options?: { text?: string; cls?: string; attr?: Record<string, string> }) {
            return this.createEl("div", options);
        };
    }
    if (!proto.empty) {
        proto.empty = function () {
            while (this.firstChild) {
                this.removeChild(this.firstChild);
            }
            return this;
        };
    }
    if (!proto.toggleClass) {
        proto.toggleClass = function (className: string, force?: boolean) {
            const shouldHave = force ?? !this.classList.contains(className);
            this.classList.toggle(className, shouldHave);
            return this;
        };
    }
    if (!proto.setText) {
        proto.setText = function (text: string) {
            this.textContent = text;
            return this;
        };
    }
    if (!proto.setAttr) {
        proto.setAttr = function (name: string, value: string) {
            this.setAttribute(name, value);
            return this;
        };
    }
};

beforeAll(() => {
    ensureObsidianDomHelpers();
});

const loadRegions = vi.fn();
const applyBrush = vi.fn(() => Promise.resolve());

vi.mock("../../../src/apps/cartographer/editor/tools/terrain-brush/brush-core", async () => {
    const actual = await vi.importActual<
        typeof import("../../../src/apps/cartographer/editor/tools/terrain-brush/brush-core")
    >("../../../src/apps/cartographer/editor/tools/terrain-brush/brush-core");
    return {
        ...actual,
        applyBrush: (...args: unknown[]) => applyBrush(...args),
    };
});

vi.mock("../../../src/core/regions-store", () => ({
    loadRegions: (...args: unknown[]) => loadRegions(...args),
}));

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
        loadRegions.mockReset();
        applyBrush.mockReset();
    });

    it("populates regions, tracks terrain, and resets when selections disappear", async () => {
        const listeners: Record<string, () => void> = {};
        loadRegions.mockResolvedValueOnce([
            { name: "Forest", terrain: "forest" },
            { name: "Coast", terrain: "coast" },
        ]);
        const workspace = {
            on: vi.fn((event: string, handler: () => void) => {
                listeners[event] = handler;
                return `${event}-token`;
            }),
            offref: vi.fn(),
        };
        const ctx: BrushPanelContext = {
            app: { workspace } as unknown as App,
            getFile: () => null,
            getHandles: () => null,
            getOptions: () => null,
            getAbortSignal: () => null,
            setStatus: () => {},
        };

        const root = document.createElement("div");
        const controls = mountBrushPanel(root, ctx);
        await flushPromises();

        const selects = root.querySelectorAll("select");
        const regionSelect = selects[0] as HTMLSelectElement;
        expect(regionSelect.options.length).toBe(3);

        regionSelect.value = "Forest";
        regionSelect.onchange?.(new Event("change"));
        expect(regionSelect.selectedOptions[0].dataset.terrain).toBe("forest");

        loadRegions.mockResolvedValueOnce([]);
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
        loadRegions.mockReturnValueOnce(pending as unknown as Promise<unknown>);
        const ctx: BrushPanelContext = {
            app: { workspace: {} } as unknown as App,
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
        loadRegions.mockResolvedValue([]);
        const handles = createHandles();
        const ctx: BrushPanelContext = {
            app: { workspace: {} } as unknown as App,
            getFile: () => ({ path: "map.md" }) as any,
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
