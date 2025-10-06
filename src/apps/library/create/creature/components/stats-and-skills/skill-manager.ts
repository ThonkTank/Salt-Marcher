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
  refs: Map<string, { mod: HTMLElement; expertise: HTMLInputElement }>;
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
  const refs = new Map<string, { mod: HTMLElement; expertise: HTMLInputElement }>();

  // Ensure data structures
  const ensureSets = () => {
    if (!data.skillsProf) data.skillsProf = [];
    if (!data.skillsExpertise) data.skillsExpertise = [];
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
    ensureSets();
    if (!data.skillsProf!.includes(name)) {
      data.skillsProf!.push(name);
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
    ensureSets();
    chipsContainer.empty();
    refs.clear();

    const profs = data.skillsProf ?? [];
    const pb = getProficiencyBonus();

    // Clean up expertise for removed skills
    data.skillsExpertise = (data.skillsExpertise ?? []).filter((name) => profs.includes(name));

    for (const name of profs) {
      const chip = chipsContainer.createDiv({ cls: "sm-cc-chip sm-cc-skill-chip" });
      chip.createSpan({ cls: "sm-cc-skill-chip__name", text: name });

      const modOut = chip.createSpan({ cls: "sm-cc-skill-chip__mod", text: "+0" });

      const expWrap = chip.createEl("label", { cls: "sm-cc-skill-chip__exp" });
      const expCb = expWrap.createEl("input", { attr: { type: "checkbox" } }) as HTMLInputElement;
      expWrap.createSpan({ text: "Expertise" });

      expCb.checked = !!data.skillsExpertise?.includes(name);
      expCb.addEventListener("change", () => {
        ensureSets();
        if (expCb.checked) {
          if (!data.skillsExpertise!.includes(name)) data.skillsExpertise!.push(name);
        } else {
          data.skillsExpertise = data.skillsExpertise!.filter((s) => s !== name);
        }
        updateMods();
        onUpdate();
      });

      const removeBtn = chip.createEl("button", {
        cls: "sm-cc-chip__remove",
        text: "×",
        attr: { "aria-label": `${name} entfernen` },
      }) as HTMLButtonElement;
      removeBtn.onclick = () => {
        ensureSets();
        data.skillsProf = data.skillsProf!.filter((s) => s !== name);
        data.skillsExpertise = data.skillsExpertise!.filter((s) => s !== name);
        render();
      };

      refs.set(name, { mod: modOut, expertise: expCb });
    }

    updateMods();
  };

  const updateMods = () => {
    const pb = getProficiencyBonus();
    for (const [name, ref] of refs) {
      const abilityKey = skillAbilityMap.get(name);
      const mod = abilityKey ? getAbilityMod(abilityKey) : 0;
      const hasExpertise = data.skillsExpertise?.includes(name) ?? false;
      const bonus = hasExpertise ? pb * 2 : pb;
      const total = mod + bonus;
      ref.mod.textContent = total >= 0 ? `+${total}` : String(total);
      if (ref.expertise.checked !== hasExpertise) ref.expertise.checked = hasExpertise;
    }
  };

  return { refs, render, addSkill };
}
