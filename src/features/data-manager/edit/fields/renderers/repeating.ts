// src/ui/create/renderers/repeating.ts
// Repeating field renderer (entry lists with add/remove/reorder OR template-based lists)

import { Setting } from "obsidian";
import type { FieldRegistryEntry, CompositeFieldSpec, AnyFieldSpec } from "../types";
import { createValidationControls } from "../../modal/modal-utils";
import { resolveInitialValue, renderFieldControl } from "../field-utils";
import { RepeatingWidthSynchronizer } from "../../layout/repeating-width-sync";
import { mountEntryManager, type EntryCategoryDefinition, type EntryFilterDefinition } from "../../storage/entry-system";

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

      // Helper to update computed fields and visibility for an entry
      const updateEntryFields = (
        entryContainer: HTMLElement,
        entry: Record<string, unknown>,
        template: AnyFieldSpec[]
      ) => {
        const fieldWrappers = entryContainer.querySelectorAll<HTMLElement>(
          '.sm-cc-repeating-field'
        );

        fieldWrappers.forEach((wrapper, index) => {
          const fieldSpec = template[index];
          if (!fieldSpec) return;

          // Update visibility
          const isVisible = !fieldSpec.visibleIf || fieldSpec.visibleIf(entry);
          wrapper.toggleClass("is-hidden", !isVisible);

          // Update computed fields (display type)
          if (fieldSpec.type === "display") {
            const displaySpec = fieldSpec as import("../types").DisplayFieldSpec;
            const displayEl = wrapper.querySelector<HTMLInputElement>('.sm-cc-display-field');
            if (displayEl && displaySpec.config?.compute) {
              try {
                const computed = displaySpec.config.compute(entry);
                const prefix = typeof displaySpec.config.prefix === "function"
                  ? displaySpec.config.prefix(entry)
                  : (displaySpec.config.prefix ?? "");
                const suffix = typeof displaySpec.config.suffix === "function"
                  ? displaySpec.config.suffix(entry)
                  : (displaySpec.config.suffix ?? "");
                displayEl.value = `${prefix}${computed}${suffix}`;
              } catch (error) {
                console.warn(`Display field ${fieldSpec.id} compute error:`, error);
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
                entry[fieldSpec.id] = initConfig(entry);
              } catch (error) {
                console.error(`Failed to initialize ${fieldSpec.id}:`, error);
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
              updateEntryFields(entryContainer, entry, fieldTemplate);
            }
          );
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
          updateEntryFields(entryContainer, entry, fieldTemplate);
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
      // ENTRY-MANAGER BASED RENDERING (existing)
      // ═══════════════════════════════════════════════

      // Extract configuration
      const categories = (config.categories as EntryCategoryDefinition<string>[]) ?? [];
      const filters = (config.filters as EntryFilterDefinition<Record<string, unknown>, string>[]) ?? undefined;
      const itemTemplate = repeatingSpec.itemTemplate ?? {};

      // Validate required config
      if (!categories.length) {
        console.warn(`Repeating field "${spec.id}" has no categories defined`);
        const fallback = container.createDiv({ cls: "sm-cc-field--error" });
        fallback.createEl("label", { text: spec.label });
        fallback.createEl("p", { text: "No categories defined for repeating field" });
        return { container: fallback };
      }

      const renderEntry = config.renderEntry as ((container: HTMLElement, context: any) => HTMLElement) | undefined;
      const cardFactory = config.card as ((context: any) => any) | undefined;

      if (!renderEntry && !cardFactory) {
        console.warn(`Repeating field "${spec.id}" requires renderEntry or card in config`);
        const fallback = container.createDiv({ cls: "sm-cc-field--error" });
        fallback.createEl("label", { text: spec.label });
        fallback.createEl("p", { text: "No renderer defined for repeating field" });
        return { container: fallback };
      }

      // Create entry factory from itemTemplate
      const createEntry = (category: string): Record<string, unknown> => {
        const entry: Record<string, unknown> = { category };
        for (const [key, fieldDef] of Object.entries(itemTemplate)) {
          if (fieldDef.default !== undefined) {
            entry[key] = fieldDef.default;
          }
        }
        return entry;
      };

      const handle = mountEntryManager(setting.controlEl, {
        label: "",
        entries,
        categories,
        filters,
        createEntry,
        renderEntry,
        card: cardFactory,
        onEntriesChanged: (updated) => {
          onChange(spec.id, updated);
        },
        insertPosition: (config.insertPosition as "start" | "end") ?? "end",
        hideAddBar: isStatic,
        hideActions: isStatic,
      });

      return {
        setErrors: validation.apply,
        container: setting.settingEl,
        update: (value) => {
          if (Array.isArray(value)) {
            entries.splice(0, entries.length, ...value as Record<string, unknown>[]);
            handle.rerender();
          }
        },
      };
    }
  },
};
