// salt-marcher/tests/cartographer/controller.test.ts
// Prüft den Cartographer-Controller hinsichtlich Lifecycle, Map-Handling und Callback-Weiterleitungen.
import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("obsidian", async () => await import("../mocks/obsidian"));

import { App, TFile } from "obsidian";
import {
    CartographerController,
    type CartographerMode,
    type CartographerModeLifecycleContext,
} from "../../src/apps/cartographer/controller";
import type { MapLayer } from "../../src/apps/session-runner/travel/ui/map-layer";
import type { HexOptions } from "../../src/core/options";
import type { RenderHandles } from "../../src/core/hex-mapper/hex-render";

const createFile = (path: string): TFile => {
    const file = new TFile();
    file.path = path;
    const parts = path.split("/");
    const basename = parts[parts.length - 1] ?? path;
    file.basename = basename.replace(/\.md$/i, "");
    return file;
};

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
    if (!proto.addClass) {
        proto.addClass = function(cls: string) {
            this.classList.add(cls);
            return this;
        };
    }
    if (!proto.removeClass) {
        proto.removeClass = function(cls: string) {
            this.classList.remove(cls);
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

type ModeStub = {
    mode: CartographerMode;
    spies: {
        onEnter: ReturnType<typeof vi.fn>;
        onExit: ReturnType<typeof vi.fn>;
        onFileChange: ReturnType<typeof vi.fn>;
        onHexClick: ReturnType<typeof vi.fn>;
        onSave: ReturnType<typeof vi.fn>;
    };
};

const createModeStub = (id: string): ModeStub => {
    const spies = {
        onEnter: vi.fn(async (_ctx: CartographerModeLifecycleContext) => {}),
        onExit: vi.fn(async (_ctx: CartographerModeLifecycleContext) => {}),
        onFileChange: vi.fn(async () => {}),
        onHexClick: vi.fn(async () => {}),
        onSave: vi.fn(async () => false),
    } as const;
    return {
        mode: {
            id,
            label: id.toUpperCase(),
            onEnter: spies.onEnter,
            onExit: spies.onExit,
            onFileChange: spies.onFileChange,
            onHexClick: spies.onHexClick,
            onSave: spies.onSave,
        },
        spies,
    } satisfies ModeStub;
};

const createLayerStub = (): MapLayer => ({
    handles: { polyByCoord: new Map() } as unknown as RenderHandles,
    polyToCoord: new WeakMap(),
    ensurePolys: vi.fn(),
    centerOf: vi.fn(() => null),
    destroy: vi.fn(),
});

describe("CartographerController", () => {
    const app = new App();

    const hexOptions: HexOptions = {
        folder: "Hexes",
        folderPrefix: "Hex",
        prefix: "hex",
        radius: 42,
    };

    beforeAll(() => {
        ensureObsidianDomHelpers();
    });

    type SetupOptions = {
        loadHexOptions?: () => Promise<HexOptions | null>;
        createMapLayer?: () => Promise<MapLayer>;
    };

    const setupController = (options: SetupOptions = {}) => {
        const travel = createModeStub("travel");
        const editor = createModeStub("editor");
        const layer = createLayerStub();
        const travelLoad = vi.fn(async () => travel.mode);
        const editorLoad = vi.fn(async () => editor.mode);

        let managerOnChange: ((file: TFile | null) => void | Promise<void>) | null = null;
        const mapManager = {
            current: null as TFile | null,
            getFile: vi.fn(() => mapManager.current),
            setFile: vi.fn(async (file: TFile | null) => {
                mapManager.current = file;
                if (managerOnChange) await managerOnChange(file);
            }),
            open: vi.fn(),
            create: vi.fn(),
            deleteCurrent: vi.fn(),
        };

        const createMapLayer = vi.fn(options.createMapLayer ?? (async () => layer));
        const loadOptions = vi.fn(options.loadHexOptions ?? (async () => hexOptions));

        const controller = new CartographerController(app, {
            createMapManager: (_app, options) => {
                managerOnChange = options.onChange ?? null;
                return mapManager;
            },
            createMapLayer,
            loadHexOptions: loadOptions,
            modeDescriptors: [
                { id: travel.mode.id, label: travel.mode.label, load: travelLoad },
                { id: editor.mode.id, label: editor.mode.label, load: editorLoad },
            ],
        });

        return {
            controller,
            travel,
            editor,
            mapManager,
            layer,
            createMapLayer,
            loadOptions,
            loads: { travel: travelLoad, editor: editorLoad },
        };
    };

    it("mounts with the first mode and renders the current map", async () => {
        const { controller, travel, editor, mapManager, layer } = setupController();
        const host = document.createElement("div");
        const file = createFile("Maps/test.md");

        await controller.onOpen(host, file);

        expect(travel.spies.onEnter).toHaveBeenCalledTimes(1);
        expect(travel.spies.onFileChange).toHaveBeenCalledWith(
            file,
            layer.handles,
            expect.objectContaining({ getFile: expect.any(Function) }),
        );
        expect(editor.spies.onEnter).not.toHaveBeenCalled();
        expect(mapManager.setFile).toHaveBeenCalledWith(file);
    });

    it("switches modes and calls lifecycle hooks", async () => {
        const { controller, travel, editor } = setupController();
        const host = document.createElement("div");
        const file = createFile("Maps/switch.md");

        await controller.onOpen(host, file);
        await controller.setMode(editor.mode.id);

        expect(travel.spies.onExit).toHaveBeenCalledTimes(1);
        expect(editor.spies.onEnter).toHaveBeenCalledTimes(1);
        expect(editor.spies.onFileChange).toHaveBeenCalledTimes(1);
    });

    it("forwards header and map callbacks", async () => {
        const { controller, travel, mapManager } = setupController();
        const host = document.createElement("div");
        const file = createFile("Maps/callback.md");

        await controller.onOpen(host, file);

        const nextFile = createFile("Maps/next.md");
        await controller.callbacks.onOpen(nextFile);
        expect(mapManager.setFile).toHaveBeenLastCalledWith(nextFile);

        await controller.callbacks.onCreate(nextFile);
        expect(mapManager.setFile).toHaveBeenLastCalledWith(nextFile);

        await controller.callbacks.onDelete(file);
        expect(mapManager.deleteCurrent).toHaveBeenCalled();

        const event = new CustomEvent("hex:click", { detail: { r: 1, c: 2 } });
        await controller.callbacks.onHexClick(event.detail, event);
        expect(travel.spies.onHexClick).toHaveBeenCalledWith(event.detail, event, expect.anything());
    });

    it("shows overlay states for missing file and options", async () => {
        const { controller, travel, mapManager, createMapLayer, loadOptions } = setupController({
            loadHexOptions: async () => null,
        });
        const host = document.createElement("div");
        const file = createFile("Maps/empty.md");

        await controller.onOpen(host, file);

        expect(loadOptions).toHaveBeenCalled();
        expect(createMapLayer).not.toHaveBeenCalled();
        expect(travel.spies.onFileChange).toHaveBeenLastCalledWith(
            file,
            null,
            expect.objectContaining({ getFile: expect.any(Function) }),
        );

        const firstOverlay = host.querySelector(".sm-view-container__overlay-message");
        expect(firstOverlay?.textContent?.trim()).toBe("Kein hex3x3-Block in dieser Datei.");

        await mapManager.setFile(null);

        expect(travel.spies.onFileChange).toHaveBeenLastCalledWith(
            null,
            null,
            expect.objectContaining({ getFile: expect.any(Function) }),
        );

        const secondOverlay = host.querySelector(".sm-view-container__overlay-message");
        expect(secondOverlay?.textContent?.trim()).toBe("Keine Karte ausgewählt.");
    });

    it("loads modes once and reuses cached instances", async () => {
        const { controller, travel, editor, loads } = setupController();
        const host = document.createElement("div");
        const file = createFile("Maps/cache.md");

        await controller.onOpen(host, file);

        expect(loads.travel).toHaveBeenCalledTimes(1);
        expect(loads.editor).toHaveBeenCalledTimes(1);

        await controller.setMode(travel.mode.id);
        expect(travel.spies.onEnter).toHaveBeenCalledTimes(1);

        await controller.setMode(editor.mode.id);
        expect(editor.spies.onEnter).toHaveBeenCalledTimes(1);

        await controller.setMode(editor.mode.id);
        expect(editor.spies.onEnter).toHaveBeenCalledTimes(1);

        await controller.setMode("unknown");
        expect(travel.spies.onEnter).toHaveBeenCalledTimes(2);

        expect(loads.travel).toHaveBeenCalledTimes(1);
        expect(loads.editor).toHaveBeenCalledTimes(1);
    });

    it("aborts a previous render when a new one starts", async () => {
        const initialLayer = createLayerStub();
        let callCount = 0;
        const { controller, travel, createMapLayer } = setupController({
            createMapLayer: async () => {
                callCount += 1;
                if (callCount === 1) return initialLayer;
                return createLayerStub();
            },
        });
        const host = document.createElement("div");
        const firstFile = createFile("Maps/initial.md");

        await controller.onOpen(host, firstFile);
        const initialCalls = createMapLayer.mock.calls.length;
        expect(initialCalls).toBeGreaterThan(0);
        expect(travel.spies.onFileChange).toHaveBeenCalledWith(
            firstFile,
            initialLayer.handles,
            expect.anything(),
        );

        const controllerInternals = controller as unknown as {
            applyCurrentFile(file: TFile | null, ctx?: CartographerModeLifecycleContext | null): Promise<void>;
            lifecycle: { ctx: CartographerModeLifecycleContext } | null;
            renderAbort?: AbortController;
        };

        const lifecycleCtx = controllerInternals.lifecycle?.ctx;
        expect(lifecycleCtx).toBeTruthy();

        const previousAbort = new AbortController();
        previousAbort.abort = vi.fn(previousAbort.abort.bind(previousAbort));
        controllerInternals.renderAbort = previousAbort;

        const pendingFile = createFile("Maps/pending.md");
        await controllerInternals.applyCurrentFile(pendingFile, lifecycleCtx ?? null);

        expect(previousAbort.abort).toHaveBeenCalledTimes(1);
        expect(createMapLayer.mock.calls.length).toBe(initialCalls + 1);
    });
});
