// src/features/data-manager/browse/tabbed-browse-view.ts
// Generic tab-based browse view for entity collections
// Eliminates workmode-specific boilerplate by providing a reusable pattern

import { ItemView } from "obsidian";
import type { App , WorkspaceLeaf } from "obsidian";
import { WatcherHub } from "@ui/utils/watcher-hub";
import { GenericListRenderer } from "./generic-list-renderer";
import { createWorkmodeHeader, type WorkmodeHeaderHandle, type TabConfig } from "./workmode-header";
import type { GenericListRendererConfig, BaseEntry, DataSource, ViewConfig, ListSchema } from "./browse-types";

/**
 * Configuration for a single mode/tab in a tabbed browse view
 */
export interface ModeConfig<M extends string> {
    readonly id: M;
    readonly label: string;
}

/**
 * UI copy/text configuration for tabbed browse view
 */
export interface TabbedBrowseCopy<M extends string> {
    readonly title: string;
    readonly searchPlaceholder: string;
    readonly createButton: string;
    readonly modes: Record<M, string>;
    readonly sources?: {
        readonly prefix: string;
    };
}

/**
 * Complete configuration for TabbedBrowseView
 */
export interface TabbedBrowseViewConfig<M extends string, E extends BaseEntry, C = any> {
    readonly viewType: string;
    readonly icon: string;
    readonly copy: TabbedBrowseCopy<M>;
    readonly defaultMode: M;
    readonly modes: readonly M[];
    readonly dataSources: Record<M, DataSource<M, E>>;
    readonly schemas: Record<M, ListSchema<E>>;
    readonly viewConfigs: Record<M, ViewConfig<E, C>>;
    readonly ensureSources?: (app: App, modes: M[]) => Promise<void>;
    readonly describeSource?: (mode: M) => string;
}

/**
 * Generic tab-based browse view for entity collections.
 * Provides tab navigation, search, filtering, and CRUD operations
 * through a fully configurable, reusable pattern.
 *
 * @template M - Mode identifier type (e.g., "creatures" | "spells")
 * @template E - Entry type extending BaseEntry
 * @template C - Action context type
 *
 * @example
 * ```typescript
 * export class LibraryView extends TabbedBrowseView<
 *     FilterableLibraryMode,
 *     LibraryEntry<FilterableLibraryMode>,
 *     LibraryActionContext
 * > {
 *     private static readonly LIBRARY_CONFIG = {
 *         viewType: "salt-library",
 *         icon: "library",
 *         copy: LIBRARY_COPY,
 *         defaultMode: "creatures" as const,
 *         modes: ["creatures", "spells", "items", "equipment"] as const,
 *         dataSources: LIBRARY_DATA_SOURCES,
 *         schemas: LIBRARY_LIST_SCHEMAS,
 *         viewConfigs: LIBRARY_VIEW_CONFIGS,
 *     };
 *
 *     protected get config() {
 *         return LibraryView.LIBRARY_CONFIG;
 *     }
 *
 *     constructor(leaf: WorkspaceLeaf) {
 *         super(leaf);
 *     }
 * }
 * ```
 */
export abstract class TabbedBrowseView<M extends string, E extends BaseEntry, C = any> extends ItemView {
    protected abstract readonly config: TabbedBrowseViewConfig<M, E, C>;
    protected mode: M;
    protected queries = new Map<M, string>();
    protected header?: WorkmodeHeaderHandle<M>;
    protected listEl?: HTMLElement;
    protected descEl?: HTMLElement;
    protected activeRenderer?: GenericListRenderer<M, E, C>;
    protected readonly watchers = new WatcherHub<M>();

    constructor(leaf: WorkspaceLeaf) {
        super(leaf);
        this.mode = this.config.defaultMode;
    }

    getViewType(): string {
        return this.config.viewType;
    }

    getDisplayText(): string {
        return this.config.copy.title;
    }

    getIcon(): string {
        return this.config.icon as any;
    }

    async onOpen() {
        this.contentEl.addClass("sm-browsable-view");

        // Render shell immediately for fast UI
        this.renderShell();

        // Activate mode (will ensure sources lazily)
        await this.activateMode(this.mode);
    }

    async onClose() {
        await this.activeRenderer?.destroy();
        this.activeRenderer = undefined;
        this.header?.destroy();
        this.header = undefined;
        this.watchers.destroy();
        this.contentEl.removeClass("sm-browsable-view");
    }

