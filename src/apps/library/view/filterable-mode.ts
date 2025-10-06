// src/apps/library/view/filterable-mode.ts
// Gemeinsamer Renderer für filterbare Library-Listen auf Basis der Kreaturenansicht.
import type { TFile } from "obsidian";
import { BaseModeRenderer, scoreName } from "./mode";

export interface FilterableEntry {
    name: string;
    file: TFile;
}

export interface FilterDefinition<Meta extends FilterableEntry> {
    id: string;
    label: string;
    getValues(entry: Meta): readonly (string | null | undefined)[];
    sortComparator?: (a: string, b: string) => number;
    formatOption?: (value: string) => string;
    emptyLabel?: string;
}

export interface SortDefinition<Meta extends FilterableEntry> {
    id: string;
    label: string;
    compare(a: Meta, b: Meta): number;
}

type FilterOptionMap<Meta extends FilterableEntry> = Map<string, FilterDefinition<Meta>>;

type OptionValues = Map<string, string[]>;

export abstract class FilterableLibraryRenderer<Meta extends FilterableEntry> extends BaseModeRenderer {
    private files: TFile[] = [];
    private activeFilters = new Map<string, string>();
    private sortBy?: string;
    private sortDirection: "asc" | "desc" = "asc";
    private renderToken = 0;

    protected abstract listSourceFiles(): Promise<TFile[]>;
    protected abstract watchSourceFiles(onChange: () => void): () => void;
    protected abstract loadEntry(file: TFile): Promise<Meta>;
    protected abstract getFilters(): FilterDefinition<Meta>[];
    protected abstract getSortOptions(): SortDefinition<Meta>[];
    protected abstract renderEntry(row: HTMLElement, entry: Meta): void;

    protected getFilterEmptyLabel(filter: FilterDefinition<Meta>): string {
        return filter.emptyLabel ?? "All";
    }

    protected getOptionLabel(filter: FilterDefinition<Meta>, value: string): string {
        return filter.formatOption ? filter.formatOption(value) : value;
    }

    protected getSearchCandidates(entry: Meta): string[] {
        return [entry.name];
    }

    async init(): Promise<void> {
        await this.refreshEntries();
        const stop = this.watchSourceFiles(() => {
            void this.handleSourceChange();
        });
        this.registerCleanup(stop);
    }

    protected async refreshEntries(): Promise<void> {
        this.files = await this.listSourceFiles();
    }

    render(): void {
        void this.renderInternal();
    }

    private async handleSourceChange(): Promise<void> {
        await this.refreshEntries();
        if (!this.isDisposed()) {
            this.render();
        }
    }

    private async renderInternal(): Promise<void> {
        const token = ++this.renderToken;
        const container = this.container;
        container.empty();

        const filters = this.getFilters();
        const filterMap: FilterOptionMap<Meta> = new Map(filters.map(def => [def.id, def]));
        const sorts = this.getSortOptions();
        if (sorts.length > 0) {
            if (!this.sortBy || !sorts.some(s => s.id === this.sortBy)) {
                this.sortBy = sorts[0].id;
            }
        } else {
            this.sortBy = undefined;
        }

        const entries = await Promise.all(this.files.map(async file => {
            try {
                return await this.loadEntry(file);
            } catch (err) {
                console.error("Failed to load library entry", { file: file.path, err });
                throw err;
            }
        })).catch(err => {
            console.error("Library render aborted due to load error", err);
            return [] as Meta[];
        });

        if (this.isDisposed() || token !== this.renderToken) {
            return;
        }

        const typedEntries = Array.isArray(entries) ? entries : [];
        const optionValues = this.collectFilterOptions(typedEntries, filters);
        this.normaliseFilterState(filters, optionValues);

        if (filters.length || sorts.length) {
            this.renderControls(container, filters, sorts, optionValues);
        }

        const query = this.query;
        const prepared = typedEntries.map(entry => ({
            entry,
            score: this.computeSearchScore(entry, query),
        }));

        const filtered = prepared.filter(({ entry }) => this.matchesFilters(entry, filterMap));
        const visible = query
            ? filtered.filter(item => item.score > -Infinity)
            : filtered;

        const sortDef = sorts.find(s => s.id === this.sortBy) ?? sorts[0];
        visible.sort((a, b) => {
            if (query && a.score !== b.score) {
                return b.score - a.score;
            }
            let comparison = sortDef ? sortDef.compare(a.entry, b.entry) : a.entry.name.localeCompare(b.entry.name);
            if (comparison === 0) {
                comparison = a.entry.name.localeCompare(b.entry.name);
            }
            return this.sortDirection === "asc" ? comparison : -comparison;
        });

        if (visible.length === 0) {
            container.createDiv({ cls: "sm-cc-empty", text: "No entries found." });
            return;
        }

        for (const item of visible) {
            const row = container.createDiv({ cls: "sm-cc-item" });
            this.renderEntry(row, item.entry);
        }
    }

