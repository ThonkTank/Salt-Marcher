// src/apps/library/create/creature/components/damage-component.ts
// Modular damage component for the creature creator entry system

import { createTextInput, createSelectDropdown, createNumberInput } from "../../shared/form-controls";
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
