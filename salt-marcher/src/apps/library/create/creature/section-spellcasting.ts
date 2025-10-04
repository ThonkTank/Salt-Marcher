// src/apps/library/create/creature/section-spellcasting.ts
// Erfasst Spellcasting-Einträge, synchronisiert verfügbare Zauberquellen und meldet Validierungsfehler.
import type { LegacySpellcastingEntry, StatblockData } from "../../core/creature-files";
import type { ValidationRegistrar, ValidationRunner } from "../shared/layouts";

export interface CreatureSpellcastingSectionOptions {
  getAvailableSpells?: () => readonly string[] | null | undefined;
  registerValidation?: ValidationRegistrar;
}

export interface CreatureSpellcastingSectionHandles {
  refreshSpellMatches(): void;
  setAvailableSpells(spells: readonly string[]): void;
}

function ensureLegacySpellList(data: StatblockData): LegacySpellcastingEntry[] {
  if (!Array.isArray(data.spellsKnown)) (data as any).spellsKnown = [] as LegacySpellcastingEntry[];
  return data.spellsKnown as LegacySpellcastingEntry[];
}

function collectSpellcastingIssues(data: StatblockData): string[] {
  const issues: string[] = [];
  const spells = ensureLegacySpellList(data);
  const seen = new Map<string, number>();
  spells.forEach((entry, index) => {
    const name = entry?.name?.trim();
    if (!name) {
      issues.push(`Eintrag ${index + 1} benötigt einen Namen.`);
      return;
    }
    const key = name.toLowerCase();
    const duplicateIndex = seen.get(key);
    if (duplicateIndex != null) {
      issues.push(`Zauber "${name}" ist mehrfach hinterlegt (Positionen ${duplicateIndex + 1} und ${index + 1}).`);
      return;
    }
    seen.set(key, index);
  });
  return issues;
}

export function mountCreatureSpellcastingSection(
  parent: HTMLElement,
  data: StatblockData,
  options: CreatureSpellcastingSectionOptions = {},
): CreatureSpellcastingSectionHandles {
  const spellList = ensureLegacySpellList(data);
  const availableSpells: string[] = [];
  const resolveSpellCandidates = () => {
    const provided = options.getAvailableSpells?.();
    if (provided && provided.length) return Array.from(provided);
    return availableSpells.slice();
  };

  const wrap = parent.createDiv({ cls: "setting-item sm-cc-spells" });
  wrap.createDiv({ cls: "setting-item-info", text: "Spellcasting" });
  const ctl = wrap.createDiv({ cls: "setting-item-control" });

  const row1 = ctl.createDiv({ cls: "sm-cc-searchbar" });
  row1.createEl("label", { text: "Zauber" });
  const spellBox = row1.createDiv({ cls: "sm-preset-box", attr: { style: "flex:1 1 auto; min-width: 180px;" } });
  const spellInput = spellBox.createEl("input", {
    cls: "sm-preset-input",
    attr: { type: "text", placeholder: "Zauber suchen…" },
  }) as HTMLInputElement;
  const spellMenu = spellBox.createDiv({ cls: "sm-preset-menu" });

  let chosenSpell = "";
  const renderSpellMenu = () => {
    const query = (spellInput.value || "").toLowerCase();
    spellMenu.empty();
    const matches = resolveSpellCandidates()
      .filter((name) => !query || name.toLowerCase().includes(query))
      .slice(0, 24);
    if (matches.length === 0) {
      spellBox.removeClass("is-open");
      return;
    }
    for (const name of matches) {
      const item = spellMenu.createDiv({ cls: "sm-preset-item", text: name });
      item.onclick = () => {
        chosenSpell = name;
        spellInput.value = name;
        spellBox.removeClass("is-open");
      };
    }
    spellBox.addClass("is-open");
  };

  spellInput.addEventListener("focus", renderSpellMenu);
  spellInput.addEventListener("input", renderSpellMenu);
  spellInput.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      spellInput.value = "";
      chosenSpell = "";
      spellBox.removeClass("is-open");
    }
  });
  spellInput.addEventListener("blur", () => {
    window.setTimeout(() => spellBox.removeClass("is-open"), 120);
  });

  row1.createEl("label", { text: "Grad" });
  const levelInput = row1.createEl("input", {
    attr: { type: "number", min: "0", max: "9", placeholder: "Grad", "aria-label": "Grad" },
  }) as HTMLInputElement;
  (levelInput.style as any).width = "4ch";

  const row2 = ctl.createDiv({ cls: "sm-cc-searchbar" });
  row2.createEl("label", { text: "Nutzung" });
  const usesInput = row2.createEl("input", {
    attr: { type: "text", placeholder: "at will / 3/day / slots", "aria-label": "Nutzung" },
  }) as HTMLInputElement;
  (usesInput.style as any).width = "14ch";
  row2.createEl("label", { text: "Notizen" });
  const notesInput = row2.createEl("input", {
    attr: { type: "text", placeholder: "Notizen", "aria-label": "Notizen" },
  }) as HTMLInputElement;
  (notesInput.style as any).width = "16ch";

  const runValidation: ValidationRunner | null = options.registerValidation
    ? options.registerValidation(() => collectSpellcastingIssues(data))
    : null;
  const triggerValidation = () => {
    runValidation?.();
  };

  const list = ctl.createDiv({ cls: "sm-cc-list" });
  const renderList = () => {
    list.empty();
    spellList.forEach((entry, index) => {
      const item = list.createDiv({ cls: "sm-cc-item" });
      const displayName = entry.name ?? "";
      const levelLabel = entry.level != null ? ` (Lvl ${entry.level})` : "";
      const usesLabel = entry.uses ? ` – ${entry.uses}` : "";
      item.createDiv({ cls: "sm-cc-item__name", text: `${displayName}${levelLabel}${usesLabel}` });
      const removeButton = item.createEl("button", { text: "×" });
      removeButton.onclick = () => {
        spellList.splice(index, 1);
        renderList();
        triggerValidation();
      };
    });
  };

  const addSpellButton = row2.createEl("button", { text: "+ Hinzufügen" });
  addSpellButton.onclick = () => {
    let name = chosenSpell?.trim();
    if (!name) name = (spellInput.value || "").trim();
    if (!name) return;
    spellList.push({
      name,
      level: levelInput.value ? parseInt(levelInput.value, 10) : undefined,
      uses: usesInput.value.trim() || undefined,
      notes: notesInput.value.trim() || undefined,
    });
    spellInput.value = "";
    chosenSpell = "";
    levelInput.value = "";
    usesInput.value = "";
    notesInput.value = "";
    renderList();
    triggerValidation();
  };

  renderList();
  triggerValidation();

  const refreshSpellMatches = () => {
    if (document.activeElement === spellInput || spellBox.hasClass("is-open")) {
      renderSpellMenu();
    }
  };

  const setAvailableSpells = (spells: readonly string[]) => {
    availableSpells.splice(0, availableSpells.length, ...spells);
    if (spellBox.hasClass("is-open") || document.activeElement === spellInput) {
      renderSpellMenu();
    }
  };

  return { refreshSpellMatches, setAvailableSpells };
}

export { mountCreatureSpellcastingSection as mountSpellsKnownSection };
