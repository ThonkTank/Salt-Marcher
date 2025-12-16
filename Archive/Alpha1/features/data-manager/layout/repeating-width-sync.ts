// src/features/data-manager/repeating-width-sync.ts
// Synchronizes widths of identical field types across repeating entries

import { calculateTextWidth } from "../width-utils";

/**
 * Synchronizes widths of identical field types across repeating entries.
 * Groups elements by their field-id attribute and applies max width to all in group.
 */
export class RepeatingWidthSynchronizer {
  private container: HTMLElement;
  private resizeObserver: ResizeObserver;
  private mutationObserver: MutationObserver;

  constructor(container: HTMLElement) {
    this.container = container;

    // Watch for resize events
    this.resizeObserver = new ResizeObserver(() => {
      this.synchronize();
    });
    // Don't start observing immediately - wait for initial auto-sizing to complete

    // Watch for visibility changes (conditional fields with .is-hidden)
    this.mutationObserver = new MutationObserver((mutations) => {
      const hasVisibilityChange = mutations.some(m =>
        m.type === 'attributes' &&
        m.attributeName === 'class' &&
        (m.target as Element).classList.contains('sm-cc-repeating-field')
      );
      if (hasVisibilityChange) {
        this.synchronize();
      }
    });
    this.mutationObserver.observe(container, {
      attributes: true,
      attributeFilter: ['class'],
      subtree: true,
    });

    // Initial sync (deferred to allow rendering to complete)
    setTimeout(() => {
      this.synchronize();
      // Now activate resize observer AFTER initial sync
      this.resizeObserver.observe(this.container);
    }, 0);
  }

  /**
   * Groups elements by their field-id data attribute.
   * All fields with id "score" across entries are grouped together, etc.
   */
  private groupByFieldId(): Map<string, HTMLElement[]> {
    const groups = new Map<string, HTMLElement[]>();

    const items = this.container.querySelectorAll<HTMLElement>('.sm-cc-repeating-item');

    items.forEach(item => {
      const fields = item.querySelectorAll<HTMLElement>('.sm-cc-repeating-field:not(.is-hidden)');

      fields.forEach(field => {
        const fieldId = field.dataset.fieldId;
        if (!fieldId) return;

        // Find label element
        const label = field.querySelector<HTMLElement>('.sm-cc-field-label');
        if (label && label.offsetParent !== null) {
          const key = `${fieldId}__label`;
          if (!groups.has(key)) groups.set(key, []);
          groups.get(key)!.push(label);
        }

        // Find control element (input, display, toggle, etc.)
        const control = field.querySelector<HTMLElement>(
          '.sm-inline-number input, .sm-cc-display-field, .sm-cc-input, .checkbox-container, .sm-cc-field-heading'
        );
        if (control && control.offsetParent !== null) {
          const key = `${fieldId}__control`;
          if (!groups.has(key)) groups.set(key, []);
          groups.get(key)!.push(control);
        }
      });
    });

    return groups;
  }

  private synchronize(): void {
    const groups = this.groupByFieldId();

    for (const [groupKey, elements] of groups.entries()) {
      if (elements.length === 0) continue;

      let maxWidth: number;

      if (groupKey.endsWith('__label')) {
        // For labels, calculate text width using utility (no DOM measurement needed)
        const widths = elements.map(el => {
          const text = el.textContent || '';
          return calculateTextWidth(text, el);
        });
        maxWidth = Math.max(...widths);
      } else {
        // For controls, measure existing auto-sized width
        const widths = elements.map(el => el.getBoundingClientRect().width);
        maxWidth = Math.max(...widths);
      }

      // Apply max width to all elements in group
      elements.forEach(el => {
        if (groupKey.endsWith('__label')) {
          // Labels use min-width to allow natural growth
          el.style.minWidth = `${maxWidth}px`;
        } else {
          // Controls use fixed width
          el.style.width = `${maxWidth}px`;
        }
      });
    }
  }

  destroy(): void {
    this.resizeObserver.disconnect();
    this.mutationObserver.disconnect();
  }
}
