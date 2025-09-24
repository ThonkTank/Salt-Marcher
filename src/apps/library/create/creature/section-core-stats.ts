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
  CREATURE_PASSIVE_PRESETS,
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

function mountPresetSelectEditor(
  parent: HTMLElement,
  title: string,
  options: readonly string[],
  model: PresetSelectModel,
  customPlaceholder?: string,
) {
  const setting = new Setting(parent).setName(title);
  const row = setting.controlEl.createDiv({ cls: "sm-cc-searchbar" });
  const select = row.createEl("select") as HTMLSelectElement;
  const blank = select.createEl("option", { text: "Auswahl…" }) as HTMLOptionElement;
  blank.value = "";
  for (const option of options) {
    const opt = select.createEl("option", { text: option }) as HTMLOptionElement;
    opt.value = option;
  }
  try { enhanceSelectToSearch(select, "Such-dropdown…"); } catch {}
  const searchInput = (select as any)._smSearchInput as HTMLInputElement | undefined;
  if (customPlaceholder && searchInput) {
    searchInput.placeholder = customPlaceholder;
  }

  const addBtn = row.createEl("button", { text: "+ Hinzufügen" });
  const chips = setting.controlEl.createDiv({ cls: "sm-cc-chips" });

  const renderChips = () => {
    chips.empty();
    model.get().forEach((txt, index) => {
      const chip = chips.createDiv({ cls: "sm-cc-chip" });
      chip.createSpan({ text: txt });
      const removeBtn = chip.createEl("button", { text: "×" });
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
  const statsTbl = abilitySection.createDiv({ cls: "sm-cc-table sm-cc-stats-table" });
  const header = statsTbl.createDiv({ cls: "sm-cc-row sm-cc-header" });
  ;["Name","Wert","Mod","Save","Save Mod"].forEach(h => header.createDiv({ cls: "sm-cc-cell", text: h }));

  const abilityElems = new Map<CreatureAbilityKey, { score: HTMLInputElement; mod: HTMLElement; save: HTMLInputElement; saveMod: HTMLElement }>();

  const ensureSets = () => {
    if (!data.saveProf) data.saveProf = {} as any;
    if (!data.skillsProf) data.skillsProf = [];
    if (!data.skillsExpertise) data.skillsExpertise = [];
  };

  for (const s of CREATURE_ABILITIES) {
    const rowEl = statsTbl.createDiv({ cls: "sm-cc-row" });
    rowEl.createDiv({ cls: "sm-cc-cell", text: s.label });
    const scoreCell = rowEl.createDiv({ cls: "sm-cc-cell sm-inline-number" });
    const score = scoreCell.createEl("input", { attr: { type: "number", placeholder: "10", min: "0", step: "1" } }) as HTMLInputElement;
    const dec = scoreCell.createEl("button", { text: "−", cls: "btn-compact" });
    const inc = scoreCell.createEl("button", { text: "+", cls: "btn-compact" });
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
    const modOut = rowEl.createDiv({ cls: "sm-cc-cell", text: "+0" });
    const saveCb = rowEl.createEl("input", { cls: "sm-cc-cell", attr: { type: "checkbox" } }) as HTMLInputElement;
    const saveOut = rowEl.createDiv({ cls: "sm-cc-cell", text: "+0" });
    ensureSets(); saveCb.checked = !!(data.saveProf as any)[s.key];
    saveCb.addEventListener("change", () => { (data.saveProf as any)[s.key] = saveCb.checked; updateMods(); });
    abilityElems.set(s.key, { score, mod: modOut, save: saveCb, saveMod: saveOut });
  }

  // Skills
  const skillsSection = root.createDiv({ cls: "sm-cc-skills" });
  skillsSection.createEl("h4", { text: "Fertigkeiten" });
  const skillsTbl = skillsSection.createDiv({ cls: "sm-cc-table sm-cc-skills-table" });
  const skillsHeader = skillsTbl.createDiv({ cls: "sm-cc-row sm-cc-header" });
  ;["Name","Prof","Expertise","Mod"].forEach(h => skillsHeader.createDiv({ cls: "sm-cc-cell", text: h }));

  const skillElems: Array<{ ability: CreatureAbilityKey; prof: HTMLInputElement; exp: HTMLInputElement; out: HTMLElement }> = [];
  for (const [name, abil] of CREATURE_SKILLS) {
    const rowEl = skillsTbl.createDiv({ cls: "sm-cc-row" });
    rowEl.createDiv({ cls: "sm-cc-cell", text: name });
    const cbP = rowEl.createEl("input", { cls: "sm-cc-cell", attr: { type: "checkbox" } }) as HTMLInputElement;
    const cbE = rowEl.createEl("input", { cls: "sm-cc-cell", attr: { type: "checkbox" } }) as HTMLInputElement;
    const out = rowEl.createDiv({ cls: "sm-cc-cell", text: "+0" });
    ensureSets();
    cbP.checked = !!data.skillsProf?.includes(name);
    cbE.checked = !!data.skillsExpertise?.includes(name);
    cbP.addEventListener("change", () => {
      ensureSets();
      const arr = data.skillsProf!;
      if (cbP.checked && !arr.includes(name)) arr.push(name); else if (!cbP.checked) data.skillsProf = arr.filter(s => s !== name);
      updateMods();
    });
    cbE.addEventListener("change", () => {
      ensureSets();
      const arr = data.skillsExpertise!;
      if (cbE.checked && !arr.includes(name)) arr.push(name); else if (!cbE.checked) data.skillsExpertise = arr.filter(s => s !== name);
      updateMods();
    });
    skillElems.push({ ability: abil, prof: cbP, exp: cbE, out });
  }

  const updateMods = () => {
    const pb = parseIntSafe(data.pb as any) || 0;
    for (const [key, refs] of abilityElems) {
      const mod = abilityMod((data as any)[key]);
      refs.mod.textContent = formatSigned(mod);
      const saveBonus = (data.saveProf as any)?.[key] ? pb : 0;
      refs.saveMod.textContent = formatSigned(mod + saveBonus);
    }
    for (const sk of skillElems) {
      const mod = abilityMod((data as any)[sk.ability]);
      const bonus = sk.exp.checked ? pb * 2 : sk.prof.checked ? pb : 0;
      sk.out.textContent = formatSigned(mod + bonus);
    }
  };
  updateMods();

  if (!data.sensesList) data.sensesList = [];
  if (!data.languagesList) data.languagesList = [];
  mountTokenEditor(root, "Sinne", {
    getItems: () => data.sensesList!,
    add: (value) => data.sensesList!.push(value),
    remove: (index) => data.sensesList!.splice(index, 1),
  });
  mountTokenEditor(root, "Sprachen", {
    getItems: () => data.languagesList!,
    add: (value) => data.languagesList!.push(value),
    remove: (index) => data.languagesList!.splice(index, 1),
  });

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

  const passives = ensureStringList("passivesList");
  mountPresetSelectEditor(root, "Passive Werte", CREATURE_PASSIVE_PRESETS, makeModel(passives), "Passiven Wert suchen oder eingeben…");

  const vulnerabilities = ensureStringList("damageVulnerabilitiesList");
  mountPresetSelectEditor(root, "Verwundbarkeiten", CREATURE_DAMAGE_PRESETS, makeModel(vulnerabilities), "Verwundbarkeit suchen oder eingeben…");

  const resistances = ensureStringList("damageResistancesList");
  mountPresetSelectEditor(root, "Resistenzen", CREATURE_DAMAGE_PRESETS, makeModel(resistances), "Resistenz suchen oder eingeben…");

  const immunities = ensureStringList("damageImmunitiesList");
  mountPresetSelectEditor(root, "Immunitäten (Schaden)", CREATURE_DAMAGE_PRESETS, makeModel(immunities), "Schadensimmunität suchen oder eingeben…");

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

