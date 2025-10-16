// src/ui/create/renderers/display.ts
// Display field renderer (computed/read-only fields)

import type { FieldRegistryEntry, DisplayFieldSpec } from "../types";

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

    const displayEl = controlContainer.createEl("input", {
      cls: "sm-cc-display-field",
      attr: {
        type: "text",
        disabled: "true",
        readonly: "true",
      },
    }) as HTMLInputElement;

    if (displaySpec.config.className) {
      displayEl.addClass(displaySpec.config.className);
    }

    return {
      update: (value, all) => {
        try {
          const computed = displaySpec.config.compute(all ?? {});
          const prefixVal = typeof displaySpec.config.prefix === "function"
            ? displaySpec.config.prefix(all ?? {})
            : (displaySpec.config.prefix ?? "");
          const suffixVal = typeof displaySpec.config.suffix === "function"
            ? displaySpec.config.suffix(all ?? {})
            : (displaySpec.config.suffix ?? "");
          displayEl.value = `${prefixVal}${computed}${suffixVal}`;
        } catch (error) {
          console.warn(`Display field ${spec.id} compute error:`, error);
          displayEl.value = "";
        }
      },
    };
  },
};
