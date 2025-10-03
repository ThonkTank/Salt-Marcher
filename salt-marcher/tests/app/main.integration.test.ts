// salt-marcher/tests/app/main.integration.test.ts
// Uebt das Plugin-Bootstrap durch und prueft Terrain- sowie View-Verkabelung.
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

const cartographerMocks = vi.hoisted(() => ({
    openCartographer: vi.fn(),
    detachCartographerLeaves: vi.fn().mockResolvedValue(undefined),
}));

const integrationTelemetry = vi.hoisted(() => ({
    reportIntegrationIssue: vi.fn(),
}));

vi.mock("../../src/core/terrain-store", () => terrainStoreMocks);
vi.mock("../../src/core/terrain", () => terrainMocks);
vi.mock("../../src/app/integration-telemetry", () => integrationTelemetry);

const { ensureTerrainFile, loadTerrains, watchTerrains } = terrainStoreMocks;
const { setTerrains } = terrainMocks;
const { openCartographer, detachCartographerLeaves } = cartographerMocks;
const { reportIntegrationIssue } = integrationTelemetry;
let unwatch: ReturnType<typeof vi.fn>;

vi.mock("../../src/apps/cartographer", () => ({
    VIEW_CARTOGRAPHER: "cartographer",
    CartographerView: class CartographerView {},
    openCartographer: cartographerMocks.openCartographer,
    detachCartographerLeaves: cartographerMocks.detachCartographerLeaves,
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
        openCartographer.mockReset();
        detachCartographerLeaves.mockReset();
        reportIntegrationIssue.mockReset();

        ensureTerrainFile.mockResolvedValue({} as unknown);
        loadTerrains.mockResolvedValue({ plains: { color: "#ccc", speed: 1 } });
        unwatch = vi.fn();
        watchTerrains.mockReturnValue(unwatch);
        openCartographer.mockResolvedValue(undefined);
        detachCartographerLeaves.mockResolvedValue(undefined);
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

    it("reports telemetry when terrain priming fails", async () => {
        // Arrange
        const plugin = createPlugin();
        const failure = new Error("ensure failed");
        ensureTerrainFile.mockRejectedValueOnce(failure);

        // Act & Assert
        await expect(plugin.onload()).rejects.toBe(failure);

        // Assert
        expect(reportIntegrationIssue).toHaveBeenCalledTimes(1);
        expect(reportIntegrationIssue).toHaveBeenCalledWith({
            integrationId: "obsidian:terrain-palette",
            operation: "prime-dataset",
            error: failure,
            userMessage: "Terrain-Daten konnten nicht geladen werden. Bitte die Vault-Dateien pruefen.",
        });
    });

    it("reports telemetry when the cartographer command fails to open the view", async () => {
        // Arrange
        const plugin = createPlugin();
        const addCommandSpy = vi.spyOn(plugin, "addCommand");
        await plugin.onload();
        const failure = new Error("activate failed");
        openCartographer.mockRejectedValueOnce(failure);

        const commandConfig = addCommandSpy.mock.calls
            .map(([config]) => config)
            .find((config) => config.id === "open-cartographer");
        expect(commandConfig?.callback).toBeDefined();

        try {
            // Act & Assert
            await expect(commandConfig?.callback?.()).rejects.toBe(failure);
        } finally {
            addCommandSpy.mockRestore();
        }

        // Assert
        expect(reportIntegrationIssue).toHaveBeenCalledTimes(1);
        expect(reportIntegrationIssue).toHaveBeenCalledWith({
            integrationId: "obsidian:cartographer-view",
            operation: "activate-view",
            error: failure,
            userMessage: "Cartographer konnte nicht geoeffnet werden. Bitte die Konsole pruefen.",
        });
    });

    it("reports telemetry when cartographer leaves fail to detach", async () => {
        // Arrange
        const plugin = createPlugin();
        await plugin.onload();
        const failure = new Error("detach failed");
        detachCartographerLeaves.mockRejectedValueOnce(failure);

        // Act & Assert
        await expect(plugin.onunload()).rejects.toBe(failure);

        // Assert
        expect(unwatch).toHaveBeenCalledTimes(1);
        expect(reportIntegrationIssue).toHaveBeenCalledTimes(1);
        expect(reportIntegrationIssue).toHaveBeenCalledWith({
            integrationId: "obsidian:cartographer-view",
            operation: "detach-view",
            error: failure,
            userMessage: "Cartographer-Ansichten konnten nicht geschlossen werden. Bitte die Konsole pruefen.",
        });
    });

    it.todo("integrates createTerrainBootstrap once the merge conflict around main.ts is resolved");
});
