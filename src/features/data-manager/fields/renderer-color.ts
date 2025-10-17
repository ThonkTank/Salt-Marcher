// src/ui/create/renderers/color.ts
// Color field renderer

import { createRendererWrapper, renderColorCore } from "./field-rendering-core";
import { createValidationControls } from "../modal/modal-utils";
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
