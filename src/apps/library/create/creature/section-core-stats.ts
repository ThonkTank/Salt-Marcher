// src/apps/library/create/creature/section-core-stats.ts
import { Setting } from "obsidian";
import { enhanceSelectToSearch } from "../../../../ui/search-dropdown";
import { mountTokenEditor } from "../shared/token-editor";
import { abilityMod, formatSigned, parseIntSafe } from "../shared/stat-utils";
import type { StatblockData } from "../../core/creature-files";
import {
  CREATURE_ABILITIES,
  CREATURE_ALIGNMENT_GOOD_EVIL,
  CREATURE_ALIGNMENT_LAW_CHAOS,
  CREATURE_CONDITION_PRESETS,
  CREATURE_DAMAGE_PRESETS,
  CREATURE_LANGUAGE_PRESETS,
  CREATURE_PASSIVE_PRESETS,
  CREATURE_SENSE_PRESETS,
  CREATURE_SIZES,
  CREATURE_SKILLS,
  CREATURE_TYPES,
  type CreatureAbilityKey,
} from "./presets";

interface PresetSelectModel {
  get(): string[];
  add(value: string): void;
  remove(index: number): void;
}

interface PresetSelectEditorOptions {
  placeholder?: string;
  inlineLabel?: string;
  rowClass?: string;
}

type PresetSelectEditorConfig = string | PresetSelectEditorOptions | undefined;

type DamageResponseKind = "res" | "imm" | "vuln";

interface DamageResponseConfig {
  kind: DamageResponseKind;
  label: string;
  list: string[];
  chipClass: string;
}

function mountPresetSelectEditor(
  parent: HTMLElement,
  title: string,
  options: readonly string[],
  model: PresetSelectModel,
  config?: PresetSelectEditorConfig,
) {
  const resolved: PresetSelectEditorOptions =
    typeof config === "string" ? { placeholder: config } : config ?? {};
  const { placeholder, inlineLabel, rowClass } = resolved;
  const setting = new Setting(parent).setName(title);
  const rowClasses = ["sm-cc-searchbar"];
  if (rowClass) rowClasses.push(rowClass);
  const row = setting.controlEl.createDiv({ cls: rowClasses.join(" ") });
  let labelEl: HTMLLabelElement | undefined;
  let controlId: string | undefined;
  if (inlineLabel) {
    controlId = `sm-cc-select-${Math.random().toString(36).slice(2)}`;
    labelEl = row.createEl("label", { text: inlineLabel, attr: { for: controlId } });
  }
  const select = row.createEl(
    "select",
    controlId ? { attr: { id: controlId } } : undefined,
  ) as HTMLSelectElement;
  const blank = select.createEl("option", { text: "Auswahl…" }) as HTMLOptionElement;
  blank.value = "";
  for (const option of options) {
    const opt = select.createEl("option", { text: option }) as HTMLOptionElement;
    opt.value = option;
  }
  try { enhanceSelectToSearch(select, placeholder ?? "Such-dropdown…"); } catch {}
  const searchInput = (select as any)._smSearchInput as HTMLInputElement | undefined;
  if (searchInput) {
    if (placeholder) searchInput.placeholder = placeholder;
    if (!searchInput.id) {
      searchInput.id = controlId ?? `sm-cc-input-${Math.random().toString(36).slice(2)}`;
    }
    if (labelEl) labelEl.htmlFor = searchInput.id;
  }

  const addBtn = row.createEl("button", { text: "+ Hinzufügen", attr: { type: "button" } });
  const chips = setting.controlEl.createDiv({ cls: "sm-cc-chips" });

  const renderChips = () => {
    chips.empty();
    model.get().forEach((txt, index) => {
      const chip = chips.createDiv({ cls: "sm-cc-chip" });
      chip.createSpan({ text: txt });
      const removeBtn = chip.createEl("button", {
        cls: "sm-cc-chip__remove",
        text: "×",
        attr: { type: "button", "aria-label": `${txt} entfernen` },
      });
      removeBtn.onclick = () => {
        model.remove(index);
        renderChips();
      };
    });
  };

  addBtn.onclick = () => {
    const selectedValue = select.value.trim();
    const typedValue = searchInput?.value.trim() ?? "";
    let value = selectedValue;
    if (!value && typedValue) {
      const match = Array.from(select.options).find((opt) => opt.text.trim().toLowerCase() === typedValue.toLowerCase());
      value = match ? match.value.trim() : typedValue;
    }
    if (!value) {
      select.value = "";
      if (searchInput) searchInput.value = "";
      return;
    }
    model.add(value);
    select.value = "";
    if (searchInput) searchInput.value = "";
    renderChips();
  };

  renderChips();
}

