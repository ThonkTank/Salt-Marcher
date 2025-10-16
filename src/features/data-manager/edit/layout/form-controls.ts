// src/ui/create/form-controls.ts
// Wiederverwendbare Form-Controls für Workmode Create-Dialoge

import { enhanceSelectToSearch } from "../../../../ui/components/search-dropdown";

/**
 * Options for creating a text input field
 */
export interface TextInputOptions {
  placeholder?: string;
  value?: string;
  ariaLabel?: string;
  className?: string;
  onChange?: (value: string) => void;
  onInput?: (value: string) => void;
}

/**
 * Creates a text input element with consistent styling and event handling
 */
export function createTextInput(parent: HTMLElement, options: TextInputOptions = {}): HTMLInputElement {
  const input = parent.createEl("input", {
    cls: options.className || "sm-cc-input",
    attr: {
      type: "text",
      placeholder: options.placeholder || "",
      "aria-label": options.ariaLabel || options.placeholder || "Text input",
    },
  }) as HTMLInputElement;

  if (options.value !== undefined) {
    input.value = options.value;
  }

  if (options.onChange) {
    input.addEventListener("change", () => options.onChange!(input.value));
  }

  if (options.onInput) {
    input.addEventListener("input", () => options.onInput!(input.value));
  }

  return input;
}

/**
 * Options for creating a number input field
 */
export interface NumberInputOptions {
  placeholder?: string;
  value?: number;
  min?: number;
  max?: number;
  step?: number;
  ariaLabel?: string;
  className?: string;
  onChange?: (value: number | undefined) => void;
  onInput?: (value: number | undefined, rawValue: string) => void;
}

/**
 * Creates a number input element with consistent styling and event handling
 */
export function createNumberInput(parent: HTMLElement, options: NumberInputOptions = {}): HTMLInputElement {
  const input = parent.createEl("input", {
    cls: options.className || "sm-cc-input",
    attr: {
      type: "number",
      placeholder: options.placeholder || "",
      "aria-label": options.ariaLabel || options.placeholder || "Number input",
    },
  }) as HTMLInputElement;

  if (options.min !== undefined) input.min = String(options.min);
  if (options.max !== undefined) input.max = String(options.max);
  if (options.step !== undefined) input.step = String(options.step);
  if (options.value !== undefined) input.value = String(options.value);

  const parseValue = () => {
    const raw = input.value.trim();
    if (!raw) return { value: undefined, raw } as const;
    const parsed = Number(raw);
    return { value: Number.isFinite(parsed) ? parsed : undefined, raw } as const;
  };

  if (options.onChange) {
    input.addEventListener("change", () => {
      const { value } = parseValue();
      options.onChange!(value);
    });
  }

  if (options.onInput) {
    input.addEventListener("input", () => {
      const { value, raw } = parseValue();
      options.onInput!(value, raw);
    });
  }

  return input;
}

/**
 * Options for creating a number input with increment/decrement buttons
 */
export interface NumberStepperOptions extends NumberInputOptions {
  wrapperClassName?: string;
  buttonClassName?: string;
  decrementClassName?: string;
  incrementClassName?: string;
  decrementLabel?: string;
  decrementAriaLabel?: string;
  incrementLabel?: string;
  incrementAriaLabel?: string;
  autoSizeOnInput?: boolean;  // Control auto-sizing on input events (default: true)
}

/** Handle returned by {@link createNumberStepper} */
export interface NumberStepperHandle {
  container: HTMLDivElement;
  input: HTMLInputElement;
  decrementButton: HTMLButtonElement;
  incrementButton: HTMLButtonElement;
  /** Hidden mirror element for text width measurement (used for auto-sizing) */
  mirrorEl: HTMLSpanElement;
  /** Returns the current numeric value of the input (undefined when empty/invalid) */
  getValue: () => number | undefined;
  /** Sets the current value without triggering change callbacks */
  setValue: (value: number | undefined) => void;
}

/**
 * Creates a number input with +/- buttons that respect min/max/step constraints
 */
