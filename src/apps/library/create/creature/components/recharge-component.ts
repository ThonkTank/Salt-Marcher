// src/apps/library/create/creature/components/recharge-component.ts
// Modular Recharge component for abilities with dice-based recharge mechanics

import { createSelectDropdown, createTextInput } from "../../shared/form-controls";
import type { RechargeComponent } from "./types";

/**
 * Options for creating a recharge component
 */
export interface RechargeComponentOptions {
  /** Initial recharge configuration */
  recharge?: RechargeComponent;
  /** Callback when recharge data changes */
  onUpdate: (recharge: RechargeComponent | undefined) => void;
  /** Optional compact mode for inline display */
  compact?: boolean;
}

/**
 * Handle for interacting with a recharge component
 */
export interface RechargeComponentHandle {
  /** The root container element */
  container: HTMLElement;
  /** Get current recharge configuration */
  getValue: () => RechargeComponent | undefined;
  /** Set recharge configuration */
  setValue: (recharge: RechargeComponent | undefined) => void;
  /** Refresh the component display */
  refresh: () => void;
  /** Validate and return list of validation errors */
  validate: () => string[];
}

/**
 * Common recharge presets for quick selection
 */
const RECHARGE_PRESETS = [
  { min: 5, max: 6, label: "5-6" },
  { min: 6, max: 6, label: "6" },
  { min: 4, max: 6, label: "4-6" },
  { min: 3, max: 6, label: "3-6" },
] as const;

/**
 * Timing options for when recharge roll occurs
 */
const TIMING_OPTIONS = [
  { value: "", label: "Not specified" },
  { value: "start of turn", label: "Start of turn" },
  { value: "end of turn", label: "End of turn" },
  { value: "start of combat", label: "Start of combat" },
  { value: "after use", label: "After use" },
] as const;

/**
 * Creates a recharge component for dice-based recharge mechanics
 *
 * Features:
 * - Quick preset buttons for common ranges (5-6, 6, 4-6, etc.)
 * - Visual die representation with selected range
 * - Custom range selection (min-max)
 * - Timing selector (start/end of turn)
 * - Compact inline mode
 *
 * Outputs format: "(Recharge 5-6)", "(Recharge 6)", "(Recharge 4-6 at start of turn)"
 *
 * @example
 * ```ts
 * const handle = createRechargeComponent(container, {
 *   recharge: { type: "recharge", min: 5, max: 6 },
 *   onUpdate: (recharge) => console.log("Updated:", recharge),
 *   compact: false
 * });
 * ```
 */