function mountDamageResponseEditor(
  parent: HTMLElement,
  damageLists: { resistances: string[]; immunities: string[]; vulnerabilities: string[] },
) {
  const configs: DamageResponseConfig[] = [
    {
      kind: "res",
      label: "Resistenz",
      list: damageLists.resistances,
      chipClass: "sm-cc-damage-chip--res",
    },
    {
      kind: "imm",
      label: "Immunität",
      list: damageLists.immunities,
      chipClass: "sm-cc-damage-chip--imm",
    },
    {
      kind: "vuln",
      label: "Verwundbarkeit",
      list: damageLists.vulnerabilities,
      chipClass: "sm-cc-damage-chip--vuln",
    },
  ];

  const setting = new Setting(parent).setName("Schadenstyp-Reaktionen");
  const row = setting.controlEl.createDiv({ cls: "sm-cc-searchbar sm-cc-damage-row" });
  row.createEl("label", { cls: "sm-cc-damage-label", text: "Schadenstyp" });

  const select = row.createEl("select", { cls: "sm-cc-damage-select" }) as HTMLSelectElement;
  const blank = select.createEl("option", { text: "Auswahl…" }) as HTMLOptionElement;
  blank.value = "";
  for (const option of CREATURE_DAMAGE_PRESETS) {
    const opt = select.createEl("option", { text: option }) as HTMLOptionElement;
    opt.value = option;
  }
  try { enhanceSelectToSearch(select, "Schadenstyp suchen…"); } catch {}
  const searchInput = (select as any)._smSearchInput as HTMLInputElement | undefined;

  const typeWrap = row.createDiv({ cls: "sm-cc-damage-type" });
  typeWrap.createSpan({ cls: "sm-cc-damage-type__label", text: "Status" });
  const btnWrap = typeWrap.createDiv({ cls: "sm-cc-damage-type__buttons" });

  let activeConfig = configs[0];
  const buttons = new Map<DamageResponseKind, HTMLButtonElement>();
  for (const config of configs) {
    const btn = btnWrap.createEl("button", {
      cls: "sm-cc-damage-type__btn",
      text: config.label,
      attr: { type: "button" },
    }) as HTMLButtonElement;
    buttons.set(config.kind, btn);
    btn.onclick = () => {
      activeConfig = config;
      for (const [kind, button] of buttons) {
        if (kind === config.kind) button.addClass("is-active");
        else button.removeClass("is-active");
      }
    };
  }
  buttons.get(activeConfig.kind)?.addClass("is-active");

  const addBtn = row.createEl("button", {
    cls: "sm-cc-damage-add",
    text: "+ Hinzufügen",
    attr: { type: "button" },
  });

  const chips = setting.controlEl.createDiv({ cls: "sm-cc-chips sm-cc-damage-chips" });

  const normalize = (value: string) => value.trim().toLowerCase();

  const renderChips = () => {
    chips.empty();
    for (const config of configs) {
      config.list.forEach((entry, index) => {
        const chip = chips.createDiv({ cls: `sm-cc-chip sm-cc-damage-chip ${config.chipClass}` });
        chip.createSpan({ cls: "sm-cc-damage-chip__name", text: entry });
        chip.createSpan({ cls: "sm-cc-damage-chip__badge", text: config.label });
        const removeBtn = chip.createEl("button", {
          cls: "sm-cc-chip__remove",
          text: "×",
          attr: { type: "button", "aria-label": `${config.label} entfernen` },
        });
        removeBtn.onclick = () => {
          config.list.splice(index, 1);
          renderChips();
        };
      });
    }
  };

  const addEntry = () => {
    const selectedValue = select.value.trim();
    const typedValue = searchInput?.value.trim() ?? "";
    let value = selectedValue;
    if (!value && typedValue) {
      const match = Array.from(select.options).find(
        (opt) => opt.text.trim().toLowerCase() === typedValue.toLowerCase(),
      );
      value = match ? match.value.trim() : typedValue;
    }
    const trimmed = value.trim();
    if (!trimmed) {
      select.value = "";
      if (searchInput) searchInput.value = "";
      return;
    }
    const list = activeConfig.list;
    if (list.some((entry) => normalize(entry) === normalize(trimmed))) {
      return;
    }
    list.push(trimmed);
    select.value = "";
    if (searchInput) searchInput.value = "";
    renderChips();
  };

  addBtn.addEventListener("click", addEntry);
  if (searchInput) {
    searchInput.addEventListener("keydown", (evt) => {
      if (evt.key === "Enter") {
        evt.preventDefault();
        addEntry();
      }
    });
  }

  renderChips();
}

