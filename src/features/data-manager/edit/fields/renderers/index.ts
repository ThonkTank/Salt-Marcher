// src/ui/create/renderers/index.ts
// Registers all field renderers with the global registry

import { fieldRendererRegistry } from "../field-renderer-registry";
import { textFieldRenderer } from "./text";
import { textareaFieldRenderer } from "./textarea";
import { numberStepperFieldRenderer } from "./number-stepper";
import { toggleFieldRenderer } from "./toggle";
import { selectFieldRenderer } from "./select";
import { multiselectFieldRenderer } from "./multiselect";
import { colorFieldRenderer } from "./color";
import { tagsFieldRenderer } from "./tags-editor";
import { structuredTagsFieldRenderer } from "./structured-tags-editor";
import { displayFieldRenderer } from "./display";
import { headingFieldRenderer } from "./heading";
import { compositeFieldRenderer } from "./composite";
import { autocompleteFieldRenderer } from "./autocomplete";
import { repeatingFieldRenderer } from "./repeating";

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
