// src/apps/library/create/creature/section-basics.ts
// Stellt separate Mount-Funktionen für Klassifikation (Name, Typ, Alignment, PB/CR/XP) und Vitaldaten (AC, HP, Bewegung) bereit.
import { DropdownComponent } from "obsidian";
import { enhanceSelectToSearch } from "../../../../ui/search-dropdown";
import type {
  CreatureSpeedExtra,
  CreatureSpeedValue,
  StatblockData,
} from "../../core/creature-files";
import {
  CREATURE_SIZES,
  CREATURE_TYPES,
  type CreatureMovementType,
} from "./presets";
import { mountTokenEditor } from "../shared/token-editor";
import { createFieldGrid, createFormCard } from "../shared/layouts";

type SpeedFieldKey = Exclude<CreatureMovementType, never>;

const SPEED_FIELD_DEFS: Array<{ key: SpeedFieldKey; label: string; placeholder: string; hoverToggle?: boolean }> = [
  { key: "walk", label: "Gehen", placeholder: "30 ft." },
  { key: "climb", label: "Klettern", placeholder: "30 ft." },
  { key: "fly", label: "Fliegen", placeholder: "60 ft.", hoverToggle: true },
  { key: "swim", label: "Schwimmen", placeholder: "40 ft." },
  { key: "burrow", label: "Graben", placeholder: "20 ft." },
];

const LAW_CHAOS_DROPDOWN_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "", label: "" },
  { value: "Lawful", label: "Rechtschaffen" },
  { value: "Neutral", label: "Neutral" },
  { value: "Chaotic", label: "Chaotisch" },
];

const GOOD_EVIL_DROPDOWN_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "", label: "" },
  { value: "Good", label: "Gut" },
  { value: "Neutral", label: "Neutral" },
  { value: "Evil", label: "Böse" },
];

type SpeedRecord = Record<SpeedFieldKey, CreatureSpeedValue | undefined> & {
  extras?: CreatureSpeedExtra[];
};

