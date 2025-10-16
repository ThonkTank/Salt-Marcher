// src/workmodes/library/view/filterable-mode.ts
// Zentraler Renderer für filterbare Library-Listen auf Basis konfigurierbarer Schemata.
import type { App } from "obsidian";
import { BaseModeRenderer, scoreName, LibrarySourceWatcherHub } from "./mode";
import { LIBRARY_DATA_SOURCES, type FilterableLibraryMode, type LibraryEntry, type LibraryDataSource } from "../core/data-sources";
import { LIBRARY_LIST_SCHEMAS, type FilterDefinition, type SortDefinition, type LibraryListSchema } from "./filter-registry";
import { LIBRARY_VIEW_CONFIGS, type LibraryViewConfig, type LibraryActionContext } from "./view-registry";
import {
    FilterSortState,
    collectFilterOptions,
    renderFilterSortControls,
    renderWorkmodeFeedback,
    renderWorkmodeList,
} from "../../../ui";

interface PreparedEntry<M extends FilterableLibraryMode> {
    entry: LibraryEntry<M>;
    score: number;
}

export abstract class FilterableLibraryRenderer<M extends FilterableLibraryMode> extends BaseModeRenderer {
    readonly mode: M;
    private readonly source: LibraryDataSource<M>;
    private readonly schema: LibraryListSchema<M>;
    private readonly viewConfig: LibraryViewConfig<M>;
    private readonly state: FilterSortState<LibraryEntry<M>>;
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
        this.viewConfig = LIBRARY_VIEW_CONFIGS[mode] as LibraryViewConfig<M>;
        this.state = new FilterSortState<LibraryEntry<M>>();
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

    private createActionContext(): LibraryActionContext<M> {
        return {
            app: this.app,
            reloadEntries: () => this.reloadEntries(),
            getRenderer: () => this.viewConfig,
            getFilterSelection: (id) => this.getFilterSelection(id),
        };
    }

    async handleCreate(name: string): Promise<void> {
        const context = this.createActionContext();
        await this.viewConfig.handleCreate(context, name);
    }

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
            renderWorkmodeFeedback(container, "error", this.getErrorMessage());
            return;
        }

        const filters = this.schema.filters;
        const sorts = this.schema.sorts;
        this.state.ensureSortAvailable(sorts);
        const optionValues = collectFilterOptions(this.entries, filters);
        this.state.pruneInvalidFilters(optionValues);

        if (filters.length || sorts.length) {
            renderFilterSortControls({
                container,
                filters,
                sorts,
                optionValues,
                state: this.state,
                onChange: () => this.render(),
            });
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

        const entriesToRender = visible.map(item => item.entry);

        if (!entriesToRender.length) {
            renderWorkmodeFeedback(container, "empty", this.getEmptyMessage());
            return;
        }

        const actionContext = this.createActionContext();
        renderWorkmodeList({
            container,
            entries: entriesToRender,
            getName: (entry) => entry.name,
            metadata: this.viewConfig.metadataFields,
            actions: this.viewConfig.actions,
            actionContext,
        });
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
