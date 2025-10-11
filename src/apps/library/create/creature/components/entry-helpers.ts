// src/apps/library/create/creature/components/attack-component.ts
// Modular Attack Component for the entry system
// Self-contained component with auto-calculation, attack type selection, and range/reach fields

import {
  createCheckbox,
  createSelectDropdown,
  createTextInput,
} from "../../../../../ui/workmode/create";
import { EntryAutoCalculator } from "../../shared/auto-calc";
import type { CreatureEntry } from "../entry-model";
import type { StatblockData } from "../../../core/creature-files";
import { CREATURE_ABILITY_SELECTIONS } from "../presets";

/**
 * Attack type determines which range fields to show
 */
export type AttackType = "melee" | "ranged" | "";

/**
 * Configuration for the attack component
 */
export interface AttackComponentConfig {
  entry: CreatureEntry;
  data: StatblockData;
  entryIndex: number;
  onUpdate: () => void;
}

/**
 * Extended entry interface with attack-specific fields
 */
interface AttackEntry extends CreatureEntry {
  attack_type?: AttackType;
  melee_reach?: string;
  ranged_short?: string;
  ranged_long?: string;
}

/**
 * Helper function to create a tooltip icon with hover effect
 */
function createTooltipIcon(parent: HTMLElement, tooltipText: string): HTMLElement {
  const icon = parent.createSpan({
    cls: "sm-cc-tooltip-icon",
    text: "ℹ",
    attr: {
      "aria-label": tooltipText,
      "title": tooltipText
    }
  });
  return icon;
}

/**
 * Triggers a visual flash animation when a value is auto-calculated
 */
function triggerCalculationFlash(element: HTMLInputElement): void {
  element.classList.add("sm-cc-input--calculated");
  setTimeout(() => {
    element.classList.remove("sm-cc-input--calculated");
  }, 300);
}

/**
 * Updates the tooltip attribute on an input element
 */
function updateInputTooltip(element: HTMLInputElement, tooltipText: string | undefined): void {
  if (tooltipText) {
    element.setAttribute("title", tooltipText);
    element.classList.add("sm-cc-input--has-tooltip");
  } else {
    element.removeAttribute("title");
    element.classList.remove("sm-cc-input--has-tooltip");
  }
}

/**
 * Formats output text for attack roll display
 */
export function formatAttackOutput(entry: AttackEntry): string {
  const parts: string[] = [];

  // Attack type
  const attackType = entry.attack_type || "";
  if (attackType === "melee") {
    parts.push("Melee Attack Roll:");
  } else if (attackType === "ranged") {
    parts.push("Ranged Attack Roll:");
  } else {
    parts.push("Attack Roll:");
  }

  // To hit
  if (entry.to_hit) {
    parts.push(entry.to_hit);
  }

  // Reach or Range
  if (attackType === "melee" && entry.melee_reach) {
    parts.push(`reach ${entry.melee_reach}`);
  } else if (attackType === "ranged" && (entry.ranged_short || entry.ranged_long)) {
    const short = entry.ranged_short || "?";
    const long = entry.ranged_long || "?";
    parts.push(`range ${short}/${long} ft.`);
  } else if (entry.range) {
    // Fallback to legacy range field
    parts.push(entry.range);
  }

  // Target
  if (entry.target) {
    parts.push(entry.target);
  }

  return parts.join(", ");
}

/**
 * Creates a compact, self-contained attack component
 * Includes attack type selection, auto-calculation, and range/reach fields
 */
