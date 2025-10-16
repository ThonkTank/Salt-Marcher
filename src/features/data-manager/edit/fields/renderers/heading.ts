// src/ui/create/renderers/heading.ts
// Heading field renderer (for entry labels in repeating fields)

import type { FieldRegistryEntry, HeadingFieldSpec } from "../types";

export const headingFieldRenderer: FieldRegistryEntry = {
  supports: (spec) => spec.type === "heading",
  render: (args) => {
    const { container, spec, values } = args;
    const headingSpec = spec as HeadingFieldSpec;

    // Add label for the control
    const label = container.createEl("label", {
      cls: "sm-cc-field-label",
      text: spec.label
    });

    const controlContainer = container.createDiv({ cls: "sm-cc-field-control" });

    const value = headingSpec.getValue
      ? headingSpec.getValue(values as Record<string, unknown>)
      : String(values ?? "");

    controlContainer.createEl("strong", {
      cls: "sm-cc-field-heading",
      text: value
    });

    return {}; // No update/focus needed for headings
  },
};
