// src/ui/create/renderers/display.ts
// Display field renderer (computed/read-only fields)

import type { FieldRegistryEntry, DisplayFieldSpec } from "../types";
import { renderDisplayCore } from "../field-rendering-core";

export const displayFieldRenderer: FieldRegistryEntry = {
  supports: (spec) => spec.type === "display",
  render: (args) => {
    const { container, spec, values } = args;
    const displaySpec = spec as DisplayFieldSpec;

    // Add label for the control
    const label = container.createEl("label", {
      cls: "sm-cc-field-label",
      text: spec.label
    });

    const controlContainer = container.createDiv({ cls: "sm-cc-field-control" });

    // Use core rendering function
    return renderDisplayCore({
      container: controlContainer,
      config: displaySpec.config,
      fieldId: spec.id,
    });
  },
};