export function createRechargeComponent(
  parent: HTMLElement,
  options: RechargeComponentOptions
): RechargeComponentHandle {
  const { onUpdate, compact = false } = options;

  // Internal state
  let currentRecharge: RechargeComponent | undefined = options.recharge;

  const container = parent.createDiv({
    cls: compact ? "sm-cc-recharge-component sm-cc-recharge-component--compact" : "sm-cc-recharge-component",
  });

  /**
   * Renders the complete recharge component UI
   */
  const render = () => {
    container.empty();

    // Header with toggle
    const header = container.createDiv({ cls: "sm-cc-recharge-header" });

    const enableCheckbox = header.createEl("input", {
      cls: "sm-cc-recharge-toggle",
      attr: {
        type: "checkbox",
        "aria-label": "Enable recharge mechanic",
      },
    }) as HTMLInputElement;

    enableCheckbox.checked = !!currentRecharge;

    header.createEl("label", {
      text: "Recharge Mechanic",
      cls: "sm-cc-recharge-label",
    });

    // Die icon for visual representation
    const dieIcon = header.createDiv({ cls: "sm-cc-recharge-die-icon" });
    dieIcon.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
        <circle cx="12" cy="12" r="1.5" fill="currentColor"/>
        <circle cx="8" cy="8" r="1.5" fill="currentColor"/>
        <circle cx="16" cy="8" r="1.5" fill="currentColor"/>
        <circle cx="8" cy="16" r="1.5" fill="currentColor"/>
        <circle cx="16" cy="16" r="1.5" fill="currentColor"/>
      </svg>
    `;

    // Toggle enable/disable
    enableCheckbox.addEventListener("change", () => {
      if (enableCheckbox.checked) {
        // Enable with default preset (5-6)
        currentRecharge = {
          type: "recharge",
          min: 5,
          max: 6,
        };
      } else {
        // Disable
        currentRecharge = undefined;
      }
      onUpdate(currentRecharge);
      render();
    });

    // Only show configuration if enabled
    if (!currentRecharge) {
      return;
    }

    // Preset buttons section
    const presetsSection = container.createDiv({ cls: "sm-cc-recharge-presets" });
    presetsSection.createDiv({
      text: "Quick Presets:",
      cls: "sm-cc-recharge-presets-label",
    });

    const presetsButtons = presetsSection.createDiv({
      cls: "sm-cc-recharge-preset-buttons",
    });

    RECHARGE_PRESETS.forEach((preset) => {
      const isActive =
        currentRecharge?.min === preset.min && currentRecharge?.max === preset.max;

      const btn = presetsButtons.createEl("button", {
        cls: isActive
          ? "sm-cc-recharge-preset-btn active"
          : "sm-cc-recharge-preset-btn",
        text: preset.label,
        attr: {
          type: "button",
          "aria-label": `Set recharge to ${preset.label}`,
          "aria-pressed": String(isActive),
        },
      });

      btn.onclick = () => {
        currentRecharge = {
          type: "recharge",
          min: preset.min,
          max: preset.max,
          timing: currentRecharge?.timing,
        };
        onUpdate(currentRecharge);
        render();
      };
    });

    // Custom range section
    const customSection = container.createDiv({ cls: "sm-cc-recharge-custom" });
    customSection.createDiv({
      text: "Custom Range:",
      cls: "sm-cc-recharge-custom-label",
    });

    const customGrid = customSection.createDiv({ cls: "sm-cc-recharge-custom-grid" });

    // Min value selector
    const minWrapper = customGrid.createDiv({ cls: "sm-cc-recharge-input-wrapper" });
    minWrapper.createSpan({ text: "Min:", cls: "sm-cc-recharge-input-label" });

    const minSelect = createSelectDropdown(minWrapper, {
      className: "sm-cc-recharge-select",
      options: [1, 2, 3, 4, 5, 6].map((n) => ({ value: n, label: String(n) })),
      value: currentRecharge.min,
      ariaLabel: "Minimum recharge roll",
      onChange: (value) => {
        if (currentRecharge) {
          currentRecharge.min = Number(value);
          // Ensure max is at least min
          if (currentRecharge.max && currentRecharge.max < currentRecharge.min) {
            currentRecharge.max = currentRecharge.min;
          }
          onUpdate(currentRecharge);
          render();
        }
      },
    }).element;

    // Max value selector
    const maxWrapper = customGrid.createDiv({ cls: "sm-cc-recharge-input-wrapper" });
    maxWrapper.createSpan({ text: "Max:", cls: "sm-cc-recharge-input-label" });

    const maxSelect = createSelectDropdown(maxWrapper, {
      className: "sm-cc-recharge-select",
      options: [1, 2, 3, 4, 5, 6].map((n) => ({ value: n, label: String(n) })),
      value: currentRecharge.max || 6,
      ariaLabel: "Maximum recharge roll",
      onChange: (value) => {
        if (currentRecharge) {
          currentRecharge.max = Number(value);
          onUpdate(currentRecharge);
          render();
        }
      },
    }).element;

    // Visual die representation
    const dieVisual = container.createDiv({ cls: "sm-cc-recharge-die-visual" });
    renderDieVisual(dieVisual, currentRecharge.min, currentRecharge.max || 6);

    // Timing selector
    const timingSection = container.createDiv({ cls: "sm-cc-recharge-timing" });
    timingSection.createDiv({
      text: "Recharge Timing:",
      cls: "sm-cc-recharge-timing-label",
    });

    const timingSelect = createSelectDropdown(timingSection, {
      className: "sm-cc-recharge-timing-select",
      options: TIMING_OPTIONS,
      value: currentRecharge.timing || "",
      ariaLabel: "When recharge roll occurs",
      onChange: (value) => {
        if (currentRecharge) {
          currentRecharge.timing = value || undefined;
          onUpdate(currentRecharge);
        }
      },
    }).element;

    // Preview output
    const preview = container.createDiv({ cls: "sm-cc-recharge-preview" });
    preview.createDiv({
      text: "Output Preview:",
      cls: "sm-cc-recharge-preview-label",
    });
    preview.createDiv({
      text: formatRechargeOutput(currentRecharge),
      cls: "sm-cc-recharge-preview-text",
    });
  };

  /**
   * Renders a visual die with highlighted faces
   */
  const renderDieVisual = (container: HTMLElement, min: number, max: number) => {
    container.empty();

    for (let face = 1; face <= 6; face++) {
      const isInRange = face >= min && face <= max;
      const faceEl = container.createDiv({
        cls: isInRange
          ? "sm-cc-recharge-die-face active"
          : "sm-cc-recharge-die-face",
        text: String(face),
        attr: {
          "aria-label": isInRange
            ? `Face ${face} (in recharge range)`
            : `Face ${face}`,
          role: "presentation",
        },
      });
    }
  };

  /**
   * Validates the recharge configuration
   */
  const validate = (): string[] => {
    const errors: string[] = [];

    if (currentRecharge) {
      if (currentRecharge.min < 1 || currentRecharge.min > 6) {
        errors.push("Recharge minimum must be between 1 and 6");
      }

      if (currentRecharge.max && currentRecharge.max < currentRecharge.min) {
        errors.push("Recharge maximum must be greater than or equal to minimum");
      }

      if (currentRecharge.max && (currentRecharge.max < 1 || currentRecharge.max > 6)) {
        errors.push("Recharge maximum must be between 1 and 6");
      }
    }

    return errors;
  };

  // Initial render
  render();

  return {
    container,
    getValue: () => currentRecharge,
    setValue: (recharge) => {
      currentRecharge = recharge;
      render();
    },
    refresh: render,
    validate,
  };
}

/**
 * Formats a recharge component for display/output
 *
 * @example
 * ```ts
 * formatRechargeOutput({ type: "recharge", min: 5, max: 6 })
 * // "(Recharge 5-6)"
 *
 * formatRechargeOutput({ type: "recharge", min: 6, max: 6 })
 * // "(Recharge 6)"
 *
 * formatRechargeOutput({ type: "recharge", min: 5, max: 6, timing: "start of turn" })
 * // "(Recharge 5-6 at start of turn)"
 * ```
 */
export function formatRechargeOutput(recharge: RechargeComponent): string {
  if (!recharge) return "";

  const max = recharge.max ?? 6;
  let rangeText: string;

  if (recharge.min === max) {
    // Single number (e.g., "6")
    rangeText = String(recharge.min);
  } else if (max === 6) {
    // Standard range ending at 6 (e.g., "5-6")
    rangeText = `${recharge.min}-6`;
  } else {
    // Custom range (e.g., "3-5")
    rangeText = `${recharge.min}-${max}`;
  }

  let output = `(Recharge ${rangeText}`;

  if (recharge.timing) {
    output += ` at ${recharge.timing}`;
  }

  output += ")";

  return output;
}

/**
 * Validates a recharge component and returns validation errors
 */
export function validateRechargeComponent(recharge: RechargeComponent): string[] {
  const errors: string[] = [];

  if (recharge.min < 1 || recharge.min > 6) {
    errors.push("Recharge minimum must be between 1 and 6");
  }

  if (recharge.max !== undefined) {
    if (recharge.max < recharge.min) {
      errors.push("Recharge maximum must be greater than or equal to minimum");
    }
    if (recharge.max < 1 || recharge.max > 6) {
      errors.push("Recharge maximum must be between 1 and 6");
    }
  }

  return errors;
}

/**
 * Parses a recharge string into a RechargeComponent
 *
 * @example
 * ```ts
 * parseRechargeString("Recharge 5-6")
 * // { type: "recharge", min: 5, max: 6 }
 *
 * parseRechargeString("Recharge 6")
 * // { type: "recharge", min: 6, max: 6 }
 *
 * parseRechargeString("(Recharge 4-6 at start of turn)")
 * // { type: "recharge", min: 4, max: 6, timing: "start of turn" }
 * ```
 */
export function parseRechargeString(str: string): RechargeComponent | undefined {
  if (!str) return undefined;

  // Match patterns like "Recharge 5-6", "(Recharge 6)", "Recharge 4-6 at start of turn"
  const match = str.match(/recharge\s+(\d+)(?:-(\d+))?(?:\s+at\s+(.+?))?(?:\)|$)/i);

  if (!match) return undefined;

  const min = parseInt(match[1], 10);
  const max = match[2] ? parseInt(match[2], 10) : min;
  const timing = match[3]?.trim();

  return {
    type: "recharge",
    min,
    max,
    timing: timing || undefined,
  };
}
