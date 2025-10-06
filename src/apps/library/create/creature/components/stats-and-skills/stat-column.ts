// src/apps/library/create/creature/components/stats-and-skills/stat-column.ts
// Stat-Column Komponente für Attributwerte mit Save-Profizienzen

import type { StatblockData } from "../../../core/creature-files";
import type { CreatureAbilityKey } from "../../presets";

/**
 * Options for creating a stat column
 */
export interface StatColumnOptions {
  /** List of abilities to show in this column */
  abilities: Array<{ key: CreatureAbilityKey; label: string }>;
  /** The statblock data to read/write */
  data: StatblockData;
  /** Callback when any value changes (triggers recalculation) */
  onUpdate: () => void;
}

/**
 * References to elements for a single ability (for external updates)
 */
export interface StatColumnRefs {
  /** Score input element */
  score: HTMLInputElement;
  /** Modifier display element */
  mod: HTMLElement;
  /** Save bonus input (custom override) */
  save: HTMLInputElement;
  /** Save modifier display element */
  saveMod: HTMLElement;
}

/**
 * Creates a column of stat rows with header
 *
 * Each row shows:
 * - Label (STR, DEX, etc.)
 * - Score input with +/- buttons
 * - Calculated modifier
 * - Save proficiency checkbox
 * - Calculated save modifier
 *
 * @param parent - Parent element to append the column to
 * @param options - Configuration options
 * @returns Map of ability key to element references (for updating displays)
 *
 * @example
 * ```ts
 * const abilities = [
 *   { key: "str", label: "STR" },
 *   { key: "dex", label: "DEX" }
 * ];
 * const refs = createStatColumn(grid, {
 *   abilities,
 *   data: statblockData,
 *   onUpdate: () => recalculateModifiers()
 * });
 * // Later update displays:
 * refs.get("str").mod.textContent = "+3";
 * ```
 */
export function createStatColumn(
  parent: HTMLElement,
  options: StatColumnOptions
): Map<CreatureAbilityKey, StatColumnRefs> {
  const { abilities, data, onUpdate } = options;
  const refs = new Map<CreatureAbilityKey, StatColumnRefs>();

  const columnEl = parent.createDiv({ cls: "sm-cc-stats-col" });

  // Header
  const header = columnEl.createDiv({ cls: "sm-cc-stats-col__header" });
  header.createSpan({
    cls: "sm-cc-stats-col__header-cell sm-cc-stats-col__header-cell--mod",
    text: "Mod",
  });
  const saveHead = header.createDiv({
    cls: "sm-cc-stats-col__header-cell sm-cc-stats-col__header-cell--save",
  });
  saveHead.createSpan({ cls: "sm-cc-stats-col__header-save-label", text: "Save" });
  saveHead.createSpan({ cls: "sm-cc-stats-col__header-save-mod", text: "Mod" });

  // Ensure abilities and saves arrays exist
  if (!data.abilities) data.abilities = [];
  if (!data.saves) data.saves = [];

  // Stat rows
  for (const ability of abilities) {
    const row = columnEl.createDiv({ cls: "sm-cc-stat-row" });
    row.createSpan({ cls: "sm-cc-stat-row__label", text: ability.label });

    // Score input with +/- buttons
    const scoreWrap = row.createDiv({ cls: "sm-inline-number sm-cc-stat-row__score" });
    const score = scoreWrap.createEl("input", {
      attr: { type: "number", placeholder: "10", min: "0", step: "1" },
    }) as HTMLInputElement;
    score.addClass("sm-cc-stat-row__score-input");
    const dec = scoreWrap.createEl("button", { text: "−", cls: "btn-compact" });
    const inc = scoreWrap.createEl("button", { text: "+", cls: "btn-compact" });

    // Load existing ability score
    const existingAbility = data.abilities.find(a => a.ability === ability.key);
    score.value = existingAbility ? String(existingAbility.score) : "";

    const step = (delta: number) => {
      const cur = parseInt(score.value, 10) || 0;
      const next = Math.max(0, cur + delta);
      score.value = String(next);

      // Update abilities array
      data.abilities = data.abilities.filter(a => a.ability !== ability.key);
      if (next > 0) {
        data.abilities.push({ ability: ability.key, score: next });
      }

      onUpdate();
    };

    dec.onclick = () => step(-1);
    inc.onclick = () => step(1);
    score.addEventListener("input", () => {
      const value = score.value.trim();

      // Update abilities array
      data.abilities = data.abilities.filter(a => a.ability !== ability.key);
      if (value !== "") {
        const scoreValue = parseInt(value);
        if (!isNaN(scoreValue) && scoreValue > 0) {
          data.abilities.push({ ability: ability.key, score: scoreValue });
        }
      }

      onUpdate();
    });

    // Modifier display
    const modOut = row.createSpan({ cls: "sm-cc-stat-row__mod-value", text: "+0" });

    // Save bonus input (custom override)
    const saveWrap = row.createDiv({ cls: "sm-cc-stat-row__save" });
    const saveInput = saveWrap.createEl("input", {
      attr: {
        type: "number",
        placeholder: "Auto",
        "aria-label": `${ability.label} Save Bonus (leave empty for auto-calculation)`
      },
    }) as HTMLInputElement;
    saveInput.addClass("sm-cc-stat-row__save-input");
    const saveOut = saveWrap.createSpan({ cls: "sm-cc-stat-row__save-mod", text: "+0" });

    // Load existing save bonus
    const existingSave = data.saves.find(s => s.ability === ability.key);
    if (existingSave) {
      saveInput.value = String(existingSave.bonus);
    }

    saveInput.addEventListener("input", () => {
      const value = saveInput.value.trim();

      // Remove existing save for this ability
      data.saves = data.saves.filter(s => s.ability !== ability.key);

      // Add new save if value is present
      if (value !== "") {
        const bonus = parseInt(value);
        if (!isNaN(bonus)) {
          data.saves.push({ ability: ability.key, bonus });
        }
      }

      onUpdate();
    });

    refs.set(ability.key, { score, mod: modOut, save: saveInput, saveMod: saveOut });
  }

  return refs;
}
