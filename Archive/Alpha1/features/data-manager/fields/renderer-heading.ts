// src/features/data-manager/renderers/heading.ts
// Heading field renderer (for entry labels in repeating fields)

import type { FieldRegistryEntry, HeadingFieldSpec } from "../../types";

export const headingFieldRenderer: FieldRegistryEntry = {
  supports: (spec) => spec.type === "heading",
  render: (args) => {
    const { container, spec, values } = args;
    const headingSpec = spec as HeadingFieldSpec;

    // Calculate label text from getValue or use spec.label
    const labelText = headingSpec.getValue
      ? headingSpec.getValue(values as Record<string, unknown>)
      : spec.label;

    // Always create label with calculated text
    container.createEl("label", {
      cls: "sm-cc-field-label",
      text: labelText
    });

    // Control container (empty for heading fields)
    container.createDiv({ cls: "sm-cc-field-control" });

    return {};
  },
};
