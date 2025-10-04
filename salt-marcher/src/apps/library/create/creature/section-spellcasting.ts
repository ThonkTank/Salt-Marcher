// src/apps/library/create/creature/section-spellcasting.ts
// Erfasst Spellcasting-Einträge inkl. Gruppenverwaltung, Kopfbereich und Markdown-Vorschau.
import { Setting } from "obsidian";
import {
  type SpellcastingAbility,
  type SpellcastingData,
  type SpellcastingGroup,
  type SpellcastingGroupAtWill,
  type SpellcastingGroupCustom,
  type SpellcastingGroupLevel,
  type SpellcastingGroupPerDay,
  type SpellcastingSpell,
  type StatblockData,
  calculateAttackBonus,
  calculateSaveDc,
  getAbilityModifier,
  getProficiencyBonus,
} from "../../core/creature-files";
import { CREATURE_ABILITIES } from "./presets";
import type { ValidationRegistrar, ValidationRunner } from "../shared/layouts";

const DEFAULT_TITLE = "Spellcasting";

type SpellcastingGroupWithSpells = SpellcastingGroup & { spells?: SpellcastingSpell[] };

type SpellTypeaheadHandle = { refreshMatches(): void };

type SpellcastingGroupMutable =
  | SpellcastingGroupAtWill
  | SpellcastingGroupPerDay
  | SpellcastingGroupLevel
  | SpellcastingGroupCustom;

export interface CreatureSpellcastingSectionOptions {
  getAvailableSpells?: () => readonly string[] | null | undefined;
  registerValidation?: ValidationRegistrar;
}

export interface CreatureSpellcastingSectionHandles {
  refreshSpellMatches(): void;
  revalidate(): string[];
  setAvailableSpells(spells: readonly string[]): void;
}

function ensureSpellcastingGroups(spellcasting: SpellcastingData): SpellcastingData {
  if (!Array.isArray(spellcasting.groups)) {
    spellcasting.groups = [];
  }
  spellcasting.groups = spellcasting.groups.map((group) => {
    switch (group.type) {
      case "at-will":
      case "per-day":
      case "level": {
        if (!Array.isArray(group.spells)) group.spells = [];
        return group;
      }
      case "custom": {
        if (group.spells && !Array.isArray(group.spells)) {
          group.spells = [];
        }
        if (!group.spells) group.spells = [];
        return group;
      }
      default:
        return group as SpellcastingGroupMutable;
    }
  });
  return spellcasting;
}

export function ensureSpellcasting(data: StatblockData): SpellcastingData {
  if (data.spellcasting) {
    const target = ensureSpellcastingGroups(data.spellcasting);
    if (!target.title) target.title = DEFAULT_TITLE;
    if (!Array.isArray(target.notes)) target.notes = [];
    return target;
  }
  const ensured = ensureSpellcastingGroups({ title: DEFAULT_TITLE, groups: [] });
  data.spellcasting = ensured;
  return ensured;
}

function formatSlots(slots: number | string | undefined): string | undefined {
  if (slots == null || slots === "") return undefined;
  if (typeof slots === "number") return `${slots}`;
  const trimmed = slots.toString().trim();
  return trimmed || undefined;
}

function getGroupHeading(group: SpellcastingGroupWithSpells): string {
  switch (group.type) {
    case "at-will":
      return group.title?.trim() || "At Will";
    case "per-day":
      return group.title?.trim() || group.uses?.trim() || "X/Day";
    case "level": {
      const levelLabel = group.title?.trim() || `${group.level}th Level`;
      const slotsLabel = formatSlots(group.slots);
      return slotsLabel ? `${levelLabel} (${slotsLabel} slots)` : levelLabel;
    }
    case "custom":
      return group.title?.trim() || "Custom";
    default:
      return "Spell Group";
  }
}

