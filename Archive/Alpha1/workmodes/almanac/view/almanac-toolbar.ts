// src/workmodes/almanac/view/almanac-toolbar.ts
// Unified Toolbar for Almanac (Phase 3)
//
// Features:
// - Row 1: Navigation (Previous, Today, Next) + Time Display + Actions (Search, Create, Help)
// - Row 2: View Switcher (List, Month, Week, Timeline)
// - Sticky positioning at top of content area
// - Keyboard-accessible with tooltips
//
// Phase 3: Consolidates navigation and view switching into unified toolbar

import type { App } from "obsidian";
import { configurableLogger } from '@services/logging/configurable-logger';
const logger = configurableLogger.forModule('almanac-toolbar');
import { formatTimestamp } from "../helpers";
import { createCalendarSelector } from "./calendar-selector";
import { createViewSwitcher, type AlmanacView } from "./view-switcher";
import type { CalendarSchema, CalendarTimestamp } from "../helpers";

export interface AlmanacToolbarOptions {
	readonly app: App;
	readonly currentTimestamp: CalendarTimestamp;
	readonly schema: CalendarSchema;
	readonly currentView: AlmanacView;
	readonly activeCalendarId: string | null;
	readonly availableCalendars: ReadonlyArray<CalendarSchema>;
	readonly onNavigatePrevious: () => void;
	readonly onNavigateNext: () => void;
	readonly onJumpToToday: () => void;
	readonly onJumpToDate: () => void;
	readonly onCreateEvent: () => void;
	readonly onSearch: () => void;
	readonly onShowHelp: () => void;
	readonly onViewChange: (view: AlmanacView) => void;
	readonly onCalendarChange: (calendarId: string) => void;
}

export interface AlmanacToolbarHandle {
	update(timestamp: CalendarTimestamp, view: AlmanacView, activeCalendarId?: string | null, calendars?: ReadonlyArray<CalendarSchema>): void;
	destroy(): void;
	readonly root: HTMLElement;
}

/**
 * Create Almanac Toolbar
 *
 * Unified toolbar with 2 rows:
 * - Row 1: Navigation controls + Time display + Action buttons
 * - Row 2: View switcher
 *
 * Phase 3 Implementation
 */
