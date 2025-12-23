/**
 * Encounter Template Loader - Load and validate encounter templates.
 *
 * Loads generic encounter templates from bundled presets and provides
 * a registry interface for lookup and tag-based filtering.
 *
 * Templates define composition patterns like "leader + minions" or "pack"
 * that are matched against faction/creature tags during encounter generation.
 *
 * @see docs/features/Encounter-System.md#encounter-templates
 */

import {
  encounterTemplateSchema,
  type EncounterTemplate,
} from '@core/schemas';

// Import bundled templates at build time (esbuild handles JSON import)
import bundledTemplates from '../../../presets/encounter-templates/bundled-templates.json';

// ============================================================================
// Template Loading
// ============================================================================

/**
 * Load and validate encounter templates from bundled presets.
 * Invalid templates are logged and skipped.
 */
function loadBundledTemplates(): EncounterTemplate[] {
  return bundledTemplates.templates
    .map((rawTemplate) => {
      const result = encounterTemplateSchema.safeParse(rawTemplate);

      if (!result.success) {
        console.warn(
          `[TemplateLoader] Invalid bundled template: ${(rawTemplate as { id?: string }).id ?? 'unknown'}`,
          result.error.format()
        );
        return null;
      }

      return result.data;
    })
    .filter((t): t is EncounterTemplate => t !== null);
}

// ============================================================================
// Template Registry Interface
// ============================================================================

/**
 * Registry for accessing encounter templates.
 */
export interface EncounterTemplateRegistry {
  /**
   * Get a template by ID.
   * @param id - Template ID (e.g., "leader-minions")
   * @returns The template or undefined if not found
   */
  get(id: string): EncounterTemplate | undefined;

  /**
   * Get all available templates.
   * @returns Array of all loaded templates
   */
  getAll(): EncounterTemplate[];

  /**
   * Find templates that match any of the given tags.
   * Used to select templates based on faction/creature tags.
   *
   * @param tags - Tags to match against (e.g., ["organized", "tribal"])
   * @returns Templates where at least one compatibleTag matches
   */
  findByTags(tags: string[]): EncounterTemplate[];

  /**
   * Find templates that match ALL of the given tags.
   * Stricter matching for specific compositions.
   *
   * @param tags - Tags that must all be present
   * @returns Templates where all tags are in compatibleTags
   */
  findByAllTags(tags: string[]): EncounterTemplate[];
}

// ============================================================================
// Template Registry Factory
// ============================================================================

/**
 * Create an encounter template registry.
 * Loads bundled templates and optionally merges additional templates.
 *
 * @param additionalTemplates - Optional custom templates to merge (can override bundled)
 * @returns EncounterTemplateRegistry instance
 */
export function createEncounterTemplateRegistry(
  additionalTemplates: EncounterTemplate[] = []
): EncounterTemplateRegistry {
  // Build lookup map
  const templateMap = new Map<string, EncounterTemplate>();

  // Load bundled templates
  const bundled = loadBundledTemplates();
  for (const template of bundled) {
    templateMap.set(template.id, template);
  }

  // Add additional templates (can override bundled)
  for (const template of additionalTemplates) {
    templateMap.set(template.id, template);
  }

  return {
    get(id: string): EncounterTemplate | undefined {
      return templateMap.get(id);
    },

    getAll(): EncounterTemplate[] {
      return Array.from(templateMap.values());
    },

    findByTags(tags: string[]): EncounterTemplate[] {
      if (tags.length === 0) return [];

      return Array.from(templateMap.values()).filter((template) =>
        template.compatibleTags.some((tag) => tags.includes(tag))
      );
    },

    findByAllTags(tags: string[]): EncounterTemplate[] {
      if (tags.length === 0) return [];

      return Array.from(templateMap.values()).filter((template) =>
        tags.every((tag) => template.compatibleTags.includes(tag))
      );
    },
  };
}

// ============================================================================
// Singleton Instance (optional convenience)
// ============================================================================

let defaultRegistry: EncounterTemplateRegistry | null = null;

/**
 * Get the default template registry (singleton).
 * Creates one on first call, reuses on subsequent calls.
 */
export function getDefaultTemplateRegistry(): EncounterTemplateRegistry {
  if (!defaultRegistry) {
    defaultRegistry = createEncounterTemplateRegistry();
  }
  return defaultRegistry;
}

/**
 * Reset the default registry (for testing).
 */
export function resetDefaultTemplateRegistry(): void {
  defaultRegistry = null;
}
