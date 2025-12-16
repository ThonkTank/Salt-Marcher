/**
 * Slider Control Builder
 *
 * Creates labeled slider controls with synchronized number input.
 *
 * @module core/utils/form/slider-control
 */

import type { SliderConfig } from './types';

/**
 * Creates a labeled slider with synchronized number input.
 *
 * @example
 * createSliderWithInput(container, 'Radius', { min: 1, max: 10, step: 1, value: 3 }, (v) => callbacks.onRadiusChange(v));
 */
export function createSliderWithInput(
  container: HTMLElement,
  label: string,
  config: SliderConfig,
  onChange: (value: number) => void
): { slider: HTMLInputElement; numberInput: HTMLInputElement } {
  const { min, max, step, value } = config;

  const group = container.createDiv({ cls: 'setting-item' });
  group.style.display = 'flex';
  group.style.flexDirection = 'column';
  group.style.gap = '2px';

  group.createEl('label', { text: label });

  // Row container for slider + number input
  const inputRow = group.createDiv({ cls: 'slider-input-row' });
  inputRow.style.display = 'flex';
  inputRow.style.gap = '8px';
  inputRow.style.alignItems = 'center';

  // Range slider
  const slider = inputRow.createEl('input', { type: 'range' });
  slider.min = String(min);
  slider.max = String(max);
  slider.step = String(step);
  slider.value = String(value);
  slider.style.flex = '1';

  // Number input
  const numberInput = inputRow.createEl('input', { type: 'number' });
  numberInput.min = String(min);
  numberInput.max = String(max);
  numberInput.step = String(step);
  numberInput.value = String(value);
  numberInput.style.width = '55px';
  numberInput.style.textAlign = 'right';

  // Helper to parse, clamp, and round
  const parseAndClamp = (input: string): number => {
    const parsed = parseFloat(input);
    if (isNaN(parsed)) return min;
    const clamped = Math.max(min, Math.min(max, parsed));
    return Math.round(clamped / step) * step;
  };

  // Slider -> Number sync
  slider.addEventListener('input', () => {
    const v = parseAndClamp(slider.value);
    numberInput.value = String(v);
    onChange(v);
  });

  // Number -> Slider sync
  numberInput.addEventListener('input', () => {
    const v = parseAndClamp(numberInput.value);
    slider.value = String(v);
    onChange(v);
  });

  // Final validation on blur
  numberInput.addEventListener('blur', () => {
    const v = parseAndClamp(numberInput.value);
    numberInput.value = String(v);
  });

  return { slider, numberInput };
}
