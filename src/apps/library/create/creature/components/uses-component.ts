// src/apps/library/create/creature/components/uses-component.ts
// Modular Uses component for abilities with limited uses per rest/day

import { createNumberInput, createSelectDropdown, createTextInput } from "../../shared/form-controls";
import type { UsesComponent } from "./types";

/**
 * Options for creating a uses component
 */
export interface UsesComponentOptions {
  /** Initial uses configuration */
  uses?: UsesComponent;
  /** Callback when uses data changes */
  onUpdate: (uses: UsesComponent | undefined) => void;
  /** Optional compact mode for inline display */
  compact?: boolean;
  /** Enable stateful tracking of remaining uses */
  enableTracking?: boolean;
}

/**
 * Handle for interacting with a uses component
 */
export interface UsesComponentHandle {
  /** The root container element */
  container: HTMLElement;
  /** Get current uses configuration */
  getValue: () => UsesComponent | undefined;
  /** Set uses configuration */
  setValue: (uses: UsesComponent | undefined) => void;
  /** Refresh the component display */
  refresh: () => void;
  /** Validate and return list of validation errors */
  validate: () => string[];
  /** Get/set remaining uses (if tracking enabled) */
  getRemainingUses?: () => number;
  setRemainingUses?: (remaining: number) => void;
}

/**
 * Common count presets for quick selection
 */
const COUNT_PRESETS = [1, 2, 3, 4, 5] as const;

/**
 * Reset period options
 */
const RESET_PERIOD_OPTIONS = [
  { value: "day", label: "Per Day" },
  { value: "short", label: "Per Short Rest" },
  { value: "long", label: "Per Long Rest" },
  { value: "dawn", label: "Per Dawn" },
  { value: "dusk", label: "Per Dusk" },
  { value: "rest", label: "Per Rest (Any)" },
  { value: "custom", label: "Custom..." },
] as const;

/**
 * Creates a uses component for limited-use abilities
 *
 * Features:
 * - Number of uses input (1-99) with quick preset buttons
 * - Reset condition selector (Day, Short Rest, Long Rest, Dawn, Custom)
 * - Optional custom text for reset condition
 * - Optional stateful tracking of remaining uses
 * - Compact inline mode
 *
 * Outputs format: "(2/Day)", "(3/Long Rest)", "(1/Dawn)", "(5/Custom Text)"
 *
 * @example
 * ```ts
 * const handle = createUsesComponent(container, {
 *   uses: { type: "uses", count: 2, per: "day" },
 *   onUpdate: (uses) => console.log("Updated:", uses),
 *   compact: false,
 *   enableTracking: true
 * });
 * ```
 */
