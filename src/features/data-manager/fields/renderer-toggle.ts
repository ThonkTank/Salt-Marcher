// src/features/data-manager/renderers/toggle.ts
// Toggle field renderer

import { createRendererWrapper, renderToggleCore } from "./field-rendering-core";
import { createValidationControls } from "../modal/modal-utils";
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
