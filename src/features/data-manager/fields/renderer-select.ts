// src/features/data-manager/renderers/select.ts
// Select field renderer

import { Setting } from "obsidian";
import type { FieldRegistryEntry } from "../../types";
import { createValidationControls } from "../modal/modal-utils";
import { resolveInitialValue } from "./field-utils";
import { enhanceSelectToSearch } from "./select-enhancement";

export const selectFieldRenderer: FieldRegistryEntry = {
  supports: (spec) => spec.type === "select",
  render: (args) => {
    const { container, spec, values, onChange } = args;
    const setting = new Setting(container).setName(spec.label);
    setting.settingEl.addClass("sm-cc-setting");
    if (spec.help) {
      setting.setDesc(spec.help);
    }
    const validation = createValidationControls(setting);
    const initial = resolveInitialValue(spec, values);

    setting.addDropdown((dropdown) => {
      const options = spec.options ?? [];
      const fallback = typeof initial === "string" ? initial : "";
      if (!options.some((opt) => opt.value === "")) {
        dropdown.addOption("", "");
      }
      for (const option of options) {
        dropdown.addOption(option.value, option.label);
      }
      dropdown.setValue(fallback);
      dropdown.onChange((value) => {
        onChange(spec.id, value || undefined);
      });
      const selectEl = (dropdown as unknown as { selectEl?: HTMLSelectElement }).selectEl;
      if (selectEl) {
        try {
          enhanceSelectToSearch(selectEl, spec.placeholder ?? "Suchen…");
        } catch (error) {
          console.warn("Enhance select failed", error);
        }
      }
    });

    return {
      setErrors: validation.apply,
      container: setting.settingEl,
    };
  },
};
