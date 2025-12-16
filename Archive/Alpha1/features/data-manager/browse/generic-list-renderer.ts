// src/features/data-manager/browse/generic-list-renderer.ts
// Fully generic list renderer for any entity type with filtering, sorting, and search

import type { App } from "obsidian";
import { configurableLogger } from '@services/logging/configurable-logger';

const logger = configurableLogger.forModule("data-manager-list-renderer");
import {
    FilterSortState,
    collectFilterOptions,
    renderFilterSortControls,
    renderWorkmodeFeedback,
    renderWorkmodeList,
} from "./index";
import type {
    BaseEntry,
    DataSource,
    ViewConfig,
    ListSchema,
    GenericListRendererConfig,
    SourceWatcherHub
} from "./browse-types";


interface PreparedEntry<E extends BaseEntry> {
    entry: E;
    score: number;
}

/**
 * Fully generic list renderer that works for any entity type.
 * Supports filtering, sorting, searching, and custom actions.
 *
 * @template M - Mode identifier type (e.g., "creatures" | "spells")
 * @template E - Entry type extending BaseEntry
 * @template C - Action context type (defaults to any)
 */
export class GenericListRenderer<M extends string, E extends BaseEntry, C = any> {
    readonly mode: M;
    query = "";

    private readonly source: DataSource<M, E>;
    private readonly schema: ListSchema<E>;
    private readonly viewConfig: ViewConfig<E, C>;
    private readonly watchers: SourceWatcherHub<M>;
    private readonly state: FilterSortState<E>;
    private entries: E[] = [];
    private loadError?: unknown;
    private renderToken = 0;
    private disposed = false;
    private cleanups: Array<() => void> = [];

    constructor(
        private readonly app: App,
        private readonly container: HTMLElement,
        config: GenericListRendererConfig<M, E, C>
    ) {
        this.mode = config.mode;
        this.source = config.source;
        this.schema = config.schema;
        this.viewConfig = config.viewConfig;
        this.watchers = config.watchers;
        this.state = new FilterSortState<E>();
    }

    async init(): Promise<void> {
        await this.refreshEntries();
        if (this.disposed) return;

        const unsubscribe = this.watchers.subscribe(
            this.mode,
            (onChange) => this.source.watch(this.app, onChange),
            () => void this.handleSourceChange()
        );
        this.registerCleanup(unsubscribe);
    }

    render(): void {
        if (this.disposed) return;
        this.renderInternal();
    }

    setQuery(query: string): void {
        this.query = query.toLowerCase();
    }

    destroy(): void {
        this.disposed = true;
        for (const cleanup of this.cleanups) {
            cleanup();
        }
        this.cleanups = [];
    }

    isDisposed(): boolean {
        return this.disposed;
    }

    registerCleanup(fn: () => void): void {
        this.cleanups.push(fn);
    }

    private createActionContext(): C {
        return {
            app: this.app,
            reloadEntries: () => this.reloadEntries(),
            getRenderer: () => this.viewConfig,
            getFilterSelection: (id) => this.getFilterSelection(id),
        } as C;
    }

    async handleCreate(name: string): Promise<void> {
        const context = this.createActionContext();
        await this.viewConfig.handleCreate(context, name);
    }

    private async reloadEntries(): Promise<void> {
        await this.refreshEntries();
        if (!this.disposed) {
            this.render();
        }
    }

    private getFilterSelection(id: string): string | undefined {
        return this.state.getFilterValue(id);
    }

    private async handleSourceChange(): Promise<void> {
        await this.refreshEntries();
        if (!this.disposed) {
            this.render();
        }
    }

    private async refreshEntries(): Promise<void> {
        try {
            const files = await this.source.list(this.app);
            logger.debug(`[library:${this.mode}] Found ${files.length} files`);
            const entries = await Promise.all(files.map(file => this.source.load(this.app, file)));
            logger.debug(`[library:${this.mode}] Loaded ${entries.length} entries`);
            this.entries = entries;
            this.loadError = undefined;
        } catch (err) {
            logger.error(`Failed to load entries`, err);
            this.entries = [];
            this.loadError = err;
        }
    }

    private renderInternal(): void {
        const token = ++this.renderToken;
        const container = this.container;
        container.empty();

        if (this.loadError) {
            renderWorkmodeFeedback(container, "error", "Failed to load entries.");
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
        const prepared: PreparedEntry<E>[] = this.entries.map(entry => ({
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

        if (token !== this.renderToken || this.disposed) {
            return;
        }

        const entriesToRender = visible.map(item => item.entry);

        logger.debug(`[library:${this.mode}] Rendering ${entriesToRender.length} entries (filtered from ${this.entries.length} total)`);

        if (!entriesToRender.length) {
            renderWorkmodeFeedback(container, "empty", "No entries found.");
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

    private computeSearchScore(entry: E, query: string): number {
        if (!query) return 0.0001;
        const candidates = [entry.name, ...this.schema.search(entry)];
        let best = -Infinity;
        for (const candidate of candidates) {
            if (!candidate) continue;
            const score = this.scoreName(candidate.toLowerCase(), query);
            if (score > best) {
                best = score;
            }
        }
        return best;
    }

    private scoreName(candidate: string, query: string): number {
        if (candidate.includes(query)) {
            return candidate.startsWith(query) ? 2 : 1;
        }
        return -Infinity;
    }
}
