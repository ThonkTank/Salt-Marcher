// src/workmodes/library/view.ts
import { ItemView, WorkspaceLeaf } from "obsidian";
import type { App } from "obsidian";
import type { GenericListRendererConfig, SourceWatcherHub } from "../../features/data-manager";
import { GenericListRenderer } from "../../features/data-manager";
import { WatcherHub } from "../../ui/utils/watcher-hub";
import { LIBRARY_DATA_SOURCES, type FilterableLibraryMode, type LibraryEntry } from "./storage/data-sources";
import { LIBRARY_LIST_SCHEMAS, LIBRARY_VIEW_CONFIGS } from "./entities/registry";
import type { LibraryActionContext } from "./entities/creatures/view-config";
import { describeLibrarySource, ensureLibrarySources } from "./core/sources";
import { createWorkmodeHeader, type WorkmodeHeaderHandle, type TabConfig } from "../../ui";

type Mode = FilterableLibraryMode;
type ModeRenderer = GenericListRenderer<Mode, LibraryEntry<Mode>, LibraryActionContext>;

/**
 * Library-specific watcher hub for coordinating file system watchers.
 * Typed wrapper around the generic WatcherHub.
 */
class LibrarySourceWatcherHub implements SourceWatcherHub<Mode> {
    private readonly hub = new WatcherHub<Mode>();

    subscribe(source: Mode, factory: (onChange: () => void) => () => void, listener: () => void): () => void {
        return this.hub.subscribe(source, factory, listener);
    }

    destroy(): void {
        this.hub.destroy();
    }
}

/**
 * Authoritative UI copy for the library view. Keep aligned with `docs/ui/terminology.md`.
 */
export const LIBRARY_COPY = {
    title: "Library",
    searchPlaceholder: "Search the library or enter a name…",
    createButton: "Create entry",
    modes: {
        creatures: "Creatures",
        spells: "Spells",
        items: "Items",
        equipment: "Equipment",
    },
    sources: {
        prefix: "Source: ",
    },
} as const;

type ModeCopy = typeof LIBRARY_COPY.modes;

export const VIEW_LIBRARY = "salt-library";

const LIBRARY_VIEW_SOURCES: Mode[] = ["creatures", "spells", "items", "equipment"];

export class LibraryView extends ItemView {
    private mode: Mode = "creatures";
    private queries = new Map<Mode, string>();
    private header?: WorkmodeHeaderHandle<Mode>;
    private listEl?: HTMLElement;
    private descEl?: HTMLElement;
    private activeRenderer?: ModeRenderer;
    private readonly watchers = new LibrarySourceWatcherHub();

    getViewType() { return VIEW_LIBRARY; }
    getDisplayText() { return LIBRARY_COPY.title; }
    getIcon() { return "library" as any; }

    async onOpen() {
        this.contentEl.addClass("sm-library");
        await ensureLibrarySources(this.app, LIBRARY_VIEW_SOURCES);
        this.renderShell();
        await this.activateMode(this.mode);
    }

    async onClose() {
        await this.activeRenderer?.destroy();
        this.activeRenderer = undefined;
        this.header?.destroy();
        this.header = undefined;
        this.watchers.destroy();
        this.contentEl.removeClass("sm-library");
    }

    private renderShell() {
        const root = this.contentEl; root.empty();
        const tabs: TabConfig<Mode>[] = [
            { id: "creatures", label: LIBRARY_COPY.modes.creatures },
            { id: "spells", label: LIBRARY_COPY.modes.spells },
            { id: "items", label: LIBRARY_COPY.modes.items },
            { id: "equipment", label: LIBRARY_COPY.modes.equipment },
        ];

        this.header = createWorkmodeHeader(root, {
            title: LIBRARY_COPY.title,
            tabs: {
                items: tabs,
                active: this.mode,
                className: "sm-lib-header",
                onSelect: (mode) => { void this.activateMode(mode); },
            },
            search: {
                placeholder: LIBRARY_COPY.searchPlaceholder,
                value: this.getQueryForMode(this.mode),
                onChange: (value) => {
                    this.queries.set(this.mode, value);
                    this.activeRenderer?.setQuery(value);
                },
            },
            action: {
                label: LIBRARY_COPY.createButton,
                onClick: (value) => { void this.onCreate(value); },
            },
        });

        // Source description
        this.descEl = root.createDiv({ cls: "desc" });

        // List container
        this.listEl = root.createDiv({ cls: "sm-cc-list" });
    }

    private async activateMode(mode: Mode) {
        if (this.activeRenderer?.mode === mode) {
            this.mode = mode;
            this.header?.setActiveTab(mode);
            this.updateSourceDescription();
            const query = this.getQueryForMode(mode);
            this.header?.setSearchValue(query);
            this.activeRenderer.setQuery(query);
            this.activeRenderer.render();
            return;
        }
        if (this.activeRenderer) {
            await this.activeRenderer.destroy();
            this.activeRenderer = undefined;
        }
        this.mode = mode;
        this.header?.setActiveTab(mode);
        this.updateSourceDescription();
        if (!this.listEl) return;
        const renderer = this.createRenderer(mode, this.listEl);
        this.activeRenderer = renderer;
        await renderer.init();
        const query = this.getQueryForMode(mode);
        this.header?.setSearchValue(query);
        renderer.setQuery(query);
        renderer.render();
    }

    private createRenderer(mode: Mode, container: HTMLElement): ModeRenderer {
        const config: GenericListRendererConfig<Mode, LibraryEntry<Mode>, LibraryActionContext> = {
            mode,
            source: LIBRARY_DATA_SOURCES[mode],
            schema: LIBRARY_LIST_SCHEMAS[mode],
            viewConfig: LIBRARY_VIEW_CONFIGS[mode],
            watchers: this.watchers as SourceWatcherHub<Mode>,
        };
        return new GenericListRenderer(this.app, container, config);
    }

    private updateSourceDescription() {
        if (!this.descEl) return;
        const text = `${LIBRARY_COPY.sources.prefix}${describeLibrarySource(this.mode)}`;
        this.descEl.setText(text);
    }

    private async onCreate(name: string) {
        if (!name && this.mode !== "creatures" && this.mode !== "spells" && this.mode !== "items") return;
        if (!this.activeRenderer) return;
        if (this.activeRenderer.handleCreate) {
            await this.activeRenderer.handleCreate(name);
        }
        this.header?.focusSearch();
    }

    private getQueryForMode(mode: Mode): string {
        return this.queries.get(mode) ?? "";
    }
}

/** Opens the library view in a dedicated workspace leaf. */
export async function openLibrary(app: App): Promise<void> {
    const leaf = app.workspace.getLeaf(true);
    await leaf.setViewState({ type: VIEW_LIBRARY, active: true });
    app.workspace.revealLeaf(leaf);
}
