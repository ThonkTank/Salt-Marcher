// src/features/data-manager/edit/fields/field-rendering-core.ts
// Shared core rendering functions for field types
// Used by both registry-based renderers (with Setting) and direct rendering (without Setting)

import { Setting } from "obsidian";
import type { AnyFieldSpec, FieldRenderHandle, FieldRegistryEntry , TokenFieldDefinition } from "../../types";
import { configurableLogger } from '@services/logging/configurable-logger';

const logger = configurableLogger.forModule("data-manager-field-rendering");
import { calculateTextWidth } from "../width-utils";

/**
 * Core handle for field controls.
 * Provides minimal interface for updating and focusing fields.
 */
export interface CoreFieldHandle {
  focus?: () => void;
  update?: (value: unknown) => void;
  destroy?: () => void;
}

/**
 * Normalizes a value to string for text-based inputs
 */
function normalizeToString(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  return String(value);
}

/**
 * Normalizes a value to boolean
 */
function normalizeToBoolean(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (value === "true" || value === 1) return true;
  if (value === "false" || value === 0) return false;
  return Boolean(value);
}

// ============================================================================
// TEXT FIELD CORE
// ============================================================================

export interface TextFieldCoreOptions {
  container: HTMLElement;
  placeholder?: string;
  value?: unknown;
  className?: string;
  onChange: (value: string) => void;
}

/**
 * Core implementation for text input fields.
 * Creates and manages a text input element without Setting wrapper.
 */
export function renderTextCore(options: TextFieldCoreOptions): CoreFieldHandle {
  const { container, placeholder = "", value, className = "sm-cc-input", onChange } = options;

  // Debug logging for pb field (check placeholder for ÜB field)
  if (placeholder.includes('+2') || placeholder === 'z.B. +2') {
    logger.debug('[renderTextCore] Rendering field with placeholder:', placeholder);
    logger.debug('[renderTextCore] Raw value:', value);
    logger.debug('[renderTextCore] Value type:', typeof value);
  }

  const input = container.createEl("input", {
    cls: className,
    attr: {
      type: "text",
      placeholder,
    },
  }) as HTMLInputElement;

  const initialValue = normalizeToString(value);

  // Debug logging continued
  if (placeholder.includes('+2') || placeholder === 'z.B. +2') {
    logger.debug('[renderTextCore] Normalized value:', initialValue);
    logger.debug('[renderTextCore] Setting input.value to:', initialValue);
  }

  input.value = initialValue;

  input.addEventListener("input", () => {
    onChange(input.value);
  });

  return {
    focus: () => input.focus(),
    update: (newValue) => {
      const next = normalizeToString(newValue);
      if (input.value !== next) {
        input.value = next;
      }
    },
  };
}

// ============================================================================
// TEXTAREA FIELD CORE
// ============================================================================

export interface TextareaFieldCoreOptions {
  container: HTMLElement;
  placeholder?: string;
  value?: unknown;
  rows?: number;
  className?: string;
  onChange: (value: string) => void;
}

/**
 * Core implementation for textarea fields.
 * Creates and manages a textarea element without Setting wrapper.
 */
export function renderTextareaCore(options: TextareaFieldCoreOptions): CoreFieldHandle {
  const { container, placeholder = "", value, rows = 4, className = "sm-cc-textarea", onChange } = options;

  const textarea = container.createEl("textarea", {
    cls: className,
    attr: {
      rows: String(rows),
      placeholder,
    },
  }) as HTMLTextAreaElement;

  const initialValue = normalizeToString(value);
  textarea.value = initialValue;

  textarea.addEventListener("input", () => {
    onChange(textarea.value);
  });

  return {
    focus: () => textarea.focus(),
    update: (newValue) => {
      const next = normalizeToString(newValue);
      if (textarea.value !== next) {
        textarea.value = next;
      }
    },
  };
}

// ============================================================================
// CHECKBOX FIELD CORE
// ============================================================================

export interface CheckboxFieldCoreOptions {
  container: HTMLElement;
  value?: unknown;
  className?: string;
  onChange: (value: boolean) => void;
}

/**
 * Core implementation for checkbox fields.
 * Creates and manages a checkbox input element without Setting wrapper.
 */
