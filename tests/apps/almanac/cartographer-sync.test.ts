// tests/apps/almanac/cartographer-sync.test.ts
// Prüft die Synchronisation zwischen Almanac-State-Machine und dem Cartographer-Hook-Gateway.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { InMemoryStateGateway } from "../../../src/apps/almanac/data/in-memory-gateway";
import {
    InMemoryCalendarRepository,
    InMemoryEventRepository,
    InMemoryPhenomenonRepository,
} from "../../../src/apps/almanac/data/in-memory-repository";
import { AlmanacMemoryBackend } from "../../../src/apps/almanac/data/memory-backend";
import {
    createDayTimestamp,
    createHourTimestamp,
    type CalendarTimestamp,
} from "../../../src/apps/almanac/domain/calendar-core";
import { createSingleEvent } from "../../../src/apps/almanac/domain/scheduling";
import { AlmanacStateMachine } from "../../../src/apps/almanac/mode/state-machine";
import { CartographerHookGateway } from "../../../src/apps/almanac/mode/cartographer-gateway";
import {
    registerCartographerBridge,
    resetCartographerBridge,
} from "../../../src/apps/almanac/mode/cartographer-bridge";
import {
    gregorianSchema,
    GREGORIAN_CALENDAR_ID,
} from "../../../src/apps/almanac/fixtures/gregorian.fixture";

const flushGateway = async (instance: unknown): Promise<void> => {
    if (
        instance &&
        typeof instance === "object" &&
        typeof (instance as { flushPendingPersistence?: () => Promise<void> }).flushPendingPersistence === "function"
    ) {
        await (instance as { flushPendingPersistence: () => Promise<void> }).flushPendingPersistence();
    }
};

