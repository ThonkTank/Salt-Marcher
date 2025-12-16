// src/workmodes/almanac/view/template-editor-modal.ts
// Template Editor Modal for Almanac (Phase 4)
//
// Provides:
// - Form for creating/editing event templates
// - Checkbox system for which fields to pre-fill
// - Icon picker for template icon
// - Save/Cancel actions

import type { App} from "obsidian";
import { Modal, Notice, Setting } from "obsidian";
import { configurableLogger } from '@services/logging/configurable-logger';
const logger = configurableLogger.forModule('almanac-template-editor');
import type { EventTemplate } from "../helpers/event-templates";

export interface TemplateEditorModalOptions {
	readonly app: App;
	readonly template: EventTemplate;
	readonly onSave?: (template: EventTemplate) => void;
}

/**
 * Template Editor Modal
 *
 * Allows users to create or edit event templates.
 * Each field has a checkbox to enable/disable pre-filling.
 */
export class TemplateEditorModal extends Modal {
	private options: TemplateEditorModalOptions;

	// Form state
	private formData: {
		id: string;
		name: string;
		icon: string;
		description: string;
		isBuiltIn: boolean;
		// Field enable/disable flags
		enableTitle: boolean;
		enableDescription: boolean;
		enableCategory: boolean;
		enableTags: boolean;
		enablePriority: boolean;
		enableAllDay: boolean;
		enableEventKind: boolean;
		enableRecurrence: boolean;
		enableDuration: boolean;
		// Field values
		title: string;
		descriptionText: string;
		category: string;
		tags: string[];
		priority: number;
		allDay: boolean;
		eventKind: "single" | "recurring";
		recurrenceType: "annual" | "monthly_position" | "weekly_dayIndex" | "custom";
		weeklyInterval: number;
		defaultDurationMinutes: number;
	};

	constructor(app: App, options: TemplateEditorModalOptions) {
		super(app);
		this.options = options;

		const template = options.template;

		// Initialize form data from template
		this.formData = {
			id: template.id,
			name: template.name,
			icon: template.icon,
			description: template.description ?? "",
			isBuiltIn: template.isBuiltIn,
			// Enable flags (based on whether template has values)
			enableTitle: template.title !== undefined,
			enableDescription: template.descriptionText !== undefined,
			enableCategory: template.category !== undefined,
			enableTags: template.tags !== undefined,
			enablePriority: template.priority !== undefined,
			enableAllDay: template.allDay !== undefined,
			enableEventKind: template.eventKind !== undefined,
			enableRecurrence: template.recurrenceType !== undefined,
			enableDuration: template.defaultDurationMinutes !== undefined,
			// Field values
			title: template.title ?? "",
			descriptionText: template.descriptionText ?? "",
			category: template.category ?? "",
			tags: template.tags ? [...template.tags] : [],
			priority: template.priority ?? 5,
			allDay: template.allDay ?? false,
			eventKind: template.eventKind ?? "single",
			recurrenceType: template.recurrenceType ?? "annual",
			weeklyInterval: template.weeklyInterval ?? 1,
			defaultDurationMinutes: template.defaultDurationMinutes ?? 60,
		};
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass("sm-template-editor");

		const isEditMode = this.options.template.id.startsWith("template_");
		const title = isEditMode ? "Edit Template" : "Create Template";

		contentEl.createEl("h2", { text: title });

		// Built-in warning
		if (this.formData.isBuiltIn) {
			const warning = contentEl.createDiv({
				cls: "sm-template-editor__warning",
			});
			warning.createEl("p", {
				text: "⚠️ This is a built-in template. Only metadata (pinned status, usage) can be modified. Name, icon, and fields are read-only.",
			});
		}

		// Render form sections
		this.renderBasicFields(contentEl);
		this.renderPrefilledFields(contentEl);
		this.renderActionButtons(contentEl);
	}

	private renderBasicFields(container: HTMLElement): void {
		const section = container.createDiv({ cls: "sm-template-editor__section" });
		section.createEl("h3", { text: "Template Info" });

		// Name
		new Setting(section)
			.setName("Name")
			.setDesc("Template name (shown in dropdowns)")
			.addText((text) =>
				text
					.setPlaceholder("Festival Template")
					.setValue(this.formData.name)
					.setDisabled(this.formData.isBuiltIn)
					.onChange((value) => {
						this.formData.name = value;
					})
			);

		// Icon
		new Setting(section)
			.setName("Icon")
			.setDesc("Emoji icon (e.g., 🎭, 📜, ⚔️)")
			.addText((text) =>
				text
					.setPlaceholder("🎭")
					.setValue(this.formData.icon)
					.setDisabled(this.formData.isBuiltIn)
					.onChange((value) => {
						this.formData.icon = value;
					})
			);

		// Description
		new Setting(section)
			.setName("Description")
			.setDesc("Optional description of template purpose")
			.addTextArea((text) => {
				text
					.setPlaceholder("Annual celebration or holiday...")
					.setValue(this.formData.description)
					.setDisabled(this.formData.isBuiltIn)
					.onChange((value) => {
						this.formData.description = value;
					});
				text.inputEl.rows = 3;
				text.inputEl.style.width = "100%";
			});
	}

