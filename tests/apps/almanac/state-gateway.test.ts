// salt-marcher/tests/apps/almanac/state-gateway.test.ts
// Prüft die Bereichsfilterung des Almanac-State-Gateways bei Zeitfortschritt.
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
    InMemoryCalendarRepository,
    InMemoryEventRepository,
    InMemoryPhenomenonRepository,
} from "../../../src/apps/almanac/data/in-memory-repository";
import { AlmanacMemoryBackend } from "../../../src/apps/almanac/data/memory-backend";
import { InMemoryStateGateway } from "../../../src/apps/almanac/data/in-memory-gateway";
import {
    VaultCalendarRepository,
    VaultEventRepository,
    VaultAlmanacRepository,
} from "../../../src/apps/almanac/data/vault-repositories";
import { VaultCalendarStateGateway } from "../../../src/apps/almanac/data/vault-calendar-state-gateway";
import { createSingleEvent } from "../../../src/apps/almanac/domain/calendar-event";
import {
    createHourTimestamp,
    createDayTimestamp,
    type CalendarTimestamp,
    compareTimestampsWithSchema,
} from "../../../src/apps/almanac/domain/calendar-timestamp";
import { getEventAnchorTimestamp } from "../../../src/apps/almanac/domain/calendar-event";
import { CartographerHookGateway } from "../../../src/apps/almanac/mode/cartographer-gateway";
import {
    gregorianSchema,
    GREGORIAN_CALENDAR_ID,
} from "../../../src/apps/almanac/fixtures/gregorian.fixture";
import { TAbstractFile, TFile } from "obsidian";
import type { VaultLike } from "../../../src/apps/almanac/data/json-store";

const startOfJanFirst = createHourTimestamp(GREGORIAN_CALENDAR_ID, 2024, "jan", 1, 0);

const toIdList = (events: Array<{ id: string }>) => events.map(event => event.id);

const flushGateway = async (instance: unknown): Promise<void> => {
    if (
        instance &&
        typeof instance === "object" &&
        typeof (instance as { flushPendingPersistence?: () => Promise<void> }).flushPendingPersistence === "function"
    ) {
        await (instance as { flushPendingPersistence: () => Promise<void> }).flushPendingPersistence();
    }
};

