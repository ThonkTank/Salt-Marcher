// tests/apps/almanac/cartographer-sync.test.ts
// Prüft die Synchronisation zwischen Almanac-State-Machine und dem Cartographer-Hook-Gateway.
import { beforeEach, describe, expect, it, vi } from "vitest";

import { InMemoryStateGateway } from "../../../src/apps/almanac/data/in-memory-gateway";
import {
    InMemoryCalendarRepository,
    InMemoryEventRepository,
    InMemoryPhenomenonRepository,
} from "../../../src/apps/almanac/data/in-memory-repository";
import { createSingleEvent } from "../../../src/apps/almanac/domain/calendar-event";
import {
    createDayTimestamp,
    createHourTimestamp,
    type CalendarTimestamp,
} from "../../../src/apps/almanac/domain/calendar-timestamp";
import { AlmanacStateMachine } from "../../../src/apps/almanac/mode/state-machine";
import { CartographerHookGateway } from "../../../src/apps/almanac/mode/cartographer-gateway";
import {
    gregorianSchema,
    GREGORIAN_CALENDAR_ID,
} from "../../../src/apps/almanac/fixtures/gregorian.fixture";

describe("Cartographer sync gateway", () => {
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
        calendarRepo = new InMemoryCalendarRepository();
        eventRepo = new InMemoryEventRepository();
        eventRepo.bindCalendarRepository(calendarRepo);
        phenomenonRepo = new InMemoryPhenomenonRepository();
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

        const altCalendarRepo = new InMemoryCalendarRepository();
        const altEventRepo = new InMemoryEventRepository();
        altEventRepo.bindCalendarRepository(altCalendarRepo);
        const altPhenomenonRepo = new InMemoryPhenomenonRepository();
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
});

