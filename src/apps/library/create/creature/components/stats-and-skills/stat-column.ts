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
  /** Save proficiency checkbox */
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

  // Ensure saveProf exists
  if (!data.saveProf) data.saveProf = {} as any;

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

    score.value = (data as any)[ability.key] || "";

    const step = (delta: number) => {
      const cur = parseInt(score.value, 10) || 0;
      const next = Math.max(0, cur + delta);
      score.value = String(next);
      (data as any)[ability.key] = score.value.trim();
      onUpdate();
    };

    dec.onclick = () => step(-1);
    inc.onclick = () => step(1);
    score.addEventListener("input", () => {
      (data as any)[ability.key] = score.value.trim();
      onUpdate();
    });

    // Modifier display
    const modOut = row.createSpan({ cls: "sm-cc-stat-row__mod-value", text: "+0" });

    // Save proficiency
    const saveWrap = row.createDiv({ cls: "sm-cc-stat-row__save" });
    const saveLabel = saveWrap.createEl("label", { cls: "sm-cc-stat-row__save-prof" });
    const saveCb = saveLabel.createEl("input", {
      attr: { type: "checkbox", "aria-label": `${ability.label} Save Proficiency` },
    }) as HTMLInputElement;
    const saveOut = saveWrap.createSpan({ cls: "sm-cc-stat-row__save-mod", text: "+0" });

    saveCb.checked = !!(data.saveProf as any)[ability.key];
    saveCb.addEventListener("change", () => {
      (data.saveProf as any)[ability.key] = saveCb.checked;
      onUpdate();
    });

    refs.set(ability.key, { score, mod: modOut, save: saveCb, saveMod: saveOut });
  }

  return refs;
}
