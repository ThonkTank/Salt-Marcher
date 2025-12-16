/**
 * Minimal Form Builder DSL for Cartographer tool panels
 *
 * Provides declarative UI construction with common control types:
 * - header, hint, section
 * - brush-mode-toggle (Paint/Erase radio buttons)
 * - radius-slider (1-6 range with value display)
 * - checkbox, select, color-picker
 * - button, button-group
 * - radio-group (mutually exclusive options)
 *
 * v2 Features (opt-in):
 * - Validation: required fields, custom validators
 * - State binding: automatic sync with external state
 * - Conditional visibility: dynamic show/hide based on conditions
 *
 * @example
 * ```typescript
 * const form = buildForm(container, {
 *   sections: [
 *     { kind: "header", text: "Terrain Brush" },
 *     { kind: "brush-mode-toggle", id: "mode", onChange: ({ value }) => ... },
 *     { kind: "radius-slider", id: "radius", value: 1, onChange: ({ value }) => ... },
 *     { kind: "checkbox", id: "enabled", label: "Enable Layer", onChange: ({ checked }) => ... }
 *   ]
 * });
 *
 * // Access controls
 * const modeControl = form.getControl("mode");
 *
 * // v2 validation
 * const result = form.validate();
 * if (!result.valid) {
 *   console.log(result.errors);
 * }
 * ```
 */

/**
 * Form control types
 */
export type FormControl =
	| HeaderControl
	| HintControl
	| SectionControl
	| BrushModeToggleControl
	| RadiusSliderControl
	| CheckboxControl
	| SelectControl
	| ColorPickerControl
	| ButtonControl
	| ButtonGroupControl
	| RadioGroupControl;

/**
 * Header (panel title)
 */
export interface HeaderControl {
	kind: "header";
	text: string;
	cls?: string;
}

/**
 * Hint text (info message)
 */
export interface HintControl {
	kind: "hint";
	id?: string;
	text?: string;
	cls?: string;
	hidden?: boolean;
}

/**
 * Section (group of controls)
 */
export interface SectionControl {
	kind: "section";
	label: string;
	controls: FormControl[];
	cls?: string;
}

/**
 * Brush mode toggle (Paint/Erase radio buttons)
 */
export interface BrushModeToggleControl {
	kind: "brush-mode-toggle";
	id: string;
	value?: "paint" | "erase";
	onChange?: (ctx: { value: "paint" | "erase"; element: HTMLElement }) => void;
}

/**
 * Radius slider (1-6 range with value display)
 */
export interface RadiusSliderControl {
	kind: "radius-slider";
	id: string;
	value?: number;
	min?: number;
	max?: number;
	/** Show "Radius:" label before slider (default: true) */
	showLabel?: boolean;
	onChange?: (ctx: { value: number; element: HTMLInputElement }) => void;
	// v2 features (opt-in)
	required?: boolean;
	validate?: (value: number) => string | null;
	bind?: {
		get: () => number;
		set: (value: number) => void;
	};
	visible?: () => boolean;
}

/**
 * Checkbox
 */
export interface CheckboxControl {
	kind: "checkbox";
	id: string;
	label: string;
	checked?: boolean;
	disabled?: boolean;
	onChange?: (ctx: { checked: boolean; element: HTMLInputElement }) => void;
	// v2 features (opt-in)
	bind?: {
		get: () => boolean;
		set: (value: boolean) => void;
	};
	visible?: () => boolean;
}

/**
 * Select dropdown
 */
export interface SelectControl {
	kind: "select";
	id: string;
	label?: string;
	options: Array<{ value: string; label: string }>;
	value?: string;
	disabled?: boolean;
	onChange?: (ctx: { value: string; element: HTMLSelectElement }) => void;
	// v2 features (opt-in)
	required?: boolean;
	validate?: (value: string) => string | null;
	bind?: {
		get: () => string;
		set: (value: string) => void;
	};
	visible?: () => boolean;
}

/**
 * Color picker
 */
export interface ColorPickerControl {
	kind: "color-picker";
	id: string;
	label?: string;
	value?: string;
	disabled?: boolean;
	onChange?: (ctx: { value: string; element: HTMLInputElement }) => void;
}

/**
 * Button
 */
export interface ButtonControl {
	kind: "button";
	id?: string;
	label: string;
	cls?: string;
	hidden?: boolean;
	onClick?: (ctx: { element: HTMLButtonElement }) => void;
}

