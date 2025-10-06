// src/apps/library/create/creature/components/entry-card-autocal.ts
// Auto-calculator UI components with tooltips for entry cards

import { createTextInput, createSelectDropdown } from "../../shared/form-controls";
import { EntryAutoCalculator } from "../../shared/auto-calc";
import type { CreatureEntry } from "../entry-model";
import type { StatblockData } from "../../../core/creature-files";
import { CREATURE_ABILITY_SELECTIONS } from "../presets";

/**
 * Helper function to create a tooltip icon
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
 * Helper function to trigger visual feedback animation
 */
function triggerCalculationFlash(element: HTMLInputElement): void {
  element.classList.add("sm-cc-input--calculated");
  setTimeout(() => {
    element.classList.remove("sm-cc-input--calculated");
  }, 300);
}

/**
 * Helper function to update tooltip on an input element
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
 * Creates an enhanced attack section with auto-calculation and tooltips
 */
export function createAttackSectionWithAutoCalc(
  parent: HTMLElement,
  entry: CreatureEntry,
  data: StatblockData,
  entryIndex: number,
  onUpdate: () => void
): void {
  const section = parent.createDiv({ cls: "sm-cc-entry-section sm-cc-entry-section--attack-auto" });
  const header = section.createDiv({ cls: "sm-cc-entry-section-header" });
  header.textContent = "Attack (Auto-Calculated)";

  const content = section.createDiv({ cls: "section-content" });

  // Auto-calculation controls row
  const autoRow = content.createDiv({ cls: "sm-cc-auto" });

  // Calculator instance
  const calculator = new EntryAutoCalculator(entry, data, undefined);

  // Shared Ability dropdown (used for both to_hit and damage)
  const abilityGroup = autoRow.createDiv({ cls: "sm-auto-group" });
  const abilityLabel = abilityGroup.createSpan({ text: "Ability:" });
  createTooltipIcon(abilityLabel, "Choose which ability modifier to use for attack and damage rolls");

  const abilityHandle = createSelectDropdown(abilityGroup, {
    options: CREATURE_ABILITY_SELECTIONS.map((v) => ({ value: v, label: v || "(none)" })),
    value: entry.to_hit_from?.ability || entry.damage_from?.ability || "",
    enableSearch: true,
    searchPlaceholder: "Search ability…",
    onChange: (value) => {
      // Update to_hit
      const proficient = toHitProfCheckbox.checked;
      if (value) {
        calculator.setToHitAuto({ ability: value, proficient });
        triggerCalculationFlash(toHitInput);
      } else {
        calculator.setToHitAuto(undefined);
      }
      toHitInput.value = entry.to_hit || "";
      updateInputTooltip(toHitInput, calculator.getToHitTooltipText());

      // Update damage
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

  // To Hit Group with Prof checkbox
  const hitGroup = autoRow.createDiv({ cls: "sm-auto-group" });
  const toHitGroupLabel = hitGroup.createSpan({ text: "To hit:" });

  const toHitProfCheckbox = hitGroup.createEl("input", {
    attr: {
      type: "checkbox",
      id: `hit-prof-${entryIndex}`,
      title: "Adds proficiency bonus (+2 to +6 based on CR) to the attack roll"
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

  const profLabel = hitGroup.createEl("label", {
    text: "Prof",
    attr: { for: `hit-prof-${entryIndex}` }
  });
  createTooltipIcon(profLabel, "Proficiency bonus: +2 to +6 based on creature's Challenge Rating");

  const toHitInput = createTextInput(hitGroup, {
    className: "sm-auto-tohit",
    placeholder: "+7",
    ariaLabel: "To hit",
    value: entry.to_hit || "",
    onInput: (value) => {
      entry.to_hit = value.trim() || undefined;
      onUpdate();
    },
  });
  (toHitInput.style as any).width = "6ch";

  // Damage Group
  const dmgGroup = autoRow.createDiv({ cls: "sm-auto-group" });
  const damageLabel = dmgGroup.createSpan({ text: "Damage:" });
  createTooltipIcon(damageLabel, "Auto-calculated from dice + ability modifier + damage type");

  const dmgDiceInput = createTextInput(dmgGroup, {
    placeholder: "1d8",
    ariaLabel: "Dice",
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
  (dmgDiceInput.style as any).width = "10ch";

  const dmgBonusInput = createTextInput(dmgGroup, {
    placeholder: "piercing / slashing …",
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
  (dmgBonusInput.style as any).width = "12ch";

  const dmgInput = createTextInput(dmgGroup, {
    className: "sm-auto-dmg",
    placeholder: "1d8 +3 piercing",
    ariaLabel: "Damage output",
    value: entry.damage || "",
    onInput: (value) => {
      entry.damage = value.trim() || undefined;
      onUpdate();
    },
  });
  (dmgInput.style as any).width = "20ch";

  // Attack details grid (reach/range, target)
  const detailsGrid = content.createDiv({ cls: "sm-cc-entry-grid", attr: { style: "margin-top: 0.75rem;" } });

  // Reach/Range
  detailsGrid.createEl("label", { text: "Reach/Range" });
  createTextInput(detailsGrid, {
    placeholder: "5 ft. / 30/120 ft.",
    ariaLabel: "Reach/Range",
    value: entry.reach || "",
    onInput: (value) => {
      entry.reach = value.trim() || undefined;
      onUpdate();
    },
  });

  // Target
  detailsGrid.createEl("label", { text: "Target" });
  createTextInput(detailsGrid, {
    placeholder: "one target",
    ariaLabel: "Target",
    value: entry.target || "",
    onInput: (value) => {
      entry.target = value.trim() || undefined;
      onUpdate();
    },
  });

  // Apply initial auto-calculation if configured
  if (entry.to_hit_from || entry.damage_from) {
    calculator.apply();
    toHitInput.value = entry.to_hit || "";
    dmgInput.value = entry.damage || "";
    updateInputTooltip(toHitInput, calculator.getToHitTooltipText());
    updateInputTooltip(dmgInput, calculator.getDamageTooltipText());
  }
}
