// src/workmodes/almanac/data/template-repository.ts
// Template repository for event template persistence (Phase 4)
//
// Provides:
// - localStorage-based template storage
// - CRUD operations for custom templates
// - Usage tracking (useCount, lastUsed)
// - Merge of built-in + custom templates

import { configurableLogger } from '@services/logging/configurable-logger';
const logger = configurableLogger.forModule('almanac-template-repository');
import { BUILT_IN_TEMPLATES } from "../helpers/event-templates";
import type { EventTemplate } from "../helpers/event-templates";

const STORAGE_KEY = "sm-almanac-templates";
const STORAGE_VERSION = "1.0";

/**
 * Template Storage Format
 *
 * Stored in localStorage as JSON.
 */
interface TemplateStorage {
	readonly version: string;
	readonly customTemplates: EventTemplate[];
	readonly builtInMetadata: Record<string, TemplateMetadata>; // Usage tracking for built-ins
}

/**
 * Template Metadata
 *
 * Tracks usage stats for built-in templates (stored separately from template data).
 */
interface TemplateMetadata {
	readonly isPinned?: boolean;
	readonly lastUsed?: number;
	readonly useCount?: number;
}

/**
 * Template Repository
 *
 * Manages event templates with localStorage persistence.
 * Merges built-in templates (from code) with custom templates (from storage).
 */
export class TemplateRepository {
	/**
	 * Load all templates (built-in + custom)
	 *
	 * Merges built-in templates with custom templates from localStorage.
	 * Built-in template metadata (isPinned, useCount) is loaded from storage.
	 *
	 * @returns All templates
	 */
	loadTemplates(): EventTemplate[] {
		try {
			const storage = this.loadStorage();

			// Load custom templates from storage
			const customTemplates = storage.customTemplates;

			// Load built-in templates with metadata from storage
			const builtInTemplates = BUILT_IN_TEMPLATES.map((template) => {
				const metadata = storage.builtInMetadata[template.id];
				if (!metadata) {
					return template;
				}

				// Merge metadata with template
				return {
					...template,
					isPinned: metadata.isPinned ?? template.isPinned,
					lastUsed: metadata.lastUsed ?? template.lastUsed,
					useCount: metadata.useCount ?? template.useCount,
				};
			});

			const allTemplates = [...builtInTemplates, ...customTemplates];

			logger.info("Loaded templates", {
				builtIn: builtInTemplates.length,
				custom: customTemplates.length,
				total: allTemplates.length,
			});

			return allTemplates;
		} catch (error) {
			logger.error("Failed to load templates", { error });
			// Fallback: return built-in templates only
			return [...BUILT_IN_TEMPLATES];
		}
	}

	/**
	 * Save custom template
	 *
	 * Adds or updates a custom template in localStorage.
	 * Built-in templates cannot be modified (only metadata).
	 *
	 * @param template - Template to save
	 */
	saveCustomTemplate(template: EventTemplate): void {
		try {
			if (template.isBuiltIn) {
				throw new Error("Cannot save built-in template as custom template");
			}

			const storage = this.loadStorage();

			// Find existing template by ID
			const existingIndex = storage.customTemplates.findIndex((t) => t.id === template.id);

			if (existingIndex >= 0) {
				// Update existing template
				storage.customTemplates[existingIndex] = template;
				logger.info("Updated custom template", {
					templateId: template.id,
					name: template.name,
				});
			} else {
				// Add new template
				storage.customTemplates.push(template);
				logger.info("Created custom template", {
					templateId: template.id,
					name: template.name,
				});
			}

			this.saveStorage(storage);
		} catch (error) {
			logger.error("Failed to save custom template", {
				templateId: template.id,
				error,
			});
			throw error;
		}
	}

	/**
	 * Delete custom template
	 *
	 * Removes a custom template from localStorage.
	 * Built-in templates cannot be deleted.
	 *
	 * @param templateId - ID of template to delete
	 * @returns True if deleted, false if not found
	 */
	deleteCustomTemplate(templateId: string): boolean {
		try {
			// Check if template is built-in
			const isBuiltIn = BUILT_IN_TEMPLATES.some((t) => t.id === templateId);
			if (isBuiltIn) {
				throw new Error("Cannot delete built-in template");
			}

			const storage = this.loadStorage();
			const originalLength = storage.customTemplates.length;

			storage.customTemplates = storage.customTemplates.filter((t) => t.id !== templateId);

			const deleted = storage.customTemplates.length < originalLength;

			if (deleted) {
				this.saveStorage(storage);
				logger.info("Deleted custom template", { templateId });
			} else {
				logger.warn("Template not found", { templateId });
			}

			return deleted;
		} catch (error) {
			logger.error("Failed to delete custom template", {
				templateId,
				error,
			});
			throw error;
		}
	}

