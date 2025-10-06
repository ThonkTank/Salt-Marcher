// src/apps/library/create/creature/components/save-component.ts
// Modular Save component for creature abilities that require saving throws

import { createTextInput, createSelectDropdown, createTextArea, createNumberInput, createCheckbox } from "../../shared/form-controls";
import { abilityMod, formatSigned, parseIntSafe } from "../../shared/stat-utils";
import type { CreatureEntry } from "../entry-model";
import type { StatblockData } from "../../../core/creature-files";
import { CREATURE_SAVE_OPTIONS, CREATURE_ABILITY_LABELS } from "../presets";

/**
 * Options for creating a save component
 */
export interface SaveComponentOptions {
  entry: CreatureEntry;
  data: StatblockData;
  onUpdate: () => void;
  /**
   * Whether to enable auto-DC calculation from spellcasting ability
   * If true, shows "Auto" option in DC field
   */
  enableAutoDC?: boolean;
}

/**
 * Handle for interacting with a save component
 */
export interface SaveComponentHandle {
  /** The root container element */
  container: HTMLElement;
  /** Refresh the component to reflect entry changes */
  refresh: () => void;
  /** Validate and return list of validation errors */
  validate: () => string[];
}

/**
 * Common success effect presets
 */
const SUCCESS_EFFECT_PRESETS = [
  "Half damage",
  "No effect",
  "Takes half damage",
  "Takes no damage",
] as const;

/**
 * Calculates save DC from spellcasting ability
 * Formula: 8 + proficiency bonus + ability modifier
 */
function calculateSpellSaveDC(
  spellAbility: string | undefined,
  data: StatblockData
): number | undefined {
  if (!spellAbility) return undefined;

  const pb = parseIntSafe(data.pb as any) || 0;
  const abilMod = abilityMod((data as any)[spellAbility]);

  return 8 + pb + abilMod;
}

/**
 * Creates a save component for saving throw mechanics
 *
 * Features:
 * - Save ability selector (STR, DEX, CON, INT, WIS, CHA)
 * - DC field with optional auto-calculation
 * - Failure effect text area
 * - Success effect with quick presets
 * - Optional "Save at end of turn" checkbox
 *
 * @example
 * ```ts
 * const handle = createSaveComponent(container, {
 *   entry: myEntry,
 *   data: statblockData,
 *   onUpdate: () => console.log("Updated"),
 *   enableAutoDC: true
 * });
 * ```
 */