export function createAttackComponent(
  parent: HTMLElement,
  config: AttackComponentConfig
): HTMLElement {
  const { entry, data, entryIndex, onUpdate } = config;
  const attackEntry = entry as AttackEntry;

  // Main container
  const container = parent.createDiv({ cls: "sm-cc-attack-component" });

  // Calculator instance
  const calculator = new EntryAutoCalculator(entry, data, undefined);

  // === HEADER ROW: Attack Type Selector ===
  const headerRow = container.createDiv({ cls: "sm-cc-attack-header" });
  headerRow.createEl("label", { text: "Attack Type:", cls: "sm-cc-attack-label" });

  const attackTypeHandle = createSelectDropdown(headerRow, {
    className: "sm-cc-attack-type-select",
    options: [
      { value: "", label: "(Not specified)" },
      { value: "melee", label: "Melee" },
      { value: "ranged", label: "Ranged" }
    ],
    value: attackEntry.attack_type || "",
    onChange: (value) => {
      attackEntry.attack_type = value as AttackType;
      updateRangeFieldsVisibility();
      onUpdate();
    },
  });

  // === AUTO-CALCULATION ROW ===
  const autoRow = container.createDiv({ cls: "sm-cc-attack-auto-row" });

  // Ability selector (shared for to-hit and damage)
  const abilityGroup = autoRow.createDiv({ cls: "sm-cc-attack-group" });
  const abilityLabel = abilityGroup.createSpan({ text: "Ability:", cls: "sm-cc-attack-sublabel" });
  createTooltipIcon(abilityLabel, "Ability modifier used for attack and damage calculations");

  const abilityHandle = createSelectDropdown<string>(abilityGroup, {
    className: "sm-cc-attack-ability-select",
    options: CREATURE_ABILITY_SELECTIONS.map((v) => ({
      value: v as string,
      label: v === "best_of_str_dex" ? "Best of STR/DEX" : (v || "(none)")
    })),
    value: (entry.to_hit_from?.ability || entry.damage_from?.ability || "") as string,
    enableSearch: true,
    searchPlaceholder: "Search ability...",
    onChange: (value: string) => {
      // Update to-hit calculation
      const proficient = toHitProfCheckbox.checked;
      if (value) {
        calculator.setToHitAuto({ ability: value, proficient });
        triggerCalculationFlash(toHitInput);
      } else {
        calculator.setToHitAuto(undefined);
      }
      toHitInput.value = entry.to_hit || "";
      updateInputTooltip(toHitInput, calculator.getToHitTooltipText());

      // Update damage calculation
      const dice = dmgDiceInput.value.trim() || entry.damage_from?.dice || "";
      const bonus = dmgBonusInput.value.trim() || entry.damage_from?.bonus || "";
      if (dice) {
        calculator.setDamageAuto({ dice, ability: value || undefined, bonus: bonus || undefined });
        dmgInput.value = entry.damage || "";
        triggerCalculationFlash(dmgInput);
        updateInputTooltip(dmgInput, calculator.getDamageTooltipText());
      } else if (entry.damage_from) {
        calculator.apply();
        dmgInput.value = entry.damage || "";
        updateInputTooltip(dmgInput, calculator.getDamageTooltipText());
      }
      onUpdate();
    },
  });
  (abilityHandle.element.style as any).width = "12ch";

  // To Hit group (with proficiency checkbox)
  const hitGroup = autoRow.createDiv({ cls: "sm-cc-attack-group" });
  const hitLabel = hitGroup.createSpan({ text: "To Hit:", cls: "sm-cc-attack-sublabel" });

  // Proficiency checkbox
  const profCheckboxContainer = hitGroup.createDiv({ cls: "sm-cc-attack-checkbox" });
  const toHitProfCheckbox = profCheckboxContainer.createEl("input", {
    attr: {
      type: "checkbox",
      id: `attack-prof-${entryIndex}`,
      title: "Add proficiency bonus to attack roll"
    },
  }) as HTMLInputElement;
  toHitProfCheckbox.checked = entry.to_hit_from?.proficient || false;
  toHitProfCheckbox.onchange = () => {
    const ability = abilityHandle.getValue();
    if (ability) {
      calculator.setToHitAuto({ ability, proficient: toHitProfCheckbox.checked });
      toHitInput.value = entry.to_hit || "";
      triggerCalculationFlash(toHitInput);
      updateInputTooltip(toHitInput, calculator.getToHitTooltipText());
      onUpdate();
    }
  };

  const profLabel = profCheckboxContainer.createEl("label", {
    text: "Prof",
    attr: { for: `attack-prof-${entryIndex}` }
  });
  createTooltipIcon(profLabel, "Proficiency: +2 to +6 based on CR");

  // To Hit input (displays calculated or manual value)
  const toHitInput = createTextInput(hitGroup, {
    className: "sm-cc-attack-input sm-cc-attack-tohit",
    placeholder: "auto",
    ariaLabel: "To hit bonus",
    value: entry.to_hit || "",
    onInput: (value) => {
      entry.to_hit = value.trim() || undefined;
      onUpdate();
    },
  });
  (toHitInput.style as any).width = "6ch";

  // Damage group
  const dmgGroup = autoRow.createDiv({ cls: "sm-cc-attack-group sm-cc-attack-group--damage" });
  const damageLabel = dmgGroup.createSpan({ text: "Damage:", cls: "sm-cc-attack-sublabel" });
  createTooltipIcon(damageLabel, "Auto-calculated: dice + ability modifier + type");

  // Damage dice input
  const dmgDiceInput = createTextInput(dmgGroup, {
    className: "sm-cc-attack-input",
    placeholder: "1d8",
    ariaLabel: "Damage dice",
    value: entry.damage_from?.dice || "",
    onInput: (value) => {
      const ability = abilityHandle.getValue() || entry.damage_from?.ability || undefined;
      const bonus = dmgBonusInput.value.trim() || entry.damage_from?.bonus || undefined;
      if (value.trim()) {
        calculator.setDamageAuto({ dice: value.trim(), ability, bonus });
        triggerCalculationFlash(dmgInput);
      } else {
        calculator.setDamageAuto(undefined);
      }
      dmgInput.value = entry.damage || "";
      updateInputTooltip(dmgInput, calculator.getDamageTooltipText());
      onUpdate();
    },
  });
  (dmgDiceInput.style as any).width = "8ch";

  // Damage type/bonus input
  const dmgBonusInput = createTextInput(dmgGroup, {
    className: "sm-cc-attack-input",
    placeholder: "piercing",
    ariaLabel: "Damage type",
    value: entry.damage_from?.bonus || "",
    onInput: (value) => {
      const dice = dmgDiceInput.value.trim() || entry.damage_from?.dice || "";
      const ability = abilityHandle.getValue() || entry.damage_from?.ability || undefined;
      if (dice) {
        calculator.setDamageAuto({ dice, ability, bonus: value.trim() || undefined });
        dmgInput.value = entry.damage || "";
        triggerCalculationFlash(dmgInput);
        updateInputTooltip(dmgInput, calculator.getDamageTooltipText());
        onUpdate();
      }
    },
  });
  (dmgBonusInput.style as any).width = "10ch";

  // Damage output (calculated result)
  const dmgInput = createTextInput(dmgGroup, {
    className: "sm-cc-attack-input sm-cc-attack-damage",
    placeholder: "1d8 +3 piercing",
    ariaLabel: "Damage output",
    value: entry.damage || "",
    onInput: (value) => {
      entry.damage = value.trim() || undefined;
      onUpdate();
    },
  });
  (dmgInput.style as any).width = "18ch";

  // === RANGE/REACH ROW ===
  const rangeRow = container.createDiv({ cls: "sm-cc-attack-range-row" });

  // Melee: Reach field
  const meleeGroup = rangeRow.createDiv({ cls: "sm-cc-attack-group sm-cc-attack-melee-group" });
  meleeGroup.createEl("label", { text: "Reach:", cls: "sm-cc-attack-sublabel" });
  const meleeReachInput = createTextInput(meleeGroup, {
    className: "sm-cc-attack-input",
    placeholder: "5 ft.",
    ariaLabel: "Melee reach",
    value: attackEntry.melee_reach || "",
    onInput: (value) => {
      attackEntry.melee_reach = value.trim() || undefined;
      onUpdate();
    },
  });
  (meleeReachInput.style as any).width = "8ch";

  // Ranged: Short/Long range fields
  const rangedGroup = rangeRow.createDiv({ cls: "sm-cc-attack-group sm-cc-attack-ranged-group" });
  rangedGroup.createEl("label", { text: "Range:", cls: "sm-cc-attack-sublabel" });

  const rangeInputsContainer = rangedGroup.createDiv({ cls: "sm-cc-attack-range-inputs" });
  const rangedShortInput = createTextInput(rangeInputsContainer, {
    className: "sm-cc-attack-input",
    placeholder: "30",
    ariaLabel: "Short range",
    value: attackEntry.ranged_short || "",
    onInput: (value) => {
      attackEntry.ranged_short = value.trim() || undefined;
      onUpdate();
    },
  });
  (rangedShortInput.style as any).width = "5ch";

  rangeInputsContainer.createSpan({ text: " / ", cls: "sm-cc-attack-range-separator" });

  const rangedLongInput = createTextInput(rangeInputsContainer, {
    className: "sm-cc-attack-input",
    placeholder: "120",
    ariaLabel: "Long range",
    value: attackEntry.ranged_long || "",
    onInput: (value) => {
      attackEntry.ranged_long = value.trim() || undefined;
      onUpdate();
    },
  });
  (rangedLongInput.style as any).width = "5ch";

  rangeInputsContainer.createSpan({ text: " ft.", cls: "sm-cc-attack-range-suffix" });

  // === TARGET ROW ===
  const targetRow = container.createDiv({ cls: "sm-cc-attack-target-row" });
  targetRow.createEl("label", { text: "Target:", cls: "sm-cc-attack-label" });
  const targetInput = createTextInput(targetRow, {
    className: "sm-cc-attack-input sm-cc-attack-target",
    placeholder: "one target",
    ariaLabel: "Attack target",
    value: entry.target || "",
    onInput: (value) => {
      entry.target = value.trim() || undefined;
      onUpdate();
    },
  });
  (targetInput.style as any).flex = "1";

  // === VISIBILITY MANAGEMENT ===
  /**
   * Shows/hides melee vs ranged fields based on attack type
   */
  function updateRangeFieldsVisibility(): void {
    const attackType = attackEntry.attack_type || "";

    if (attackType === "melee") {
      meleeGroup.style.display = "flex";
      rangedGroup.style.display = "none";
    } else if (attackType === "ranged") {
      meleeGroup.style.display = "none";
      rangedGroup.style.display = "flex";
    } else {
      // Show both or hide both when unspecified
      meleeGroup.style.display = "flex";
      rangedGroup.style.display = "flex";
    }
  }

  // === INITIALIZATION ===
  // Apply initial auto-calculations if configured
  if (entry.to_hit_from || entry.damage_from) {
    calculator.apply();
    toHitInput.value = entry.to_hit || "";
    dmgInput.value = entry.damage || "";
    updateInputTooltip(toHitInput, calculator.getToHitTooltipText());
    updateInputTooltip(dmgInput, calculator.getDamageTooltipText());
  }

  // Set initial visibility
  updateRangeFieldsVisibility();

  return container;
}

