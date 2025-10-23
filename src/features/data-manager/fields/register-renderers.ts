// src/features/data-manager/fields/register-renderers.ts
// Registers all field renderers with the global registry

import { fieldRendererRegistry } from "./field-renderer-registry";
import { textFieldRenderer } from "./renderer-text";
import { textareaFieldRenderer } from "./renderer-textarea";
import { numberStepperFieldRenderer } from "./renderer-number-stepper";
import { checkboxFieldRenderer } from "./renderer-checkbox";
import { selectFieldRenderer } from "./renderer-select";
import { multiselectFieldRenderer } from "./renderer-multiselect";
import { colorFieldRenderer } from "./renderer-color";
import { tokenFieldRenderer } from "./renderer-tokens";
import { displayFieldRenderer } from "./renderer-display";
import { headingFieldRenderer } from "./renderer-heading";
import { compositeFieldRenderer } from "./renderer-composite";
import { autocompleteFieldRenderer } from "./renderer-autocomplete";
import { repeatingFieldRenderer } from "./renderer-repeating";

/**
 * Register all field renderers with the global registry.
 * This function should be called once during plugin initialization.
 */
export function registerAllFieldRenderers(): void {
  // Simple fields
  fieldRendererRegistry.register(textFieldRenderer);
  fieldRendererRegistry.register(textareaFieldRenderer);
  fieldRendererRegistry.register(numberStepperFieldRenderer);
  fieldRendererRegistry.register(checkboxFieldRenderer);
  fieldRendererRegistry.register(selectFieldRenderer);
  fieldRendererRegistry.register(multiselectFieldRenderer);
  fieldRendererRegistry.register(colorFieldRenderer);

  // Token editor (unified - supports tags, structured-tags, and tokens types)
  fieldRendererRegistry.register(tokenFieldRenderer);

  // Special fields (used in composite/repeating)
  fieldRendererRegistry.register(displayFieldRenderer);
  fieldRendererRegistry.register(headingFieldRenderer);

  // Complex fields
  fieldRendererRegistry.register(compositeFieldRenderer);
  fieldRendererRegistry.register(autocompleteFieldRenderer);
  fieldRendererRegistry.register(repeatingFieldRenderer);
}