export function createNumberStepper(
  parent: HTMLElement,
  options: NumberStepperOptions = {},
): NumberStepperHandle {
  const {
    wrapperClassName,
    buttonClassName,
    decrementClassName,
    incrementClassName,
    decrementLabel = "−",
    decrementAriaLabel = "Decrease value",
    incrementLabel = "+",
    incrementAriaLabel = "Increase value",
    autoSizeOnInput = true,  // Default: true
    onChange,
    onInput,
    ...inputOptions
  } = options;

  const containerClasses = ["sm-inline-number"] as string[];
  if (wrapperClassName) {
    containerClasses.push(...wrapperClassName.split(" ").filter(Boolean));
  }

  const container = parent.createDiv({ cls: containerClasses });

  // Create hidden mirror element for text width measurement (auto-sizing)
  const mirrorEl = container.createEl("span", {
    cls: "sm-cc-number-stepper__mirror",
  }) as HTMLSpanElement;
  mirrorEl.style.position = "absolute";
  mirrorEl.style.visibility = "hidden";
  mirrorEl.style.whiteSpace = "pre";
  mirrorEl.style.pointerEvents = "none";

  // Declare updateInputSize early so it can be used in input callbacks
  let stylesCopied = false;
  let input: HTMLInputElement;
  const updateInputSize = () => {
    // Determine text to measure for width calculation
    let measureText: string;
    if (inputOptions.max !== undefined) {
      // Use max value for consistent fixed width (prevents layout shift)
      measureText = String(inputOptions.max);
    } else {
      // Use current value for dynamic width
      measureText = input.value || input.placeholder || "0";
    }

    // Copy font styles from input to mirror element (only once)
    if (!stylesCopied) {
      const computedStyle = window.getComputedStyle(input);
      mirrorEl.style.fontSize = computedStyle.fontSize;
      mirrorEl.style.fontFamily = computedStyle.fontFamily;
      mirrorEl.style.fontWeight = computedStyle.fontWeight;
      mirrorEl.style.letterSpacing = computedStyle.letterSpacing;
      mirrorEl.style.padding = "0";
      mirrorEl.style.border = "0";
      stylesCopied = true;
    }

    // Measure actual text width using mirror element
    mirrorEl.textContent = measureText;
    const textWidth = mirrorEl.getBoundingClientRect().width;

    // Set input width with buffer
    input.style.width = `${textWidth + 8}px`;
  };

  input = createNumberInput(container, {
    ...inputOptions,
    onChange: (value) => {
      onChange?.(value);
    },
    onInput: (value, raw) => {
      // Only auto-size on input if enabled (default: true)
      if (autoSizeOnInput) {
        updateInputSize();
      }
      onInput?.(value, raw);
    },
  });

  // Button group for vertical stacking
  const buttonGroup = container.createDiv({ cls: "sm-number-stepper-buttons" });

  const incrementButton = buttonGroup.createEl("button", {
    text: incrementLabel,
    cls: incrementClassName ?? buttonClassName ?? "btn-compact",
    attr: { type: "button", "aria-label": incrementAriaLabel },
  }) as HTMLButtonElement;

  const decrementButton = buttonGroup.createEl("button", {
    text: decrementLabel,
    cls: decrementClassName ?? buttonClassName ?? "btn-compact",
    attr: { type: "button", "aria-label": decrementAriaLabel },
  }) as HTMLButtonElement;

  const decimalPlaces = (num: number) => {
    if (!Number.isFinite(num)) return 0;
    const parts = num.toString().split(".");
    return parts[1]?.length ?? 0;
  };

  const getValue = () => {
    const raw = input.value.trim();
    if (!raw) return undefined;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : undefined;
  };

  const setValue = (value: number | undefined) => {
    if (value === undefined || Number.isNaN(value)) {
      input.value = "";
    } else {
      input.value = String(value);
    }
    updateInputSize();
  };

  const notify = () => {
    const value = getValue();
    if (onInput) {
      onInput(value, input.value);
    }
    if (onChange) {
      onChange(value);
    }
  };

  const stepValue = (direction: number) => {
    const stepSize = inputOptions.step ?? 1;
    const precision = Math.max(decimalPlaces(stepSize), decimalPlaces(getValue() ?? 0));
    const factor = Math.pow(10, precision);

    const baseValue = getValue();
    const current = baseValue ?? inputOptions.min ?? 0;
    let next = (current * factor + direction * stepSize * factor) / factor;

    if (inputOptions.min !== undefined) {
      next = Math.max(inputOptions.min, next);
    }
    if (inputOptions.max !== undefined) {
      next = Math.min(inputOptions.max, next);
    }

    const previousRaw = input.value;
    const rounded = Number(next.toFixed(precision));
    setValue(rounded);

    if (input.value === previousRaw) {
      return;
    }

    notify();
  };

  decrementButton.addEventListener("click", () => {
    stepValue(-1);
  });
  incrementButton.addEventListener("click", () => {
    stepValue(1);
  });

  // Initial auto-sizing
  updateInputSize();

  return {
    container,
    input,
    decrementButton,
    incrementButton,
    mirrorEl,
    getValue,
    setValue,
  };
}

