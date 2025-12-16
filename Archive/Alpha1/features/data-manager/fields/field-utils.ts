// src/features/data-manager/field-utils.ts
// Field-level utility functions for create modal

import { debugLogger } from "@services/logging/debug-logger";
import { configurableLogger } from '@services/logging/configurable-logger';

const logger = configurableLogger.forModule("data-manager-field-utils");
import { RepeatingWidthSynchronizer } from "../layout/repeating-width-sync";
import { mountEntryManager, type EntryCategoryDefinition, type EntryFilterDefinition } from "../storage/entry-system";
import { createClickableIcon } from "./clickable-icon";
import { fieldRendererRegistry } from "./field-renderer-registry";
import { renderTextCore, renderTextareaCore, renderCheckboxCore, renderColorCore, renderMultiselectCore, renderDisplayCore, renderHeadingCore, renderCompositeCore, renderRepeatingEntryManagerCore } from "./field-rendering-core";
import { createNumberStepper } from "./number-stepper-control";
import { enhanceSelectToSearch } from "./select-enhancement";
import type { AnyFieldSpec, FieldRenderHandle, CompositeFieldSpec } from "../../types";

/**
 * Resolves the initial value for a field from values or default.
 */
export function resolveInitialValue(spec: AnyFieldSpec, values: Record<string, unknown>) {
  // Debug logging for pb field
  if (spec.id === 'pb') {
    logger.debug('[resolveInitialValue] Resolving pb field');
    logger.debug('[resolveInitialValue] values object:', values);
    logger.debug('[resolveInitialValue] values["pb"]:', values['pb']);
    logger.debug('[resolveInitialValue] spec.default:', spec.default);
  }

  if (values[spec.id] !== undefined) {
    if (spec.id === 'pb') {
      logger.debug('[resolveInitialValue] Returning from values:', values[spec.id]);
    }
    return values[spec.id];
  }
  if (spec.default !== undefined) {
    if (spec.id === 'pb') {
      logger.debug('[resolveInitialValue] Returning default:', spec.default);
    }
    return spec.default;
  }
  if (spec.id === 'pb') {
    logger.debug('[resolveInitialValue] Returning undefined');
  }
  return undefined;
}

/**
 * Renders just the input control without a Setting wrapper.
 * Used for composite field children and repeating field entries to avoid nested Settings.
 * Supports all field types that the registry supports.
 */
