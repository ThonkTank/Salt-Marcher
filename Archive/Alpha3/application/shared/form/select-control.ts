/**
 * Select Control Builder
 *
 * Creates labeled dropdown controls.
 *
 * @module core/utils/form/select-control
 */

import type { SelectOption } from './types';

/**
 * Creates a labeled select dropdown control.
 *
 * @example
 * createSelectControl(container, 'Tool', TOOLS, state.activeTool, (v) => callbacks.onToolChange(v));
 */
export function createSelectControl<T extends string>(
  container: HTMLElement,
  label: string,
  options: readonly SelectOption<T>[],
  currentValue: T,
  onChange: (value: T) => void
): HTMLSelectElement {
  const group = container.createDiv({ cls: 'setting-item' });
  group.style.display = 'flex';
  group.style.flexDirection = 'column';
  group.style.gap = '2px';

  group.createEl('label', { text: label });
  const select = group.createEl('select');
  select.style.width = '100%';

  for (const opt of options) {
    const optEl = select.createEl('option', { value: opt.value, text: opt.label });
    if (opt.value === currentValue) optEl.selected = true;
  }

  select.addEventListener('change', () => {
    onChange(select.value as T);
  });

  return select;
}
