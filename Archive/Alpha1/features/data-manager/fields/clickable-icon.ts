// src/features/data-manager/fields/clickable-icon.ts
// Generic clickable icon component for toggle-like boolean fields

import { debugLogger } from "@services/logging/debug-logger";

export interface ClickableIconOptions {
  container: HTMLElement;
  value: boolean;
  icon?: string;           // Icon to show when active (default: "★")
  inactiveIcon?: string;   // Icon to show when inactive (default: "☆")
  onChange: (value: boolean) => void;
  className?: string;
  fieldId?: string;        // For logging purposes
}

export interface ClickableIconHandle {
  update: (value: boolean) => void;
  setValue: (value: boolean) => void;
  element: HTMLElement;
}

/**
 * Creates a clickable icon that toggles between two states.
 * Commonly used for expertise (★/☆) or similar binary visual indicators.
 *
 * @example
 * ```ts
 * const handle = createClickableIcon(container, {
 *   value: false,
 *   icon: "★",           // Filled star when active
 *   inactiveIcon: "☆",   // Hollow star when inactive
 *   onChange: (v) => console.log("New value:", v)
 * });
 * ```
 */
export function createClickableIcon(
  options: ClickableIconOptions
): ClickableIconHandle {
  const {
    container,
    value: initialValue,
    icon = "★",
    inactiveIcon = "☆",
    onChange,
    className = "sm-cc-clickable-icon",
    fieldId = "unknown",
  } = options;

  let currentValue = initialValue;

  debugLogger.logField(fieldId, "field-creation", "ClickableIcon created", { initialValue: currentValue });

  // Create the clickable icon element
  const iconEl = container.createSpan({
    cls: className,
    text: currentValue ? icon : inactiveIcon,
  });

  // Add active class if checked
  if (currentValue) {
    iconEl.addClass(`${className}--active`);
  }

  // Make it focusable for accessibility
  iconEl.setAttribute("role", "checkbox");
  iconEl.setAttribute("aria-checked", String(currentValue));
  iconEl.setAttribute("tabindex", "0");

  // Update display
  const updateDisplay = () => {
    iconEl.textContent = currentValue ? icon : inactiveIcon;
    iconEl.toggleClass(`${className}--active`, currentValue);
    iconEl.setAttribute("aria-checked", String(currentValue));
  };

  // Toggle handler
  const toggle = () => {
    const oldValue = currentValue;
    currentValue = !currentValue;
    debugLogger.logField(fieldId, "toggle", "Field toggled", { oldValue, newValue: currentValue });
    updateDisplay();
    debugLogger.logField(fieldId, "onChange", "Calling onChange", { value: currentValue });
    onChange(currentValue);
  };

  // Click to toggle
  iconEl.onclick = (e) => {
    e.stopPropagation();
    toggle();
  };

  // Keyboard support (Space/Enter to toggle)
  iconEl.onkeydown = (e: KeyboardEvent) => {
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      toggle();
    }
  };

  return {
    element: iconEl,
    update: (newValue: boolean) => {
      currentValue = newValue;
      updateDisplay();
    },
    setValue: (newValue: boolean) => {
      currentValue = newValue;
      updateDisplay();
    },
  };
}
