/**
 * Button Control Utilities
 *
 * Reusable button builders for Obsidian views.
 *
 * @module core/utils/form/button-control
 */

import { setIcon } from 'obsidian';

export interface IconButtonOptions {
  /** Primary action styling (call-to-action) */
  primary?: boolean;
  /** Danger/destructive action styling */
  danger?: boolean;
  /** Additional CSS class */
  className?: string;
  /** Tooltip text */
  tooltip?: string;
}

/**
 * Creates a button with an icon and text.
 *
 * @example
 * createIconButton(container, 'Start', 'play', () => start(), { primary: true });
 */
export function createIconButton(
  parent: HTMLElement,
  text: string,
  icon: string,
  onClick: () => void,
  options: IconButtonOptions = {}
): HTMLButtonElement {
  const classes = [options.className ?? 'icon-button'];
  if (options.primary) classes.push('mod-cta');
  if (options.danger) classes.push('mod-warning');

  const button = parent.createEl('button', {
    cls: classes.filter(Boolean),
    attr: options.tooltip ? { 'aria-label': options.tooltip, title: options.tooltip } : {},
  });

  // Button styling
  button.style.display = 'inline-flex';
  button.style.alignItems = 'center';
  button.style.gap = '4px';
  button.style.padding = '6px 12px';
  button.style.cursor = 'pointer';

  // Icon
  const iconEl = button.createSpan();
  setIcon(iconEl, icon);

  // Text
  if (text) {
    button.createSpan({ text });
  }

  button.addEventListener('click', onClick);
  return button;
}

/**
 * Creates a flex container for grouping buttons.
 *
 * @example
 * const group = createButtonGroup(container);
 * createIconButton(group, 'Save', 'save', onSave, { primary: true });
 * createIconButton(group, 'Cancel', 'x', onCancel);
 */
export function createButtonGroup(
  parent: HTMLElement,
  className?: string
): HTMLElement {
  const group = parent.createDiv({ cls: className ?? 'button-group' });
  group.style.display = 'flex';
  group.style.gap = '8px';
  group.style.flexWrap = 'wrap';
  return group;
}
