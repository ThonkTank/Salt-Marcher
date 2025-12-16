// src/workmodes/almanac/view/template-manager-modal.ts
// Template Manager Modal for Almanac (Phase 4)
//
// Provides:
// - List all templates (built-in + custom)
// - Search/filter templates
// - Pin/unpin templates
// - Edit templates (opens template editor)
// - Delete custom templates
// - Create new templates

import type { App} from "obsidian";
import { Modal, Notice } from "obsidian";
import { configurableLogger } from '@services/logging/configurable-logger';
const logger = configurableLogger.forModule('almanac-template-manager');
import { templateRepository } from "../data/template-repository";
import {
	filterTemplates,
	sortTemplatesByUsage,
	getPinnedTemplates,
} from "../helpers/event-templates";
import { openTemplateEditor } from "./template-editor-modal";
import type { EventTemplate } from "../helpers/event-templates";

export interface TemplateManagerModalOptions {
	readonly app: App;
	readonly onTemplateSelected?: (template: EventTemplate) => void;
}

/**
 * Template Manager Modal
 *
 * Shows all available templates organized by:
 * - Pinned templates (at top)
 * - Most used templates
 * - All templates (alphabetical)
 *
 * Actions: Pin/Unpin, Edit, Delete (custom only), Create New
 */
export class TemplateManagerModal extends Modal {
	private options: TemplateManagerModalOptions;
	private templates: EventTemplate[];
	private searchQuery: string = "";
	private contentContainer: HTMLElement | null = null;

	constructor(app: App, options: TemplateManagerModalOptions) {
		super(app);
		this.options = options;
		this.templates = templateRepository.loadTemplates();
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass("sm-template-manager");

		// Title
		contentEl.createEl("h2", { text: "Event Templates" });

		// Search bar
		this.renderSearchBar(contentEl);

		// Content container (for re-rendering after actions)
		this.contentContainer = contentEl.createDiv({
			cls: "sm-template-manager__content",
		});

		this.renderContent();
	}

	private renderSearchBar(container: HTMLElement): void {
		const searchContainer = container.createDiv({
			cls: "sm-template-manager__search",
		});

		const searchInput = searchContainer.createEl("input", {
			cls: "sm-template-manager__search-input",
			type: "text",
			attr: {
				placeholder: "Search templates...",
			},
		});

		searchInput.addEventListener("input", (e) => {
			this.searchQuery = (e.target as HTMLInputElement).value;
			this.renderContent();
		});

		// Focus search input on open
		setTimeout(() => searchInput.focus(), 100);
	}

	private renderContent(): void {
		if (!this.contentContainer) return;

		this.contentContainer.empty();

		// Filter templates by search query
		const filtered = filterTemplates(this.templates, this.searchQuery);

		if (filtered.length === 0) {
			this.contentContainer.createEl("p", {
				text: "No templates found.",
				cls: "sm-template-manager__empty",
			});
			return;
		}

		// Group templates
		const pinned = getPinnedTemplates(filtered);
		const mostUsed = sortTemplatesByUsage(filtered).slice(0, 5);
		const all = [...filtered].sort((a, b) => a.name.localeCompare(b.name));

		// Render sections
		if (pinned.length > 0) {
			this.renderSection(this.contentContainer, "⭐ Pinned", pinned);
		}

		if (mostUsed.length > 0 && !this.searchQuery) {
			this.renderSection(this.contentContainer, "📊 Most Used", mostUsed);
		}

		this.renderSection(this.contentContainer, "📚 All Templates", all);

		// Create new template button
		this.renderCreateButton(this.contentContainer);
	}

	private renderSection(
		container: HTMLElement,
		title: string,
		templates: EventTemplate[]
	): void {
		const section = container.createDiv({
			cls: "sm-template-manager__section",
		});

		section.createEl("h3", {
			text: title,
			cls: "sm-template-manager__section-title",
		});

		const list = section.createDiv({ cls: "sm-template-manager__list" });

		for (const template of templates) {
			this.renderTemplateItem(list, template);
		}
	}

	private renderTemplateItem(container: HTMLElement, template: EventTemplate): void {
		const item = container.createDiv({ cls: "sm-template-manager__item" });

		// Template icon and name
		const nameContainer = item.createDiv({
			cls: "sm-template-manager__item-name",
		});

		nameContainer.createSpan({
			text: template.icon,
			cls: "sm-template-manager__item-icon",
		});

		nameContainer.createSpan({
			text: template.name,
			cls: "sm-template-manager__item-title",
		});

		// Usage count (if > 0)
		if (template.useCount && template.useCount > 0) {
			nameContainer.createSpan({
				text: `(${template.useCount} uses)`,
				cls: "sm-template-manager__item-uses",
			});
		}

		// Built-in badge
		if (template.isBuiltIn) {
			nameContainer.createSpan({
				text: "Built-in",
				cls: "sm-template-manager__item-badge",
			});
		}

		// Actions container
		const actions = item.createDiv({ cls: "sm-template-manager__item-actions" });

		// Pin/Unpin button
		const pinBtn = actions.createEl("button", {
			text: template.isPinned ? "📌" : "📍",
			cls: "sm-template-manager__action-btn",
			attr: {
				title: template.isPinned ? "Unpin" : "Pin",
				"aria-label": template.isPinned ? "Unpin template" : "Pin template",
			},
		});
		pinBtn.addEventListener("click", (e) => {
			e.stopPropagation();
			this.handlePin(template);
		});

		// Edit button
		const editBtn = actions.createEl("button", {
			text: "✏️",
			cls: "sm-template-manager__action-btn",
			attr: {
				title: "Edit",
				"aria-label": "Edit template",
			},
		});
		editBtn.addEventListener("click", (e) => {
			e.stopPropagation();
			this.handleEdit(template);
		});

		// Delete button (custom templates only)
		if (!template.isBuiltIn) {
			const deleteBtn = actions.createEl("button", {
				text: "×",
				cls: "sm-template-manager__action-btn sm-template-manager__action-btn--delete",
				attr: {
					title: "Delete",
					"aria-label": "Delete template",
				},
			});
			deleteBtn.addEventListener("click", (e) => {
				e.stopPropagation();
				this.handleDelete(template);
			});
		}

		// Click on item to select (if callback provided)
		if (this.options.onTemplateSelected) {
			item.classList.add("is-clickable");
			item.addEventListener("click", () => {
				this.options.onTemplateSelected?.(template);
				this.close();
			});
		}
	}

