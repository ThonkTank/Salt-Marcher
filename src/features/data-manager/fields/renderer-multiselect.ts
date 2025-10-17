// src/features/data-manager/renderers/multiselect.ts
// Multiselect field renderer

import { createRendererWrapper, renderMultiselectCore } from "./field-rendering-core";
import { createValidationControls } from "../modal/modal-utils";
import { resolveInitialValue } from "./field-utils";

export const multiselectFieldRenderer = createRendererWrapper(
  "multiselect",
  ({ container, spec, initial, onChange }) =>
    renderMultiselectCore({
      container,
      options: (spec as import("../../types").MultiselectFieldSpec).options ?? [],
      value: initial,
      onChange,
    }),
  { createValidationControls, resolveInitialValue }
);
