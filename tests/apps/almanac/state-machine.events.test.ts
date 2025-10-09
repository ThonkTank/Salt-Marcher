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
import { createDayTimestamp } from "../../../src/apps/almanac/domain/calendar-timestamp";
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

        await flushGateway(gateway);
        const preferences = await gateway.loadPreferences();
        expect(preferences.eventsFilters?.categories).toEqual(["astronomy"]);
        expect(preferences.lastSelectedPhenomenonId).toBe("phen-harvest-moon");
    });

    it("applies deep link overrides when reinitialising the Almanac", async () => {
        await stateMachine.dispatch({
            type: "INIT_ALMANAC",
            overrides: {
                mode: "events",
                eventsView: "map",
                calendarViewMode: "week",
                selectedPhenomenonId: "phen-harvest-moon",
            },
        });

        const state = stateMachine.getState();
        expect(state.almanacUiState.mode).toBe("events");
        expect(state.eventsUiState.viewMode).toBe("map");
        expect(state.calendarViewState.mode).toBe("week");
        expect(state.eventsUiState.selectedPhenomenonId).toBe("phen-harvest-moon");
        expect(state.eventsUiState.selectedPhenomenonDetail?.id).toBe("phen-harvest-moon");
    });

    it("generates map markers that track filtered phenomena", async () => {
        await stateMachine.dispatch({ type: "ALMANAC_MODE_SELECTED", mode: "events" });

        const initialState = stateMachine.getState();
        expect(initialState.eventsUiState.mapMarkers).toHaveLength(
            initialState.eventsUiState.phenomena.length,
        );
        const [firstMarker] = initialState.eventsUiState.mapMarkers;
        expect(firstMarker).toBeDefined();
        if (!firstMarker) throw new Error("expected first marker to exist");
        expect(firstMarker.coordinates.x).toBeGreaterThanOrEqual(0.05);
        expect(firstMarker.coordinates.x).toBeLessThanOrEqual(0.95);
        expect(firstMarker.coordinates.y).toBeGreaterThanOrEqual(0.05);
        expect(firstMarker.coordinates.y).toBeLessThanOrEqual(0.95);

        await stateMachine.dispatch({
            type: "EVENTS_FILTER_CHANGED",
            filters: { categories: ["season"], calendarIds: [] },
        });

        const filteredState = stateMachine.getState();
        expect(filteredState.eventsUiState.phenomena.every(item => item.category === "season")).toBe(
            true,
        );
        expect(filteredState.eventsUiState.mapMarkers).toHaveLength(
            filteredState.eventsUiState.phenomena.length,
        );
        expect(
            filteredState.eventsUiState.mapMarkers.every(marker =>
                marker.calendars.every(calendar => typeof calendar.name === "string"),
            ),
        ).toBe(true);
    });

    it("allows creating a phenomenon through the editor", async () => {
        await stateMachine.dispatch({ type: "ALMANAC_MODE_SELECTED", mode: "events" });

        await stateMachine.dispatch({ type: "PHENOMENON_EDIT_REQUESTED" });
        const openState = stateMachine.getState();
        expect(openState.eventsUiState.isEditorOpen).toBe(true);
        const draft = openState.eventsUiState.editorDraft;
        expect(draft).toBeTruthy();
        if (!draft) throw new Error("expected draft to exist");

        const updatedDraft = {
            ...draft,
            name: "Test Phenomenon",
            category: "custom",
        };

        await stateMachine.dispatch({ type: "PHENOMENON_SAVE_REQUESTED", draft: updatedDraft });
        const savedState = stateMachine.getState();
        expect(savedState.eventsUiState.isEditorOpen).toBe(false);
        expect(savedState.eventsUiState.editorDraft).toBeNull();
        expect(savedState.eventsUiState.phenomena.some(item => item.title === "Test Phenomenon")).toBe(true);
    });

    it("supports cancelling the phenomenon editor", async () => {
        await stateMachine.dispatch({ type: "ALMANAC_MODE_SELECTED", mode: "events" });
        await stateMachine.dispatch({ type: "PHENOMENON_EDIT_REQUESTED" });
        await stateMachine.dispatch({ type: "PHENOMENON_EDIT_CANCELLED" });
        const state = stateMachine.getState();
        expect(state.eventsUiState.isEditorOpen).toBe(false);
        expect(state.eventsUiState.editorDraft).toBeNull();
    });

    it("exports and deletes phenomena via bulk actions", async () => {
        await stateMachine.dispatch({ type: "ALMANAC_MODE_SELECTED", mode: "events" });
        await stateMachine.dispatch({
            type: "EVENTS_BULK_SELECTION_UPDATED",
            selection: ["phen-spring-bloom", "phen-harvest-moon"],
        });

        await stateMachine.dispatch({ type: "EVENT_BULK_ACTION_REQUESTED", action: "export" });
        let state = stateMachine.getState();
        expect(state.eventsUiState.lastExportPayload).toContain("phen-spring-bloom");

        await stateMachine.dispatch({ type: "EVENT_BULK_ACTION_REQUESTED", action: "delete" });
        state = stateMachine.getState();
        expect(state.eventsUiState.phenomena.some(item => item.id === "phen-spring-bloom")).toBe(false);
        expect(state.eventsUiState.bulkSelection).toHaveLength(0);
    });

    it("imports phenomena payloads from JSON", async () => {
        await stateMachine.dispatch({ type: "ALMANAC_MODE_SELECTED", mode: "events" });
        const payload = JSON.stringify([
            {
                id: "phen-imported-ui",
                name: "Imported via test",
                category: "custom",
                visibility: "all_calendars",
                appliesToCalendarIds: [],
                rule: { type: "annual", offsetDayOfYear: 12 },
                timePolicy: "all_day",
                priority: 0,
                schemaVersion: "1.0.0",
            },
        ]);

        await stateMachine.dispatch({ type: "EVENT_IMPORT_SUBMITTED", payload });
        const state = stateMachine.getState();
        expect(state.eventsUiState.importSummary?.imported).toBe(1);
        expect(state.eventsUiState.phenomena.some(item => item.id === "phen-imported-ui")).toBe(true);
    });

    it("creates single events via the editor", async () => {
        await stateMachine.dispatch({ type: "ALMANAC_MODE_SELECTED", mode: "events" });
        await stateMachine.dispatch({ type: "EVENT_CREATE_REQUESTED", mode: "single" });

        let state = stateMachine.getState();
        const draft = state.eventsUiState.eventEditorDraft;
        expect(draft).toBeTruthy();
        if (!draft) throw new Error("expected draft to exist");

        await stateMachine.dispatch({
            type: "EVENT_EDITOR_UPDATED",
            update: { title: "Festival of Lights" },
        });

        await stateMachine.dispatch({ type: "EVENT_EDITOR_SAVE_REQUESTED" });

        state = stateMachine.getState();
        expect(state.eventsUiState.isEventEditorOpen).toBe(false);
        const events = await eventRepo.listEvents(draft.calendarId);
        expect(events.some(event => event.title === "Festival of Lights")).toBe(true);
        expect(state.calendarState.upcomingEvents.some(event => event.title === "Festival of Lights")).toBe(true);
    });

    it("prefills event drafts with the provided timestamp anchor", async () => {
        await stateMachine.dispatch({ type: "ALMANAC_MODE_SELECTED", mode: "events" });

        const targetTimestamp = createDayTimestamp(gregorianSchema.id, 2025, "mar", 21);

        await stateMachine.dispatch({
            type: "EVENT_CREATE_REQUESTED",
            mode: "single",
            timestamp: targetTimestamp,
        });

        const state = stateMachine.getState();
        const draft = state.eventsUiState.eventEditorDraft;
        expect(draft).toBeTruthy();
        if (!draft) throw new Error("expected draft to exist");

        expect(draft.calendarId).toBe(targetTimestamp.calendarId);
        expect(draft.year).toBe(String(targetTimestamp.year));
        expect(draft.monthId).toBe(targetTimestamp.monthId);
        expect(draft.day).toBe(String(targetTimestamp.day));
    });

    it("captures validation errors when saving incomplete events", async () => {
        await stateMachine.dispatch({ type: "EVENT_CREATE_REQUESTED", mode: "single" });
        await stateMachine.dispatch({ type: "EVENT_EDITOR_SAVE_REQUESTED" });

        const state = stateMachine.getState();
        expect(state.eventsUiState.isEventEditorOpen).toBe(true);
        expect(state.eventsUiState.eventEditorErrors.some(error => error.includes("Titel"))).toBe(true);
    });

    it("deletes existing events through the editor", async () => {
        await stateMachine.dispatch({ type: "EVENT_EDIT_REQUESTED", eventId: "evt-2" });
        await stateMachine.dispatch({ type: "EVENT_DELETE_REQUESTED", eventId: "evt-2" });

        const events = await eventRepo.listEvents(gregorianSchema.id);
        expect(events.some(event => event.id === "evt-2")).toBe(false);
        const state = stateMachine.getState();
        expect(state.eventsUiState.bulkSelection).not.toContain("evt-2");
    });
});
