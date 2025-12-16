// NEW MODULAR TOKEN FIELD IMPLEMENTATION
// This will replace the existing renderTokenFieldCore in field-rendering-core.ts

import { configurableLogger } from '@services/logging/configurable-logger';

const logger = configurableLogger.forModule("data-manager-token-field");
import type { TokenFieldDefinition } from "../types";
import type { CoreFieldHandle } from "./field-rendering-core";

export interface ModularTokenFieldOptions {
  container: HTMLElement;
  fields: TokenFieldDefinition[];
  primaryField: string;
  value?: Array<Record<string, unknown>>;
  chipTemplate?: (token: Record<string, unknown>) => string;
  className?: string;
  onChange: (value: Array<Record<string, unknown>>) => void;
  getInitialValue?: (formData: Record<string, unknown>, primaryValue: string) => Record<string, unknown>;
  formData?: Record<string, unknown>; // Access to full form data for getInitialValue
  onTokenFieldChange?: (token: Record<string, unknown>, fieldId: string, newValue: unknown, formData: Record<string, unknown>) => void;
}

export interface ModularTokenFieldHandle extends CoreFieldHandle {
  chipsContainer: HTMLElement;
  refresh: () => void;
}

/**
 * NEW: Modular token field core renderer.
 * Supports flexible token structures with inline-editable segments.
 */