export function mountCoreStatsSection(parent: HTMLElement, data: StatblockData) {
  const root = parent.createDiv();

  // Identity: Name, Größe, Typ, Gesinnung (zweiteilig)
  const idSetting = new Setting(root).setName("Name");
  idSetting.addText((t) => {
    t.setPlaceholder("Aboleth").setValue(data.name || "").onChange((v: string) => (data.name = v.trim()));
    t.inputEl.style.width = '30ch';
  });

  const sizeSetting = new Setting(root).setName("Größe");
  sizeSetting.addDropdown((dd) => {
    dd.addOption("", "");
    for (const option of CREATURE_SIZES) dd.addOption(option, option);
    dd.onChange((v: string) => (data.size = v));
    try { enhanceSelectToSearch(dd.selectEl, 'Such-dropdown…'); } catch {}
  });

  const typeSetting = new Setting(root).setName("Typ");
  typeSetting.addDropdown((dd) => {
    dd.addOption("", "");
    for (const option of CREATURE_TYPES) dd.addOption(option, option);
    dd.onChange((v: string) => (data.type = v));
    try { enhanceSelectToSearch(dd.selectEl, 'Such-dropdown…'); } catch {}
  });

  const alignSetting = new Setting(root).setName("Gesinnung");
  alignSetting.addDropdown((dd) => {
    dd.addOption("", "");
    for (const option of CREATURE_ALIGNMENT_LAW_CHAOS) dd.addOption(option, option);
    dd.onChange((v: string) => (data.alignmentLawChaos = v));
    try { const el = dd.selectEl; el.dataset.sdOpenAll = '0'; enhanceSelectToSearch(el, 'Such-dropdown…'); } catch {}
  });
  alignSetting.addDropdown((dd) => {
    dd.addOption("", "");
    for (const option of CREATURE_ALIGNMENT_GOOD_EVIL) dd.addOption(option, option);
    dd.onChange((v: string) => (data.alignmentGoodEvil = v));
    try { const el = dd.selectEl; el.dataset.sdOpenAll = '0'; enhanceSelectToSearch(el, 'Such-dropdown…'); } catch {}
  });

  // Kernwerte: AC, Init, HP, HD, PB, CR, XP
  const coreSetting = new Setting(root).setName("Kernwerte");
  const row = coreSetting.controlEl.createDiv({ cls: 'sm-cc-inline-row' });
  const mk = (label: string, widthCh: number, placeholder: string, key: keyof StatblockData) => {
    row.createEl('label', { text: label });
    const inp = row.createEl('input', { attr: { type: 'text', placeholder, 'aria-label': label } }) as HTMLInputElement;
    inp.style.width = `${widthCh}ch`;
    inp.value = (data[key] as any) || '';
    inp.addEventListener('input', () => ((data as any)[key] = inp.value.trim()));
  };
  mk('AC', 18, '17', 'ac');
  mk('Init', 6, '+7', 'initiative');
  mk('HP', 8, '150', 'hp');
  mk('HD', 14, '20d10 + 40', 'hitDice');
  mk('PB', 5, '+4', 'pb');
  mk('CR', 6, '10', 'cr');
  mk('XP', 8, '5900', 'xp');

  // Abilities + Saves
  const abilitySection = root.createDiv({ cls: "sm-cc-skills" });
  abilitySection.createEl("h4", { text: "Stats" });
  const abilityElems = new Map<CreatureAbilityKey, { score: HTMLInputElement; mod: HTMLElement; save: HTMLInputElement; saveMod: HTMLElement }>();

  const ensureSets = () => {
    if (!data.saveProf) data.saveProf = {} as any;
    if (!data.skillsProf) data.skillsProf = [];
    if (!data.skillsExpertise) data.skillsExpertise = [];
  };

  const statsGrid = abilitySection.createDiv({ cls: "sm-cc-stats-grid" });

  for (const s of CREATURE_ABILITIES) {
    const statEl = statsGrid.createDiv({ cls: "sm-cc-stat" });

    const header = statEl.createDiv({ cls: "sm-cc-stat__header" });
    header.createSpan({ text: s.label });
    const scoreWrap = header.createDiv({ cls: "sm-inline-number sm-cc-stat__score" });
    const score = scoreWrap.createEl("input", { attr: { type: "number", placeholder: "10", min: "0", step: "1" } }) as HTMLInputElement;
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
    score.addEventListener("input", () => { (data as any)[s.key] = score.value.trim(); updateMods(); });

    const modRow = statEl.createDiv({ cls: "sm-cc-stat__mod" });
    modRow.createSpan({ text: "Mod" });
    const modOut = modRow.createSpan({ cls: "sm-cc-stat__mod-value", text: "+0" });

    const saveRow = statEl.createDiv({ cls: "sm-cc-stat__save" });
    saveRow.createSpan({ cls: "sm-cc-stat__save-label", text: "Save mod" });
    const saveControls = saveRow.createDiv({ cls: "sm-cc-stat__save-controls" });
    const saveCb = saveControls.createEl("input", { attr: { type: "checkbox", "aria-label": `${s.label} Save Proficiency` } }) as HTMLInputElement;
    const saveOut = saveControls.createSpan({ cls: "sm-cc-stat__save-value", text: "+0" });

    ensureSets();
    saveCb.checked = !!(data.saveProf as any)[s.key];
    saveCb.addEventListener("change", () => { (data.saveProf as any)[s.key] = saveCb.checked; updateMods(); });
    abilityElems.set(s.key, { score, mod: modOut, save: saveCb, saveMod: saveOut });
  }

  // Skills
  const skillAbilityMap = new Map<string, CreatureAbilityKey>(CREATURE_SKILLS);
  const skillsSetting = new Setting(root).setName("Fertigkeiten");
  skillsSetting.settingEl.addClass("sm-cc-skills");
  const skillsControl = skillsSetting.controlEl;
  skillsControl.addClass("sm-cc-skill-editor");

  skillsSetting.nameEl.empty();

  const skillsRow = skillsControl.createDiv({ cls: "sm-cc-searchbar sm-cc-skill-search" });
  const skillsSelectId = "sm-cc-skill-select";
  const skillsLabel = skillsRow.createEl("label", { text: "Fertigkeiten", attr: { for: skillsSelectId } });
  const skillsSelect = skillsRow.createEl("select", { attr: { id: skillsSelectId } }) as HTMLSelectElement;
  const blankSkill = skillsSelect.createEl("option", { text: "Fertigkeit wählen…" }) as HTMLOptionElement;
  blankSkill.value = "";
  for (const [name] of CREATURE_SKILLS) {
    const opt = skillsSelect.createEl("option", { text: name }) as HTMLOptionElement;
    opt.value = name;
  }
  try { enhanceSelectToSearch(skillsSelect, "Fertigkeit suchen…"); } catch {}
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
      const match = Array.from(skillsSelect.options).find((opt) => opt.text.trim().toLowerCase() === typed.toLowerCase());
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

  const ensureStringList = (key: keyof StatblockData & string): string[] => {
    const current = (data as any)[key];
    if (Array.isArray(current)) return current as string[];
    const arr: string[] = [];
    (data as any)[key] = arr;
    return arr;
  };
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

  const senses = ensureStringList("sensesList");
  mountPresetSelectEditor(
    root,
    "Sinne",
    CREATURE_SENSE_PRESETS,
    makeModel(senses),
    { placeholder: "Sinn suchen oder eingeben…", inlineLabel: "Eintrag", rowClass: "sm-cc-senses-search" },
  );

  const languages = ensureStringList("languagesList");
  mountPresetSelectEditor(
    root,
    "Sprachen",
    CREATURE_LANGUAGE_PRESETS,
    makeModel(languages),
    { placeholder: "Sprache suchen oder eingeben…", inlineLabel: "Eintrag", rowClass: "sm-cc-senses-search" },
  );

  const passives = ensureStringList("passivesList");
  mountPresetSelectEditor(root, "Passive Werte", CREATURE_PASSIVE_PRESETS, makeModel(passives), "Passiven Wert suchen oder eingeben…");

  const vulnerabilities = ensureStringList("damageVulnerabilitiesList");
  const resistances = ensureStringList("damageResistancesList");
  const immunities = ensureStringList("damageImmunitiesList");
  mountDamageResponseEditor(root, {
    vulnerabilities,
    resistances,
    immunities,
  });

  const conditionImmunities = ensureStringList("conditionImmunitiesList");
  mountPresetSelectEditor(root, "Zustandsimmunitäten", CREATURE_CONDITION_PRESETS, makeModel(conditionImmunities), "Zustandsimmunität suchen oder eingeben…");

  const gear = ensureStringList("gearList");
  mountTokenEditor(root, "Ausrüstung/Gear", {
    getItems: () => gear,
    add: (value) => {
      const trimmed = value.trim();
      if (!trimmed) return;
      if (!gear.includes(trimmed)) gear.push(trimmed);
    },
    remove: (index) => gear.splice(index, 1),
  }, { placeholder: "Gegenstand oder Hinweis…", addButtonLabel: "+ Hinzufügen" });
}

