// src/features/data-manager/renderers/display.ts
// Display field renderer (computed/read-only fields)

import { renderDisplayCore } from "./field-rendering-core";
import type { FieldRegistryEntry, DisplayFieldSpec } from "../../types";

export const displayFieldRenderer: FieldRegistryEntry = {
  supports: (spec) => spec.type === "display",
  render: (args) => {
    const { container, spec, values } = args;
    const displaySpec = spec as DisplayFieldSpec;

    // Only add label if spec.label is not empty
    if (spec.label) {
      const label = container.createEl("label", {
        cls: "sm-cc-field-label",
        text: spec.label
      });
    }

    const controlContainer = container.createDiv({ cls: "sm-cc-field-control" });

    // Use core rendering function
    return renderDisplayCore({
      container: controlContainer,
      config: displaySpec.config,
      fieldId: spec.id,
    });
  },
};
