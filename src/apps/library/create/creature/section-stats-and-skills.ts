// src/apps/library/create/creature/section-stats-and-skills.ts
import { Setting } from "obsidian";
import { enhanceSelectToSearch } from "../../../../ui/search-dropdown";
import { abilityMod, formatSigned, parseIntSafe } from "../shared/stat-utils";
import type { StatblockData } from "../../core/creature-files";
import {
  CREATURE_ABILITIES,
  CREATURE_SKILLS,
  type CreatureAbilityKey,
} from "./presets";

export function mountCreatureStatsAndSkillsSection(
  parent: HTMLElement,
  data: StatblockData,
) {
  const root = parent.createDiv({ cls: "sm-cc-stats" });

  const abilityElems = new Map<
    CreatureAbilityKey,
    { score: HTMLInputElement; mod: HTMLElement; save: HTMLInputElement; saveMod: HTMLElement }
  >();

  const ensureSets = () => {
    if (!data.saveProf) data.saveProf = {} as any;
    if (!data.skillsProf) data.skillsProf = [];
    if (!data.skillsExpertise) data.skillsExpertise = [];
  };

  const abilitySection = root.createDiv({ cls: "sm-cc-skills" });
  abilitySection.createEl("h4", { text: "Stats" });

  const statsGrid = abilitySection.createDiv({ cls: "sm-cc-stats-grid" });

  for (const s of CREATURE_ABILITIES) {
    const statEl = statsGrid.createDiv({ cls: "sm-cc-stat" });

    const header = statEl.createDiv({ cls: "sm-cc-stat__header" });
    header.createSpan({ text: s.label });
    const scoreWrap = header.createDiv({ cls: "sm-inline-number sm-cc-stat__score" });
    const score = scoreWrap.createEl("input", {
      attr: { type: "number", placeholder: "10", min: "0", step: "1" },
    }) as HTMLInputElement;
    const dec = scoreWrap.createEl("button", { text: "−", cls: "btn-compact" });
    const inc = scoreWrap.createEl("button", { text: "+", cls: "btn-compact" });
    score.value = (data as any)[s.key] || "";
    const step = (d: number) => {
      const cur = parseInt(score.value, 10) || 0;
      const next = Math.max(0, cur + d);
      score.value = String(next);
      (data as any)[s.key] = score.value.trim();
      updateMods();
    };
    dec.onclick = () => step(-1);
    inc.onclick = () => step(1);
    score.addEventListener("input", () => {
      (data as any)[s.key] = score.value.trim();
      updateMods();
    });

    const modRow = statEl.createDiv({ cls: "sm-cc-stat__mod" });
    modRow.createSpan({ text: "Mod" });
    const modOut = modRow.createSpan({ cls: "sm-cc-stat__mod-value", text: "+0" });

    const saveRow = statEl.createDiv({ cls: "sm-cc-stat__save" });
    saveRow.createSpan({ cls: "sm-cc-stat__save-label", text: "Save mod" });
    const saveControls = saveRow.createDiv({ cls: "sm-cc-stat__save-controls" });
    const saveCb = saveControls.createEl("input", {
      attr: { type: "checkbox", "aria-label": `${s.label} Save Proficiency` },
    }) as HTMLInputElement;
    const saveOut = saveControls.createSpan({ cls: "sm-cc-stat__save-value", text: "+0" });

    ensureSets();
    saveCb.checked = !!(data.saveProf as any)[s.key];
    saveCb.addEventListener("change", () => {
      (data.saveProf as any)[s.key] = saveCb.checked;
      updateMods();
    });
    abilityElems.set(s.key, { score, mod: modOut, save: saveCb, saveMod: saveOut });
  }

  const skillAbilityMap = new Map<string, CreatureAbilityKey>(CREATURE_SKILLS);
  const skillsSetting = new Setting(root).setName("Fertigkeiten");
  skillsSetting.settingEl.addClass("sm-cc-skills");
  const skillsControl = skillsSetting.controlEl;
  skillsControl.addClass("sm-cc-skill-editor");

  skillsSetting.nameEl.empty();

  const skillsRow = skillsControl.createDiv({ cls: "sm-cc-searchbar sm-cc-skill-search" });
  const skillsSelectId = "sm-cc-skill-select";
  const skillsLabel = skillsRow.createEl("label", {
    text: "Fertigkeiten",
    attr: { for: skillsSelectId },
  });
  const skillsSelect = skillsRow.createEl("select", {
    attr: { id: skillsSelectId },
  }) as HTMLSelectElement;
  const blankSkill = skillsSelect.createEl("option", {
    text: "Fertigkeit wählen…",
  }) as HTMLOptionElement;
  blankSkill.value = "";
  for (const [name] of CREATURE_SKILLS) {
    const opt = skillsSelect.createEl("option", { text: name }) as HTMLOptionElement;
    opt.value = name;
  }
  try {
    enhanceSelectToSearch(skillsSelect, "Fertigkeit suchen…");
  } catch {}
  const skillsSearchInput = (skillsSelect as any)._smSearchInput as HTMLInputElement | undefined;
  if (skillsSearchInput) {
    skillsSearchInput.placeholder = "Fertigkeit suchen…";
    if (!skillsSearchInput.id) skillsSearchInput.id = `${skillsSelectId}-search`;
    skillsLabel.htmlFor = skillsSearchInput.id;
  }

  const addSkillBtn = skillsRow.createEl("button", { text: "+ Hinzufügen" });
  const skillChips = skillsControl.createDiv({ cls: "sm-cc-chips sm-cc-skill-chips" });

  const skillRefs = new Map<string, { mod: HTMLElement; expertise: HTMLInputElement }>();

  const addSkillByName = (rawName: string) => {
    const name = rawName.trim();
    if (!name) return;
    if (!skillAbilityMap.has(name)) return;
    ensureSets();
    if (!data.skillsProf!.includes(name)) data.skillsProf!.push(name);
    renderSkillChips();
  };

  addSkillBtn.onclick = () => {
    const selected = skillsSelect.value.trim();
    const typed = skillsSearchInput?.value.trim() ?? "";
    let value = selected;
    if (!value && typed) {
      const match = Array.from(skillsSelect.options).find(
        (opt) => opt.text.trim().toLowerCase() === typed.toLowerCase(),
      );
      if (match) value = match.value.trim();
    }
    if (skillsSearchInput) skillsSearchInput.value = "";
    skillsSelect.value = "";
    addSkillByName(value);
  };

  function renderSkillChips() {
    ensureSets();
    skillChips.empty();
    skillRefs.clear();
    const profs = data.skillsProf ?? [];
    for (const name of profs) {
      const chip = skillChips.createDiv({ cls: "sm-cc-chip sm-cc-skill-chip" });
      chip.createSpan({ cls: "sm-cc-skill-chip__name", text: name });
      const modOut = chip.createSpan({ cls: "sm-cc-skill-chip__mod", text: "+0" });
      const expertiseWrap = chip.createEl("label", { cls: "sm-cc-skill-chip__exp" });
      const expertiseCb = expertiseWrap.createEl("input", { attr: { type: "checkbox" } }) as HTMLInputElement;
      expertiseWrap.createSpan({ text: "Expertise" });
      expertiseCb.checked = !!data.skillsExpertise?.includes(name);
      expertiseCb.addEventListener("change", () => {
        ensureSets();
        if (expertiseCb.checked) {
          if (!data.skillsExpertise!.includes(name)) data.skillsExpertise!.push(name);
        } else {
          data.skillsExpertise = data.skillsExpertise!.filter((s) => s !== name);
        }
        updateMods();
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
        renderSkillChips();
      };
      skillRefs.set(name, { mod: modOut, expertise: expertiseCb });
    }
    updateMods();
  }

  const updateMods = () => {
    const pb = parseIntSafe(data.pb as any) || 0;
    for (const [key, refs] of abilityElems) {
      const mod = abilityMod((data as any)[key]);
      refs.mod.textContent = formatSigned(mod);
      const saveBonus = (data.saveProf as any)?.[key] ? pb : 0;
      refs.saveMod.textContent = formatSigned(mod + saveBonus);
    }
    ensureSets();
    const profs = new Set(data.skillsProf ?? []);
    data.skillsExpertise = (data.skillsExpertise ?? []).filter((name) => profs.has(name));
    for (const [name, refs] of skillRefs) {
      const ability = skillAbilityMap.get(name);
      const mod = ability ? abilityMod((data as any)[ability]) : 0;
      const hasExpertise = data.skillsExpertise?.includes(name) ?? false;
      const bonus = hasExpertise ? pb * 2 : pb;
      refs.mod.textContent = formatSigned(mod + bonus);
      if (refs.expertise.checked !== hasExpertise) refs.expertise.checked = hasExpertise;
    }
  };

  renderSkillChips();
}
