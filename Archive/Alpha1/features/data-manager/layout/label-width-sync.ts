// src/features/data-manager/layout/label-width-sync.ts
// Synchronizes label widths of wide fields to match normal field labels

import { configurableLogger } from '@services/logging/configurable-logger';

const logger = configurableLogger.forModule("data-manager-label-width");
import { calculateTextWidth } from "../width-utils";

/**
 * Synchronizes label widths across normal and wide fields to ensure consistent alignment.
 *
 * Targets:
 * - Normal field labels (.setting-item-info) - part of parent grid
 * - Token field labels (.setting-item-info) - in their own grid
 *
 * Does NOT target:
 * - Repeating field column labels (.sm-cc-field-label) - different structure
 *
 * Works cooperatively with GridLayoutManager:
 * - GridLayoutManager handles multi-column layout for normal fields
 * - This synchronizer ensures all .setting-item-info labels have matching widths
 *   even when some are in the parent grid and others in separate grids (token fields)
 *
 * This ensures consistent label alignment across normal and wide fields in mixed sections.
 */
export class LabelWidthSynchronizer {
  private container: HTMLElement;
  private resizeObserver: ResizeObserver;
  private isMultiColumn: boolean;

  constructor(container: HTMLElement, isMultiColumn: boolean) {
    this.container = container;
    this.isMultiColumn = isMultiColumn;

    // Watch for resize events
    this.resizeObserver = new ResizeObserver(() => {
      this.synchronize();
    });

    // Initial sync (deferred to allow rendering AND GridLayoutManager to complete)
    setTimeout(() => {
      this.synchronize();
      // Activate resize observer AFTER initial sync
      this.resizeObserver.observe(this.container);
    }, 100); // Increased delay to ensure GridLayoutManager runs first
  }

  private synchronize(): void {
    if (this.isMultiColumn) {
      this.synchronizeMultiColumn();
    } else {
      this.synchronizeSingleColumn();
    }
  }

  private synchronizeSingleColumn(): void {
    // Single-column: synchronize ALL .setting-item-info labels
    const allLabels = Array.from(
      this.container.querySelectorAll<HTMLElement>('.setting-item-info')
    ).filter(label => label.offsetParent);

    if (allLabels.length === 0) return;

    logger.debug('[LabelWidthSync] Single-column: Found', allLabels.length, 'labels');

    // Calculate text width for each label (no DOM measurement needed)
    const widths = allLabels.map(label => {
      const text = label.textContent || '';
      return calculateTextWidth(text, label);
    });
    const maxWidth = Math.max(...widths);
    logger.debug('[LabelWidthSync] Single-column: max width:', maxWidth);

    // Apply to all
    if (maxWidth > 0) {
      allLabels.forEach(label => { label.style.minWidth = `${maxWidth}px`; });
      logger.debug('[LabelWidthSync] Single-column: Applied to', allLabels.length, 'labels');
    }
  }

  private synchronizeMultiColumn(): void {
    // Multi-column: CSS Grid auto-syncs normal fields per column
    // We only need to sync token field labels with first column

    // Find token field labels
    const tokenLabels = Array.from(
      this.container.querySelectorAll<HTMLElement>(
        '.sm-cc-setting--token-editor .setting-item-info'
      )
    ).filter(label => label.offsetParent);

    if (tokenLabels.length === 0) {
      logger.debug('[LabelWidthSync] Multi-column: No token labels found');
      return;
    }

    // Find normal field labels (not token fields)
    const normalLabels = Array.from(
      this.container.querySelectorAll<HTMLElement>('.setting-item-info')
    ).filter(label => {
      if (!label.offsetParent) return false;
      const parent = label.closest('.sm-cc-setting');
      return parent && !parent.classList.contains('sm-cc-setting--token-editor');
    });

    if (normalLabels.length === 0) {
      // No normal labels: synchronize token labels with each other
      logger.debug('[LabelWidthSync] Multi-column: No normal labels, syncing token labels with each other');

      // Calculate text width for each token label
      const widths = tokenLabels.map(label => {
        const text = label.textContent || '';
        return calculateTextWidth(text, label);
      });
      const maxTokenWidth = Math.max(...widths);
      logger.debug('[LabelWidthSync] Multi-column: max token label width:', maxTokenWidth);

      // Apply to all token labels
      if (maxTokenWidth > 0) {
        tokenLabels.forEach(label => { label.style.minWidth = `${maxTokenWidth}px`; });
        logger.debug('[LabelWidthSync] Multi-column: Applied', maxTokenWidth, 'px to', tokenLabels.length, 'token labels');
      }
      return;
    }

    // Normal labels exist: synchronize token labels with normal labels
    logger.debug('[LabelWidthSync] Multi-column: Found', tokenLabels.length, 'token labels,', normalLabels.length, 'normal labels');

    // Measure actual rendered width of normal labels (CSS Grid already sized them per column)
    const maxNormalWidth = Math.max(...normalLabels.map(l => l.getBoundingClientRect().width));
    logger.debug('[LabelWidthSync] Multi-column: max normal label width:', maxNormalWidth);

    // Apply to token labels only
    if (maxNormalWidth > 0) {
      tokenLabels.forEach(label => { label.style.minWidth = `${maxNormalWidth}px`; });
      logger.debug('[LabelWidthSync] Multi-column: Applied', maxNormalWidth, 'px to', tokenLabels.length, 'token labels');
    }
  }

  destroy(): void {
    this.resizeObserver.disconnect();
  }
}
