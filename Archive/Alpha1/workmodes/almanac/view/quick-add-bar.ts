// src/workmodes/almanac/view/quick-add-bar.ts
// Quick-Add Bar for fast event creation (Phase 2)
//
// Features:
// - Collapsed by default (show only header)
// - Smart date picker (tomorrow, next week, custom)
// - Smart time picker (hour:minute dropdowns)
// - Category/Priority dropdowns
// - "Advanced..." button opens full modal
// - Creates event in 2-3 keystrokes
// - Keyboard shortcuts: Ctrl+Shift+N or Q

import type { App } from "obsidian";
import { configurableLogger } from '@services/logging/configurable-logger';
const logger = configurableLogger.forModule('almanac-quick-add-bar');
import { templateRepository } from "../data/template-repository";
import { createSingleEvent, createHourTimestamp, advanceTime } from "../helpers";
import { getTemplateDisplayName, getTopTemplates, getPinnedTemplates } from "../helpers/event-templates";
import { openEventEditor } from "./event-editor-modal";
import { createCollapsiblePanelState, createCollapseToggleButton } from "./panel-collapse-util";
import { openTemplateManager } from "./template-manager-modal";
import type { CalendarEvent, CalendarSchema, CalendarTimestamp } from "../helpers";
import type { EventTemplate } from "../helpers/event-templates";

export interface QuickAddBarOptions {
	readonly app: App;
	readonly schema: CalendarSchema;
	readonly currentTimestamp: CalendarTimestamp;
	readonly onEventCreated?: (event: CalendarEvent) => void;
}

export interface QuickAddBarHandle {
	destroy(): void;
	focus(): void;
}

/**
 * Create Quick-Add Bar
 *
 * Provides fast event creation with smart defaults:
 * - Title input
 * - Smart date picker (Today, Tomorrow, Next Week, Custom)
 * - Time picker (hour:minute dropdowns)
 * - Category/Priority dropdowns
 * - "Advanced..." button opens full modal
 *
 * Phase 2 Implementation
 */
