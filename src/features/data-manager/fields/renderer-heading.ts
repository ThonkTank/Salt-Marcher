// src/features/data-manager/renderers/heading.ts
// Heading field renderer (for entry labels in repeating fields)

import type { FieldRegistryEntry, HeadingFieldSpec } from "../../types";
import { renderHeadingCore } from "./field-rendering-core";

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

    // Use core rendering function
    return renderHeadingCore({
      container: controlContainer,
      getValue: headingSpec.getValue,
      values: values as Record<string, unknown>,
    });
  },
};
