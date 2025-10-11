// src/apps/library/create/creature/components/basics/alignment-editor.ts
// Alignment-Editor Komponente für Law/Chaos, Good/Evil und Override

import { DropdownComponent } from "obsidian";
import type { StatblockData } from "../../../core/creature-files";
import type { FieldGridHandles } from "../../../../../ui/workmode/create/layouts";
import { createNumberStepper, enhanceExistingSelectDropdown } from "../../../../../ui/workmode/create/form-controls";

const LAW_CHAOS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "", label: "" },
  { value: "Lawful", label: "Rechtschaffen" },
  { value: "Neutral", label: "Neutral" },
  { value: "Chaotic", label: "Chaotisch" },
];

const GOOD_EVIL_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "", label: "" },
  { value: "Good", label: "Gut" },
  { value: "Neutral", label: "Neutral" },
  { value: "Evil", label: "Böse" },
];

/**
 * Options for creating an alignment editor
 */
export interface AlignmentEditorOptions {
  /** Field grid to add settings to */
  grid: FieldGridHandles;
  /** The statblock data to read/write */
  data: StatblockData;
}

/**
 * Creates alignment editor with Law/Chaos, Good/Evil dropdowns and Override field
 *
 * Features:
 * - Two dropdowns: Law/Chaos and Good/Evil axis
 * - Override input that disables dropdowns when filled
 * - Stores values in data.alignmentLawChaos, data.alignmentGoodEvil, data.alignmentOverride
 *
 * @param options - Configuration options
 *
 * @example
 * ```ts
 * const grid = createFieldGrid(parent, { variant: "classification" });
 * createAlignmentEditor({ grid, data: statblockData });
 * // User selects "Lawful" and "Good" → data.alignmentLawChaos = "Lawful", data.alignmentGoodEvil = "Good"
 * // User types "Unaligned" in override → dropdowns become disabled
 * ```
 */
export function createAlignmentEditor(options: AlignmentEditorOptions): void {
  const { grid, data } = options;

  let lawChaosDropdown: DropdownComponent | null = null;
  let goodEvilDropdown: DropdownComponent | null = null;

  const refreshControls = () => {
    const hasOverride = Boolean((data.alignmentOverride ?? "").trim());
    const toggleDropdown = (dropdown: DropdownComponent | null) => {
      if (!dropdown) return;
      if (hasOverride) {
        dropdown.selectEl.setAttribute("disabled", "true");
        dropdown.selectEl.setAttribute("aria-disabled", "true");
      } else {
        dropdown.selectEl.removeAttribute("disabled");
        dropdown.selectEl.removeAttribute("aria-disabled");
      }
    };
    toggleDropdown(lawChaosDropdown);
    toggleDropdown(goodEvilDropdown);
  };

  // Law/Chaos Dropdown
  const lawChaosSetting = grid.createSetting("Gesetz/Chaos", {
    className: "sm-cc-setting--show-name",
  });
  lawChaosSetting.addDropdown((dd) => {
    lawChaosDropdown = dd;
    for (const option of LAW_CHAOS_OPTIONS) dd.addOption(option.value, option.label);
    dd.onChange((value: string) => {
      data.alignmentLawChaos = value || undefined;
    });
    dd.selectEl.classList.add("sm-cc-select");
    const handle = enhanceExistingSelectDropdown(dd.selectEl, "Such-dropdown…");
    handle.setValue(data.alignmentLawChaos ?? ""); // Set value AFTER enhancement to sync search display
    refreshControls();
  });

  // Good/Evil Dropdown
  const goodEvilSetting = grid.createSetting("Gut/Böse", {
    className: "sm-cc-setting--show-name",
  });
  goodEvilSetting.addDropdown((dd) => {
    goodEvilDropdown = dd;
    for (const option of GOOD_EVIL_OPTIONS) dd.addOption(option.value, option.label);
    dd.onChange((value: string) => {
      data.alignmentGoodEvil = value || undefined;
    });
    dd.selectEl.classList.add("sm-cc-select");
    const handle = enhanceExistingSelectDropdown(dd.selectEl, "Such-dropdown…");
    handle.setValue(data.alignmentGoodEvil ?? ""); // Set value AFTER enhancement to sync search display
    refreshControls();
  });

  // Override Input
  const overrideSetting = grid.createSetting("Alignment-Override", {
    className: [
      "sm-cc-setting--span-2",
      "sm-cc-setting--show-name",
      "sm-cc-setting--alignment-override",
    ],
  });
  overrideSetting.addText((t) => {
    const applyOverride = (raw: string) => {
      const trimmed = raw.trim();
      if (trimmed) data.alignmentOverride = trimmed;
      else data.alignmentOverride = undefined;
      refreshControls();
    };
    t.setPlaceholder('z. B. Unaligned oder "Lawful Neutral"')
      .setValue(data.alignmentOverride ?? "")
      .onChange(applyOverride);
    t.inputEl.addEventListener("input", () => applyOverride(t.inputEl.value));
    t.inputEl.classList.add("sm-cc-input", "sm-cc-input--alignment-override");
  });

  refreshControls();
}
// src/apps/library/create/creature/components/basics/movement-model.ts
// Movement-Model für den Movement-Editor

