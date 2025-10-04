// salt-marcher/tests/cartographer/editor/editor-mode.test.ts
// Überprüft den Editor-Modus auf DOM-Aufbau und Brush-Interaktionen.
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { App, TFile } from "obsidian";
import type { CartographerModeLifecycleContext, HexCoord } from "../../../src/apps/cartographer/presenter";
import type { RenderHandles } from "../../../src/core/hex-mapper/hex-render";

const telemetryMocks = vi.hoisted(() => ({
    reportEditorToolIssue: vi.fn(({ stage, toolId }: { stage: string; toolId?: string }) => `issue:${stage}:${toolId ?? "unknown"}`),
}));

vi.mock("../../../src/apps/cartographer/editor/editor-telemetry", () => telemetryMocks);

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

const attachBrushCircle = vi.fn(() => ({
    updateRadius: vi.fn(),
    show: vi.fn(),
    destroy: vi.fn(),
}));

vi.mock("../../../src/apps/cartographer/editor/tools/brush-circle", () => ({
    attachBrushCircle: (...args: unknown[]) => attachBrushCircle(...args),
}));

import { createEditorMode } from "../../../src/apps/cartographer/modes/editor";

beforeEach(() => {
    vi.clearAllMocks();
    loadRegions.mockReset();
    applyBrush.mockReset();
    telemetryMocks.reportEditorToolIssue.mockClear();
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

const createLifecycleContext = (options: {
    app?: App;
    sidebarHost?: HTMLElement;
    signal?: AbortSignal;
    file?: TFile | null;
    handles?: RenderHandles | null;
}): CartographerModeLifecycleContext => {
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

const cloneLifecycleContext = (
    base: CartographerModeLifecycleContext,
    overrides: { file?: TFile | null; handles?: RenderHandles | null }
): CartographerModeLifecycleContext => ({
    app: base.app,
    host: base.host,
    mapHost: base.mapHost,
    sidebarHost: base.sidebarHost,
    signal: base.signal,
    getFile: () => overrides.file ?? base.getFile(),
    getMapLayer: () => null,
    getRenderHandles: () => overrides.handles ?? base.getRenderHandles(),
    getOptions: () => null,
});

const flushAsync = async () => {
    await Promise.resolve();
    await Promise.resolve();
};

describe("editor mode", () => {
    it("mounts panel UI and activates the brush when handles arrive", async () => {
        loadRegions.mockResolvedValue([]);
        const baseCtx = createLifecycleContext({});
        const mode = createEditorMode();

        await mode.onEnter(baseCtx);
        await flushAsync();

        const panelEl = baseCtx.sidebarHost.querySelector(".sm-cartographer__panel");
        expect(panelEl).not.toBeNull();
        const statusEl = baseCtx.sidebarHost.querySelector(".sm-cartographer__panel-status");
        expect(statusEl?.textContent).toBe("No regions available yet.");

        const file = { path: "map.md", basename: "map" } as TFile;
        const handles = createHandles();
        await mode.onFileChange(
            file,
            handles,
            cloneLifecycleContext(baseCtx, { file, handles })
        );

        expect(attachBrushCircle).toHaveBeenCalled();
        expect(panelEl?.classList.contains("is-disabled")).toBe(false);
        expect(statusEl?.classList.contains("is-error")).toBe(false);
    });

    it("relays brush clicks to applyBrush and reflects status messages", async () => {
        loadRegions.mockResolvedValue([]);
        applyBrush.mockImplementation(async (...args: unknown[]) => {
            const ctx = args[5] as { tool?: { setStatus?: (msg: string) => void } } | undefined;
            ctx?.tool?.setStatus?.("Applied brush.");
        });

        const baseCtx = createLifecycleContext({});
        const mode = createEditorMode();
        await mode.onEnter(baseCtx);

        const file = { path: "map.md", basename: "map" } as TFile;
        const handles = createHandles();
        await mode.onFileChange(
            file,
            handles,
            cloneLifecycleContext(baseCtx, { file, handles })
        );

        const coord: HexCoord = { r: 0, c: 0 };
        await mode.onHexClick(
            coord,
            new MouseEvent("click"),
            cloneLifecycleContext(baseCtx, { file, handles })
        );
        await flushAsync();
        await flushAsync();

        expect(applyBrush).toHaveBeenCalledWith(
            baseCtx.app,
            file,
            coord,
            expect.any(Object),
            handles,
            expect.objectContaining({ toolName: "Brush" })
        );

        const statusEl = baseCtx.sidebarHost.querySelector(".sm-cartographer__panel-status");
        expect(statusEl?.classList.contains("is-error")).toBe(false);
        expect(statusEl?.classList.contains("is-empty")).toBe(false);
        expect(telemetryMocks.reportEditorToolIssue).not.toHaveBeenCalled();
    });

    it("surfaces brush failures via telemetry status", async () => {
        loadRegions.mockResolvedValue([]);
        const failure = new Error("apply failed");
        applyBrush.mockRejectedValueOnce(failure);

        const baseCtx = createLifecycleContext({});
        const mode = createEditorMode();
        await mode.onEnter(baseCtx);

        const file = { path: "map.md", basename: "map" } as TFile;
        const handles = createHandles();
        await mode.onFileChange(
            file,
            handles,
            cloneLifecycleContext(baseCtx, { file, handles })
        );

        await mode.onHexClick(
            { r: 0, c: 0 },
            new MouseEvent("click"),
            cloneLifecycleContext(baseCtx, { file, handles })
        );

        expect(telemetryMocks.reportEditorToolIssue).toHaveBeenCalledWith({
            stage: "operation",
            toolId: "Brush",
            error: failure,
        });

        const statusEl = baseCtx.sidebarHost.querySelector(".sm-cartographer__panel-status");
        expect(statusEl?.textContent).toBe("issue:operation:Brush");
        const panelEl = baseCtx.sidebarHost.querySelector(".sm-cartographer__panel");
        expect(panelEl?.classList.contains("has-tool-error")).toBe(true);
    });
});
