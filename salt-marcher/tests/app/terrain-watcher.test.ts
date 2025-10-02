// salt-marcher/tests/app/terrain-watcher.test.ts
// Überprüft das Terrain-Watcher-Setup rund um Datei-Events und Store-Aufrufe.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App, TFile } from "obsidian";
import * as terrainStore from "../../src/core/terrain-store";
import { watchTerrains, TERRAIN_FILE } from "../../src/core/terrain-store";
import * as terrain from "../../src/core/terrain";

type Listener = (file: TFile) => void;

class FakeVault {
    private listeners = new Map<string, Set<Listener>>();
    getAbstractFileByPath = (_path: string) => null;
    createFolder = async () => {};
    create = async (path: string, _contents: string) => {
        const file = new TFile();
        file.path = path;
        file.basename = path.split("/").pop() ?? path;
        return file;
    };
    read = async (_file: TFile) => "";
    modify = async (_file: TFile, _data: string) => {};

    on(event: string, handler: Listener) {
        const set = this.listeners.get(event) ?? new Set<Listener>();
        set.add(handler);
        this.listeners.set(event, set);
        return { off: () => set.delete(handler) };
    }

    offref(ref: { off: () => void }) {
        ref.off();
    }

    emit(event: string, file: TFile) {
        const set = this.listeners.get(event);
        if (!set) return;
        for (const handler of Array.from(set)) {
            handler(file);
        }
    }

    getListenerCount(event: string) {
        return this.listeners.get(event)?.size ?? 0;
    }
}

const flushAsync = async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
    await Promise.resolve();
};

describe("watchTerrains", () => {
    let app: App & { vault: FakeVault; workspace: App["workspace"] & { trigger: ReturnType<typeof vi.fn> } };
    let vault: FakeVault;
    let loadTerrainsSpy: ReturnType<typeof vi.spyOn>;
    let ensureTerrainFileSpy: ReturnType<typeof vi.spyOn>;
    let setTerrainsSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        vault = new FakeVault();
        app = new App() as typeof app;
        app.vault = vault as unknown as App["vault"];
        app.workspace = {
            ...app.workspace,
            trigger: vi.fn(),
            getLeavesOfType: app.workspace.getLeavesOfType,
            getLeaf: app.workspace.getLeaf,
            revealLeaf: app.workspace.revealLeaf,
            getActiveFile: app.workspace.getActiveFile,
            on: app.workspace.on,
            off: app.workspace.off,
        };
        ensureTerrainFileSpy = vi.spyOn(terrainStore, "ensureTerrainFile").mockResolvedValue(new TFile());
        loadTerrainsSpy = vi.spyOn(terrainStore, "loadTerrains").mockResolvedValue({});
        setTerrainsSpy = vi.spyOn(terrain, "setTerrains").mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    const emitModify = () => {
        const file = new TFile();
        file.path = TERRAIN_FILE;
        vault.emit("modify", file);
    };

    it("reports loader failures through onError without throwing", async () => {
        const failure = new Error("setter failed");
        setTerrainsSpy.mockImplementation(() => {
            throw failure;
        });
        const onError = vi.fn();

        const stop = watchTerrains(app, { onError });
        expect(vault.getListenerCount("modify")).toBeGreaterThan(0);
        emitModify();
        await flushAsync();

        expect(onError).toHaveBeenCalledTimes(1);
        expect(onError.mock.calls[0][0]).toBe(failure);
        expect(onError.mock.calls[0][1]).toEqual({ reason: "modify" });
        expect(setTerrainsSpy).toHaveBeenCalledTimes(1);

        stop();
    });

    it("falls back to console logging when no onError handler is provided", async () => {
        const failure = new Error("setter boom");
        setTerrainsSpy.mockImplementation(() => {
            throw failure;
        });
        const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

        const stop = watchTerrains(app);
        expect(vault.getListenerCount("modify")).toBeGreaterThan(0);
        emitModify();
        await flushAsync();

        expect(consoleSpy).toHaveBeenCalledTimes(1);
        expect(consoleSpy.mock.calls[0][0]).toContain("Terrain watcher failed after modify event");
        expect(consoleSpy.mock.calls[0][1]).toBe(failure);

        stop();
        consoleSpy.mockRestore();
    });

    it("captures errors thrown by change callbacks", async () => {
        const failure = new Error("callback boom");
        const onChange = vi.fn(() => {
            throw failure;
        });
        const onError = vi.fn();

        const stop = watchTerrains(app, { onChange, onError });
        expect(vault.getListenerCount("modify")).toBeGreaterThan(0);
        emitModify();
        await flushAsync();

        expect(onChange).toHaveBeenCalledTimes(1);
        expect(onError).toHaveBeenCalledTimes(1);
        expect(onError.mock.calls[0][0]).toBe(failure);
        expect(onError.mock.calls[0][1]).toEqual({ reason: "modify" });
        expect(setTerrainsSpy).toHaveBeenCalled();

        stop();
    });
});