import type {
  CreatureSpeedExtra,
  CreatureSpeedValue,
  StatblockData,
} from "../../../core/creature-files";
import type { CreatureMovementType } from "../presets";
import type { MovementEditorModel, MovementEntry } from "../creature-controls";

type SpeedFieldKey = Exclude<CreatureMovementType, never>;
type SpeedRecord = Record<SpeedFieldKey, CreatureSpeedValue | undefined> & {
  extras?: CreatureSpeedExtra[];
};

/**
 * Ensures data.speeds exists and has extras array
 */
function ensureSpeeds(data: StatblockData): SpeedRecord {
  const speeds = (data.speeds ??= {});
  if (!Array.isArray(speeds.extras)) speeds.extras = [];
  return speeds as SpeedRecord;
}

/**
 * Applies a speed value patch, removing the field if empty
 */
function applySpeedValue(
  data: StatblockData,
  key: SpeedFieldKey,
  patch: Partial<CreatureSpeedValue>
) {
  const speeds = ensureSpeeds(data);
  const prev = speeds[key] ?? {};
  const next: CreatureSpeedValue = { ...prev, ...patch };
  const hasContent = Boolean(next.distance?.trim()) || next.hover || Boolean(next.note?.trim());
  if (hasContent) speeds[key] = next;
  else delete speeds[key];
}

/**
 * Creates movement model for the movement editor
 *
 * Handles both standard movement types (walk, fly, swim, etc.) and custom extras.
 * Standard types are stored directly in data.speeds.{type}, extras are stored in data.speeds.extras[].
 *
 * @param data - The statblock data to read/write
 * @param movementTypes - List of standard movement types (e.g., [["walk", "Walk"], ["fly", "Fly"]])
 * @returns MovementEditorModel with get, add, remove, update methods
 *
 * @example
 * ```ts
 * const model = createMovementModel(data, CREATURE_MOVEMENT_TYPES);
 * model.add({ type: "walk", label: "Walk", distance: "30 ft.", hover: false });
 * model.add({ type: "custom", label: "Burrowing", distance: "10 ft.", hover: false });
 * const entries = model.get(); // Returns all movement entries
 * ```
 */
