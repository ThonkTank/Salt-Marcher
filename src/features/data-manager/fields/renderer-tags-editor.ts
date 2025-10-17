// src/ui/create/fields/renderers/tags-editor.ts
// Tags editor field renderer

import { Setting } from "obsidian";
import type { FieldRegistryEntry } from "../../types";
import { createValidationControls } from "../modal/modal-utils";
import { resolveInitialValue } from "./field-utils";
import { mountTokenEditor } from "./tag-chips";

export const tagsFieldRenderer: FieldRegistryEntry = {
  supports: (spec) => spec.type === "tags",
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
    setting.settingEl.addClass("sm-cc-setting--tags");
    const tagValues = Array.isArray(values[spec.id])
      ? [...(values[spec.id] as string[])]
      : Array.isArray(spec.default)
        ? [...(spec.default as string[])]
        : [];

    // Support suggestions from config
    const suggestions = spec.config?.suggestions as string[] | undefined;

    const model = {
      getItems: () => tagValues,
      add: (value: string) => {
        tagValues.push(value);
        onChange(spec.id, [...tagValues]);
      },
      remove: (index: number) => {
        tagValues.splice(index, 1);
        onChange(spec.id, [...tagValues]);
      },
    };
    const handle = mountTokenEditor(setting.controlEl, "", model, {
      placeholder: spec.placeholder,
      suggestions, // Pass suggestions to token editor
    });

    return {
      setErrors: validation.apply,
      container: handle.setting.settingEl,
      update: (value) => {
        tagValues.splice(0, tagValues.length);
        if (Array.isArray(value)) {
          for (const entry of value) {
            if (typeof entry === "string") tagValues.push(entry);
          }
        }
        handle.refresh();
      },
    };
  },
};
