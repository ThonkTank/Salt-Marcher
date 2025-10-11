// src/apps/library/create/creature/creature-controls.ts
// Gemeinsame Formular-Helfer für Preset-Auswahl und Schadenswiderstands-Editoren (Creature-spezifisch).
import { Setting } from "obsidian";
import {
  ValidationResult,
  enhanceExistingSelectDropdown,
} from "../../../../ui/workmode/create";
import { CREATURE_DAMAGE_PRESETS } from "../creature/presets";

export type SectionValidationRegistrar = (
  computeIssues: () => ValidationResult,
) => () => string[];

export interface PresetSelectModel {
  get(): string[];
  add(value: string): void;
  remove(index: number): void;
}

export interface PresetSelectEditorOptions {
  placeholder?: string;
  inlineLabel?: string;
  rowClass?: string;
  defaultAddButtonLabel?: string;
  addButtonLabel?: string;
  settingClass?: string | string[];
}

export type PresetSelectEditorConfig =
  | string
  | PresetSelectEditorOptions
  | undefined;

export function mountPresetSelectEditor(
  parent: HTMLElement,
  title: string,
  options: readonly string[],
  model: PresetSelectModel,
  config?: PresetSelectEditorConfig,
) {
  const resolved: PresetSelectEditorOptions =
    typeof config === "string" ? { placeholder: config } : config ?? {};
  const {
    placeholder,
    inlineLabel,
    rowClass,
    defaultAddButtonLabel,
    addButtonLabel,
    settingClass,
  } = resolved;
  const setting = new Setting(parent).setName(title);
  setting.settingEl.addClass("sm-cc-setting");
  if (settingClass) {
    const classes = Array.isArray(settingClass) ? settingClass : [settingClass];
    setting.settingEl.classList.add(...classes);
  }
  const rowClasses = ["sm-cc-searchbar"];
  if (rowClass) rowClasses.push(rowClass);
  const row = setting.controlEl.createDiv({ cls: rowClasses.join(" ") });
  let labelEl: HTMLLabelElement | undefined;
  let controlId: string | undefined;
  if (inlineLabel) {
    controlId = `sm-cc-select-${Math.random().toString(36).slice(2)}`;
    labelEl = row.createEl("label", { text: inlineLabel, attr: { for: controlId } });
  }
  const selectAttrs: Record<string, string> = {};
  if (controlId) selectAttrs.id = controlId;
  else selectAttrs["aria-label"] = `${title} auswählen`;
  const select = row.createEl(
    "select",
    Object.keys(selectAttrs).length ? { attr: selectAttrs } : undefined,
  ) as HTMLSelectElement;
  const blank = select.createEl("option", { text: "Auswahl…" }) as HTMLOptionElement;
  blank.value = "";
  for (const option of options) {
    const opt = select.createEl("option", { text: option }) as HTMLOptionElement;
    opt.value = option;
  }

  const selectHandle = enhanceExistingSelectDropdown(select, placeholder ?? "Such-dropdown…");
  const searchInput = (select as any)._smSearchInput as HTMLInputElement | undefined;
  if (searchInput) {
    if (placeholder) searchInput.placeholder = placeholder;
    if (!searchInput.id) {
      searchInput.id = controlId ?? `sm-cc-input-${Math.random().toString(36).slice(2)}`;
    }
    if (labelEl) labelEl.htmlFor = searchInput.id;
    else searchInput.setAttribute("aria-label", placeholder ?? title);
  }

  const fallbackAddLabel = defaultAddButtonLabel ?? "+";
  const effectiveAddLabel = addButtonLabel ?? fallbackAddLabel;

  const addBtn = row.createEl("button", {
    text: effectiveAddLabel,
    attr: { type: "button", "aria-label": `${title} hinzufügen` },
  });
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

  addBtn.onclick = addEntry;
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

export type DamageResponseKind = "res" | "imm" | "vuln";

interface DamageResponseConfig {
  kind: DamageResponseKind;
  label: string;
  list: string[];
  chipClass: string;
}

export interface DamageResponseLists {
  resistances: string[];
  immunities: string[];
  vulnerabilities: string[];
}

export function mountDamageResponseEditor(
  parent: HTMLElement,
  damageLists: DamageResponseLists,
  onChange?: (lists: DamageResponseLists) => void,
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
  setting.settingEl.addClass("sm-cc-setting");
  const row = setting.controlEl.createDiv({ cls: "sm-cc-searchbar sm-cc-damage-row" });
  row.createEl("label", { cls: "sm-cc-damage-label", text: "Schadenstyp" });

  const select = row.createEl("select", { cls: "sm-cc-damage-select" }) as HTMLSelectElement;
  const blank = select.createEl("option", { text: "Auswahl…" }) as HTMLOptionElement;
  blank.value = "";
  for (const option of CREATURE_DAMAGE_PRESETS) {
    const opt = select.createEl("option", { text: option }) as HTMLOptionElement;
    opt.value = option;
  }

  const selectHandle = enhanceExistingSelectDropdown(select, "Schadenstyp suchen…");
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
    onChange?.(damageLists);
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

export interface MovementEntry {
  type: string;
  label: string;
  distance: string;
  hover?: boolean;
}

export interface MovementEditorModel {
  get(): MovementEntry[];
  add(entry: MovementEntry): void;
  remove(index: number): void;
  update(index: number, entry: Partial<MovementEntry>): void;
}

export function mountMovementEditor(
  parent: HTMLElement,
  title: string,
  movementTypes: readonly [string, string][],
  model: MovementEditorModel,
  onChange?: () => void,
) {
  const setting = new Setting(parent).setName(title);
  setting.settingEl.addClass("sm-cc-setting");

  const row = setting.controlEl.createDiv({ cls: "sm-cc-searchbar sm-cc-movement-row" });

  const select = row.createEl("select", { cls: "sm-cc-movement-select" }) as HTMLSelectElement;
  const blank = select.createEl("option", { text: "Bewegungsart…" }) as HTMLOptionElement;
  blank.value = "";

  for (const [type, label] of movementTypes) {
    const opt = select.createEl("option", { text: label }) as HTMLOptionElement;
    opt.value = type;
  }

  const selectHandle = enhanceExistingSelectDropdown(select, "Bewegungsart suchen…");
  const searchInput = (select as any)._smSearchInput as HTMLInputElement | undefined;

  const distanceInput = row.createEl("input", {
    cls: "sm-cc-movement-distance",
    attr: { type: "text", placeholder: "30 ft." },
  }) as HTMLInputElement;

  const hoverId = `movement-hover-${Math.random().toString(36).slice(2)}`;
  const hoverCheckbox = row.createDiv({ cls: "sm-cc-movement-hover" });
  const hoverInput = hoverCheckbox.createEl("input", {
    attr: { type: "checkbox", id: hoverId },
  }) as HTMLInputElement;
  hoverCheckbox.createEl("label", { text: "Hover", attr: { for: hoverId } });

  const addBtn = row.createEl("button", {
    cls: "sm-cc-movement-add",
    text: "+ Hinzufügen",
    attr: { type: "button" },
  });

  const chips = setting.controlEl.createDiv({ cls: "sm-cc-chips sm-cc-movement-chips" });

  const renderChips = () => {
    chips.empty();
    model.get().forEach((entry, index) => {
      const chip = chips.createDiv({ cls: "sm-cc-chip sm-cc-movement-chip" });
      chip.createSpan({ cls: "sm-cc-movement-chip__label", text: entry.label });
      chip.createSpan({ cls: "sm-cc-movement-chip__distance", text: entry.distance });
      if (entry.hover) {
        chip.createSpan({ cls: "sm-cc-movement-chip__badge", text: "Hover" });
      }
      const removeBtn = chip.createEl("button", {
        cls: "sm-cc-chip__remove",
        text: "×",
        attr: { type: "button", "aria-label": `${entry.label} entfernen` },
      });
      removeBtn.onclick = () => {
        model.remove(index);
        renderChips();
        onChange?.();
      };
    });
  };

  const addEntry = () => {
    const selectedType = select.value.trim();
    if (!selectedType) {
      return;
    }

    const distance = distanceInput.value.trim();
    if (!distance) {
      return;
    }

    const selectedOption = movementTypes.find(([type]) => type === selectedType);
    if (!selectedOption) return;

    const [type, label] = selectedOption;

    model.add({
      type,
      label,
      distance,
      hover: hoverInput.checked,
    });

    select.value = "";
    if (searchInput) searchInput.value = "";
    distanceInput.value = "";
    hoverInput.checked = false;
    renderChips();
    onChange?.();
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
  distanceInput.addEventListener("keydown", (evt) => {
    if (evt.key === "Enter") {
      evt.preventDefault();
      addEntry();
    }
  });

  renderChips();
}
