// src/ui/create/renderers/color.ts
// Color field renderer

import { Setting } from "obsidian";
import type { FieldRegistryEntry } from "../types";
import { createValidationControls } from "../../modal/modal-utils";
import { resolveInitialValue } from "../field-utils";
import { renderColorCore } from "../field-rendering-core";

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

    // Use core rendering function
    const handle = renderColorCore({
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
