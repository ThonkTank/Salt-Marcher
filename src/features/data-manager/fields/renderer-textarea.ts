// src/ui/create/renderers/textarea.ts
// Textarea and markdown field renderer

import { Setting } from "obsidian";
import type { FieldRegistryEntry } from "../../types";
import { createValidationControls } from "../modal/modal-utils";
import { resolveInitialValue } from "./field-utils";
import { renderTextareaCore } from "./field-rendering-core";

export const textareaFieldRenderer: FieldRegistryEntry = {
  supports: (spec) => spec.type === "textarea" || spec.type === "markdown",
  render: (args) => {
    const { container, spec, values, onChange } = args;
    const setting = new Setting(container).setName(spec.label);
    setting.settingEl.addClass("sm-cc-setting");
    if (spec.help) {
      setting.setDesc(spec.help);
    }
    const validation = createValidationControls(setting);
    const initial = resolveInitialValue(spec, values);

    setting.settingEl.addClass("sm-cc-setting--wide");

    // Use core rendering function
    const rows = spec.type === "markdown" ? 12 : 6;
    const handle = renderTextareaCore({
      container: setting.controlEl,
      placeholder: spec.placeholder,
      value: initial,
      rows,
      onChange: (value) => onChange(spec.id, value),
    });

    return {
      ...handle,
      setErrors: validation.apply,
      container: setting.settingEl,
    };
  },
};
