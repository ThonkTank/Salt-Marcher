// src/apps/library/create/creature/section-stats-and-skills.ts
// Erfasst Attributswerte, Rettungswurf-Profizienzen und Fertigkeiten (inkl. Expertise).
import { Setting } from "obsidian";
import { abilityMod, formatSigned, parseIntSafe } from "../shared/stat-utils";
import type { StatblockData } from "../../core/creature-files";
import {
  CREATURE_ABILITIES,
  type CreatureAbilityKey,
} from "./presets";
import type { SectionValidationRegistrar } from "./section-utils";
import { createStatColumn, type StatColumnRefs } from "./components/stats-and-skills/stat-column";
import { createSkillManager } from "./components/stats-and-skills/skill-manager";

export function collectStatsAndSkillsIssues(data: StatblockData): string[] {
  const issues: string[] = [];
  const profs = new Set(data.skillsProf ?? []);
  for (const name of data.skillsExpertise ?? []) {
    if (!profs.has(name)) {
      issues.push(`Expertise für "${name}" setzt eine Profizient voraus.`);
    }
  }
  return issues;
}

export function mountCreatureStatsAndSkillsSection(
  parent: HTMLElement,
  data: StatblockData,
  registerValidation?: SectionValidationRegistrar,
) {
  const root = parent.createDiv({ cls: "sm-cc-stats" });

  const abilityElems = new Map<CreatureAbilityKey, StatColumnRefs>();

  const ensureSets = () => {
    if (!data.saveProf) data.saveProf = {} as any;
    if (!data.skillsProf) data.skillsProf = [];
    if (!data.skillsExpertise) data.skillsExpertise = [];
  };

  ensureSets();

  const statsSection = root.createDiv({ cls: "sm-cc-stats-section" });
  statsSection.createEl("h4", { cls: "sm-cc-stats-section__title", text: "Stats" });

  const statsGrid = statsSection.createDiv({ cls: "sm-cc-stats-grid" });

  const abilityByKey = new Map<CreatureAbilityKey, (typeof CREATURE_ABILITIES)[number]>(
    CREATURE_ABILITIES.map((def) => [def.key, def]),
  );
  const statColumns: CreatureAbilityKey[][] = [
    ["str", "dex", "con"],
    ["int", "wis", "cha"],
  ];

  // Create stat columns using component
  for (const keys of statColumns) {
    const abilities = keys
      .map((key) => abilityByKey.get(key))
      .filter((a) => a !== undefined) as Array<{ key: CreatureAbilityKey; label: string }>;

    const refs = createStatColumn(statsGrid, {
      abilities,
      data,
      onUpdate: () => updateMods(),
    });

    // Merge refs into abilityElems
    for (const [key, ref] of refs) {
      abilityElems.set(key, ref);
    }
  }

  // Skills section
  const skillsSetting = new Setting(root).setName("Fertigkeiten");
  skillsSetting.settingEl.addClass("sm-cc-skills");
  const skillsControl = skillsSetting.controlEl;
  skillsControl.addClass("sm-cc-skill-editor");

  const revalidate =
    registerValidation?.(() => collectStatsAndSkillsIssues(data)) ?? (() => []);

  const getAbilityMod = (key: CreatureAbilityKey) => abilityMod((data as any)[key]);
  const getProficiencyBonus = () => parseIntSafe(data.pb as any) || 0;

  const skillManager = createSkillManager({
    parent: skillsControl,
    data,
    getAbilityMod,
    getProficiencyBonus,
    onUpdate: () => {
      updateMods();
      revalidate();
    },
  });

  const updateMods = () => {
    const pb = getProficiencyBonus();

    // Update ability mods and saves
    for (const [key, refs] of abilityElems) {
      const mod = abilityMod((data as any)[key]);
      refs.mod.textContent = formatSigned(mod);
      const saveBonus = (data.saveProf as any)?.[key] ? pb : 0;
      refs.saveMod.textContent = formatSigned(mod + saveBonus);
    }

    // Update skill mods (delegated to skill manager)
    ensureSets();
    const profs = new Set(data.skillsProf ?? []);
    data.skillsExpertise = (data.skillsExpertise ?? []).filter((name) => profs.has(name));

    // Render skill chips and update their mods
    skillManager.render();

    revalidate();
  };

  skillManager.render();
  updateMods();
}
