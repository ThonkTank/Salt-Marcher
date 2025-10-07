// src/apps/library/create/creature/sections.ts
// Consolidated section mounting functions for creature modal

import { Setting } from "obsidian";
import { enhanceExistingSelectDropdown } from "../shared/form-controls";
import type { StatblockData } from "../../core/creature-files";
import { mountTokenEditor } from "../shared/token-editor";
import { createFormCard, createFieldGrid } from "../shared/layouts";
import {
  mountMovementEditor,
  mountPresetSelectEditor,
  mountDamageResponseEditor,
  type PresetSelectModel,
  type SectionValidationRegistrar
} from "../shared/creature-controls";
import { abilityMod, formatSigned, parseIntSafe } from "../shared/stat-utils";
import { createAlignmentEditor, createMovementModel, createStatColumn, type StatColumnRefs, createSkillManager } from "./components/section-helpers";
import { validateEntry } from "./entry-model";
import { createEntryCard } from "./components/entry-card";
import {
  CREATURE_SIZES,
  CREATURE_TYPES,
  CREATURE_MOVEMENT_TYPES,
  CREATURE_ABILITIES,
  type CreatureAbilityKey,
  CREATURE_CONDITION_PRESETS,
  CREATURE_LANGUAGE_PRESETS,
  CREATURE_PASSIVE_PRESETS,
  CREATURE_SENSE_PRESETS,
  CREATURE_ENTRY_CATEGORIES,
  type CreatureEntryCategory,
} from "./presets";

// ============================================================================
// SHARED HELPERS
// ============================================================================

function ensureArray(data: StatblockData, key: keyof StatblockData): string[] {
  const current = (data as any)[key];
  if (Array.isArray(current)) return current;
  const arr: string[] = [];
  (data as any)[key] = arr;
  return arr;
}

function createTextSetting(grid: ReturnType<typeof createFieldGrid>, label: string, placeholder: string, key: keyof StatblockData, data: StatblockData) {
  const setting = grid.createSetting(label);
  setting.settingEl.addClass("sm-cc-setting--show-name");
  setting.addText((t) => {
    t.setPlaceholder(placeholder)
      .setValue((data[key] as string) ?? "")
      .onChange((v: string) => ((data as any)[key] = v.trim()));
    t.inputEl.classList.add("sm-cc-input");
  });
  return setting;
}

function createPresetModel(list: string[], onMutate?: () => void): PresetSelectModel {
  return {
    get: () => list,
    add: (value: string) => {
      const trimmed = value.trim();
      if (trimmed && !list.includes(trimmed)) {
        list.push(trimmed);
        onMutate?.();
      }
    },
    remove: (index: number) => {
      if (index >= 0 && index < list.length) {
        list.splice(index, 1);
        onMutate?.();
      }
    },
  };
}

// ============================================================================
// AUTOCOMPLETE HELPER
// ============================================================================

interface AutocompleteOptions {
  app: any;
  inputEl: HTMLInputElement;
  onSelect: (preset: any) => void;
}

function setupCreatureAutocomplete({ app, inputEl, onSelect }: AutocompleteOptions) {
  let container: HTMLDivElement | null = null;
  let selectedIndex = -1;

  const hide = () => {
    container?.remove();
    container = null;
    selectedIndex = -1;
  };

  const updateSelection = () => {
    if (!container) return;
    const items = container.querySelectorAll('.sm-cc-autocomplete__item');
    items.forEach((item, index) => {
      item.classList.toggle('is-selected', index === selectedIndex);
    });
  };

  const selectItem = () => {
    if (!container || selectedIndex < 0) return;
    const items = container.querySelectorAll('.sm-cc-autocomplete__item');
    (items[selectedIndex] as HTMLElement)?.click();
  };

  const show = async (query: string) => {
    if (query.length < 2) {
      hide();
      return;
    }

    const { findCreaturePresets } = await import('../../core/creature-presets');
    const results = await findCreaturePresets(app, query, { limit: 8 });

    if (results.length === 0) {
      hide();
      return;
    }

    if (!container) {
      container = document.createElement('div');
      container.className = 'sm-cc-autocomplete';
      inputEl.parentElement?.appendChild(container);
    }

    container.empty();
    selectedIndex = -1;

    results.forEach((result, index) => {
      const item = container!.createDiv({ cls: 'sm-cc-autocomplete__item' });
      item.createDiv({ cls: 'sm-cc-autocomplete__name', text: result.data.name });

      const meta = item.createDiv({ cls: 'sm-cc-autocomplete__meta' });
      const parts = [result.data.size, result.data.type, result.data.cr && `CR ${result.data.cr}`].filter(Boolean);
      meta.setText(parts.join(' • '));

      item.addEventListener('click', () => {
        hide();
        onSelect(result.data);
      });

      item.addEventListener('mouseenter', () => {
        selectedIndex = index;
        updateSelection();
      });
    });

    updateSelection();
  };

  inputEl.addEventListener('input', () => void show(inputEl.value));

  inputEl.addEventListener('keydown', (e) => {
    if (!container) return;
    const items = container.querySelectorAll('.sm-cc-autocomplete__item');
    if (items.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      selectedIndex = (selectedIndex + 1) % items.length;
      updateSelection();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      selectedIndex = selectedIndex <= 0 ? items.length - 1 : selectedIndex - 1;
      updateSelection();
    } else if (e.key === 'Enter' && selectedIndex >= 0) {
      e.preventDefault();
      selectItem();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      hide();
    }
  });

  inputEl.addEventListener('blur', () => setTimeout(hide, 200));
}