export function createMovementModel(
  data: StatblockData,
  movementTypes: ReadonlyArray<readonly [CreatureMovementType, string]>
): MovementEditorModel {
  return {
    get: () => {
      const speeds = ensureSpeeds(data);
      const entries: MovementEntry[] = [];

      // Standard movement types
      for (const [type, label] of movementTypes) {
        const speed = speeds[type as SpeedFieldKey];
        if (speed?.distance) {
          entries.push({
            type,
            label,
            distance: speed.distance,
            hover: speed.hover,
          });
        }
      }

      // Extras (custom movement types)
      if (speeds.extras) {
        for (const extra of speeds.extras) {
          entries.push({
            type: "custom",
            label: extra.label,
            distance: extra.distance ?? "",
            hover: extra.hover,
          });
        }
      }

      return entries;
    },

    add: (entry: MovementEntry) => {
      const speeds = ensureSpeeds(data);

      // Check if it's a standard movement type
      const standardType = movementTypes.find(([type]) => type === entry.type);

      if (standardType) {
        const [type] = standardType;
        applySpeedValue(data, type as SpeedFieldKey, {
          distance: entry.distance,
          hover: entry.hover,
        });
      } else {
        // It's a custom movement type, add to extras
        if (!speeds.extras) speeds.extras = [];
        speeds.extras.push({
          label: entry.label,
          distance: entry.distance,
          hover: entry.hover,
        });
      }
    },

    remove: (index: number) => {
      const entries = model.get();
      if (index < 0 || index >= entries.length) return;

      const entry = entries[index];
      const speeds = ensureSpeeds(data);

      // Check if it's a standard movement type
      const standardType = movementTypes.find(([type]) => type === entry.type);

      if (standardType) {
        const [type] = standardType;
        delete speeds[type as SpeedFieldKey];
      } else {
        // It's a custom movement type, remove from extras
        if (speeds.extras) {
          const extraIndex = speeds.extras.findIndex(
            (e) => e.label === entry.label && e.distance === entry.distance
          );
          if (extraIndex !== -1) {
            speeds.extras.splice(extraIndex, 1);
          }
        }
      }
    },

    update: (index: number, updates: Partial<MovementEntry>) => {
      // Not used for now, but required by interface
    },
  };

  // Need model reference for remove()
  const model = {
    get: function() {
      const speeds = ensureSpeeds(data);
      const entries: MovementEntry[] = [];
      for (const [type, label] of movementTypes) {
        const speed = speeds[type as SpeedFieldKey];
        if (speed?.distance) {
          entries.push({ type, label, distance: speed.distance, hover: speed.hover });
        }
      }
      if (speeds.extras) {
        for (const extra of speeds.extras) {
          entries.push({ type: "custom", label: extra.label, distance: extra.distance ?? "", hover: extra.hover });
        }
      }
      return entries;
    },
    add: function(entry: MovementEntry) {
      const speeds = ensureSpeeds(data);
      const standardType = movementTypes.find(([type]) => type === entry.type);
      if (standardType) {
        const [type] = standardType;
        applySpeedValue(data, type as SpeedFieldKey, { distance: entry.distance, hover: entry.hover });
      } else {
        if (!speeds.extras) speeds.extras = [];
        speeds.extras.push({ label: entry.label, distance: entry.distance, hover: entry.hover });
      }
    },
    remove: function(index: number) {
      const entries = model.get();
      if (index < 0 || index >= entries.length) return;
      const entry = entries[index];
      const speeds = ensureSpeeds(data);
      const standardType = movementTypes.find(([type]) => type === entry.type);
      if (standardType) {
        const [type] = standardType;
        delete speeds[type as SpeedFieldKey];
      } else {
        if (speeds.extras) {
          const extraIndex = speeds.extras.findIndex(
            (e) => e.label === entry.label && e.distance === entry.distance
          );
          if (extraIndex !== -1) speeds.extras.splice(extraIndex, 1);
        }
      }
    },
    update: function(index: number, updates: Partial<MovementEntry>) {
      // Not used
    },
  };

  return model;
}
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
  /** Optional container element (when columns are pre-created) */
  container?: HTMLElement;
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
  const { abilities, data, onUpdate, container } = options;
  const refs = new Map<CreatureAbilityKey, StatColumnRefs>();

  const columnEl = container ?? parent.createDiv({ cls: "sm-cc-stats-col" });

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

    const existingAbility = data.abilities.find((a) => a.ability === ability.key);

    const applyAbilityScore = (value: number | undefined, rawValue: string) => {
      data.abilities = data.abilities.filter((a) => a.ability !== ability.key);

      const trimmed = rawValue.trim();
      if (trimmed !== "") {
        const parsed = parseInt(trimmed, 10);
        if (!Number.isNaN(parsed) && parsed > 0) {
          data.abilities.push({ ability: ability.key, score: parsed });
        }
      }

      onUpdate();
    };

    const scoreHandle = createNumberStepper(row, {
      wrapperClassName: "sm-cc-stat-row__score",
      className: "sm-cc-input sm-cc-stat-row__score-input",
      buttonClassName: "btn-compact",
      decrementAriaLabel: `Decrease ${ability.label} score`,
      incrementAriaLabel: `Increase ${ability.label} score`,
      min: 0,
      step: 1,
      value: existingAbility?.score,
      onInput: (value, raw) => {
        applyAbilityScore(value, raw);
      },
    });
    const score = scoreHandle.input;

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
// src/apps/library/create/creature/components/stats-and-skills/skill-manager.ts
// Skill-Manager Komponente für Fertigkeiten-Verwaltung

