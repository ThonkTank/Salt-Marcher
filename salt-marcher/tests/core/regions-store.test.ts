// salt-marcher/tests/core/regions-store.test.ts
// Prüft Regions-Store auf Datei-Lifecycle, Watcher und Datenpersistenz.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as Obsidian from "obsidian";
import { App, TFile } from "obsidian";
import { ensureRegionsFile, watchRegions, REGIONS_FILE } from "../../src/core/regions-store";

class FakeVault {
    private files = new Map<string, { file: TFile; data: string }>();
    private listeners = {
        modify: new Set<(file: TFile) => unknown>(),
        delete: new Set<(file: TFile) => unknown>(),
    } as const;

    getAbstractFileByPath(path: string) {
        return this.files.get(path)?.file ?? null;
    }

    async createFolder(_path: string) {
        return { path: _path };
    }

    async create(path: string, data: string) {
        const file = new TFile();
        file.path = path;
        file.basename = path.split("/").pop() ?? path;
        this.files.set(path, { file, data });
        return file;
    }

    async read(file: TFile) {
        const entry = this.files.get(file.path);
        if (!entry) throw new Error(`Missing file: ${file.path}`);
        return entry.data;
    }

    async modify(file: TFile, data: string) {
        const entry = this.files.get(file.path);
        if (!entry) throw new Error(`Missing file: ${file.path}`);
        entry.data = data;
        await this.emit("modify", entry.file);
    }

    async deleteFile(path: string) {
        const entry = this.files.get(path);
        if (!entry) return;
        this.files.delete(path);
        await this.emit("delete", entry.file);
    }

    on(event: "modify" | "delete", cb: (file: TFile) => unknown) {
        this.listeners[event].add(cb);
    }

    off(event: "modify" | "delete", cb: (file: TFile) => unknown) {
        this.listeners[event].delete(cb);
    }

    private async emit(event: "modify" | "delete", file: TFile) {
        const pending = Array.from(this.listeners[event]).map(cb => cb(file));
        await Promise.all(pending.map(p => Promise.resolve(p)));
    }
}

class FakeApp extends App {
    vault: FakeVault;
    workspace: { trigger: ReturnType<typeof vi.fn>; on: ReturnType<typeof vi.fn>; off: ReturnType<typeof vi.fn> };

    constructor() {
        super();
        this.vault = new FakeVault();
        this.workspace = {
            trigger: vi.fn(),
            on: vi.fn(),
            off: vi.fn(),
        } as any;
    }
}

describe("regions-store watcher", () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.restoreAllMocks();
        (Obsidian as any).normalizePath = (value: string) => value;
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("recreates Regions.md after deletion and alerts the user", async () => {
        const app = new FakeApp();
        const noticeMessages: string[] = [];
        vi.spyOn(Obsidian as any, "Notice").mockImplementation(function (this: any, message?: string) {
            this.message = message;
            noticeMessages.push(message ?? "");
        });

        await ensureRegionsFile(app as unknown as App);
        const stop = watchRegions(app as unknown as App, vi.fn());

        await app.vault.deleteFile(REGIONS_FILE);

        const recreated = app.vault.getAbstractFileByPath(REGIONS_FILE);
        expect(recreated).toBeInstanceOf(TFile);
        const contents = await app.vault.read(recreated as TFile);
        expect(contents).toContain("# Regions");

        expect(noticeMessages).toContain("Regions.md wurde automatisch neu erstellt.");
        expect(app.workspace.trigger).not.toHaveBeenCalled();

        await vi.runAllTimersAsync();
        expect(app.workspace.trigger).toHaveBeenCalledWith("salt:regions-updated");

        stop();
    });

    it("debounces rapid modify/delete sequences to a single notification", async () => {
        const app = new FakeApp();
        const onChange = vi.fn();
        await ensureRegionsFile(app as unknown as App);
        const stop = watchRegions(app as unknown as App, onChange);
        const file = app.vault.getAbstractFileByPath(REGIONS_FILE) as TFile;

        await app.vault.modify(file, "updated");
        await app.vault.deleteFile(REGIONS_FILE);

        expect(onChange).not.toHaveBeenCalled();
        await vi.runAllTimersAsync();
        expect(onChange).toHaveBeenCalledTimes(1);
        expect(app.workspace.trigger).toHaveBeenCalledTimes(1);

        stop();
    });

    it("surfaces an error notice when recreation fails", async () => {
        const app = new FakeApp();
        const noticeMessages: string[] = [];
        const originalCreate = app.vault.create.bind(app.vault);
        await originalCreate(REGIONS_FILE, "seed");
        vi.spyOn(Obsidian as any, "Notice").mockImplementation(function (this: any, message?: string) {
            this.message = message;
            noticeMessages.push(message ?? "");
        });
        app.vault.create = vi.fn().mockRejectedValue(new Error("boom"));

        const stop = watchRegions(app as unknown as App, vi.fn());
        await app.vault.deleteFile(REGIONS_FILE);

        expect(app.vault.getAbstractFileByPath(REGIONS_FILE)).toBeNull();
        expect(noticeMessages).toContain(
            "Regions.md konnte nicht automatisch neu erstellt werden. Bitte manuell wiederherstellen."
        );

        await vi.runAllTimersAsync();
        expect(app.workspace.trigger).toHaveBeenCalledWith("salt:regions-updated");

        stop();
    });
});
