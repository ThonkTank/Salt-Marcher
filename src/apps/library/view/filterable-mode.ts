// src/apps/library/view/filterable-mode.ts
// Zentraler Renderer für filterbare Library-Listen auf Basis konfigurierbarer Schemata.
import type { App } from "obsidian";
import { BaseModeRenderer, scoreName, LibrarySourceWatcherHub } from "./mode";
import { LIBRARY_DATA_SOURCES, type FilterableLibraryMode, type LibraryEntry, type LibraryDataSource } from "../core/data-sources";
import { LIBRARY_LIST_SCHEMAS, type FilterDefinition, type SortDefinition, type LibraryListSchema } from "./filter-registry";

interface PreparedEntry<M extends FilterableLibraryMode> {
    entry: LibraryEntry<M>;
    score: number;
}

type OptionValues = Map<string, string[]>;

type FeedbackKind = "empty" | "error";

class LibraryListState<M extends FilterableLibraryMode> {
    private readonly filters = new Map<string, string>();
    private sortId?: string;
    private sortDirection: "asc" | "desc" = "asc";

    constructor(private readonly schema: LibraryListSchema<M>) {}

    ensureSortAvailable(sorts: SortDefinition<M>[]): void {
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

    getSortDirection(): "asc" | "desc" {
        return this.sortDirection;
    }

    setSort(id: string): void {
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

    pruneInvalidFilters(options: OptionValues): void {
        for (const [id, value] of Array.from(this.filters.entries())) {
            if (!value) continue;
            if (!options.get(id)?.includes(value)) {
                this.filters.delete(id);
            }
        }
    }

    matches(entry: LibraryEntry<M>, filters: FilterDefinition<M>[]): boolean {
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

function renderFeedback(container: HTMLElement, kind: FeedbackKind, message: string): void {
    container.createDiv({ cls: `sm-cc-feedback sm-cc-feedback--${kind}`, text: message });
}

export abstract class FilterableLibraryRenderer<M extends FilterableLibraryMode> extends BaseModeRenderer {
    readonly mode: M;
    private readonly source: LibraryDataSource<M>;
    private readonly schema: LibraryListSchema<M>;
    private readonly state: LibraryListState<M>;
    private entries: LibraryEntry<M>[] = [];
    private loadError?: unknown;
    private renderToken = 0;

    constructor(
        app: App,
        container: HTMLElement,
        private readonly watchers: LibrarySourceWatcherHub,
        mode: M,
    ) {
        super(app, container);
        this.mode = mode;
        this.source = LIBRARY_DATA_SOURCES[mode] as LibraryDataSource<M>;
        this.schema = LIBRARY_LIST_SCHEMAS[mode] as LibraryListSchema<M>;
        this.state = new LibraryListState(this.schema);
    }

    async init(): Promise<void> {
        await this.refreshEntries();
        if (this.isDisposed()) return;
        const unsubscribe = this.watchers.subscribe(this.mode, (onChange) => this.source.watch(this.app, onChange), () => {
            void this.handleSourceChange();
        });
        this.registerCleanup(unsubscribe);
    }

    render(): void {
        if (this.isDisposed()) return;
        this.renderInternal();
    }

    protected abstract renderEntry(row: HTMLElement, entry: LibraryEntry<M>): void;

    protected getEmptyMessage(): string {
        return "No entries found.";
    }

    protected getErrorMessage(): string {
        return "Failed to load entries.";
    }

    protected async reloadEntries(): Promise<void> {
        await this.refreshEntries();
        if (!this.isDisposed()) {
            this.render();
        }
    }

    protected getFilterSelection(id: string): string | undefined {
        return this.state.getFilterValue(id);
    }

    private async handleSourceChange(): Promise<void> {
        await this.refreshEntries();
        if (!this.isDisposed()) {
            this.render();
        }
    }

    private async refreshEntries(): Promise<void> {
        try {
            const files = await this.source.list(this.app);
            const entries = await Promise.all(files.map(file => this.source.load(this.app, file)));
            this.entries = entries;
            this.loadError = undefined;
        } catch (err) {
            console.error("Failed to load library entries", err);
            this.entries = [];
            this.loadError = err;
        }
    }

    private renderInternal(): void {
        const token = ++this.renderToken;
        const container = this.container;
        container.empty();

        if (this.loadError) {
            renderFeedback(container, "error", this.getErrorMessage());
            return;
        }

        const filters = this.schema.filters;
        const sorts = this.schema.sorts;
        this.state.ensureSortAvailable(sorts);
        const optionValues = this.collectFilterOptions(this.entries, filters);
        this.state.pruneInvalidFilters(optionValues);

        if (filters.length || sorts.length) {
            this.renderControls(container, filters, sorts, optionValues);
        }

        const query = this.query;
        const prepared: PreparedEntry<M>[] = this.entries.map(entry => ({
            entry,
            score: this.computeSearchScore(entry, query),
        }));

        const filtered = prepared.filter(item => this.state.matches(item.entry, filters));
        const visible = query
            ? filtered.filter(item => item.score > -Infinity)
            : filtered;

        const sortDef = sorts.find(option => option.id === this.state.getSortId()) ?? sorts[0];
        visible.sort((a, b) => {
            if (query && a.score !== b.score) {
                return b.score - a.score;
            }
            let comparison = sortDef ? sortDef.compare(a.entry, b.entry) : a.entry.name.localeCompare(b.entry.name);
            if (comparison === 0) {
                comparison = a.entry.name.localeCompare(b.entry.name);
            }
            return this.state.getSortDirection() === "asc" ? comparison : -comparison;
        });

        if (token !== this.renderToken || this.isDisposed()) {
            return;
        }

        if (!visible.length) {
            renderFeedback(container, "empty", this.getEmptyMessage());
            return;
        }

        for (const item of visible) {
            const row = container.createDiv({ cls: "sm-cc-item" });
            this.renderEntry(row, item.entry);
        }
    }

    private collectFilterOptions(entries: LibraryEntry<M>[], filters: FilterDefinition<M>[]): OptionValues {
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

    private renderControls(
        container: HTMLElement,
        filters: FilterDefinition<M>[],
        sorts: SortDefinition<M>[],
        optionValues: OptionValues,
    ): void {
        const controls = container.createDiv({ cls: "sm-cc-controls" });

        if (filters.length) {
            const filterContainer = controls.createDiv({ cls: "sm-cc-filters" });
            filterContainer.createEl("h4", { text: "Filter", cls: "sm-cc-section-header" });
            const filterContent = filterContainer.createDiv({ cls: "sm-cc-filter-content" });

            for (const filter of filters) {
                const wrapper = filterContent.createDiv({ cls: "sm-cc-filter" });
                wrapper.createEl("label", { text: `${filter.label}: ` });
                const select = wrapper.createEl("select");
                select.createEl("option", { value: "", text: filter.emptyLabel ?? "All" });
                const values = optionValues.get(filter.id) ?? [];
                for (const value of values) {
                    select.createEl("option", { value, text: filter.formatOption ? filter.formatOption(value) : value });
                }
                select.value = this.state.getFilterValue(filter.id) ?? "";
                select.onchange = () => {
                    this.state.setFilterValue(filter.id, select.value);
                    this.render();
                };
            }

            if (this.state.hasFilters()) {
                const clearBtn = filterContent.createEl("button", { text: "Clear filters", cls: "sm-cc-clear-filters" });
                clearBtn.onclick = () => {
                    this.state.clearFilters();
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
            const currentSort = this.state.getSortId();
            if (currentSort) {
                select.value = currentSort;
            }
            select.onchange = () => {
                this.state.setSort(select.value);
                updateDirectionVisuals();
                this.render();
            };

            const directionBtn = sortContent.createEl("button", {
                cls: "sm-cc-sort-direction",
                attr: { "aria-label": this.state.getSortDirection() === "asc" ? "Sort ascending" : "Sort descending" },
            });
            const updateDirectionVisuals = () => {
                directionBtn.innerHTML = this.state.getSortDirection() === "asc" ? "↑" : "↓";
                directionBtn.title = this.state.getSortDirection() === "asc" ? "Ascending" : "Descending";
            };
            updateDirectionVisuals();
            directionBtn.onclick = () => {
                const targetId = this.state.getSortId() ?? sorts[0]?.id;
                if (!targetId) return;
                this.state.setSort(targetId);
                updateDirectionVisuals();
                this.render();
            };
        }
    }

    private computeSearchScore(entry: LibraryEntry<M>, query: string): number {
        if (!query) return 0.0001;
        const candidates = [entry.name, ...this.schema.search(entry)];
        let best = -Infinity;
        for (const candidate of candidates) {
            if (!candidate) continue;
            const score = scoreName(candidate.toLowerCase(), query);
            if (score > best) {
                best = score;
            }
        }
        return best;
    }
}
