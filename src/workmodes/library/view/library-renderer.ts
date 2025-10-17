// src/workmodes/library/view/library-renderer.ts
// Generic renderer for all library entities (creatures, spells, items, equipment)

import type { App } from "obsidian";
import type { FilterableLibraryMode, LibraryEntry } from "../storage/data-sources";
import type { LibraryDataSource } from "../storage/data-sources";
import type { LibraryListSchema } from "../../../features/data-manager/browse/schema-builder";
import type { LibraryViewConfig, LibraryActionContext } from "../entities/creatures/view-config";

import { LIBRARY_DATA_SOURCES } from "../storage/data-sources";
import { LIBRARY_VIEW_CONFIGS, LIBRARY_LIST_SCHEMAS } from "../entities/registry";

import {
    FilterSortState,
    collectFilterOptions,
    renderFilterSortControls,
    renderWorkmodeFeedback,
    renderWorkmodeList,
} from "../../../features/data-manager/browse";

interface PreparedEntry<M extends FilterableLibraryMode> {
    entry: LibraryEntry<M>;
    score: number;
}

export interface BaseModeRenderer {
    query: string;
    init(): Promise<void>;
    render(): void;
    destroy(): void;
    isDisposed(): boolean;
    registerCleanup(fn: () => void): void;
}

export interface LibrarySourceWatcherHub {
    subscribe(
        mode: FilterableLibraryMode,
        watch: (onChange: () => void) => () => void,
        onChange: () => void
    ): () => void;
}

/**
 * Generic library renderer that works for any entity type.
 * Replaces the per-entity renderers (CreaturesRenderer, SpellsRenderer, etc.)
 */
export class LibraryRenderer<M extends FilterableLibraryMode> {
    readonly mode: M;
    query = "";

    private readonly source: LibraryDataSource<M>;
    private readonly schema: LibraryListSchema<LibraryEntry<M>>;
    private readonly viewConfig: LibraryViewConfig;
    private readonly state: FilterSortState<LibraryEntry<M>>;
    private entries: LibraryEntry<M>[] = [];
    private loadError?: unknown;
    private renderToken = 0;
    private disposed = false;
    private cleanups: Array<() => void> = [];

    constructor(
        private readonly app: App,
        private readonly container: HTMLElement,
        private readonly watchers: LibrarySourceWatcherHub,
        mode: M,
    ) {
        this.mode = mode;
        this.source = LIBRARY_DATA_SOURCES[mode] as LibraryDataSource<M>;
        this.schema = LIBRARY_LIST_SCHEMAS[mode];
        this.viewConfig = LIBRARY_VIEW_CONFIGS[mode];
        this.state = new FilterSortState<LibraryEntry<M>>();
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

    private createActionContext(): LibraryActionContext {
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
            const entries = await Promise.all(files.map(file => this.source.load(this.app, file)));
            this.entries = entries;
            this.loadError = undefined;
        } catch (err) {
            console.error(`[library] Failed to load ${this.mode} entries`, err);
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

        if (token !== this.renderToken || this.disposed) {
            return;
        }

        const entriesToRender = visible.map(item => item.entry);

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

    private computeSearchScore(entry: LibraryEntry<M>, query: string): number {
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
