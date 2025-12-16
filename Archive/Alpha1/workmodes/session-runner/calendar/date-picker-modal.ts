// src/workmodes/session-runner/calendar/date-picker-modal.ts
// Date picker modal for Session Runner - Jump to specific date/time

import { Modal, type App } from "obsidian";
import { configurableLogger } from "@services/logging/configurable-logger";

const logger = configurableLogger.forModule("session-date-picker");
import { createMinuteTimestamp } from "@services/orchestration";
import type { CalendarSchema, CalendarTimestamp } from "@domain";

export interface DatePickerModalOptions {
    readonly app: App;
    readonly calendar: CalendarSchema;
    readonly currentTimestamp: CalendarTimestamp;
    readonly onConfirm: (timestamp: CalendarTimestamp) => void;
}

/**
 * Opens a date picker modal for jumping to a specific date/time.
 *
 * Features:
 * - Year, Month, Day, Hour, Minute dropdowns
 * - Pre-filled with current timestamp
 * - Validation against calendar schema (e.g., max days per month)
 * - Keyboard friendly (Enter = confirm, Escape = cancel)
 *
 * Simplified version for Session Runner (no quick jump buttons).
 */
export function openDatePickerModal(options: DatePickerModalOptions): void {
    new DatePickerModal(options).open();
}

class DatePickerModal extends Modal {
    private readonly options: DatePickerModalOptions;
    private selectedYear: number;
    private selectedMonthId: string;
    private selectedDay: number;
    private selectedHour: number;
    private selectedMinute: number;

    private yearSelect!: HTMLSelectElement;
    private monthSelect!: HTMLSelectElement;
    private daySelect!: HTMLSelectElement;
    private hourSelect!: HTMLSelectElement;
    private minuteSelect!: HTMLSelectElement;

    constructor(options: DatePickerModalOptions) {
        super(options.app);
        this.options = options;

        // Pre-fill with current timestamp
        const current = options.currentTimestamp;
        this.selectedYear = current.year;
        this.selectedMonthId = current.monthId;
        this.selectedDay = current.day;
        this.selectedHour = current.hour ?? 12;
        this.selectedMinute = current.minute ?? 0;

        logger.info("[date-picker-modal] Opening modal", {
            currentTimestamp: options.currentTimestamp,
        });
    }