/**
 * Options for creating a select dropdown
 */
export interface SelectDropdownOptions<T = string> {
  options: readonly { value: T; label: string }[] | readonly T[];
  value?: T;
  placeholder?: string;
  ariaLabel?: string;
  className?: string;
  enableSearch?: boolean;
  searchPlaceholder?: string;
  onChange?: (value: T) => void;
}

/**
 * Handle for interacting with a select dropdown
 */
export interface SelectDropdownHandle<T = string> {
  element: HTMLSelectElement;
  getValue: () => T;
  setValue: (value: T) => void;
  setOptions: (options: readonly { value: T; label: string }[] | readonly T[]) => void;
  /** Update the search input display to match current select value */
  syncDisplay: () => void;
}

/**
 * Creates a select dropdown with optional search enhancement
 * Returns a handle for programmatic control that properly syncs with search UI
 */
export function createSelectDropdown<T = string>(
  parent: HTMLElement,
  options: SelectDropdownOptions<T>,
): SelectDropdownHandle<T> {
  const select = parent.createEl("select", {
    cls: options.className || "sm-cc-select",
    attr: {
      "aria-label": options.ariaLabel || options.placeholder || "Select option",
    },
  }) as HTMLSelectElement;

  // Normalize options to {value, label} format
  const normalizeOptions = (opts: readonly { value: T; label: string }[] | readonly T[]) => {
    return opts.map((opt) =>
      typeof opt === "object" && "value" in opt
        ? opt
        : { value: opt as T, label: String(opt) }
    );
  };

  let normalizedOptions = normalizeOptions(options.options);

  const populateOptions = () => {
    select.empty();
    normalizedOptions.forEach((opt) => {
      const optEl = select.createEl("option", { text: opt.label });
      (optEl as HTMLOptionElement).value = String(opt.value);
    });
  };

  populateOptions();

  if (options.value !== undefined) {
    select.value = String(options.value);
  }

  if (options.onChange) {
    select.addEventListener("change", () => {
      options.onChange!(select.value as T);
    });
  }

  // Enable search if requested
  if (options.enableSearch) {
    try {
      enhanceSelectToSearch(select, options.searchPlaceholder || "Suchen…");
    } catch (e) {
      console.warn("Failed to enhance select to search:", e);
    }
  }

  // Sync helper function
  const syncDisplay = () => {
    const searchInput = (select as any)._smSearchInput as HTMLInputElement;
    if (searchInput) {
      const selectedOption = Array.from(select.options).find(
        (opt) => opt.value === select.value
      );
      searchInput.value = selectedOption?.text || "";
    }
  };

  // Handle for programmatic control
  const handle: SelectDropdownHandle<T> = {
    element: select,
    getValue: () => select.value as T,
    setValue: (value: T) => {
      select.value = String(value);
      syncDisplay();
    },
    setOptions: (newOptions) => {
      normalizedOptions = normalizeOptions(newOptions);
      populateOptions();
    },
    syncDisplay,
  };

  // Sync display after initial value is set and enhancement is applied
  if (options.value !== undefined && options.enableSearch) {
    syncDisplay();
  }

  return handle;
}

/**
 * Enhances an existing select element with search functionality
 * Returns a handle for programmatic control
 *
 * @example
 * const select = parent.createEl("select");
 * // ... add options ...
 * const handle = enhanceExistingSelectDropdown(select, "Search...");
 * handle.setValue("someValue");
 */
export function enhanceExistingSelectDropdown(
  select: HTMLSelectElement,
  searchPlaceholder?: string
): SelectDropdownHandle {
  // Apply enhancement if not already enhanced
  if (!(select as any)._smEnhanced) {
    try {
      enhanceSelectToSearch(select, searchPlaceholder || "Suchen…");
    } catch (e) {
      console.warn("Failed to enhance select to search:", e);
    }
  }

  // Sync helper function
  const syncDisplay = () => {
    const searchInput = (select as any)._smSearchInput as HTMLInputElement;
    if (searchInput) {
      const selectedOption = Array.from(select.options).find(
        (opt) => opt.value === select.value
      );
      searchInput.value = selectedOption?.text || "";
    }
  };

  // Handle for programmatic control
  const handle: SelectDropdownHandle = {
    element: select,
    getValue: () => select.value,
    setValue: (value: string) => {
      select.value = String(value);
      syncDisplay();
    },
    setOptions: (newOptions) => {
      select.empty();
      const normalizedOptions = newOptions.map((opt) =>
        typeof opt === "object" && "value" in opt
          ? opt
          : { value: opt as string, label: String(opt) }
      );
      normalizedOptions.forEach((opt) => {
        const optEl = select.createEl("option", { text: opt.label });
        (optEl as HTMLOptionElement).value = String(opt.value);
      });
    },
    syncDisplay,
  };

  return handle;
}