import { enhanceExistingSelectDropdown } from "../../../../../ui/workmode/create/form-controls";
import type { StatblockData } from "../../../core/creature-files";
import { CREATURE_SKILLS, type CreatureAbilityKey } from "../presets";

/**
 * Options for creating a skill manager
 */
export interface SkillManagerOptions {
  /** Parent element to append the manager to */
  parent: HTMLElement;
  /** The statblock data to read/write */
  data: StatblockData;
  /** Function to get ability modifier for a skill */
  getAbilityMod: (key: CreatureAbilityKey) => number;
  /** Function to get proficiency bonus */
  getProficiencyBonus: () => number;
  /** Callback when skill data changes */
  onUpdate: () => void;
}

/**
 * Handle for a skill manager component
 */
export interface SkillManagerHandle {
  /** References to skill chip elements (for external updates) */
  refs: Map<string, { mod: HTMLElement; bonusInput: HTMLInputElement }>;
  /** Re-renders all skill chips and updates modifiers */
  render: () => void;
  /** Adds a skill by name if not already present */
  addSkill: (name: string) => void;
}

/**
 * Creates a skill manager with search, chips, and expertise
 *
 * Features:
 * - Search dropdown to find and add skills
 * - Skill chips showing name, modifier, and expertise checkbox
 * - Remove button per skill
 * - Automatically calculates modifiers: ability mod + proficiency (x2 for expertise)
 * - Cleans up expertise when skill is removed
 *
 * Layout:
 * - Search row: [Dropdown with search] [+ Button]
 * - Chips: [Skill Name] [+X Mod] [☑ Expertise] [× Remove]
 *
 * @param options - Configuration options
 * @returns Handle with refs, render, and addSkill methods
 *
 * @example
 * ```ts
 * const manager = createSkillManager({
 *   parent: container,
 *   data: statblockData,
 *   getAbilityMod: (key) => abilityMod(data[key]),
 *   getProficiencyBonus: () => parseInt(data.pb) || 0,
 *   onUpdate: () => revalidate()
 * });
 * // Later:
 * manager.addSkill("Stealth");
 * manager.render(); // Updates all displays
 * ```
 */
