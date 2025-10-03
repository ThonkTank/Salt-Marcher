// src/apps/library/create/creature/section-basics.ts
// Erfasst Name, Typ, Gesinnung, Kernwerte (HP, AC, PB, CR, XP) sowie alle Bewegungsarten.
import { ToggleComponent } from "obsidian";
import { enhanceSelectToSearch } from "../../../../ui/search-dropdown";
import type { StatblockData } from "../../core/creature-files";
import {
  CREATURE_ALIGNMENT_GOOD_EVIL,
  CREATURE_ALIGNMENT_LAW_CHAOS,
  CREATURE_SIZES,
  CREATURE_TYPES,
} from "./presets";
import { mountTokenEditor } from "../shared/token-editor";
import { createFieldGrid } from "../shared/layouts";

function ensureSpeedExtras(data: StatblockData): string[] {
  if (!Array.isArray(data.speedList)) data.speedList = [];
  return data.speedList;
}

type SpeedKey =
  | "speedWalk"
  | "speedClimb"
  | "speedFly"
  | "speedSwim"
  | "speedBurrow";

const SPEED_FIELD_DEFS: Array<{ key: SpeedKey; label: string; placeholder: string; hoverToggle?: boolean }> = [
  { key: "speedWalk", label: "Gehen", placeholder: "30 ft." },
  { key: "speedClimb", label: "Klettern", placeholder: "30 ft." },
  { key: "speedFly", label: "Fliegen", placeholder: "60 ft.", hoverToggle: true },
  { key: "speedSwim", label: "Schwimmen", placeholder: "40 ft." },
  { key: "speedBurrow", label: "Graben", placeholder: "20 ft." },
];

