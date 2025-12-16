/**
 * Form Builder Utilities
 *
 * Reusable form control creators for Obsidian views.
 * Eliminates duplicate form creation code across views.
 *
 * @module adapters/shared/form-builders
 */

// ============================================================================
// Types
// ============================================================================

export interface SelectOption<T extends string = string> {
	value: T;
	label: string;
}

export interface SliderConfig {
	min: number;
	max: number;
	step: number;
	value: number;
}

export interface LabelValueOptions {
	skipIfEmpty?: boolean;
	labelClass?: string;
	valueClass?: string;
}

// ============================================================================
// Select Controls
// ============================================================================

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
	group.style.gap = '4px';

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

// ============================================================================
// Slider Controls
// ============================================================================

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
	group.style.gap = '4px';

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

// ============================================================================
// Toggle Controls
// ============================================================================

/**
 * Creates a toggle button group (mutually exclusive selection).
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
	group.style.gap = '4px';

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
 * Creates a simple button toggle without label (for tool mode switches).
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

// ============================================================================
// Info Display
// ============================================================================

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
 * Creates a stacked label-value field (label above value).
 *
 * @example
 * createStackedField(container, 'Type', 'Beast');
 */
export function createStackedField(
	container: HTMLElement,
	label: string,
	value: string | undefined,
	options: LabelValueOptions = {}
): HTMLElement | null {
	if (options.skipIfEmpty && !value) return null;

	const fieldEl = container.createDiv({ cls: options.labelClass ?? 'field' });

	const labelEl = fieldEl.createDiv({ text: label });
	labelEl.style.fontSize = '0.85em';
	labelEl.style.color = 'var(--text-muted)';

	const valueEl = fieldEl.createDiv({ text: value ?? '' });
	valueEl.style.fontWeight = '500';

	return fieldEl;
}
