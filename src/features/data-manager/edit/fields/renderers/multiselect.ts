// src/ui/create/renderers/multiselect.ts
// Multiselect field renderer

import { Setting } from "obsidian";
import type { FieldRegistryEntry } from "../types";
import { createValidationControls } from "../../modal/modal-utils";
import { resolveInitialValue } from "../field-utils";

export const multiselectFieldRenderer: FieldRegistryEntry = {
  supports: (spec) => spec.type === "multiselect",
  render: (args) => {
    const { container, spec, values, onChange } = args;
    const setting = new Setting(container).setName(spec.label);
    setting.settingEl.addClass("sm-cc-setting");
    if (spec.help) {
      setting.setDesc(spec.help);
    }
    const validation = createValidationControls(setting);
    const initial = resolveInitialValue(spec, values);

    const selected = new Set<string>(Array.isArray(initial) ? (initial as string[]) : []);
    const options = spec.options ?? [];
    const multiContainer = setting.controlEl.createDiv({ cls: "sm-cc-multiselect" });
    for (const option of options) {
      const item = multiContainer.createDiv({ cls: "sm-cc-multiselect__option" });
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
        onChange(spec.id, Array.from(selected));
      });
    }

    return {
      setErrors: validation.apply,
      container: setting.settingEl,
      update: (value) => {
        selected.clear();
        if (Array.isArray(value)) {
          for (const entry of value) {
            if (typeof entry === "string") selected.add(entry);
          }
        }
        const checkboxes = multiContainer.querySelectorAll<HTMLInputElement>("input[type=checkbox]");
        checkboxes.forEach((cb) => {
          cb.checked = selected.has(cb.value);
        });
      },
    };
  },
};
