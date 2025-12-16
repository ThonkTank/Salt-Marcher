// src/features/data-manager/edit/controls/number-stepper.ts
// Number stepper control with increment/decrement buttons

import { calculateTextWidth } from "../width-utils";

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
  /** Returns the current numeric value of the input (undefined when empty/invalid) */
  getValue: () => number | undefined;
  /** Sets the current value without triggering change callbacks */
  setValue: (value: number | undefined) => void;
}

/**
 * Creates a number input element with consistent styling and event handling.
 * Internal helper for createNumberStepper.
 */
function createNumberInput(parent: HTMLElement, options: NumberInputOptions = {}): HTMLInputElement {
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

  // Declare updateInputSize early so it can be used in input callbacks
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

    // Calculate width using utility function
    const width = calculateTextWidth(measureText, input, {
      includePadding: true,
      includeBorder: true,
      extraSpace: 8,
    });

    input.style.width = `${width}px`;
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
    getValue,
    setValue,
  };
}