/**
 * Button group (multiple buttons in a row)
 */
export interface ButtonGroupControl {
	kind: "button-group";
	buttons: Array<{
		id?: string;
		label: string;
		cls?: string;
		onClick?: (ctx: { element: HTMLButtonElement }) => void;
	}>;
	cls?: string;
}

/**
 * Radio button group (mutually exclusive options)
 *
 * @example
 * {
 *   kind: "radio-group",
 *   id: "areaType",
 *   options: [
 *     { value: "region", label: "Region" },
 *     { value: "faction", label: "Faction" }
 *   ],
 *   value: "region",
 *   onChange: ({ value }) => { ... }
 * }
 */
export interface RadioGroupControl {
	kind: "radio-group";
	id: string;
	options: Array<{ value: string; label: string }>;
	value?: string;
	disabled?: boolean;
	onChange?: (ctx: { value: string; element: HTMLElement }) => void;
	// v2 features (opt-in)
	required?: boolean;
	validate?: (value: string) => string | null;
	bind?: {
		get: () => string;
		set: (value: string) => void;
	};
	visible?: () => boolean;
}

/**
 * Form builder options
 */
export interface FormBuilderOptions {
	/** Form controls */
	sections: FormControl[];

	/** CSS class for form container */
	cls?: string;
}

/**
 * Form builder result
 */
export interface FormBuilderResult {
	/** Get control element by ID */
	getControl: (id: string) => HTMLElement | null;

	/** Get all controls as map */
	getAllControls: () => Map<string, HTMLElement>;

	/** Root form element */
	root: HTMLElement;

	// v2 features (opt-in)
	/** Validate all controls with validation rules */
	validate: () => { valid: boolean; errors: Map<string, string> };

	/** Get values from all controls with IDs */
	getValues: () => Record<string, unknown>;

	/** Set values for controls (triggers onChange) */
	setValues: (values: Record<string, unknown>) => void;

	/** Refresh visibility based on visible() conditions */
	refresh: () => void;
}

/**
 * Internal metadata for v2 features
 */
interface ControlMetadata {
	definition: FormControl;
	element: HTMLElement;
	wrapper?: HTMLElement; // For visibility toggling
}

/**
 * Build form UI from declarative configuration
 *
 * @param container - Parent container element
 * @param options - Form configuration
 * @returns Form builder result
 */
export function buildForm(container: HTMLElement, options: FormBuilderOptions): FormBuilderResult {
	const root = container.createDiv({
		cls: options.cls || "sm-form",
	});

	const controls = new Map<string, HTMLElement>();
	const metadata = new Map<string, ControlMetadata>();

	// Build each control
	for (const control of options.sections) {
		buildControl(root, control, controls, metadata);
	}

	// Initialize bindings
	for (const [id, meta] of metadata) {
		const control = meta.definition;
		if ("bind" in control && control.bind) {
			initializeBinding(meta.element, control);
		}
	}

	// Apply initial visibility
	refreshVisibility(metadata);

	return {
		getControl: (id) => controls.get(id) || null,
		getAllControls: () => controls,
		root,

		// v2 methods
		validate: () => validateForm(metadata),
		getValues: () => getFormValues(controls),
		setValues: (values) => setFormValues(controls, metadata, values),
		refresh: () => refreshVisibility(metadata),
	};
}

/**
 * Build a single control
 */
function buildControl(
	parent: HTMLElement,
	control: FormControl,
	controls: Map<string, HTMLElement>,
	metadata: Map<string, ControlMetadata>
): void {
	switch (control.kind) {
		case "header":
			buildHeader(parent, control);
			break;

		case "hint":
			buildHint(parent, control, controls);
			break;

		case "section":
			buildSection(parent, control, controls, metadata);
			break;

		case "brush-mode-toggle":
			buildBrushModeToggle(parent, control, controls, metadata);
			break;

		case "radius-slider":
			buildRadiusSlider(parent, control, controls, metadata);
			break;

		case "checkbox":
			buildCheckbox(parent, control, controls, metadata);
			break;

		case "select":
			buildSelect(parent, control, controls, metadata);
			break;

		case "color-picker":
			buildColorPicker(parent, control, controls);
			break;

		case "button":
			buildButton(parent, control, controls);
			break;

		case "button-group":
			buildButtonGroup(parent, control, controls);
			break;

		case "radio-group":
			buildRadioGroup(parent, control, controls, metadata);
			break;
	}
}

