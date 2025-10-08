// salt-marcher/tests/apps/almanac/almanac-controller.dom.test.ts
// Validiert das Recently-Triggered-Rendering und den CTA bei fehlenden Kalendern.
import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("obsidian", async () => await import("../../mocks/obsidian"));

import { App } from "obsidian";
import { AlmanacController } from "../../../src/apps/almanac/mode/almanac-controller";
import { AlmanacStateMachine } from "../../../src/apps/almanac/mode/state-machine";
import {
    InMemoryCalendarRepository,
    InMemoryEventRepository,
    InMemoryPhenomenonRepository,
} from "../../../src/apps/almanac/data/in-memory-repository";
import { InMemoryStateGateway } from "../../../src/apps/almanac/data/in-memory-gateway";
import {
    gregorianSchema,
    createSampleEvents,
    getDefaultCurrentTimestamp,
} from "../../../src/apps/almanac/fixtures/gregorian.fixture";
import { createSamplePhenomena } from "../../../src/apps/almanac/fixtures/phenomena.fixture";

const ensureObsidianDomHelpers = () => {
    const proto = HTMLElement.prototype as any;
    if (!proto.createEl) {
        proto.createEl = function(
            tag: string,
            options?: { text?: string; cls?: string; attr?: Record<string, string> }
        ) {
            const el = document.createElement(tag);
            if (options?.text) el.textContent = options.text;
            if (options?.cls) {
                for (const cls of options.cls.split(/\s+/).filter(Boolean)) {
                    el.classList.add(cls);
                }
            }
            if (options?.attr) {
                for (const [key, value] of Object.entries(options.attr)) {
                    el.setAttribute(key, value);
                }
            }
            this.appendChild(el);
            return el;
        };
    }
    if (!proto.createDiv) {
        proto.createDiv = function(options?: { text?: string; cls?: string; attr?: Record<string, string> }) {
            return this.createEl("div", options);
        };
    }
    if (!proto.empty) {
        proto.empty = function() {
            while (this.firstChild) {
                this.removeChild(this.firstChild);
            }
            return this;
        };
    }
    if (!proto.addClass) {
        proto.addClass = function(cls: string) {
            this.classList.add(cls);
            return this;
        };
    }
    if (!proto.removeClass) {
        proto.removeClass = function(cls: string) {
            this.classList.remove(cls);
            return this;
        };
    }
    if (!proto.setText) {
        proto.setText = function(text: string) {
            this.textContent = text;
            return this;
        };
    }
};