    /**
     * Renders the shell UI (header, tabs, containers)
     */
    protected renderShell() {
        const root = this.contentEl;
        root.empty();

        // Build tab configuration
        const tabs: TabConfig<M>[] = this.config.modes.map(id => ({
            id,
            label: this.config.copy.modes[id],
        }));

        // Create header with tabs, search, and create action
        this.header = createWorkmodeHeader(root, {
            title: this.config.copy.title,
            tabs: {
                items: tabs,
                active: this.mode,
                className: "sm-browse-header",
                onSelect: (mode) => {
                    // Update UI synchronously FIRST (immediate visual feedback)
                    this.mode = mode;
                    this.header?.setActiveTab(mode);
                    this.updateSourceDescription();
                    const query = this.getQueryForMode(mode);
                    this.header?.setSearchValue(query);

                    // Give browser 20ms to paint the green tab BEFORE loading data
                    // This ensures visual feedback appears instantly (< 1 frame @ 60fps)
                    setTimeout(() => {
                        void this.activateModeAsync(mode, query);
                    }, 20);
                },
            },
            search: {
                placeholder: this.config.copy.searchPlaceholder,
                value: this.getQueryForMode(this.mode),
                onChange: (value) => {
                    this.queries.set(this.mode, value);
                    this.activeRenderer?.setQuery(value);
                    this.activeRenderer?.render();
                },
            },
            action: {
                label: this.config.copy.createButton,
                onClick: (value) => { void this.onCreate(value); },
            },
        });

        // Source description (optional)
        if (this.config.describeSource) {
            const prefix = this.config.copy.sources?.prefix ?? "";
            this.descEl = root.createDiv({ cls: "desc" });
        }

        // List container
        this.listEl = root.createDiv({ cls: "sm-cc-list" });
    }

    /**
     * Activates a specific mode/tab (called from onOpen with initial mode)
     */
    protected async activateMode(mode: M) {
        // Update UI immediately
        this.mode = mode;
        this.header?.setActiveTab(mode);
        this.updateSourceDescription();
        const query = this.getQueryForMode(mode);
        this.header?.setSearchValue(query);

        // Load data
        await this.activateModeAsync(mode, query);
    }

    /**
     * Async part of mode activation (data loading)
     */
    private async activateModeAsync(mode: M, query: string) {
        // If already active with same mode, just re-render
        if (this.activeRenderer?.mode === mode) {
            this.activeRenderer.setQuery(query);
            this.activeRenderer.render();
            return;
        }

        // Destroy previous renderer
        if (this.activeRenderer) {
            await this.activeRenderer.destroy();
            this.activeRenderer = undefined;
        }

        if (!this.listEl) return;

        // Ensure data source exists for this mode only (lazy)
        if (this.config.ensureSources) {
            await this.config.ensureSources(this.app, [mode]);
        }

        // Create and initialize new renderer
        const renderer = this.createRenderer(mode, this.listEl);
        this.activeRenderer = renderer;
        await renderer.init();

        // Apply search query and render
        renderer.setQuery(query);
        renderer.render();
    }

    /**
     * Creates a renderer for the specified mode
     */
    protected createRenderer(mode: M, container: HTMLElement): GenericListRenderer<M, E, C> {
        const rendererConfig: GenericListRendererConfig<M, E, C> = {
            mode,
            source: this.config.dataSources[mode],
            schema: this.config.schemas[mode],
            viewConfig: this.config.viewConfigs[mode],
            watchers: this.watchers,
        };
        return new GenericListRenderer(this.app, container, rendererConfig);
    }

    /**
     * Updates the source description text
     */
    protected updateSourceDescription() {
        if (!this.descEl || !this.config.describeSource) return;
        const prefix = this.config.copy.sources?.prefix ?? "";
        const description = this.config.describeSource(this.mode);
        this.descEl.setText(`${prefix}${description}`);
    }

    /**
     * Handles create action (when user submits create form)
     */
    protected async onCreate(name: string) {
        if (!this.activeRenderer) return;
        if (this.activeRenderer.handleCreate) {
            await this.activeRenderer.handleCreate(name);
        }
        this.header?.focusSearch();
    }

    /**
     * Gets the search query for a specific mode
     */
    protected getQueryForMode(mode: M): string {
        return this.queries.get(mode) ?? "";
    }
}