export function renderCheckboxCore(options: CheckboxFieldCoreOptions): CoreFieldHandle {
  const { container, value, className = "sm-cc-checkbox", onChange } = options;

  const checkbox = container.createEl("input", {
    cls: className,
    attr: {
      type: "checkbox",
    },
  }) as HTMLInputElement;

  const initialValue = normalizeToBoolean(value);
  checkbox.checked = initialValue;

  checkbox.addEventListener("change", () => {
    onChange(checkbox.checked);
  });

  return {
    focus: () => checkbox.focus(),
    update: (newValue) => {
      const next = normalizeToBoolean(newValue);
      if (checkbox.checked !== next) {
        checkbox.checked = next;
      }
    },
  };
}

// ============================================================================
// COLOR FIELD CORE
// ============================================================================

export interface ColorFieldCoreOptions {
  container: HTMLElement;
  value?: unknown;
  className?: string;
  onChange: (value: string) => void;
}

/**
 * Core implementation for color picker fields.
 * Creates and manages a color input element without Setting wrapper.
 */
export function renderColorCore(options: ColorFieldCoreOptions): CoreFieldHandle {
  const { container, value, className = "sm-cc-color-input", onChange } = options;

  const input = container.createEl("input", {
    cls: className,
    attr: {
      type: "color",
    },
  }) as HTMLInputElement;

  // Validate and normalize color value (hex format)
  const normalizeColor = (val: unknown): string => {
    if (typeof val === "string" && /^#[0-9a-fA-F]{6}$/.test(val)) {
      return val;
    }
    return "#000000"; // Default black
  };

  const initialValue = normalizeColor(value);
  input.value = initialValue;

  input.addEventListener("input", () => {
    onChange(input.value);
  });

  input.addEventListener("change", () => {
    onChange(input.value);
  });

  return {
    focus: () => input.focus(),
    update: (newValue) => {
      const next = normalizeColor(newValue);
      if (input.value !== next) {
        input.value = next;
      }
    },
  };
}

// ============================================================================
// MULTISELECT FIELD CORE
// ============================================================================

export interface MultiselectOption {
  value: string;
  label: string;
}

export interface MultiselectFieldCoreOptions {
  container: HTMLElement;
  options: MultiselectOption[];
  value?: unknown;
  className?: string;
  onChange: (value: string[]) => void;
}

/**
 * Core implementation for multiselect checkbox fields.
 * Creates and manages a list of checkboxes without Setting wrapper.
 */
export function renderMultiselectCore(options: MultiselectFieldCoreOptions): CoreFieldHandle {
  const { container, options: fieldOptions, value, className = "sm-cc-multiselect", onChange } = options;

  const selected = new Set<string>(Array.isArray(value) ? (value as string[]) : []);
  const multiContainer = container.createDiv({ cls: className });
  const checkboxes: HTMLInputElement[] = [];

  for (const option of fieldOptions) {
    const item = multiContainer.createDiv({ cls: "sm-cc-multiselect-item" });
    const checkbox = item.createEl("input", { attr: { type: "checkbox" } }) as HTMLInputElement;
    checkbox.value = option.value;
    checkbox.checked = selected.has(option.value);

    const label = item.createEl("label");
    label.textContent = option.label;

    checkbox.addEventListener("change", () => {
      if (checkbox.checked) {
        selected.add(option.value);
      } else {
        selected.delete(option.value);
      }
      onChange(Array.from(selected));
    });

    checkboxes.push(checkbox);
  }

  return {
    update: (newValue) => {
      selected.clear();
      if (Array.isArray(newValue)) {
        for (const entry of newValue) {
          if (typeof entry === "string") {
            selected.add(entry);
          }
        }
      }
      checkboxes.forEach((cb) => {
        cb.checked = selected.has(cb.value);
      });
    },
  };
}

// ============================================================================
// DISPLAY FIELD CORE
// ============================================================================

export interface DisplayFieldCoreOptions {
  container: HTMLElement;
  config: {
    compute: (data: Record<string, unknown>) => string | number;
    prefix?: string | ((data: Record<string, unknown>) => string);
    suffix?: string | ((data: Record<string, unknown>) => string);
    className?: string;
    maxWidth?: string;
    maxTokens?: number; // Expected character count for width calculation
  };
  fieldId?: string; // For error logging
}

/**
 * Core implementation for display (computed/read-only) fields.
 * Creates a disabled input that displays computed values based on form data.
 */