export function createQuickAddBar(
	container: HTMLElement,
	options: QuickAddBarOptions
): QuickAddBarHandle {
	const { app, schema, currentTimestamp, onEventCreated } = options;

	const root = container.createDiv({ cls: "sm-quick-add-bar" });

	// Create collapsible panel state (collapsed by default)
	const collapseState = createCollapsiblePanelState({
		panelId: "quick-add",
		defaultCollapsed: true,
	});

	// Render panel
	renderPanel();

	function renderPanel(): void {
		root.empty();

		// Header
		const header = root.createDiv({ cls: "sm-quick-add-bar__header" });
		const collapseBtn = createCollapseToggleButton(collapseState, renderPanel);
		collapseBtn.classList.add("sm-quick-add-bar__collapse-btn");
		header.appendChild(collapseBtn);

		header.createEl("h3", {
			text: "➕ Schnell-Hinzufügen",
			cls: "sm-quick-add-bar__title",
		});

		// Stop here if collapsed
		if (collapseState.isCollapsed) {
			return;
		}

		// Form
		const form = root.createDiv({ cls: "sm-quick-add-bar__form" });

		// Phase 4: Template selector
		const templateRow = form.createDiv({ cls: "sm-quick-add-bar__row" });
		templateRow.createSpan({ text: "Vorlage:", cls: "sm-quick-add-bar__label" });

		const allTemplates = templateRepository.loadTemplates();
		const pinnedTemplates = getPinnedTemplates(allTemplates);
		const topTemplates = getTopTemplates(allTemplates, 5);
		const displayTemplates = [
			...pinnedTemplates,
			...topTemplates.filter(t => !pinnedTemplates.find(p => p.id === t.id))
		];

		const templateSelect = templateRow.createEl("select", {
			cls: "sm-quick-add-bar__select",
		});
		templateSelect.createEl("option", { text: "-- Keine Vorlage --", value: "" });
		for (const template of displayTemplates) {
			templateSelect.createEl("option", {
				text: getTemplateDisplayName(template),
				value: template.id,
			});
		}

		templateSelect.addEventListener("change", () => {
			const templateId = templateSelect.value;
			if (templateId) {
				const template = templateRepository.getTemplateById(templateId);
				if (template) {
					applyTemplate(template);
				}
			}
		});

		const manageTemplatesBtn = templateRow.createEl("button", {
			text: "Verwalten...",
			cls: "sm-quick-add-bar__btn sm-quick-add-bar__btn--small",
		});
		manageTemplatesBtn.addEventListener("click", () => {
			openTemplateManager(app, {
				app,
				onTemplateSelected: (template) => {
					applyTemplate(template);
					// Update dropdown to show selected template
					templateSelect.value = template.id;
				},
			});
		});

		// Title input
		const titleRow = form.createDiv({ cls: "sm-quick-add-bar__row" });
		titleRow.createSpan({ text: "Titel:", cls: "sm-quick-add-bar__label" });
		const titleInput = titleRow.createEl("input", {
			cls: "sm-quick-add-bar__input",
			type: "text",
			attr: { placeholder: "Ereignis-Titel..." },
		});

		// Date picker row
		const dateRow = form.createDiv({ cls: "sm-quick-add-bar__row" });
		dateRow.createSpan({ text: "Datum:", cls: "sm-quick-add-bar__label" });
		const dateSelect = dateRow.createEl("select", {
			cls: "sm-quick-add-bar__select",
		});

		// Smart date options
		dateSelect.createEl("option", { text: "Heute", value: "today" });
		dateSelect.createEl("option", { text: "Morgen", value: "tomorrow" });
		dateSelect.createEl("option", { text: "Nächste Woche", value: "next-week" });
		dateSelect.createEl("option", { text: "Benutzerdefiniert...", value: "custom" });

		// Time picker row
		const timeRow = form.createDiv({ cls: "sm-quick-add-bar__row" });
		timeRow.createSpan({ text: "Zeit:", cls: "sm-quick-add-bar__label" });

		const hourSelect = timeRow.createEl("select", {
			cls: "sm-quick-add-bar__select sm-quick-add-bar__select--small",
		});
		for (let h = 0; h < 24; h++) {
			const hourStr = h.toString().padStart(2, "0");
			hourSelect.createEl("option", { text: hourStr, value: hourStr });
		}
		hourSelect.value = currentTimestamp.hour?.toString().padStart(2, "0") ?? "12";

		timeRow.createSpan({ text: ":", cls: "sm-quick-add-bar__time-separator" });

		const minuteSelect = timeRow.createEl("select", {
			cls: "sm-quick-add-bar__select sm-quick-add-bar__select--small",
		});
		for (let m = 0; m < 60; m += 15) {
			const minStr = m.toString().padStart(2, "0");
			minuteSelect.createEl("option", { text: minStr, value: minStr });
		}
		minuteSelect.value = "00";

		// Category/Priority row
		const metaRow = form.createDiv({ cls: "sm-quick-add-bar__row" });
		metaRow.createSpan({ text: "Kategorie:", cls: "sm-quick-add-bar__label" });
		const categoryInput = metaRow.createEl("input", {
			cls: "sm-quick-add-bar__input sm-quick-add-bar__input--small",
			type: "text",
			attr: { placeholder: "Optional" },
		});

		metaRow.createSpan({ text: "Priorität:", cls: "sm-quick-add-bar__label" });
		const prioritySelect = metaRow.createEl("select", {
			cls: "sm-quick-add-bar__select sm-quick-add-bar__select--small",
		});
		prioritySelect.createEl("option", { text: "Niedrig (3)", value: "3" });
		prioritySelect.createEl("option", { text: "Normal (5)", value: "5", attr: { selected: "selected" } });
		prioritySelect.createEl("option", { text: "Hoch (7)", value: "7" });
		prioritySelect.createEl("option", { text: "Dringend (9)", value: "9" });

		// Action buttons row
		const actionsRow = form.createDiv({ cls: "sm-quick-add-bar__actions" });

		const advancedBtn = actionsRow.createEl("button", {
			text: "Erweitert...",
			cls: "sm-quick-add-bar__btn sm-quick-add-bar__btn--secondary",
		});
		advancedBtn.addEventListener("click", () => {
			openAdvancedEditor();
		});

		const cancelBtn = actionsRow.createEl("button", {
			text: "Abbrechen (Esc)",
			cls: "sm-quick-add-bar__btn sm-quick-add-bar__btn--secondary",
		});
		cancelBtn.addEventListener("click", () => {
			clearForm();
		});

		const createBtn = actionsRow.createEl("button", {
			text: "Erstellen (↵)",
			cls: "sm-quick-add-bar__btn sm-quick-add-bar__btn--primary",
		});
		createBtn.addEventListener("click", () => {
			createEvent();
		});

		// Enter key submits
		titleInput.addEventListener("keydown", (e) => {
			if (e.key === "Enter") {
				e.preventDefault();
				createEvent();
			} else if (e.key === "Escape") {
				e.preventDefault();
				clearForm();
			}
		});

		// Tab navigation (automatically works with native HTML)
		titleInput.focus();

		/**
		 * Apply Template
		 *
		 * Pre-fills the quick-add form with template values.
		 * Only fills fields if they are currently empty (doesn't override user input).
		 */
		function applyTemplate(template: EventTemplate): void {
			// Pre-fill title (only if empty)
			if (template.title && !titleInput.value.trim()) {
				titleInput.value = template.title;
			}

			// Pre-fill category (only if empty)
			if (template.category && !categoryInput.value.trim()) {
				categoryInput.value = template.category;
			}

			// Set priority
			if (template.priority !== undefined) {
				prioritySelect.value = template.priority.toString();
			}

			// Increment template use count
			templateRepository.incrementUseCount(template.id);

			logger.info("Template applied", {
				templateId: template.id,
				templateName: template.name,
			});
		}

		function getSelectedDate(): CalendarTimestamp {
			const dateValue = dateSelect.value;

			switch (dateValue) {
				case "today":
					return currentTimestamp;

				case "tomorrow": {
					const result = advanceTime(schema, currentTimestamp, 1, "day");
					return result.timestamp;
				}

				case "next-week": {
					const result = advanceTime(schema, currentTimestamp, 7, "day");
					return result.timestamp;
				}

				case "custom":
					// For now, default to today (full date picker is future work)
					return currentTimestamp;

				default:
					return currentTimestamp;
			}
		}

		function createEvent(): void {
			const title = titleInput.value.trim();
			if (!title) {
				titleInput.focus();
				return;
			}

			const baseDate = getSelectedDate();
			const hour = parseInt(hourSelect.value, 10);
			const minute = parseInt(minuteSelect.value, 10);

			const timestamp = createHourTimestamp(
				schema.id,
				baseDate.year,
				baseDate.monthId,
				baseDate.day,
				hour,
				minute
			);

			const event = createSingleEvent(
				`quick-${Date.now()}`,
				schema.id,
				title,
				timestamp
			);

			// Add optional category
			if (categoryInput.value.trim()) {
				event.category = categoryInput.value.trim();
			}

			// Add priority
			event.priority = parseInt(prioritySelect.value, 10);

			logger.info("Event created", {
				title,
				timestamp,
				category: event.category,
				priority: event.priority,
			});

			// Notify callback
			onEventCreated?.(event);

			// Clear form
			clearForm();
		}

		function clearForm(): void {
			templateSelect.value = ""; // Phase 4: Reset template selector
			titleInput.value = "";
			categoryInput.value = "";
			dateSelect.value = "today";
			hourSelect.value = currentTimestamp.hour?.toString().padStart(2, "0") ?? "12";
			minuteSelect.value = "00";
			prioritySelect.value = "5";
			titleInput.focus();
		}

		function openAdvancedEditor(): void {
			const title = titleInput.value.trim();
			const baseDate = getSelectedDate();
			const hour = parseInt(hourSelect.value, 10);
			const minute = parseInt(minuteSelect.value, 10);

			const timestamp = createHourTimestamp(
				schema.id,
				baseDate.year,
				baseDate.monthId,
				baseDate.day,
				hour,
				minute
			);

			const partialEvent = createSingleEvent(
				`quick-${Date.now()}`,
				schema.id,
				title || "Neues Ereignis",
				timestamp
			);

			if (categoryInput.value.trim()) {
				partialEvent.category = categoryInput.value.trim();
			}

			partialEvent.priority = parseInt(prioritySelect.value, 10);

			openEventEditor(app, {
				schema,
				currentTime: currentTimestamp,
				event: partialEvent,
				onSave: (savedEvent) => {
					logger.info("Event saved from advanced editor", {
						eventId: savedEvent.id,
					});
					onEventCreated?.(savedEvent);
					clearForm();
				},
			});
		}
	}

	return {
		destroy(): void {
			collapseState.destroy();
			root.remove();
			logger.info("Destroyed");
		},

		focus(): void {
			// Expand if collapsed
			if (collapseState.isCollapsed) {
				collapseState.toggle();
				renderPanel();
			}

			// Focus title input
			const titleInput = root.querySelector<HTMLInputElement>(
				".sm-quick-add-bar__input[type='text']"
			);
			titleInput?.focus();
		},
	};
}