/**
 * Validates attack component data
 * Returns array of validation issues
 */
export function validateAttackComponent(entry: AttackEntry, entryName: string): string[] {
  const issues: string[] = [];

  // Check for attack type specific validation
  if (entry.attack_type === "melee" && !entry.melee_reach) {
    issues.push(`${entryName}: Melee attacks should specify reach`);
  }

  if (entry.attack_type === "ranged" && (!entry.ranged_short || !entry.ranged_long)) {
    issues.push(`${entryName}: Ranged attacks should specify both short and long range`);
  }

  // Check for to-hit value
  if (!entry.to_hit && !entry.to_hit_from) {
    issues.push(`${entryName}: Attack should have a to-hit bonus`);
  }

  // Check for target
  if (!entry.target) {
    issues.push(`${entryName}: Attack should specify a target`);
  }

  return issues;
}

/**
 * Converts legacy range field to new attack component format
 */
export function migrateLegacyRangeData(entry: AttackEntry): void {
  if (!entry.range) return;

  // Try to detect if it's a melee reach (e.g., "5 ft.", "10 ft.", "reach 5 ft.")
  const reachMatch = entry.range.match(/(?:reach\s+)?(\d+)\s*(?:ft\.?)?/i);

  // Try to detect if it's a ranged value (e.g., "30/120 ft.", "range 80/320")
  const rangeMatch = entry.range.match(/(?:range\s+)?(\d+)\s*\/\s*(\d+)\s*(?:ft\.?)?/i);

  if (rangeMatch) {
    entry.attack_type = "ranged";
    entry.ranged_short = rangeMatch[1];
    entry.ranged_long = rangeMatch[2];
  } else if (reachMatch) {
    entry.attack_type = "melee";
    entry.melee_reach = `${reachMatch[1]} ft.`;
  }
}
// src/apps/library/create/creature/components/save-component.ts
// Modular Save component for creature abilities that require saving throws

