// src/features/data-manager/data-initializer.ts
// Service for initializing draft data from spec, presets, and options

import { configurableLogger } from '@services/logging/configurable-logger';

const logger = configurableLogger.forModule("data-manager-data-initializer");
import { deepClone, resolveDefaults } from "./modal-utils";
import type { CreateSpec } from "../types";

/**
 * Named draft interface (minimal requirement for data initialization)
 */
export interface NamedDraft extends Record<string, unknown> {
  name: string;
}

/**
 * Options for data initializer
 */
export interface DataInitializerOptions<TDraft extends NamedDraft> {
  spec: CreateSpec<TDraft, any>;
  preset?: string | TDraft;
  customInitializer?: (draft: TDraft) => TDraft | Record<string, unknown>;
}

/**
 * Service responsible for initializing draft data with proper precedence:
 * 1. Base defaults from spec.defaults
 * 2. Field defaults from field specs
 * 3. Preset data (if provided)
 * 4. Custom initializer (if provided)
 */
export class DataInitializer<TDraft extends NamedDraft> {
  constructor(private options: DataInitializerOptions<TDraft>) {}

  /**
   * Initialize draft data with all sources merged in correct order.
   */
  initialize(): TDraft {
    const name = this.resolveName();
    const base = this.createBase(name);
    const withDefaults = this.applyDefaults(base, name);
    const withPreset = this.applyPreset(withDefaults);
    const final = this.applyCustomInitializer(withPreset);
    return final;
  }

  /**
   * Resolve the name from preset or generate default name.
   */
  private resolveName(): string {
    const { preset } = this.options;
    const defaultName = this.resolveDefaultName();

    if (typeof preset === "string") {
      return preset;
    }

    if (typeof preset === "object" && preset && "name" in preset) {
      const nameValue = (preset as Record<string, unknown>).name;
      return typeof nameValue === "string" && nameValue.trim()
        ? nameValue
        : defaultName;
    }

    return defaultName;
  }

  /**
   * Create base draft with name and filename.
   */
  private createBase(name: string): TDraft {
    const draft: Record<string, unknown> = { name };

    // Ensure filename field is initialized
    const filenameField = this.options.spec.storage.filenameFrom;
    if (draft[filenameField] === undefined) {
      draft[filenameField] = name;
    }

    return draft as TDraft;
  }

  /**
   * Apply defaults from spec.defaults and field defaults.
   */
  private applyDefaults(base: TDraft, name: string): TDraft {
    const { spec } = this.options;

    // Get defaults from spec (can be object or function)
    const specDefaults = resolveDefaults(spec, name);

    // Merge base with spec defaults
    let result: TDraft = { ...base, ...specDefaults };

    // Apply field defaults
    for (const field of spec.fields) {
      if (result[field.id] !== undefined) {
        // Field already has value from spec defaults
        continue;
      }
      if (field.default !== undefined) {
        result[field.id] = field.default;
      }
    }

    // Ensure filename field is still set
    const filenameField = spec.storage.filenameFrom;
    if (result[filenameField] === undefined) {
      result[filenameField] = result.name;
    }

    return result;
  }

  /**
   * Apply preset data (if preset is an object).
   */
  private applyPreset(data: TDraft): TDraft {
    const { preset } = this.options;

    if (preset && typeof preset === "object") {
      // Debug logging for pb and initiative
      if ('pb' in preset || 'initiative' in preset) {
        logger.info('Preset contains numeric fields', {
          pb: (preset as any).pb,
          initiative: (preset as any).initiative
        });
      }
      // Debug logging for token fields
      if ('passivesList' in preset) {
        logger.info('Preset passivesList', { passivesList: (preset as any).passivesList });
      }
      if ('languagesList' in preset) {
        logger.info('Preset languagesList', { languagesList: (preset as any).languagesList });
      }
      if ('sensesList' in preset) {
        logger.info('Preset sensesList', { sensesList: (preset as any).sensesList });
      }
      return { ...data, ...(preset as Partial<TDraft>) };
    }

    return data;
  }

  /**
   * Apply custom initializer function (if provided).
   */
  private applyCustomInitializer(data: TDraft): TDraft {
    const { customInitializer } = this.options;

    if (!customInitializer) {
      return data;
    }

    const adjusted = customInitializer(deepClone(data));

    if (adjusted && typeof adjusted === "object") {
      return { ...data, ...(adjusted as Partial<TDraft>) };
    }

    return data;
  }

  /**
   * Resolve default name from name field default or spec.kind.
   */
  private resolveDefaultName(): string {
    const { spec } = this.options;

    // Try to get default from name field
    const nameField = spec.fields.find((field) => field.id === "name");
    if (nameField && typeof nameField.default === "string" && nameField.default.trim()) {
      return nameField.default;
    }

    // Generate from kind
    const kind = spec.kind || "Eintrag";
    const normalized = kind.charAt(0).toUpperCase() + kind.slice(1);
    return `Neue/r ${normalized}`;
  }
}
