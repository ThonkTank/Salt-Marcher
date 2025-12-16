// src/features/data-manager/renderers/composite.ts
// Composite field renderer (nested fields in a grid/custom layout)

import { Setting } from "obsidian";
import { createValidationControls } from "../modal/modal-utils";
import { renderCompositeCore } from "./field-rendering-core";
import { resolveInitialValue, renderFieldControl } from "./field-utils";
import type { FieldRegistryEntry, CompositeFieldSpec } from "../../types";

export const compositeFieldRenderer: FieldRegistryEntry = {
  supports: (spec) => spec.type === "composite",
  render: (args) => {
    const { container, spec, values, onChange } = args;
    const setting = new Setting(container).setName(spec.label);
    setting.settingEl.addClass("sm-cc-setting");
    if (spec.help) {
      setting.setDesc(spec.help);
    }
    const validation = createValidationControls(setting);
    const initial = resolveInitialValue(spec, values);

    const compositeSpec = spec as CompositeFieldSpec;
    const config = compositeSpec.config ?? {};
    const childFields = (config.fields as Array<Partial<import("../types").FieldSpec>>) ?? compositeSpec.children ?? [];

    // Create container for composite fields
    setting.settingEl.addClass("sm-cc-composite");
    setting.settingEl.addClass("sm-cc-setting--wide");

    // Get initial value
    const compositeValue = (values[spec.id] as Record<string, unknown>) ?? {};

    // Check if fields should be grouped by prefix
    const groupBy = (config as any).groupBy as string[] | undefined;

    // Use core rendering function
    const handle = renderCompositeCore({
      container: setting.controlEl,
      childFields,
      groupBy,
      initialValue: compositeValue,
      onChange: (value) => onChange(spec.id, value),
      renderFieldControl,
    });

    return {
      setErrors: validation.apply,
      container: setting.settingEl,
      update: handle.update,
    };
  },
};