// ============================================================
// Control Builders
// ============================================================

function buildHeader(parent: HTMLElement, control: HeaderControl): void {
	parent.createEl("h3", {
		text: control.text,
		cls: control.cls || "sm-panel-header",
	});
}

function buildHint(parent: HTMLElement, control: HintControl, controls: Map<string, HTMLElement>): void {
	const hint = parent.createDiv({
		text: control.text || "",
		cls: control.cls || "sm-hint",
	});

	if (control.hidden) {
		hint.style.display = "none";
	}

	if (control.id) {
		controls.set(control.id, hint);
	}
}

function buildSection(
	parent: HTMLElement,
	control: SectionControl,
	controls: Map<string, HTMLElement>,
	metadata: Map<string, ControlMetadata>
): void {
	const section = parent.createDiv({
		cls: control.cls || "sm-form-section",
	});

	section.createEl("h4", {
		text: control.label,
		cls: "sm-form-section-label",
	});

	const body = section.createDiv({ cls: "sm-form-section-body" });

	for (const child of control.controls) {
		buildControl(body, child, controls, metadata);
	}
}

function buildBrushModeToggle(
	parent: HTMLElement,
	control: BrushModeToggleControl,
	controls: Map<string, HTMLElement>,
	metadata: Map<string, ControlMetadata>
): void {
	const row = parent.createDiv({ cls: "sm-form-row" });

	row.createSpan({
		text: "Mode:",
		cls: "sm-form-label",
	});

	const modeGroup = row.createDiv({ cls: "sm-brush-mode-toggle" });

	// Paint button
	const paintBtn = modeGroup.createEl("button", {
		text: "Paint",
		cls: "sm-brush-mode-btn",
	});

	// Erase button
	const eraseBtn = modeGroup.createEl("button", {
		text: "Erase",
		cls: "sm-brush-mode-btn",
	});

	// Set initial state
	const setMode = (mode: "paint" | "erase") => {
		if (mode === "paint") {
			paintBtn.addClass("is-active");
			eraseBtn.removeClass("is-active");
		} else {
			paintBtn.removeClass("is-active");
			eraseBtn.addClass("is-active");
		}
	};

	setMode(control.value || "paint");

	// Event listeners
	paintBtn.addEventListener("click", () => {
		setMode("paint");
		control.onChange?.({ value: "paint", element: modeGroup });
	});

	eraseBtn.addEventListener("click", () => {
		setMode("erase");
		control.onChange?.({ value: "erase", element: modeGroup });
	});

	controls.set(control.id, modeGroup);
	metadata.set(control.id, { definition: control, element: modeGroup, wrapper: row });
}

function buildRadiusSlider(
	parent: HTMLElement,
	control: RadiusSliderControl,
	controls: Map<string, HTMLElement>,
	metadata: Map<string, ControlMetadata>
): void {
	const row = parent.createDiv({ cls: "sm-form-row" });

	// Only show "Radius:" label if showLabel is not explicitly false
	if (control.showLabel !== false) {
		row.createSpan({
			text: "Radius:",
			cls: "sm-form-label",
		});
	}

	const sliderContainer = row.createDiv({ cls: "sm-radius-slider" });

	const slider = sliderContainer.createEl("input", {
		type: "range",
		cls: "sm-slider",
	});

	slider.min = String(control.min ?? 1);
	slider.max = String(control.max ?? 6);
	slider.value = String(control.value ?? 1);

	const valueDisplay = sliderContainer.createSpan({
		text: slider.value,
		cls: "sm-slider-value",
	});

	slider.addEventListener("input", () => {
		valueDisplay.textContent = slider.value;
		control.onChange?.({ value: Number(slider.value), element: slider });
	});

	controls.set(control.id, slider);
	metadata.set(control.id, { definition: control, element: slider, wrapper: row });
}

function buildCheckbox(
	parent: HTMLElement,
	control: CheckboxControl,
	controls: Map<string, HTMLElement>,
	metadata: Map<string, ControlMetadata>
): void {
	const row = parent.createDiv({ cls: "sm-form-row" });

	const checkbox = row.createEl("input", {
		type: "checkbox",
		cls: "sm-checkbox",
	});

	checkbox.checked = control.checked ?? false;
	checkbox.disabled = control.disabled ?? false;

	row.createSpan({
		text: control.label,
		cls: "sm-form-label",
	});

	checkbox.addEventListener("change", () => {
		control.onChange?.({ checked: checkbox.checked, element: checkbox });
	});

	controls.set(control.id, checkbox);
	metadata.set(control.id, { definition: control, element: checkbox, wrapper: row });
}