    onOpen(): void {
        const { contentEl } = this;
        const { calendar } = this.options;

        contentEl.empty();
        contentEl.addClass("sm-date-picker-modal");

        // Title
        contentEl.createEl("h2", { text: "Jump to Date" });

        // Description
        contentEl.createEl("p", {
            text: "Select a date and time to jump to:",
            cls: "sm-date-picker-modal__description",
        });

        // Form
        const form = contentEl.createDiv({ cls: "sm-date-picker-modal__form" });

        // Year row
        this.renderYearRow(form);

        // Month row
        this.renderMonthRow(form, calendar);

        // Day row
        this.renderDayRow(form);

        // Hour row
        this.renderHourRow(form);

        // Minute row
        this.renderMinuteRow(form);

        // Action buttons
        this.renderActionButtons(form);

        // Keyboard shortcuts
        contentEl.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                e.preventDefault();
                this.performJump();
            } else if (e.key === "Escape") {
                e.preventDefault();
                this.close();
            }
        });
    }

    private renderYearRow(form: HTMLElement): void {
        const yearRow = form.createDiv({ cls: "sm-date-picker-modal__row" });
        yearRow.createSpan({ text: "Year:", cls: "sm-date-picker-modal__label" });
        this.yearSelect = yearRow.createEl("select", { cls: "sm-date-picker-modal__select" });

        // Year options (current year ± 50 years)
        const currentYear = this.selectedYear;
        for (let year = currentYear - 50; year <= currentYear + 50; year++) {
            const option = this.yearSelect.createEl("option", {
                text: year.toString(),
                value: year.toString(),
            });
            if (year === this.selectedYear) {
                option.selected = true;
            }
        }

        this.yearSelect.addEventListener("change", () => {
            this.selectedYear = parseInt(this.yearSelect.value, 10);
        });
    }

    private renderMonthRow(form: HTMLElement, calendar: CalendarSchema): void {
        const monthRow = form.createDiv({ cls: "sm-date-picker-modal__row" });
        monthRow.createSpan({ text: "Month:", cls: "sm-date-picker-modal__label" });
        this.monthSelect = monthRow.createEl("select", { cls: "sm-date-picker-modal__select" });

        for (const month of calendar.months) {
            const option = this.monthSelect.createEl("option", {
                text: month.name,
                value: month.id,
            });
            if (month.id === this.selectedMonthId) {
                option.selected = true;
            }
        }

        this.monthSelect.addEventListener("change", () => {
            this.selectedMonthId = this.monthSelect.value;
            this.updateDayOptions();
        });
    }

    private renderDayRow(form: HTMLElement): void {
        const dayRow = form.createDiv({ cls: "sm-date-picker-modal__row" });
        dayRow.createSpan({ text: "Day:", cls: "sm-date-picker-modal__label" });
        this.daySelect = dayRow.createEl("select", { cls: "sm-date-picker-modal__select" });

        this.updateDayOptions();

        this.daySelect.addEventListener("change", () => {
            this.selectedDay = parseInt(this.daySelect.value, 10);
        });
    }

    private renderHourRow(form: HTMLElement): void {
        const hourRow = form.createDiv({ cls: "sm-date-picker-modal__row" });
        hourRow.createSpan({ text: "Hour:", cls: "sm-date-picker-modal__label" });
        this.hourSelect = hourRow.createEl("select", { cls: "sm-date-picker-modal__select" });

        for (let h = 0; h < 24; h++) {
            const hourStr = h.toString().padStart(2, "0");
            const option = this.hourSelect.createEl("option", {
                text: hourStr,
                value: h.toString(),
            });
            if (h === this.selectedHour) {
                option.selected = true;
            }
        }

        this.hourSelect.addEventListener("change", () => {
            this.selectedHour = parseInt(this.hourSelect.value, 10);
        });
    }

    private renderMinuteRow(form: HTMLElement): void {
        const minuteRow = form.createDiv({ cls: "sm-date-picker-modal__row" });
        minuteRow.createSpan({ text: "Minute:", cls: "sm-date-picker-modal__label" });
        this.minuteSelect = minuteRow.createEl("select", { cls: "sm-date-picker-modal__select" });

        for (let m = 0; m < 60; m++) {
            const minStr = m.toString().padStart(2, "0");
            const option = this.minuteSelect.createEl("option", {
                text: minStr,
                value: m.toString(),
            });
            if (m === this.selectedMinute) {
                option.selected = true;
            }
        }

        this.minuteSelect.addEventListener("change", () => {
            this.selectedMinute = parseInt(this.minuteSelect.value, 10);
        });
    }

    private renderActionButtons(form: HTMLElement): void {
        const actionsGroup = form.createDiv({ cls: "sm-date-picker-modal__actions" });

        const cancelBtn = actionsGroup.createEl("button", {
            text: "Cancel",
            cls: "sm-date-picker-modal__btn",
        });
        cancelBtn.addEventListener("click", () => {
            logger.info("[date-picker-modal] Cancelled");
            this.close();
        });

        const jumpBtn = actionsGroup.createEl("button", {
            text: "Jump to Date",
            cls: "sm-date-picker-modal__btn sm-date-picker-modal__btn--primary",
        });
        jumpBtn.addEventListener("click", () => {
            this.performJump();
        });
    }

    /**
     * Updates day dropdown options based on selected month.
     *
     * Ensures selected day doesn't exceed the month's max days.
     */
    private updateDayOptions(): void {
        const { calendar } = this.options;
        const selectedMonth = calendar.months.find((m) => m.id === this.selectedMonthId);
        const maxDays = selectedMonth?.days ?? 30;

        this.daySelect.empty();

        for (let d = 1; d <= maxDays; d++) {
            const option = this.daySelect.createEl("option", {
                text: d.toString(),
                value: d.toString(),
            });
            if (d === this.selectedDay) {
                option.selected = true;
            }
        }

        // Clamp selected day if it exceeds max days
        if (this.selectedDay > maxDays) {
            this.selectedDay = maxDays;
        }
    }

    /**
     * Performs the jump to the selected date/time.
     */
    private performJump(): void {
        const { calendar } = this.options;

        const newTimestamp = createMinuteTimestamp(
            calendar.id,
            this.selectedYear,
            this.selectedMonthId,
            this.selectedDay,
            this.selectedHour,
            this.selectedMinute,
        );

        logger.info("[date-picker-modal] Jumping to date", { newTimestamp });
        this.options.onConfirm(newTimestamp);
        this.close();
    }

    onClose(): void {
        const { contentEl } = this;
        contentEl.empty();
    }
}