export function mountCreatureBasicsSection(parent: HTMLElement, data: StatblockData) {
  const root = parent.createDiv({ cls: "sm-cc-basics" });

  const identity = root.createDiv({ cls: "sm-cc-basics__group" });
  identity.createEl("h5", { text: "Identität", cls: "sm-cc-basics__subtitle" });
  const identityGrid = createFieldGrid(identity, { variant: "identity" });

  const nameSetting = identityGrid.createSetting("Name");
  nameSetting.addText((t) => {
    t.setPlaceholder("Aboleth")
      .setValue(data.name || "")
      .onChange((v: string) => (data.name = v.trim()));
    t.inputEl.classList.add("sm-cc-input");
  });

  const typeSetting = identityGrid.createSetting("Typ");
  typeSetting.addDropdown((dd) => {
    dd.addOption("", "");
    for (const option of CREATURE_TYPES) dd.addOption(option, option);
    dd.setValue(data.type ?? "");
    dd.onChange((v: string) => (data.type = v));
    dd.selectEl.classList.add("sm-cc-select");
    try {
      enhanceSelectToSearch(dd.selectEl, "Such-dropdown…");
    } catch {}
  });

  const sizeSetting = identityGrid.createSetting("Größe");
  sizeSetting.addDropdown((dd) => {
    dd.addOption("", "");
    for (const option of CREATURE_SIZES) dd.addOption(option, option);
    dd.setValue(data.size ?? "");
    dd.onChange((v: string) => (data.size = v));
    dd.selectEl.classList.add("sm-cc-select");
    try {
      enhanceSelectToSearch(dd.selectEl, "Such-dropdown…");
    } catch {}
  });

  const alignmentSetting = identityGrid.createSetting("Gesinnung", {
    className: "sm-cc-setting--inline",
  });
  alignmentSetting.controlEl.addClass("sm-cc-alignment");
  alignmentSetting.addDropdown((dd) => {
    dd.addOption("", "");
    for (const option of CREATURE_ALIGNMENT_LAW_CHAOS) dd.addOption(option, option);
    dd.setValue(data.alignmentLawChaos ?? "");
    dd.onChange((v: string) => (data.alignmentLawChaos = v));
    dd.selectEl.classList.add("sm-cc-select");
    try {
      const el = dd.selectEl;
      el.dataset.sdOpenAll = "0";
      enhanceSelectToSearch(el, "Such-dropdown…");
    } catch {}
  });
  alignmentSetting.addDropdown((dd) => {
    dd.addOption("", "");
    for (const option of CREATURE_ALIGNMENT_GOOD_EVIL) dd.addOption(option, option);
    dd.setValue(data.alignmentGoodEvil ?? "");
    dd.onChange((v: string) => (data.alignmentGoodEvil = v));
    dd.selectEl.classList.add("sm-cc-select");
    try {
      const el = dd.selectEl;
      el.dataset.sdOpenAll = "0";
      enhanceSelectToSearch(el, "Such-dropdown…");
    } catch {}
  });

  const stats = root.createDiv({ cls: "sm-cc-basics__group" });
  stats.createEl("h5", { text: "Kernwerte", cls: "sm-cc-basics__subtitle" });
  const statsGrid = createFieldGrid(stats, { variant: "summary" });

  const createStatField = (label: string, placeholder: string, key: keyof StatblockData) => {
    const setting = statsGrid.createSetting(label);
    setting.addText((t) => {
      t.setPlaceholder(placeholder)
        .setValue((data[key] as string) ?? "")
        .onChange((v: string) => ((data as any)[key] = v.trim()));
      t.inputEl.classList.add("sm-cc-input");
    });
  };

  createStatField("HP", "150", "hp");
  createStatField("AC", "17", "ac");
  createStatField("Init", "+7", "initiative");
  createStatField("PB", "+4", "pb");
  createStatField("HD", "20d10 + 40", "hitDice");
  createStatField("CR", "10", "cr");
  createStatField("XP", "5900", "xp");

  const movement = root.createDiv({ cls: "sm-cc-basics__group" });
  movement.createEl("h5", { text: "Bewegung", cls: "sm-cc-basics__subtitle" });
  const speedGrid = createFieldGrid(movement, { variant: "speeds" });

  SPEED_FIELD_DEFS.forEach((def) => {
    const setting = speedGrid.createSetting(def.label, {
      className: "sm-cc-setting--speed",
    });
    const text = setting.addText((t) => {
      t.setPlaceholder(def.placeholder)
        .setValue(((data as any)[def.key] as string) ?? "")
        .onChange((v: string) => {
          (data as any)[def.key] = v.trim() || undefined;
        });
      t.inputEl.classList.add("sm-cc-input");
    });

    if (def.hoverToggle) {
      let toggle: ToggleComponent | null = null;
      toggle = setting.addToggle((tg) => {
        tg.setValue(((data.speedFly ?? "").toLowerCase().includes("hover")));
        tg.onChange((checked) => {
          const raw = text.getValue().replace(/\s*\(hover\)$/i, "").trim();
          if (!raw) return;
          const next = checked ? `${raw} (hover)` : raw;
          text.setValue(next);
          data.speedFly = next;
        });
      });
      const hoverWrap = setting.controlEl.createDiv({ cls: "sm-cc-hover-wrap" });
      hoverWrap.appendChild(toggle.toggleEl);
      toggle.toggleEl.addClass("sm-cc-hover-toggle");
      toggle.toggleEl.setAttr("aria-label", "Hover markieren");
      hoverWrap.createSpan({ text: "Hover", cls: "sm-cc-hover-label" });
      text.inputEl.addEventListener("blur", () => {
        const hasHover = /\(hover\)/i.test(text.getValue());
        toggle?.setValue(hasHover);
      });
    }
  });

  const extras = ensureSpeedExtras(data);
  const extrasEditor = mountTokenEditor(
    movement,
    "Weitere Bewegungen",
    {
      getItems: () => extras,
      add: (value) => {
        if (!extras.includes(value)) extras.push(value);
      },
      remove: (index) => extras.splice(index, 1),
    },
    {
      placeholder: "z. B. teleport 30 ft.",
      addButtonLabel: "+ Hinzufügen",
    },
  );
  extrasEditor.setting.settingEl.addClass("sm-cc-setting");
}