export function createAlmanacToolbar(
	container: HTMLElement,
	options: AlmanacToolbarOptions
): AlmanacToolbarHandle {
	const { app, currentTimestamp, schema, currentView, activeCalendarId, availableCalendars } = options;
	const {
		onNavigatePrevious,
		onNavigateNext,
		onJumpToToday,
		onJumpToDate,
		onCreateEvent,
		onSearch,
		onShowHelp,
		onViewChange,
		onCalendarChange,
	} = options;

	const root = container.createDiv({ cls: "sm-almanac-toolbar" });

	// Row 1: Navigation + Time + Actions
	const row1 = root.createDiv({ cls: "sm-almanac-toolbar__row-1" });

	// Left: Navigation group (◀ Today ▶)
	const navGroup = row1.createDiv({ cls: "sm-almanac-toolbar__nav-group" });

	const prevBtn = navGroup.createEl("button", {
		text: "◀",
		cls: "sm-almanac-toolbar__btn sm-almanac-toolbar__btn--nav",
		attr: {
			title: "Previous period (Arrow Left)",
			"aria-label": "Previous period",
		},
	});
	prevBtn.addEventListener("click", () => {
		logger.info("Navigate previous");
		onNavigatePrevious();
	});

	const todayBtn = navGroup.createEl("button", {
		text: "Today",
		cls: "sm-almanac-toolbar__btn sm-almanac-toolbar__btn--today",
		attr: {
			title: "Jump to today (T)",
			"aria-label": "Jump to today",
		},
	});
	todayBtn.addEventListener("click", () => {
		logger.info("Jump to today");
		onJumpToToday();
	});

	const nextBtn = navGroup.createEl("button", {
		text: "▶",
		cls: "sm-almanac-toolbar__btn sm-almanac-toolbar__btn--nav",
		attr: {
			title: "Next period (Arrow Right)",
			"aria-label": "Next period",
		},
	});
	nextBtn.addEventListener("click", () => {
		logger.info("Navigate next");
		onNavigateNext();
	});

	// Center-Left: Time display (clickable)
	const timeDisplay = row1.createEl("div", {
		cls: "sm-almanac-toolbar__time-display",
		attr: {
			title: "Click to jump to date (J)",
			"aria-label": "Current time - Click to jump to date",
		},
	});
	updateTimeDisplay(timeDisplay, currentTimestamp, schema);

	timeDisplay.addEventListener("click", () => {
		logger.info("Time display clicked - opening jump to date");
		onJumpToDate();
	});

	// Center-Right: Calendar selector
	const calendarSelector = createCalendarSelector({
		app,
		activeCalendarId,
		availableCalendars,
		onCalendarChange: (calendarId) => {
			logger.info("Calendar changed via selector", { calendarId });
			onCalendarChange(calendarId);
		}
	});
	row1.appendChild(calendarSelector.root);

	// Right: Action group (Search, Create, Help)
	const actionGroup = row1.createDiv({ cls: "sm-almanac-toolbar__action-group" });

	const searchBtn = actionGroup.createEl("button", {
		text: "🔍",
		cls: "sm-almanac-toolbar__btn sm-almanac-toolbar__btn--action",
		attr: {
			title: "Search events (/ or Ctrl+F)",
			"aria-label": "Search events",
		},
	});
	searchBtn.addEventListener("click", () => {
		logger.info("Search button clicked");
		onSearch();
	});

	const createBtn = actionGroup.createEl("button", {
		text: "+",
		cls: "sm-almanac-toolbar__btn sm-almanac-toolbar__btn--primary",
		attr: {
			title: "Create new event (Ctrl+N)",
			"aria-label": "Create new event",
		},
	});
	createBtn.addEventListener("click", () => {
		logger.info("Create event button clicked");
		onCreateEvent();
	});

	const helpBtn = actionGroup.createEl("button", {
		text: "?",
		cls: "sm-almanac-toolbar__btn sm-almanac-toolbar__btn--action",
		attr: {
			title: "Show keyboard shortcuts (?)",
			"aria-label": "Show keyboard shortcuts help",
		},
	});
	helpBtn.addEventListener("click", () => {
		logger.info("Help button clicked");
		onShowHelp();
	});

	// Row 2: View Switcher
	const row2 = root.createDiv({ cls: "sm-almanac-toolbar__row-2" });

	const viewSwitcher = createViewSwitcher(row2, {
		currentView,
		onViewChange: (view) => {
			logger.info("View changed", { view });
			onViewChange(view);
		},
	});

	function updateTimeDisplay(element: HTMLElement, timestamp: CalendarTimestamp, calendarSchema: CalendarSchema): void {
		const monthName = calendarSchema.months.find((m) => m.id === timestamp.monthId)?.name;
		element.textContent = formatTimestamp(timestamp, monthName);
	}

	return {
		update(timestamp: CalendarTimestamp, view: AlmanacView, newActiveCalendarId?: string | null, newCalendars?: ReadonlyArray<CalendarSchema>): void {
			updateTimeDisplay(timeDisplay, timestamp, schema);
			viewSwitcher.setActiveView(view);

			// Update calendar selector if calendars changed
			if (newActiveCalendarId !== undefined && newCalendars !== undefined) {
				calendarSelector.update(newActiveCalendarId, newCalendars);
			}

			logger.info("Updated", { timestamp, view });
		},

		destroy(): void {
			viewSwitcher.destroy();
			calendarSelector.destroy();
			root.remove();
			logger.info("Destroyed");
		},

		get root(): HTMLElement {
			return root;
		},
	};
}