// ============================================================================
// SECTION: BASICS (Classification & Vitals)
// ============================================================================

export function mountCreatureClassificationSection(
  parent: HTMLElement,
  data: StatblockData,
  options?: {
    onPresetSelected?: (preset: any) => void;
    app?: any;
  }
) {
  const card = createFormCard(parent, {
    title: "Identität & Klassifikation",
    role: "group",
  });
  card.card.addClass("sm-cc-card--basics");
  card.body.addClass("sm-cc-card__body--basics");

  const identitySection = card.body.createDiv({ cls: "sm-cc-card__section sm-cc-card__section--basics" });
  const identityGrid = createFieldGrid(identitySection, {
    variant: "identity",
    className: "sm-cc-field-grid--basics",
    minColumnWidth: "18rem",
  });

  // Name with autocomplete
  const nameSetting = identityGrid.createSetting("Name");
  nameSetting.settingEl.addClass("sm-cc-setting--show-name");
  nameSetting.addText((t) => {
    t.setPlaceholder("Aboleth oder Preset suchen...")
      .setValue(data.name || "")
      .onChange((v: string) => (data.name = v.trim()));
    t.inputEl.classList.add("sm-cc-input");

    if (options?.app && options?.onPresetSelected) {
      setupCreatureAutocomplete({
        app: options.app,
        inputEl: t.inputEl,
        onSelect: options.onPresetSelected
      });
    }
  });

  // Type and Size dropdowns
  const typeSetting = identityGrid.createSetting("Typ");
  typeSetting.settingEl.addClass("sm-cc-setting--show-name");
  typeSetting.addDropdown((dd) => {
    dd.addOption("", "");
    CREATURE_TYPES.forEach(opt => dd.addOption(opt, opt));
    dd.onChange((v: string) => (data.type = v));
    dd.selectEl.classList.add("sm-cc-select");
    const handle = enhanceExistingSelectDropdown(dd.selectEl, "Such-dropdown…");
    handle.setValue(data.type ?? "");
  });

  const sizeSetting = identityGrid.createSetting("Größe");
  sizeSetting.settingEl.addClass("sm-cc-setting--show-name");
  sizeSetting.addDropdown((dd) => {
    dd.addOption("", "");
    CREATURE_SIZES.forEach(opt => dd.addOption(opt, opt));
    dd.onChange((v: string) => (data.size = v));
    dd.selectEl.classList.add("sm-cc-select");
    const handle = enhanceExistingSelectDropdown(dd.selectEl, "Such-dropdown…");
    handle.setValue(data.size ?? "");
  });

  // Type tags
  const tags = ensureArray(data, "typeTags");
  const typeTagsEditor = mountTokenEditor(identitySection, "Typ-Tags", {
    getItems: () => tags.slice(),
    add: (value) => {
      const normalized = value.trim();
      if (normalized && !tags.some(t => t.toLowerCase() === normalized.toLowerCase())) {
        tags.push(normalized);
        typeTagsEditor.refresh();
      }
    },
    remove: (index) => {
      tags.splice(index, 1);
      typeTagsEditor.refresh();
    },
  }, {
    placeholder: "z. B. shapechanger",
    addButtonLabel: "+ Tag",
  });
  typeTagsEditor.setting.settingEl.addClass("sm-cc-setting--stack");

  // Classification fields
  const classificationSection = card.body.createDiv({ cls: "sm-cc-card__section sm-cc-card__section--basics" });
  const classificationGrid = createFieldGrid(classificationSection, {
    variant: "classification",
    className: "sm-cc-field-grid--basics",
    minColumnWidth: "16rem",
  });

  createAlignmentEditor({ grid: classificationGrid, data });
  createTextSetting(classificationGrid, "PB", "+4", "pb", data);
  createTextSetting(classificationGrid, "CR", "10", "cr", data);
  createTextSetting(classificationGrid, "XP", "5900", "xp", data);
}

