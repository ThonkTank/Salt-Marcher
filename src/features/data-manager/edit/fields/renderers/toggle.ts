// src/ui/create/renderers/toggle.ts
// Toggle field renderer

import { Setting } from "obsidian";
import type { FieldRegistryEntry } from "../types";
import { createValidationControls } from "../../modal/modal-utils";
import { resolveInitialValue } from "../field-utils";
import { renderToggleCore } from "../field-rendering-core";

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

    // Use core rendering function
    const handle = renderToggleCore({
      container: setting.controlEl,
      value: initial,
      onChange: (value) => onChange(spec.id, value),
    });

    return {
      ...handle,
      setErrors: validation.apply,
      container: setting.settingEl,
    };
  },
};