function buildSelect(
	parent: HTMLElement,
	control: SelectControl,
	controls: Map<string, HTMLElement>,
	metadata: Map<string, ControlMetadata>
): void {
	const row = parent.createDiv({ cls: "sm-form-row" });

	if (control.label) {
		row.createSpan({
			text: control.label + ":",
			cls: "sm-form-label",
		});
	}

	const select = row.createEl("select", {
		cls: "sm-form-select",
	});

	select.disabled = control.disabled ?? false;

	for (const option of control.options) {
		const opt = select.createEl("option", {
			value: option.value,
			text: option.label,
		});
		// Set selected attribute if this is the initial value
		if (control.value && option.value === control.value) {
			opt.setAttribute("selected", "selected");
		}
	}

	if (control.value) {
		select.value = control.value;
	}

	select.addEventListener("change", () => {
		control.onChange?.({ value: select.value, element: select });
	});

	controls.set(control.id, select);
	metadata.set(control.id, { definition: control, element: select, wrapper: row });
}

function buildColorPicker(parent: HTMLElement, control: ColorPickerControl, controls: Map<string, HTMLElement>): void {
	const row = parent.createDiv({ cls: "sm-form-row" });

	if (control.label) {
		row.createSpan({
			text: control.label + ":",
			cls: "sm-form-label",
		});
	}

	const input = row.createEl("input", {
		type: "color",
		cls: "sm-color-picker",
	});

	input.value = control.value || "#000000";
	input.disabled = control.disabled ?? false;

	input.addEventListener("input", () => {
		control.onChange?.({ value: input.value, element: input });
	});

	controls.set(control.id, input);
}

function buildButton(parent: HTMLElement, control: ButtonControl, controls: Map<string, HTMLElement>): void {
	const button = parent.createEl("button", {
		text: control.label,
		cls: control.cls || "sm-button",
	});

	if (control.hidden) {
		button.style.display = "none";
	}

	button.addEventListener("click", () => {
		control.onClick?.({ element: button });
	});

	if (control.id) {
		controls.set(control.id, button);
	}
}

function buildButtonGroup(parent: HTMLElement, control: ButtonGroupControl, controls: Map<string, HTMLElement>): void {
	const group = parent.createDiv({ cls: control.cls || "sm-button-group" });

	for (const btn of control.buttons) {
		const button = group.createEl("button", {
			text: btn.label,
			cls: btn.cls || "sm-button",
		});

		button.addEventListener("click", () => {
			btn.onClick?.({ element: button });
		});

		if (btn.id) {
			controls.set(btn.id, button);
		}
	}
}

function buildRadioGroup(
	parent: HTMLElement,
	control: RadioGroupControl,
	controls: Map<string, HTMLElement>,
	metadata: Map<string, ControlMetadata>
): void {
	const row = parent.createDiv({ cls: "sm-form-row sm-radio-group" });

	// Generate unique name for this radio group
	const groupName = `radio-${control.id}-${Date.now()}`;

	// Track current value
	let currentValue = control.value || (control.options.length > 0 ? control.options[0].value : "");

	// Store radio inputs for later access
	const radioInputs: HTMLInputElement[] = [];

	for (const option of control.options) {
		const optionRow = row.createDiv({ cls: "sm-radio-option" });

		const radio = optionRow.createEl("input", {
			type: "radio",
			attr: {
				name: groupName,
				id: `${groupName}-${option.value}`,
				value: option.value,
			},
		});

		radio.checked = option.value === currentValue;
		radio.disabled = control.disabled ?? false;

		optionRow.createEl("label", {
			text: option.label,
			attr: { for: `${groupName}-${option.value}` },
		});

		radioInputs.push(radio);

		radio.addEventListener("change", () => {
			if (radio.checked) {
				currentValue = option.value;
				control.onChange?.({ value: option.value, element: row });
			}
		});
	}

	// Store container element with data attribute for current value access
	row.dataset.value = currentValue;

	// Update data attribute on value change
	const originalOnChange = control.onChange;
	control.onChange = (ctx) => {
		row.dataset.value = ctx.value;
		originalOnChange?.(ctx);
	};

	controls.set(control.id, row);
	metadata.set(control.id, { definition: control, element: row, wrapper: row });
}