function ensureSpellName(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function collectSpellcastingIssues(data: StatblockData): string[] {
  const spellcasting = ensureSpellcasting(data);
  const issues: string[] = [];
  const seen = new Map<string, { groupIndex: number; spellIndex: number }>();

  spellcasting.groups.forEach((group, groupIndex) => {
    if (!group) return;
    switch (group.type) {
      case "per-day": {
        const uses = group.uses?.trim();
        if (!uses) issues.push(`Gruppe ${groupIndex + 1}: „X/Day“ benötigt eine Nutzungsangabe.`);
        break;
      }
      case "level": {
        const level = Number(group.level);
        if (!Number.isFinite(level) || level < 0 || level > 9) {
          issues.push(`Gruppe ${groupIndex + 1}: Zaubergrad muss zwischen 0 und 9 liegen.`);
        }
        break;
      }
      case "custom": {
        const title = group.title?.trim();
        if (!title) issues.push(`Gruppe ${groupIndex + 1}: Custom-Gruppen benötigen einen Titel.`);
        break;
      }
      default:
        break;
    }

    const spells = (group as SpellcastingGroupWithSpells).spells ?? [];
    spells.forEach((spell, spellIndex) => {
      const name = ensureSpellName(spell?.name);
      if (!name) {
        issues.push(`Gruppe ${groupIndex + 1}: Eintrag ${spellIndex + 1} benötigt einen Namen.`);
        return;
      }
      const key = name.toLowerCase();
      const duplicate = seen.get(key);
      if (duplicate) {
        issues.push(
          `Zauber „${name}" erscheint mehrfach (Gruppen ${duplicate.groupIndex + 1} und ${groupIndex + 1}).`,
        );
      } else {
        seen.set(key, { groupIndex, spellIndex });
      }
    });
  });

  return issues;
}

interface SpellInputHandle extends SpellTypeaheadHandle {
  input: HTMLInputElement;
}

function mountSpellInput(
  parent: HTMLElement,
  getCandidates: () => readonly string[],
  placeholder: string,
): SpellInputHandle {
  const box = parent.createDiv({ cls: "sm-preset-box sm-cc-spellcasting__input" });
  const input = box.createEl("input", {
    cls: "sm-preset-input",
    attr: { type: "text", placeholder },
  }) as HTMLInputElement;
  const menu = box.createDiv({ cls: "sm-preset-menu" });

  const renderMatches = () => {
    const query = (input.value || "").toLowerCase();
    menu.empty();
    const matches = getCandidates()
      .filter((name) => !query || name.toLowerCase().includes(query))
      .slice(0, 24);
    if (!matches.length) {
      box.removeClass("is-open");
      return;
    }
    matches.forEach((name) => {
      const item = menu.createDiv({ cls: "sm-preset-item", text: name });
      item.onclick = () => {
        input.value = name;
        box.removeClass("is-open");
        input.dispatchEvent(new Event("input"));
      };
    });
    box.addClass("is-open");
  };

  input.addEventListener("focus", renderMatches);
  input.addEventListener("input", () => {
    if (document.activeElement === input) renderMatches();
  });
  input.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      input.value = "";
      box.removeClass("is-open");
    }
  });
  input.addEventListener("blur", () => {
    window.setTimeout(() => box.removeClass("is-open"), 120);
  });

  return {
    input,
    refreshMatches: () => {
      if (document.activeElement === input || box.hasClass("is-open")) {
        renderMatches();
      }
    },
  };
}

function renderSpellPreviewText(spell: SpellcastingSpell): string {
  const name = spell.name?.trim() || "Unbenannter Zauber";
  const note = spell.notes?.trim();
  return note ? `${name} (${note})` : name;
}

