// salt-marcher/tests/apps/almanac/calendar-repository.test.ts
// Validates vault-backed calendar repository persistence and default handling.

import { describe, expect, it, beforeEach } from "vitest";

import { TAbstractFile, TFile } from "obsidian";
import { VaultCalendarRepository } from "../../../src/apps/almanac/data/vault-repositories";
import type { VaultLike } from "../../../src/apps/almanac/data/json-store";
import { gregorianSchema } from "../../../src/apps/almanac/fixtures/gregorian.fixture";

class MemoryFile extends TFile {
    data = "";
    constructor(path: string, data: string) {
        super();
        this.path = path;
        this.basename = path.split("/").pop() ?? path;
        this.data = data;
    }
}

class MemoryVault implements VaultLike {
    private files = new Map<string, MemoryFile>();
    private folders = new Set<string>();

    getAbstractFileByPath(path: string): TAbstractFile | null {
        const normalised = path;
        const file = this.files.get(normalised);
        if (file) {
            return file;
        }
        if (this.folders.has(normalised)) {
            const folder = new TAbstractFile();
            folder.path = normalised;
            return folder;
        }
        return null;
    }

    async create(path: string, data: string): Promise<TFile> {
        const file = new MemoryFile(path, data);
        this.files.set(path, file);
        return file;
    }

    async modify(file: TFile, data: string): Promise<void> {
        const memory = this.files.get(file.path);
        if (memory) {
            memory.data = data;
        }
    }

    async read(file: TFile): Promise<string> {
        const memory = this.files.get(file.path);
        return memory?.data ?? "";
    }

    async createFolder(path: string): Promise<void> {
        this.folders.add(path);
    }
}

describe("VaultCalendarRepository", () => {
    let vault: MemoryVault;

    beforeEach(() => {
        vault = new MemoryVault();
    });

    it("persists calendars and default selections across instances", async () => {
        const repo = new VaultCalendarRepository(vault);

        await repo.createCalendar({ ...gregorianSchema, isDefaultGlobal: true });
        await repo.setDefault({ calendarId: gregorianSchema.id, scope: "travel", travelId: "travel-1" });

        const first = await repo.listCalendars();
        expect(first).toHaveLength(1);
        expect(first[0]?.isDefaultGlobal).toBe(true);
        expect(first[0]?.defaultTravelIds).toEqual(["travel-1"]);

        const reload = new VaultCalendarRepository(vault);
        const defaults = await reload.getDefaults();
        expect(defaults.global).toBe(gregorianSchema.id);
        expect(defaults.travel["travel-1"]).toBe(gregorianSchema.id);

        await reload.clearTravelDefault("travel-1");
        const cleared = await reload.getDefaults();
        expect(cleared.travel["travel-1"]).toBeNull();

        await reload.deleteCalendar(gregorianSchema.id);
        const afterDelete = await reload.listCalendars();
        expect(afterDelete).toHaveLength(0);
    });

    it("updates calendar metadata via updateCalendar", async () => {
        const repo = new VaultCalendarRepository(vault);
        await repo.createCalendar({ ...gregorianSchema });

        await repo.updateCalendar(gregorianSchema.id, { description: "Updated" });
        const updated = await repo.getCalendar(gregorianSchema.id);
        expect(updated?.description).toBe("Updated");
    });
});
