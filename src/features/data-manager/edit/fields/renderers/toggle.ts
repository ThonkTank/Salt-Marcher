// src/ui/create/renderers/toggle.ts
// Toggle field renderer

import { Setting } from "obsidian";
import type { FieldRegistryEntry } from "../types";
import { createValidationControls } from "../../modal/modal-utils";
import { resolveInitialValue } from "../field-utils";

export const toggleFieldRenderer: FieldRegistryEntry = {
  supports: (spec) => spec.type === "toggle",
  render: (args) => {
    const { container, spec, values, onChange } = args;
    const setting = new Setting(container).setName(spec.label);
    setting.settingEl.addClass("sm-cc-setting");
    if (spec.help) {
      setting.setDesc(spec.help);
    }
    const validation = createValidationControls(setting);
    const initial = resolveInitialValue(spec, values);

    setting.addToggle((toggle) => {
      toggle.setValue(Boolean(initial));
      toggle.onChange((value) => {
        onChange(spec.id, value);
      });
    });

    return {
      setErrors: validation.apply,
      container: setting.settingEl,
    };
  },
};
