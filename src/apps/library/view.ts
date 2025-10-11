// src/apps/library/view.ts
import { ItemView, WorkspaceLeaf } from "obsidian";
import type { App } from "obsidian";
import type { ModeRenderer, Mode } from "./view/mode";
import { LibrarySourceWatcherHub } from "./view/mode";
import { CreaturesRenderer } from "./view/creatures";
import { SpellsRenderer } from "./view/spells";
import { ItemsRenderer } from "./view/items";
import { EquipmentRenderer } from "./view/equipment";
import { describeLibrarySource, ensureLibrarySources } from "./core/sources";
import { createWorkmodeHeader, type TabConfig, type WorkmodeHeaderHandle } from "../../ui/workmode";

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
    private listEl?: HTMLElement;
    private activeRenderer?: ModeRenderer;
    private readonly watchers = new LibrarySourceWatcherHub();
    private header?: WorkmodeHeaderHandle<Mode>;

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
        this.watchers.destroy();
        this.header?.destroy();
        this.header = undefined;
        this.contentEl.removeClass("sm-library");
    }

    private renderShell() {
        const root = this.contentEl; root.empty();
        this.header?.destroy();
        const tabs: TabConfig<Mode>[] = [
            { id: "creatures", label: LIBRARY_COPY.modes.creatures },
            { id: "spells", label: LIBRARY_COPY.modes.spells },
            { id: "items", label: LIBRARY_COPY.modes.items },
            { id: "equipment", label: LIBRARY_COPY.modes.equipment },
        ];

        const header = createWorkmodeHeader(root, {
            title: LIBRARY_COPY.title,
            tabs,
            activeTab: this.mode,
            onSelectTab: (mode) => { void this.activateMode(mode); },
            search: {
                placeholder: LIBRARY_COPY.searchPlaceholder,
                value: this.getQueryForMode(this.mode),
                onInput: (value) => {
                    const trimmed = value.trim();
                    this.queries.set(this.mode, trimmed);
                    this.activeRenderer?.setQuery(trimmed);
                },
                onSubmit: (value) => { void this.onCreate(value.trim()); },
                actionButton: {
                    label: LIBRARY_COPY.createButton,
                    onClick: (value) => { void this.onCreate(value.trim()); },
                },
            },
            description: { text: "" },
        });
        this.header = header;

        // Source description placeholder updated separately
        this.updateSourceDescription();

        // List container
        this.listEl = root.createDiv({ cls: "sm-cc-list" });
    }

    private async activateMode(mode: Mode) {
        if (this.activeRenderer?.mode === mode) {
            this.mode = mode;
            this.header?.setActiveTab(mode);
            this.updateSourceDescription();
            const query = this.getQueryForMode(mode);
            this.header?.updateSearchValue(query);
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
        this.header?.updateSearchValue(query);
        renderer.setQuery(query);
        renderer.render();
    }

    private createRenderer(mode: Mode, container: HTMLElement): ModeRenderer {
        switch (mode) {
            case "creatures":
                return new CreaturesRenderer(this.app, container, this.watchers);
            case "spells":
                return new SpellsRenderer(this.app, container, this.watchers);
            case "items":
                return new ItemsRenderer(this.app, container, this.watchers);
            case "equipment":
                return new EquipmentRenderer(this.app, container, this.watchers);
            default:
                throw new Error(`Unsupported mode: ${mode}`);
        }
    }

    private updateSourceDescription() {
        const text = `${LIBRARY_COPY.sources.prefix}${describeLibrarySource(this.mode)}`;
        this.header?.setDescription(text);
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
