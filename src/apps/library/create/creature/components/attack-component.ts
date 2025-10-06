// src/apps/library/create/creature/components/attack-component.ts
// Modular Attack Component for the entry system
// Self-contained component with auto-calculation, attack type selection, and range/reach fields

import { createTextInput, createSelectDropdown, createCheckbox } from "../../shared/form-controls";
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