export function renderDisplayCore(options: DisplayFieldCoreOptions) {
  const { container, config, fieldId = "unknown" } = options;

  const displayEl = container.createEl("input", {
    cls: "sm-cc-display-field",
    attr: {
      type: "text",
      disabled: "true",
      readonly: "true",
    },
  }) as HTMLInputElement;

  if (config.className) {
    displayEl.addClass(config.className);
  }

  if (config.maxWidth) {
    displayEl.style.maxWidth = config.maxWidth;
  }

  // Calculate width based on maxTokens if specified
  if (config.maxTokens && config.maxTokens > 0) {
    // Wait for element to be in DOM with font styles applied
    setTimeout(() => {
      // Generate sample text ("M" is typically widest character)
      const sampleText = "M".repeat(config.maxTokens);

      // Calculate width including padding and border
      const width = calculateTextWidth(sampleText, displayEl, {
        includePadding: true,
        includeBorder: true,
        extraSpace: 4, // Small buffer
      });

      displayEl.style.width = `${width}px`;
    }, 0);
  }

  return {
    update: (value: unknown, all?: Record<string, unknown>) => {
      try {
        const computed = config.compute(all ?? {});
        const prefixVal = typeof config.prefix === "function"
          ? config.prefix(all ?? {})
          : (config.prefix ?? "");
        const suffixVal = typeof config.suffix === "function"
          ? config.suffix(all ?? {})
          : (config.suffix ?? "");
        displayEl.value = `${prefixVal}${computed}${suffixVal}`;
      } catch (error) {
        logger.warn(`Display field ${fieldId} compute error:`, error);
        displayEl.value = "";
      }
    },
  };
}

// ============================================================================
// HEADING FIELD CORE
// ============================================================================

export interface HeadingFieldCoreOptions {
  container: HTMLElement;
  getValue?: (data: Record<string, unknown>) => string;
  values: Record<string, unknown>;
}

/**
 * Core implementation for heading fields.
 * Creates a strong element with static text (no updates).
 */
export function renderHeadingCore(options: HeadingFieldCoreOptions): CoreFieldHandle {
  const { container, getValue, values } = options;

  const value = getValue
    ? getValue(values)
    : String(values ?? "");

  container.createEl("strong", {
    cls: "sm-cc-field-heading",
    text: value
  });

  return {}; // No update/focus needed for headings
}

// ============================================================================
// COMPOSITE FIELD CORE
// ============================================================================

// Type imports for external dependencies
export type EntryCategoryDefinition<T> = any;
export type EntryFilterDefinition<Entry, Category> = any;
export type EntryManagerHandle = {
  rerender: () => void;
};

export interface CompositeFieldCoreOptions {
  container: HTMLElement;
  childFields: Array<Partial<AnyFieldSpec>>;
  groupBy?: string[];
  initialValue: Record<string, unknown>;
  onChange: (value: Record<string, unknown>) => void;
  renderFieldControl: (
    container: HTMLElement,
    spec: AnyFieldSpec,
    initial: unknown,
    onChange: (value: unknown) => void
  ) => FieldRenderHandle;
}

/**
 * Core implementation for composite fields (nested fields with visibility and grouping).
 * Handles child field rendering, visibility evaluation, auto-initialization, and grouping.
 */