function renderPreviewContent(container: HTMLElement, spellcasting: SpellcastingData) {
  container.empty();
  const title = spellcasting.title?.trim() || DEFAULT_TITLE;
  const header = container.createDiv({ cls: "sm-cc-spellcasting-preview__header" });
  header.createEl("h4", { text: title });

  const summaryParts: string[] = [];
  const saveDc = spellcasting.computed?.saveDc;
  const attackBonus = spellcasting.computed?.attackBonus;
  if (saveDc != null) summaryParts.push(`Spell save DC ${saveDc}`);
  if (attackBonus != null) summaryParts.push(`${attackBonus >= 0 ? "+" : ""}${attackBonus} to hit`);
  if (summaryParts.length) {
    container.createEl("p", { text: summaryParts.join(", ") });
  }

  if (spellcasting.summary?.trim()) {
    container.createEl("p", { text: spellcasting.summary.trim() });
  }

  if (spellcasting.notes && spellcasting.notes.length) {
    const list = container.createEl("ul", { cls: "sm-cc-spellcasting-preview__notes" });
    for (const note of spellcasting.notes) {
      if (note && note.trim()) list.createEl("li", { text: note.trim() });
    }
  }

  if (!spellcasting.groups.length) {
    container.createDiv({ cls: "sm-cc-spellcasting-preview__empty", text: "Keine Spellcasting-Gruppen angelegt." });
    return;
  }

  const groupsWrap = container.createDiv({ cls: "sm-cc-spellcasting-preview__groups" });
  spellcasting.groups.forEach((group) => {
    const groupBox = groupsWrap.createDiv({ cls: "sm-cc-spellcasting-preview__group" });
    groupBox.createEl("h5", { text: getGroupHeading(group) });
    if (group.type === "per-day" && group.note?.trim()) {
      groupBox.createDiv({ cls: "sm-cc-spellcasting-preview__note", text: group.note.trim() });
    }
    if (group.type === "level" && group.note?.trim()) {
      groupBox.createDiv({ cls: "sm-cc-spellcasting-preview__note", text: group.note.trim() });
    }
    if (group.type === "custom" && group.description?.trim()) {
      groupBox.createDiv({ cls: "sm-cc-spellcasting-preview__note", text: group.description.trim() });
    }

    const spells = (group as SpellcastingGroupWithSpells).spells ?? [];
    if (spells.length) {
      const ul = groupBox.createEl("ul");
      spells.forEach((spell) => {
        ul.createEl("li", { text: renderSpellPreviewText(spell) });
      });
    } else if (group.type !== "custom" || !group.description?.trim()) {
      groupBox.createDiv({ cls: "sm-cc-spellcasting-preview__empty", text: "Keine Zauber hinterlegt." });
    }
  });
}

