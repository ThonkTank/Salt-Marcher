// src/ui/create/field-manager.ts
// Service for managing field instances, rendering, and visibility

import { fieldRendererRegistry } from "./field-renderer-registry";
import { RepeatingWidthSynchronizer } from "../layout/repeating-width-sync";
import { orderFields } from "../modal/modal-utils";
import type { AnyFieldSpec, FieldRenderHandle } from "../../types";
import type { FieldInstance } from "../modal/modal-validator";

/**
 * Service responsible for field instance management.
 * Handles field rendering, visibility updates, and error state.
 */
export class FieldManager {
  private readonly fieldInstances = new Map<string, FieldInstance>();

  constructor(
    private fields: AnyFieldSpec[],
    private getData: () => Record<string, unknown>,
    private onChange: (id: string, value: unknown) => void,
    private widthSynchronizers: RepeatingWidthSynchronizer[]
  ) {}

  /**
   * Render fields in container, optionally filtered by fieldIds.
   * If fieldIds is undefined, renders all fields.
   */
  renderFields(container: HTMLElement, fieldIds: string[] | undefined): void {
    const ordered = orderFields(this.fields, fieldIds);
    for (const field of ordered) {
      this.renderSingleField(container, field);
    }
    this.updateVisibility();
  }

  /**
   * Render a single field and register its instance.
   */
  private renderSingleField(container: HTMLElement, field: AnyFieldSpec): void {
    const handle = this.renderField(
      container,
      field,
      this.getData(),
      (id, value) => this.onChange(id, value),
    );

    // Register width synchronizer if returned
    if (handle.synchronizer) {
      this.widthSynchronizers.push(handle.synchronizer);
    }

    this.fieldInstances.set(field.id, {
      spec: field,
      handle: {
        setErrors: handle.setErrors
      },
      container: handle.container,
      isVisible: true,
    });
  }

  /**
   * Render field using registry.
   * Internal wrapper around fieldRendererRegistry.render().
   */
  private renderField(
    container: HTMLElement,
    spec: AnyFieldSpec,
    values: Record<string, unknown>,
    onChange: (id: string, value: unknown) => void,
  ): FieldRenderHandle & { setErrors?: (errors: string[]) => void; container?: HTMLElement; synchronizer?: RepeatingWidthSynchronizer } {
    return fieldRendererRegistry.render({
      app: null as any, // App not needed for current renderers
      container,
      spec,
      values,
      onChange,
      registerValidator: () => {}, // Not used in this context
    });
  }

  /**
   * Update visibility of all fields based on visibleIf conditions.
   */
  updateVisibility(): void {
    const data = this.getData();
    for (const [id, instance] of this.fieldInstances) {
      const visible = this.evaluateVisibility(instance.spec, data);
      instance.isVisible = visible;
      const target = instance.container;
      if (target) {
        target.toggleClass("is-hidden", !visible);
        if (!visible) {
          instance.handle.setErrors?.([]);
        }
      }
    }
  }

  /**
   * Evaluate visibility condition for a field.
   */
  private evaluateVisibility(field: AnyFieldSpec, data: Record<string, unknown>): boolean {
    if (!field.visibleIf) return true;
    try {
      return field.visibleIf(data);
    } catch (error) {
      console.error("Failed to evaluate field visibility", error);
      return true;
    }
  }

  /**
   * Get the field instances map (for validator integration).
   */
  getFieldInstances(): Map<string, FieldInstance> {
    return this.fieldInstances;
  }

  /**
   * Cleanup field instances.
   */
  dispose(): void {
    this.fieldInstances.clear();
  }
}