import {
  createCheckbox,
  createNumberInput,
  createSelectDropdown,
  createTextArea,
  createTextInput,
} from "../../../../../ui/workmode/create";
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
// src/apps/library/create/creature/components/damage-component.ts
// Modular damage component for the creature creator entry system

import {
  createNumberInput,
  createSelectDropdown,
  createTextInput,
} from "../../../../../ui/workmode/create";
import type { StatblockData } from "../../../core/creature-files";
import { CREATURE_ABILITY_LABELS } from "../presets";
import { abilityMod, formatSigned } from "../../shared/stat-utils";
import { setIcon } from "obsidian";

/**
 * Damage types available in D&D 5e
 */
export const DAMAGE_TYPES = [
  // Physical
  { value: "slashing", label: "Slashing", category: "physical" },
  { value: "piercing", label: "Piercing", category: "physical" },
  { value: "bludgeoning", label: "Bludgeoning", category: "physical" },

  // Elemental
  { value: "fire", label: "Fire", category: "elemental" },
  { value: "cold", label: "Cold", category: "elemental" },
  { value: "lightning", label: "Lightning", category: "elemental" },
  { value: "thunder", label: "Thunder", category: "elemental" },
  { value: "acid", label: "Acid", category: "elemental" },
  { value: "poison", label: "Poison", category: "elemental" },

  // Magical
  { value: "necrotic", label: "Necrotic", category: "magical" },
  { value: "radiant", label: "Radiant", category: "magical" },
  { value: "force", label: "Force", category: "magical" },
  { value: "psychic", label: "Psychic", category: "magical" },
] as const;