	/**
	 * Update template metadata
	 *
	 * Updates metadata (isPinned, useCount, lastUsed) for any template.
	 * For built-in templates, stores metadata separately.
	 * For custom templates, updates the template object.
	 *
	 * @param templateId - Template ID
	 * @param metadata - Metadata to update
	 */
	updateTemplateMetadata(
		templateId: string,
		metadata: Partial<TemplateMetadata>
	): void {
		try {
			const storage = this.loadStorage();
			const isBuiltIn = BUILT_IN_TEMPLATES.some((t) => t.id === templateId);

			if (isBuiltIn) {
				// Update built-in template metadata
				const existing = storage.builtInMetadata[templateId] || {};
				storage.builtInMetadata[templateId] = {
					...existing,
					...metadata,
				};

				logger.info("Updated built-in template metadata", {
					templateId,
					metadata,
				});
			} else {
				// Update custom template object
				const templateIndex = storage.customTemplates.findIndex((t) => t.id === templateId);
				if (templateIndex >= 0) {
					storage.customTemplates[templateIndex] = {
						...storage.customTemplates[templateIndex],
						...metadata,
					};

					logger.info("Updated custom template metadata", {
						templateId,
						metadata,
					});
				} else {
					logger.warn("Template not found for metadata update", {
						templateId,
					});
					return;
				}
			}

			this.saveStorage(storage);
		} catch (error) {
			logger.error("Failed to update template metadata", {
				templateId,
				error,
			});
			throw error;
		}
	}

	/**
	 * Increment use count
	 *
	 * Increments useCount and updates lastUsed timestamp.
	 *
	 * @param templateId - Template ID
	 */
	incrementUseCount(templateId: string): void {
		try {
			const storage = this.loadStorage();
			const isBuiltIn = BUILT_IN_TEMPLATES.some((t) => t.id === templateId);

			const currentMetadata = isBuiltIn
				? storage.builtInMetadata[templateId] || {}
				: storage.customTemplates.find((t) => t.id === templateId) || {};

			const newUseCount = (currentMetadata.useCount ?? 0) + 1;
			const newLastUsed = Date.now();

			this.updateTemplateMetadata(templateId, {
				useCount: newUseCount,
				lastUsed: newLastUsed,
			});

			logger.info("Incremented use count", {
				templateId,
				useCount: newUseCount,
			});
		} catch (error) {
			logger.error("Failed to increment use count", {
				templateId,
				error,
			});
			// Don't throw - usage tracking failure shouldn't break template usage
		}
	}

	/**
	 * Toggle pin status
	 *
	 * Toggles the isPinned flag for a template.
	 *
	 * @param templateId - Template ID
	 * @returns New pin status
	 */
	togglePin(templateId: string): boolean {
		try {
			const templates = this.loadTemplates();
			const template = templates.find((t) => t.id === templateId);

			if (!template) {
				logger.warn("Template not found for pin toggle", {
					templateId,
				});
				return false;
			}

			const newPinStatus = !template.isPinned;

			this.updateTemplateMetadata(templateId, {
				isPinned: newPinStatus,
			});

			logger.info("Toggled pin status", {
				templateId,
				isPinned: newPinStatus,
			});

			return newPinStatus;
		} catch (error) {
			logger.error("Failed to toggle pin", { templateId, error });
			throw error;
		}
	}

	/**
	 * Get template by ID
	 *
	 * @param templateId - Template ID
	 * @returns Template or undefined
	 */
	getTemplateById(templateId: string): EventTemplate | undefined {
		const templates = this.loadTemplates();
		return templates.find((t) => t.id === templateId);
	}

	/**
	 * Clear all custom templates
	 *
	 * Removes all custom templates from storage.
	 * Built-in templates are not affected.
	 */
	clearCustomTemplates(): void {
		try {
			const storage = this.loadStorage();
			storage.customTemplates = [];
			this.saveStorage(storage);

			logger.info("Cleared all custom templates");
		} catch (error) {
			logger.error("Failed to clear custom templates", { error });
			throw error;
		}
	}

	/**
	 * Load storage from localStorage
	 *
	 * @returns Template storage object
	 */
	private loadStorage(): TemplateStorage {
		try {
			const raw = localStorage.getItem(STORAGE_KEY);

			if (!raw) {
				// No storage found - return empty storage
				return {
					version: STORAGE_VERSION,
					customTemplates: [],
					builtInMetadata: {},
				};
			}

			const parsed = JSON.parse(raw) as TemplateStorage;

			// Validate version (future: migration logic here)
			if (parsed.version !== STORAGE_VERSION) {
				logger.warn("Storage version mismatch", {
					expected: STORAGE_VERSION,
					actual: parsed.version,
				});
				// For now, use existing data anyway
			}

			return parsed;
		} catch (error) {
			logger.error("Failed to load storage", { error });
			// Return empty storage on error
			return {
				version: STORAGE_VERSION,
				customTemplates: [],
				builtInMetadata: {},
			};
		}
	}

	/**
	 * Save storage to localStorage
	 *
	 * @param storage - Template storage object
	 */
	private saveStorage(storage: TemplateStorage): void {
		try {
			const json = JSON.stringify(storage);
			localStorage.setItem(STORAGE_KEY, json);

			logger.info("Saved storage", {
				customTemplates: storage.customTemplates.length,
				builtInMetadata: Object.keys(storage.builtInMetadata).length,
			});
		} catch (error) {
			logger.error("Failed to save storage", { error });
			throw error;
		}
	}
}

/**
 * Singleton instance for convenient access
 */
export const templateRepository = new TemplateRepository();
