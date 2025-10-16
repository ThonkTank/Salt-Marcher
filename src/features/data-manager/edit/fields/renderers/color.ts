// src/ui/create/renderers/color.ts
// Color field renderer

import { Setting } from "obsidian";
import type { FieldRegistryEntry } from "../types";
import { createValidationControls } from "../../modal/modal-utils";
import { resolveInitialValue } from "../field-utils";

export const colorFieldRenderer: FieldRegistryEntry = {
  supports: (spec) => spec.type === "color",
  render: (args) => {
    const { container, spec, values, onChange } = args;
    const setting = new Setting(container).setName(spec.label);
    setting.settingEl.addClass("sm-cc-setting");
    if (spec.help) {
      setting.setDesc(spec.help);
    }
    const validation = createValidationControls(setting);
    const initial = resolveInitialValue(spec, values);

    const input = setting.controlEl.createEl("input", { attr: { type: "color" } }) as HTMLInputElement;
    const defaultColor = typeof initial === "string" && /^#[0-9a-fA-F]{6}$/.test(initial) ? initial : "#999999";
    input.value = defaultColor;
    input.addEventListener("input", () => {
      onChange(spec.id, input.value || "#999999");
    });
    input.addEventListener("change", () => {
      onChange(spec.id, input.value || "#999999");
    });

    return {
      setErrors: validation.apply,
      container: setting.settingEl,
      focus: () => input.focus(),
      update: (value) => {
        if (typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value)) {
          input.value = value;
        }
      },
    };
  },
};
