// src/apps/library/create/creature/section-basics.ts
// Erfasst Name, Typ, Gesinnung, Kernwerte (HP, AC, PB, CR, XP) sowie alle Bewegungsarten.
import { ToggleComponent } from "obsidian";
import { enhanceSelectToSearch } from "../../../../ui/search-dropdown";
import type {
  CreatureSpeedExtra,
  CreatureSpeedValue,
  StatblockData,
} from "../../core/creature-files";
import {
  CREATURE_ALIGNMENT_GOOD_EVIL,
  CREATURE_ALIGNMENT_LAW_CHAOS,
  CREATURE_SIZES,
  CREATURE_TYPES,
  type CreatureMovementType,
} from "./presets";
import { mountTokenEditor } from "../shared/token-editor";
import { createFieldGrid } from "../shared/layouts";

type SpeedFieldKey = Exclude<CreatureMovementType, never>;

const SPEED_FIELD_DEFS: Array<{ key: SpeedFieldKey; label: string; placeholder: string; hoverToggle?: boolean }> = [
  { key: "walk", label: "Gehen", placeholder: "30 ft." },
  { key: "climb", label: "Klettern", placeholder: "30 ft." },
  { key: "fly", label: "Fliegen", placeholder: "60 ft.", hoverToggle: true },
  { key: "swim", label: "Schwimmen", placeholder: "40 ft." },
  { key: "burrow", label: "Graben", placeholder: "20 ft." },
];

type SpeedRecord = Record<SpeedFieldKey, CreatureSpeedValue | undefined> & {
  extras?: CreatureSpeedExtra[];
};

function ensureSpeeds(data: StatblockData): SpeedRecord {
  const speeds = (data.speeds ??= {});
  if (!Array.isArray(speeds.extras)) speeds.extras = [];
  return speeds as SpeedRecord;
}

function ensureSpeedExtras(data: StatblockData): CreatureSpeedExtra[] {
  const speeds = ensureSpeeds(data);
  if (!Array.isArray(speeds.extras)) speeds.extras = [];
  return speeds.extras!;
}

function applySpeedValue(
  data: StatblockData,
  key: SpeedFieldKey,
  patch: Partial<CreatureSpeedValue>,
) {
  const speeds = ensureSpeeds(data);
  const prev = speeds[key] ?? {};
  const next: CreatureSpeedValue = { ...prev, ...patch };
  const hasContent = Boolean(next.distance?.trim()) || next.hover || Boolean(next.note?.trim());
  if (hasContent) speeds[key] = next;
  else delete speeds[key];
}

function parseExtraInput(raw: string): CreatureSpeedExtra | null {
  let text = raw.trim();
  if (!text) return null;
  let hover = false;
  const hoverMatch = text.match(/\(hover\)$/i);
  if (hoverMatch?.index != null) {
    hover = true;
    text = text.slice(0, hoverMatch.index).trim();
  }
  const distanceMatch = text.match(/(\d.*)$/);
  let label = text;
  let distance: string | undefined;
  if (distanceMatch?.index != null) {
    label = text.slice(0, distanceMatch.index).trim() || text;
    distance = distanceMatch[0].trim();
  }
  return { label, distance, hover };
}

function formatExtra(extra: CreatureSpeedExtra): string {
  const parts = [extra.label];
  if (extra.distance) parts.push(extra.distance);
  if (extra.note) parts.push(extra.note);
  if (extra.hover) parts.push("(hover)");
  return parts
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part && part.length))
    .join(" ");
}

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
    const current = ensureSpeeds(data)[def.key];
    const text = setting.addText((t) => {
      t.setPlaceholder(def.placeholder)
        .setValue(current?.distance ?? "")
        .onChange((v: string) => {
          const trimmed = v.trim();
          applySpeedValue(data, def.key, { distance: trimmed || undefined });
        });
      t.inputEl.classList.add("sm-cc-input");
    });

    if (def.hoverToggle) {
      let toggle: ToggleComponent | null = null;
      toggle = setting.addToggle((tg) => {
        tg.setValue(Boolean(current?.hover));
        tg.onChange((checked) => {
          applySpeedValue(data, def.key, { hover: checked });
        });
      });
      const hoverWrap = setting.controlEl.createDiv({ cls: "sm-cc-hover-wrap" });
      hoverWrap.appendChild(toggle.toggleEl);
      toggle.toggleEl.addClass("sm-cc-hover-toggle");
      toggle.toggleEl.setAttr("aria-label", "Hover markieren");
      hoverWrap.createSpan({ text: "Hover", cls: "sm-cc-hover-label" });
      text.inputEl.addEventListener("blur", () => {
        const speeds = ensureSpeeds(data);
        const target = speeds[def.key];
        text.setValue(target?.distance ?? "");
        toggle?.setValue(Boolean(target?.hover));
      });
    }
  });

  const extras = ensureSpeedExtras(data);
  const extrasEditor = mountTokenEditor(
    movement,
    "Weitere Bewegungen",
    {
      getItems: () => extras.map(formatExtra),
      add: (value) => {
        const parsed = parseExtraInput(value);
        if (!parsed) return;
        const exists = extras.some(
          (entry) =>
            entry.label.toLowerCase() === parsed.label.toLowerCase() &&
            (entry.distance ?? "") === (parsed.distance ?? "") &&
            Boolean(entry.hover) === Boolean(parsed.hover),
        );
        if (!exists) extras.push(parsed);
        extrasEditor.refresh();
      },
      remove: (index) => {
        extras.splice(index, 1);
        extrasEditor.refresh();
      },
    },
    {
      placeholder: "z. B. teleport 30 ft.",
      addButtonLabel: "+ Hinzufügen",
    },
  );
  extrasEditor.setting.settingEl.addClass("sm-cc-setting");
}
