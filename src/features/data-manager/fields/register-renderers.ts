// src/features/data-manager/fields/register-renderers.ts
// Registers all field renderers with the global registry

import { fieldRendererRegistry } from "./field-renderer-registry";
import { textFieldRenderer } from "./renderer-text";
import { textareaFieldRenderer } from "./renderer-textarea";
import { numberStepperFieldRenderer } from "./renderer-number-stepper";
import { toggleFieldRenderer } from "./renderer-toggle";
import { selectFieldRenderer } from "./renderer-select";
import { multiselectFieldRenderer } from "./renderer-multiselect";
import { colorFieldRenderer } from "./renderer-color";
import { tagsFieldRenderer } from "./renderer-tags-editor";
import { structuredTagsFieldRenderer } from "./renderer-structured-tags-editor";
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
  fieldRendererRegistry.register(toggleFieldRenderer);
  fieldRendererRegistry.register(selectFieldRenderer);
  fieldRendererRegistry.register(multiselectFieldRenderer);
  fieldRendererRegistry.register(colorFieldRenderer);

  // Tag editors
  fieldRendererRegistry.register(tagsFieldRenderer);
  fieldRendererRegistry.register(structuredTagsFieldRenderer);

  // Special fields (used in composite/repeating)
  fieldRendererRegistry.register(displayFieldRenderer);
  fieldRendererRegistry.register(headingFieldRenderer);

  // Complex fields
  fieldRendererRegistry.register(compositeFieldRenderer);
  fieldRendererRegistry.register(autocompleteFieldRenderer);
  fieldRendererRegistry.register(repeatingFieldRenderer);
}