	private renderPrefilledFields(container: HTMLElement): void {
		const section = container.createDiv({ cls: "sm-template-editor__section" });
		section.createEl("h3", { text: "Pre-filled Values" });
		section.createEl("p", {
			text: "Check boxes to enable pre-filling. Unchecked fields will be left empty.",
			cls: "sm-template-editor__hint",
		});

		const isDisabled = this.formData.isBuiltIn;

		// Title
		this.renderCheckboxField(section, "Title", "enableTitle", "title", {
			placeholder: "Event title...",
			disabled: isDisabled,
		});

		// Description
		this.renderCheckboxFieldTextarea(
			section,
			"Description",
			"enableDescription",
			"descriptionText",
			{
				placeholder: "Event description...",
				disabled: isDisabled,
			}
		);

		// Category
		this.renderCheckboxField(section, "Category", "enableCategory", "category", {
			placeholder: "Festival, Meeting, Combat, etc.",
			disabled: isDisabled,
		});

		// Tags
		this.renderCheckboxField(section, "Tags", "enableTags", "tags", {
			placeholder: "festival, annual (comma-separated)",
			disabled: isDisabled,
			onChange: (value: string) => {
				this.formData.tags = value
					.split(",")
					.map((t) => t.trim())
					.filter((t) => t.length > 0);
			},
			getValue: () => this.formData.tags.join(", "),
		});

		// Priority
		this.renderCheckboxField(section, "Priority", "enablePriority", "priority", {
			placeholder: "5",
			disabled: isDisabled,
			type: "number",
		});

		// All-day
		this.renderCheckboxToggle(section, "All-Day Event", "enableAllDay", "allDay", {
			disabled: isDisabled,
		});

		// Event Kind
		this.renderCheckboxDropdown(
			section,
			"Event Kind",
			"enableEventKind",
			"eventKind",
			[
				{ value: "single", label: "Single Event" },
				{ value: "recurring", label: "Recurring Event" },
			],
			{ disabled: isDisabled }
		);

		// Recurrence Type (only if eventKind is recurring)
		if (this.formData.eventKind === "recurring") {
			this.renderCheckboxDropdown(
				section,
				"Recurrence",
				"enableRecurrence",
				"recurrenceType",
				[
					{ value: "annual", label: "Annual (Every Year)" },
					{ value: "monthly_position", label: "Monthly (Same Day Each Month)" },
					{ value: "weekly_dayIndex", label: "Weekly (Every N Weeks)" },
					{ value: "custom", label: "Custom" },
				],
				{ disabled: isDisabled }
			);
		}

		// Duration
		this.renderCheckboxField(section, "Duration (minutes)", "enableDuration", "defaultDurationMinutes", {
			placeholder: "60",
			disabled: isDisabled,
			type: "number",
		});
	}

	private renderCheckboxField(
		container: HTMLElement,
		label: string,
		enableKey: keyof typeof this.formData,
		valueKey: keyof typeof this.formData,
		options: { placeholder?: string; disabled?: boolean; type?: string; onChange?: (value: string) => void; getValue?: () => string }
	): void {
		const setting = new Setting(container).setName(label);

		// Checkbox
		setting.addToggle((toggle) =>
			toggle
				.setValue(this.formData[enableKey] as boolean)
				.setDisabled(options.disabled ?? false)
				.onChange((value) => {
					(this.formData[enableKey] as boolean) = value;
				})
		);

		// Input field
		setting.addText((text) => {
			const inputEl = text.inputEl;
			inputEl.type = options.type ?? "text";
			inputEl.placeholder = options.placeholder ?? "";
			inputEl.disabled = options.disabled ?? false;

			if (options.getValue) {
				inputEl.value = options.getValue();
			} else {
				inputEl.value = String(this.formData[valueKey] ?? "");
			}

			inputEl.addEventListener("input", () => {
				const value = inputEl.value;
				if (options.onChange) {
					options.onChange(value);
				} else if (options.type === "number") {
					const num = parseInt(value, 10);
					if (!isNaN(num)) {
						(this.formData[valueKey] as number) = num;
					}
				} else {
					(this.formData[valueKey] as string) = value;
				}
			});
		});
	}

	private renderCheckboxFieldTextarea(
		container: HTMLElement,
		label: string,
		enableKey: keyof typeof this.formData,
		valueKey: keyof typeof this.formData,
		options: { placeholder?: string; disabled?: boolean }
	): void {
		const setting = new Setting(container).setName(label);

		// Checkbox
		setting.addToggle((toggle) =>
			toggle
				.setValue(this.formData[enableKey] as boolean)
				.setDisabled(options.disabled ?? false)
				.onChange((value) => {
					(this.formData[enableKey] as boolean) = value;
				})
		);

		// Textarea
		setting.addTextArea((text) => {
			text
				.setPlaceholder(options.placeholder ?? "")
				.setValue(String(this.formData[valueKey] ?? ""))
				.setDisabled(options.disabled ?? false)
				.onChange((value) => {
					(this.formData[valueKey] as string) = value;
				});
			text.inputEl.rows = 3;
			text.inputEl.style.width = "100%";
		});
	}

