// src/workmodes/almanac/view/view-switcher.ts
// View Switcher component for Almanac (Phase 3)
//
// Features:
// - 4 view buttons with keyboard hints (1-4)
// - Icons + Text format: "[1 📋 List]"
// - Active state highlighting
// - Hover tooltips (optional)
//
// Phase 3: Extracted from almanac-mvp.ts for reusability

import { configurableLogger } from '@services/logging/configurable-logger';
const logger = configurableLogger.forModule('almanac-view-switcher');

export type AlmanacView = "list" | "month" | "week" | "timeline";

export interface ViewSwitcherOptions {
	readonly currentView: AlmanacView;
	readonly onViewChange: (view: AlmanacView) => void;
}

export interface ViewSwitcherHandle {
	setActiveView(view: AlmanacView): void;
	destroy(): void;
	readonly root: HTMLElement;
}

interface ViewConfig {
	readonly id: AlmanacView;
	readonly number: string;
	readonly icon: string;
	readonly label: string;
	readonly tooltip: string;
}

const VIEW_CONFIGS: ViewConfig[] = [
	{
		id: "list",
		number: "1",
		icon: "📋",
		label: "List",
		tooltip: "List view - Chronological event list (Press 1)",
	},
	{
		id: "month",
		number: "2",
		icon: "📅",
		label: "Month",
		tooltip: "Month view - Calendar grid (Press 2)",
	},
	{
		id: "week",
		number: "3",
		icon: "📆",
		label: "Week",
		tooltip: "Week view - 7-day schedule (Press 3)",
	},
	{
		id: "timeline",
		number: "4",
		icon: "⏱",
		label: "Timeline",
		tooltip: "Timeline view - Chronological feed (Press 4)",
	},
];

/**
 * Create View Switcher
 *
 * Provides 4 view buttons with keyboard hints and active state.
 * Format: [1 📋 List] [2 📅 Month] [3 📆 Week] [4 ⏱ Timeline]
 *
 * Phase 3 Implementation - Extracted from almanac-mvp.ts
 */
export function createViewSwitcher(
	container: HTMLElement,
	options: ViewSwitcherOptions
): ViewSwitcherHandle {
	const { currentView, onViewChange } = options;

	const root = container.createDiv({ cls: "sm-almanac-view-switcher" });

	const buttons: Map<AlmanacView, HTMLButtonElement> = new Map();

	// Create buttons for each view
	for (const config of VIEW_CONFIGS) {
		const btn = root.createEl("button", {
			cls: "sm-almanac-view-switcher__btn",
			attr: {
				title: config.tooltip,
				"aria-label": config.tooltip,
			},
		});

		// Button content: [Number Icon Label]
		const numberSpan = btn.createSpan({
			text: config.number,
			cls: "sm-almanac-view-switcher__btn-number",
		});

		const iconSpan = btn.createSpan({
			text: config.icon,
			cls: "sm-almanac-view-switcher__btn-icon",
		});

		const labelSpan = btn.createSpan({
			text: config.label,
			cls: "sm-almanac-view-switcher__btn-label",
		});

		// Set active state
		if (config.id === currentView) {
			btn.addClass("is-active");
		}

		// Click handler
		btn.addEventListener("click", () => {
			logger.info("View changed", { view: config.id });
			onViewChange(config.id);
		});

		buttons.set(config.id, btn);
	}

	return {
		setActiveView(view: AlmanacView): void {
			// Remove is-active from all buttons
			buttons.forEach((btn) => btn.removeClass("is-active"));

			// Add is-active to selected button
			const activeBtn = buttons.get(view);
			if (activeBtn) {
				activeBtn.addClass("is-active");
			}

			logger.info("Active view set", { view });
		},

		destroy(): void {
			logger.info("Destroyed");
			root.remove();
		},

		get root(): HTMLElement {
			return root;
		},
	};
}
