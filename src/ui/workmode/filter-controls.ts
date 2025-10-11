// src/ui/workmode/filter-controls.ts
// Shared filter and sort state plus renderer that reproduces the Library layout for all workmodes.

export type SortDirection = "asc" | "desc";

export interface FilterDefinition<Entry> {
    readonly id: string;
    readonly label: string;
    readonly getValues: (entry: Entry) => readonly (string | null | undefined)[];
    readonly sortComparator?: (a: string, b: string) => number;
    readonly formatOption?: (value: string) => string;
    readonly emptyLabel?: string;
}

export interface SortDefinition<Entry> {
    readonly id: string;
    readonly label: string;
    readonly compare: (a: Entry, b: Entry) => number;
}

export type FilterOptionValues = Map<string, string[]>;

export interface FilterSortCopy {
    readonly filterTitle: string;
    readonly sortTitle: string;
    readonly sortByLabel: string;
    readonly emptyOptionLabel: string;
    readonly clearFiltersLabel: string;
    readonly sortAscendingAria: string;
    readonly sortDescendingAria: string;
    readonly sortAscendingTitle: string;
    readonly sortDescendingTitle: string;
}

const DEFAULT_COPY: FilterSortCopy = {
    filterTitle: "Filter",
    sortTitle: "Sort",
    sortByLabel: "Sort by:",
    emptyOptionLabel: "All",
    clearFiltersLabel: "Clear filters",
    sortAscendingAria: "Sort ascending",
    sortDescendingAria: "Sort descending",
    sortAscendingTitle: "Ascending",
    sortDescendingTitle: "Descending",
};

export class FilterSortState<Entry> {
    private readonly filters = new Map<string, string>();
    private sortId?: string;
    private sortDirection: SortDirection = "asc";

    ensureSortAvailable(sorts: readonly SortDefinition<Entry>[]): void {
        if (!sorts.length) {
            this.sortId = undefined;
            this.sortDirection = "asc";
            return;
        }
        if (!this.sortId || !sorts.some(option => option.id === this.sortId)) {
            this.sortId = sorts[0].id;
            this.sortDirection = "asc";
        }
    }

    getSortId(): string | undefined {
        return this.sortId;
    }

    getSortDirection(): SortDirection {
        return this.sortDirection;
    }

    setSort(id: string): void {
        if (!id) return;
        if (this.sortId === id) {
            this.sortDirection = this.sortDirection === "asc" ? "desc" : "asc";
        } else {
            this.sortId = id;
            this.sortDirection = "asc";
        }
    }

    getFilterValue(id: string): string | undefined {
        return this.filters.get(id);
    }

    setFilterValue(id: string, value: string): void {
        if (value) {
            this.filters.set(id, value);
        } else {
            this.filters.delete(id);
        }
    }

    hasFilters(): boolean {
        return this.filters.size > 0;
    }

    clearFilters(): void {
        this.filters.clear();
    }

    pruneInvalidFilters(options: FilterOptionValues): void {
        for (const [id, value] of Array.from(this.filters.entries())) {
            if (!value) continue;
            if (!options.get(id)?.includes(value)) {
                this.filters.delete(id);
            }
        }
    }

    matches(entry: Entry, filters: readonly FilterDefinition<Entry>[]): boolean {
        if (!this.filters.size) return true;
        for (const [id, selected] of this.filters.entries()) {
            if (!selected) continue;
            const definition = filters.find(filter => filter.id === id);
            if (!definition) continue;
            const values = (definition.getValues(entry) || [])
                .map(value => (value ?? "").trim())
                .filter((value): value is string => Boolean(value));
            if (!values.includes(selected)) {
                return false;
            }
        }
        return true;
    }
}

export function collectFilterOptions<Entry>(
    entries: readonly Entry[],
    filters: readonly FilterDefinition<Entry>[],
): FilterOptionValues {
    const options: FilterOptionValues = new Map();
    for (const filter of filters) {
        const values = new Set<string>();
        for (const entry of entries) {
            const rawValues = filter.getValues(entry) || [];
            for (const raw of rawValues) {
                const value = (raw ?? "").trim();
                if (value) {
                    values.add(value);
                }
            }
        }
        const list = Array.from(values);
        const comparator = filter.sortComparator ?? ((a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: "base" }));
        list.sort(comparator);
        options.set(filter.id, list);
    }
    return options;
}

