// salt-marcher/tests/cartographer/editor/editor-mode.test.ts
// Überprüft den Editor-Modus auf DOM-Aufbau und Karteninteraktion.
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { App, TFile } from "obsidian";
import type { CartographerModeLifecycleContext, HexCoord } from "../../../src/apps/cartographer/presenter";
import type { RenderHandles } from "../../../src/core/hex-mapper/hex-render";
import { createEditorMode } from "../../../src/apps/cartographer/modes/editor";

const ensureObsidianDomHelpers = () => {
    const proto = HTMLElement.prototype as any;
    if (!proto.createEl) {
        proto.createEl = function(tag: string, options?: { text?: string; cls?: string; attr?: Record<string, string> }) {
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
        proto.createDiv = function(options?: { text?: string; cls?: string; attr?: Record<string, string> }) {
            return this.createEl("div", options);
        };
    }
    if (!proto.empty) {
        proto.empty = function() {
            while (this.firstChild) {
                this.removeChild(this.firstChild);
            }
            return this;
        };
    }
    if (!proto.setText) {
        proto.setText = function(text: string) {
            this.textContent = text;
            return this;
        };
    }
    if (!proto.toggleClass) {
        proto.toggleClass = function(cls: string, force?: boolean) {
            this.classList.toggle(cls, force);
            return this;
        };
    }
};

beforeAll(() => {
    ensureObsidianDomHelpers();
});

beforeEach(() => {
    vi.clearAllMocks();
});

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

type ToolMock = {
    mountPanel: ReturnType<typeof vi.fn>;
    onActivate: ReturnType<typeof vi.fn>;
    onDeactivate: ReturnType<typeof vi.fn>;
    onMapRendered: ReturnType<typeof vi.fn>;
    onHexClick: ReturnType<typeof vi.fn>;
    cleanup: ReturnType<typeof vi.fn>;
};

const toolMock: ToolMock = (() => {
    const cleanup = vi.fn();
    return {
        mountPanel: vi.fn(() => cleanup),
        onActivate: vi.fn(),
        onDeactivate: vi.fn(),
        onMapRendered: vi.fn(),
        onHexClick: vi.fn(async () => true),
        cleanup,
    } satisfies ToolMock;
})();

vi.mock("../../../src/apps/cartographer/editor/tools/terrain-brush/brush-options", () => ({
    createBrushTool: () => ({
        id: "mock-tool",
        label: "Mock Tool",
        mountPanel: toolMock.mountPanel,
        onActivate: toolMock.onActivate,
        onDeactivate: toolMock.onDeactivate,
        onMapRendered: toolMock.onMapRendered,
        onHexClick: toolMock.onHexClick,
    }),
}));

const createLifecycleContext = (options: {
    app?: App;
    sidebarHost?: HTMLElement;
    signal?: AbortSignal;
    file?: TFile | null;
    handles?: RenderHandles | null;
}) => {
    const app: App = options.app ?? ({ workspace: {} } as any);
    const sidebar = options.sidebarHost ?? document.createElement("div");
    const signal = options.signal ?? new AbortController().signal;
    const file = options.file ?? null;
    const handles = options.handles ?? null;
    return {
        app,
        host: document.createElement("div"),
        mapHost: document.createElement("div"),
        sidebarHost: sidebar,
        signal,
        getFile: () => file,
        getMapLayer: () => null,
        getRenderHandles: () => handles,
        getOptions: () => null,
    } satisfies CartographerModeLifecycleContext;
};

describe("editor mode", () => {
    it("mounts panel UI and activates the default tool", async () => {
        const ctx = createLifecycleContext({});
        const mode = createEditorMode();
        const tool = toolMock;

        await mode.onEnter(ctx);

        expect(ctx.sidebarHost.querySelector(".sm-cartographer__panel"))
            .not.toBeNull();
        expect(tool.mountPanel).toHaveBeenCalledOnce();
        expect(tool.onActivate).toHaveBeenCalledOnce();
        expect(tool.onMapRendered).not.toHaveBeenCalled();

        const select = ctx.sidebarHost.querySelector("select") as HTMLSelectElement;
        expect(select.disabled).toBe(true);

        const file = { path: "map.md", basename: "map" } as TFile;
        const handles = createHandles();
        await mode.onFileChange(file, handles, createLifecycleContext({
            sidebarHost: ctx.sidebarHost,
            signal: ctx.signal,
            file,
            handles,
            app: ctx.app,
        }));

        expect(tool.onMapRendered).toHaveBeenCalledTimes(1);
        expect(select.disabled).toBe(false);
        const fileLabel = ctx.sidebarHost.querySelector(".sm-cartographer__panel-file");
        expect(fileLabel?.textContent).toBe("map");
    });

    it("tears down the active tool on exit and guards against aborted signals", async () => {
        const ctx = createLifecycleContext({});
        const mode = createEditorMode();
        const tool = toolMock;

        await mode.onEnter(ctx);

        const handles = createHandles();
        await mode.onFileChange(null, handles, createLifecycleContext({
            sidebarHost: ctx.sidebarHost,
            signal: ctx.signal,
            handles,
            app: ctx.app,
        }));

        const abortController = new AbortController();
        abortController.abort();
        await mode.onFileChange(null, handles, createLifecycleContext({
            sidebarHost: ctx.sidebarHost,
            signal: abortController.signal,
            handles,
            app: ctx.app,
        }));
        expect(tool.onMapRendered).toHaveBeenCalledTimes(1);

        await mode.onExit(createLifecycleContext({
            sidebarHost: ctx.sidebarHost,
            signal: ctx.signal,
            app: ctx.app,
        }));
        expect(tool.onDeactivate).toHaveBeenCalled();
        expect(tool.cleanup).toHaveBeenCalled();
    });

    it("routes hex click events to the active tool", async () => {
        const ctx = createLifecycleContext({});
        const mode = createEditorMode();
        const tool = toolMock;

        await mode.onEnter(ctx);
        const handles = createHandles();
        await mode.onFileChange(null, handles, createLifecycleContext({
            sidebarHost: ctx.sidebarHost,
            signal: ctx.signal,
            handles,
            app: ctx.app,
        }));

        const coord: HexCoord = { r: 1, c: 2 };
        await mode.onHexClick(coord, new CustomEvent("hex"), createLifecycleContext({
            sidebarHost: ctx.sidebarHost,
            signal: ctx.signal,
            handles,
            app: ctx.app,
        }));

        expect(tool.onHexClick).toHaveBeenCalledWith(coord, expect.any(Object));
    });
});