export function mountCreatureVitalSection(parent: HTMLElement, data: StatblockData) {
  const card = createFormCard(parent, {
    title: "Vitalwerte & Bewegung",
    role: "group",
  });
  card.card.addClass("sm-cc-card--basics");
  card.body.addClass("sm-cc-card__body--basics");

  const vitalsSection = card.body.createDiv({ cls: "sm-cc-card__section sm-cc-card__section--basics" });
  const vitalsGrid = createFieldGrid(vitalsSection, {
    variant: "vitals",
    className: "sm-cc-field-grid--basics",
    minColumnWidth: "16rem",
  });

  createTextSetting(vitalsGrid, "AC", "17", "ac", data);
  createTextSetting(vitalsGrid, "HP", "150", "hp", data);
  createTextSetting(vitalsGrid, "Initiative", "+7", "initiative", data);
  createTextSetting(vitalsGrid, "Hit Dice", "20d10 + 40", "hitDice", data);

  const movementSection = card.body.createDiv({ cls: "sm-cc-card__section sm-cc-card__section--basics" });
  const movementModel = createMovementModel(data, CREATURE_MOVEMENT_TYPES);
  mountMovementEditor(movementSection, "Bewegungsraten", CREATURE_MOVEMENT_TYPES, movementModel);
}

// ============================================================================
// SECTION: STATS AND SKILLS
// ============================================================================

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

  // Ensure data structures
  if (!data.saveProf) data.saveProf = {} as any;
  if (!data.skillsProf) data.skillsProf = [];
  if (!data.skillsExpertise) data.skillsExpertise = [];

  const abilityElems = new Map<CreatureAbilityKey, StatColumnRefs>();

  // Stats section
  const statsSection = root.createDiv({ cls: "sm-cc-stats-section" });
  statsSection.createEl("h4", { cls: "sm-cc-stats-section__title", text: "Stats" });

  const statsGrid = statsSection.createDiv({ cls: "sm-cc-stats-grid" });

  const abilityByKey = new Map(CREATURE_ABILITIES.map((def) => [def.key, def]));
  const statColumns: CreatureAbilityKey[][] = [
    ["str", "dex", "con"],
    ["int", "wis", "cha"],
  ];

  const updateMods = () => {
    const pb = parseIntSafe(data.pb as any) || 0;

    // Update ability mods and saves
    for (const [key, refs] of abilityElems) {
      const mod = abilityMod((data as any)[key]);
      refs.mod.textContent = formatSigned(mod);
      const saveBonus = (data.saveProf as any)?.[key] ? pb : 0;
      refs.saveMod.textContent = formatSigned(mod + saveBonus);
    }

    // Update skills
    const profs = new Set(data.skillsProf ?? []);
    data.skillsExpertise = (data.skillsExpertise ?? []).filter((name) => profs.has(name));
    skillManager.render();
    revalidate();
  };

  // Create stat columns
  for (const keys of statColumns) {
    const abilities = keys
      .map((key) => abilityByKey.get(key))
      .filter(Boolean) as Array<{ key: CreatureAbilityKey; label: string }>;

    const refs = createStatColumn(statsGrid, {
      abilities,
      data,
      onUpdate: updateMods,
    });

    for (const [key, ref] of refs) {
      abilityElems.set(key, ref);
    }
  }

  // Skills section
  const skillsSetting = new Setting(root).setName("Fertigkeiten");
  skillsSetting.settingEl.addClass("sm-cc-skills");
  const skillsControl = skillsSetting.controlEl;
  skillsControl.addClass("sm-cc-skill-editor");

  const revalidate = registerValidation?.(() => collectStatsAndSkillsIssues(data)) ?? (() => []);

  const skillManager = createSkillManager({
    parent: skillsControl,
    data,
    getAbilityMod: (key) => abilityMod((data as any)[key]),
    getProficiencyBonus: () => parseIntSafe(data.pb as any) || 0,
    onUpdate: updateMods,
  });

  skillManager.render();
  updateMods();
}

// ============================================================================
// SECTION: SENSES AND DEFENSES
// ============================================================================

