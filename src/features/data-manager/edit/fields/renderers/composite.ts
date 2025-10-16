// src/ui/create/renderers/composite.ts
// Composite field renderer (nested fields in a grid/custom layout)

import { Setting } from "obsidian";
import type { FieldRegistryEntry, CompositeFieldSpec, FieldRenderHandle, AnyFieldSpec } from "../types";
import { createValidationControls } from "../../modal/modal-utils";
import { resolveInitialValue, renderFieldControl } from "../field-utils";

export const compositeFieldRenderer: FieldRegistryEntry = {
  supports: (spec) => spec.type === "composite",
  render: (args) => {
    const { container, spec, values, onChange } = args;
    const setting = new Setting(container).setName(spec.label);
    setting.settingEl.addClass("sm-cc-setting");
    if (spec.help) {
      setting.setDesc(spec.help);
    }
    const validation = createValidationControls(setting);
    const initial = resolveInitialValue(spec, values);

    const compositeSpec = spec as CompositeFieldSpec;
    const config = compositeSpec.config ?? {};
    const childFields = (config.fields as Array<Partial<import("../types").FieldSpec>>) ?? compositeSpec.children ?? [];

    // Create container for composite fields
    setting.settingEl.addClass("sm-cc-composite");
    setting.settingEl.addClass("sm-cc-setting--wide");

    // Check if fields should be grouped by prefix (e.g., "str", "dex" for abilities)
    const groupBy = (config as any).groupBy as string[] | undefined;
    const useGrouping = Boolean(groupBy && groupBy.length > 0);

    const compositeContainer = setting.controlEl.createDiv({
      cls: useGrouping ? "sm-cc-composite-grouped" : "sm-cc-composite-grid"
    });

    // Get current composite value
    const compositeValue = (values[spec.id] as Record<string, unknown>) ?? {};

    // Track child field instances with visibility and initialization state
    interface ChildFieldInstance {
      id: string;
      spec: AnyFieldSpec;
      handle: FieldRenderHandle;
      wrapper: HTMLElement;
      wasVisible: boolean;
      initialized: boolean;
    }
    const childInstances: ChildFieldInstance[] = [];

    // Helper to evaluate visibility for a child field
    const evaluateChildVisibility = (childSpec: AnyFieldSpec): boolean => {
      if (!childSpec.visibleIf) return true;
      try {
        return childSpec.visibleIf(compositeValue);
      } catch (error) {
        console.error(`Failed to evaluate visibility for ${childSpec.id}:`, error);
        return true;
      }
    };

    // Helper to update child field visibility
    const updateChildVisibility = () => {
      for (const child of childInstances) {
        const shouldBeVisible = evaluateChildVisibility(child.spec);

        if (shouldBeVisible !== child.wasVisible) {
          child.wrapper.toggleClass("is-hidden", !shouldBeVisible);
          child.wasVisible = shouldBeVisible;

          // Auto-initialize fields when they become visible for the first time
          if (shouldBeVisible && !child.initialized) {
            child.initialized = true;
            // If field has an init config, use it to set initial value
            const initConfig = (child.spec.config as any)?.init;
            if (initConfig && typeof initConfig === "function") {
              try {
                const initValue = initConfig(compositeValue);
                compositeValue[child.id] = initValue;
                child.handle.update?.(initValue, compositeValue);
                onChange(spec.id, compositeValue);
              } catch (error) {
                console.error(`Failed to initialize ${child.id}:`, error);
              }
            }
          }
        }
      }
    };

    // Group fields if groupBy is specified
    if (useGrouping && groupBy) {
      // Create a group container for each prefix
      for (const groupPrefix of groupBy) {
        const groupContainer = compositeContainer.createDiv({ cls: "sm-cc-composite-group" });

        // Find all fields that belong to this group (start with the prefix)
        const groupFields = childFields.filter(field =>
          field.id === groupPrefix || field.id?.startsWith(`${groupPrefix}`)
        );

        // Render each field in this group
        for (const childDef of groupFields) {
          const childId = childDef.id ?? "";
          const childSpec: AnyFieldSpec = {
            id: childId,
            label: childDef.label ?? childId,
            type: childDef.type ?? "text",
            ...childDef,
          };

          // Create wrapper for this child control
          const childWrapper = groupContainer.createDiv({ cls: "sm-cc-composite-item" });

          // Get initial value for this child
          const childInitial = compositeValue[childId] ?? childSpec.default;

          const childHandle = renderFieldControl(
            childWrapper,
            childSpec,
            childInitial,
            (childValue) => {
              // Update nested value in parent
              const currentValue = (values[spec.id] as Record<string, unknown>) ?? {};
              const oldValue = currentValue[childId];
              currentValue[childId] = childValue;
              onChange(spec.id, currentValue);

              // Update visibility when values change (only if value actually changed)
              if (oldValue !== childValue) {
                updateChildVisibility();
              }
            }
          );

          // Check initial visibility
          const initiallyVisible = evaluateChildVisibility(childSpec);
          childWrapper.toggleClass("is-hidden", !initiallyVisible);

          childInstances.push({
            id: childId,
            spec: childSpec,
            handle: childHandle,
            wrapper: childWrapper,
            wasVisible: initiallyVisible,
            initialized: initiallyVisible, // Mark as initialized if initially visible
          });
        }
      }
    } else {
      // Render each child field using renderFieldControl (no nested Settings, no grouping)
      for (const childDef of childFields) {
        const childId = childDef.id ?? "";
        const childSpec: AnyFieldSpec = {
          id: childId,
          label: childDef.label ?? childId,
          type: childDef.type ?? "text",
          ...childDef,
        };

        // Create wrapper for this child control
        const childWrapper = compositeContainer.createDiv({ cls: "sm-cc-composite-item" });

        // Get initial value for this child
        const childInitial = compositeValue[childId] ?? childSpec.default;

        const childHandle = renderFieldControl(
          childWrapper,
          childSpec,
          childInitial,
          (childValue) => {
            // Update nested value in parent
            const currentValue = (values[spec.id] as Record<string, unknown>) ?? {};
            const oldValue = currentValue[childId];
            currentValue[childId] = childValue;
            onChange(spec.id, currentValue);

            // Update visibility when values change (only if value actually changed)
            if (oldValue !== childValue) {
              updateChildVisibility();
            }
          }
        );

        // Check initial visibility
        const initiallyVisible = evaluateChildVisibility(childSpec);
        childWrapper.toggleClass("is-hidden", !initiallyVisible);

        childInstances.push({
          id: childId,
          spec: childSpec,
          handle: childHandle,
          wrapper: childWrapper,
          wasVisible: initiallyVisible,
          initialized: initiallyVisible, // Mark as initialized if initially visible
        });
      }
    }

    return {
      setErrors: validation.apply,
      container: setting.settingEl,
      update: (value) => {
        if (typeof value === "object" && value !== null) {
          // Update all child fields
          const valueMap = value as Record<string, unknown>;
          for (const child of childInstances) {
            child.handle.update?.(valueMap[child.id], valueMap);
          }
          // Update visibility after updating values
          updateChildVisibility();
        }
      },
    };
  },
};
