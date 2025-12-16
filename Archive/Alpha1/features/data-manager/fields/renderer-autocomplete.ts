// src/features/data-manager/renderers/autocomplete.ts
// Autocomplete field renderer (async search with suggestions)

import { Setting } from "obsidian";
import { createValidationControls } from "../modal/modal-utils";
import { resolveInitialValue } from "./field-utils";
import type { FieldRegistryEntry, AutocompleteFieldSpec } from "../../types";

export const autocompleteFieldRenderer: FieldRegistryEntry = {
  supports: (spec) => spec.type === "autocomplete",
  render: (args) => {
    const { container, spec, values, onChange } = args;
    const setting = new Setting(container).setName(spec.label);
    setting.settingEl.addClass("sm-cc-setting");
    if (spec.help) {
      setting.setDesc(spec.help);
    }
    const validation = createValidationControls(setting);
    const initial = resolveInitialValue(spec, values);

    const autocompleteSpec = spec as AutocompleteFieldSpec;
    const { load, renderSuggestion, onSelect, minQueryLength = 2 } = autocompleteSpec.config;

    const input = setting.controlEl.createEl("input", {
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
        suggestionsContainer = setting.controlEl.createDiv({ cls: "sm-cc-autocomplete-suggestions" });
      }
      suggestionsContainer.empty();
      selectedIndex = -1;

      items.forEach((item, index) => {
        const suggestionEl = suggestionsContainer!.createDiv({ cls: "sm-cc-autocomplete-suggestion" });
        suggestionEl.innerHTML = renderSuggestion(item);
        suggestionEl.addEventListener("click", () => {
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
      setErrors: validation.apply,
      container: setting.settingEl,
      focus: () => input.focus(),
    };
  },
};
