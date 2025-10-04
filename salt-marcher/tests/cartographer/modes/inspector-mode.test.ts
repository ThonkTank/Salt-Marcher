// salt-marcher/tests/cartographer/modes/inspector-mode.test.ts
// Prüft den Inspector-Modus auf Formularaufbau und Auto-Save-Verhalten.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { App, TFile } from "obsidian";
import type { CartographerModeLifecycleContext } from "../../../src/apps/cartographer/presenter";
import type { RenderHandles } from "../../../src/core/hex-mapper/hex-render";
import { TERRAIN_COLORS } from "../../../src/core/terrain";
import { createInspectorMode } from "../../../src/apps/cartographer/modes/inspector";

const loadTile = vi.fn();
const saveTile = vi.fn();

vi.mock("../../../src/core/hex-mapper/hex-notes", async () => {
    const actual = await vi.importActual<
        typeof import("../../../src/core/hex-mapper/hex-notes")
    >("../../../src/core/hex-mapper/hex-notes");
    return {
        ...actual,
        loadTile: (...args: unknown[]) => loadTile(...args),
        saveTile: (...args: unknown[]) => saveTile(...args),
    };
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
} = {}): CartographerModeLifecycleContext => {
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

beforeEach(() => {
    vi.useFakeTimers();
    loadTile.mockReset();
    saveTile.mockReset();
});

afterEach(() => {
    vi.useRealTimers();
});

describe("createInspectorMode", () => {
    it("renders the builder-backed controls", async () => {
        const baseCtx = createLifecycleContext();
        const mode = createInspectorMode();

        await mode.onEnter(baseCtx);

        const panel = baseCtx.sidebarHost.querySelector(".sm-cartographer__panel--inspector");
        expect(panel).not.toBeNull();
        const header = panel?.querySelector("h3");
        expect(header?.textContent).toBe("Inspektor");
        const terrainSelect = panel?.querySelector("select") as HTMLSelectElement | null;
        expect(terrainSelect).not.toBeNull();
        expect(terrainSelect?.disabled).toBe(true);
        expect(terrainSelect?.options.length).toBe(Object.keys(TERRAIN_COLORS).length);
        const noteArea = panel?.querySelector("textarea") as HTMLTextAreaElement | null;
        expect(noteArea).not.toBeNull();
        expect(noteArea?.disabled).toBe(true);

        await mode.onExit(baseCtx);
    });

    it("loads selection data and auto-saves edits", async () => {
        const handles = createHandles();
        const file = { path: "map.md", basename: "map" } as TFile;
        const sampleTerrain = Object.keys(TERRAIN_COLORS).find((key) => key) ?? "";
        loadTile.mockResolvedValue({ terrain: sampleTerrain, note: "hello" });

        const baseCtx = createLifecycleContext({ handles, file });
        const mode = createInspectorMode();

        await mode.onEnter(baseCtx);
        await mode.onFileChange(file, handles, baseCtx);
        await mode.onHexClick({ r: 1, c: 2 }, null as any, cloneLifecycleContext(baseCtx, { file, handles }));
        await Promise.resolve();

        const panel = baseCtx.sidebarHost.querySelector(".sm-cartographer__panel--inspector");
        const terrainSelect = panel?.querySelector("select") as HTMLSelectElement;
        const noteArea = panel?.querySelector("textarea") as HTMLTextAreaElement;
        expect(terrainSelect.disabled).toBe(false);
        expect(terrainSelect.value).toBe(sampleTerrain);
        expect(noteArea.disabled).toBe(false);
        expect(noteArea.value).toBe("hello");

        noteArea.value = "updated";
        noteArea.dispatchEvent(new Event("input"));
        vi.advanceTimersByTime(300);
        await Promise.resolve();
        await Promise.resolve();

        expect(saveTile).toHaveBeenCalledWith(baseCtx.app, file, { r: 1, c: 2 }, { terrain: sampleTerrain, note: "updated" });
        expect(handles.setFill).toHaveBeenCalledWith({ r: 1, c: 2 }, TERRAIN_COLORS[sampleTerrain] ?? "transparent");

        await mode.onExit(baseCtx);
    });
});
