// salt-marcher/tests/apps/almanac/almanac-controller.dom.test.ts
// Validiert das Rendering des Recently-Triggered-Abschnitts nach Zeitfortschritt.
import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("obsidian", async () => await import("../../mocks/obsidian"));

import { App } from "obsidian";
import { AlmanacController } from "../../../src/apps/almanac/mode/almanac-controller";
import { AlmanacStateMachine } from "../../../src/apps/almanac/mode/state-machine";

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

    it("blendet ausgelöste Ereignisse nach Zeitfortschritt ein", async () => {
        const app = new App();
        const controller = new AlmanacController(app);
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

    it("wechseln der Modi aktualisiert die Ansicht", async () => {
        const app = new App();
        const controller = new AlmanacController(app);
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

        const statusAfterSelect = container.querySelector(".almanac-shell__status")?.textContent ?? "";
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

        const closeButton = container.querySelector('.almanac-phenomenon-detail__header button');
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

    it("ermöglicht Kalenderauswahl und Default-Setzen", async () => {
        const app = new App();
        const controller = new AlmanacController(app);
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
        const controller = new AlmanacController(app);
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
});
