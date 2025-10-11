// src/ui/workmode/create/entry-manager.ts
// Shared manager for Library-styled entry lists with add/filter controls.
import type { EntryCardConfigFactory } from "./entry-card";
import { renderEntryCard } from "./entry-card";
import type { ValidationRegistrar } from "./layouts";

export interface EntryCategoryDefinition<TCategory extends string> {
  id: TCategory;
  label: string;
  className?: string;
  title?: string;
}

export interface EntryFilterDefinition<TEntry, TFilter extends string> {
  id: TFilter;
  label: string;
  hint?: string;
  predicate: (entry: TEntry) => boolean;
}

export interface EntryRenderContext<TEntry> {
  readonly entry: TEntry;
  readonly index: number;
  readonly total: number;
  readonly shouldFocus: boolean;
  readonly canMoveUp: boolean;
  readonly canMoveDown: boolean;
  remove(): void;
  moveUp(): void;
  moveDown(): void;
  requestRender(): void;
}

export interface EntryManagerOptions<TEntry, TCategory extends string, TFilter extends string = never> {
  label: string;
  entries: TEntry[];
  categories: ReadonlyArray<EntryCategoryDefinition<TCategory>>;
  filters?: ReadonlyArray<EntryFilterDefinition<TEntry, TFilter>>;
  defaultFilter?: TFilter | "all";
  createEntry: (category: TCategory) => TEntry;
  renderEntry?: (container: HTMLElement, context: EntryRenderContext<TEntry>) => HTMLElement;
  card?: EntryCardConfigFactory<TEntry>;
  registerValidation?: ValidationRegistrar;
  collectIssues?: (entries: TEntry[]) => string[];
  onEntriesChanged?: (entries: TEntry[]) => void;
  insertPosition?: "start" | "end";
}

export interface EntryManagerHandles {
  rerender(): void;
  setFilter(filterId: string): void;
  getActiveFilter(): string;
}

type InternalFilter<T extends string> = T | "all";