export type DamageTypeValue = typeof DAMAGE_TYPES[number]["value"];

/**
 * Configuration for a single damage instance
 */
export interface DamageInstance {
  dice: string;                    // e.g. "2d6", "1d10+3"
  bonus?: number | "auto";         // Fixed bonus or "auto" to use ability
  bonusAbility?: string;           // Ability to use for auto bonus (e.g. "str", "dex")
  damageType: DamageTypeValue;     // Type of damage
  condition?: string;              // Optional condition (e.g. "if target is prone")
  isAdditional?: boolean;          // Whether this is additional damage
}

/**
 * Options for creating a damage component
 */
export interface DamageComponentOptions {
  damages: DamageInstance[];       // Array of damage instances
  data: StatblockData;             // Creature data for auto-calculations
  onChange: () => void;            // Callback when damage changes
  maxDamages?: number;             // Maximum number of damage instances (default: 5)
}

/**
 * Validates dice notation
 * Accepts formats like: 1d6, 2d8, 3d10+2, 1d12-1
 */
export function validateDiceNotation(dice: string): boolean {
  if (!dice || !dice.trim()) return false;

  // Pattern: XdY or XdY+Z or XdY-Z where X, Y, Z are numbers
  const dicePattern = /^\d+d\d+([+-]\d+)?$/i;
  return dicePattern.test(dice.trim());
}