export function renderCompositeCore(options: CompositeFieldCoreOptions) {
  const {
    container,
    childFields,
    groupBy,
    initialValue: compositeValue,
    onChange,
    renderFieldControl,
  } = options;

  const useGrouping = Boolean(groupBy && groupBy.length > 0);

  const compositeContainer = container.createDiv({
    cls: useGrouping ? "sm-cc-composite-grouped" : "sm-cc-composite-grid"
  });

  // Track child field instances with visibility and initialization state
  interface ChildFieldInstance {
    id: string;
    spec: AnyFieldSpec;
    handle: FieldRenderHandle;
    wrapper: HTMLElement;
    wasVisible: boolean;
    initialized: boolean;
  }
  const childInstances: ChildFieldInstance[] = [];

  // Helper to evaluate visibility for a child field
  const evaluateChildVisibility = (childSpec: AnyFieldSpec): boolean => {
    if (!childSpec.visibleIf) return true;
    try {
      return childSpec.visibleIf(compositeValue);
    } catch (error) {
      logger.error(`Failed to evaluate visibility for ${childSpec.id}:`, error);
      return true;
    }
  };

  // Helper to update child field visibility
  const updateChildVisibility = () => {
    for (const child of childInstances) {
      const shouldBeVisible = evaluateChildVisibility(child.spec);

      if (shouldBeVisible !== child.wasVisible) {
        child.wrapper.toggleClass("is-hidden", !shouldBeVisible);
        child.wasVisible = shouldBeVisible;

        // Auto-initialize fields when they become visible for the first time
        if (shouldBeVisible && !child.initialized) {
          child.initialized = true;
          // If field has an init config, use it to set initial value
          const initConfig = (child.spec.config as any)?.init;
          if (initConfig && typeof initConfig === "function") {
            try {
              const initValue = initConfig(compositeValue);
              compositeValue[child.id] = initValue;
              child.handle.update?.(initValue, compositeValue);
              onChange(compositeValue);
            } catch (error) {
              logger.error(`Failed to initialize ${child.id}:`, error);
            }
          }
        }
      }
    }
  };

  // Determine fields to render (with or without grouping)
  const fieldsToRender = useGrouping && groupBy
    ? groupBy.flatMap(prefix =>
        childFields.filter(f => f.id === prefix || f.id?.startsWith(`${prefix}`))
      )
    : childFields;

  // Render each child field
  for (const childDef of fieldsToRender) {
    const childId = childDef.id ?? "";
    const childSpec: AnyFieldSpec = {
      id: childId,
      label: childDef.label ?? childId,
      type: childDef.type ?? "text",
      ...childDef,
    };

    // Create wrapper for this child control
    const childWrapper = compositeContainer.createDiv({ cls: "sm-cc-composite-item" });

    // Get initial value for this child
    const childInitial = compositeValue[childId] ?? childSpec.default;

    const childHandle = renderFieldControl(
      childWrapper,
      childSpec,
      childInitial,
      (childValue) => {
        // Update nested value in parent
        const oldValue = compositeValue[childId];
        compositeValue[childId] = childValue;
        onChange(compositeValue);

        // Update visibility when values change (only if value actually changed)
        if (oldValue !== childValue) {
          updateChildVisibility();
        }
      }
    );

    // Check initial visibility
    const initiallyVisible = evaluateChildVisibility(childSpec);
    childWrapper.toggleClass("is-hidden", !initiallyVisible);

    childInstances.push({
      id: childId,
      spec: childSpec,
      handle: childHandle,
      wrapper: childWrapper,
      wasVisible: initiallyVisible,
      initialized: initiallyVisible, // Mark as initialized if initially visible
    });
  }

  return {
    update: (value: unknown) => {
      if (typeof value === "object" && value !== null) {
        // Update all child fields
        const valueMap = value as Record<string, unknown>;
        for (const child of childInstances) {
          child.handle.update?.(valueMap[child.id], valueMap);
        }
        // Update visibility after updating values
        updateChildVisibility();
      }
    },
  };
}

// ============================================================================
// REPEATING FIELD ENTRY-MANAGER CORE
// ============================================================================

export interface RepeatingEntryManagerCoreOptions {
  container: HTMLElement;
  entries: Record<string, unknown>[];
  categories: EntryCategoryDefinition<string>[];
  filters?: EntryFilterDefinition<Record<string, unknown>, string>[];
  itemTemplate: Record<string, any>;
  renderEntry?: (container: HTMLElement, context: any) => HTMLElement;
  card?: (context: any) => any;
  onChange: (entries: Record<string, unknown>[]) => void;
  insertPosition?: "start" | "end";
  isStatic?: boolean;
  mountEntryManager: (container: HTMLElement, options: any) => EntryManagerHandle;
  fieldId?: string; // For error logging
}

/**
 * Core implementation for repeating field entry-manager mode.
 * Handles entry management with categories, filters, and custom rendering.
 */