	private renderCreateButton(container: HTMLElement): void {
		const btnContainer = container.createDiv({
			cls: "sm-template-manager__create-container",
		});

		const createBtn = btnContainer.createEl("button", {
			text: "+ Create New Template",
			cls: "sm-template-manager__create-btn",
		});

		createBtn.addEventListener("click", () => {
			this.handleCreate();
		});
	}

	private handlePin(template: EventTemplate): void {
		try {
			const newPinStatus = templateRepository.togglePin(template.id);
			new Notice(
				`Template "${template.name}" ${newPinStatus ? "pinned" : "unpinned"}`
			);

			// Reload templates and re-render
			this.templates = templateRepository.loadTemplates();
			this.renderContent();

			logger.info("Template pin toggled", {
				templateId: template.id,
				isPinned: newPinStatus,
			});
		} catch (error) {
			logger.error("Failed to toggle pin", {
				templateId: template.id,
				error,
			});
			new Notice("Failed to pin/unpin template");
		}
	}

	private handleEdit(template: EventTemplate): void {
		logger.info("Opening template editor", {
			templateId: template.id,
		});

		openTemplateEditor(this.app, {
			template,
			onSave: (updatedTemplate) => {
				try {
					if (updatedTemplate.isBuiltIn) {
						// For built-in templates, only metadata can be updated
						// Name, icon, fields are immutable
						new Notice("Built-in templates cannot be modified");
						return;
					}

					templateRepository.saveCustomTemplate(updatedTemplate);
					new Notice(`Template "${updatedTemplate.name}" saved`);

					// Reload templates and re-render
					this.templates = templateRepository.loadTemplates();
					this.renderContent();

					logger.info("Template updated", {
						templateId: updatedTemplate.id,
					});
				} catch (error) {
					logger.error("Failed to save template", {
						templateId: updatedTemplate.id,
						error,
					});
					new Notice("Failed to save template");
				}
			},
		});
	}

	private handleDelete(template: EventTemplate): void {
		if (template.isBuiltIn) {
			new Notice("Built-in templates cannot be deleted");
			return;
		}

		// Confirmation dialog
		const confirmed = confirm(
			`Delete template "${template.name}"?\n\nThis action cannot be undone.`
		);

		if (!confirmed) {
			return;
		}

		try {
			const deleted = templateRepository.deleteCustomTemplate(template.id);

			if (deleted) {
				new Notice(`Template "${template.name}" deleted`);

				// Reload templates and re-render
				this.templates = templateRepository.loadTemplates();
				this.renderContent();

				logger.info("Template deleted", {
					templateId: template.id,
				});
			} else {
				new Notice("Template not found");
			}
		} catch (error) {
			logger.error("Failed to delete template", {
				templateId: template.id,
				error,
			});
			new Notice("Failed to delete template");
		}
	}

	private handleCreate(): void {
		logger.info("Creating new template");

		// Create empty template
		const newTemplate: EventTemplate = {
			id: `template_custom_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
			name: "New Template",
			icon: "📝",
			description: "",
			isBuiltIn: false,
			useCount: 0,
		};

		openTemplateEditor(this.app, {
			template: newTemplate,
			onSave: (savedTemplate) => {
				try {
					templateRepository.saveCustomTemplate(savedTemplate);
					new Notice(`Template "${savedTemplate.name}" created`);

					// Reload templates and re-render
					this.templates = templateRepository.loadTemplates();
					this.renderContent();

					logger.info("Template created", {
						templateId: savedTemplate.id,
					});
				} catch (error) {
					logger.error("Failed to create template", {
						error,
					});
					new Notice("Failed to create template");
				}
			},
		});
	}

	onClose(): void {
		const { contentEl } = this;
		contentEl.removeClass("sm-template-manager");
		contentEl.empty();
	}
}

/**
 * Open Template Manager Modal
 *
 * @param app - Obsidian App instance
 * @param options - Modal options
 */
export function openTemplateManager(
	app: App,
	options: TemplateManagerModalOptions
): void {
	const modal = new TemplateManagerModal(app, options);
	modal.open();
}