export function renderModularTokenFieldCore(
  options: ModularTokenFieldOptions
): ModularTokenFieldHandle {
  const {
    container,
    fields,
    primaryField,
    value = [],
    chipTemplate,
    className = "sm-cc-token-field",
    onChange,
    getInitialValue,
    formData = {},
    onTokenFieldChange,
  } = options;

  const tokens: Array<Record<string, unknown>> = Array.isArray(value) ? [...value] : [];

  // Find primary field definition
  const primaryFieldDef = fields.find(f => f.id === primaryField);
  if (!primaryFieldDef) {
    throw new Error(`Primary field "${primaryField}" not found in fields config`);
  }

  // Create input for primary field
  const inputEl = container.createEl("input", {
    cls: `${className}__input-el`,
    attr: {
      type: "text",
      placeholder: primaryFieldDef.placeholder ?? "Hinzufügen...",
    },
  }) as HTMLInputElement;
  inputEl.style.minWidth = "260px";

  // Add button
  const addButton = container.createEl("button", {
    text: "+",
    cls: "mod-cta",
  });

  // Chips container - created separately, NOT as child of container
  // Caller must append this to the correct grid position
  const chipsContainer = document.createElement("div");
  chipsContainer.addClass("sm-cc-chips");

  // Suggestion menu state (for primary field)
  let suggestionMenuEl: HTMLElement | null = null;
  let activeSuggestionIndex = -1;
  let filteredSuggestions: any[] = [];

  const closeSuggestionMenu = () => {
    if (suggestionMenuEl) {
      suggestionMenuEl.remove();
      suggestionMenuEl = null;
    }
    activeSuggestionIndex = -1;
  };

  const openSuggestionMenu = (query: string) => {
    closeSuggestionMenu();

    const suggestions = primaryFieldDef.suggestions;
    if (!suggestions || suggestions.length === 0) return;

    const lowerQuery = query.toLowerCase();

    // Filter based on suggestion type
    if (typeof suggestions[0] === "string") {
      filteredSuggestions = (suggestions as string[])
        .filter(s => s.toLowerCase().includes(lowerQuery))
        .slice(0, 10);
    } else {
      filteredSuggestions = (suggestions as Array<{key: string; label: string}>)
        .filter(s => s.label.toLowerCase().includes(lowerQuery) || s.key.toLowerCase().includes(lowerQuery))
        .slice(0, 10);
    }

    if (filteredSuggestions.length === 0) return;

    suggestionMenuEl = container.parentElement!.createDiv({ cls: "sm-cc-suggestion-menu" });
    activeSuggestionIndex = -1;

    filteredSuggestions.forEach((suggestion, index) => {
      const text = typeof suggestion === "string" ? suggestion : suggestion.label;
      const value = typeof suggestion === "string" ? suggestion : suggestion.key;
      const item = suggestionMenuEl!.createDiv({ cls: "sm-cc-suggestion-item" });
      item.textContent = text;
      item.onclick = () => {
        inputEl.value = value;
        closeSuggestionMenu();
      };
    });
  };

  const highlightSuggestion = () => {
    if (!suggestionMenuEl) return;
    const items = suggestionMenuEl.querySelectorAll('.sm-cc-suggestion-item');
    items.forEach((item, index) => {
      item.toggleClass('is-active', index === activeSuggestionIndex);
    });
    if (activeSuggestionIndex >= 0 && activeSuggestionIndex < items.length) {
      items[activeSuggestionIndex].scrollIntoView({ block: 'nearest' });
    }
  };

  /**
   * Format a field value for display in chip
   */
  const formatFieldValue = (value: unknown, fieldDef: TokenFieldDefinition): string => {
    if (value == null || value === "") {
      return fieldDef.placeholder || "-";
    }

    // Handle select fields - resolve label from suggestions
    if (fieldDef.type === "select" && fieldDef.suggestions) {
      const suggestion = fieldDef.suggestions.find((s: any) =>
        typeof s === "object" ? s.key === value : s === value
      );
      if (suggestion && typeof suggestion === "object") {
        return suggestion.label;
      }
    }

    // Handle checkbox - show icon or text
    if (fieldDef.type === "checkbox") {
      if (value) {
        return fieldDef.icon || "✓";
      } else {
        // Show unchecked icon - use hollow version if star, otherwise use empty box
        if (fieldDef.icon === "★") {
          return "☆";  // Hollow star for unchecked
        }
        return "☐";  // Empty checkbox
      }
    }

    // Default: convert to string and add unit if present
    const str = String(value);
    return fieldDef.unit ? `${str}${fieldDef.unit}` : str;
  };

  /**
   * Render all chips
   */
  const renderChips = () => {
    chipsContainer.empty();

    tokens.forEach((token, index) => {
      const chip = chipsContainer.createDiv({ cls: "sm-cc-chip" });

      // Use custom chip template if provided
      if (chipTemplate) {
        try {
          chip.createSpan({
            text: chipTemplate(token),
            cls: "sm-cc-chip__text"
          });
        } catch (error) {
          logger.error("Chip template error:", error);
          chip.createSpan({ text: JSON.stringify(token), cls: "sm-cc-chip__text" });
        }
      } else {
        // Default: render segments for each visible field
        for (const fieldDef of fields) {
          if (!fieldDef.displayInChip) continue;

          // Check visibility condition
          if (fieldDef.visibleIf && !fieldDef.visibleIf(token)) continue;

          const segment = chip.createSpan({
            cls: [
              "sm-cc-chip__segment",
              `sm-cc-chip__segment--${fieldDef.type}`,
              fieldDef.editable ? "sm-cc-chip__segment--editable" : ""
            ]
          });

          // Add label prefix if specified
          if (fieldDef.label) {
            segment.createSpan({ text: fieldDef.label, cls: "sm-cc-chip__label" });
          }

          // Display value
          const displayValue = formatFieldValue(token[fieldDef.id], fieldDef);
          segment.createSpan({ text: displayValue, cls: "sm-cc-chip__value" });

          // Make segment clickable for inline editing
          if (fieldDef.editable) {
            segment.onclick = (e) => {
              e.stopPropagation();
              openInlineEditor(segment, token, index, fieldDef);
            };
          }
        }
      }

      // Remove button
      const removeBtn = chip.createEl("button", { text: "×", cls: "sm-cc-chip__remove" });
      removeBtn.onclick = () => {
        tokens.splice(index, 1);
        onChange([...tokens]);
        renderChips();
      };
    });
  };

  /**
   * Open inline editor for a specific field within a chip
   */
  const openInlineEditor = (
    segment: HTMLElement,
    token: Record<string, unknown>,
    tokenIndex: number,
    fieldDef: TokenFieldDefinition
  ) => {
    const originalContent = segment.innerHTML;
    segment.empty();

    let editor: HTMLElement;
    let getValue: () => unknown;

    switch (fieldDef.type) {
      case "text": {
        const input = segment.createEl("input", {
          cls: "sm-cc-inline-editor sm-cc-inline-editor--text",
          attr: {
            type: "text",
            placeholder: fieldDef.placeholder,
          },
        }) as HTMLInputElement;
        input.value = String(token[fieldDef.id] || "");
        editor = input;
        getValue = () => input.value;
        break;
      }

      case "select": {
        const select = segment.createEl("select", {
          cls: "sm-cc-inline-editor sm-cc-inline-editor--select",
        }) as HTMLSelectElement;

        // Add options
        if (fieldDef.options) {
          for (const opt of fieldDef.options) {
            const option = select.createEl("option", {
              value: opt.value,
              text: opt.label,
            });
            if (opt.value === token[fieldDef.id]) {
              option.selected = true;
            }
          }
        } else if (fieldDef.suggestions) {
          for (const sug of fieldDef.suggestions) {
            if (typeof sug === "string") {
              const option = select.createEl("option", { value: sug, text: sug });
              if (sug === token[fieldDef.id]) option.selected = true;
            } else {
              const option = select.createEl("option", { value: sug.key, text: sug.label });
              if (sug.key === token[fieldDef.id]) option.selected = true;
            }
          }
        }

        editor = select;
        getValue = () => select.value;
        break;
      }

      case "checkbox": {
        // For checkbox, just toggle immediately
        const oldValue = token[fieldDef.id];
        const newValue = !token[fieldDef.id];
        token[fieldDef.id] = newValue;
        logger.debug(`[TokenField] Checkbox toggled: ${fieldDef.id} ${oldValue} -> ${newValue}`);

        // Call field change callback if provided (for recalculating dependent fields)
        if (onTokenFieldChange) {
          logger.debug(`[TokenField] Calling onTokenFieldChange for ${fieldDef.id}`);
          onTokenFieldChange(token, fieldDef.id, newValue, formData);
        }

        logger.debug(`[TokenField] Calling onChange with tokens:`, JSON.stringify(tokens, null, 2));
        onChange([...tokens]);
        logger.debug(`[TokenField] onChange called, now re-rendering chips`);
        renderChips();
        return;
      }

      case "number-stepper": {
        const input = segment.createEl("input", {
          cls: "sm-cc-inline-editor sm-cc-inline-editor--number",
          attr: {
            type: "number",
            min: String(fieldDef.min ?? ""),
            max: String(fieldDef.max ?? ""),
            step: String(fieldDef.step ?? 1),
          },
        }) as HTMLInputElement;
        input.value = String(token[fieldDef.id] || fieldDef.default || 0);
        editor = input;
        getValue = () => Number(input.value);
        break;
      }

      default:
        // Unsupported type - restore original
        segment.innerHTML = originalContent;
        return;
    }

    // Auto-focus
    editor.focus();
    if (editor instanceof HTMLInputElement && editor.type === "text") {
      editor.select();
    }

    // Save handler
    const save = () => {
      const newValue = getValue();
      token[fieldDef.id] = newValue;

      // Call field change callback if provided (for recalculating dependent fields)
      if (onTokenFieldChange) {
        onTokenFieldChange(token, fieldDef.id, newValue, formData);
      }

      onChange([...tokens]);
      renderChips();
    };

    // Cancel handler
    const cancel = () => {
      segment.innerHTML = originalContent;
    };

    // Event listeners
    editor.addEventListener("blur", () => {
      setTimeout(save, 100); // Delay to allow click events to fire
    });

    editor.addEventListener("keydown", (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        save();
      } else if (e.key === "Escape") {
        e.preventDefault();
        cancel();
      }
    });
  };

  /**
   * Add a new token
   */
  const addToken = () => {
    const inputValue = inputEl.value.trim();
    if (!inputValue) return;

    // Create new token with primary field value and defaults
    let newToken: Record<string, unknown> = {};

    // Use custom initializer if provided
    if (getInitialValue) {
      newToken = getInitialValue(formData, inputValue);
    } else {
      // Default initialization
      for (const fieldDef of fields) {
        if (fieldDef.id === primaryField) {
          newToken[fieldDef.id] = inputValue;
        } else if (fieldDef.default !== undefined) {
          newToken[fieldDef.id] = fieldDef.default;
        }
      }
    }

    tokens.push(newToken);
    onChange([...tokens]);
    inputEl.value = "";
    renderChips();
    closeSuggestionMenu();
  };

  // Event handlers for primary input
  if (primaryFieldDef.suggestions && primaryFieldDef.suggestions.length > 0) {
    inputEl.addEventListener("input", () => {
      openSuggestionMenu(inputEl.value);
    });

    inputEl.addEventListener("focus", () => {
      openSuggestionMenu(inputEl.value);
    });

    inputEl.addEventListener("blur", () => {
      setTimeout(closeSuggestionMenu, 150);
    });
  }

  inputEl.addEventListener("keydown", (e: KeyboardEvent) => {
    if (suggestionMenuEl) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        activeSuggestionIndex = Math.min(filteredSuggestions.length - 1, activeSuggestionIndex + 1);
        highlightSuggestion();
        return;
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        activeSuggestionIndex = Math.max(0, activeSuggestionIndex - 1);
        highlightSuggestion();
        return;
      } else if (e.key === "Enter" && activeSuggestionIndex >= 0) {
        e.preventDefault();
        const suggestion = filteredSuggestions[activeSuggestionIndex];
        inputEl.value = typeof suggestion === "string" ? suggestion : suggestion.key;
        closeSuggestionMenu();
        return;
      } else if (e.key === "Escape") {
        e.preventDefault();
        closeSuggestionMenu();
        return;
      }
    }

    if (e.key === "Enter") {
      e.preventDefault();
      addToken();
    }
  });

  addButton.onclick = () => addToken();

  // Initial render
  renderChips();

  return {
    chipsContainer,
    focus: () => inputEl.focus(),
    update: (newValue: unknown) => {
      tokens.splice(0, tokens.length);
      if (Array.isArray(newValue)) {
        tokens.push(...(newValue as Array<Record<string, unknown>>));
      }
      renderChips();
    },
    refresh: renderChips,
  };
}
