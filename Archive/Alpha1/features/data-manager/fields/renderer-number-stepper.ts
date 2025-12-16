// src/features/data-manager/renderers/number-stepper.ts
// Number stepper field renderer

import { createValidationControls } from "../modal/modal-utils";
import { createRendererWrapper } from "./field-rendering-core";
import { resolveInitialValue } from "./field-utils";
import { createNumberStepper } from "./number-stepper-control";

export const numberStepperFieldRenderer = createRendererWrapper(
  "number-stepper",
  ({ container, spec, initial, onChange }) => {
    const handle = createNumberStepper(container, {
      value: typeof initial === "number" ? initial : undefined,
      min: spec.min,
      max: spec.max,
      step: spec.step,
      onChange,
    });
    return {
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
  { createValidationControls, resolveInitialValue }
);
