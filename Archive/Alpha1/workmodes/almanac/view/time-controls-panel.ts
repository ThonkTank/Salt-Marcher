// src/workmodes/almanac/view/time-controls-panel.ts
// Time Controls Panel for Almanac sidebar (Phase 3)
//
// Features:
// - Collapsible panel with +/- buttons for Day/Hour/Minute
// - localStorage persistence for collapse state
// - Clean interface for time advancement
//
// Phase 3: Moves time controls from toolbar to sidebar for cleaner layout

import { configurableLogger } from '@services/logging/configurable-logger';
const logger = configurableLogger.forModule('almanac-time-controls');
import { createCollapsiblePanelState, createCollapseToggleButton } from "./panel-collapse-util";

export interface TimeControlsPanelOptions {
	readonly onAdvanceDay: (amount: number) => void;
	readonly onAdvanceHour: (amount: number) => void;
	readonly onAdvanceMinute: (amount: number) => void;
}

export interface TimeControlsPanelHandle {
	destroy(): void;
	readonly root: HTMLElement;
}

/**
 * Create Time Controls Panel
 *
 * Provides a collapsible sidebar panel with +/- buttons for time advancement.
 * - Day: +/- 1 day
 * - Hour: +/- 1 hour
 * - Minute: +/- 1 minute
 *
 * Phase 3 Implementation
 */
export function createTimeControlsPanel(
	container: HTMLElement,
	options: TimeControlsPanelOptions
): TimeControlsPanelHandle {
	const { onAdvanceDay, onAdvanceHour, onAdvanceMinute } = options;

	const root = container.createDiv({ cls: "sm-time-controls-panel" });

	// Create collapsible panel state (collapsed by default)
	const collapseState = createCollapsiblePanelState({
		panelId: "time-controls",
		defaultCollapsed: true,
	});

	renderPanel();

	function renderPanel(): void {
		root.empty();

		// Header
		const header = root.createDiv({ cls: "sm-time-controls-panel__header" });
		const collapseBtn = createCollapseToggleButton(collapseState, renderPanel);
		collapseBtn.classList.add("sm-time-controls-panel__collapse-btn");
		header.appendChild(collapseBtn);

		header.createEl("h3", {
			text: "⏱ Zeitsteuerung",
			cls: "sm-time-controls-panel__title",
		});

		// Stop here if collapsed
		if (collapseState.isCollapsed) {
			return;
		}

		// Body
		const body = root.createDiv({ cls: "sm-time-controls-panel__body" });

		// Day controls
		const dayRow = body.createDiv({ cls: "sm-time-controls-panel__row" });
		dayRow.createSpan({ text: "Tag:", cls: "sm-time-controls-panel__label" });

		const dayMinusBtn = dayRow.createEl("button", {
			text: "−",
			cls: "sm-time-controls-panel__btn",
			attr: { title: "Previous day" },
		});
		dayMinusBtn.addEventListener("click", () => {
			logger.info("Day -1");
			onAdvanceDay(-1);
		});

		const dayPlusBtn = dayRow.createEl("button", {
			text: "+",
			cls: "sm-time-controls-panel__btn",
			attr: { title: "Next day" },
		});
		dayPlusBtn.addEventListener("click", () => {
			logger.info("Day +1");
			onAdvanceDay(1);
		});

		// Hour controls
		const hourRow = body.createDiv({ cls: "sm-time-controls-panel__row" });
		hourRow.createSpan({ text: "Stunde:", cls: "sm-time-controls-panel__label" });

		const hourMinusBtn = hourRow.createEl("button", {
			text: "−",
			cls: "sm-time-controls-panel__btn",
			attr: { title: "Previous hour" },
		});
		hourMinusBtn.addEventListener("click", () => {
			logger.info("Hour -1");
			onAdvanceHour(-1);
		});

		const hourPlusBtn = hourRow.createEl("button", {
			text: "+",
			cls: "sm-time-controls-panel__btn",
			attr: { title: "Next hour" },
		});
		hourPlusBtn.addEventListener("click", () => {
			logger.info("Hour +1");
			onAdvanceHour(1);
		});

		// Minute controls
		const minuteRow = body.createDiv({ cls: "sm-time-controls-panel__row" });
		minuteRow.createSpan({ text: "Minute:", cls: "sm-time-controls-panel__label" });

		const minuteMinusBtn = minuteRow.createEl("button", {
			text: "−",
			cls: "sm-time-controls-panel__btn",
			attr: { title: "Previous minute" },
		});
		minuteMinusBtn.addEventListener("click", () => {
			logger.info("Minute -1");
			onAdvanceMinute(-1);
		});

		const minutePlusBtn = minuteRow.createEl("button", {
			text: "+",
			cls: "sm-time-controls-panel__btn",
			attr: { title: "Next minute" },
		});
		minutePlusBtn.addEventListener("click", () => {
			logger.info("Minute +1");
			onAdvanceMinute(1);
		});
	}

	return {
		destroy(): void {
			collapseState.destroy();
			root.remove();
			logger.info("Destroyed");
		},

		get root(): HTMLElement {
			return root;
		},
	};
}