    private collectFilterOptions(entries: Meta[], filters: FilterDefinition<Meta>[]): OptionValues {
        const options: OptionValues = new Map();
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

    private normaliseFilterState(filters: FilterDefinition<Meta>[], optionValues: OptionValues): void {
        for (const filter of filters) {
            const selected = this.activeFilters.get(filter.id);
            if (selected && !optionValues.get(filter.id)?.includes(selected)) {
                this.activeFilters.delete(filter.id);
            }
        }
    }

    private renderControls(container: HTMLElement, filters: FilterDefinition<Meta>[], sorts: SortDefinition<Meta>[], optionValues: OptionValues): void {
        const controls = container.createDiv({ cls: "sm-cc-controls" });

        if (filters.length) {
            const filterContainer = controls.createDiv({ cls: "sm-cc-filters" });
            filterContainer.createEl("h4", { text: "Filter", cls: "sm-cc-section-header" });
            const filterContent = filterContainer.createDiv({ cls: "sm-cc-filter-content" });

            for (const filter of filters) {
                const wrapper = filterContent.createDiv({ cls: "sm-cc-filter" });
                wrapper.createEl("label", { text: `${filter.label}: ` });
                const select = wrapper.createEl("select");
                select.createEl("option", { value: "", text: this.getFilterEmptyLabel(filter) });
                const values = optionValues.get(filter.id) ?? [];
                for (const value of values) {
                    select.createEl("option", { value, text: this.getOptionLabel(filter, value) });
                }
                select.value = this.activeFilters.get(filter.id) ?? "";
                select.onchange = () => {
                    const value = select.value;
                    if (value) {
                        this.activeFilters.set(filter.id, value);
                    } else {
                        this.activeFilters.delete(filter.id);
                    }
                    this.render();
                };
            }

            if (Array.from(this.activeFilters.values()).some(Boolean)) {
                const clearBtn = filterContent.createEl("button", { text: "Clear filters", cls: "sm-cc-clear-filters" });
                clearBtn.onclick = () => {
                    this.activeFilters.clear();
                    this.render();
                };
            }
        }

        if (sorts.length) {
            const sortContainer = controls.createDiv({ cls: "sm-cc-sorting" });
            sortContainer.createEl("h4", { text: "Sort", cls: "sm-cc-section-header" });
            const sortContent = sortContainer.createDiv({ cls: "sm-cc-sort-content" });

            const sortWrapper = sortContent.createDiv({ cls: "sm-cc-sort" });
            sortWrapper.createEl("label", { text: "Sort by: " });
            const select = sortWrapper.createEl("select");
            for (const option of sorts) {
                select.createEl("option", { value: option.id, text: option.label });
            }
            if (this.sortBy) {
                select.value = this.sortBy;
            }
            select.onchange = () => {
                this.sortBy = select.value;
                this.render();
            };

            const directionBtn = sortContent.createEl("button", {
                cls: "sm-cc-sort-direction",
                attr: { "aria-label": this.sortDirection === "asc" ? "Sort ascending" : "Sort descending" },
            });
            directionBtn.innerHTML = this.sortDirection === "asc" ? "↑" : "↓";
            directionBtn.title = this.sortDirection === "asc" ? "Ascending" : "Descending";
            directionBtn.onclick = () => {
                this.sortDirection = this.sortDirection === "asc" ? "desc" : "asc";
                this.render();
            };
        }
    }

    private matchesFilters(entry: Meta, filterMap: FilterOptionMap<Meta>): boolean {
        for (const [id, value] of this.activeFilters.entries()) {
            if (!value) continue;
            const def = filterMap.get(id);
            if (!def) continue;
            const values = (def.getValues(entry) || []).map(val => (val ?? "").trim()).filter((val): val is string => Boolean(val));
            if (!values.includes(value)) {
                return false;
            }
        }
        return true;
    }

    private computeSearchScore(entry: Meta, query: string): number {
        if (!query) return 0;
        let best = -Infinity;
        for (const candidate of this.getSearchCandidates(entry)) {
            const text = (candidate ?? "").toLowerCase();
            if (!text) continue;
            const score = scoreName(text, query);
            if (score > best) best = score;
        }
        return best;
    }
}