function ensureSpeeds(data: StatblockData): SpeedRecord {
  const speeds = (data.speeds ??= {});
  if (!Array.isArray(speeds.extras)) speeds.extras = [];
  return speeds as SpeedRecord;
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

function ensureTypeTags(data: StatblockData): string[] {
  if (!Array.isArray(data.typeTags)) data.typeTags = [];
  return data.typeTags!;
}

export function mountCreatureClassificationSection(parent: HTMLElement, data: StatblockData) {
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

  const nameSetting = identityGrid.createSetting("Name");
  nameSetting.settingEl.addClass("sm-cc-setting--show-name");
  nameSetting.addText((t) => {
    t.setPlaceholder("Aboleth")
      .setValue(data.name || "")
      .onChange((v: string) => (data.name = v.trim()));
    t.inputEl.classList.add("sm-cc-input");
  });

  const typeSetting = identityGrid.createSetting("Typ");
  typeSetting.settingEl.addClass("sm-cc-setting--show-name");
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
  sizeSetting.settingEl.addClass("sm-cc-setting--show-name");
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

  const tags = ensureTypeTags(data);
  const typeTagsEditor = mountTokenEditor(identitySection, "Typ-Tags", {
    getItems: () => tags.slice(),
    add: (value) => {
      const normalized = value.trim();
      if (!normalized) return;
      const exists = tags.some((entry) => entry.toLowerCase() === normalized.toLowerCase());
      if (!exists) tags.push(normalized);
      typeTagsEditor.refresh();
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

  const classificationSection = card.body.createDiv({ cls: "sm-cc-card__section sm-cc-card__section--basics" });
  const classificationGrid = createFieldGrid(classificationSection, {
    variant: "classification",
    className: "sm-cc-field-grid--basics",
    minColumnWidth: "16rem",
  });

  let lawChaosDropdown: DropdownComponent | null = null;
  let goodEvilDropdown: DropdownComponent | null = null;
  const refreshAlignmentControls = () => {
    const hasOverride = Boolean((data.alignmentOverride ?? "").trim());
    const toggleDropdown = (dropdown: DropdownComponent | null) => {
      if (!dropdown) return;
      if (hasOverride) {
        dropdown.selectEl.setAttribute("disabled", "true");
        dropdown.selectEl.setAttribute("aria-disabled", "true");
      } else {
        dropdown.selectEl.removeAttribute("disabled");
        dropdown.selectEl.removeAttribute("aria-disabled");
      }
    };
    toggleDropdown(lawChaosDropdown);
    toggleDropdown(goodEvilDropdown);
  };

  const lawChaosSetting = classificationGrid.createSetting("Rechtschaffen/Neutral/Chaotisch", {
    className: "sm-cc-setting--show-name",
  });
  lawChaosSetting.addDropdown((dd) => {
    lawChaosDropdown = dd;
    for (const option of LAW_CHAOS_DROPDOWN_OPTIONS) dd.addOption(option.value, option.label);
    dd.setValue(data.alignmentLawChaos ?? "");
    dd.onChange((value: string) => {
      data.alignmentLawChaos = value || undefined;
    });
    dd.selectEl.classList.add("sm-cc-select");
    try {
      enhanceSelectToSearch(dd.selectEl, "Such-dropdown…");
    } catch {}
    refreshAlignmentControls();
  });

  const goodEvilSetting = classificationGrid.createSetting("Gut/Neutral/Böse", {
    className: "sm-cc-setting--show-name",
  });
  goodEvilSetting.addDropdown((dd) => {
    goodEvilDropdown = dd;
    for (const option of GOOD_EVIL_DROPDOWN_OPTIONS) dd.addOption(option.value, option.label);
    dd.setValue(data.alignmentGoodEvil ?? "");
    dd.onChange((value: string) => {
      data.alignmentGoodEvil = value || undefined;
    });
    dd.selectEl.classList.add("sm-cc-select");
    try {
      enhanceSelectToSearch(dd.selectEl, "Such-dropdown…");
    } catch {}
    refreshAlignmentControls();
  });

  const alignmentOverrideSetting = classificationGrid.createSetting("Alignment-Override", {
    className: [
      "sm-cc-setting--span-2",
      "sm-cc-setting--show-name",
      "sm-cc-setting--alignment-override",
    ],
  });
  alignmentOverrideSetting.addText((t) => {
    const applyOverride = (raw: string) => {
      const trimmed = raw.trim();
      if (trimmed) data.alignmentOverride = trimmed;
      else data.alignmentOverride = undefined;
      refreshAlignmentControls();
    };
    t.setPlaceholder("z. B. Unaligned oder „Lawful Neutral“")
      .setValue(data.alignmentOverride ?? "")
      .onChange(applyOverride);
    t.inputEl.addEventListener("input", () => applyOverride(t.inputEl.value));
    t.inputEl.classList.add("sm-cc-input", "sm-cc-input--alignment-override");
  });

  refreshAlignmentControls();

  const createClassificationField = (label: string, placeholder: string, key: keyof StatblockData) => {
    const setting = classificationGrid.createSetting(label);
    setting.settingEl.addClass("sm-cc-setting--show-name");
    setting.addText((t) => {
      t.setPlaceholder(placeholder)
        .setValue((data[key] as string) ?? "")
        .onChange((v: string) => ((data as any)[key] = v.trim()));
      t.inputEl.classList.add("sm-cc-input");
    });
  };

  createClassificationField("PB", "+4", "pb");
  createClassificationField("CR", "10", "cr");
  createClassificationField("XP", "5900", "xp");
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

  const createVitalField = (label: string, placeholder: string, key: keyof StatblockData) => {
    const setting = vitalsGrid.createSetting(label);
    setting.settingEl.addClass("sm-cc-setting--show-name");
    setting.addText((t) => {
      t.setPlaceholder(placeholder)
        .setValue((data[key] as string) ?? "")
        .onChange((v: string) => ((data as any)[key] = v.trim()));
      t.inputEl.classList.add("sm-cc-input");
    });
  };

  createVitalField("AC", "17", "ac");
  createVitalField("HP", "150", "hp");
  createVitalField("Initiative", "+7", "initiative");
  createVitalField("Hit Dice", "20d10 + 40", "hitDice");

  const movementSection = card.body.createDiv({ cls: "sm-cc-card__section sm-cc-card__section--basics" });

  const speedGrid = movementSection.createDiv({ cls: "sm-cc-speeds-grid sm-cc-field-grid sm-cc-field-grid--basics" });

  const syncDistance = (input: HTMLInputElement, key: SpeedFieldKey) => {
    const target = ensureSpeeds(data)[key];
    input.value = target?.distance ?? "";
  };

  const syncHoverBadge = (badge: HTMLButtonElement | null, key: SpeedFieldKey) => {
    if (!badge) return;
    const target = ensureSpeeds(data)[key];
    const active = Boolean(target?.hover);
    badge.toggleClass("is-active", active);
    badge.setAttr("aria-pressed", active ? "true" : "false");
  };

  SPEED_FIELD_DEFS.forEach((def) => {
    const current = ensureSpeeds(data)[def.key];
    const item = speedGrid.createDiv({ cls: "sm-cc-speed" });
    const head = item.createDiv({ cls: "sm-cc-speed__head" });
    head.createSpan({ text: def.label, cls: "sm-cc-speed__label" });

    let hoverBadge: HTMLButtonElement | null = null;
    if (def.hoverToggle) {
      hoverBadge = head.createEl("button", {
        text: "Hover",
        cls: "sm-cc-speed__badge",
        attr: { type: "button" },
      });
      hoverBadge.addEventListener("click", () => {
        const target = ensureSpeeds(data)[def.key];
        const next = !target?.hover;
        applySpeedValue(data, def.key, { hover: next });
        syncHoverBadge(hoverBadge, def.key);
      });
    }

    const input = item.createEl("input", {
      attr: { type: "text", placeholder: def.placeholder },
      cls: "sm-cc-speed__input sm-cc-input",
    }) as HTMLInputElement;
    input.value = current?.distance ?? "";
    input.addEventListener("change", () => {
      const trimmed = input.value.trim();
      applySpeedValue(data, def.key, { distance: trimmed || undefined });
    });
    input.addEventListener("blur", () => {
      syncDistance(input, def.key);
      syncHoverBadge(hoverBadge, def.key);
    });

    syncHoverBadge(hoverBadge, def.key);
  });

  const extras = ensureSpeeds(data).extras!;
  const extrasEditor = mountTokenEditor(
    movementSection,
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
  extrasEditor.setting.settingEl.addClass("sm-cc-setting--stack");
}