export interface RenderFilterSortControlsOptions<Entry> {
    readonly container: HTMLElement;
    readonly filters: readonly FilterDefinition<Entry>[];
    readonly sorts: readonly SortDefinition<Entry>[];
    readonly optionValues: FilterOptionValues;
    readonly state: FilterSortState<Entry>;
    readonly onChange: () => void;
    readonly copy?: Partial<FilterSortCopy>;
}

export function renderFilterSortControls<Entry>({
    container,
    filters,
    sorts,
    optionValues,
    state,
    onChange,
    copy,
}: RenderFilterSortControlsOptions<Entry>): void {
    const strings = { ...DEFAULT_COPY, ...copy };
    const controls = container.createDiv({ cls: "sm-cc-controls" });

    if (filters.length) {
        const filterContainer = controls.createDiv({ cls: "sm-cc-filters" });
        filterContainer.createEl("h4", { text: strings.filterTitle, cls: "sm-cc-section-header" });
        const filterContent = filterContainer.createDiv({ cls: "sm-cc-filter-content" });

        for (const filter of filters) {
            const wrapper = filterContent.createDiv({ cls: "sm-cc-filter" });
            wrapper.createEl("label", { text: `${filter.label}: ` });
            const select = wrapper.createEl("select");
            select.createEl("option", { value: "", text: filter.emptyLabel ?? strings.emptyOptionLabel });
            const values = optionValues.get(filter.id) ?? [];
            for (const value of values) {
                select.createEl("option", { value, text: filter.formatOption ? filter.formatOption(value) : value });
            }
            select.value = state.getFilterValue(filter.id) ?? "";
            select.onchange = () => {
                state.setFilterValue(filter.id, select.value);
                onChange();
            };
        }

        if (state.hasFilters()) {
            const clearBtn = filterContent.createEl("button", { text: strings.clearFiltersLabel, cls: "sm-cc-clear-filters" });
            clearBtn.onclick = () => {
                state.clearFilters();
                onChange();
            };
        }
    }

    if (sorts.length) {
        const sortContainer = controls.createDiv({ cls: "sm-cc-sorting" });
        sortContainer.createEl("h4", { text: strings.sortTitle, cls: "sm-cc-section-header" });
        const sortContent = sortContainer.createDiv({ cls: "sm-cc-sort-content" });

        const sortWrapper = sortContent.createDiv({ cls: "sm-cc-sort" });
        sortWrapper.createEl("label", { text: `${strings.sortByLabel} ` });
        const select = sortWrapper.createEl("select");
        for (const option of sorts) {
            select.createEl("option", { value: option.id, text: option.label });
        }
        const directionBtn = sortContent.createEl("button", {
            cls: "sm-cc-sort-direction",
            attr: { "aria-label": state.getSortDirection() === "asc" ? strings.sortAscendingAria : strings.sortDescendingAria },
        });
        const updateDirectionVisuals = () => {
            const direction = state.getSortDirection();
            directionBtn.innerHTML = direction === "asc" ? "↑" : "↓";
            directionBtn.title = direction === "asc" ? strings.sortAscendingTitle : strings.sortDescendingTitle;
            directionBtn.setAttribute("aria-label", direction === "asc" ? strings.sortAscendingAria : strings.sortDescendingAria);
        };
        updateDirectionVisuals();
        const currentSort = state.getSortId();
        if (currentSort) {
            select.value = currentSort;
        }
        select.onchange = () => {
            state.setSort(select.value);
            updateDirectionVisuals();
            onChange();
        };
        directionBtn.onclick = () => {
            const targetId = state.getSortId() ?? sorts[0]?.id;
            if (!targetId) return;
            state.setSort(targetId);
            updateDirectionVisuals();
            onChange();
        };
    }
}
