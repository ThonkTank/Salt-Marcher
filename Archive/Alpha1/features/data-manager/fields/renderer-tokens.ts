// src/features/data-manager/fields/renderer-tokens.ts
// Modular token field renderer with inline editing

import { Setting } from "obsidian";
import { configurableLogger } from '@services/logging/configurable-logger';

const logger = configurableLogger.forModule("data-manager-tokens-renderer");
import { createValidationControls } from "../modal/modal-utils";
import {
  renderTokenFieldCore,
  type ModularTokenFieldCoreOptions,
} from "./field-rendering-core";
import type { FieldRegistryEntry, TokenFieldSpec } from "../types";

/**
 * Modular token field renderer
 * Supports flexible token structures with inline-editable segments
 */
export const tokenFieldRenderer: FieldRegistryEntry = {
  supports: (spec) => {
    return spec.type === "tokens";
  },

  render: (args) => {
    const { container, spec, values, onChange } = args;
    const tokenSpec = spec as TokenFieldSpec;

    // Create setting container
    const setting = new Setting(container).setName(spec.label);
    setting.settingEl.addClass("sm-cc-setting");
    setting.settingEl.addClass("sm-cc-setting--wide");
    setting.settingEl.addClass("sm-cc-setting--token-editor");

    if (spec.help) {
      setting.setDesc(spec.help);
    }

    const validation = createValidationControls(setting);

    // Initialize token values
    const currentValue = values[spec.id];
    logger.debug(`[TokenRenderer] Field "${spec.id}" currentValue type: ${typeof currentValue}, isArray: ${Array.isArray(currentValue)}, value:`, JSON.stringify(currentValue, null, 2));
    const tokenValues: Array<Record<string, unknown>> = Array.isArray(currentValue)
      ? currentValue as Array<Record<string, unknown>>
      : (Array.isArray(spec.default) ? spec.default as Array<Record<string, unknown>> : []);
    logger.debug(`[TokenRenderer] Field "${spec.id}" tokenValues:`, JSON.stringify(tokenValues, null, 2));

    // Prepare options for modular token renderer
    const coreOptions: ModularTokenFieldCoreOptions = {
      container: setting.controlEl,
      fields: tokenSpec.config.fields,
      primaryField: tokenSpec.config.primaryField,
      value: tokenValues,
      chipTemplate: tokenSpec.config.chipTemplate,
      getInitialValue: tokenSpec.config.getInitialValue,
      formData: values,
      onTokenFieldChange: tokenSpec.config.onTokenFieldChange,
      onChange: (newValue) => {
        logger.debug(`[TokenRenderer] onChange called for field "${spec.id}":`, JSON.stringify(newValue, null, 2));
        tokenValues.splice(0, tokenValues.length, ...newValue);
        onChange(spec.id, [...newValue]);
        logger.debug(`[TokenRenderer] onChange propagated to modal system`);
      },
    };

    // Render using modular core function
    const handle = renderTokenFieldCore(coreOptions);

    // Insert chips container into setting for grid layout
    setting.settingEl.appendChild(handle.chipsContainer);

    return {
      setErrors: validation.apply,
      container: setting.settingEl,
      update: (value) => {
        tokenValues.splice(0, tokenValues.length);
        if (Array.isArray(value)) {
          tokenValues.push(...(value as Array<Record<string, unknown>>));
        }
        handle.refresh();
      },
    };
  },
};

