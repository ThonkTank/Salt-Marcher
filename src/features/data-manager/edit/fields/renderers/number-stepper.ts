// src/ui/create/renderers/number-stepper.ts
// Number stepper field renderer

import { Setting } from "obsidian";
import type { FieldRegistryEntry } from "../types";
import { createValidationControls } from "../../modal/modal-utils";
import { resolveInitialValue } from "../field-utils";
import { createNumberStepper } from "../../layout/form-controls";

export const numberStepperFieldRenderer: FieldRegistryEntry = {
  supports: (spec) => spec.type === "number-stepper",
  render: (args) => {
    const { container, spec, values, onChange } = args;
    const setting = new Setting(container).setName(spec.label);
    setting.settingEl.addClass("sm-cc-setting");
    if (spec.help) {
      setting.setDesc(spec.help);
    }
    const validation = createValidationControls(setting);
    const initial = resolveInitialValue(spec, values);

    const handle = createNumberStepper(setting.controlEl, {
      value: typeof initial === "number" ? initial : undefined,
      min: spec.min,
      max: spec.max,
      step: spec.step,
      onChange: (value) => {
        onChange(spec.id, value);
      },
    });

    return {
      setErrors: validation.apply,
      container: setting.settingEl,
      focus: () => handle.input.focus(),
      update: (value) => {
        if (typeof value === "number") {
          handle.setValue(value);
        } else {
          handle.setValue(undefined);
        }
      },
    };
  },
};
