// src/workmodes/almanac/view/jump-to-date-modal.ts
// Jump to Date Modal for Almanac (Phase 3)
//
// Features:
// - Dropdown selects for year, month, day, hour, minute
// - Pre-filled with current timestamp
// - Quick jump buttons (Today, Next Month, Next Year)
// - Keyboard friendly (Enter submits, Escape cancels)
//
// Phase 3: Replaces "coming soon" placeholder with functional date picker

import type { App } from "obsidian";
import { Modal } from "obsidian";
import { configurableLogger } from '@services/logging/configurable-logger';
const logger = configurableLogger.forModule('almanac-jump-to-date');
import { createMinuteTimestamp, advanceTime } from "../helpers";
import type { CalendarSchema, CalendarTimestamp } from "../helpers";

export interface JumpToDateModalOptions {
	readonly app: App;
	readonly schema: CalendarSchema;
	readonly currentTimestamp: CalendarTimestamp;
	readonly onJump: (timestamp: CalendarTimestamp) => void;
}

/**
 * Open Jump to Date Modal
 *
 * Modal with dropdowns for year/month/day/hour/minute selection.
 * Includes quick jump buttons for common actions (Today, Next Month, Next Year).
 *
 * Phase 3 Implementation
 */
export function openJumpToDateModal(options: JumpToDateModalOptions): void {
	new JumpToDateModal(options).open();
}

class JumpToDateModal extends Modal {
	private readonly options: JumpToDateModalOptions;
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

	constructor(options: JumpToDateModalOptions) {
		super(options.app);
		this.options = options;

		// Pre-fill with current timestamp
		const current = options.currentTimestamp;
		this.selectedYear = current.year;
		this.selectedMonthId = current.monthId;
		this.selectedDay = current.day;
		this.selectedHour = current.hour ?? 12;
		this.selectedMinute = current.minute ?? 0;

		logger.info("Opening modal", {
			currentTimestamp: options.currentTimestamp,
		});
	}