	private renderCheckboxToggle(
		container: HTMLElement,
		label: string,
		enableKey: keyof typeof this.formData,
		valueKey: keyof typeof this.formData,
		options: { disabled?: boolean }
	): void {
		const setting = new Setting(container).setName(label);

		// Checkbox to enable
		setting.addToggle((toggle) =>
			toggle
				.setValue(this.formData[enableKey] as boolean)
				.setDisabled(options.disabled ?? false)
				.onChange((value) => {
					(this.formData[enableKey] as boolean) = value;
				})
		);

		// Toggle for value
		setting.addToggle((toggle) =>
			toggle
				.setValue(this.formData[valueKey] as boolean)
				.setDisabled(options.disabled ?? false)
				.onChange((value) => {
					(this.formData[valueKey] as boolean) = value;
				})
		);
	}

	private renderCheckboxDropdown(
		container: HTMLElement,
		label: string,
		enableKey: keyof typeof this.formData,
		valueKey: keyof typeof this.formData,
		dropdownOptions: Array<{ value: string; label: string }>,
		options: { disabled?: boolean }
	): void {
		const setting = new Setting(container).setName(label);

		// Checkbox
		setting.addToggle((toggle) =>
			toggle
				.setValue(this.formData[enableKey] as boolean)
				.setDisabled(options.disabled ?? false)
				.onChange((value) => {
					(this.formData[enableKey] as boolean) = value;
				})
		);

		// Dropdown
		setting.addDropdown((dropdown) => {
			for (const opt of dropdownOptions) {
				dropdown.addOption(opt.value, opt.label);
			}
			dropdown
				.setValue(String(this.formData[valueKey]))
				.setDisabled(options.disabled ?? false)
				.onChange((value) => {
					(this.formData[valueKey] as string) = value;
				});
		});
	}

	private renderActionButtons(container: HTMLElement): void {
		const btnRow = container.createDiv({ cls: "modal-button-container" });

		// Save button
		const saveBtn = btnRow.createEl("button", {
			text: "Save Template",
			cls: "mod-cta",
		});
		saveBtn.addEventListener("click", () => this.handleSave());

		// Cancel button
		const cancelBtn = btnRow.createEl("button", { text: "Cancel" });
		cancelBtn.addEventListener("click", () => this.close());
	}

	private validateForm(): string | null {
		// Name is required
		if (!this.formData.name.trim()) {
			return "Template name is required";
		}

		// Icon is required
		if (!this.formData.icon.trim()) {
			return "Template icon is required";
		}

		return null;
	}

	private buildTemplateObject(): EventTemplate {
		const base: EventTemplate = {
			id: this.formData.id,
			name: this.formData.name.trim(),
			icon: this.formData.icon.trim(),
			description: this.formData.description.trim() || undefined,
			isBuiltIn: this.formData.isBuiltIn,
			// Metadata preserved
			isPinned: this.options.template.isPinned,
			lastUsed: this.options.template.lastUsed,
			useCount: this.options.template.useCount,
		};

		// Add optional fields (only if enabled)
		return {
			...base,
			title: this.formData.enableTitle ? this.formData.title.trim() || undefined : undefined,
			descriptionText: this.formData.enableDescription
				? this.formData.descriptionText.trim() || undefined
				: undefined,
			category: this.formData.enableCategory ? this.formData.category.trim() || undefined : undefined,
			tags: this.formData.enableTags && this.formData.tags.length > 0 ? this.formData.tags : undefined,
			priority: this.formData.enablePriority ? this.formData.priority : undefined,
			allDay: this.formData.enableAllDay ? this.formData.allDay : undefined,
			eventKind: this.formData.enableEventKind ? this.formData.eventKind : undefined,
			recurrenceType: this.formData.enableRecurrence ? this.formData.recurrenceType : undefined,
			weeklyInterval:
				this.formData.enableRecurrence && this.formData.recurrenceType === "weekly_dayIndex"
					? this.formData.weeklyInterval
					: undefined,
			defaultDurationMinutes: this.formData.enableDuration
				? this.formData.defaultDurationMinutes
				: undefined,
		};
	}

	private handleSave(): void {
		// Validate form
		const error = this.validateForm();
		if (error) {
			new Notice(error);
			return;
		}

		try {
			// Build template object
			const template = this.buildTemplateObject();

			logger.info("Template saved", {
				templateId: template.id,
				name: template.name,
			});

			// Call callback
			if (this.options.onSave) {
				this.options.onSave(template);
			}

			this.close();
		} catch (error) {
			logger.error("Failed to save template", { error });
			new Notice("Failed to save template. Check console for details.");
		}
	}

	onClose(): void {
		const { contentEl } = this;
		contentEl.removeClass("sm-template-editor");
		contentEl.empty();
	}
}

/**
 * Open Template Editor Modal
 *
 * @param app - Obsidian App instance
 * @param options - Editor options
 */
export function openTemplateEditor(app: App, options: TemplateEditorModalOptions): void {
	const modal = new TemplateEditorModal(app, options);
	modal.open();
}