describe("AlmanacController Dashboard", () => {
    beforeAll(() => {
        ensureObsidianDomHelpers();
    });

    const createController = async (app: App, options: { seedCalendars?: boolean } = {}) => {
        const { seedCalendars = true } = options;
        const calendarRepo = new InMemoryCalendarRepository();
        const eventRepo = new InMemoryEventRepository();
        eventRepo.bindCalendarRepository(calendarRepo);
        const phenomenonRepo = new InMemoryPhenomenonRepository();
        const gateway = new InMemoryStateGateway(calendarRepo, eventRepo, phenomenonRepo);

        if (seedCalendars) {
            calendarRepo.seed([
                gregorianSchema,
                {
                    id: "lunar-cycle",
                    name: "Lunar Cycle",
                    description: "Six-month seasonal calendar for travel campaigns",
                    daysPerWeek: 6,
                    hoursPerDay: 20,
                    minutesPerHour: 60,
                    minuteStep: 10,
                    months: [
                        { id: "ember", name: "Ember", length: 30 },
                        { id: "sleet", name: "Sleet", length: 30 },
                        { id: "bloom", name: "Bloom", length: 30 },
                        { id: "zenith", name: "Zenith", length: 30 },
                        { id: "gale", name: "Gale", length: 30 },
                        { id: "dusk", name: "Dusk", length: 30 },
                    ],
                    epoch: { year: 1, monthId: "ember", day: 1 },
                    schemaVersion: "1.0.0",
                },
            ]);
            await calendarRepo.setDefault({ calendarId: gregorianSchema.id, scope: "global" });
            eventRepo.seed(createSampleEvents(2024));
            phenomenonRepo.seed(createSamplePhenomena());

            const initialTimestamp = getDefaultCurrentTimestamp(2024);
            await gateway.setActiveCalendar(gregorianSchema.id, { initialTimestamp });
            await gateway.setCurrentTimestamp(initialTimestamp);
        }

        return new AlmanacController(app, { calendarRepo, eventRepo, phenomenonRepo, gateway });
    };

    it("initialisiert einen Standardkalender, wenn keine Kalender vorhanden sind", async () => {
        const app = new App();
        const controller = await createController(app, { seedCalendars: false });
        const container = document.createElement("div");

        await controller.onOpen(container);
        await new Promise(resolve => setTimeout(resolve, 0));

        const stateMachine = (controller as unknown as { stateMachine: AlmanacStateMachine }).stateMachine;
        const state = stateMachine.getState();
        expect(state.calendarState.calendars).toHaveLength(1);
        expect(state.calendarState.calendars[0]?.id).toBe("gregorian-standard");
        expect(state.calendarState.defaultCalendarId).toBe("gregorian-standard");

        const select = container.querySelector(".almanac-calendar-select") as HTMLSelectElement | null;
        expect(select).toBeTruthy();
        const optionValues = Array.from(select?.options ?? []).map(option => option.value);
        expect(optionValues).toContain("gregorian-standard");
        expect(container.querySelector(".almanac-empty-state")).toBeNull();
    });

    it("blendet ausgelöste Ereignisse nach Zeitfortschritt ein", async () => {
        const app = new App();
        const controller = await createController(app);
        const container = document.createElement("div");

        await controller.onOpen(container);

        expect(container.textContent?.includes("Recently Triggered")).toBe(false);

        const stateMachine = (controller as unknown as { stateMachine: AlmanacStateMachine }).stateMachine;
        await stateMachine.dispatch({ type: "TIME_ADVANCE_REQUESTED", amount: 15, unit: "day" });
        await new Promise(resolve => setTimeout(resolve, 0));

        const state = stateMachine.getState();
        expect(state.calendarState.triggeredEvents.length).toBeGreaterThan(0);

        const triggeredHeading = Array.from(container.querySelectorAll("h2")).find(
            heading => heading.textContent === "Recently Triggered"
        );
        expect(triggeredHeading).toBeTruthy();

        const triggeredSection = triggeredHeading?.closest(".almanac-section");
        const items = triggeredSection?.querySelectorAll(".almanac-event-item") ?? [];
        expect(items.length).toBeGreaterThan(0);

        const titles = Array.from(items).map(item => item.querySelector("strong")?.textContent ?? "");
        expect(titles.some(title => title.includes("Team Meeting"))).toBe(true);
    });

    it("dispatcht Kalenderansichtswechsel über die Tab-Navigation", async () => {
        const app = new App();
        const controller = await createController(app);
        const container = document.createElement("div");

        await controller.onOpen(container);

        const stateMachine = (controller as unknown as { stateMachine: AlmanacStateMachine }).stateMachine;
        const weekButton = container.querySelector(
            '.almanac-calendar-view__tabs [data-tab-id="week"]'
        ) as HTMLButtonElement | null;
        expect(weekButton).toBeTruthy();
        weekButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        await new Promise(resolve => setTimeout(resolve, 0));

        const state = stateMachine.getState();
        expect(state.calendarViewState.mode).toBe('week');
        expect(weekButton?.classList.contains('is-active')).toBe(true);
    });

    it("wechseln der Modi aktualisiert die Ansicht", async () => {
        const app = new App();
        const controller = await createController(app);
        const container = document.createElement("div");

        await controller.onOpen(container);

        const stateMachine = (controller as unknown as { stateMachine: AlmanacStateMachine }).stateMachine;
        await stateMachine.dispatch({ type: "ALMANAC_MODE_SELECTED", mode: "manager" });
        await new Promise(resolve => setTimeout(resolve, 0));

        await stateMachine.dispatch({ type: "MANAGER_VIEW_MODE_CHANGED", viewMode: "overview" });
        await new Promise(resolve => setTimeout(resolve, 0));

        expect(container.querySelector('table.almanac-table')).toBeTruthy();

        const rowCheckbox = container.querySelector('table.almanac-table tbody tr input[type="checkbox"]') as HTMLInputElement | null;
        expect(rowCheckbox).toBeTruthy();
        if (rowCheckbox) {
            rowCheckbox.checked = true;
            rowCheckbox.dispatchEvent(new Event("change"));
        }
        await Promise.resolve();

        const statusAfterSelect = container.querySelector(".almanac-manager-content .almanac-shell__status")?.textContent ?? "";
        expect(statusAfterSelect.includes("Filters: 1")).toBe(true);

        await stateMachine.dispatch({ type: "ALMANAC_MODE_SELECTED", mode: "events" });
        await new Promise(resolve => setTimeout(resolve, 0));

        expect(container.textContent?.includes("Phenomena")).toBe(true);
        expect(container.textContent?.includes("Spring Bloom")).toBe(true);

        const categoryCheckboxes = Array.from(
            container.querySelectorAll('[data-filter="category"] input[type="checkbox"]')
        ) as HTMLInputElement[];
        const astronomyCheckbox = categoryCheckboxes.find(input => input.value === 'astronomy');
        expect(astronomyCheckbox).toBeTruthy();
        if (astronomyCheckbox) {
            astronomyCheckbox.checked = true;
            astronomyCheckbox.dispatchEvent(new Event('change'));
        }
        await Promise.resolve();

        const filteredState = stateMachine.getState();
        expect(filteredState.eventsUiState.phenomena).toHaveLength(1);
        expect(filteredState.eventsUiState.phenomena[0]?.title).toBe("Harvest Moon");

        const detailTitle = container.querySelector('.almanac-phenomenon-detail__title');
        expect(detailTitle?.textContent).toContain('Harvest Moon');

        const closeButton = container.querySelector('[data-action="close-detail"]');
        expect(closeButton).toBeTruthy();
        closeButton?.dispatchEvent(new Event('click'));
        await Promise.resolve();

        expect(container.textContent?.includes('Select a phenomenon')).toBe(true);

        const resetButton = container.querySelector('[data-action="reset-filters"]');
        expect(resetButton).toBeTruthy();
        resetButton?.dispatchEvent(new Event('click'));
        await Promise.resolve();

        const resetState = stateMachine.getState();
        expect(resetState.eventsUiState.filterCount).toBe(0);
    });

    it("öffnet Editor- und Import-Dialoge und führt Bulk-Aktionen aus", async () => {
        const app = new App();
        const controller = await createController(app);
        const container = document.createElement("div");

        await controller.onOpen(container);

        const stateMachine = (controller as unknown as { stateMachine: AlmanacStateMachine }).stateMachine;
        await stateMachine.dispatch({ type: "ALMANAC_MODE_SELECTED", mode: "events" });
        await new Promise(resolve => setTimeout(resolve, 0));

        const addButton = container.querySelector('[data-action="add-phenomenon"]') as HTMLButtonElement | null;
        expect(addButton).toBeTruthy();
        addButton?.dispatchEvent(new Event('click'));
        await new Promise(resolve => setTimeout(resolve, 0));

        const editorModal = document.querySelector('[data-modal="phenomenon-editor"]');
        expect(editorModal).toBeTruthy();
        const [nameInput, categoryInput] = Array.from(
            editorModal?.querySelectorAll('input[type="text"]') ?? [],
        ) as HTMLInputElement[];
        expect(nameInput).toBeTruthy();
        if (nameInput) {
            nameInput.value = 'Dialog Phenomenon';
            nameInput.dispatchEvent(new Event('input'));
        }
        if (categoryInput) {
            categoryInput.value = 'custom';
            categoryInput.dispatchEvent(new Event('input'));
        }
        const saveButton = editorModal?.querySelector('button[type="submit"]') as HTMLButtonElement | null;
        expect(saveButton).toBeTruthy();
        saveButton?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
        await new Promise(resolve => setTimeout(resolve, 0));

        expect(document.querySelector('[data-modal="phenomenon-editor"]')).toBeNull();
        let eventsState = stateMachine.getState().eventsUiState;
        expect(eventsState.phenomena.some(item => item.title === 'Dialog Phenomenon')).toBe(true);

        const importButton = container.querySelector('[data-action="import-phenomena"]') as HTMLButtonElement | null;
        expect(importButton).toBeTruthy();
        importButton?.dispatchEvent(new Event('click'));
        await new Promise(resolve => setTimeout(resolve, 0));

        const importModal = document.querySelector('[data-modal="event-import"]');
        expect(importModal).toBeTruthy();
        const importTextarea = importModal?.querySelector('textarea[data-role="import-input"]') as HTMLTextAreaElement | null;
        expect(importTextarea).toBeTruthy();
        if (importTextarea) {
            importTextarea.value = JSON.stringify([
                {
                    id: 'phen-import-ui',
                    name: 'Imported via UI',
                    category: 'custom',
                    visibility: 'all_calendars',
                    appliesToCalendarIds: [],
                    rule: { type: 'annual', offsetDayOfYear: 8 },
                    timePolicy: 'all_day',
                    priority: 0,
                    schemaVersion: '1.0.0',
                },
            ]);
            importTextarea.dispatchEvent(new Event('input'));
        }
        const importSubmit = importModal?.querySelector('button[type="submit"]') as HTMLButtonElement | null;
        expect(importSubmit).toBeTruthy();
        importSubmit?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
        await new Promise(resolve => setTimeout(resolve, 0));

        expect(document.querySelector('[data-modal="event-import"]')).toBeNull();
        eventsState = stateMachine.getState().eventsUiState;
        expect(eventsState.importSummary?.imported).toBeGreaterThan(0);
        expect(eventsState.phenomena.some(item => item.id === 'phen-import-ui')).toBe(true);
        const importSummary = container.querySelector('[data-role="import-summary"]');
        expect(importSummary?.textContent).toContain('Imported');

        const tableToggle = Array.from(container.querySelectorAll('.almanac-toggle-group button')).find(
            button => button.textContent === 'Table',
        );
        tableToggle?.dispatchEvent(new Event('click'));
        await new Promise(resolve => setTimeout(resolve, 0));

        const selectionBoxes = Array.from(
            container.querySelectorAll('.almanac-phenomena-table input[type="checkbox"][data-role="bulk-select"]'),
        ) as HTMLInputElement[];
        expect(selectionBoxes.length).toBeGreaterThan(1);
        selectionBoxes.slice(0, 2).forEach(box => {
            box.checked = true;
            box.dispatchEvent(new Event('change'));
        });
        await new Promise(resolve => setTimeout(resolve, 0));

        const exportButton = container.querySelector('[data-action="export-selected"]') as HTMLButtonElement | null;
        exportButton?.dispatchEvent(new Event('click'));
        await new Promise(resolve => setTimeout(resolve, 0));

        const exportPreview = container.querySelector('textarea[data-role="export-output"]') as HTMLTextAreaElement | null;
        expect(exportPreview).toBeTruthy();
        expect(exportPreview?.value).toContain('phen-');

        const deleteButton = container.querySelector('[data-action="delete-selected"]') as HTMLButtonElement | null;
        deleteButton?.dispatchEvent(new Event('click'));
        await new Promise(resolve => setTimeout(resolve, 0));

        eventsState = stateMachine.getState().eventsUiState;
        expect(eventsState.bulkSelection).toHaveLength(0);
    });

    it("schaltet die Events-Ansicht um und rendert die Kartenansicht", async () => {
        const app = new App();
        const controller = await createController(app);
        const container = document.createElement("div");

        await controller.onOpen(container);

        const stateMachine = (controller as unknown as { stateMachine: AlmanacStateMachine }).stateMachine;
        await stateMachine.dispatch({ type: "ALMANAC_MODE_SELECTED", mode: "events" });
        await Promise.resolve();

        const toggleButtons = Array.from(
            container.querySelectorAll(".almanac-toggle-group button"),
        ) as HTMLButtonElement[];
        expect(toggleButtons).toHaveLength(3);

        const tableButton = toggleButtons.find(button => button.textContent === "Table");
        expect(tableButton).toBeTruthy();
        tableButton?.dispatchEvent(new Event("click"));
        await Promise.resolve();

        expect(container.querySelector("table.almanac-phenomena-table")).toBeTruthy();

        const mapButton = toggleButtons.find(button => button.textContent === "Map");
        expect(mapButton).toBeTruthy();
        mapButton?.dispatchEvent(new Event("click"));
        await Promise.resolve();

        const mapComponent = container.querySelector('[data-component="events-map"]');
        expect(mapComponent).toBeTruthy();

        const markerNodes = mapComponent?.querySelectorAll('[data-role="map-marker"]') ?? [];
        expect(markerNodes.length).toBeGreaterThan(0);

        const legendItems = mapComponent?.querySelectorAll('[data-role="map-legend-item"]') ?? [];
        expect(legendItems.length).toBe(markerNodes.length);

        const summary = mapComponent?.querySelector('[data-role="map-summary"]');
        expect(summary?.textContent ?? "").toContain("phenomena plotted");
    });

    it("ermöglicht Kalenderauswahl und Default-Setzen", async () => {
        const app = new App();
        const controller = await createController(app);
        const container = document.createElement("div");

        await controller.onOpen(container);
        const stateMachine = (controller as unknown as { stateMachine: AlmanacStateMachine }).stateMachine;

        const select = container.querySelector(".almanac-calendar-select") as HTMLSelectElement | null;
        expect(select).toBeTruthy();
        if (!select) return;

        select.value = "lunar-cycle";
        select.dispatchEvent(new Event("change"));
        await new Promise(resolve => setTimeout(resolve, 0));

        const subtitleAfterSelect = container.querySelector(".almanac-shell__subtitle")?.textContent ?? "";
        expect(subtitleAfterSelect.includes("Lunar Cycle")).toBe(true);

        const defaultButton = Array.from(container.querySelectorAll("button")).find(
            btn => btn.textContent === "Set as default"
        );
        expect(defaultButton).toBeTruthy();
        defaultButton?.dispatchEvent(new Event("click"));
        await new Promise(resolve => setTimeout(resolve, 10));
        await new Promise(resolve => setTimeout(resolve, 0));

        const stateAfterDefault = stateMachine.getState();
        expect(stateAfterDefault.calendarState.defaultCalendarId).toBe('lunar-cycle');

        const subtitleAfterDefault = container.querySelector(".almanac-shell__subtitle")?.textContent ?? "";
        expect(subtitleAfterDefault.includes("Lunar Cycle")).toBe(true);

        const defaultButtonAfter = Array.from(container.querySelectorAll('button')).find(
            btn => btn.textContent === 'Default calendar'
        );
        expect(defaultButtonAfter).toBeTruthy();
    });

    it("erlaubt Zeitsprung über das Formular", async () => {
        const app = new App();
        const controller = await createController(app);
        const container = document.createElement("div");

        await controller.onOpen(container);

        const setButton = Array.from(container.querySelectorAll("button")).find(btn => btn.textContent === "Set Date & Time");
        expect(setButton).toBeTruthy();
        setButton?.dispatchEvent(new Event("click"));

        const form = container.querySelector(".almanac-timejump-form") as HTMLFormElement | null;
        expect(form).toBeTruthy();
        if (!form) return;

        const dayInput = form.querySelector("input[name='day']") as HTMLInputElement;
        expect(dayInput).toBeTruthy();
        dayInput.value = "15";

        const hourInputElement = form.querySelector("input[name='hour']") as HTMLInputElement | null;
        expect(hourInputElement).toBeTruthy();
        if (hourInputElement) hourInputElement.value = "12";

        const previewButton = form.querySelector(".almanac-timejump-actions button[type='button']") as HTMLButtonElement | null;
        expect(previewButton).toBeTruthy();
        previewButton?.dispatchEvent(new Event("click"));
        await Promise.resolve();

        const currentState = (controller as unknown as { currentState: AlmanacState | null }).currentState;
        expect(currentState).toBeTruthy();

        form.dispatchEvent(new Event("submit"));
        await new Promise(resolve => setTimeout(resolve, 0));

        const timeCard = container.querySelector(".almanac-time-card")?.textContent ?? "";
        expect(timeCard.includes("Day 15")).toBe(true);
    });

    it("öffnet den Event-Editor und zeigt eine Vorschau", async () => {
        const app = new App();
        const controller = await createController(app);
        const container = document.createElement("div");

        await controller.onOpen(container);

        const stateMachine = (controller as unknown as { stateMachine: AlmanacStateMachine }).stateMachine;
        await stateMachine.dispatch({ type: "ALMANAC_MODE_SELECTED", mode: "events" });
        await Promise.resolve();

        const addButton = container.querySelector('[data-action="add-event-single"]') as HTMLButtonElement | null;
        expect(addButton).toBeTruthy();
        addButton?.click();
        await Promise.resolve();

        await stateMachine.dispatch({
            type: "EVENT_EDITOR_UPDATED",
            update: { title: "Harbor Festival" },
        });
        await Promise.resolve();

        const modal = document.querySelector('[data-modal="event-editor"]');
        expect(modal).toBeTruthy();
        const previewItems = modal?.querySelectorAll('.almanac-modal__preview li') ?? [];
        expect(previewItems.length).toBeGreaterThan(0);
    });

    it("zeigt Validierungsfehler im Event-Editor an", async () => {
        const app = new App();
        const controller = await createController(app);
        const container = document.createElement("div");

        await controller.onOpen(container);
        const stateMachine = (controller as unknown as { stateMachine: AlmanacStateMachine }).stateMachine;
        await stateMachine.dispatch({ type: "ALMANAC_MODE_SELECTED", mode: "events" });
        await Promise.resolve();

        const addButton = container.querySelector('[data-action="add-event-recurring"]') as HTMLButtonElement | null;
        expect(addButton).toBeTruthy();
        addButton?.click();
        await Promise.resolve();

        const saveButton = document.querySelector('[data-modal="event-editor"] [data-role="save-event"]') as HTMLButtonElement | null;
        expect(saveButton).toBeTruthy();
        saveButton?.click();
        await Promise.resolve();

        const errorList = document.querySelector('[data-modal="event-editor"] .almanac-form-errors');
        expect(errorList).toBeTruthy();
        expect(errorList?.textContent ?? "").toContain("Titel");
    });
});
