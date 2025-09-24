// src/apps/library/create/creature/section-utils.ts
import { Setting } from "obsidian";
import { enhanceSelectToSearch } from "../../../../ui/search-dropdown";
import { CREATURE_DAMAGE_PRESETS } from "./presets";

export interface PresetSelectModel {
  get(): string[];
  add(value: string): void;
  remove(index: number): void;
}

export interface PresetSelectEditorOptions {
  placeholder?: string;
  inlineLabel?: string;
  rowClass?: string;
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
  try {
    enhanceSelectToSearch(select, placeholder ?? "Such-dropdown…");
  } catch {}
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
  try {
    enhanceSelectToSearch(select, "Schadenstyp suchen…");
  } catch {}
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
