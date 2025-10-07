// tests/apps/almanac/state-machine.events.test.ts
// Validates that Almanac event filters and selections persist across refreshes.

import { beforeEach, describe, expect, it } from "vitest";

import {
    InMemoryCalendarRepository,
    InMemoryEventRepository,
    InMemoryPhenomenonRepository,
} from "../../../src/apps/almanac/data/in-memory-repository";
import { InMemoryStateGateway } from "../../../src/apps/almanac/data/in-memory-gateway";
import { AlmanacStateMachine } from "../../../src/apps/almanac/mode/state-machine";
import {
    createSampleEvents,
    getDefaultCurrentTimestamp,
    gregorianSchema,
} from "../../../src/apps/almanac/fixtures/gregorian.fixture";
import { createSamplePhenomena } from "../../../src/apps/almanac/fixtures/phenomena.fixture";

describe("AlmanacStateMachine events refresh", () => {
    let calendarRepo: InMemoryCalendarRepository;
    let eventRepo: InMemoryEventRepository;
    let phenomenonRepo: InMemoryPhenomenonRepository;
    let gateway: InMemoryStateGateway;
    let stateMachine: AlmanacStateMachine;

    beforeEach(async () => {
        calendarRepo = new InMemoryCalendarRepository();
        eventRepo = new InMemoryEventRepository();
        eventRepo.bindCalendarRepository(calendarRepo);
        phenomenonRepo = new InMemoryPhenomenonRepository();
        gateway = new InMemoryStateGateway(calendarRepo, eventRepo, phenomenonRepo);

        calendarRepo.seed([gregorianSchema]);
        eventRepo.seed(createSampleEvents(2024));
        phenomenonRepo.seed(createSamplePhenomena());

        await gateway.setActiveCalendar(
            gregorianSchema.id,
            getDefaultCurrentTimestamp(2024),
        );

        stateMachine = new AlmanacStateMachine(
            calendarRepo,
            eventRepo,
            gateway,
            phenomenonRepo,
        );

        await stateMachine.dispatch({ type: "INIT_ALMANAC" });
    });

    it("retains filters and selection after refreshing calendar data", async () => {
        await stateMachine.dispatch({ type: "ALMANAC_MODE_SELECTED", mode: "events" });

        await stateMachine.dispatch({
            type: "EVENTS_FILTER_CHANGED",
            filters: { categories: ["astronomy"], calendarIds: [] },
        });

        await stateMachine.dispatch({
            type: "EVENTS_PHENOMENON_SELECTED",
            phenomenonId: "phen-harvest-moon",
        });

        await phenomenonRepo.upsertPhenomenon({
            id: "phen-aurora",
            name: "Aurora Borealis",
            category: "weather",
            visibility: "selected",
            appliesToCalendarIds: [gregorianSchema.id],
            rule: { type: "annual", offsetDayOfYear: 42 },
            timePolicy: "all_day",
            priority: 4,
            schemaVersion: "1.0.0",
        });

        await stateMachine.dispatch({ type: "CALENDAR_DATA_REFRESH_REQUESTED" });

        const state = stateMachine.getState();
        expect(state.eventsUiState.filters.categories).toEqual(["astronomy"]);
        expect(state.eventsUiState.filters.calendarIds).toEqual([]);
        expect(state.eventsUiState.filterCount).toBe(1);
        expect(state.eventsUiState.selectedPhenomenonId).toBe("phen-harvest-moon");
        expect(state.eventsUiState.selectedPhenomenonDetail?.id).toBe("phen-harvest-moon");
        expect(
            state.eventsUiState.phenomena.every(item => item.category === "astronomy"),
        ).toBe(true);
    });
});
