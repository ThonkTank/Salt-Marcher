// src/ui/create/renderers/text.ts
// Text field renderer

import { createRendererWrapper, renderTextCore } from "./field-rendering-core";
import { createValidationControls } from "../modal/modal-utils";
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
