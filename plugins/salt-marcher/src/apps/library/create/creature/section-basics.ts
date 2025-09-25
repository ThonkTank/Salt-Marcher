// src/apps/library/create/creature/section-basics.ts
import { Setting } from "obsidian";
import { enhanceSelectToSearch } from "../../../../ui/search-dropdown";
import type { StatblockData } from "../../core/creature-files";
import {
  CREATURE_ALIGNMENT_GOOD_EVIL,
  CREATURE_ALIGNMENT_LAW_CHAOS,
  CREATURE_MOVEMENT_TYPES,
  CREATURE_SIZES,
  CREATURE_TYPES,
  type CreatureMovementType,
} from "./presets";

function ensureSpeedList(data: StatblockData): string[] {
  if (!Array.isArray(data.speedList)) data.speedList = [];
  return data.speedList;
}

export function mountCreatureBasicsSection(parent: HTMLElement, data: StatblockData) {
  const root = parent.createDiv({ cls: "sm-cc-basics" });

  const grid = root.createDiv({ cls: "sm-cc-basics__grid" });
  const registerGridItem = (setting: Setting, span: 1 | 2 | 3 | 4 = 1) => {
    setting.settingEl.classList.add("sm-cc-basics__grid-item");
    if (span === 2) setting.settingEl.classList.add("sm-cc-basics__grid-item--span-2");
    if (span === 3) setting.settingEl.classList.add("sm-cc-basics__grid-item--span-3");
    if (span === 4) setting.settingEl.classList.add("sm-cc-basics__grid-item--span-4");
  };

  const idSetting = new Setting(grid).setName("Name");
  registerGridItem(idSetting, 2);
  idSetting.addText((t) => {
    t.setPlaceholder("Aboleth")
      .setValue(data.name || "")
      .onChange((v: string) => (data.name = v.trim()));
    t.inputEl.classList.add("sm-cc-basics__text-input");
    t.inputEl.style.width = "100%";
  });

  const typeSetting = new Setting(grid).setName("Typ");
  registerGridItem(typeSetting, 2);
  typeSetting.addDropdown((dd) => {
    dd.addOption("", "");
    for (const option of CREATURE_TYPES) dd.addOption(option, option);
    dd.setValue(data.type ?? "");
    dd.onChange((v: string) => (data.type = v));
    dd.selectEl.classList.add("sm-cc-basics__select");
    dd.selectEl.style.width = "100%";
    try {
      enhanceSelectToSearch(dd.selectEl, "Such-dropdown…");
    } catch {}
  });

  const sizeSetting = new Setting(grid).setName("Größe");
  registerGridItem(sizeSetting, 2);
  sizeSetting.addDropdown((dd) => {
    dd.addOption("", "");
    for (const option of CREATURE_SIZES) dd.addOption(option, option);
    dd.setValue(data.size ?? "");
    dd.onChange((v: string) => (data.size = v));
    dd.selectEl.classList.add("sm-cc-basics__select");
    dd.selectEl.style.width = "100%";
    try {
      enhanceSelectToSearch(dd.selectEl, "Such-dropdown…");
    } catch {}
  });

  const alignSetting = new Setting(grid).setName("Gesinnung");
  registerGridItem(alignSetting, 2);
  alignSetting.settingEl.classList.add("sm-cc-basics__alignment");
  alignSetting.controlEl.classList.add("sm-cc-basics__alignment-controls");
  alignSetting.addDropdown((dd) => {
    dd.addOption("", "");
    for (const option of CREATURE_ALIGNMENT_LAW_CHAOS) dd.addOption(option, option);
    dd.setValue(data.alignmentLawChaos ?? "");
    dd.onChange((v: string) => (data.alignmentLawChaos = v));
    dd.selectEl.classList.add("sm-cc-basics__alignment-select", "sm-cc-basics__select");
    dd.selectEl.style.width = "100%";
    try {
      const el = dd.selectEl;
      el.dataset.sdOpenAll = "0";
      enhanceSelectToSearch(el, "Such-dropdown…");
    } catch {}
  });
  alignSetting.addDropdown((dd) => {
    dd.addOption("", "");
    for (const option of CREATURE_ALIGNMENT_GOOD_EVIL) dd.addOption(option, option);
    dd.setValue(data.alignmentGoodEvil ?? "");
    dd.onChange((v: string) => (data.alignmentGoodEvil = v));
    dd.selectEl.classList.add("sm-cc-basics__alignment-select", "sm-cc-basics__select");
    dd.selectEl.style.width = "100%";
    try {
      const el = dd.selectEl;
      el.dataset.sdOpenAll = "0";
      enhanceSelectToSearch(el, "Such-dropdown…");
    } catch {}
  });

  const speedSetting = new Setting(grid).setName("Bewegung");
  registerGridItem(speedSetting, 4);
  const speedControl = speedSetting.controlEl.createDiv({ cls: "sm-cc-move-ctl" });

  const addRow = speedControl.createDiv({ cls: "sm-cc-searchbar sm-cc-move-row" });
  const typeSelect = addRow.createEl("select", { cls: "sm-sd" }) as HTMLSelectElement;
  for (const [value, label] of CREATURE_MOVEMENT_TYPES) {
    const option = typeSelect.createEl("option", { text: label }) as HTMLOptionElement;
    option.value = value;
  }
  typeSelect.classList.add("sm-cc-basics__select");
  try {
    enhanceSelectToSearch(typeSelect, "Such-dropdown…");
  } catch {}

  const hoverWrap = addRow.createDiv({ cls: "sm-cc-move-hover" });
  const hoverId = `sm-cc-hover-${Math.random().toString(36).slice(2)}`;
  const hoverCb = hoverWrap.createEl("input", {
    attr: { type: "checkbox", id: hoverId },
  }) as HTMLInputElement;
  hoverWrap.createEl("label", { text: "Hover", attr: { for: hoverId } });
  const updateHover = () => {
    const cur = typeSelect.value as CreatureMovementType;
    const isFly = cur === "fly";
    hoverWrap.style.display = isFly ? "" : "none";
    if (!isFly) hoverCb.checked = false;
  };
  updateHover();
  typeSelect.addEventListener("change", updateHover);

  const numWrap = addRow.createDiv({ cls: "sm-inline-number" });
  const valInput = numWrap.createEl("input", {
    attr: { type: "number", min: "0", step: "5", placeholder: "30" },
  }) as HTMLInputElement;
  valInput.classList.add("sm-cc-basics__text-input");
  const decBtn = numWrap.createEl("button", { text: "−", cls: "btn-compact" });
  const incBtn = numWrap.createEl("button", { text: "+", cls: "btn-compact" });
  const step = (dir: 1 | -1) => {
    const cur = parseInt(valInput.value, 10) || 0;
    const next = Math.max(0, cur + 5 * dir);
    valInput.value = String(next);
  };
  decBtn.onclick = () => step(-1);
  incBtn.onclick = () => step(1);

  const addSpeedBtn = addRow.createEl("button", {
    text: "+",
    cls: "sm-cc-move-add",
    attr: { "aria-label": "Geschwindigkeitswert hinzufügen" },
  });
  const speedChips = speedControl.createDiv({ cls: "sm-cc-chips" });

  const speeds = ensureSpeedList(data);
  const renderSpeeds = () => {
    speedChips.empty();
    speeds.forEach((txt, i) => {
      const chip = speedChips.createDiv({ cls: "sm-cc-chip" });
      chip.createSpan({ text: txt });
      const removeBtn = chip.createEl("button", {
        text: "×",
        cls: "sm-cc-chip__remove",
        attr: { "aria-label": `${txt} entfernen` },
      });
      removeBtn.onclick = () => {
        speeds.splice(i, 1);
        renderSpeeds();
      };
    });
  };
  renderSpeeds();

  addSpeedBtn.onclick = () => {
    const n = parseInt(valInput.value, 10);
    if (!Number.isFinite(n) || n <= 0) return;
    const kind = typeSelect.value as CreatureMovementType;
    const unit = "ft.";
    const label =
      kind === "walk"
        ? `${n} ${unit}`
        : kind === "fly" && hoverCb.checked
        ? `fly ${n} ${unit} (hover)`
        : `${kind} ${n} ${unit}`;
    speeds.push(label);
    valInput.value = "";
    hoverCb.checked = false;
    renderSpeeds();
  };

  const mkStatSetting = (
    label: string,
    placeholder: string,
    key: keyof StatblockData,
    span: 1 | 2 = 1,
  ) => {
    const setting = new Setting(grid).setName(label);
    registerGridItem(setting, span);
    setting.addText((t) => {
      t.setPlaceholder(placeholder)
        .setValue((data[key] as string) ?? "")
        .onChange((v: string) => ((data as any)[key] = v.trim()));
      t.inputEl.classList.add("sm-cc-basics__text-input");
      t.inputEl.style.width = "100%";
    });
  };

  mkStatSetting("HP", "150", "hp");
  mkStatSetting("AC", "17", "ac");
  mkStatSetting("Init", "+7", "initiative");
  mkStatSetting("PB", "+4", "pb");
  mkStatSetting("HD", "20d10 + 40", "hitDice", 2);
  mkStatSetting("CR", "10", "cr");
  mkStatSetting("XP", "5900", "xp");
}