export function createSaveComponent(
  parent: HTMLElement,
  options: SaveComponentOptions
): SaveComponentHandle {
  const { entry, data, onUpdate, enableAutoDC = false } = options;

  const container = parent.createDiv({ cls: "sm-cc-save-component" });

  // Store current UI state
  let dcMode: "manual" | "auto" = "manual";
  let dcInput: HTMLInputElement;
  let dcCalcAbilitySelect: HTMLSelectElement;
  let successTextInput: HTMLInputElement;
  let failureTextArea: HTMLTextAreaElement;

  // Initialize DC mode and calculation ability from entry
  if (enableAutoDC && entry.spellAbility) {
    dcMode = "auto";
  }

  /**
   * Renders the complete save component UI
   */
  const render = () => {
    container.empty();

    // Two-column layout grid
    const grid = container.createDiv({ cls: "sm-cc-save-grid" });

    // === Row 1: Save Ability and DC ===

    // Save Ability
    grid.createEl("label", { text: "Save Ability", cls: "sm-cc-save-label" });
    const saveAbilityWrapper = grid.createDiv({ cls: "sm-cc-save-ability-wrapper" });

    const saveAbilityHandle = createSelectDropdown(saveAbilityWrapper, {
      options: CREATURE_SAVE_OPTIONS.map((v) => ({
        value: v,
        label: v || "(None)"
      })),
      value: entry.save_ability || "",
      ariaLabel: "Save Ability",
      onChange: (value) => {
        entry.save_ability = value || undefined;
        onUpdate();
      },
    });

    // DC Field
    grid.createEl("label", { text: "DC", cls: "sm-cc-save-label" });
    const dcWrapper = grid.createDiv({ cls: "sm-cc-save-dc-wrapper" });

    if (enableAutoDC) {
      // DC mode toggle (Manual / Auto)
      const dcModeToggle = dcWrapper.createDiv({ cls: "sm-cc-save-dc-mode-toggle" });

      const manualBtn = dcModeToggle.createEl("button", {
        cls: dcMode === "manual" ? "sm-cc-toggle-btn active" : "sm-cc-toggle-btn",
        text: "Manual",
        attr: { type: "button", "aria-label": "Manual DC" }
      });

      const autoBtn = dcModeToggle.createEl("button", {
        cls: dcMode === "auto" ? "sm-cc-toggle-btn active" : "sm-cc-toggle-btn",
        text: "Auto",
        attr: { type: "button", "aria-label": "Auto DC from spellcasting" }
      });

      manualBtn.onclick = () => {
        dcMode = "manual";
        render();
      };

      autoBtn.onclick = () => {
        dcMode = "auto";
        render();
      };
    }

    const dcInputWrapper = dcWrapper.createDiv({ cls: "sm-cc-save-dc-input-wrapper" });

    if (dcMode === "manual") {
      // Manual DC number input
      dcInput = createNumberInput(dcInputWrapper, {
        placeholder: "15",
        ariaLabel: "Save DC",
        value: entry.save_dc,
        min: 1,
        max: 30,
        onChange: (value) => {
          entry.save_dc = value;
          onUpdate();
        },
      });
      (dcInput.style as any).width = "5ch";
    } else {
      // Auto DC calculation from spell ability
      const autoWrapper = dcInputWrapper.createDiv({ cls: "sm-cc-save-dc-auto" });

      autoWrapper.createSpan({
        text: "8 + Prof + ",
        cls: "sm-cc-save-dc-formula"
      });

      dcCalcAbilitySelect = createSelectDropdown(autoWrapper, {
        className: "sm-cc-save-dc-ability-select",
        options: [
          { value: "", label: "(None)" },
          ...CREATURE_ABILITY_LABELS.map((label) => ({
            value: label.toLowerCase(),
            label
          })),
        ],
        value: entry.spellAbility || "",
        ariaLabel: "Spellcasting Ability for DC",
        onChange: (value) => {
          entry.spellAbility = (value || undefined) as any;

          // Calculate and set DC
          if (value) {
            const calculatedDC = calculateSpellSaveDC(value, data);
            entry.save_dc = calculatedDC;
          } else {
            entry.save_dc = undefined;
          }

          render();
          onUpdate();
        },
      }).element;

      // Display calculated DC
      if (entry.spellAbility && entry.save_dc) {
        autoWrapper.createSpan({
          text: ` = DC ${entry.save_dc}`,
          cls: "sm-cc-save-dc-result"
        });
      }
    }

    // === Row 2: Failure Effect ===

    grid.createEl("label", {
      text: "On Failure",
      cls: "sm-cc-save-label sm-cc-save-label--span-full",
      attr: { style: "grid-column: 1 / -1;" }
    });

    failureTextArea = createTextArea(grid, {
      className: "sm-cc-save-failure-text",
      placeholder: "59 (17d6) fire damage",
      ariaLabel: "Failure Effect",
      value: entry.text || "",
      minHeight: 60,
      onInput: (value) => {
        entry.text = value;
        onUpdate();
      },
    });
    (failureTextArea.style as any).gridColumn = "1 / -1";

    // === Row 3: Success Effect ===

    grid.createEl("label", {
      text: "On Success",
      cls: "sm-cc-save-label",
    });

    const successWrapper = grid.createDiv({ cls: "sm-cc-save-success-wrapper" });

    // Quick preset buttons
    const presetButtons = successWrapper.createDiv({ cls: "sm-cc-save-preset-buttons" });

    SUCCESS_EFFECT_PRESETS.forEach((preset) => {
      const btn = presetButtons.createEl("button", {
        cls: "sm-cc-save-preset-btn",
        text: preset,
        attr: { type: "button", "aria-label": `Set success effect to: ${preset}` }
      });

      // Highlight if currently selected
      if (entry.save_effect === preset) {
        btn.addClass("active");
      }

      btn.onclick = () => {
        entry.save_effect = preset;
        successTextInput.value = preset;
        onUpdate();
        render();
      };
    });

    // Custom text input
    successTextInput = createTextInput(successWrapper, {
      className: "sm-cc-save-success-input",
      placeholder: "Half damage / No effect / Custom...",
      ariaLabel: "Success Effect",
      value: entry.save_effect || "",
      onInput: (value) => {
        entry.save_effect = value.trim() || undefined;
        onUpdate();
      },
    });

    // === Row 4: Optional "Save at end of turn" checkbox ===

    const optionsRow = grid.createDiv({
      cls: "sm-cc-save-options",
      attr: { style: "grid-column: 1 / -1; margin-top: 0.5rem;" }
    });

    createCheckbox(optionsRow, {
      label: "Save at end of each turn",
      checked: entry.recharge?.includes("end of") || false,
      ariaLabel: "Repeat save at end of turn",
      onChange: (checked) => {
        if (checked) {
          entry.recharge = "Save at end of each turn";
        } else {
          entry.recharge = undefined;
        }
        onUpdate();
      },
    });
  };

  /**
   * Validates the save component configuration
   */
  const validate = (): string[] => {
    const errors: string[] = [];
    const label = entry.name || "Save";

    if (!entry.save_ability) {
      errors.push(`${label}: Save ability is required`);
    }

    if (!entry.save_dc || entry.save_dc <= 0) {
      errors.push(`${label}: Valid DC is required (1-30)`);
    }

    if (!entry.text?.trim()) {
      errors.push(`${label}: Failure effect is required`);
    }

    return errors;
  };

  // Initial render
  render();

  return {
    container,
    refresh: render,
    validate,
  };
}

