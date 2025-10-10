// tests/apps/almanac/state-machine.manager.test.ts
// Verifies calendar creation flows in the Almanac manager state machine.

import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  AlmanacMemoryBackend,
  InMemoryCalendarRepository,
  InMemoryEventRepository,
  InMemoryPhenomenonRepository,
} from "../../../src/apps/almanac/data/repositories";
import { InMemoryStateGateway } from "../../../src/apps/almanac/data/calendar-state-gateway";
import { AlmanacStateMachine } from "../../../src/apps/almanac/mode/state-machine";
import {
    createSampleEvents,
    getDefaultCurrentTimestamp,
    gregorianSchema,
} from "../../../src/apps/almanac/fixtures/gregorian.fixture";
import { createSamplePhenomena } from "../../../src/apps/almanac/fixtures/phenomena.fixture";

const flushGateway = async (instance: unknown): Promise<void> => {
    if (
        instance &&
        typeof instance === "object" &&
        typeof (instance as { flushPendingPersistence?: () => Promise<void> }).flushPendingPersistence === "function"
    ) {
        await (instance as { flushPendingPersistence: () => Promise<void> }).flushPendingPersistence();
    }
};

describe("AlmanacStateMachine calendar creation", () => {
    let backend: AlmanacMemoryBackend;
    let calendarRepo: InMemoryCalendarRepository;
    let eventRepo: InMemoryEventRepository;
    let phenomenonRepo: InMemoryPhenomenonRepository;
    let gateway: InMemoryStateGateway;
    let stateMachine: AlmanacStateMachine;

    beforeEach(async () => {
        backend = new AlmanacMemoryBackend();
        calendarRepo = new InMemoryCalendarRepository(backend);
        eventRepo = new InMemoryEventRepository(backend);
        phenomenonRepo = new InMemoryPhenomenonRepository(backend);
        gateway = new InMemoryStateGateway(calendarRepo, eventRepo, phenomenonRepo);

        calendarRepo.seed([gregorianSchema]);
        eventRepo.seed(createSampleEvents(2024));
        phenomenonRepo.seed(createSamplePhenomena());

        await gateway.setActiveCalendar(
            gregorianSchema.id,
            { initialTimestamp: getDefaultCurrentTimestamp(2024) },
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

    it("persists mode selection via gateway preferences", async () => {
        const saveSpy = vi.spyOn(gateway, 'savePreferences');
        await stateMachine.dispatch({ type: "ALMANAC_MODE_SELECTED", mode: "events" });
        await flushGateway(gateway);
        const preferences = await gateway.loadPreferences();
        expect(preferences.lastMode).toBe("events");
        expect(saveSpy).toHaveBeenCalledWith(expect.objectContaining({ lastMode: "events" }));
    });

    it("updates calendar view mode and persists the preference", async () => {
        const saveSpy = vi.spyOn(gateway, 'savePreferences');
        await stateMachine.dispatch({ type: "CALENDAR_VIEW_MODE_CHANGED", mode: "day" });
        await flushGateway(gateway);

        const state = stateMachine.getState();
        expect(state.calendarViewState.mode).toBe("day");
        expect(state.calendarViewState.isLoading).toBe(false);
        expect(state.calendarViewState.events.some(event => event.title === "New Year's Day")).toBe(true);

        const preferences = await gateway.loadPreferences();
        expect(preferences.calendarViewMode).toBe("day");
        expect(saveSpy).toHaveBeenCalledWith(expect.objectContaining({ calendarViewMode: "day" }));
        saveSpy.mockRestore();
    });

    it("keeps manager and calendar anchors in sync when navigating to the next period", async () => {
        const initialState = stateMachine.getState();
        const baseTimestamp = initialState.calendarState.currentTimestamp;
        expect(baseTimestamp).not.toBeNull();

        await stateMachine.dispatch({ type: "MANAGER_NAVIGATION_REQUESTED", direction: "next" });

        const navigated = stateMachine.getState();
        expect(navigated.managerUiState.anchorTimestamp).not.toBeNull();
        expect(navigated.managerUiState.anchorTimestamp?.monthId).toBe("feb");
        expect(navigated.calendarViewState.anchorTimestamp?.monthId).toBe("feb");
        expect(navigated.calendarViewState.events).toEqual(navigated.managerUiState.agendaItems);
        expect(navigated.calendarViewState.events.map(event => event.title)).toContain("Valentine's Day");
        expect(navigated.managerUiState.jumpPreview).toEqual([]);
    });

    it("realigns both views when navigating back to today", async () => {
        await stateMachine.dispatch({ type: "MANAGER_NAVIGATION_REQUESTED", direction: "next" });
        const afterNext = stateMachine.getState();
        const currentTimestamp = afterNext.calendarState.currentTimestamp;
        expect(currentTimestamp).not.toBeNull();

        await stateMachine.dispatch({ type: "MANAGER_NAVIGATION_REQUESTED", direction: "today" });

        const reset = stateMachine.getState();
        expect(reset.managerUiState.anchorTimestamp).toEqual(currentTimestamp);
        expect(reset.calendarViewState.anchorTimestamp).toEqual(currentTimestamp);
        expect(reset.calendarViewState.events).toEqual(reset.managerUiState.agendaItems);
        expect(reset.calendarViewState.events.map(event => event.title)).toContain("New Year's Day");
    });

    it("restores the persisted calendar view mode on initialisation", async () => {
        await gateway.savePreferences({ calendarViewMode: "week" });
        await flushGateway(gateway);

        const freshMachine = new AlmanacStateMachine(
            calendarRepo,
            eventRepo,
            gateway,
            phenomenonRepo,
        );
        await freshMachine.dispatch({ type: "INIT_ALMANAC" });

        const restored = freshMachine.getState();
        expect(restored.calendarViewState.mode).toBe("week");
        expect(restored.calendarViewState.isLoading).toBe(false);
        expect(restored.calendarViewState.events.length).toBeGreaterThan(0);
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

    it("updates calendar time definition and persists changes", async () => {
        await stateMachine.dispatch({ type: "CALENDAR_EDIT_REQUESTED", calendarId: gregorianSchema.id });
        await stateMachine.dispatch({
            type: "CALENDAR_EDIT_FORM_UPDATED",
            calendarId: gregorianSchema.id,
            field: "minuteStep",
            value: "5",
        });

        await stateMachine.dispatch({ type: "CALENDAR_UPDATE_REQUESTED", calendarId: gregorianSchema.id });

        const updated = await calendarRepo.getCalendar(gregorianSchema.id);
        expect(updated?.minuteStep).toBe(5);

        const state = stateMachine.getState();
        expect(state.managerUiState.editStateById[gregorianSchema.id]?.draft.minuteStep).toBe("5");
        expect(state.managerUiState.conflictDialog).toBeNull();
    });

    it("surfaces conflicts when minute step breaks existing events", async () => {
        await stateMachine.dispatch({ type: "CALENDAR_EDIT_REQUESTED", calendarId: gregorianSchema.id });
        await stateMachine.dispatch({
            type: "CALENDAR_EDIT_FORM_UPDATED",
            calendarId: gregorianSchema.id,
            field: "minuteStep",
            value: "7",
        });

        await stateMachine.dispatch({ type: "CALENDAR_UPDATE_REQUESTED", calendarId: gregorianSchema.id });

        const state = stateMachine.getState();
        const editState = state.managerUiState.editStateById[gregorianSchema.id];
        expect(editState?.errors.length).toBeGreaterThan(0);
        expect(state.managerUiState.conflictDialog?.kind).toBe("update");
        const repoSnapshot = await calendarRepo.getCalendar(gregorianSchema.id);
        expect(repoSnapshot?.minuteStep).toBe(gregorianSchema.minuteStep);
    });

    it("handles repository errors during calendar update", async () => {
        const spy = vi.spyOn(calendarRepo, "updateCalendar").mockRejectedValue(new Error("write failed"));

        await stateMachine.dispatch({ type: "CALENDAR_EDIT_REQUESTED", calendarId: gregorianSchema.id });
        await stateMachine.dispatch({
            type: "CALENDAR_EDIT_FORM_UPDATED",
            calendarId: gregorianSchema.id,
            field: "minutesPerHour",
            value: "42",
        });

        await stateMachine.dispatch({ type: "CALENDAR_UPDATE_REQUESTED", calendarId: gregorianSchema.id });

        const state = stateMachine.getState();
        const editState = state.managerUiState.editStateById[gregorianSchema.id];
        expect(editState?.errors).toContain("write failed");
        spy.mockRestore();
    });

    it("deletes calendars and clears travel defaults", async () => {
        const expeditionSchema = {
            ...gregorianSchema,
            id: "expedition-calendar",
            name: "Expedition Calendar",
            minuteStep: 10,
            months: gregorianSchema.months.map(month => ({ ...month })),
        };
        await calendarRepo.createCalendar(expeditionSchema);
        await calendarRepo.setDefault({ calendarId: expeditionSchema.id, scope: "travel", travelId: "travel-1" });

        await stateMachine.dispatch({ type: "CALENDAR_DATA_REFRESH_REQUESTED" });
        await stateMachine.dispatch({ type: "CALENDAR_DEFAULT_SET_REQUESTED", calendarId: expeditionSchema.id });

        await stateMachine.dispatch({ type: "CALENDAR_DELETE_REQUESTED", calendarId: expeditionSchema.id });
        await stateMachine.dispatch({ type: "CALENDAR_DELETE_CONFIRMED", calendarId: expeditionSchema.id });

        const afterDelete = await calendarRepo.getCalendar(expeditionSchema.id);
        expect(afterDelete).toBeNull();
        const defaults = await calendarRepo.getDefaults();
        expect(defaults.travel["travel-1"]).toBeUndefined();

        const state = stateMachine.getState();
        expect(state.managerUiState.deleteDialog).toBeNull();
        expect(state.managerUiState.conflictDialog).toBeNull();
        expect(state.calendarState.calendars.some(schema => schema.id === expeditionSchema.id)).toBe(false);
        expect(state.calendarState.defaultCalendarId).not.toBe(expeditionSchema.id);
    });

    it("blocks deletion when phenomena are linked to the calendar", async () => {
        await stateMachine.dispatch({ type: "CALENDAR_DELETE_REQUESTED", calendarId: gregorianSchema.id });
        await stateMachine.dispatch({ type: "CALENDAR_DELETE_CONFIRMED", calendarId: gregorianSchema.id });

        const state = stateMachine.getState();
        expect(state.managerUiState.conflictDialog?.kind).toBe("delete");
        expect(state.managerUiState.deleteDialog?.error).toContain("cannot be deleted");

        const stillPresent = await calendarRepo.getCalendar(gregorianSchema.id);
        expect(stillPresent).not.toBeNull();
    });
});

