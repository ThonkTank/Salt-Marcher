// src/features/data-manager/renderers/repeating.ts
// Repeating field renderer (entry lists with add/remove/reorder OR template-based lists)

import { Setting } from "obsidian";
import { debugLogger } from "@services/logging/debug-logger";
import { configurableLogger } from '@services/logging/configurable-logger';

const logger = configurableLogger.forModule("data-manager-repeating-renderer");
import { RepeatingWidthSynchronizer } from "../layout/repeating-width-sync";
import { createValidationControls } from "../modal/modal-utils";
import { mountEntryManager, type EntryCategoryDefinition, type EntryFilterDefinition } from "../storage/entry-system";
import { renderRepeatingEntryManagerCore } from "./field-rendering-core";
import { resolveInitialValue, renderFieldControl } from "./field-utils";
import type { FieldRegistryEntry, CompositeFieldSpec, AnyFieldSpec, FieldRenderHandle } from "../../types";

export const repeatingFieldRenderer: FieldRegistryEntry = {
  supports: (spec) => spec.type === "repeating",
  render: (args) => {
    const { container, spec, values, onChange } = args;
    const setting = new Setting(container).setName(spec.label);
    setting.settingEl.addClass("sm-cc-setting");
    if (spec.help) {
      setting.setDesc(spec.help);
    }
    const validation = createValidationControls(setting);
    const initial = resolveInitialValue(spec, values);

    setting.settingEl.addClass("sm-cc-setting--wide");
    const repeatingSpec = spec as CompositeFieldSpec;
    const config = repeatingSpec.config ?? {};

    // Get or initialize entries array
    const entries = Array.isArray(values[spec.id])
      ? [...(values[spec.id] as Record<string, unknown>[])]
      : Array.isArray(spec.default)
        ? [...(spec.default as Record<string, unknown>[])]
        : [];

    // Check if template-based rendering (has fields array)
    const isTemplateMode = Boolean(config.fields && config.fields.length > 0);
    const isStatic = Boolean(config.static);

    if (isTemplateMode) {
      // ═══════════════════════════════════════════════
      // TEMPLATE-BASED RENDERING
      // ═══════════════════════════════════════════════
      setting.settingEl.addClass("sm-cc-repeating-list");

      const listContainer = setting.controlEl.createDiv({
        cls: "sm-cc-repeating-fields"
      });

      const fieldTemplate = config.fields!; // Template: defined once

      // Track field handles for each entry (needed for auto-initialization)
      const fieldHandles = new Map<string, FieldRenderHandle>();

      // Helper to update computed fields and visibility for an entry
      const updateEntryFields = (
        entryContainer: HTMLElement,
        entry: Record<string, unknown>,
        template: AnyFieldSpec[],
        allFormData: Record<string, unknown>
      ) => {
        const fieldWrappers = entryContainer.querySelectorAll<HTMLElement>(
          '.sm-cc-repeating-field'
        );

        fieldWrappers.forEach((wrapper, index) => {
          const fieldSpec = template[index];
          if (!fieldSpec) return;

          // Track visibility change to detect when field becomes visible
          const wasVisible = !wrapper.hasClass("is-hidden");
          const isVisible = !fieldSpec.visibleIf || fieldSpec.visibleIf(entry);
          wrapper.toggleClass("is-hidden", !isVisible);

          debugLogger.logField(fieldSpec.id, "visibility", "Field visibility check", {
            wasVisible,
            isVisible,
            currentValue: entry[fieldSpec.id]
          });

          // Auto-initialize field when it becomes visible for the first time
          if (!wasVisible && isVisible && entry[fieldSpec.id] === undefined) {
            debugLogger.logField(fieldSpec.id, "init", "Field became visible, checking init function");
            const initConfig = (fieldSpec.config as any)?.init;
            if (initConfig && typeof initConfig === "function") {
              try {
                debugLogger.logField(fieldSpec.id, "init", "Calling init function", entry);
                const initValue = initConfig(entry, allFormData);
                debugLogger.logField(fieldSpec.id, "init", "Init function returned", { initValue });
                entry[fieldSpec.id] = initValue;

                // Update the field control using its handle
                const handleKey = `${wrapper.closest('.sm-cc-repeating-item')?.getAttribute('data-entry-index')}-${fieldSpec.id}`;
                debugLogger.logField(fieldSpec.id, "init", "Looking for handle", { handleKey });
                const handle = fieldHandles.get(handleKey);
                if (handle?.update) {
                  debugLogger.logField(fieldSpec.id, "init", "Found handle, calling update()", { initValue });
                  handle.update(initValue, entry);
                } else {
                  debugLogger.logField(fieldSpec.id, "init", "No handle found - WARNING", { handleKey });
                  logger.warn(`No handle found for key: "${handleKey}"`);
                }
              } catch (error) {
                logger.error(`Failed to initialize ${fieldSpec.id}:`, error);
              }
            } else {
              debugLogger.logField(fieldSpec.id, "init", "No init function configured");
            }
          }

          // Update computed fields (display type)
          if (fieldSpec.type === "display") {
            const displaySpec = fieldSpec as import("../types").DisplayFieldSpec;
            const displayEl = wrapper.querySelector<HTMLInputElement>('.sm-cc-display-field');
            if (displayEl && displaySpec.config?.compute) {
              try {
                const computed = displaySpec.config.compute(entry, allFormData);
                const prefix = typeof displaySpec.config.prefix === "function"
                  ? displaySpec.config.prefix(entry, allFormData)
                  : (displaySpec.config.prefix ?? "");
                const suffix = typeof displaySpec.config.suffix === "function"
                  ? displaySpec.config.suffix(entry, allFormData)
                  : (displaySpec.config.suffix ?? "");
                displayEl.value = `${prefix}${computed}${suffix}`;
              } catch (error) {
                logger.warn(`Display field ${fieldSpec.id} compute error:`, error);
                displayEl.value = "";
              }
            }
          }
        });
      };

      // Render each entry with the template
      entries.forEach((entry, entryIndex) => {
        const entryContainer = listContainer.createDiv({
          cls: "sm-cc-repeating-item",
          attr: { "data-entry-index": String(entryIndex) }
        });

        // Render each field in the template
        fieldTemplate.forEach((fieldSpec, fieldIndex) => {
          const fieldWrapper = entryContainer.createDiv({
            cls: `sm-cc-repeating-field sm-cc-repeating-field--${fieldSpec.type}`,
            attr: { "data-field-id": fieldSpec.id }
          });

          // Check initial visibility
          const isVisible = !fieldSpec.visibleIf || fieldSpec.visibleIf(entry);
          if (!isVisible) {
            fieldWrapper.addClass("is-hidden");
          }

          // Auto-initialize field if it has init config and is visible
          if (isVisible && entry[fieldSpec.id] === undefined) {
            const initConfig = (fieldSpec.config as any)?.init;
            if (initConfig && typeof initConfig === "function") {
              try {
                entry[fieldSpec.id] = initConfig(entry, values);
              } catch (error) {
                logger.error(`Failed to initialize ${fieldSpec.id}:`, error);
              }
            }
          }

          // Render the field control
          const fieldHandle = renderFieldControl(
            fieldWrapper,
            fieldSpec,
            // For heading fields, pass entire entry object so getValue can access any property
            // For other fields, pass the specific field value
            fieldSpec.type === "heading" ? entry : entry[fieldSpec.id],
            (newValue) => {
              // Update entry value
              entry[fieldSpec.id] = newValue;
              onChange(spec.id, [...entries]);

              // Update computed fields and visibility
              updateEntryFields(entryContainer, entry, fieldTemplate, values);
            },
            values  // Pass formData so nested fields can access it
          );

          // Store the handle for later use in updateEntryFields
          const handleKey = `${entryIndex}-${fieldSpec.id}`;
          fieldHandles.set(handleKey, fieldHandle);
        });
      });

      // Activate width synchronization if requested
      let synchronizer: RepeatingWidthSynchronizer | undefined;
      if (config.synchronizeWidths) {
        synchronizer = new RepeatingWidthSynchronizer(listContainer);
      }

      // Initialize display fields with computed values
      entries.forEach((entry, entryIndex) => {
        const entryContainer = listContainer.children[entryIndex] as HTMLElement;
        if (entryContainer) {
          updateEntryFields(entryContainer, entry, fieldTemplate, values);
        }
      });

      return {
        setErrors: validation.apply,
        container: setting.settingEl,
        synchronizer,
        update: (value) => {
          if (Array.isArray(value)) {
            // Update entries and re-render (simplified approach)
            entries.splice(0, entries.length, ...value as Record<string, unknown>[]);
            // Full re-render would be needed here
            // For now, just update the data
          }
        },
      };
    } else {
      // ═══════════════════════════════════════════════
      // ENTRY-MANAGER BASED RENDERING
      // ═══════════════════════════════════════════════

      // Extract configuration
      const categories = (config.categories as EntryCategoryDefinition<string>[]) ?? [];
      const filters = (config.filters as EntryFilterDefinition<Record<string, unknown>, string>[]) ?? undefined;
      const itemTemplate = repeatingSpec.itemTemplate ?? {};
      const renderEntry = config.renderEntry as ((container: HTMLElement, context: any) => HTMLElement) | undefined;
      const cardFactory = config.card as ((context: any) => any) | undefined;

      // Use core rendering function
      const handle = renderRepeatingEntryManagerCore({
        container: setting.controlEl,
        entries,
        categories,
        filters,
        itemTemplate,
        renderEntry,
        card: cardFactory,
        onChange: (updated) => onChange(spec.id, updated),
        insertPosition: (config.insertPosition as "start" | "end") ?? "end",
        isStatic,
        mountEntryManager,
        fieldId: spec.id,
      });

      // Handle validation errors from core
      if ('error' in handle && handle.error) {
        const fallback = container.createDiv({ cls: "sm-cc-field--error" });
        fallback.createEl("label", { text: spec.label });
        return { container: fallback };
      }

      return {
        setErrors: validation.apply,
        container: setting.settingEl,
        update: handle.update,
      };
    }
  },
};
