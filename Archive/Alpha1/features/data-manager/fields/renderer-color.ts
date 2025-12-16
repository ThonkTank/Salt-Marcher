// src/features/data-manager/renderers/color.ts
// Color field renderer

import { createValidationControls } from "../modal/modal-utils";
import { createRendererWrapper, renderColorCore } from "./field-rendering-core";
import { resolveInitialValue } from "./field-utils";

export const colorFieldRenderer = createRendererWrapper(
  "color",
  ({ container, initial, onChange }) =>
    renderColorCore({
      container,
      value: initial,
      onChange,
    }),
  { createValidationControls, resolveInitialValue }
);