export function createUsesComponent(
  parent: HTMLElement,
  options: UsesComponentOptions
): UsesComponentHandle {
  const { onUpdate, compact = false, enableTracking = false } = options;

  // Internal state
  let currentUses: UsesComponent | undefined = options.uses;
  let remainingUses: number | undefined = currentUses?.count;
  let customText = "";

  const container = parent.createDiv({
    cls: compact ? "sm-cc-uses-component sm-cc-uses-component--compact" : "sm-cc-uses-component",
  });

  // Track custom text separately if "per" field is not a standard option
  if (currentUses && !isStandardPeriod(currentUses.per)) {
    customText = currentUses.per;
  }

  /**
   * Renders the complete uses component UI
   */
  const render = () => {
    container.empty();

    // Header with toggle
    const header = container.createDiv({ cls: "sm-cc-uses-header" });

    const enableCheckbox = header.createEl("input", {
      cls: "sm-cc-uses-toggle",
      attr: {
        type: "checkbox",
        "aria-label": "Enable limited uses",
      },
    }) as HTMLInputElement;

    enableCheckbox.checked = !!currentUses;

    header.createEl("label", {
      text: "Limited Uses",
      cls: "sm-cc-uses-label",
    });

    // Icon for visual representation
    const icon = header.createDiv({ cls: "sm-cc-uses-icon" });
    icon.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"/>
        <path d="M12 6v6l4 2"/>
      </svg>
    `;

    // Toggle enable/disable
    enableCheckbox.addEventListener("change", () => {
      if (enableCheckbox.checked) {
        // Enable with default (1/Day)
        currentUses = {
          type: "uses",
          count: 1,
          per: "day",
        };
        remainingUses = 1;
      } else {
        // Disable
        currentUses = undefined;
        remainingUses = undefined;
      }
      onUpdate(currentUses);
      render();
    });

    // Only show configuration if enabled
    if (!currentUses) {
      return;
    }

    // Count section
    const countSection = container.createDiv({ cls: "sm-cc-uses-count-section" });
    countSection.createDiv({
      text: "Number of Uses:",
      cls: "sm-cc-uses-section-label",
    });

    // Quick preset buttons
    const presetsButtons = countSection.createDiv({
      cls: "sm-cc-uses-preset-buttons",
    });

    COUNT_PRESETS.forEach((count) => {
      const isActive = currentUses?.count === count;

      const btn = presetsButtons.createEl("button", {
        cls: isActive ? "sm-cc-uses-preset-btn active" : "sm-cc-uses-preset-btn",
        text: String(count),
        attr: {
          type: "button",
          "aria-label": `Set uses to ${count}`,
          "aria-pressed": String(isActive),
        },
      });

      btn.onclick = () => {
        if (currentUses) {
          currentUses.count = count;
          remainingUses = count;
          onUpdate(currentUses);
          render();
        }
      };
    });

    // Custom count input
    const countInputWrapper = countSection.createDiv({
      cls: "sm-cc-uses-count-input-wrapper",
    });
    countInputWrapper.createSpan({
      text: "or",
      cls: "sm-cc-uses-separator",
    });

    const countInput = createNumberInput(countInputWrapper, {
      className: "sm-cc-uses-count-input",
      placeholder: "Custom",
      ariaLabel: "Number of uses",
      value: currentUses.count,
      min: 1,
      max: 99,
      onChange: (value) => {
        if (currentUses && value !== undefined) {
          currentUses.count = value;
          remainingUses = value;
          onUpdate(currentUses);
          render();
        }
      },
    });

    // Reset period section
    const periodSection = container.createDiv({ cls: "sm-cc-uses-period-section" });
    periodSection.createDiv({
      text: "Resets:",
      cls: "sm-cc-uses-section-label",
    });

    const currentPeriod = isStandardPeriod(currentUses.per) ? currentUses.per : "custom";

    const periodSelect = createSelectDropdown(periodSection, {
      className: "sm-cc-uses-period-select",
      options: RESET_PERIOD_OPTIONS,
      value: currentPeriod,
      ariaLabel: "Reset period",
      onChange: (value) => {
        if (!currentUses) return;

        if (value === "custom") {
          // Switch to custom mode - use existing custom text or empty
          currentUses.per = customText || "Custom";
        } else {
          // Switch to standard period
          currentUses.per = value;
        }

        onUpdate(currentUses);
        render();
      },
    }).element;

    // Custom text input (shown only when custom is selected)
    if (currentPeriod === "custom") {
      const customInputWrapper = periodSection.createDiv({
        cls: "sm-cc-uses-custom-input-wrapper",
      });

      const customInput = createTextInput(customInputWrapper, {
        className: "sm-cc-uses-custom-input",
        placeholder: "e.g., Per Battle, Per Moon Phase...",
        ariaLabel: "Custom reset condition",
        value: customText || currentUses.per,
        onInput: (value) => {
          if (currentUses) {
            customText = value.trim();
            currentUses.per = customText || "Custom";
            onUpdate(currentUses);
          }
        },
      });
    }

    // Optional tracking section
    if (enableTracking) {
      const trackingSection = container.createDiv({
        cls: "sm-cc-uses-tracking-section",
      });

      trackingSection.createDiv({
        text: "Current Uses:",
        cls: "sm-cc-uses-section-label",
      });

      const trackingWrapper = trackingSection.createDiv({
        cls: "sm-cc-uses-tracking-wrapper",
      });

      // Decrement button
      const decrementBtn = trackingWrapper.createEl("button", {
        cls: "sm-cc-uses-tracking-btn",
        text: "-",
        attr: {
          type: "button",
          "aria-label": "Use one charge",
          disabled: (remainingUses ?? 0) <= 0 ? "" : undefined,
        },
      });

      decrementBtn.onclick = () => {
        if (remainingUses !== undefined && remainingUses > 0) {
          remainingUses--;
          render();
        }
      };

      // Current/Max display
      const displayText = trackingWrapper.createDiv({
        cls: "sm-cc-uses-tracking-display",
        text: `${remainingUses ?? currentUses.count} / ${currentUses.count}`,
      });

      // Increment button
      const incrementBtn = trackingWrapper.createEl("button", {
        cls: "sm-cc-uses-tracking-btn",
        text: "+",
        attr: {
          type: "button",
          "aria-label": "Restore one charge",
          disabled:
            (remainingUses ?? currentUses.count) >= currentUses.count ? "" : undefined,
        },
      });

      incrementBtn.onclick = () => {
        if (
          remainingUses !== undefined &&
          currentUses &&
          remainingUses < currentUses.count
        ) {
          remainingUses++;
          render();
        }
      };

      // Reset button
      const resetBtn = trackingWrapper.createEl("button", {
        cls: "sm-cc-uses-tracking-reset-btn",
        text: "Reset",
        attr: {
          type: "button",
          "aria-label": "Reset uses to maximum",
        },
      });

      resetBtn.onclick = () => {
        if (currentUses) {
          remainingUses = currentUses.count;
          render();
        }
      };
    }

    // Preview output
    const preview = container.createDiv({ cls: "sm-cc-uses-preview" });
    preview.createDiv({
      text: "Output Preview:",
      cls: "sm-cc-uses-preview-label",
    });
    preview.createDiv({
      text: formatUsesOutput(currentUses),
      cls: "sm-cc-uses-preview-text",
    });
  };

  /**
   * Validates the uses configuration
   */
  const validate = (): string[] => {
    const errors: string[] = [];

    if (currentUses) {
      if (currentUses.count < 1 || currentUses.count > 99) {
        errors.push("Uses count must be between 1 and 99");
      }

      if (!currentUses.per || !currentUses.per.trim()) {
        errors.push("Reset period is required");
      }
    }

    return errors;
  };

  // Initial render
  render();

  const handle: UsesComponentHandle = {
    container,
    getValue: () => currentUses,
    setValue: (uses) => {
      currentUses = uses;
      remainingUses = uses?.count;
      if (uses && !isStandardPeriod(uses.per)) {
        customText = uses.per;
      }
      render();
    },
    refresh: render,
    validate,
  };

  // Add tracking methods if enabled
  if (enableTracking) {
    handle.getRemainingUses = () => remainingUses ?? currentUses?.count ?? 0;
    handle.setRemainingUses = (remaining) => {
      if (currentUses && remaining >= 0 && remaining <= currentUses.count) {
        remainingUses = remaining;
        render();
      }
    };
  }

  return handle;
}

/**
 * Checks if a period string is a standard option
 */
function isStandardPeriod(per: string): boolean {
  return ["day", "short", "long", "dawn", "dusk", "rest"].includes(per);
}

/**
 * Formats a uses component for display/output
 *
 * @example
 * ```ts
 * formatUsesOutput({ type: "uses", count: 2, per: "day" })
 * // "(2/Day)"
 *
 * formatUsesOutput({ type: "uses", count: 3, per: "long" })
 * // "(3/Long Rest)"
 *
 * formatUsesOutput({ type: "uses", count: 1, per: "dawn" })
 * // "(1/Dawn)"
 *
 * formatUsesOutput({ type: "uses", count: 5, per: "Battle" })
 * // "(5/Battle)"
 * ```
 */
export function formatUsesOutput(uses: UsesComponent): string {
  if (!uses) return "";

  const periodMap: Record<string, string> = {
    day: "Day",
    short: "Short Rest",
    long: "Long Rest",
    dawn: "Dawn",
    dusk: "Dusk",
    rest: "Rest",
  };

  const periodText = periodMap[uses.per] || uses.per;

  return `(${uses.count}/${periodText})`;
}

/**
 * Validates a uses component and returns validation errors
 */
export function validateUsesComponent(uses: UsesComponent): string[] {
  const errors: string[] = [];

  if (uses.count < 1 || uses.count > 99) {
    errors.push("Uses count must be between 1 and 99");
  }

  if (!uses.per || !uses.per.trim()) {
    errors.push("Reset period is required");
  }

  return errors;
}

/**
 * Parses a uses string into a UsesComponent
 *
 * @example
 * ```ts
 * parseUsesString("2/Day")
 * // { type: "uses", count: 2, per: "day" }
 *
 * parseUsesString("(3/Long Rest)")
 * // { type: "uses", count: 3, per: "long" }
 *
 * parseUsesString("1/Dawn")
 * // { type: "uses", count: 1, per: "dawn" }
 *
 * parseUsesString("5/Battle")
 * // { type: "uses", count: 5, per: "Battle" }
 * ```
 */
export function parseUsesString(str: string): UsesComponent | undefined {
  if (!str) return undefined;

  // Match patterns like "2/Day", "(3/Long Rest)", "1/Dawn"
  const match = str.match(/(\d+)\s*\/\s*(.+?)(?:\)|$)/i);

  if (!match) return undefined;

  const count = parseInt(match[1], 10);
  let per = match[2].trim();

  // Normalize common patterns to standard periods
  const normalizeMap: Record<string, string> = {
    day: "day",
    "short rest": "short",
    "long rest": "long",
    dawn: "dawn",
    dusk: "dusk",
    rest: "rest",
  };

  const normalized = normalizeMap[per.toLowerCase()];
  if (normalized) {
    per = normalized;
  }

  return {
    type: "uses",
    count,
    per,
  };
}
