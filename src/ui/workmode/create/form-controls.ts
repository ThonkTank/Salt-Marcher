// src/ui/workmode/create/form-controls.ts
// Wiederverwendbare Form-Controls für Workmode Create-Dialoge

import { enhanceSelectToSearch } from "../../search-dropdown";

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

  if (options.onChange) {
    input.addEventListener("change", () => {
      const val = input.value.trim();
      const num = val ? parseFloat(val) : undefined;
      options.onChange!(num);
    });
  }

  return input;
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
