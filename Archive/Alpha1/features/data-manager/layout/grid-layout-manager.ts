// src/features/data-manager/grid-layout-manager.ts
// Manages dynamic grid layout for card__body based on field dimensions

import { configurableLogger } from '@services/logging/configurable-logger';

const logger = configurableLogger.forModule("data-manager-grid-layout");
import { FieldWidthCalculator } from "./layout-utils";
import type { AnyFieldSpec } from "../types";

/**
 * Manages dynamic grid layout for card__body based on field dimensions.
 * Automatically calculates optimal column count based on available width and field requirements.
 */
export class GridLayoutManager {
  private container: HTMLElement;
  private fields: AnyFieldSpec[];
  private observer: ResizeObserver;
  private currentPairs: number = 1;

  constructor(container: HTMLElement, fields: AnyFieldSpec[]) {
    this.container = container;
    this.fields = fields;
    this.observer = new ResizeObserver(() => this.recalculate());
    this.observer.observe(container);
    this.recalculate();
  }

  /**
   * Returns true if the current layout uses multiple columns (pairs > 1).
   * Used to determine if label width synchronization should be disabled.
   */
  get isMultiColumn(): boolean {
    return this.currentPairs > 1;
  }

  private measureMaxLabelWidth(): number {
    const labels = this.container.querySelectorAll('.setting-item-info');
    let maxWidth = 0;
    labels.forEach(label => {
      const el = label as HTMLElement;
      if (!el.offsetParent) return; // Skip hidden elements
      const width = el.offsetWidth;
      if (width > maxWidth) maxWidth = width;
    });
    return maxWidth || 100; // Fallback
  }

  private recalculate() {
    const availableWidth = this.container.clientWidth - 30; // Account for padding

    // Filter only normal (non-wide) fields
    const normalFields = this.fields.filter(f => {
      const dims = FieldWidthCalculator.calculate(f);
      return !dims.isWide;
    });

    logger.debug('[GridLayoutManager] Recalculating layout:', {
      totalFields: this.fields.length,
      normalFields: normalFields.length,
      availableWidth,
      fieldTypes: this.fields.map(f => `${f.id}:${f.type}`),
    });

    if (normalFields.length === 0) {
      // Only wide fields → single column
      logger.debug('[GridLayoutManager] No normal fields, using single column');
      this.container.style.gridTemplateColumns = 'max-content 1fr';
      return;
    }

    const labelWidth = this.measureMaxLabelWidth();

    // Find widest minControlWidth among normal fields
    const maxControlWidth = Math.max(
      ...normalFields.map(f => FieldWidthCalculator.calculate(f).minControlWidth)
    );

    const gap = 16; // column-gap in pixels (0.8rem * 2)
    const minPairWidth = labelWidth + gap + maxControlWidth;

    // Calculate optimal number of pairs (1-3)
    let pairs = Math.floor(availableWidth / minPairWidth);
    pairs = Math.max(1, Math.min(pairs, 3)); // Limit to 1-3 pairs

    // Check for fixed-width fields and be more conservative
    const hasFixedWidths = normalFields.some(f =>
      FieldWidthCalculator.calculate(f).hasFixedWidth
    );

    if (hasFixedWidths && pairs > 1) {
      // Add 10% buffer for fixed-width fields
      const safeWidth = (labelWidth + gap + maxControlWidth) * 1.1;
      pairs = Math.floor(availableWidth / safeWidth);
      pairs = Math.max(1, Math.min(pairs, 3));
    }

    // Store current pairs for isMultiColumn getter
    this.currentPairs = pairs;

    // Set grid template dynamically
    const columns = pairs === 1
      ? 'max-content 1fr'
      : `repeat(${pairs}, max-content 1fr)`;

    logger.debug('[GridLayoutManager] Layout calculated:', {
      labelWidth,
      maxControlWidth,
      minPairWidth,
      pairs,
      columns,
      isMultiColumn: this.isMultiColumn,
    });

    this.container.style.gridTemplateColumns = columns;
  }

  destroy() {
    this.observer.disconnect();
  }
}
