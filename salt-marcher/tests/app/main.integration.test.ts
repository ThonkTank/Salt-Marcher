import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App, PluginManifest } from "obsidian";

const terrainStoreMocks = vi.hoisted(() => ({
    ensureTerrainFile: vi.fn(),
    loadTerrains: vi.fn(),
    watchTerrains: vi.fn(),
}));

const terrainMocks = vi.hoisted(() => ({
    setTerrains: vi.fn(),
}));

vi.mock("../../src/core/terrain-store", () => terrainStoreMocks);
vi.mock("../../src/core/terrain", () => terrainMocks);

const { ensureTerrainFile, loadTerrains, watchTerrains } = terrainStoreMocks;
const { setTerrains } = terrainMocks;
let unwatch: ReturnType<typeof vi.fn>;

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

import SaltMarcherPlugin from "../../src/app/main";

describe("SaltMarcherPlugin bootstrap integration", () => {
    beforeEach(() => {
        ensureTerrainFile.mockReset();
        loadTerrains.mockReset();
        watchTerrains.mockReset();
        setTerrains.mockReset();

        ensureTerrainFile.mockResolvedValue({} as unknown);
        loadTerrains.mockResolvedValue({ plains: { color: "#ccc", speed: 1 } });
        unwatch = vi.fn();
        watchTerrains.mockReturnValue(unwatch);
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

    it("ensures and primes the terrain palette before watching for updates", async () => {
        const plugin = createPlugin();
        await plugin.onload();

        expect(ensureTerrainFile).toHaveBeenCalledTimes(1);
        expect(ensureTerrainFile).toHaveBeenCalledWith(plugin.app);
        expect(loadTerrains).toHaveBeenCalledTimes(1);
        expect(loadTerrains).toHaveBeenCalledWith(plugin.app);
        expect(setTerrains).toHaveBeenCalledTimes(1);
        expect(setTerrains).toHaveBeenCalledWith({ plains: { color: "#ccc", speed: 1 } });
        expect(watchTerrains).toHaveBeenCalledTimes(1);
        expect(watchTerrains).toHaveBeenCalledWith(plugin.app, expect.any(Function));

        const [, callback] = watchTerrains.mock.calls[0];
        await expect(Promise.resolve((callback as () => Promise<void> | void)?.()))
            .resolves.toBeUndefined();

        expect(watchTerrains.mock.results[0]?.value).toBe(unwatch);
        expect(unwatch).not.toHaveBeenCalled();

        await plugin.onunload();
        expect(unwatch).toHaveBeenCalledTimes(1);
    });

    it.todo("integrates createTerrainBootstrap once the merge conflict around main.ts is resolved");
});
