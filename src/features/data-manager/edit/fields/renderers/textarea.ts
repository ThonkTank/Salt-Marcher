// src/ui/create/renderers/textarea.ts
// Textarea and markdown field renderer

import { Setting } from "obsidian";
import type { FieldRegistryEntry } from "../types";
import { createValidationControls } from "../../modal/modal-utils";
import { resolveInitialValue } from "../field-utils";

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
    const textarea = setting.controlEl.createEl("textarea", {
      cls: "sm-cc-textarea",
      attr: {
        placeholder: spec.placeholder ?? "",
        rows: spec.type === "markdown" ? "12" : "6",
      },
    }) as HTMLTextAreaElement;
    if (initial != null) {
      textarea.value = typeof initial === "string" ? initial : String(initial);
    }
    textarea.addEventListener("input", () => {
      onChange(spec.id, textarea.value);
    });

    return {
      setErrors: validation.apply,
      container: setting.settingEl,
      focus: () => textarea.focus(),
      update: (value) => {
        const next = value == null ? "" : String(value);
        if (textarea.value !== next) textarea.value = next;
      },
    };
  },
};
