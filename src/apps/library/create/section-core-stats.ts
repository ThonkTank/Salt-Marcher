// src/apps/library/create/section-core-stats.ts
import { Setting } from "obsidian";
import { enhanceSelectToSearch } from "../../../ui/search-dropdown";
import type { StatblockData } from "../core/creature-files";

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
    ["Tiny","Small","Medium","Large","Huge","Gargantuan"].forEach((s) => dd.addOption(s, s));
    dd.onChange((v: string) => (data.size = v));
    try { enhanceSelectToSearch(dd.selectEl, 'Such-dropdown…'); } catch {}
  });

  const typeSetting = new Setting(root).setName("Typ");
  typeSetting.addDropdown((dd) => {
    dd.addOption("", "");
    ["Aberration","Beast","Celestial","Construct","Dragon","Elemental","Fey","Fiend","Giant","Humanoid","Monstrosity","Ooze","Plant","Undead"].forEach((s) => dd.addOption(s, s));
    dd.onChange((v: string) => (data.type = v));
    try { enhanceSelectToSearch(dd.selectEl, 'Such-dropdown…'); } catch {}
  });

  const alignSetting = new Setting(root).setName("Gesinnung");
  alignSetting.addDropdown((dd) => {
    dd.addOption("", "");
    ["Lawful","Neutral","Chaotic"].forEach((s) => dd.addOption(s, s));
    dd.onChange((v: string) => (data.alignmentLawChaos = v));
    try { const el = dd.selectEl; el.dataset.sdOpenAll = '0'; enhanceSelectToSearch(el, 'Such-dropdown…'); } catch {}
  });
  alignSetting.addDropdown((dd) => {
    dd.addOption("", "");
    ["Good","Neutral","Evil"].forEach((s) => dd.addOption(s, s));
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

  const parseIntSafe = (v?: string) => { const m = String(v ?? '').match(/-?\d+/); return m ? parseInt(m[0], 10) : NaN; };
  const abilityMod = (score?: string) => { const n = parseIntSafe(score); if (Number.isNaN(n)) return 0; return Math.floor((n - 10) / 2); };
  const fmt = (n: number) => (n>=0?'+':'')+n;

  const abDefs = [
    { key: 'str', label: 'STR' }, { key: 'dex', label: 'DEX' }, { key: 'con', label: 'CON' },
    { key: 'int', label: 'INT' }, { key: 'wis', label: 'WIS' }, { key: 'cha', label: 'CHA' },
  ] as const;

  const abilityElems = new Map<string, { score: HTMLInputElement; mod: HTMLElement; save: HTMLInputElement; saveMod: HTMLElement }>();

  const ensureSets = () => {
    if (!data.saveProf) data.saveProf = {} as any;
    if (!data.skillsProf) data.skillsProf = [];
    if (!data.skillsExpertise) data.skillsExpertise = [];
  };

  for (const s of abDefs) {
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

  const skills: Array<[string,string]> = [
    ['Athletics','str'],
    ['Acrobatics','dex'],['Sleight of Hand','dex'],['Stealth','dex'],
    ['Arcana','int'],['History','int'],['Investigation','int'],['Nature','int'],['Religion','int'],
    ['Animal Handling','wis'],['Insight','wis'],['Medicine','wis'],['Perception','wis'],['Survival','wis'],
    ['Deception','cha'],['Intimidation','cha'],['Performance','cha'],['Persuasion','cha'],
  ];

  const skillElems: Array<{ ability: string; prof: HTMLInputElement; exp: HTMLInputElement; out: HTMLElement }> = [];
  for (const [name, abil] of skills) {
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
      refs.mod.textContent = fmt(mod);
      const saveBonus = (data.saveProf as any)?.[key] ? pb : 0;
      refs.saveMod.textContent = fmt(mod + saveBonus);
    }
    for (const sk of skillElems) {
      const mod = abilityMod((data as any)[sk.ability]);
      const bonus = sk.exp.checked ? pb * 2 : sk.prof.checked ? pb : 0;
      sk.out.textContent = fmt(mod + bonus);
    }
  };
  updateMods();

  // Senses & Languages token editors
  const makeTokenEditor = (host: HTMLElement, title: string, items: () => string[], onAdd: (v: string) => void, onRemove: (i: number) => void) => {
    new Setting(host).setName(title).addText((t) => {
      t.setPlaceholder("Begriff eingeben…");
      const input = t.inputEl;
      t.inputEl.style.minWidth = '260px';
      t.inputEl.addEventListener('keydown', (e: KeyboardEvent) => { if (e.key === 'Enter') { const v = input.value.trim(); if (v) { onAdd(v); input.value = ''; renderChips(); } }});
    }).addButton((b) => b.setButtonText("+").onClick(() => { const inp = b.buttonEl.parentElement?.querySelector('input') as HTMLInputElement | null; const v = inp?.value?.trim(); if (v) { onAdd(v); inp.value=''; renderChips(); } }));
    const chips = host.createDiv({ cls: 'sm-cc-chips' });
    const renderChips = () => {
      chips.empty();
      items().forEach((txt, i) => {
        const chip = chips.createDiv({ cls: 'sm-cc-chip' });
        chip.createSpan({ text: txt });
        const x = chip.createEl('button', { text: '×' });
        x.onclick = () => { onRemove(i); renderChips(); };
      });
    };
    renderChips();
  };

  if (!data.sensesList) data.sensesList = [];
  if (!data.languagesList) data.languagesList = [];
  makeTokenEditor(root, "Sinne", () => data.sensesList!, (v) => data.sensesList!.push(v), (i) => data.sensesList!.splice(i, 1));
  makeTokenEditor(root, "Sprachen", () => data.languagesList!, (v) => data.languagesList!.push(v), (i) => data.languagesList!.splice(i, 1));
}