/**
 * Parses dice notation to extract components
 * Returns { count, sides, modifier } or null if invalid
 */
export function parseDiceNotation(dice: string): { count: number; sides: number; modifier: number } | null {
  const trimmed = dice.trim();
  if (!validateDiceNotation(trimmed)) return null;

  const match = trimmed.match(/^(\d+)d(\d+)([+-]\d+)?$/i);
  if (!match) return null;

  return {
    count: parseInt(match[1], 10),
    sides: parseInt(match[2], 10),
    modifier: match[3] ? parseInt(match[3], 10) : 0,
  };
}

/**
 * Calculates average damage for dice notation
 */
export function calculateAverageDamage(dice: string, bonus: number = 0): number {
  const parsed = parseDiceNotation(dice);
  if (!parsed) return 0;

  const diceAverage = parsed.count * ((parsed.sides + 1) / 2);
  return Math.floor(diceAverage + parsed.modifier + bonus);
}

/**
 * Formats a damage instance into a human-readable string
 * Example: "13 (2d6 + 4) slashing damage"
 */
export function formatDamageString(
  instance: DamageInstance,
  data: StatblockData
): string {
  let bonus = 0;

  // Calculate bonus
  if (instance.bonus === "auto" && instance.bonusAbility) {
    const abilKey = instance.bonusAbility.toLowerCase();

    // Handle best_of_str_dex specially
    if (abilKey === "best_of_str_dex") {
      const strMod = abilityMod(data.str as any);
      const dexMod = abilityMod(data.dex as any);
      bonus = Math.max(strMod, dexMod);
    } else {
      bonus = abilityMod((data as any)[abilKey]);
    }
  } else if (typeof instance.bonus === "number") {
    bonus = instance.bonus;
  }

  const average = calculateAverageDamage(instance.dice, bonus);
  const bonusStr = bonus !== 0 ? ` ${formatSigned(bonus)}` : "";
  const diceStr = `${instance.dice}${bonusStr}`;

  let damageStr = `${average} (${diceStr}) ${instance.damageType}`;

  if (instance.condition) {
    damageStr += ` (${instance.condition})`;
  }

  return damageStr;
}

/**
 * Creates a single damage instance UI
 */