/**
 * Formats a save component for display/output
 *
 * @example
 * ```ts
 * const output = formatSaveOutput(entry);
 * // "Dexterity Saving Throw: DC 21"
 * // "Failure: 59 (17d6) fire damage"
 * // "Success: Half damage"
 * ```
 */
export function formatSaveOutput(entry: CreatureEntry): string {
  const lines: string[] = [];

  // Save line
  if (entry.save_ability && entry.save_dc) {
    const abilityName = entry.save_ability;
    const abilityFull = {
      STR: "Strength",
      DEX: "Dexterity",
      CON: "Constitution",
      INT: "Intelligence",
      WIS: "Wisdom",
      CHA: "Charisma",
    }[abilityName] || abilityName;

    lines.push(`${abilityFull} Saving Throw: DC ${entry.save_dc}`);
  }

  // Failure effect
  if (entry.text) {
    lines.push(`Failure: ${entry.text}`);
  }

  // Success effect
  if (entry.save_effect) {
    lines.push(`Success: ${entry.save_effect}`);
  }

  // Recurring save
  if (entry.recharge?.includes("end of")) {
    lines.push(`(${entry.recharge})`);
  }

  return lines.join("\n");
}

/**
 * Validates a save entry and returns validation errors
 */
export function validateSaveEntry(entry: CreatureEntry): string[] {
  const errors: string[] = [];
  const label = entry.name || "Save Entry";

  // Validate save ability
  if (entry.save_ability && !CREATURE_SAVE_OPTIONS.includes(entry.save_ability as any)) {
    errors.push(`${label}: Invalid save ability "${entry.save_ability}"`);
  }

  // Validate DC
  if (entry.save_dc !== undefined) {
    if (Number.isNaN(entry.save_dc) || entry.save_dc < 1 || entry.save_dc > 30) {
      errors.push(`${label}: DC must be between 1 and 30`);
    }
  }

  // Check for incomplete configuration
  if (entry.save_ability && !entry.save_dc) {
    errors.push(`${label}: DC is required when save ability is set`);
  }

  if (entry.save_dc && !entry.save_ability) {
    errors.push(`${label}: Save ability is required when DC is set`);
  }

  if ((entry.save_ability || entry.save_dc) && !entry.text?.trim()) {
    errors.push(`${label}: Failure effect is required for saving throw`);
  }

  return errors;
}
