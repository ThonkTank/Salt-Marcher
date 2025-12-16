// src/features/data-manager/renderers/toggle.ts
// Toggle field renderer

import { createValidationControls } from "../modal/modal-utils";
import { createRendererWrapper, renderToggleCore } from "./field-rendering-core";
import { resolveInitialValue } from "./field-utils";

export const toggleFieldRenderer = createRendererWrapper(
  "toggle",
  ({ container, initial, onChange }) =>
    renderToggleCore({
      container: container.createDiv({ cls: "checkbox-container" }),
      value: initial,
      onChange,
    }),
  { createValidationControls, resolveInitialValue }
);
