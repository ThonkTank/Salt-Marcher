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
import type { MapLayer } from "../../src/apps/cartographer/travel/ui/map-layer";
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

    const setupController = () => {
        const travel = createModeStub("travel");
        const editor = createModeStub("editor");
        const layer = createLayerStub();

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

        const controller = new CartographerController(app, {
            createMapManager: (_app, options) => {
                managerOnChange = options.onChange ?? null;
                return mapManager;
            },
            createMapLayer: vi.fn(async () => layer),
            loadHexOptions: vi.fn(async () => hexOptions),
            modeDescriptors: [
                { id: travel.mode.id, label: travel.mode.label, load: async () => travel.mode },
                { id: editor.mode.id, label: editor.mode.label, load: async () => editor.mode },
            ],
        });

        return { controller, travel, editor, mapManager, layer };
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
});