export function createSkillManager(options: SkillManagerOptions): SkillManagerHandle {
  const { parent, data, getAbilityMod, getProficiencyBonus, onUpdate } = options;

  const skillAbilityMap = new Map<string, CreatureAbilityKey>(CREATURE_SKILLS);
  const refs = new Map<string, { mod: HTMLElement; bonusInput: HTMLInputElement }>();

  // Ensure data structures
  const ensureSkills = () => {
    if (!data.skills) data.skills = [];
  };

  // Search row
  const searchRow = parent.createDiv({ cls: "sm-cc-searchbar sm-cc-skill-search" });
  const selectId = "sm-cc-skill-select";
  const select = searchRow.createEl("select", {
    attr: { id: selectId, "aria-label": "Fertigkeit auswählen" },
  }) as HTMLSelectElement;

  const blankOption = select.createEl("option", { text: "Fertigkeit wählen…" }) as HTMLOptionElement;
  blankOption.value = "";

  for (const [name] of CREATURE_SKILLS) {
    const opt = select.createEl("option", { text: name }) as HTMLOptionElement;
    opt.value = name;
  }

  const selectHandle = enhanceExistingSelectDropdown(select, "Fertigkeit suchen…");
  const searchInput = (select as any)._smSearchInput as HTMLInputElement | undefined;
  if (searchInput) {
    searchInput.placeholder = "Fertigkeit suchen…";
    if (!searchInput.id) searchInput.id = `${selectId}-search`;
    searchInput.setAttribute("aria-label", "Fertigkeit suchen");
  }

  const addBtn = searchRow.createEl("button", {
    text: "+",
    attr: { type: "button", "aria-label": "Fertigkeit hinzufügen" },
  });

  // Chips container
  const chipsContainer = parent.createDiv({ cls: "sm-cc-chips sm-cc-skill-chips" });

  const addSkill = (rawName: string) => {
    const name = rawName.trim();
    if (!name || !skillAbilityMap.has(name)) return;
    ensureSkills();
    if (!data.skills!.find(s => s.name === name)) {
      // Calculate auto bonus for new skill
      const abilityKey = skillAbilityMap.get(name);
      const mod = abilityKey ? getAbilityMod(abilityKey) : 0;
      const pb = getProficiencyBonus();
      const bonus = mod + pb;
      data.skills!.push({ name, bonus });
      render();
    }
  };

  addBtn.onclick = () => {
    const selected = select.value.trim();
    const typed = searchInput?.value.trim() ?? "";
    let value = selected;

    if (!value && typed) {
      const match = Array.from(select.options).find(
        (opt) => opt.text.trim().toLowerCase() === typed.toLowerCase()
      );
      if (match) value = match.value.trim();
    }

    if (searchInput) searchInput.value = "";
    select.value = "";
    addSkill(value);
  };

  const render = () => {
    ensureSkills();
    chipsContainer.empty();
    refs.clear();

    const skills = data.skills ?? [];

    for (const skill of skills) {
      const chip = chipsContainer.createDiv({ cls: "sm-cc-chip sm-cc-skill-chip" });
      chip.createSpan({ cls: "sm-cc-skill-chip__name", text: skill.name });

      // Bonus input with auto-calculated placeholder
      const abilityKey = skillAbilityMap.get(skill.name);
      const mod = abilityKey ? getAbilityMod(abilityKey) : 0;
      const pb = getProficiencyBonus();
      const autoBonus = mod + pb;

      const bonusInput = chip.createEl("input", {
        cls: "sm-cc-skill-chip__bonus-input",
        attr: {
          type: "number",
          placeholder: String(autoBonus),
          "aria-label": `${skill.name} Bonus`
        }
      }) as HTMLInputElement;
      bonusInput.value = String(skill.bonus);

      bonusInput.addEventListener("input", () => {
        const value = bonusInput.value.trim();
        if (value !== "") {
          const newBonus = parseInt(value);
          if (!isNaN(newBonus)) {
            skill.bonus = newBonus;
            updateMods();
            onUpdate();
          }
        }
      });

      const modOut = chip.createSpan({ cls: "sm-cc-skill-chip__mod", text: "+0" });

      const removeBtn = chip.createEl("button", {
        cls: "sm-cc-chip__remove",
        text: "×",
        attr: { "aria-label": `${skill.name} entfernen` },
      }) as HTMLButtonElement;
      removeBtn.onclick = () => {
        ensureSkills();
        data.skills = data.skills!.filter((s) => s.name !== skill.name);
        render();
      };

      refs.set(skill.name, { mod: modOut, bonusInput });
    }

    updateMods();
  };

  const updateMods = () => {
    for (const [name, ref] of refs) {
      const skill = data.skills?.find(s => s.name === name);
      if (skill) {
        const total = skill.bonus;
        ref.mod.textContent = total >= 0 ? `+${total}` : String(total);
      }
    }
  };

  return { refs, render, addSkill };
}
