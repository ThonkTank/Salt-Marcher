import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App, PluginManifest } from "obsidian";

const startSpy = vi.fn<[], Promise<boolean>>();
const stopSpy = vi.fn();

vi.mock("../../src/app/bootstrap-services", () => {
    return {
        createTerrainBootstrap: vi.fn(() => ({
            start: startSpy,
            stop: stopSpy,
        })),
    };
});

vi.mock("../../src/apps/cartographer", () => ({
    VIEW_CARTOGRAPHER: "cartographer", 
    CartographerView: class CartographerView {},
    openCartographer: vi.fn(),
    detachCartographerLeaves: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../src/apps/encounter/view", () => ({
    EncounterView: class EncounterView {
        constructor(public leaf: unknown) {
            void leaf;
        }
    },
    VIEW_ENCOUNTER: "encounter",
}));

vi.mock("../../src/apps/library/view", () => ({
    LibraryView: class LibraryView {
        constructor(public leaf: unknown) {
            void leaf;
        }
    },
    VIEW_LIBRARY: "library",
}));

vi.mock("../../src/app/layout-editor-bridge", () => ({
    setupLayoutEditorBridge: vi.fn(() => vi.fn()),
}));

import SaltMarcherPlugin from "../../src/app/main";
import { createTerrainBootstrap } from "../../src/app/bootstrap-services";

describe("SaltMarcherPlugin bootstrap integration", () => {
    beforeEach(() => {
        startSpy.mockReset();
        stopSpy.mockReset();
        startSpy.mockResolvedValue(true);
        vi.mocked(createTerrainBootstrap).mockClear();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    const createPlugin = () => {
        const app = new App();
        const manifest: PluginManifest = {
            id: "salt-marcher",
            name: "Salt Marcher",
            version: "0.0.0",
            author: "tests",
        };
        return new SaltMarcherPlugin(app, manifest);
    };

    it("initialises and tears down the terrain bootstrapper", async () => {
        const plugin = createPlugin();
        await plugin.onload();

        expect(createTerrainBootstrap).toHaveBeenCalledTimes(1);
        expect(createTerrainBootstrap).toHaveBeenCalledWith(plugin.app, expect.objectContaining({ logger: expect.any(Object) }));
        expect(startSpy).toHaveBeenCalledTimes(1);

        await plugin.onunload();
        expect(stopSpy).toHaveBeenCalledTimes(1);
    });

    it("logs a warning when priming fails", async () => {
        const plugin = createPlugin();
        startSpy.mockResolvedValueOnce(false);
        const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

        await plugin.onload();

        expect(warnSpy).toHaveBeenCalledWith(
            "[SaltMarcher] Terrain palette could not be initialised; defaults remain active until the vault updates."
        );

        await plugin.onunload();
        warnSpy.mockRestore();
    });
});
