// src/apps/library/create/creature/section-entries.ts
// Pflegt strukturierte Einträge für Traits, Aktionen, Bonusaktionen, Reaktionen und Legendäres.
import type { StatblockData } from "../../core/creature-files";
import { CREATURE_ENTRY_CATEGORIES } from "./presets";
import type { CreatureEntryCategory } from "./presets";
import type { SectionValidationRegistrar } from "./section-utils";
import { validateEntry } from "./entry-model";
import { createEntryCard } from "./components/entry-card";

type EntryFilter = CreatureEntryCategory | "all";

const ENTRY_FILTER_OPTIONS: readonly { value: EntryFilter; label: string; hint: string }[] = [
  { value: "all", label: "Alle", hint: "Alle Einträge anzeigen" },
  { value: "trait", label: "Traits", hint: "Nur Eigenschaften anzeigen" },
  { value: "action", label: "Actions", hint: "Nur Aktionen anzeigen" },
  { value: "bonus", label: "Bonus", hint: "Nur Bonusaktionen anzeigen" },
  { value: "reaction", label: "Reactions", hint: "Nur Reaktionen anzeigen" },
  { value: "legendary", label: "Legendary", hint: "Nur legendäre Aktionen anzeigen" },
] as const;

export function collectEntryDependencyIssues(data: StatblockData): string[] {
  const entries = data.entries ?? [];
  const allIssues: string[] = [];
  entries.forEach((entry, index) => {
    const issues = validateEntry(entry as any, index);
    allIssues.push(...issues);
  });
  return allIssues;
}

export function mountEntriesSection(
  parent: HTMLElement,
  data: StatblockData,
  registerValidation?: SectionValidationRegistrar,
) {
  if (!data.entries) data.entries = [] as any;

  const wrap = parent.createDiv({ cls: "setting-item sm-cc-entries" });
  wrap.createDiv({ cls: "setting-item-info", text: "Einträge (Traits, Aktionen, …)" });
  const ctl = wrap.createDiv({ cls: "setting-item-control" });

  const addBar = ctl.createDiv({ cls: "sm-cc-entry-add-bar" });
  addBar.createEl("span", { cls: "sm-cc-entry-add-label", text: "Hinzufügen:" });
  const addButtonGroup = addBar.createDiv({ cls: "sm-cc-entry-add-group" });

  for (const [value, label] of CREATURE_ENTRY_CATEGORIES) {
    const btn = addButtonGroup.createEl("button", {
      cls: `sm-cc-entry-add-btn sm-cc-entry-add-btn--${value}`,
      text: label,
      attr: { type: "button", "data-category": value }
    });
    btn.onclick = () => {
      (data.entries as any[]).unshift({ category: value as any, name: "" });
      if (activeFilter !== "all" && activeFilter !== value) {
        activeFilter = "all";
        updateFilterButtons();
      }
      focusIdx = 0;
      render();
    };
  }

  let activeFilter: EntryFilter = "all";
  const filterBar = ctl.createDiv({
    cls: "sm-cc-entry-filter",
    attr: { role: "toolbar", "aria-label": "Eintragsliste filtern" },
  });
  const filterButtons = new Map<EntryFilter, HTMLButtonElement>();
  const updateFilterButtons = () => {
    for (const opt of ENTRY_FILTER_OPTIONS) {
      const btn = filterButtons.get(opt.value);
      if (!btn) continue;
      const isActive = opt.value === activeFilter;
      btn.setAttr("aria-pressed", isActive ? "true" : "false");
      btn.toggleClass("is-active", isActive);
    }
  };
  for (const opt of ENTRY_FILTER_OPTIONS) {
    const btn = filterBar.createEl("button", {
      text: opt.label,
      attr: {
        type: "button",
        title: opt.hint,
        "aria-label": opt.hint,
        "aria-pressed": opt.value === activeFilter ? "true" : "false",
      },
    }) as HTMLButtonElement;
    btn.onclick = () => {
      activeFilter = opt.value;
      updateFilterButtons();
      render();
    };
    filterButtons.set(opt.value, btn);
  }

  const host = ctl.createDiv();
  let focusIdx: number | null = null;
  const revalidate =
    registerValidation?.(() => collectEntryDependencyIssues(data)) ?? (() => []);

  const render = () => {
    updateFilterButtons();
    host.empty();
    (data.entries as any[]).forEach((entry, index) => {
      const shouldFocus = focusIdx === index;
      if (shouldFocus) focusIdx = null;

      const card = createEntryCard(host, {
        entry,
        index,
        data,
        onDelete: () => {
          (data.entries as any[]).splice(index, 1);
          render();
        },
        onMoveUp: () => {
          if (index > 0) {
            const entries = data.entries as any[];
            [entries[index], entries[index - 1]] = [entries[index - 1], entries[index]];
            revalidate();
            render();
          }
        },
        onMoveDown: () => {
          const entries = data.entries as any[];
          if (index < entries.length - 1) {
            [entries[index], entries[index + 1]] = [entries[index + 1], entries[index]];
            revalidate();
            render();
          }
        },
        canMoveUp: index > 0,
        canMoveDown: index < (data.entries as any[]).length - 1,
        onUpdate: () => {
          revalidate();
          render();
        },
        shouldFocus,
      });

      // Apply filter visibility
      const isVisible = activeFilter === "all" || entry.category === activeFilter;
      card.toggleClass("sm-cc-entry-hidden", !isVisible);
      (card.style as any).display = isVisible ? "" : "none";
      card.setAttr("aria-hidden", isVisible ? "false" : "true");
    });
    revalidate();
  };

  render();
}