export function mountCreatureSensesAndDefensesSection(
  parent: HTMLElement,
  data: StatblockData,
) {
  const root = parent.createDiv({ cls: "sm-cc-defenses" });

  const senses = ensureArray(data, "sensesList");
  const languages = ensureArray(data, "languagesList");
  const passives = ensureArray(data, "passivesList");
  const vulnerabilities = ensureArray(data, "damageVulnerabilitiesList");
  const resistances = ensureArray(data, "damageResistancesList");
  const immunities = ensureArray(data, "damageImmunitiesList");
  const conditionImmunities = ensureArray(data, "conditionImmunitiesList");

  // Defense summary pills
  const summary = root.createDiv({ cls: "sm-cc-defense-summary" });
  const summaryEntries = [
    { label: "Resistenzen", list: resistances, className: "sm-cc-defense-pill--res", emptyMessage: "Keine Resistenzen hinterlegt" },
    { label: "Immunitäten", list: immunities, className: "sm-cc-defense-pill--imm", emptyMessage: "Keine Immunitäten hinterlegt" },
    { label: "Verwundbarkeiten", list: vulnerabilities, className: "sm-cc-defense-pill--vuln", emptyMessage: "Keine Verwundbarkeiten hinterlegt" },
    { label: "Zustandsimmunitäten", list: conditionImmunities, className: "sm-cc-defense-pill--cond", emptyMessage: "Keine Zustandsimmunitäten hinterlegt", optional: true },
  ] as const;

  const refreshSummary = () => {
    summary.empty();
    summary.setAttribute("role", "list");

    for (const entry of summaryEntries) {
      if (entry.optional && entry.list.length === 0) continue;

      const pill = summary.createDiv({ cls: `sm-cc-defense-pill ${entry.className}` });
      const isEmpty = entry.list.length === 0;

      if (isEmpty) pill.addClass("is-empty");

      const tooltip = entry.list.length ? entry.list.join(", ") : entry.emptyMessage;
      pill.setAttribute("title", tooltip);
      pill.setAttribute("aria-label", `${entry.label}: ${tooltip}`);
      pill.setAttribute("role", "listitem");
      pill.createSpan({ cls: "sm-cc-defense-pill__label", text: entry.label });
      pill.createSpan({ cls: "sm-cc-defense-pill__count", text: entry.list.length.toString() });
    }

    if (!summary.hasChildNodes()) {
      summary.createSpan({ cls: "sm-cc-defense-pill__empty", text: "Keine Verteidigungsmerkmale erfasst" });
    }
  };

  refreshSummary();

  // Editors
  const sensesLanguages = root.createDiv({ cls: "sm-cc-senses-block" });

  mountPresetSelectEditor(sensesLanguages, "Sinne", CREATURE_SENSE_PRESETS, createPresetModel(senses, refreshSummary), {
    placeholder: "Sinn suchen oder eingeben…",
    rowClass: "sm-cc-senses-search",
    defaultAddButtonLabel: "+",
    settingClass: "sm-cc-senses-setting",
  });

  mountPresetSelectEditor(sensesLanguages, "Sprachen", CREATURE_LANGUAGE_PRESETS, createPresetModel(languages, refreshSummary), {
    placeholder: "Sprache suchen oder eingeben…",
    rowClass: "sm-cc-senses-search",
    defaultAddButtonLabel: "+",
    settingClass: "sm-cc-senses-setting",
  });

  mountPresetSelectEditor(root, "Passive Werte", CREATURE_PASSIVE_PRESETS, createPresetModel(passives, refreshSummary), "Passiven Wert suchen oder eingeben…");

  mountDamageResponseEditor(root, { vulnerabilities, resistances, immunities }, refreshSummary);

  mountPresetSelectEditor(root, "Zustandsimmunitäten", CREATURE_CONDITION_PRESETS, createPresetModel(conditionImmunities, refreshSummary), "Zustandsimmunität suchen oder eingeben…");

  const gear = ensureArray(data, "gearList");
  mountTokenEditor(root, "Ausrüstung/Gear", {
    getItems: () => gear,
    add: (value) => {
      const trimmed = value.trim();
      if (trimmed && !gear.includes(trimmed)) {
        gear.push(trimmed);
        refreshSummary();
      }
    },
    remove: (index) => {
      if (index >= 0 && index < gear.length) {
        gear.splice(index, 1);
        refreshSummary();
      }
    },
  }, {
    placeholder: "Gegenstand oder Hinweis…",
    addButtonLabel: "+ Hinzufügen",
  });
}

// ============================================================================
// SECTION: ENTRIES (Traits, Actions, etc.)
// ============================================================================

type EntryFilter = CreatureEntryCategory | "all";

