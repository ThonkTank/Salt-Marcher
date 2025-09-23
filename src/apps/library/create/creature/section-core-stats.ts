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
  CREATURE_SIZES,
  CREATURE_SKILLS,
  CREATURE_TYPES,
  type CreatureAbilityKey,
} from "./presets";

export function mountCoreStatsSection(parent: HTMLElement, data: StatblockData) {
  const root = parent.createDiv();

  // Identity: Name, Größe, Typ, Gesinnung (zweiteilig)
  const identityGrid = root.createDiv({ cls: "sm-cc-identity-grid" });

  const nameSetting = new Setting(identityGrid)
    .setName("Name *")
    .setDesc("Pflichtfeld: Angezeigter Name der Kreatur.");
  nameSetting.settingEl.addClass("sm-cc-identity-grid__name");
  nameSetting.addText((t) => {
    const updateName = (v: string) => { data.name = v.trim(); };
    t.setPlaceholder("Aboleth").setValue(data.name || "").onChange(updateName);
    t.inputEl.dataset.role = "creature-name";
    t.inputEl.required = true;
    t.inputEl.addEventListener("input", () => updateName(t.inputEl.value));
  });

  const sizeSetting = new Setting(identityGrid)
    .setName("Größe *")
    .setDesc("Pflichtfeld: Wähle die Größenkategorie.");
  sizeSetting.addDropdown((dd) => {
    dd.addOption("", "");
    for (const option of CREATURE_SIZES) dd.addOption(option, option);
    dd.onChange((v: string) => (data.size = v));
    dd.setValue(data.size || "");
    try { enhanceSelectToSearch(dd.selectEl, "Such-dropdown…"); } catch {}
  });

  const typeSetting = new Setting(identityGrid)
    .setName("Typ *")
    .setDesc("Pflichtfeld: Kreaturentyp oder -tag.");
  typeSetting.addDropdown((dd) => {
    dd.addOption("", "");
    for (const option of CREATURE_TYPES) dd.addOption(option, option);
    dd.onChange((v: string) => (data.type = v));
    dd.setValue(data.type || "");
    try { enhanceSelectToSearch(dd.selectEl, "Such-dropdown…"); } catch {}
  });

  const alignSetting = new Setting(identityGrid)
    .setName("Gesinnung")
    .setDesc("Optional: Kombiniere Rechtschaffen/Neutral/Chaotisch mit Gut/Neutral/Böse.");
  alignSetting.settingEl.addClass("sm-cc-identity-grid__alignment");
  alignSetting.addDropdown((dd) => {
    dd.addOption("", "");
    for (const option of CREATURE_ALIGNMENT_LAW_CHAOS) dd.addOption(option, option);
    dd.onChange((v: string) => (data.alignmentLawChaos = v));
    dd.setValue(data.alignmentLawChaos || "");
    try {
      const el = dd.selectEl;
      el.dataset.sdOpenAll = "0";
      enhanceSelectToSearch(el, "Such-dropdown…");
    } catch {}
  });
  alignSetting.addDropdown((dd) => {
    dd.addOption("", "");
    for (const option of CREATURE_ALIGNMENT_GOOD_EVIL) dd.addOption(option, option);
    dd.onChange((v: string) => (data.alignmentGoodEvil = v));
    dd.setValue(data.alignmentGoodEvil || "");
    try {
      const el = dd.selectEl;
      el.dataset.sdOpenAll = "0";
      enhanceSelectToSearch(el, "Such-dropdown…");
    } catch {}
  });

  // Kernwerte: AC, Init, HP, HD, PB, CR, XP
  const coreSetting = new Setting(root)
    .setName("Kernwerte")
    .setDesc("Markierte Werte (*) sind Pflichtfelder für Vorschau & Export.");
  const coreGrid = coreSetting.controlEl.createDiv({ cls: "sm-cc-core-grid" });
  const mk = (
    label: string,
    placeholder: string,
    key: keyof StatblockData,
    options?: { required?: boolean; inputMode?: string }
  ) => {
    const field = coreGrid.createDiv({ cls: "sm-cc-core-grid__field" });
    const inputId = `sm-cc-core-${key}`;
    field.createEl("label", { text: options?.required ? `${label} *` : label, attr: { for: inputId } });
    const inp = field.createEl("input", {
      attr: {
        type: "text",
        placeholder,
        id: inputId,
        "aria-label": label,
        ...(options?.inputMode ? { inputmode: options.inputMode } : {}),
        ...(options?.required ? { "aria-required": "true" } : {}),
      },
    }) as HTMLInputElement;
    if (options?.required) inp.required = true;
    inp.value = ((data as any)[key] as string) || "";
    inp.addEventListener("input", () => ((data as any)[key] = inp.value.trim()));
  };
  mk("AC", "17", "ac", { required: true, inputMode: "numeric" });
  mk("Initiative", "+7", "initiative");
  mk("HP", "150", "hp", { required: true, inputMode: "numeric" });
  mk("Hit Dice", "20d10 + 40", "hitDice");
  mk("PB", "+4", "pb");
  mk("CR", "10", "cr", { required: true, inputMode: "numeric" });
  mk("XP", "5900", "xp", { inputMode: "numeric" });

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
}