export function renderRepeatingEntryManagerCore(options: RepeatingEntryManagerCoreOptions) {
  const {
    container,
    entries,
    categories,
    filters,
    itemTemplate,
    renderEntry,
    card,
    onChange,
    insertPosition = "end",
    isStatic = false,
    mountEntryManager,
    fieldId = "unknown",
  } = options;

  // Validate required config
  if (!categories.length) {
    logger.warn(`Repeating field "${fieldId}" has no categories defined`);
    const errorContainer = container.createDiv({ cls: "sm-cc-field--error" });
    errorContainer.createEl("p", { text: "No categories defined for repeating field" });
    return { error: true };
  }

  if (!renderEntry && !card) {
    logger.warn(`Repeating field "${fieldId}" requires renderEntry or card in config`);
    const errorContainer = container.createDiv({ cls: "sm-cc-field--error" });
    errorContainer.createEl("p", { text: "No renderer defined for repeating field" });
    return { error: true };
  }

  // Create entry factory from itemTemplate
  const createEntry = (category: string): Record<string, unknown> => {
    const entry: Record<string, unknown> = { category };
    for (const [key, fieldDef] of Object.entries(itemTemplate)) {
      if (fieldDef.default !== undefined) {
        entry[key] = fieldDef.default;
      }
    }
    return entry;
  };

  const handle = mountEntryManager(container, {
    label: "",
    entries,
    categories,
    filters,
    createEntry,
    renderEntry,
    card,
    onEntriesChanged: (updated) => {
      onChange(updated);
    },
    insertPosition,
    hideAddBar: isStatic,
    hideActions: isStatic,
  });

  return {
    update: (value: unknown) => {
      if (Array.isArray(value)) {
        entries.splice(0, entries.length, ...value as Record<string, unknown>[]);
        handle.rerender();
      }
    },
  };
}

// ============================================================================
// TOKEN FIELD CORE
// ============================================================================

// Import modular token system
import {
  renderModularTokenFieldCore,
  type ModularTokenFieldOptions,
} from "./token-field-core-new";

/**
 * Modular token field options
 */
export interface ModularTokenFieldCoreOptions {
  container: HTMLElement;
  fields: TokenFieldDefinition[];
  primaryField: string;
  value?: Array<Record<string, unknown>>;
  chipTemplate?: (token: Record<string, unknown>) => string;
  className?: string;
  onChange: (value: Array<Record<string, unknown>>) => void;
}

export interface TokenFieldCoreHandle extends CoreFieldHandle {
  chipsContainer: HTMLElement;
}

/**
 * Core implementation for modular token/chip fields.
 * Supports flexible token structures with inline-editable segments.
 *
 * Grid-compatible layout: Input/button and chips container are returned separately
 * so caller can position them correctly for CSS Grid.
 */
export function renderTokenFieldCore(
  options: ModularTokenFieldCoreOptions
): TokenFieldCoreHandle {
  return renderModularTokenFieldCore(options as ModularTokenFieldOptions) as TokenFieldCoreHandle;
}

// ============================================================================
// RENDERER WRAPPER FACTORY
// ============================================================================

/**
 * Creates a field renderer with standard Setting wrapper and validation.
 * Eliminates boilerplate code from individual renderer implementations.
 * 
 * @param type - The field type this renderer supports (e.g., "text", "color")
 * @param coreRenderer - The core rendering function that creates the actual control
 * @param options - Optional configuration for the wrapper
 * @returns A complete FieldRegistryEntry with Setting wrapper
 */
export function createRendererWrapper<THandle = CoreFieldHandle>(
  type: string,
  coreRenderer: (options: {
    container: HTMLElement;
    spec: AnyFieldSpec;
    initial: unknown;
    onChange: (value: unknown) => void;
  }) => THandle,
  options?: {
    /** Import createValidationControls dynamically to avoid circular deps */
    createValidationControls?: (setting: any) => { apply: (errors: string[]) => void };
    /** Import resolveInitialValue dynamically to avoid circular deps */
    resolveInitialValue?: (spec: AnyFieldSpec, values: Record<string, unknown>) => unknown;
  }
): FieldRegistryEntry {
  return {
    supports: (spec) => spec.type === type,
    render: (args) => {
      const { container, spec, values, onChange } = args;

      // Create Setting wrapper with label and description
      const setting = new Setting(container);
      if (spec.label) {
        setting.setName(spec.label);
      }
      setting.settingEl.addClass("sm-cc-setting");
      if (spec.help) {
        setting.setDesc(spec.help);
      }

      // Create validation controls (if available)
      const validation = options?.createValidationControls?.(setting) ?? { apply: () => {} };

      // Resolve initial value (if available)
      const initial = options?.resolveInitialValue?.(spec, values) ?? values[spec.id];

      // Render the actual control using the core function
      const handle = coreRenderer({
        container: setting.controlEl,
        spec,
        initial,
        onChange: (value) => onChange(spec.id, value),
      });

      return {
        ...handle,
        setErrors: validation.apply,
        container: setting.settingEl,
      };
    },
  };
}
