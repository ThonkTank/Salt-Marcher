// src/features/data-manager/field-manager.ts
// Service for managing field instances, rendering, and visibility

import { configurableLogger } from '@services/logging/configurable-logger';

const logger = configurableLogger.forModule("data-manager-field-manager");
import { orderFields } from "../modal/modal-utils";
import { fieldRendererRegistry } from "./field-renderer-registry";
import type { AnyFieldSpec, FieldRenderHandle } from "../../types";
import type { RepeatingWidthSynchronizer } from "../layout/repeating-width-sync";
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
    const values = this.getData();

    // Debug logging for pb field
    if (field.id === 'pb') {
      logger.debug('[field-manager] Rendering pb field');
      logger.debug('[field-manager] values object:', values);
      logger.debug('[field-manager] values["pb"]:', values['pb']);
    }

    const handle = this.renderField(
      container,
      field,
      values,
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

    // Log field state for UI testing
    if (handle.container) {
      setTimeout(() => {
        this.logFieldState(field.id, handle.container!);
      }, 50); // Wait for DOM to settle
    }
  }

  /**
   * Log field state for UI testing purposes.
   */
  private logFieldState(fieldId: string, container: HTMLElement): void {
    const instance = this.fieldInstances.get(fieldId);
    if (!instance) return;

    const inputEl = container.querySelector('input, select, textarea') as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null;

    const state: Record<string, any> = {
      id: fieldId,
      type: instance.spec.type,
      label: instance.spec.label,
      visible: instance.isVisible,
      hasContainer: !!container,
    };

    if (inputEl) {
      state.value = inputEl.value;
      state.width = inputEl.offsetWidth;
      state.height = inputEl.offsetHeight;

      if (inputEl instanceof HTMLSelectElement) {
        state.selectedOption = inputEl.options[inputEl.selectedIndex]?.text;
      }
    }

    // Log chips for tag fields
    const chipsEl = container.querySelector('.sm-cc-chips');
    if (chipsEl) {
      // Use child combinator to select only direct child spans (segments), avoiding nested label/value spans
      const chips = Array.from(chipsEl.querySelectorAll('.sm-cc-chip > span')).map(el => el.textContent);
      state.chips = chips;
      state.chipCount = chips.length;
    }

    // Enhanced logging for tag editors (DOM structure and CSS)
    if (instance.spec.type === 'tags' || instance.spec.type === 'structured-tags') {
      state.domStructure = this.analyzeDOMStructure(container);
      state.gridLayout = this.analyzeGridLayout(container);
    }

    logger.debug('[UI-TEST] Field rendered:', JSON.stringify(state));
  }

  /**
   * Analyze DOM structure for tag editor fields.
   */
  private analyzeDOMStructure(container: HTMLElement): Record<string, any> {
    const structure: Record<string, any> = {
      classes: Array.from(container.classList),
      children: []
    };

    // Analyze direct children
    for (let i = 0; i < container.children.length; i++) {
      const child = container.children[i] as HTMLElement;
      structure.children.push({
        tag: child.tagName.toLowerCase(),
        classes: Array.from(child.classList),
        hasInput: !!child.querySelector('input'),
        hasButton: !!child.querySelector('button'),
        hasChips: !!child.querySelector('.sm-cc-chips'),
      });
    }

    return structure;
  }

  /**
   * Analyze grid layout properties.
   */
  private analyzeGridLayout(container: HTMLElement): Record<string, any> {
    const computed = window.getComputedStyle(container);

    const gridInfo: Record<string, any> = {
      display: computed.display,
      gridTemplateColumns: computed.gridTemplateColumns,
      gridTemplateRows: computed.gridTemplateRows,
      gap: computed.gap,
    };

    // Analyze children positioning
    const children = Array.from(container.children) as HTMLElement[];
    gridInfo.childrenGrid = children.map((child, index) => {
      const childComputed = window.getComputedStyle(child);
      return {
        index,
        classes: Array.from(child.classList),
        gridRow: childComputed.gridRow,
        gridColumn: childComputed.gridColumn,
      };
    });

    return gridInfo;
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
      logger.error("Failed to evaluate field visibility", error);
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