export function mountEntryManager<TEntry, TCategory extends string, TFilter extends string = never>(
  parent: HTMLElement,
  options: EntryManagerOptions<TEntry, TCategory, TFilter>
): EntryManagerHandles {
  if (!options.renderEntry && !options.card) {
    throw new Error("mountEntryManager requires either renderEntry or card configuration");
  }

  const entries = options.entries;
  const wrap = parent.createDiv({ cls: "setting-item sm-cc-entries" });
  wrap.createDiv({ cls: "setting-item-info", text: options.label });
  const control = wrap.createDiv({ cls: "setting-item-control" });

  let focusIndex: number | null = null;
  let activeFilter: InternalFilter<TFilter> = (options.defaultFilter ?? "all") as InternalFilter<TFilter>;

  const addBar = control.createDiv({ cls: "sm-cc-entry-add-bar" });
  addBar.createEl("span", { cls: "sm-cc-entry-add-label", text: "Hinzufügen:" });
  const addGroup = addBar.createDiv({ cls: "sm-cc-entry-add-group" });

  const insertPosition = options.insertPosition ?? "start";

  const triggerChange = () => {
    options.onEntriesChanged?.(entries);
  };

  for (const category of options.categories) {
    const btn = addGroup.createEl("button", {
      cls: ["sm-cc-entry-add-btn", `sm-cc-entry-add-btn--${category.id}`].join(" "),
      text: category.label,
      attr: { type: "button", title: category.title ?? category.label },
    }) as HTMLButtonElement;
    btn.addEventListener("click", () => {
      const created = options.createEntry(category.id);
      if (insertPosition === "end") {
        entries.push(created);
        focusIndex = entries.length - 1;
      } else {
        entries.unshift(created);
        focusIndex = 0;
      }
      triggerChange();
      render();
    });
  }

  const filterBar = control.createDiv({
    cls: "sm-cc-entry-filter",
    attr: { role: "toolbar", "aria-label": "Eintragsliste filtern" },
  });

  const allFilter: EntryFilterDefinition<TEntry, InternalFilter<TFilter>> = {
    id: "all" as InternalFilter<TFilter>,
    label: "Alle",
    predicate: () => true,
  };

  const filterDefinitions: Array<EntryFilterDefinition<TEntry, InternalFilter<TFilter>>> = [allFilter];
  if (options.filters) {
    for (const filter of options.filters) {
      filterDefinitions.push({
        id: filter.id,
        label: filter.label,
        hint: filter.hint,
        predicate: filter.predicate,
      } as EntryFilterDefinition<TEntry, InternalFilter<TFilter>>);
    }
  }

  const filterButtons = new Map<InternalFilter<TFilter>, HTMLButtonElement>();
  const filterPredicates = new Map<InternalFilter<TFilter>, (entry: TEntry) => boolean>();

  const updateFilterButtons = () => {
    for (const [id, button] of filterButtons) {
      const isActive = id === activeFilter;
      button.setAttribute("aria-pressed", isActive ? "true" : "false");
      button.classList.toggle("is-active", isActive);
    }
  };

  for (const filter of filterDefinitions) {
    const button = filterBar.createEl("button", {
      text: filter.label,
      attr: {
        type: "button",
        title: filter.hint,
        "aria-label": filter.hint ?? filter.label,
        "aria-pressed": filter.id === activeFilter ? "true" : "false",
      },
    }) as HTMLButtonElement;
    button.addEventListener("click", () => {
      activeFilter = filter.id;
      updateFilterButtons();
      render();
    });
    filterButtons.set(filter.id, button);
    filterPredicates.set(filter.id, filter.predicate);
  }

  const host = control.createDiv({ cls: "sm-cc-entry-host" });
  const revalidate = options.registerValidation
    ? options.registerValidation(() => options.collectIssues?.(entries) ?? [])
    : () => [];

  const render = () => {
    updateFilterButtons();
    host.empty();

    const predicate = filterPredicates.get(activeFilter) ?? (() => true);

    const renderEntry =
      options.renderEntry ?? ((container: HTMLElement, context: EntryRenderContext<TEntry>) => {
        if (!options.card) {
          throw new Error("card factory missing for entry-manager render");
        }
        const config = options.card(context);
        return renderEntryCard({ parent: container, context, ...config }).card;
      });

    entries.forEach((entry, index) => {
      const shouldFocus = focusIndex === index;
      if (shouldFocus) focusIndex = null;

      const context: EntryRenderContext<TEntry> = {
        entry,
        index,
        total: entries.length,
        shouldFocus,
        canMoveUp: index > 0,
        canMoveDown: index < entries.length - 1,
        remove: () => {
          entries.splice(index, 1);
          triggerChange();
          focusIndex = index > 0 ? index - 1 : 0;
          render();
        },
        moveUp: () => {
          if (index <= 0) return;
          [entries[index - 1], entries[index]] = [entries[index], entries[index - 1]];
          triggerChange();
          focusIndex = index - 1;
          render();
        },
        moveDown: () => {
          if (index >= entries.length - 1) return;
          [entries[index + 1], entries[index]] = [entries[index], entries[index + 1]];
          triggerChange();
          focusIndex = index + 1;
          render();
        },
        requestRender: () => {
          triggerChange();
          render();
        },
      };

      const card = renderEntry(host, context);
      const isVisible = predicate(entry);
      card.classList.toggle("sm-cc-entry-hidden", !isVisible);
      card.style.display = isVisible ? "" : "none";
      card.setAttribute("aria-hidden", isVisible ? "false" : "true");
    });

    revalidate();
  };

  render();

  return {
    rerender: render,
    setFilter: (filterId: string) => {
      if (filterPredicates.has(filterId as InternalFilter<TFilter>)) {
        activeFilter = filterId as InternalFilter<TFilter>;
        render();
      }
    },
    getActiveFilter: () => activeFilter,
  };
}