describe("Cartographer sync gateway", () => {
    let backend: AlmanacMemoryBackend;
    let calendarRepo: InMemoryCalendarRepository;
    let eventRepo: InMemoryEventRepository;
    let phenomenonRepo: InMemoryPhenomenonRepository;
    let gateway: InMemoryStateGateway;
    let cartographerGateway: CartographerHookGateway;
    let machine: AlmanacStateMachine;
    const travelId = "maps/travel-bridge.hex";

    const startTimestamp: CalendarTimestamp = createHourTimestamp(
        GREGORIAN_CALENDAR_ID,
        2024,
        "jan",
        1,
        0,
    );

    beforeEach(async () => {
        cartographerGateway = new CartographerHookGateway();
        backend = new AlmanacMemoryBackend();
        calendarRepo = new InMemoryCalendarRepository(backend);
        eventRepo = new InMemoryEventRepository(backend);
        phenomenonRepo = new InMemoryPhenomenonRepository(backend);
        gateway = new InMemoryStateGateway(calendarRepo, eventRepo, phenomenonRepo, cartographerGateway);

        calendarRepo.seed([gregorianSchema]);
        await calendarRepo.setDefault({ calendarId: gregorianSchema.id, scope: "global" });
        eventRepo.seed([
            createSingleEvent(
                "evt-dawn",
                GREGORIAN_CALENDAR_ID,
                "Morning Patrol",
                createHourTimestamp(GREGORIAN_CALENDAR_ID, 2024, "jan", 1, 6),
            ),
            createSingleEvent(
                "evt-festival",
                GREGORIAN_CALENDAR_ID,
                "Festival Day",
                createDayTimestamp(GREGORIAN_CALENDAR_ID, 2024, "jan", 2),
            ),
        ]);

        await gateway.setActiveCalendar(gregorianSchema.id, {
            initialTimestamp: startTimestamp,
        });
        await gateway.setCurrentTimestamp(startTimestamp);
        await gateway.setActiveCalendar(gregorianSchema.id, {
            travelId,
            initialTimestamp: startTimestamp,
        });
        await gateway.setCurrentTimestamp(startTimestamp, { travelId });

        machine = new AlmanacStateMachine(calendarRepo, eventRepo, gateway, phenomenonRepo, cartographerGateway);
        await machine.dispatch({ type: "INIT_ALMANAC", travelId });
    });

    afterEach(() => {
        resetCartographerBridge();
    });

    it("publishes an initial panel snapshot for travel context", () => {
        const panel = cartographerGateway.getPanelSnapshot(travelId);
        expect(panel).not.toBeNull();
        expect(panel?.reason).toBe("init");
        expect(panel?.timestampLabel).toContain("jan");
    });

    it("dispatches hooks and updates the travel panel on advance", async () => {
        const hookListener = vi.fn();
        cartographerGateway.onHookDispatched(hookListener);

        await machine.dispatch({ type: "TIME_ADVANCE_REQUESTED", amount: 1, unit: "day" });

        expect(hookListener).toHaveBeenCalledTimes(1);
        const payload = hookListener.mock.calls[0][0];
        expect(payload.scope).toBe("travel");
        expect(payload.travelId).toBe(travelId);
        expect(payload.events.map((evt) => evt.eventId)).toContain("evt-festival");

        const panel = cartographerGateway.getPanelSnapshot(travelId);
        expect(panel?.lastAdvanceStep).toEqual({ amount: 1, unit: "day" });
        expect(panel?.logEntries.some((entry) => entry.id === "evt-festival")).toBe(true);
    });

    it("marks skipped events in jump updates", async () => {
        const target = createDayTimestamp(GREGORIAN_CALENDAR_ID, 2024, "jan", 3);
        await machine.dispatch({ type: "TIME_JUMP_REQUESTED", timestamp: target });

        const panel = cartographerGateway.getPanelSnapshot(travelId);
        expect(panel?.reason).toBe("jump");
        const skipped = panel?.logEntries.filter((entry) => entry.skipped) ?? [];
        expect(skipped.map((entry) => entry.id)).toContain("evt-festival");
    });

    it("propagates hook failures for travel scope", async () => {
        const failingGateway = new CartographerHookGateway();
        failingGateway.onHookDispatched(() => {
            throw new Error("cartographer offline");
        });

        const altBackend = new AlmanacMemoryBackend();
        const altCalendarRepo = new InMemoryCalendarRepository(altBackend);
        const altEventRepo = new InMemoryEventRepository(altBackend);
        const altPhenomenonRepo = new InMemoryPhenomenonRepository(altBackend);
        const altGateway = new InMemoryStateGateway(
            altCalendarRepo,
            altEventRepo,
            altPhenomenonRepo,
            failingGateway,
        );

        altCalendarRepo.seed([gregorianSchema]);
        await altCalendarRepo.setDefault({ calendarId: gregorianSchema.id, scope: "global" });
        altEventRepo.seed([
            createSingleEvent(
                "evt-midnight",
                GREGORIAN_CALENDAR_ID,
                "Night Watch",
                createDayTimestamp(GREGORIAN_CALENDAR_ID, 2024, "jan", 2),
            ),
        ]);

        await altGateway.setActiveCalendar(gregorianSchema.id, { initialTimestamp: startTimestamp });
        await altGateway.setCurrentTimestamp(startTimestamp);
        await altGateway.setActiveCalendar(gregorianSchema.id, {
            travelId: "maps/failure.hex",
            initialTimestamp: startTimestamp,
        });
        await altGateway.setCurrentTimestamp(startTimestamp, { travelId: "maps/failure.hex" });

        const altMachine = new AlmanacStateMachine(
            altCalendarRepo,
            altEventRepo,
            altGateway,
            altPhenomenonRepo,
            failingGateway,
        );
        await altMachine.dispatch({ type: "INIT_ALMANAC", travelId: "maps/failure.hex" });

        await altMachine.dispatch({ type: "TIME_ADVANCE_REQUESTED", amount: 1, unit: "day" });
        expect(altMachine.getState().almanacUiState.error).toMatch(/cartographer offline/);
    });

    it("emits travel lifecycle events", () => {
        const starts: string[] = [];
        const ends: string[] = [];
        const unsubStart = cartographerGateway.onTravelStart((id) => {
            if (id) starts.push(id);
        });
        const unsubEnd = cartographerGateway.onTravelEnd((id) => {
            if (id) ends.push(id);
        });

        cartographerGateway.emitTravelStart("maps/lifecycle.hex");
        cartographerGateway.emitTravelEnd("maps/lifecycle.hex");

        unsubStart();
        unsubEnd();

        expect(starts).toEqual(["maps/lifecycle.hex"]);
        expect(ends).toEqual(["maps/lifecycle.hex"]);
    });

    it("restores travel leaf preferences on mount and persists visibility", async () => {
        const travelPrefsGateway = new CartographerHookGateway();
        const altGateway = new InMemoryStateGateway(
            calendarRepo,
            eventRepo,
            phenomenonRepo,
            travelPrefsGateway,
        );

        await altGateway.setActiveCalendar(gregorianSchema.id, { travelId, initialTimestamp: startTimestamp });
        await altGateway.setCurrentTimestamp(startTimestamp, { travelId });
        await altGateway.saveTravelLeafPreferences(travelId, {
            visible: false,
            mode: "day",
            lastViewedTimestamp: startTimestamp,
        });

        const prefMachine = new AlmanacStateMachine(
            calendarRepo,
            eventRepo,
            altGateway,
            phenomenonRepo,
            travelPrefsGateway,
        );
        await prefMachine.dispatch({ type: "INIT_ALMANAC", travelId });

        expect(prefMachine.getState().travelLeafState.mode).toBe("day");
        expect(prefMachine.getState().travelLeafState.visible).toBe(false);

        await prefMachine.dispatch({ type: "TRAVEL_LEAF_MOUNTED", travelId });
        expect(prefMachine.getState().travelLeafState.visible).toBe(true);

        await flushGateway(altGateway);
        const prefs = await altGateway.getTravelLeafPreferences(travelId);
        expect(prefs?.visible).toBe(true);
    });

    it("persists travel mode changes", async () => {
        await machine.dispatch({ type: "TRAVEL_LEAF_MOUNTED", travelId });
        await machine.dispatch({ type: "TRAVEL_MODE_CHANGED", mode: "day" });

        expect(machine.getState().travelLeafState.mode).toBe("day");
        await flushGateway(gateway);
        const prefs = await gateway.getTravelLeafPreferences(travelId);
        expect(prefs?.mode).toBe("day");
    });

    it("handles travel quick advances and updates preferences", async () => {
        await machine.dispatch({ type: "TRAVEL_LEAF_MOUNTED", travelId });
        await machine.dispatch({ type: "TRAVEL_TIME_ADVANCE_REQUESTED", amount: 1, unit: "hour" });

        const state = machine.getState();
        expect(state.travelLeafState.isLoading).toBe(false);
        expect(state.travelLeafState.lastQuickStep).toEqual({ amount: 1, unit: "hour" });
        const panel = cartographerGateway.getPanelSnapshot(travelId);
        expect(panel?.lastAdvanceStep).toEqual({ amount: 1, unit: "hour" });

        await flushGateway(gateway);
        const prefs = await gateway.getTravelLeafPreferences(travelId);
        expect(prefs?.lastViewedTimestamp?.hour).toBe(1);
    });

    it("bridges cartographer quick steps into the Almanac state machine", async () => {
        const bridge = registerCartographerBridge(machine);
        await bridge.mount(travelId);

        await bridge.handlers.onAdvance({ amount: 1, unit: "hour" });

        const stateAfterAdvance = machine.getState();
        expect(stateAfterAdvance.travelLeafState.lastQuickStep).toEqual({ amount: 1, unit: "hour" });
        const panel = cartographerGateway.getPanelSnapshot(travelId);
        expect(panel?.lastAdvanceStep).toEqual({ amount: 1, unit: "hour" });

        await bridge.handlers.onModeChange("day");
        expect(machine.getState().travelLeafState.mode).toBe("day");

        await bridge.handlers.onFollowUp("evt-dawn");
        expect(machine.getState().almanacUiState.mode).toBe("events");

        bridge.release();
    });
});