export function mountCreatureSpellcastingSection(
  parent: HTMLElement,
  data: StatblockData,
  options: CreatureSpellcastingSectionOptions = {},
): CreatureSpellcastingSectionHandles {
  const spellcasting = ensureSpellcasting(data);
  const availableSpells: string[] = [];
  const typeaheadHandles: SpellTypeaheadHandle[] = [];

  const root = parent.createDiv({ cls: "sm-cc-spellcasting" });

  const titleSetting = new Setting(root).setName("Überschrift");
  titleSetting.settingEl.addClass("sm-cc-setting");
  titleSetting.addText((component) => {
    component
      .setPlaceholder(DEFAULT_TITLE)
      .setValue(spellcasting.title ?? "")
      .onChange((value) => {
        const trimmed = value.trim();
        spellcasting.title = trimmed || undefined;
        renderPreview();
      });
    component.inputEl.classList.add("sm-cc-input");
  });

  const summarySetting = new Setting(root).setName("Kurzbeschreibung");
  summarySetting.settingEl.addClass("sm-cc-setting sm-cc-setting--textarea");
  const summaryArea = summarySetting.controlEl.createEl("textarea", {
    cls: "sm-cc-textarea",
    attr: { placeholder: "Kurzer beschreibender Satz…" },
  });
  summaryArea.value = spellcasting.summary ?? "";
  summaryArea.addEventListener("input", () => {
    const trimmed = summaryArea.value.trim();
    spellcasting.summary = trimmed || undefined;
    renderPreview();
  });

  const notesSetting = new Setting(root).setName("Notizen");
  notesSetting.settingEl.addClass("sm-cc-setting sm-cc-setting--textarea");
  const notesArea = notesSetting.controlEl.createEl("textarea", {
    cls: "sm-cc-textarea",
    attr: { placeholder: "Zusätzliche Hinweise (ein Eintrag pro Zeile)…" },
  });
  notesArea.value = (spellcasting.notes ?? []).join("\n");
  notesArea.addEventListener("input", () => {
    const lines = notesArea.value
      .split(/\n+/)
      .map((line) => line.trim())
      .filter((line) => line.length);
    spellcasting.notes = lines;
    renderPreview();
  });

  const abilitySetting = new Setting(root).setName("Spellcasting-Fokus");
  abilitySetting.settingEl.addClass("sm-cc-setting sm-cc-spellcasting__ability");
  abilitySetting.addDropdown((dropdown) => {
    dropdown.addOption("", "—");
    for (const ability of CREATURE_ABILITIES) {
      dropdown.addOption(ability.key, ability.label);
    }
    dropdown.setValue(spellcasting.ability ?? "");
    dropdown.onChange((value) => {
      spellcasting.ability = (value || undefined) as SpellcastingAbility | undefined;
      updateComputed(true);
    });
  });

  const computedWrap = abilitySetting.controlEl.createDiv({ cls: "sm-cc-spellcasting__computed" });
  const saveLabel = computedWrap.createSpan({ cls: "sm-cc-spellcasting__computed-save", text: "Save DC: —" });
  const attackLabel = computedWrap.createSpan({ cls: "sm-cc-spellcasting__computed-attack", text: "Attack: —" });

  const overrideWrap = abilitySetting.controlEl.createDiv({ cls: "sm-cc-spellcasting__overrides" });
  const saveOverrideInput = overrideWrap.createEl("input", {
    cls: "sm-cc-input sm-cc-input--small",
    attr: { type: "number", placeholder: "Override DC", "aria-label": "Spell Save DC Override" },
  }) as HTMLInputElement;
  const attackOverrideInput = overrideWrap.createEl("input", {
    cls: "sm-cc-input sm-cc-input--small",
    attr: { type: "number", placeholder: "Override ATK", "aria-label": "Spell Attack Override" },
  }) as HTMLInputElement;
  if (spellcasting.saveDcOverride != null) saveOverrideInput.value = String(spellcasting.saveDcOverride);
  if (spellcasting.attackBonusOverride != null) attackOverrideInput.value = String(spellcasting.attackBonusOverride);
  saveOverrideInput.addEventListener("input", () => {
    const value = saveOverrideInput.value.trim();
    spellcasting.saveDcOverride = value === "" ? undefined : Number(value);
    updateComputed(true);
  });
  attackOverrideInput.addEventListener("input", () => {
    const value = attackOverrideInput.value.trim();
    spellcasting.attackBonusOverride = value === "" ? undefined : Number(value);
    updateComputed(true);
  });

  const toolbar = root.createDiv({ cls: "sm-cc-spellcasting__toolbar" });
  const addGroupButton = (label: string, onClick: () => void) => {
    const btn = toolbar.createEl("button", {
      cls: "sm-cc-button",
      text: label,
      attr: { type: "button" },
    });
    btn.addEventListener("click", onClick);
  };
  addGroupButton("+ At Will", () => {
    spellcasting.groups.push({ type: "at-will", title: "At Will", spells: [] });
    renderGroups();
    triggerValidation();
  });
  addGroupButton("+ X/Day (each)", () => {
    spellcasting.groups.push({ type: "per-day", uses: "1/day each", spells: [] });
    renderGroups();
    triggerValidation();
  });
  addGroupButton("+ Spell Level", () => {
    spellcasting.groups.push({ type: "level", level: 1, slots: 1, spells: [] });
    renderGroups();
    triggerValidation();
  });
  addGroupButton("+ Custom", () => {
    spellcasting.groups.push({ type: "custom", title: "Custom", description: "", spells: [] });
    renderGroups();
    triggerValidation();
  });

  const groupsContainer = root.createDiv({ cls: "sm-cc-spellcasting__groups" });
  const previewContainer = root.createDiv({ cls: "sm-cc-spellcasting__preview" });

  const runValidation: ValidationRunner | null = options.registerValidation
    ? options.registerValidation(() => collectSpellcastingIssues(data))
    : null;

  const triggerValidation = () => {
    runValidation?.();
  };

  const resolveAvailableSpells = () => {
    const provided = options.getAvailableSpells?.();
    if (provided && provided.length) return Array.from(provided);
    return availableSpells.slice();
  };

  const renderGroups = () => {
    typeaheadHandles.length = 0;
    groupsContainer.empty();
    if (!spellcasting.groups.length) {
      groupsContainer.createDiv({ cls: "sm-cc-spellcasting__groups-empty", text: "Noch keine Gruppen." });
      renderPreview();
      return;
    }
    spellcasting.groups.forEach((group, index) => {
      const groupBox = groupsContainer.createDiv({ cls: "sm-cc-spell-group" });
      const head = groupBox.createDiv({ cls: "sm-cc-spell-group__head" });
      const titleInput = head.createEl("input", {
        cls: "sm-cc-input sm-cc-spell-group__title",
        attr: { type: "text", placeholder: getGroupHeading(group) },
      }) as HTMLInputElement;
      titleInput.value = group.title ?? "";
      titleInput.addEventListener("input", () => {
        const value = titleInput.value.trim();
        if (group.type === "custom") {
          group.title = value || "";
        } else {
          group.title = value || undefined;
        }
        renderPreview();
        triggerValidation();
      });

      const controls = head.createDiv({ cls: "sm-cc-spell-group__controls" });
      const moveUp = controls.createEl("button", { text: "↑", cls: "btn-compact", attr: { type: "button" } });
      const moveDown = controls.createEl("button", { text: "↓", cls: "btn-compact", attr: { type: "button" } });
      const remove = controls.createEl("button", { text: "×", cls: "btn-compact", attr: { type: "button" } });
      moveUp.disabled = index === 0;
      moveDown.disabled = index === spellcasting.groups.length - 1;
      moveUp.onclick = () => {
        if (index === 0) return;
        const [item] = spellcasting.groups.splice(index, 1);
        spellcasting.groups.splice(index - 1, 0, item);
        renderGroups();
        renderPreview();
        triggerValidation();
      };
      moveDown.onclick = () => {
        if (index >= spellcasting.groups.length - 1) return;
        const [item] = spellcasting.groups.splice(index, 1);
        spellcasting.groups.splice(index + 1, 0, item);
        renderGroups();
        renderPreview();
        triggerValidation();
      };
      remove.onclick = () => {
        spellcasting.groups.splice(index, 1);
        renderGroups();
        renderPreview();
        triggerValidation();
      };

      const meta = groupBox.createDiv({ cls: "sm-cc-spell-group__meta" });
      if (group.type === "per-day") {
        const usesInput = meta.createEl("input", {
          cls: "sm-cc-input sm-cc-input--small",
          attr: { type: "text", placeholder: "3/day", "aria-label": "Nutzungen" },
        }) as HTMLInputElement;
        usesInput.value = group.uses ?? "";
        usesInput.addEventListener("input", () => {
          group.uses = usesInput.value.trim();
          renderPreview();
          triggerValidation();
        });
        const noteInput = meta.createEl("input", {
          cls: "sm-cc-input",
          attr: { type: "text", placeholder: "Notiz", "aria-label": "Notiz" },
        }) as HTMLInputElement;
        noteInput.value = group.note ?? "";
        noteInput.addEventListener("input", () => {
          group.note = noteInput.value.trim() || undefined;
          renderPreview();
        });
      } else if (group.type === "level") {
        const levelInput = meta.createEl("input", {
          cls: "sm-cc-input sm-cc-input--small",
          attr: { type: "number", min: "0", max: "9", "aria-label": "Zaubergrad" },
        }) as HTMLInputElement;
        levelInput.value = group.level != null ? String(group.level) : "";
        levelInput.addEventListener("input", () => {
          const parsed = Number(levelInput.value);
          group.level = Number.isFinite(parsed) ? parsed : (group.level ?? 0);
          renderPreview();
          triggerValidation();
        });
        const slotsInput = meta.createEl("input", {
          cls: "sm-cc-input sm-cc-input--small",
          attr: { type: "text", placeholder: "Slots", "aria-label": "Slots" },
        }) as HTMLInputElement;
        if (group.slots != null) slotsInput.value = String(group.slots);
        slotsInput.addEventListener("input", () => {
          const value = slotsInput.value.trim();
          if (!value) {
            group.slots = undefined;
          } else {
            const parsed = Number(value);
            group.slots = Number.isFinite(parsed) ? parsed : value;
          }
          renderPreview();
        });
        const noteInput = meta.createEl("input", {
          cls: "sm-cc-input",
          attr: { type: "text", placeholder: "Notiz", "aria-label": "Notiz" },
        }) as HTMLInputElement;
        noteInput.value = group.note ?? "";
        noteInput.addEventListener("input", () => {
          group.note = noteInput.value.trim() || undefined;
          renderPreview();
        });
      } else if (group.type === "custom") {
        const descArea = meta.createEl("textarea", {
          cls: "sm-cc-textarea",
          attr: { placeholder: "Beschreibung" },
        });
        descArea.value = group.description ?? "";
        descArea.addEventListener("input", () => {
          group.description = descArea.value.trim() || undefined;
          renderPreview();
        });
      }

      const spellsList = groupBox.createDiv({ cls: "sm-cc-spell-group__spells" });
      const spells = (group as SpellcastingGroupWithSpells).spells ?? [];
      spells.forEach((spell, spellIndex) => {
        const row = spellsList.createDiv({ cls: "sm-cc-spell-row" });
        const nameCell = row.createDiv({ cls: "sm-cc-spell-row__name" });
        const spellHandle = mountSpellInput(nameCell, resolveAvailableSpells, "Zaubername");
        spellHandle.input.value = spell.name ?? "";
        spellHandle.input.addEventListener("input", () => {
          spell.name = spellHandle.input.value;
          renderPreview();
          triggerValidation();
        });
        typeaheadHandles.push(spellHandle);

        const notesCell = row.createDiv({ cls: "sm-cc-spell-row__notes" });
        const notesInput = notesCell.createEl("input", {
          cls: "sm-cc-input",
          attr: { type: "text", placeholder: "Notiz" },
        }) as HTMLInputElement;
        notesInput.value = spell.notes ?? "";
        notesInput.addEventListener("input", () => {
          const trimmed = notesInput.value.trim();
          spell.notes = trimmed || undefined;
          renderPreview();
        });

        const removeSpell = row.createEl("button", { text: "×", cls: "btn-compact" });
        removeSpell.onclick = () => {
          spells.splice(spellIndex, 1);
          renderGroups();
          renderPreview();
          triggerValidation();
        };
      });

      const addRow = spellsList.createDiv({ cls: "sm-cc-spell-row sm-cc-spell-row--add" });
      const addNameCell = addRow.createDiv({ cls: "sm-cc-spell-row__name" });
      const addHandle = mountSpellInput(addNameCell, resolveAvailableSpells, "Zauber hinzufügen…");
      typeaheadHandles.push(addHandle);
      const addNotesCell = addRow.createDiv({ cls: "sm-cc-spell-row__notes" });
      const addNotesInput = addNotesCell.createEl("input", {
        cls: "sm-cc-input",
        attr: { type: "text", placeholder: "Notiz (optional)" },
      }) as HTMLInputElement;
      const addButton = addRow.createEl("button", { text: "+", cls: "btn-compact" });
      const addSpell = () => {
        const name = ensureSpellName(addHandle.input.value);
        if (!name) return;
        spells.push({ name, notes: ensureSpellName(addNotesInput.value) });
        addHandle.input.value = "";
        addNotesInput.value = "";
        renderGroups();
        renderPreview();
        triggerValidation();
      };
      addButton.onclick = addSpell;
      addHandle.input.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          addSpell();
        }
      });
    });
    renderPreview();
  };

  const renderPreview = () => {
    renderPreviewContent(previewContainer, spellcasting);
  };

  const updateComputed = (refreshPreview: boolean) => {
    const abilityMod = spellcasting.ability ? getAbilityModifier(data, spellcasting.ability) : null;
    const proficiency = getProficiencyBonus(data);
    const saveDc = calculateSaveDc({ abilityMod, proficiencyBonus: proficiency, override: spellcasting.saveDcOverride });
    const attackBonus = calculateAttackBonus({ abilityMod, proficiencyBonus: proficiency, override: spellcasting.attackBonusOverride });
    spellcasting.computed = {
      abilityMod,
      proficiencyBonus: proficiency,
      saveDc,
      attackBonus,
    };
    saveLabel.textContent = `Save DC: ${saveDc != null ? saveDc : "—"}`;
    attackLabel.textContent = `Attack: ${attackBonus != null ? (attackBonus >= 0 ? "+" : "") + attackBonus : "—"}`;
    if (refreshPreview) renderPreview();
  };

  const host = parent.closest(".modal") ?? parent;
  const hostInputListener = () => updateComputed(true);
  host.addEventListener("input", hostInputListener);

  const refreshSpellMatches = () => {
    typeaheadHandles.forEach((handle) => handle.refreshMatches());
  };

  const setAvailableSpells = (spells: readonly string[]) => {
    availableSpells.splice(0, availableSpells.length, ...spells);
    refreshSpellMatches();
  };

  const revalidate = () => {
    triggerValidation();
    return collectSpellcastingIssues(data);
  };

  renderGroups();
  updateComputed(true);

  return {
    refreshSpellMatches,
    revalidate,
    setAvailableSpells,
  };
}
