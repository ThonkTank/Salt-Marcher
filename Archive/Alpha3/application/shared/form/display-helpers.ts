/**
 * Display Helper Utilities
 *
 * Helpers for displaying information in forms and panels.
 *
 * @module core/utils/form/display-helpers
 */

import type { LabelValueOptions } from './types';

/**
 * Creates a label-value pair row for displaying information.
 *
 * @example
 * createLabelValuePair(container, 'Terrain', 'Forest');
 */
export function createLabelValuePair(
  container: HTMLElement,
  label: string,
  value: string | undefined,
  options: LabelValueOptions = {}
): HTMLElement | null {
  if (options.skipIfEmpty && !value) return null;

  const row = container.createDiv({ cls: options.labelClass ?? 'info-row' });
  row.style.display = 'flex';
  row.style.justifyContent = 'space-between';
  row.style.padding = '4px 0';

  const labelEl = row.createSpan({ cls: 'info-label' });
  labelEl.style.color = 'var(--text-muted)';
  labelEl.textContent = label;

  const valueEl = row.createSpan({ cls: options.valueClass ?? 'info-value' });
  valueEl.textContent = value ?? '';

  return row;
}

/**
 * Creates a visual divider line.
 */
export function createDivider(container: HTMLElement): HTMLElement {
  const divider = container.createDiv({ cls: 'divider' });
  divider.style.height = '1px';
  divider.style.backgroundColor = 'var(--background-modifier-border)';
  divider.style.margin = '4px 0';
  return divider;
}

/**
 * Creates an empty state hint message.
 *
 * @example
 * createEmptyHint(container, 'Click a tile to inspect', 'inspector-hint');
 */
export function createEmptyHint(
  container: HTMLElement,
  message: string,
  className?: string
): HTMLElement {
  const hint = container.createDiv({ cls: className ?? 'empty-hint' });
  hint.style.color = 'var(--text-muted)';
  hint.style.fontStyle = 'italic';
  hint.style.padding = '8px 0';
  hint.textContent = message;
  return hint;
}