/**
 * Options for creating a textarea
 */
export interface TextAreaOptions {
  placeholder?: string;
  value?: string;
  ariaLabel?: string;
  className?: string;
  minHeight?: number;
  onChange?: (value: string) => void;
  onInput?: (value: string) => void;
}

/**
 * Creates a textarea element with consistent styling and event handling
 */
export function createTextArea(parent: HTMLElement, options: TextAreaOptions = {}): HTMLTextAreaElement {
  const textarea = parent.createEl("textarea", {
    cls: options.className || "sm-cc-textarea",
    attr: {
      placeholder: options.placeholder || "",
      "aria-label": options.ariaLabel || options.placeholder || "Text area",
    },
  }) as HTMLTextAreaElement;

  if (options.minHeight) {
    textarea.style.minHeight = `${options.minHeight}px`;
  }

  if (options.value !== undefined) {
    textarea.value = options.value;
  }

  if (options.onChange) {
    textarea.addEventListener("change", () => options.onChange!(textarea.value));
  }

  if (options.onInput) {
    textarea.addEventListener("input", () => options.onInput!(textarea.value));
  }

  return textarea;
}

/**
 * Options for creating a checkbox
 */
export interface CheckboxOptions {
  label?: string;
  checked?: boolean;
  ariaLabel?: string;
  onChange?: (checked: boolean) => void;
}

/**
 * Creates a checkbox element with optional label
 */
export function createCheckbox(parent: HTMLElement, options: CheckboxOptions = {}): HTMLInputElement {
  const container = parent.createDiv({ cls: "sm-cc-checkbox-container" });

  const checkbox = container.createEl("input", {
    attr: {
      type: "checkbox",
      "aria-label": options.ariaLabel || options.label || "Checkbox",
    },
  }) as HTMLInputElement;

  if (options.checked) {
    checkbox.checked = true;
  }

  if (options.label) {
    container.createEl("label", { text: options.label });
  }

  if (options.onChange) {
    checkbox.addEventListener("change", () => options.onChange!(checkbox.checked));
  }

  return checkbox;
}

/**
 * Options for creating a preset autocomplete input
 */
export interface PresetAutocompleteOptions<T> {
  placeholder?: string;
  value?: string;
  ariaLabel?: string;
  className?: string;
  getPresets: (query: string) => T[];
  renderPreset: (preset: T) => string;
  onSelectPreset: (preset: T) => void;
  onInput?: (value: string) => void;
}

/**
 * Creates a text input with autocomplete dropdown for presets
 */
export function createPresetAutocomplete<T>(
  parent: HTMLElement,
  options: PresetAutocompleteOptions<T>,
): HTMLInputElement {
  const box = parent.createDiv({ cls: "sm-preset-box" });
  const input = box.createEl("input", {
    cls: options.className || "sm-preset-input",
    attr: {
      type: "text",
      placeholder: options.placeholder || "Suchen oder eingeben…",
      "aria-label": options.ariaLabel || options.placeholder || "Preset input",
    },
  }) as HTMLInputElement;

  if (options.value !== undefined) {
    input.value = options.value;
  }

  const menu = box.createDiv({ cls: "sm-preset-menu" });

  const renderMenu = () => {
    const query = input.value || "";
    menu.empty();
    const presets = options.getPresets(query);

    if (!presets.length) {
      box.removeClass("is-open");
      return;
    }

    presets.forEach((preset) => {
      const item = menu.createDiv({ cls: "sm-preset-item", text: options.renderPreset(preset) });
      item.onclick = () => {
        options.onSelectPreset(preset);
        box.removeClass("is-open");
      };
    });

    box.addClass("is-open");
  };

  input.addEventListener("focus", renderMenu);
  input.addEventListener("input", () => {
    if (options.onInput) options.onInput(input.value);
    if (document.activeElement === input) renderMenu();
  });
  input.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      box.removeClass("is-open");
    }
  });
  input.addEventListener("blur", () => {
    window.setTimeout(() => box.removeClass("is-open"), 120);
  });

  return input;
}