// ============================================================
// v2 Feature Helpers
// ============================================================

/**
 * Initialize state binding for a control
 */
function initializeBinding(element: HTMLElement, control: FormControl): void {
	if (!("bind" in control) || !control.bind) return;

	const bind = control.bind;

	// Set initial value from binding
	if (element instanceof HTMLInputElement) {
		if (element.type === "checkbox") {
			element.checked = (bind as { get: () => boolean }).get();
		} else if (element.type === "range") {
			const value = (bind as { get: () => number }).get();
			element.value = String(value);
			// Update value display
			const valueDisplay = element.parentElement?.querySelector(".sm-slider-value");
			if (valueDisplay) {
				valueDisplay.textContent = String(value);
			}
		}
	} else if (element instanceof HTMLSelectElement) {
		const value = (bind as { get: () => string }).get();
		element.value = value;
		// Clear all selected attributes and set the correct one (for jsdom compatibility)
		element.querySelectorAll("option").forEach((opt) => opt.removeAttribute("selected"));
		const option = element.querySelector(`option[value="${value}"]`);
		if (option) {
			option.setAttribute("selected", "selected");
		}
	} else if (element instanceof HTMLDivElement && element.classList.contains("sm-radio-group")) {
		// Radio group: set initial value from binding
		const value = (bind as { get: () => string }).get();
		element.dataset.value = value;
		const radios = element.querySelectorAll<HTMLInputElement>('input[type="radio"]');
		for (const radio of radios) {
			radio.checked = radio.value === value;
		}
	}

	// Sync to binding on change (in addition to existing onChange)
	const syncToBinding = () => {
		if (element instanceof HTMLInputElement) {
			if (element.type === "checkbox") {
				(bind as { set: (value: boolean) => void }).set(element.checked);
			} else if (element.type === "range") {
				(bind as { set: (value: number) => void }).set(Number(element.value));
			}
		} else if (element instanceof HTMLSelectElement) {
			(bind as { set: (value: string) => void }).set(element.value);
		} else if (element instanceof HTMLDivElement && element.classList.contains("sm-radio-group")) {
			(bind as { set: (value: string) => void }).set(element.dataset.value || "");
		}
	};

	if (element instanceof HTMLInputElement && element.type === "checkbox") {
		element.addEventListener("change", syncToBinding);
	} else if (element instanceof HTMLInputElement) {
		element.addEventListener("input", syncToBinding);
	} else if (element instanceof HTMLSelectElement) {
		element.addEventListener("change", syncToBinding);
	} else if (element instanceof HTMLDivElement && element.classList.contains("sm-radio-group")) {
		// Radio group: listen for change events on child radio inputs
		element.addEventListener("change", syncToBinding);
	}
}

/**
 * Get select element value (works around jsdom quirks)
 */
function getSelectValue(select: HTMLSelectElement): string {
	// Fallback: find selected option (for jsdom compatibility)
	const selectedOption = select.querySelector("option[selected]") as HTMLOptionElement | null;
	if (selectedOption) {
		return selectedOption.getAttribute("value") || "";
	}

	// Fallback: try standard value property
	if (select.value) {
		return select.value;
	}

	// Fallback: first option value
	const firstOption = select.querySelector("option") as HTMLOptionElement | null;
	return firstOption?.getAttribute("value") || "";
}

/**
 * Validate all controls with validation rules
 */
function validateForm(metadata: Map<string, ControlMetadata>): { valid: boolean; errors: Map<string, string> } {
	const errors = new Map<string, string>();

	for (const [id, meta] of metadata) {
		const control = meta.definition;
		const element = meta.element;

		// Check required
		if ("required" in control && control.required) {
			let isEmpty = false;

			if (element instanceof HTMLInputElement && element.type === "range") {
				// Range sliders always have a value
				isEmpty = false;
			} else if (element instanceof HTMLSelectElement) {
				const value = getSelectValue(element);
				isEmpty = !value;
			} else if (element instanceof HTMLDivElement && element.classList.contains("sm-radio-group")) {
				// Radio group: check if any option is selected
				isEmpty = !element.dataset.value;
			}

			if (isEmpty) {
				errors.set(id, "This field is required");
				continue;
			}
		}

		// Check custom validator
		if ("validate" in control && control.validate) {
			const validator = control.validate as (value: unknown) => string | null;

			if (element instanceof HTMLInputElement && element.type === "range") {
				const error = validator(Number(element.value));
				if (error) {
					errors.set(id, error);
				}
			} else if (element instanceof HTMLSelectElement) {
				const value = getSelectValue(element);
				const error = validator(value);
				if (error) {
					errors.set(id, error);
				}
			} else if (element instanceof HTMLDivElement && element.classList.contains("sm-radio-group")) {
				const error = validator(element.dataset.value || "");
				if (error) {
					errors.set(id, error);
				}
			}
		}
	}

	return {
		valid: errors.size === 0,
		errors,
	};
}