describe("InMemoryStateGateway.advanceTimeBy", () => {
    let calendarRepo: InMemoryCalendarRepository;
    let eventRepo: InMemoryEventRepository;
    let phenomenonRepo: InMemoryPhenomenonRepository;
    let gateway: InMemoryStateGateway;

    beforeEach(async () => {
        const backend = new AlmanacMemoryBackend();
        calendarRepo = new InMemoryCalendarRepository(backend);
        eventRepo = new InMemoryEventRepository(backend);
        phenomenonRepo = new InMemoryPhenomenonRepository(backend);
        gateway = new InMemoryStateGateway(calendarRepo, eventRepo, phenomenonRepo);

        calendarRepo.seed([gregorianSchema]);
        eventRepo.seed([
            createSingleEvent(
                "evt-before",
                GREGORIAN_CALENDAR_ID,
                "Night Watch",
                createHourTimestamp(GREGORIAN_CALENDAR_ID, 2024, "jan", 1, 0)
            ),
            createSingleEvent(
                "evt-hour",
                GREGORIAN_CALENDAR_ID,
                "Sunrise Patrol",
                createHourTimestamp(GREGORIAN_CALENDAR_ID, 2024, "jan", 1, 6)
            ),
            createSingleEvent(
                "evt-day",
                GREGORIAN_CALENDAR_ID,
                "Festival Day",
                createDayTimestamp(GREGORIAN_CALENDAR_ID, 2024, "jan", 2)
            ),
            createSingleEvent(
                "evt-outside",
                GREGORIAN_CALENDAR_ID,
                "Next Week Planning",
                createDayTimestamp(GREGORIAN_CALENDAR_ID, 2024, "jan", 8)
            ),
        ]);

        phenomenonRepo.seed([
            {
                id: "phen-harvest",
                name: "Harvest Festival",
                category: "holiday",
                visibility: "selected",
                appliesToCalendarIds: [GREGORIAN_CALENDAR_ID],
                rule: { type: 'annual_offset', offsetDayOfYear: 2 },
                timePolicy: "all_day",
                priority: 3,
                schemaVersion: "1.0.0",
            },
        ]);

        await gateway.setActiveCalendar(gregorianSchema.id, { initialTimestamp: startOfJanFirst });
    });

    it("liefert nur Ereignisse zwischen altem und neuem Zeitpunkt", async () => {
        const result = await gateway.advanceTimeBy(1, "day");

        expect(result.timestamp.year).toBe(2024);
        expect(result.timestamp.monthId).toBe("jan");
        expect(result.timestamp.day).toBe(2);

        expect(toIdList(result.triggeredEvents)).toEqual(["evt-hour", "evt-day"]);
    });

    it("behandelt auch umgekehrte Zeitspannen korrekt", async () => {
        await gateway.advanceTimeBy(1, "day");

        const backwardsStart: CalendarTimestamp = createDayTimestamp(
            GREGORIAN_CALENDAR_ID,
            2024,
            "jan",
            2
        );
        const backwardsEnd: CalendarTimestamp = createHourTimestamp(
            GREGORIAN_CALENDAR_ID,
            2024,
            "jan",
            1,
            0
        );

        const reversed = await eventRepo.getEventsInRange(
            gregorianSchema.id,
            gregorianSchema,
            backwardsStart,
            backwardsEnd
        );

        const [normalisedStart] =
            compareTimestampsWithSchema(gregorianSchema, backwardsStart, backwardsEnd) <= 0
                ? [backwardsStart, backwardsEnd]
                : [backwardsEnd, backwardsStart];
        const filtered = reversed.filter(event =>
            compareTimestampsWithSchema(
                gregorianSchema,
                getEventAnchorTimestamp(event) ?? event.date,
                normalisedStart
            ) > 0
        );

        expect(toIdList(filtered)).toEqual(["evt-hour", "evt-day"]);
    });

    it("liefert anstehende Phänomene im Snapshot", async () => {
        const snapshot = await gateway.loadSnapshot();

        expect(snapshot.upcomingPhenomena).toHaveLength(1);
        expect(snapshot.upcomingPhenomena[0]?.phenomenonId).toBe("phen-harvest");
        expect(snapshot.upcomingPhenomena[0]?.timestamp.day).toBe(2);
    });

    it("führt Phänomene beim Zeitfortschritt", async () => {
        const result = await gateway.advanceTimeBy(1, "day");

        expect(result.triggeredPhenomena).toHaveLength(1);
        expect(result.triggeredPhenomena[0]?.phenomenonId).toBe("phen-harvest");
        expect(result.upcomingPhenomena[0]?.phenomenonId).toBe("phen-harvest");
    });
});

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
    private readonly files = new Map<string, MemoryFile>();
    private readonly folders = new Set<string>();

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

    readRaw(path: string): string {
        return this.files.get(path)?.data ?? "";
    }
}

