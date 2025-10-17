// src/ui/create/renderers/multiselect.ts
// Multiselect field renderer

import { Setting } from "obsidian";
import type { FieldRegistryEntry } from "../../types";
import { createValidationControls } from "../modal/modal-utils";
import { resolveInitialValue } from "./field-utils";
import { renderMultiselectCore } from "./field-rendering-core";

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

    // Use core rendering function
    const options = spec.options ?? [];
    const handle = renderMultiselectCore({
      container: setting.controlEl,
      options,
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
