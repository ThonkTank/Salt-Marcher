// salt-marcher/tests/apps/almanac/almanac-repository.test.ts
// Exercises VaultAlmanacRepository filter, pagination and link update logic.

import { beforeEach, describe, expect, it } from "vitest";

import { TAbstractFile, TFile } from "obsidian";
import { VaultAlmanacRepository } from "../../../src/apps/almanac/data/vault-almanac-repository";
import { VaultCalendarRepository } from "../../../src/apps/almanac/data/vault-calendar-repository";
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
        const file = this.files.get(path);
        if (file) {
            return file;
        }
        if (this.folders.has(path)) {
            const folder = new TAbstractFile();
            folder.path = path;
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

describe("VaultAlmanacRepository", () => {
    let vault: MemoryVault;
    let calendarRepo: VaultCalendarRepository;
    let repository: VaultAlmanacRepository;

    beforeEach(async () => {
        vault = new MemoryVault();
        calendarRepo = new VaultCalendarRepository(vault);
        await calendarRepo.createCalendar({ ...gregorianSchema, isDefaultGlobal: true });
        repository = new VaultAlmanacRepository(calendarRepo, vault);

        const simplePhenomena = [
            {
                id: "phen-spring-bloom",
                name: "Spring Bloom",
                category: "season" as const,
                visibility: "selected" as const,
                appliesToCalendarIds: [gregorianSchema.id],
                rule: { type: "annual_offset", offsetDayOfYear: 80 } as any,
                timePolicy: "all_day" as const,
                priority: 5,
                schemaVersion: "1.0.0",
            },
            {
                id: "phen-harvest-fest",
                name: "Harvest Festival",
                category: "holiday" as const,
                visibility: "selected" as const,
                appliesToCalendarIds: [gregorianSchema.id],
                rule: { type: "annual_offset", offsetDayOfYear: 200 } as any,
                timePolicy: "all_day" as const,
                priority: 3,
                schemaVersion: "1.0.0",
            },
            {
                id: "phen-spring-tide",
                name: "Spring Tide",
                category: "tide" as const,
                visibility: "selected" as const,
                appliesToCalendarIds: [gregorianSchema.id],
                rule: { type: "annual_offset", offsetDayOfYear: 120 } as any,
                timePolicy: "all_day" as const,
                priority: 6,
                schemaVersion: "1.0.0",
            },
        ];

        for (const phenomenon of simplePhenomena) {
            await repository.upsertPhenomenon(phenomenon);
        }
    });

    it("filters phenomena by category and calendar and supports pagination", async () => {
        const batch = await repository.listPhenomena({
            viewMode: "timeline",
            filters: { categories: [], calendarIds: [] },
            sort: "priority_desc",
            pagination: { limit: 2 },
        });

        expect(batch.items).toHaveLength(2);
        expect(batch.pagination.hasMore).toBe(true);

        const holidayOnly = await repository.listPhenomena({
            viewMode: "timeline",
            filters: { categories: ["tide"], calendarIds: [] },
            sort: "priority_desc",
            pagination: { limit: 5 },
        });

        expect(holidayOnly.items).toHaveLength(1);
        expect(holidayOnly.items[0]?.category).toBe("tide");

        const calendarFilter = await repository.listPhenomena({
            viewMode: "timeline",
            filters: { categories: [], calendarIds: [gregorianSchema.id] },
            sort: "priority_desc",
            pagination: { limit: 5 },
        });

        expect(calendarFilter.items.length).toBeGreaterThan(0);
        expect(calendarFilter.items.every(item => item.linkedCalendars.includes(gregorianSchema.id))).toBe(true);
    });

    it("updates phenomenon calendar links and prevents duplicate assignments", async () => {
        const result = await repository.updateLinks({
            phenomenonId: "phen-spring-bloom",
            calendarLinks: [
                { calendarId: gregorianSchema.id, priority: 8 },
            ],
        });

        expect(result.visibility).toBe("selected");
        expect(result.appliesToCalendarIds).toEqual([gregorianSchema.id]);

        await expect(
            repository.updateLinks({
                phenomenonId: "phen-spring-bloom",
                calendarLinks: [
                    { calendarId: gregorianSchema.id, priority: 1 },
                    { calendarId: gregorianSchema.id, priority: 2 },
                ],
            }),
        ).rejects.toMatchObject({ code: "phenomenon_conflict" });
    });

    it("guards astronomical phenomena without reference calendars", async () => {
        await repository.upsertPhenomenon({
            id: "phen-astronomical",
            name: "Star Fall",
            category: "astronomy",
            visibility: "selected",
            appliesToCalendarIds: [gregorianSchema.id],
            rule: { type: "astronomical", source: "sunrise" } as any,
            timePolicy: "all_day",
            priority: 4,
            schemaVersion: "1.0.0",
        });

        await expect(
            repository.updateLinks({
                phenomenonId: "phen-astronomical",
                calendarLinks: [{ calendarId: gregorianSchema.id, priority: 1 }],
            }),
        ).rejects.toMatchObject({ code: "astronomy_source_missing" });
    });
});