export function renderFieldControl(
  container: HTMLElement,
  spec: AnyFieldSpec,
  initial: unknown,
  onChange: (value: unknown) => void,
  formData?: Record<string, unknown>
): FieldRenderHandle {
  debugLogger.logField(spec.id, "field-creation", "renderFieldControl called", {
    type: spec.type,
    onChangeType: typeof onChange
  });

  // Add label for simple types (complex types like tokens render their own Settings with labels)
  const simpleTypes = ["text", "textarea", "markdown", "number-stepper", "checkbox", "select", "multiselect", "color", "display"];
  const shouldAddLabel = simpleTypes.includes(spec.type);

  if (shouldAddLabel && spec.label) {
    const label = container.createEl("label", {
      cls: "sm-cc-field-label",
      text: spec.label
    });
  }

  const controlContainer = container.createDiv({ cls: "sm-cc-field-control" });

  // ═══════════════════════════════════════════════
  // SIMPLE FIELD TYPES
  // ═══════════════════════════════════════════════

  // Text field
  if (spec.type === "text") {
    return renderTextCore({
      container: controlContainer,
      placeholder: spec.placeholder,
      value: initial,
      onChange,
    });
  }

  // Textarea / Markdown field
  if (spec.type === "textarea" || spec.type === "markdown") {
    const rows = spec.type === "markdown" ? 12 : 4;
    return renderTextareaCore({
      container: controlContainer,
      placeholder: spec.placeholder,
      value: initial,
      rows,
      onChange,
    });
  }

  // Number stepper
  if (spec.type === "number-stepper") {
    const numberStepperSpec = spec as import("../types").NumberStepperFieldSpec;
    const handle = createNumberStepper(controlContainer, {
      value: typeof initial === "number" ? initial : undefined,
      min: spec.min,
      max: spec.max,
      step: spec.step,
      autoSizeOnInput: numberStepperSpec.autoSizeOnInput,
      onChange: (value) => {
        onChange(value);
      },
    });
    return {
      focus: () => handle.input.focus(),
      update: (value) => {
        if (typeof value === "number") {
          handle.setValue(value);
        } else {
          handle.setValue(undefined);
        }
      },
    };
  }

  // Checkbox field
  if (spec.type === "checkbox") {
    const checkboxContainer = controlContainer.createDiv({ cls: "checkbox-container" });
    return renderCheckboxCore({
      container: checkboxContainer,
      value: initial,
      onChange,
    });
  }

  // Clickable icon field (e.g., star for expertise/proficiency)
  if (spec.type === "clickable-icon") {
    const iconSpec = spec as import("../types").ClickableIconFieldSpec;
    debugLogger.logField(spec.id, "field-creation", "Creating clickable-icon", { initial });
    const handle = createClickableIcon({
      container: controlContainer,
      value: Boolean(initial),
      icon: iconSpec.icon || "★",
      inactiveIcon: iconSpec.inactiveIcon || "☆",
      fieldId: spec.id,
      onChange: (value) => {
        debugLogger.logField(spec.id, "onChange-wrapper", "clickable-icon onChange wrapper called", {
          value,
          onChangeType: typeof onChange,
          onChangeDefined: onChange !== undefined
        });
        if (typeof onChange === 'function') {
          debugLogger.logField(spec.id, "onChange-wrapper", "Calling parent onChange");
          onChange(value);
          debugLogger.logField(spec.id, "onChange-wrapper", "Parent onChange returned successfully");
        } else {
          logger.error(`onChange is not a function for "${spec.id}"! Type: ${typeof onChange}`);
        }
      },
    });
    return {
      focus: () => handle.element.focus(),
      update: (value: unknown) => {
        debugLogger.logField(spec.id, "update", "clickable-icon update() called", { value });
        handle.update(Boolean(value));
      },
    };
  }

  // Select field
  if (spec.type === "select") {
    const selectSpec = spec as import("../types").SelectFieldSpec;
    const select = controlContainer.createEl("select", {
      cls: "dropdown"
    }) as HTMLSelectElement;

    const options = selectSpec.options ?? [];
    for (const opt of options) {
      const optionEl = select.createEl("option", {
        value: opt.value,
        text: opt.label
      });
    }

    const value = initial != null ? String(initial) : (options[0]?.value ?? "");
    select.value = value;
    select.addEventListener("change", () => {
      onChange(select.value);
    });

    // Enhance with search if many options
    if (options.length > 10) {
      enhanceSelectToSearch(select);
    }

    return {
      focus: () => select.focus(),
      update: (value) => {
        select.value = value != null ? String(value) : "";
      },
    };
  }

  // Multiselect field
  if (spec.type === "multiselect") {
    const multiselectSpec = spec as import("../types").MultiselectFieldSpec;
    const options = multiselectSpec.options ?? [];
    return renderMultiselectCore({
      container: controlContainer,
      options,
      value: initial,
      onChange,
    });
  }

  // Color field
  if (spec.type === "color") {
    return renderColorCore({
      container: controlContainer,
      value: initial,
      onChange,
    });
  }

  // ═══════════════════════════════════════════════
  // SPECIAL FIELD TYPES
  // ═══════════════════════════════════════════════

  // Display field (computed/read-only)
  if (spec.type === "display") {
    const displaySpec = spec as import("../types").DisplayFieldSpec;
    return renderDisplayCore({
      container: controlContainer,
      config: displaySpec.config,
      fieldId: spec.id,
    });
  }

  // Heading type (for entry labels in repeating fields)
  if (spec.type === "heading") {
    const headingSpec = spec as import("../types").HeadingFieldSpec;
    return renderHeadingCore({
      container: container,
      getValue: headingSpec.getValue,
      values: initial as Record<string, unknown>,
    });
  }

  // ═══════════════════════════════════════════════
  // COMPLEX FIELD TYPES
  // ═══════════════════════════════════════════════

  // Composite field (nested fields)
  if (spec.type === "composite") {
    const compositeSpec = spec as CompositeFieldSpec;
    const config = compositeSpec.config ?? {};
    const childFields = (config.fields as Array<Partial<import("../types").FieldSpec>>) ?? compositeSpec.children ?? [];
    const groupBy = (config as any).groupBy as string[] | undefined;
    const compositeValue = (initial as Record<string, unknown>) ?? {};

    // Use core rendering function
    return renderCompositeCore({
      container: controlContainer,
      childFields,
      groupBy,
      initialValue: compositeValue,
      onChange,
      renderFieldControl,
    });
  }

  // Autocomplete field (async search with suggestions)
  if (spec.type === "autocomplete") {
    const autocompleteSpec = spec as import("../types").AutocompleteFieldSpec;
    const { load, renderSuggestion, onSelect, minQueryLength = 2 } = autocompleteSpec.config;

    const input = controlContainer.createEl("input", {
      cls: "sm-cc-input sm-cc-autocomplete-input",
      attr: { type: "text", placeholder: spec.placeholder ?? "Search..." },
    }) as HTMLInputElement;

    let suggestionsContainer: HTMLElement | null = null;
    let selectedIndex = -1;

    const hideSuggestions = () => {
      suggestionsContainer?.remove();
      suggestionsContainer = null;
      selectedIndex = -1;
    };

    const showSuggestions = async (query: string) => {
      if (query.length < minQueryLength) {
        hideSuggestions();
        return;
      }

      const items = await Promise.resolve(load(query));
      if (items.length === 0) {
        hideSuggestions();
        return;
      }

      if (!suggestionsContainer) {
        suggestionsContainer = controlContainer.createDiv({ cls: "sm-cc-autocomplete-suggestions" });
      }
      suggestionsContainer.empty();
      selectedIndex = -1;

      items.forEach((item, index) => {
        const suggestionEl = suggestionsContainer!.createDiv({ cls: "sm-cc-autocomplete-suggestion" });
        suggestionEl.innerHTML = renderSuggestion(item);
        suggestionEl.addEventListener("click", () => {
          const values = initial as Record<string, unknown> ?? {};
          onSelect(item, values);
          input.value = "";
          hideSuggestions();
        });
        suggestionEl.addEventListener("mouseenter", () => {
          selectedIndex = index;
          updateSelection();
        });
      });

      updateSelection();
    };

    const updateSelection = () => {
      if (!suggestionsContainer) return;
      const suggestions = suggestionsContainer.querySelectorAll(".sm-cc-autocomplete-suggestion");
      suggestions.forEach((el, index) => {
        el.classList.toggle("is-selected", index === selectedIndex);
      });
    };

    const selectCurrent = () => {
      if (!suggestionsContainer || selectedIndex < 0) return;
      const suggestions = suggestionsContainer.querySelectorAll<HTMLElement>(".sm-cc-autocomplete-suggestion");
      suggestions[selectedIndex]?.click();
    };

    input.addEventListener("input", () => void showSuggestions(input.value));
    input.addEventListener("blur", () => setTimeout(hideSuggestions, 200));
    input.addEventListener("keydown", (e) => {
      if (!suggestionsContainer) return;
      const count = suggestionsContainer.querySelectorAll(".sm-cc-autocomplete-suggestion").length;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        selectedIndex = (selectedIndex + 1) % count;
        updateSelection();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        selectedIndex = selectedIndex <= 0 ? count - 1 : selectedIndex - 1;
        updateSelection();
      } else if (e.key === "Enter" && selectedIndex >= 0) {
        e.preventDefault();
        selectCurrent();
      } else if (e.key === "Escape") {
        e.preventDefault();
        hideSuggestions();
      }
    });

    return {
      focus: () => input.focus(),
    };
  }

  // Repeating field (entry lists)
  if (spec.type === "repeating") {
    const repeatingSpec = spec as CompositeFieldSpec;
    const config = repeatingSpec.config ?? {};
    const isTemplateMode = Boolean(config.fields && (config.fields as any[]).length > 0);
    const isStatic = Boolean(config.static);

    const entries = Array.isArray(initial)
      ? [...(initial as Record<string, unknown>[])]
      : [];

    if (isTemplateMode) {
      // Template-based rendering
      const listContainer = controlContainer.createDiv({ cls: "sm-cc-repeating-fields" });
      const fieldTemplate = config.fields as AnyFieldSpec[];

      // Track field handles for each entry
      const fieldHandles = new Map<string, FieldRenderHandle>();

      const updateEntryFields = (
        entryContainer: HTMLElement,
        entry: Record<string, unknown>,
        template: AnyFieldSpec[],
        allFormData: Record<string, unknown>
      ) => {
        const fieldWrappers = entryContainer.querySelectorAll<HTMLElement>('.sm-cc-repeating-field');
        fieldWrappers.forEach((wrapper, index) => {
          const fieldSpec = template[index];
          if (!fieldSpec) return;

          const wasVisible = !wrapper.hasClass("is-hidden");
          const isVisible = !fieldSpec.visibleIf || fieldSpec.visibleIf(entry);
          wrapper.toggleClass("is-hidden", !isVisible);

          debugLogger.logField(fieldSpec.id, "visibility", "Field visibility check", {
            wasVisible,
            isVisible,
            currentValue: entry[fieldSpec.id]
          });

          // Auto-initialize field when it becomes visible for the first time
          if (!wasVisible && isVisible && entry[fieldSpec.id] === undefined) {
            debugLogger.logField(fieldSpec.id, "init", "Field became visible, checking init function");
            const initConfig = (fieldSpec.config as any)?.init;
            if (initConfig && typeof initConfig === "function") {
              try {
                debugLogger.logField(fieldSpec.id, "init", "Calling init function", entry);
                const initValue = initConfig(entry, allFormData);
                debugLogger.logField(fieldSpec.id, "init", "Init function returned", { initValue });
                entry[fieldSpec.id] = initValue;

                // Update the field control using its handle
                const handleKey = `${wrapper.getAttribute('data-entry-index')}-${fieldSpec.id}`;
                debugLogger.logField(fieldSpec.id, "init", "Looking for handle", { handleKey });
                const handle = fieldHandles.get(handleKey);
                if (handle?.update) {
                  debugLogger.logField(fieldSpec.id, "init", "Found handle, calling update()", { initValue });
                  handle.update(initValue, entry);
                } else {
                  debugLogger.logField(fieldSpec.id, "init", "No handle found - WARNING", { handleKey });
                  logger.warn(`No handle found for key: "${handleKey}"`);
                }
              } catch (error) {
                logger.error(`Failed to initialize ${fieldSpec.id}:`, error);
              }
            } else {
              debugLogger.logField(fieldSpec.id, "init", "No init function configured");
            }
          }

          if (fieldSpec.type === "display") {
            const displaySpec = fieldSpec as import("../types").DisplayFieldSpec;
            const displayEl = wrapper.querySelector<HTMLInputElement>('.sm-cc-display-field');
            if (displayEl && displaySpec.config?.compute) {
              try {
                const computed = displaySpec.config.compute(entry, allFormData);
                const prefix = typeof displaySpec.config.prefix === "function"
                  ? displaySpec.config.prefix(entry, allFormData)
                  : (displaySpec.config.prefix ?? "");
                const suffix = typeof displaySpec.config.suffix === "function"
                  ? displaySpec.config.suffix(entry, allFormData)
                  : (displaySpec.config.suffix ?? "");
                displayEl.value = `${prefix}${computed}${suffix}`;
              } catch (error) {
                logger.warn(`Display field ${fieldSpec.id} compute error:`, error);
                displayEl.value = "";
              }
            }
          }
        });
      };

      entries.forEach((entry, entryIndex) => {
        const entryContainer = listContainer.createDiv({
          cls: "sm-cc-repeating-item",
          attr: { "data-entry-index": String(entryIndex) }
        });

        fieldTemplate.forEach((fieldSpec) => {
          const fieldWrapper = entryContainer.createDiv({
            cls: `sm-cc-repeating-field sm-cc-repeating-field--${fieldSpec.type}`,
            attr: { "data-field-id": fieldSpec.id }
          });

          const isVisible = !fieldSpec.visibleIf || fieldSpec.visibleIf(entry);
          if (!isVisible) {
            fieldWrapper.addClass("is-hidden");
          }

          if (isVisible && entry[fieldSpec.id] === undefined) {
            const initConfig = (fieldSpec.config as any)?.init;
            if (initConfig && typeof initConfig === "function") {
              try {
                entry[fieldSpec.id] = initConfig(entry, formData || {});
              } catch (error) {
                logger.error(`Failed to initialize ${fieldSpec.id}:`, error);
              }
            }
          }

          const fieldHandle = renderFieldControl(
            fieldWrapper,
            fieldSpec,
            fieldSpec.type === "heading" ? entry : entry[fieldSpec.id],
            (newValue) => {
              debugLogger.logField(fieldSpec.id, "repeating-onChange", "Repeating field onChange called", { newValue });
              entry[fieldSpec.id] = newValue;
              debugLogger.logField(fieldSpec.id, "repeating-onChange", "Entry updated, calling parent onChange");
              onChange([...entries]);
              debugLogger.logField(fieldSpec.id, "repeating-onChange", "Parent onChange called, now calling updateEntryFields");
              updateEntryFields(entryContainer, entry, fieldTemplate, formData || {});
              debugLogger.logField(fieldSpec.id, "repeating-onChange", "updateEntryFields completed");
            },
            formData
          );

          // Store the handle for later use in updateEntryFields
          const handleKey = `${entryIndex}-${fieldSpec.id}`;
          fieldHandles.set(handleKey, fieldHandle);
        });
      });

      let synchronizer: RepeatingWidthSynchronizer | undefined;
      if (config.synchronizeWidths) {
        synchronizer = new RepeatingWidthSynchronizer(listContainer);
      }

      entries.forEach((entry, entryIndex) => {
        const entryContainer = listContainer.children[entryIndex] as HTMLElement;
        if (entryContainer) {
          updateEntryFields(entryContainer, entry, fieldTemplate, formData || {});
        }
      });

      return {
        synchronizer,
        update: (value) => {
          if (Array.isArray(value)) {
            entries.splice(0, entries.length, ...value as Record<string, unknown>[]);
            // Full re-render would be needed here
          }
        },
      };
    } else {
      // Entry-manager based rendering
      const categories = (config.categories as EntryCategoryDefinition<string>[]) ?? [];
      const filters = (config.filters as EntryFilterDefinition<Record<string, unknown>, string>[]) ?? undefined;
      const itemTemplate = repeatingSpec.itemTemplate ?? {};
      const renderEntry = config.renderEntry as ((container: HTMLElement, context: any) => HTMLElement) | undefined;
      const cardFactory = config.card as ((context: any) => any) | undefined;

      // Use core rendering function
      const handle = renderRepeatingEntryManagerCore({
        container: controlContainer,
        entries,
        categories,
        filters,
        itemTemplate,
        renderEntry,
        card: cardFactory,
        onChange,
        insertPosition: (config.insertPosition as "start" | "end") ?? "end",
        isStatic,
        mountEntryManager,
        fieldId: spec.id,
      });

      // Handle validation errors from core
      if ('error' in handle && handle.error) {
        return {};
      }

      return handle;
    }
  }

  // Fallback: Try registry for field types not handled above (e.g., tokens)
  // Adapt parameters for registry interface
  const registryArgs = {
    app: null as any, // App not needed for most renderers
    container: controlContainer,
    spec,
    values: { [spec.id]: initial },
    onChange: (id: string, value: unknown) => {
      if (id === spec.id) {
        onChange(value);
      }
    },
    registerValidator: () => {}, // No validation in entry fields
  };

  const handle = fieldRendererRegistry.render(registryArgs);

  // Return handle if successful, otherwise show error
  if (handle && !handle.container?.querySelector('.sm-cc-field--unsupported')) {
    return {
      focus: handle.focus,
      update: handle.update,
    };
  }

  // Final fallback: unsupported type already shown by registry
  return {};
}
