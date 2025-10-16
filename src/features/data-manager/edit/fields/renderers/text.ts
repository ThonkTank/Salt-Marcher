// src/ui/create/renderers/text.ts
// Text field renderer

import { Setting } from "obsidian";
import type { FieldRegistryEntry } from "../types";
import { createValidationControls } from "../../modal/modal-utils";
import { resolveInitialValue } from "../field-utils";

export const textFieldRenderer: FieldRegistryEntry = {
  supports: (spec) => spec.type === "text",
  render: (args) => {
    const { container, spec, values, onChange } = args;
    const setting = new Setting(container).setName(spec.label);
    setting.settingEl.addClass("sm-cc-setting");
    if (spec.help) {
      setting.setDesc(spec.help);
    }
    const validation = createValidationControls(setting);
    const initial = resolveInitialValue(spec, values);

    setting.addText((text) => {
      text.setPlaceholder(spec.placeholder ?? "");
      const value = typeof initial === "string" ? initial : initial != null ? String(initial) : "";
      text.setValue(value);
      text.onChange((next) => {
        onChange(spec.id, next);
      });
    });

    return {
      setErrors: validation.apply,
      container: setting.settingEl,
    };
  },
};
