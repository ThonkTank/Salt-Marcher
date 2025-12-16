/**
 * Toggle Control Builders
 *
 * Creates button toggle groups for mutually exclusive selection.
 *
 * @module core/utils/form/toggle-control
 */

import type { SelectOption } from './types';

/**
 * Creates a toggle button group with optional label.
 *
 * @example
 * createButtonToggle(container, 'Mode', [
 *   { value: 'brush', label: 'Brush' },
 *   { value: 'inspector', label: 'Inspector' }
 * ], state.mode, (v) => callbacks.onModeChange(v));
 */
export function createButtonToggle<T extends string>(
  container: HTMLElement,
  label: string | null,
  options: readonly SelectOption<T>[],
  currentValue: T,
  onChange: (value: T) => void
): HTMLElement {
  const group = container.createDiv({ cls: 'setting-item' });
  group.style.display = 'flex';
  group.style.flexDirection = 'column';
  group.style.gap = '2px';

  if (label) {
    group.createEl('label', { text: label });
  }

  const toggle = group.createDiv({ cls: 'button-toggle' });
  toggle.style.display = 'flex';
  toggle.style.gap = '4px';
  toggle.style.flexWrap = 'wrap';

  for (const opt of options) {
    const btn = toggle.createEl('button', { text: opt.label });
    btn.style.flex = '1';
    btn.classList.toggle('mod-cta', opt.value === currentValue);
    btn.addEventListener('click', () => onChange(opt.value));
  }

  return toggle;
}

/**
 * Creates a simple button toggle without label (for mode switches).
 *
 * @example
 * createSimpleButtonToggle(container, [
 *   { value: 'brush', label: 'Brush' },
 *   { value: 'inspector', label: 'Inspector' }
 * ], state.toolMode, (v) => callbacks.onToolModeChange(v));
 */
export function createSimpleButtonToggle<T extends string>(
  container: HTMLElement,
  options: readonly SelectOption<T>[],
  currentValue: T,
  onChange: (value: T) => void
): HTMLElement {
  const group = container.createDiv({ cls: 'setting-item' });
  group.style.display = 'flex';
  group.style.gap = '4px';

  for (const opt of options) {
    const btn = group.createEl('button', { text: opt.label });
    btn.style.flex = '1';
    btn.classList.toggle('mod-cta', opt.value === currentValue);
    btn.addEventListener('click', () => onChange(opt.value));
  }

  return group;
}
