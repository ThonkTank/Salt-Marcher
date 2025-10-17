// src/ui/create/renderers/textarea.ts
// Textarea field renderer

import { createRendererWrapper, renderTextareaCore } from "./field-rendering-core";
import { createValidationControls } from "../modal/modal-utils";
import { resolveInitialValue } from "./field-utils";

export const textareaFieldRenderer = createRendererWrapper(
  "textarea",
  ({ container, spec, initial, onChange }) =>
    renderTextareaCore({
      container,
      placeholder: spec.placeholder,
      value: initial,
      onChange,
    }),
  { createValidationControls, resolveInitialValue }
);
