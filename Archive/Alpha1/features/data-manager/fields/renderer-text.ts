// src/features/data-manager/renderers/text.ts
// Text field renderer

import { createValidationControls } from "../modal/modal-utils";
import { createRendererWrapper, renderTextCore } from "./field-rendering-core";
import { resolveInitialValue } from "./field-utils";

export const textFieldRenderer = createRendererWrapper(
  "text",
  ({ container, spec, initial, onChange }) =>
    renderTextCore({
      container,
      placeholder: spec.placeholder,
      value: initial,
      onChange,
    }),
  { createValidationControls, resolveInitialValue }
);
