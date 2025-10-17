// src/features/data-manager/fields/renderers/structured-tags-editor.ts
// Structured tags editor field renderer (tokens with type + value)

import { Setting } from "obsidian";
import type { FieldRegistryEntry, StructuredTagsFieldSpec } from "../../types";
import { createValidationControls } from "../modal/modal-utils";
import { resolveInitialValue } from "./field-utils";
import { mountTokenEditor, type TokenItem } from "./tag-chips";

export const structuredTagsFieldRenderer: FieldRegistryEntry = {
  supports: (spec) => spec.type === "structured-tags",
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
    setting.settingEl.addClass("sm-cc-setting--structured-tags");

    const structuredSpec = spec as StructuredTagsFieldSpec;
    const suggestions = structuredSpec.config.suggestions;
    const valueConfig = structuredSpec.config.valueConfig;

    // Initialize with existing values or default
    const tokenValues: TokenItem[] = Array.isArray(values[spec.id])
      ? (values[spec.id] as Array<{type: string; value: string}>).map(t => ({ type: t.type, value: t.value }))
      : Array.isArray(spec.default)
        ? (spec.default as Array<{type: string; value: string}>).map(t => ({ type: t.type, value: t.value }))
        : [];

    const model = {
      getItems: () => tokenValues,
      add: (value: TokenItem) => {
        tokenValues.push(value);
        onChange(spec.id, [...tokenValues]);
      },
      remove: (index: number) => {
        tokenValues.splice(index, 1);
        onChange(spec.id, [...tokenValues]);
      },
      update: (index: number, value: string) => {
        const token = tokenValues[index];
        if (token && typeof token === "object" && "type" in token) {
          token.value = value;
          onChange(spec.id, [...tokenValues]);
        }
      },
    };

    const handle = mountTokenEditor(setting.controlEl, "", model, {
      placeholder: spec.placeholder,
      structured: {
        typeSuggestions: suggestions,
        typePlaceholder: spec.placeholder ?? "Typ auswählen...",
        valuePlaceholder: valueConfig.placeholder,
        unit: valueConfig.unit,
        autoSize: true,
      },
    });

    return {
      setErrors: validation.apply,
      container: handle.setting.settingEl,
      update: (value) => {
        tokenValues.splice(0, tokenValues.length);
        if (Array.isArray(value)) {
          for (const entry of value) {
            if (
              typeof entry === "object" &&
              entry !== null &&
              "type" in entry &&
              "value" in entry
            ) {
              tokenValues.push({
                type: String(entry.type),
                value: String(entry.value),
              });
            }
          }
        }
        handle.refresh();
      },
    };
  },
};
