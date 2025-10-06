// src/apps/library/create/creature/components/stats-and-skills/skill-manager.ts
// Skill-Manager Komponente für Fertigkeiten-Verwaltung

import { enhanceExistingSelectDropdown } from "../../../shared/form-controls";
import type { StatblockData } from "../../../core/creature-files";
import { CREATURE_SKILLS, type CreatureAbilityKey } from "../../presets";

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