describe("VaultCalendarStateGateway persistence", () => {
    it("persistiert Zeitfortschritt, CRUD-Operationen und Cartographer-Hooks", async () => {
        const vault = new MemoryVault();
        const calendarRepo = new VaultCalendarRepository(vault);
        const eventRepo = new VaultEventRepository(calendarRepo, vault);
        const almanacRepo = new VaultAlmanacRepository(calendarRepo, vault);
        const cartographer = new CartographerHookGateway();
        const gateway = new VaultCalendarStateGateway(
            calendarRepo,
            eventRepo,
            almanacRepo,
            vault,
            cartographer,
        );

        await calendarRepo.createCalendar({ ...gregorianSchema, isDefaultGlobal: true });
        await calendarRepo.setDefault({ calendarId: gregorianSchema.id, scope: "global" });

        const startTimestamp = createDayTimestamp(GREGORIAN_CALENDAR_ID, 2024, "jan", 1);
        await gateway.setActiveCalendar(gregorianSchema.id, { initialTimestamp: startTimestamp });
        await gateway.setCurrentTimestamp(startTimestamp);

        const triggeredEvent = createSingleEvent(
            "evt-vault",
            GREGORIAN_CALENDAR_ID,
            "Vault Hook",
            createDayTimestamp(GREGORIAN_CALENDAR_ID, 2024, "jan", 2),
        );
        const removableEvent = createSingleEvent(
            "evt-remove",
            GREGORIAN_CALENDAR_ID,
            "Remove Me",
            createDayTimestamp(GREGORIAN_CALENDAR_ID, 2024, "jan", 3),
        );
        await eventRepo.createEvent(triggeredEvent);
        await eventRepo.createEvent(removableEvent);

        const persistentPhenomenon = {
            id: "phen-persist",
            name: "Vault Alignment",
            category: "astronomy" as const,
            visibility: "selected" as const,
            appliesToCalendarIds: [GREGORIAN_CALENDAR_ID],
            rule: { type: "annual_offset" as const, offsetDayOfYear: 2 },
            timePolicy: "all_day" as const,
            priority: 5,
            schemaVersion: "1.0.0",
        };
        const transientPhenomenon = {
            id: "phen-transient",
            name: "Vault Tempest",
            category: "weather" as const,
            visibility: "selected" as const,
            appliesToCalendarIds: [GREGORIAN_CALENDAR_ID],
            rule: { type: "annual_offset" as const, offsetDayOfYear: 10 },
            timePolicy: "all_day" as const,
            priority: 2,
            schemaVersion: "1.0.0",
        };
        await almanacRepo.upsertPhenomenon(persistentPhenomenon);
        await almanacRepo.upsertPhenomenon(transientPhenomenon);

        const hookListener = vi.fn();
        const unsubscribe = cartographer.onHookDispatched(hookListener);

        const result = await gateway.advanceTimeBy(1, "day");

        await eventRepo.updateEvent(triggeredEvent.id, { title: "Vault Hook Updated" });
        await eventRepo.deleteEvent(removableEvent.id);
        await almanacRepo.deletePhenomenon(transientPhenomenon.id);
        unsubscribe();

        expect(result.triggeredEvents.map(event => event.id)).toContain("evt-vault");
        expect(result.triggeredPhenomena.map(occurrence => occurrence.phenomenonId)).toContain(
            persistentPhenomenon.id,
        );
        expect(hookListener).toHaveBeenCalledTimes(1);
        const hookPayload = hookListener.mock.calls[0][0];
        expect(hookPayload.scope).toBe("global");
        expect(hookPayload.events.map(event => event.eventId)).toContain("evt-vault");

        const reloadCalendarRepo = new VaultCalendarRepository(vault);
        const reloadEventRepo = new VaultEventRepository(reloadCalendarRepo, vault);
        const reloadPhenomenonRepo = new VaultAlmanacRepository(reloadCalendarRepo, vault);
        const reloadGateway = new VaultCalendarStateGateway(
            reloadCalendarRepo,
            reloadEventRepo,
            reloadPhenomenonRepo,
            vault,
        );

        await reloadGateway.loadSnapshot();
        const persistedTimestamp = reloadGateway.getCurrentTimestamp();
        expect(persistedTimestamp?.day).toBe(2);

        const storedEvents = await reloadEventRepo.listEvents(gregorianSchema.id);
        expect(storedEvents.some(event => event.id === "evt-vault" && event.title === "Vault Hook Updated")).toBe(true);
        expect(storedEvents.some(event => event.id === "evt-remove")).toBe(false);

        const storedPhenomenon = await reloadPhenomenonRepo.getPhenomenon(persistentPhenomenon.id);
        expect(storedPhenomenon?.name).toBe("Vault Alignment");
        const removedPhenomenon = await reloadPhenomenonRepo.getPhenomenon(transientPhenomenon.id);
        expect(removedPhenomenon).toBeNull();

        expect(vault.readRaw("SaltMarcher/Almanac/state.json")).toContain("\"currentTimestamp\"");
    });

    it("debounced Updates für Präferenzen und Travel-Leaves bündelt", async () => {
        vi.useFakeTimers();
        const vault = new MemoryVault();
        const calendarRepo = new VaultCalendarRepository(vault);
        const eventRepo = new VaultEventRepository(calendarRepo, vault);
        const almanacRepo = new VaultAlmanacRepository(calendarRepo, vault);
        const gateway = new VaultCalendarStateGateway(
            calendarRepo,
            eventRepo,
            almanacRepo,
            vault,
        );

        try {
            await calendarRepo.createCalendar({ ...gregorianSchema, isDefaultGlobal: true });
            await calendarRepo.setDefault({ calendarId: gregorianSchema.id, scope: "global" });
            await gateway.loadSnapshot();

            const modifySpy = vi.spyOn(vault, "modify");
            modifySpy.mockClear();

            const preferencesPromise = gateway.savePreferences({ lastMode: "events" });
            const travelPromise = gateway.saveTravelLeafPreferences("travel/bundle.hex", {
                visible: false,
                mode: "day",
                lastViewedTimestamp: null,
            });

            expect(modifySpy).not.toHaveBeenCalled();

            await vi.runAllTimersAsync();

            await Promise.all([preferencesPromise, travelPromise]);
            await flushGateway(gateway);

            expect(modifySpy).toHaveBeenCalledTimes(1);

            const payload = JSON.parse(vault.readRaw("SaltMarcher/Almanac/state.json"));
            expect(payload.data.preferences.lastMode).toBe("events");
            expect(payload.data.travelLeaf["travel/bundle.hex"].visible).toBe(false);
        } finally {
            vi.useRealTimers();
        }
    });
});
