// src/apps/library/create/creature/section-senses-and-defenses.ts
import type { StatblockData } from "../../core/creature-files";
import { mountTokenEditor } from "../shared/token-editor";
import {
  CREATURE_CONDITION_PRESETS,
  CREATURE_LANGUAGE_PRESETS,
  CREATURE_PASSIVE_PRESETS,
  CREATURE_SENSE_PRESETS,
} from "./presets";
import {
  mountDamageResponseEditor,
  mountPresetSelectEditor,
  type PresetSelectModel,
} from "./section-utils";

function ensureStringList(data: StatblockData, key: keyof StatblockData): string[] {
  const current = (data as any)[key];
  if (Array.isArray(current)) return current as string[];
  const arr: string[] = [];
  (data as any)[key] = arr;
  return arr;
}

const makeModel = (list: string[]): PresetSelectModel => ({
  get: () => list,
  add: (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    if (!list.includes(trimmed)) list.push(trimmed);
  },
  remove: (index: number) => {
    list.splice(index, 1);
  },
});

export function mountCreatureSensesAndDefensesSection(
  parent: HTMLElement,
  data: StatblockData,
) {
  const root = parent.createDiv({ cls: "sm-cc-defenses" });

  const sensesLanguages = root.createDiv({ cls: "sm-cc-senses-block" });

  const senses = ensureStringList(data, "sensesList");
  mountPresetSelectEditor(
    sensesLanguages,
    "Sinne",
    CREATURE_SENSE_PRESETS,
    makeModel(senses),
    {
      placeholder: "Sinn suchen oder eingeben…",
      rowClass: "sm-cc-senses-search",
      defaultAddButtonLabel: "+",
      settingClass: "sm-cc-senses-setting",
    },
  );

  const languages = ensureStringList(data, "languagesList");
  mountPresetSelectEditor(
    sensesLanguages,
    "Sprachen",
    CREATURE_LANGUAGE_PRESETS,
    makeModel(languages),
    {
      placeholder: "Sprache suchen oder eingeben…",
      rowClass: "sm-cc-senses-search",
      defaultAddButtonLabel: "+",
      settingClass: "sm-cc-senses-setting",
    },
  );

  const passives = ensureStringList(data, "passivesList");
  mountPresetSelectEditor(
    root,
    "Passive Werte",
    CREATURE_PASSIVE_PRESETS,
    makeModel(passives),
    "Passiven Wert suchen oder eingeben…",
  );

  const vulnerabilities = ensureStringList(data, "damageVulnerabilitiesList");
  const resistances = ensureStringList(data, "damageResistancesList");
  const immunities = ensureStringList(data, "damageImmunitiesList");
  mountDamageResponseEditor(root, {
    vulnerabilities,
    resistances,
    immunities,
  });

  const conditionImmunities = ensureStringList(data, "conditionImmunitiesList");
  mountPresetSelectEditor(
    root,
    "Zustandsimmunitäten",
    CREATURE_CONDITION_PRESETS,
    makeModel(conditionImmunities),
    "Zustandsimmunität suchen oder eingeben…",
  );

  const gear = ensureStringList(data, "gearList");
  mountTokenEditor(
    root,
    "Ausrüstung/Gear",
    {
      getItems: () => gear,
      add: (value) => {
        const trimmed = value.trim();
        if (!trimmed) return;
        if (!gear.includes(trimmed)) gear.push(trimmed);
      },
      remove: (index) => gear.splice(index, 1),
    },
    { placeholder: "Gegenstand oder Hinweis…", addButtonLabel: "+ Hinzufügen" },
  );
}
