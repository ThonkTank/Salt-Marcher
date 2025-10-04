// src/apps/library/create/creature/section-senses-and-defenses.ts
// Erfasst Sinne, Sprachen, Passive Werte, Resistenz-/Immunitätslisten sowie Ausrüstung.
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

const makeModel = (list: string[], onMutate?: () => void): PresetSelectModel => ({
  get: () => list,
  add: (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    if (list.includes(trimmed)) return;
    list.push(trimmed);
    onMutate?.();
  },
  remove: (index: number) => {
    if (index < 0 || index >= list.length) return;
    list.splice(index, 1);
    onMutate?.();
  },
});

export function mountCreatureSensesAndDefensesSection(
  parent: HTMLElement,
  data: StatblockData,
) {
  const root = parent.createDiv({ cls: "sm-cc-defenses" });

  const senses = ensureStringList(data, "sensesList");
  const languages = ensureStringList(data, "languagesList");
  const passives = ensureStringList(data, "passivesList");
  const vulnerabilities = ensureStringList(data, "damageVulnerabilitiesList");
  const resistances = ensureStringList(data, "damageResistancesList");
  const immunities = ensureStringList(data, "damageImmunitiesList");
  const conditionImmunities = ensureStringList(data, "conditionImmunitiesList");
  const summary = root.createDiv({ cls: "sm-cc-defense-summary" });
  const summaryEntries = [
    {
      label: "Resistenzen",
      list: resistances,
      className: "sm-cc-defense-pill--res",
      emptyMessage: "Keine Resistenzen hinterlegt",
    },
    {
      label: "Immunitäten",
      list: immunities,
      className: "sm-cc-defense-pill--imm",
      emptyMessage: "Keine Immunitäten hinterlegt",
    },
    {
      label: "Verwundbarkeiten",
      list: vulnerabilities,
      className: "sm-cc-defense-pill--vuln",
      emptyMessage: "Keine Verwundbarkeiten hinterlegt",
    },
    {
      label: "Zustandsimmunitäten",
      list: conditionImmunities,
      className: "sm-cc-defense-pill--cond",
      emptyMessage: "Keine Zustandsimmunitäten hinterlegt",
      optional: true,
    },
  ] as const;

  const refreshSummary = () => {
    summary.empty();
    summary.setAttribute("role", "list");
    for (const entry of summaryEntries) {
      if (entry.optional && entry.list.length === 0) continue;
      const pill = summary.createDiv({
        cls: `sm-cc-defense-pill ${entry.className}`,
      }) as HTMLDivElement;
      const isEmpty = entry.list.length === 0;
      if (isEmpty) pill.addClass("is-empty");
      const tooltip = entry.list.length
        ? entry.list.join(", ")
        : entry.emptyMessage;
      pill.setAttribute("title", tooltip);
      pill.setAttribute(
        "aria-label",
        `${entry.label}: ${entry.list.length ? tooltip : entry.emptyMessage}`,
      );
      pill.setAttribute("role", "listitem");
      pill.createSpan({ cls: "sm-cc-defense-pill__label", text: entry.label });
      pill.createSpan({
        cls: "sm-cc-defense-pill__count",
        text: entry.list.length.toString(),
      });
    }
    if (!summary.hasChildNodes()) {
      summary.createSpan({
        cls: "sm-cc-defense-pill__empty",
        text: "Keine Verteidigungsmerkmale erfasst",
      });
    }
  };

  refreshSummary();

  const connectModel = (list: string[]) => makeModel(list, refreshSummary);

  const sensesLanguages = root.createDiv({ cls: "sm-cc-senses-block" });

  mountPresetSelectEditor(
    sensesLanguages,
    "Sinne",
    CREATURE_SENSE_PRESETS,
    connectModel(senses),
    {
      placeholder: "Sinn suchen oder eingeben…",
      rowClass: "sm-cc-senses-search",
      defaultAddButtonLabel: "+",
      settingClass: "sm-cc-senses-setting",
    },
  );

  mountPresetSelectEditor(
    sensesLanguages,
    "Sprachen",
    CREATURE_LANGUAGE_PRESETS,
    connectModel(languages),
    {
      placeholder: "Sprache suchen oder eingeben…",
      rowClass: "sm-cc-senses-search",
      defaultAddButtonLabel: "+",
      settingClass: "sm-cc-senses-setting",
    },
  );

  mountPresetSelectEditor(
    root,
    "Passive Werte",
    CREATURE_PASSIVE_PRESETS,
    connectModel(passives),
    "Passiven Wert suchen oder eingeben…",
  );

  mountDamageResponseEditor(
    root,
    {
      vulnerabilities,
      resistances,
      immunities,
    },
    () => refreshSummary(),
  );

  mountPresetSelectEditor(
    root,
    "Zustandsimmunitäten",
    CREATURE_CONDITION_PRESETS,
    connectModel(conditionImmunities),
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
        if (gear.includes(trimmed)) return;
        gear.push(trimmed);
        refreshSummary();
      },
      remove: (index) => {
        if (index < 0 || index >= gear.length) return;
        gear.splice(index, 1);
        refreshSummary();
      },
    },
    {
      placeholder: "Gegenstand oder Hinweis…",
      addButtonLabel: "+ Hinzufügen",
    },
  );
}
