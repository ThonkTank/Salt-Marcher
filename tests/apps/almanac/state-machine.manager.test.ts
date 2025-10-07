// tests/apps/almanac/state-machine.manager.test.ts
// Verifies calendar creation flows in the Almanac manager state machine.

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

describe("AlmanacStateMachine calendar creation", () => {
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

    it("creates a new calendar draft and activates it", async () => {
        await stateMachine.dispatch({
            type: "MANAGER_CREATE_FORM_UPDATED",
            field: "id",
            value: "travel-calendar",
        });
        await stateMachine.dispatch({
            type: "MANAGER_CREATE_FORM_UPDATED",
            field: "name",
            value: "Travel Calendar",
        });
        await stateMachine.dispatch({
            type: "MANAGER_CREATE_FORM_UPDATED",
            field: "description",
            value: "Calendar used during expeditions.",
        });

        await stateMachine.dispatch({ type: "CALENDAR_CREATE_REQUESTED" });

        const created = await calendarRepo.getCalendar("travel-calendar");
        expect(created).not.toBeNull();
        expect(created?.months).toHaveLength(12);
        expect(created?.daysPerWeek).toBe(7);

        const state = stateMachine.getState();
        expect(state.calendarState.activeCalendarId).toBe("travel-calendar");
        expect(state.managerUiState.createDraft.id).toBe("");
        expect(state.managerUiState.createErrors).toEqual([]);
        expect(state.managerUiState.isCreating).toBe(false);
        expect(state.managerUiState.anchorTimestamp?.calendarId).toBe("travel-calendar");
    });

    it("surfaces validation errors for incomplete drafts", async () => {
        await stateMachine.dispatch({
            type: "MANAGER_CREATE_FORM_UPDATED",
            field: "id",
            value: "   ",
        });
        await stateMachine.dispatch({
            type: "MANAGER_CREATE_FORM_UPDATED",
            field: "name",
            value: " ",
        });
        await stateMachine.dispatch({
            type: "MANAGER_CREATE_FORM_UPDATED",
            field: "monthCount",
            value: "0",
        });

        await stateMachine.dispatch({ type: "CALENDAR_CREATE_REQUESTED" });

        const state = stateMachine.getState();
        expect(state.managerUiState.isCreating).toBe(false);
        expect(state.managerUiState.createErrors).toContain("Identifier is required.");
        expect(state.managerUiState.createErrors).toContain("Name is required.");
        expect(state.managerUiState.createErrors).toContain("Month count must be at least 1.");
        expect(state.calendarState.calendars.some(schema => schema.id === "travel-calendar")).toBe(false);
    });
});