const ENTRY_FILTER_OPTIONS: readonly { value: EntryFilter; label: string; hint: string }[] = [
  { value: "all", label: "Alle", hint: "Alle Einträge anzeigen" },
  { value: "trait", label: "Traits", hint: "Nur Eigenschaften anzeigen" },
  { value: "action", label: "Actions", hint: "Nur Aktionen anzeigen" },
  { value: "bonus", label: "Bonus", hint: "Nur Bonusaktionen anzeigen" },
  { value: "reaction", label: "Reactions", hint: "Nur Reaktionen anzeigen" },
  { value: "legendary", label: "Legendary", hint: "Nur legendäre Aktionen anzeigen" },
] as const;

export function collectEntryDependencyIssues(data: StatblockData): string[] {
  const entries = data.entries ?? [];
  return entries.flatMap((entry, index) => validateEntry(entry as any, index));
}

export function mountEntriesSection(
  parent: HTMLElement,
  data: StatblockData,
  registerValidation?: SectionValidationRegistrar,
) {
  if (!data.entries) data.entries = [] as any;

  const wrap = parent.createDiv({ cls: "setting-item sm-cc-entries" });
  wrap.createDiv({ cls: "setting-item-info", text: "Einträge (Traits, Aktionen, …)" });
  const ctl = wrap.createDiv({ cls: "setting-item-control" });

  let activeFilter: EntryFilter = "all";
  let focusIdx: number | null = null;

  // Add buttons
  const addBar = ctl.createDiv({ cls: "sm-cc-entry-add-bar" });
  addBar.createEl("span", { cls: "sm-cc-entry-add-label", text: "Hinzufügen:" });
  const addButtonGroup = addBar.createDiv({ cls: "sm-cc-entry-add-group" });

  for (const [value, label] of CREATURE_ENTRY_CATEGORIES) {
    const btn = addButtonGroup.createEl("button", {
      cls: `sm-cc-entry-add-btn sm-cc-entry-add-btn--${value}`,
      text: label,
      attr: { type: "button", "data-category": value }
    });
    btn.onclick = () => {
      (data.entries as any[]).unshift({ category: value as any, name: "" });
      if (activeFilter !== "all" && activeFilter !== value) {
        activeFilter = "all";
        updateFilterButtons();
      }
      focusIdx = 0;
      render();
    };
  }

  // Filter buttons
  const filterBar = ctl.createDiv({ cls: "sm-cc-entry-filter", attr: { role: "toolbar", "aria-label": "Eintragsliste filtern" } });
  const filterButtons = new Map<EntryFilter, HTMLButtonElement>();

  const updateFilterButtons = () => {
    for (const [value, btn] of filterButtons) {
      const isActive = value === activeFilter;
      btn.setAttr("aria-pressed", isActive ? "true" : "false");
      btn.toggleClass("is-active", isActive);
    }
  };

  for (const opt of ENTRY_FILTER_OPTIONS) {
    const btn = filterBar.createEl("button", {
      text: opt.label,
      attr: { type: "button", title: opt.hint, "aria-label": opt.hint, "aria-pressed": opt.value === activeFilter ? "true" : "false" }
    }) as HTMLButtonElement;
    btn.onclick = () => {
      activeFilter = opt.value;
      updateFilterButtons();
      render();
    };
    filterButtons.set(opt.value, btn);
  }

  const host = ctl.createDiv();
  const revalidate = registerValidation?.(() => collectEntryDependencyIssues(data)) ?? (() => []);

  const render = () => {
    updateFilterButtons();
    host.empty();

    (data.entries as any[]).forEach((entry, index) => {
      const shouldFocus = focusIdx === index;
      if (shouldFocus) focusIdx = null;

      const card = createEntryCard(host, {
        entry,
        index,
        data,
        onDelete: () => {
          (data.entries as any[]).splice(index, 1);
          render();
        },
        onMoveUp: () => {
          if (index > 0) {
            const entries = data.entries as any[];
            [entries[index], entries[index - 1]] = [entries[index - 1], entries[index]];
            revalidate();
            render();
          }
        },
        onMoveDown: () => {
          const entries = data.entries as any[];
          if (index < entries.length - 1) {
            [entries[index], entries[index + 1]] = [entries[index + 1], entries[index]];
            revalidate();
            render();
          }
        },
        canMoveUp: index > 0,
        canMoveDown: index < (data.entries as any[]).length - 1,
        onUpdate: () => {
          revalidate();
          render();
        },
        shouldFocus,
      });

      // Apply filter visibility
      const isVisible = activeFilter === "all" || entry.category === activeFilter;
      card.toggleClass("sm-cc-entry-hidden", !isVisible);
      (card.style as any).display = isVisible ? "" : "none";
      card.setAttr("aria-hidden", isVisible ? "false" : "true");
    });

    revalidate();
  };

  render();
}