/**
 * Get values from all controls
 */
function getFormValues(controls: Map<string, HTMLElement>): Record<string, unknown> {
	const values: Record<string, unknown> = {};

	for (const [id, element] of controls) {
		if (element instanceof HTMLInputElement) {
			if (element.type === "checkbox") {
				values[id] = element.checked;
			} else if (element.type === "range") {
				values[id] = Number(element.value);
			} else if (element.type === "color") {
				values[id] = element.value;
			}
		} else if (element instanceof HTMLSelectElement) {
			values[id] = getSelectValue(element);
		} else if (element instanceof HTMLDivElement && element.classList.contains("sm-radio-group")) {
			// Radio group: get value from data attribute
			values[id] = element.dataset.value || "";
		}
		// Note: brush-mode-toggle stores mode as data-attribute or we'd need to track it
	}

	return values;
}

/**
 * Set values for controls
 */
function setFormValues(
	controls: Map<string, HTMLElement>,
	metadata: Map<string, ControlMetadata>,
	values: Record<string, unknown>
): void {
	for (const [id, value] of Object.entries(values)) {
		const element = controls.get(id);
		const meta = metadata.get(id);
		if (!element) continue;

		if (element instanceof HTMLInputElement) {
			if (element.type === "checkbox") {
				element.checked = Boolean(value);
			} else if (element.type === "range") {
				element.value = String(value);
				// Update value display
				const valueDisplay = element.parentElement?.querySelector(".sm-slider-value");
				if (valueDisplay) {
					valueDisplay.textContent = String(value);
				}
			} else if (element.type === "color") {
				element.value = String(value);
			}
			// Trigger change event to fire onChange handlers
			element.dispatchEvent(new Event("input", { bubbles: true }));
		} else if (element instanceof HTMLSelectElement) {
			const valueStr = String(value);
			element.value = valueStr;
			// Clear all selected attributes and set the correct one (for jsdom compatibility)
			element.querySelectorAll("option").forEach((opt) => opt.removeAttribute("selected"));
			const option = element.querySelector(`option[value="${valueStr}"]`);
			if (option) {
				option.setAttribute("selected", "selected");
			}
			element.dispatchEvent(new Event("change", { bubbles: true }));
		} else if (element instanceof HTMLDivElement && element.classList.contains("sm-radio-group")) {
			// Radio group: find and check the correct radio input
			const valueStr = String(value);
			const radios = element.querySelectorAll<HTMLInputElement>('input[type="radio"]');
			for (const radio of radios) {
				radio.checked = radio.value === valueStr;
				if (radio.checked) {
					element.dataset.value = valueStr;
					radio.dispatchEvent(new Event("change", { bubbles: true }));
				}
			}
		}

		// Update binding if present
		const control = meta?.definition;
		if (control && "bind" in control && control.bind) {
			const bind = control.bind;
			if (element instanceof HTMLInputElement && element.type === "checkbox") {
				(bind as { set: (value: boolean) => void }).set(Boolean(value));
			} else if (element instanceof HTMLInputElement && element.type === "range") {
				(bind as { set: (value: number) => void }).set(Number(value));
			} else if (element instanceof HTMLSelectElement) {
				(bind as { set: (value: string) => void }).set(String(value));
			} else if (element instanceof HTMLDivElement && element.classList.contains("sm-radio-group")) {
				(bind as { set: (value: string) => void }).set(String(value));
			}
		}
	}
}

/**
 * Refresh visibility based on visible() conditions
 */
function refreshVisibility(metadata: Map<string, ControlMetadata>): void {
	for (const meta of metadata.values()) {
		const control = meta.definition;

		if ("visible" in control && control.visible) {
			const isVisible = control.visible();
			const wrapper = meta.wrapper || meta.element;

			if (isVisible) {
				wrapper.style.display = "";
			} else {
				wrapper.style.display = "none";
			}
		}
	}
}