	onOpen(): void {
		const { contentEl } = this;
		const { schema } = this.options;

		contentEl.empty();
		contentEl.addClass("sm-jump-to-date-modal");

		// Title
		contentEl.createEl("h2", { text: "Jump to Date" });

		// Form
		const form = contentEl.createDiv({ cls: "sm-jump-to-date-modal__form" });

		// Year row
		const yearRow = form.createDiv({ cls: "sm-jump-to-date-modal__row" });
		yearRow.createSpan({ text: "Year:", cls: "sm-jump-to-date-modal__label" });
		this.yearSelect = yearRow.createEl("select", { cls: "sm-jump-to-date-modal__select" });

		// Year options (current year ± 100 years)
		const currentYear = this.selectedYear;
		for (let year = currentYear - 100; year <= currentYear + 100; year++) {
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

		// Month row
		const monthRow = form.createDiv({ cls: "sm-jump-to-date-modal__row" });
		monthRow.createSpan({ text: "Month:", cls: "sm-jump-to-date-modal__label" });
		this.monthSelect = monthRow.createEl("select", { cls: "sm-jump-to-date-modal__select" });

		for (const month of schema.months) {
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

		// Day row
		const dayRow = form.createDiv({ cls: "sm-jump-to-date-modal__row" });
		dayRow.createSpan({ text: "Day:", cls: "sm-jump-to-date-modal__label" });
		this.daySelect = dayRow.createEl("select", { cls: "sm-jump-to-date-modal__select" });

		this.updateDayOptions();

		this.daySelect.addEventListener("change", () => {
			this.selectedDay = parseInt(this.daySelect.value, 10);
		});

		// Hour row
		const hourRow = form.createDiv({ cls: "sm-jump-to-date-modal__row" });
		hourRow.createSpan({ text: "Hour:", cls: "sm-jump-to-date-modal__label" });
		this.hourSelect = hourRow.createEl("select", { cls: "sm-jump-to-date-modal__select" });

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

		// Minute row
		const minuteRow = form.createDiv({ cls: "sm-jump-to-date-modal__row" });
		minuteRow.createSpan({ text: "Minute:", cls: "sm-jump-to-date-modal__label" });
		this.minuteSelect = minuteRow.createEl("select", { cls: "sm-jump-to-date-modal__select" });

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

		// Quick jump buttons
		const quickJumpGroup = form.createDiv({ cls: "sm-jump-to-date-modal__quick-jump" });
		quickJumpGroup.createEl("h3", { text: "Quick Jump:", cls: "sm-jump-to-date-modal__quick-jump-label" });

		const todayBtn = quickJumpGroup.createEl("button", {
			text: "Today",
			cls: "sm-jump-to-date-modal__btn",
		});
		todayBtn.addEventListener("click", (e) => {
			e.preventDefault();
			this.jumpToToday();
		});

		const nextMonthBtn = quickJumpGroup.createEl("button", {
			text: "Next Month",
			cls: "sm-jump-to-date-modal__btn",
		});
		nextMonthBtn.addEventListener("click", (e) => {
			e.preventDefault();
			this.jumpToNextMonth();
		});

		const nextYearBtn = quickJumpGroup.createEl("button", {
			text: "Next Year",
			cls: "sm-jump-to-date-modal__btn",
		});
		nextYearBtn.addEventListener("click", (e) => {
			e.preventDefault();
			this.jumpToNextYear();
		});

		// Action buttons
		const actionsGroup = form.createDiv({ cls: "sm-jump-to-date-modal__actions" });

		const cancelBtn = actionsGroup.createEl("button", {
			text: "Cancel (Esc)",
			cls: "sm-jump-to-date-modal__btn",
		});
		cancelBtn.addEventListener("click", () => {
			logger.info("Cancelled");
			this.close();
		});

		const jumpBtn = actionsGroup.createEl("button", {
			text: "Jump (↵)",
			cls: "sm-jump-to-date-modal__btn sm-jump-to-date-modal__btn--primary",
		});
		jumpBtn.addEventListener("click", () => {
			this.performJump();
		});

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

	private updateDayOptions(): void {
		const { schema } = this.options;
		const selectedMonth = schema.months.find((m) => m.id === this.selectedMonthId);
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

	private jumpToToday(): void {
		const current = this.options.currentTimestamp;
		this.selectedYear = current.year;
		this.selectedMonthId = current.monthId;
		this.selectedDay = current.day;
		this.selectedHour = current.hour ?? 12;
		this.selectedMinute = current.minute ?? 0;

		// Update dropdowns
		this.yearSelect.value = this.selectedYear.toString();
		this.monthSelect.value = this.selectedMonthId;
		this.updateDayOptions();
		this.hourSelect.value = this.selectedHour.toString();
		this.minuteSelect.value = this.selectedMinute.toString();

		logger.info("Jumped to today");
	}

	private jumpToNextMonth(): void {
		const { schema } = this.options;
		const tempTimestamp = createMinuteTimestamp(
			schema.id,
			this.selectedYear,
			this.selectedMonthId,
			this.selectedDay,
			this.selectedHour,
			this.selectedMinute
		);

		const result = advanceTime(schema, tempTimestamp, 1, "month");
		this.selectedYear = result.timestamp.year;
		this.selectedMonthId = result.timestamp.monthId;
		this.selectedDay = result.timestamp.day;

		// Update dropdowns
		this.yearSelect.value = this.selectedYear.toString();
		this.monthSelect.value = this.selectedMonthId;
		this.updateDayOptions();

		logger.info("Jumped to next month");
	}

	private jumpToNextYear(): void {
		this.selectedYear += 1;
		this.yearSelect.value = this.selectedYear.toString();

		logger.info("Jumped to next year");
	}

	private performJump(): void {
		const { schema } = this.options;

		const newTimestamp = createMinuteTimestamp(
			schema.id,
			this.selectedYear,
			this.selectedMonthId,
			this.selectedDay,
			this.selectedHour,
			this.selectedMinute
		);

		logger.info("Jumping to date", { newTimestamp });
		this.options.onJump(newTimestamp);
		this.close();
	}

	onClose(): void {
		const { contentEl } = this;
		contentEl.empty();
	}
}
