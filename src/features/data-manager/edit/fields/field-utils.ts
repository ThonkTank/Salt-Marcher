// src/ui/create/field-utils.ts
// Field-level utility functions for create modal

import { createNumberStepper } from "../layout/form-controls";
import { enhanceSelectToSearch } from "../../../../ui/components/search-dropdown";
import { mountEntryManager, type EntryCategoryDefinition, type EntryFilterDefinition } from "../storage/entry-system";
import { RepeatingWidthSynchronizer } from "../layout/repeating-width-sync";
import type { AnyFieldSpec, FieldRenderHandle, CompositeFieldSpec } from "../types";

/**
 * Resolves the initial value for a field from values or default.
 */
export function resolveInitialValue(spec: AnyFieldSpec, values: Record<string, unknown>) {
  if (values[spec.id] !== undefined) return values[spec.id];
  if (spec.default !== undefined) return spec.default;
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
): FieldRenderHandle {
  // Add label for the control (unless it's a heading, which has its own label style)
  if (spec.type !== "heading") {
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
    const input = controlContainer.createEl("input", {
      cls: "sm-cc-input",
      attr: {
        type: "text",
        placeholder: spec.placeholder ?? "",
      },
    }) as HTMLInputElement;
    const value = typeof initial === "string" ? initial : initial != null ? String(initial) : "";
    input.value = value;
    input.addEventListener("input", () => {
      onChange(input.value);
    });
    return {
      focus: () => input.focus(),
      update: (value) => {
        const next = value == null ? "" : String(value);
        if (input.value !== next) input.value = next;
      },
    };
  }

  // Textarea / Markdown field
  if (spec.type === "textarea" || spec.type === "markdown") {
    const rows = spec.type === "markdown" ? 12 : 4;
    const textarea = controlContainer.createEl("textarea", {
      cls: "sm-cc-textarea",
      attr: {
        rows: String(rows),
        placeholder: spec.placeholder ?? "",
      },
    }) as HTMLTextAreaElement;
    const value = typeof initial === "string" ? initial : initial != null ? String(initial) : "";
    textarea.value = value;
    textarea.addEventListener("input", () => {
      onChange(textarea.value);
    });
    return {
      focus: () => textarea.focus(),
      update: (value) => {
        const next = value == null ? "" : String(value);
        if (textarea.value !== next) textarea.value = next;
      },
    };
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

  // Toggle field
  if (spec.type === "toggle") {
    const toggleContainer = controlContainer.createDiv({ cls: "checkbox-container" });
    const checkbox = toggleContainer.createEl("input", {
      attr: { type: "checkbox" }
    }) as HTMLInputElement;
    checkbox.checked = Boolean(initial);
    checkbox.addEventListener("change", () => {
      onChange(checkbox.checked);
    });
    return {
      focus: () => checkbox.focus(),
      update: (value) => {
        checkbox.checked = Boolean(value);
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
    const selected = new Set<string>(
      Array.isArray(initial) ? (initial as string[]) : []
    );

    const checkboxList = controlContainer.createDiv({ cls: "sm-cc-multiselect" });

    const checkboxes: HTMLInputElement[] = [];
    for (const opt of options) {
      const itemContainer = checkboxList.createDiv({ cls: "sm-cc-multiselect-item" });
      const checkbox = itemContainer.createEl("input", {
        attr: { type: "checkbox" }
      }) as HTMLInputElement;
      checkbox.checked = selected.has(opt.value);
      checkbox.addEventListener("change", () => {
        if (checkbox.checked) {
          selected.add(opt.value);
        } else {
          selected.delete(opt.value);
        }
        onChange(Array.from(selected));
      });
      itemContainer.createEl("label", { text: opt.label });
      checkboxes.push(checkbox);
    }

    return {
      update: (value) => {
        const newSelected = new Set<string>(
          Array.isArray(value) ? (value as string[]) : []
        );
        checkboxes.forEach((cb, index) => {
          cb.checked = newSelected.has(options[index].value);
        });
      },
    };
  }

  // Color field
  if (spec.type === "color") {
    const input = controlContainer.createEl("input", {
      cls: "sm-cc-color-input",
      attr: {
        type: "color",
      },
    }) as HTMLInputElement;
    const value = typeof initial === "string" ? initial : "#000000";
    input.value = value;
    input.addEventListener("input", () => {
      onChange(input.value);
    });
    return {
      focus: () => input.focus(),
      update: (value) => {
        input.value = typeof value === "string" ? value : "#000000";
      },
    };
  }

  // ═══════════════════════════════════════════════
  // SPECIAL FIELD TYPES
  // ═══════════════════════════════════════════════

  // Display field (computed/read-only)
  if (spec.type === "display") {
    const displaySpec = spec as import("../types").DisplayFieldSpec;
    const displayEl = controlContainer.createEl("input", {
      cls: "sm-cc-display-field",
      attr: {
        type: "text",
        disabled: "true",
        readonly: "true",
      },
    }) as HTMLInputElement;

    if (displaySpec.config.className) {
      displayEl.addClass(displaySpec.config.className);
    }

    return {
      update: (value, all) => {
        try {
          const computed = displaySpec.config.compute(all ?? {});
          const prefixVal = typeof displaySpec.config.prefix === "function"
            ? displaySpec.config.prefix(all ?? {})
            : (displaySpec.config.prefix ?? "");
          const suffixVal = typeof displaySpec.config.suffix === "function"
            ? displaySpec.config.suffix(all ?? {})
            : (displaySpec.config.suffix ?? "");
          displayEl.value = `${prefixVal}${computed}${suffixVal}`;
        } catch (error) {
          console.warn(`Display field ${spec.id} compute error:`, error);
          displayEl.value = "";
        }
      },
    };
  }

  // Heading type (for entry labels in repeating fields)
  if (spec.type === "heading") {
    const headingSpec = spec as import("../types").HeadingFieldSpec;
    const value = headingSpec.getValue
      ? headingSpec.getValue(initial as Record<string, unknown>)
      : String(initial ?? "");

    controlContainer.createEl("strong", {
      cls: "sm-cc-field-heading",
      text: value
    });

    return {}; // No update/focus needed for headings
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
    const useGrouping = Boolean(groupBy && groupBy.length > 0);

    const compositeContainer = controlContainer.createDiv({
      cls: useGrouping ? "sm-cc-composite-grouped" : "sm-cc-composite-grid"
    });

    const compositeValue = (initial as Record<string, unknown>) ?? {};
    const childInstances: Array<{
      id: string;
      spec: AnyFieldSpec;
      handle: FieldRenderHandle;
      wrapper: HTMLElement;
      wasVisible: boolean;
      initialized: boolean;
    }> = [];

    const evaluateChildVisibility = (childSpec: AnyFieldSpec): boolean => {
      if (!childSpec.visibleIf) return true;
      try {
        return childSpec.visibleIf(compositeValue);
      } catch (error) {
        console.error(`Failed to evaluate visibility for ${childSpec.id}:`, error);
        return true;
      }
    };

    const updateChildVisibility = () => {
      for (const child of childInstances) {
        const shouldBeVisible = evaluateChildVisibility(child.spec);
        if (shouldBeVisible !== child.wasVisible) {
          child.wrapper.toggleClass("is-hidden", !shouldBeVisible);
          child.wasVisible = shouldBeVisible;
          if (shouldBeVisible && !child.initialized) {
            child.initialized = true;
            const initConfig = (child.spec.config as any)?.init;
            if (initConfig && typeof initConfig === "function") {
              try {
                const initValue = initConfig(compositeValue);
                compositeValue[child.id] = initValue;
                child.handle.update?.(initValue, compositeValue);
                onChange(compositeValue);
              } catch (error) {
                console.error(`Failed to initialize ${child.id}:`, error);
              }
            }
          }
        }
      }
    };

    // Render children (with or without grouping)
    const fieldsToRender = useGrouping && groupBy
      ? groupBy.flatMap(prefix =>
          childFields.filter(f => f.id === prefix || f.id?.startsWith(`${prefix}`))
        )
      : childFields;

    for (const childDef of fieldsToRender) {
      const childId = childDef.id ?? "";
      const childSpec: AnyFieldSpec = {
        id: childId,
        label: childDef.label ?? childId,
        type: childDef.type ?? "text",
        ...childDef,
      };

      const childWrapper = compositeContainer.createDiv({ cls: "sm-cc-composite-item" });
      const childInitial = compositeValue[childId] ?? childSpec.default;

      const childHandle = renderFieldControl(
        childWrapper,
        childSpec,
        childInitial,
        (childValue) => {
          const oldValue = compositeValue[childId];
          compositeValue[childId] = childValue;
          onChange(compositeValue);
          if (oldValue !== childValue) {
            updateChildVisibility();
          }
        }
      );

      const initiallyVisible = evaluateChildVisibility(childSpec);
      childWrapper.toggleClass("is-hidden", !initiallyVisible);

      childInstances.push({
        id: childId,
        spec: childSpec,
        handle: childHandle,
        wrapper: childWrapper,
        wasVisible: initiallyVisible,
        initialized: initiallyVisible,
      });
    }

    return {
      update: (value) => {
        if (typeof value === "object" && value !== null) {
          const valueMap = value as Record<string, unknown>;
          for (const child of childInstances) {
            child.handle.update?.(valueMap[child.id], valueMap);
          }
          updateChildVisibility();
        }
      },
    };
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

      const updateEntryFields = (
        entryContainer: HTMLElement,
        entry: Record<string, unknown>,
        template: AnyFieldSpec[]
      ) => {
        const fieldWrappers = entryContainer.querySelectorAll<HTMLElement>('.sm-cc-repeating-field');
        fieldWrappers.forEach((wrapper, index) => {
          const fieldSpec = template[index];
          if (!fieldSpec) return;

          const isVisible = !fieldSpec.visibleIf || fieldSpec.visibleIf(entry);
          wrapper.toggleClass("is-hidden", !isVisible);

          if (fieldSpec.type === "display") {
            const displaySpec = fieldSpec as import("../types").DisplayFieldSpec;
            const displayEl = wrapper.querySelector<HTMLInputElement>('.sm-cc-display-field');
            if (displayEl && displaySpec.config?.compute) {
              try {
                const computed = displaySpec.config.compute(entry);
                const prefix = typeof displaySpec.config.prefix === "function"
                  ? displaySpec.config.prefix(entry)
                  : (displaySpec.config.prefix ?? "");
                const suffix = typeof displaySpec.config.suffix === "function"
                  ? displaySpec.config.suffix(entry)
                  : (displaySpec.config.suffix ?? "");
                displayEl.value = `${prefix}${computed}${suffix}`;
              } catch (error) {
                console.warn(`Display field ${fieldSpec.id} compute error:`, error);
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
                entry[fieldSpec.id] = initConfig(entry);
              } catch (error) {
                console.error(`Failed to initialize ${fieldSpec.id}:`, error);
              }
            }
          }

          const fieldHandle = renderFieldControl(
            fieldWrapper,
            fieldSpec,
            fieldSpec.type === "heading" ? entry : entry[fieldSpec.id],
            (newValue) => {
              entry[fieldSpec.id] = newValue;
              onChange([...entries]);
              updateEntryFields(entryContainer, entry, fieldTemplate);
            }
          );
        });
      });

      let synchronizer: RepeatingWidthSynchronizer | undefined;
      if (config.synchronizeWidths) {
        synchronizer = new RepeatingWidthSynchronizer(listContainer);
      }

      entries.forEach((entry, entryIndex) => {
        const entryContainer = listContainer.children[entryIndex] as HTMLElement;
        if (entryContainer) {
          updateEntryFields(entryContainer, entry, fieldTemplate);
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

      if (!categories.length) {
        controlContainer.createEl("p", {
          text: "No categories defined for repeating field",
          cls: "sm-cc-field--error"
        });
        return {};
      }

      const renderEntry = config.renderEntry as ((container: HTMLElement, context: any) => HTMLElement) | undefined;
      const cardFactory = config.card as ((context: any) => any) | undefined;

      if (!renderEntry && !cardFactory) {
        controlContainer.createEl("p", {
          text: "No renderer defined for repeating field",
          cls: "sm-cc-field--error"
        });
        return {};
      }

      const createEntry = (category: string): Record<string, unknown> => {
        const entry: Record<string, unknown> = { category };
        for (const [key, fieldDef] of Object.entries(itemTemplate)) {
          if (fieldDef.default !== undefined) {
            entry[key] = fieldDef.default;
          }
        }
        return entry;
      };

      const handle = mountEntryManager(controlContainer, {
        label: "",
        entries,
        categories,
        filters,
        createEntry,
        renderEntry,
        card: cardFactory,
        onEntriesChanged: (updated) => {
          onChange(updated);
        },
        insertPosition: (config.insertPosition as "start" | "end") ?? "end",
        hideAddBar: isStatic,
        hideActions: isStatic,
      });

      return {
        update: (value) => {
          if (Array.isArray(value)) {
            entries.splice(0, entries.length, ...value as Record<string, unknown>[]);
            handle.rerender();
          }
        },
      };
    }
  }

  // Fallback: unsupported type
  controlContainer.createEl("p", {
    text: `Unsupported field type: ${spec.type}`,
    cls: "sm-cc-field--error"
  });
  return {};
}