function createDamageInstanceUI(
  parent: HTMLElement,
  instance: DamageInstance,
  index: number,
  data: StatblockData,
  onChange: () => void,
  onDelete: () => void,
  isFirst: boolean
): HTMLElement {
  const container = parent.createDiv({
    cls: `sm-cc-damage-instance ${instance.isAdditional ? "sm-cc-damage-instance--additional" : "sm-cc-damage-instance--primary"}`
  });

  // Header with label and delete button
  const header = container.createDiv({ cls: "sm-cc-damage-instance-header" });

  const label = header.createSpan({
    cls: "sm-cc-damage-instance-label",
    text: instance.isAdditional ? "Additional Damage" : "Primary Damage"
  });

  if (!isFirst || instance.isAdditional) {
    const deleteBtn = header.createEl("button", {
      cls: "sm-cc-damage-delete-btn",
      attr: { type: "button", "aria-label": "Delete Damage" }
    });
    setIcon(deleteBtn, "x");
    deleteBtn.onclick = onDelete;
  }

  // Grid for damage fields
  const grid = container.createDiv({ cls: "sm-cc-damage-grid" });

  // Dice notation input
  grid.createEl("label", { text: "Dice", cls: "sm-cc-damage-label" });
  const diceInputWrapper = grid.createDiv({ cls: "sm-cc-damage-dice-wrapper" });
  const diceInput = createTextInput(diceInputWrapper, {
    className: "sm-cc-damage-dice-input",
    placeholder: "2d6",
    ariaLabel: "Damage Dice",
    value: instance.dice || "",
    onInput: (value) => {
      instance.dice = value.trim();

      // Visual validation feedback
      if (value.trim() && !validateDiceNotation(value.trim())) {
        diceInputWrapper.addClass("sm-cc-damage-dice-invalid");
      } else {
        diceInputWrapper.removeClass("sm-cc-damage-dice-invalid");
      }

      onChange();
    }
  });

  // Validation icon
  const validationIcon = diceInputWrapper.createSpan({ cls: "sm-cc-damage-dice-validation" });
  if (instance.dice && !validateDiceNotation(instance.dice)) {
    setIcon(validationIcon, "alert-circle");
    diceInputWrapper.addClass("sm-cc-damage-dice-invalid");
  }

  // Bonus input (number or "auto")
  grid.createEl("label", { text: "Bonus", cls: "sm-cc-damage-label" });
  const bonusWrapper = grid.createDiv({ cls: "sm-cc-damage-bonus-wrapper" });
  const bonusInput = createTextInput(bonusWrapper, {
    className: "sm-cc-damage-bonus-input",
    placeholder: "auto",
    ariaLabel: "Damage Bonus",
    value: instance.bonus === "auto" ? "auto" : instance.bonus !== undefined ? String(instance.bonus) : "",
    onInput: (value) => {
      const trimmed = value.trim().toLowerCase();

      if (trimmed === "auto" || trimmed === "") {
        instance.bonus = trimmed === "auto" ? "auto" : undefined;
      } else {
        const num = parseInt(trimmed, 10);
        instance.bonus = isNaN(num) ? undefined : num;
      }

      // Show/hide ability selector based on auto
      if (instance.bonus === "auto") {
        abilityWrapper.style.display = "";
      } else {
        abilityWrapper.style.display = "none";
      }

      onChange();
    }
  });
  (bonusInput.style as any).width = "6ch";

  // Bonus ability selector (only visible when bonus is "auto")
  grid.createEl("label", { text: "Ability", cls: "sm-cc-damage-label" });
  const abilityWrapper = grid.createDiv({ cls: "sm-cc-damage-ability-wrapper" });
  const abilitySelect = createSelectDropdown(abilityWrapper, {
    className: "sm-cc-damage-ability-select",
    options: [
      { value: "", label: "(none)" },
      { value: "str", label: "STR" },
      { value: "dex", label: "DEX" },
      { value: "con", label: "CON" },
      { value: "int", label: "INT" },
      { value: "wis", label: "WIS" },
      { value: "cha", label: "CHA" },
      { value: "best_of_str_dex", label: "Best of STR/DEX" },
    ],
    value: instance.bonusAbility || "",
    onChange: (value) => {
      instance.bonusAbility = value || undefined;
      onChange();
    }
  });

  // Hide ability selector if not using auto
  if (instance.bonus !== "auto") {
    abilityWrapper.style.display = "none";
  }

  // Damage type selector
  grid.createEl("label", { text: "Type", cls: "sm-cc-damage-label" });
  const damageTypeSelect = createSelectDropdown(grid, {
    className: "sm-cc-damage-type-select",
    options: DAMAGE_TYPES.map(t => ({ value: t.value, label: t.label })),
    value: instance.damageType || "slashing",
    enableSearch: true,
    searchPlaceholder: "Search damage type...",
    onChange: (value) => {
      instance.damageType = value as DamageTypeValue;
      onChange();
    }
  });

  // Condition input (optional)
  grid.createEl("label", { text: "Condition", cls: "sm-cc-damage-label" });
  createTextInput(grid, {
    className: "sm-cc-damage-condition-input",
    placeholder: "if target is prone",
    ariaLabel: "Damage Condition",
    value: instance.condition || "",
    onInput: (value) => {
      instance.condition = value.trim() || undefined;
      onChange();
    }
  });

  // Preview of formatted damage string
  const preview = container.createDiv({ cls: "sm-cc-damage-preview" });
  const updatePreview = () => {
    if (instance.dice && validateDiceNotation(instance.dice)) {
      const formatted = formatDamageString(instance, data);
      preview.textContent = instance.isAdditional ? `plus ${formatted}` : formatted;
      preview.addClass("sm-cc-damage-preview--valid");
    } else {
      preview.textContent = instance.dice ? "Invalid dice notation" : "Enter dice notation";
      preview.removeClass("sm-cc-damage-preview--valid");
    }
  };

  updatePreview();

  // Re-update preview on any change
  const originalOnChange = onChange;
  onChange = () => {
    updatePreview();
    originalOnChange();
  };

  return container;
}

