// src/features/data-manager/renderers/checkbox.ts
// Checkbox field renderer

import { createRendererWrapper, renderCheckboxCore } from "./field-rendering-core";
import { createValidationControls } from "../modal/modal-utils";
import { resolveInitialValue } from "./field-utils";

export const checkboxFieldRenderer = createRendererWrapper(
  "checkbox",
  ({ container, initial, onChange }) =>
    renderCheckboxCore({
      container: container.createDiv({ cls: "checkbox-container" }),
      value: initial,
      onChange,
    }),
  { createValidationControls, resolveInitialValue }
);
