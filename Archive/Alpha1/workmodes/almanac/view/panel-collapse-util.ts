// src/workmodes/almanac/view/panel-collapse-util.ts
// Reusable utility for collapsible panels (Phase 2)
//
// Provides consistent collapse/expand behavior across all sidebar panels
// with localStorage persistence.

import { configurableLogger } from '@services/logging/configurable-logger';
const logger = configurableLogger.forModule('almanac-panel-collapse');

export interface CollapsiblePanelOptions {
	readonly panelId: string;
	readonly storageKey?: string;
	readonly defaultCollapsed?: boolean;
	readonly onToggle?: (collapsed: boolean) => void;
}

export interface CollapsiblePanelState {
	isCollapsed: boolean;
	toggle(): void;
	setCollapsed(collapsed: boolean): void;
	destroy(): void;
}

const STORAGE_PREFIX = "sm-almanac-panel-collapsed-";

/**
 * Create collapsible panel state
 *
 * Manages collapse/expand state for a sidebar panel.
 * Automatically persists state to localStorage.
 * Provides toggle() method for use in click handlers.
 *
 * Phase 2 Implementation
 */
export function createCollapsiblePanelState(
	options: CollapsiblePanelOptions
): CollapsiblePanelState {
	const {
		panelId,
		storageKey = STORAGE_PREFIX + panelId,
		defaultCollapsed = false,
		onToggle,
	} = options;

	let isCollapsed = loadCollapsedState(storageKey, defaultCollapsed);

	logger.info("Created collapsible panel state", {
		panelId,
		isCollapsed,
		defaultCollapsed,
	});

	return {
		get isCollapsed(): boolean {
			return isCollapsed;
		},

		toggle(): void {
			isCollapsed = !isCollapsed;
			saveCollapsedState(storageKey, isCollapsed);
			onToggle?.(isCollapsed);

			logger.info("Panel toggled", {
				panelId,
				isCollapsed,
			});
		},

		setCollapsed(collapsed: boolean): void {
			if (isCollapsed === collapsed) return;

			isCollapsed = collapsed;
			saveCollapsedState(storageKey, isCollapsed);
			onToggle?.(isCollapsed);

			logger.info("Panel collapsed state set", {
				panelId,
				isCollapsed,
			});
		},

		destroy(): void {
			// No cleanup needed (no event listeners)
			logger.info("Panel state destroyed", { panelId });
		},
	};
}

/**
 * Create collapse toggle button
 *
 * Creates a button element that toggles panel collapse state.
 * Button text updates automatically (▼ expanded, ▶ collapsed).
 *
 * Usage:
 * ```typescript
 * const collapseState = createCollapsiblePanelState({ panelId: 'inbox' });
 * const collapseBtn = createCollapseToggleButton(collapseState, () => renderPanel());
 * header.appendChild(collapseBtn);
 * ```
 */
export function createCollapseToggleButton(
	state: CollapsiblePanelState,
	onToggle: () => void
): HTMLButtonElement {
	const btn = document.createElement("button");
	btn.className = "sm-almanac-panel__collapse-btn";
	btn.textContent = state.isCollapsed ? "▶" : "▼";
	btn.setAttribute("aria-label", state.isCollapsed ? "Expand panel" : "Collapse panel");
	btn.setAttribute("aria-expanded", state.isCollapsed ? "false" : "true");

	btn.addEventListener("click", () => {
		state.toggle();
		btn.textContent = state.isCollapsed ? "▶" : "▼";
		btn.setAttribute("aria-label", state.isCollapsed ? "Expand panel" : "Collapse panel");
		btn.setAttribute("aria-expanded", state.isCollapsed ? "false" : "true");
		onToggle();
	});

	return btn;
}

// Helper functions

function loadCollapsedState(storageKey: string, defaultValue: boolean): boolean {
	try {
		const stored = localStorage.getItem(storageKey);
		if (stored === null) return defaultValue;
		return stored === "true";
	} catch (error) {
		logger.error("Failed to load collapsed state", {
			error,
			storageKey,
		});
		return defaultValue;
	}
}

function saveCollapsedState(storageKey: string, collapsed: boolean): void {
	try {
		localStorage.setItem(storageKey, collapsed.toString());
	} catch (error) {
		logger.error("Failed to save collapsed state", {
			error,
			storageKey,
		});
	}
}