/**
 * Creates the complete damage component with multiple instances
 */
export function createDamageComponent(
  parent: HTMLElement,
  options: DamageComponentOptions
): HTMLElement {
  const { damages, data, onChange, maxDamages = 5 } = options;

  const section = parent.createDiv({ cls: "sm-cc-damage-component" });
  const header = section.createDiv({ cls: "sm-cc-damage-header" });
  header.createEl("h4", { text: "Damage", cls: "sm-cc-damage-title" });

  const container = section.createDiv({ cls: "sm-cc-damage-instances" });

  // Render all damage instances
  const renderDamages = () => {
    container.empty();

    // Ensure at least one damage instance
    if (damages.length === 0) {
      damages.push({
        dice: "",
        damageType: "slashing",
        isAdditional: false
      });
    }

    damages.forEach((damage, index) => {
      createDamageInstanceUI(
        container,
        damage,
        index,
        data,
        onChange,
        () => {
          // Delete this damage instance
          damages.splice(index, 1);
          renderDamages();
          onChange();
        },
        index === 0
      );
    });

    // Add damage button
    if (damages.length < maxDamages) {
      const addBtn = container.createEl("button", {
        cls: "sm-cc-damage-add-btn",
        text: "+ Additional Damage",
        attr: { type: "button" }
      });

      addBtn.onclick = () => {
        damages.push({
          dice: "",
          damageType: "fire",
          isAdditional: true
        });
        renderDamages();
        onChange();
      };
    }
  };

  renderDamages();

  return section;
}

/**
 * Converts damage instances to a single formatted string for the entry
 * Example: "13 (2d6 + 4) slashing damage, plus 5 (2d4) fire damage"
 */
export function damageInstancesToString(
  damages: DamageInstance[],
  data: StatblockData
): string {
  return damages
    .filter(d => d.dice && validateDiceNotation(d.dice))
    .map((d, index) => {
      const formatted = formatDamageString(d, data);
      return index === 0 ? formatted : `plus ${formatted}`;
    })
    .join(", ");
}

/**
 * Parses a damage string back into damage instances
 * This is a best-effort parser for backwards compatibility
 */
export function parseDamageString(damageStr: string): DamageInstance[] {
  const instances: DamageInstance[] = [];

  // Return empty array for empty or whitespace-only strings
  if (!damageStr || !damageStr.trim()) return instances;

  // Split on "plus" or commas
  const parts = damageStr.split(/(?:,\s*)?plus\s+/i);

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i].trim();

    // Skip empty parts
    if (!part) continue;

    // Extract damage type (last word before "damage" or at the end)
    const typeMatch = part.match(/\b(slashing|piercing|bludgeoning|fire|cold|lightning|thunder|acid|poison|necrotic|radiant|force|psychic)\b/i);
    const damageType = (typeMatch?.[1]?.toLowerCase() || "slashing") as DamageTypeValue;

    // Extract dice notation from parentheses
    const diceMatch = part.match(/\(([^)]+)\)/);
    const diceStr = diceMatch?.[1]?.trim() || "";

    // Try to extract dice and bonus separately
    const diceOnly = diceStr.match(/(\d+d\d+)/i)?.[1] || diceStr;
    const bonusMatch = diceStr.match(/([+-]\s*\d+)/);
    const bonus = bonusMatch ? parseInt(bonusMatch[1].replace(/\s/g, ""), 10) : undefined;

    instances.push({
      dice: diceOnly,
      bonus,
      damageType,
      isAdditional: i > 0
    });
  }

  return instances;
}
