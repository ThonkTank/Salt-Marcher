// src/apps/library/view.ts
import { ItemView, WorkspaceLeaf } from "obsidian";
import type { App } from "obsidian";
import type { ModeRenderer, Mode } from "./view/mode";
import { LibrarySourceWatcherHub } from "./view/mode";
import { CreaturesRenderer } from "./view/creatures";
import { SpellsRenderer } from "./view/spells";
import { ItemsRenderer } from "./view/items";
import { EquipmentRenderer } from "./view/equipment";
import { TerrainsRenderer } from "./view/terrains";
import { RegionsRenderer } from "./view/regions";
import { describeLibrarySource, ensureLibrarySources } from "./core/sources";
import { createTabNavigation, type TabConfig, type TabNavigationHandle } from "../../ui/workmode";

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
        terrains: "Terrains",
        regions: "Regions",
    },
    sources: {
        prefix: "Source: ",
    },
} as const;

type ModeCopy = typeof LIBRARY_COPY.modes;

export const VIEW_LIBRARY = "salt-library";

export class LibraryView extends ItemView {
    private mode: Mode = "creatures";
    private queries = new Map<Mode, string>();
    private tabNav?: TabNavigationHandle<Mode>;
    private listEl?: HTMLElement;
    private descEl?: HTMLElement;
    private activeRenderer?: ModeRenderer;
    private searchInput?: HTMLInputElement;
    private readonly watchers = new LibrarySourceWatcherHub();

    getViewType() { return VIEW_LIBRARY; }
    getDisplayText() { return LIBRARY_COPY.title; }
    getIcon() { return "library" as any; }

    async onOpen() {
        this.contentEl.addClass("sm-library");
        await ensureLibrarySources(this.app);
        this.renderShell();
        await this.activateMode(this.mode);
    }

    async onClose() {
        await this.activeRenderer?.destroy();
        this.activeRenderer = undefined;
        this.tabNav?.destroy();
        this.watchers.destroy();
        this.contentEl.removeClass("sm-library");
    }

    private renderShell() {
        const root = this.contentEl; root.empty();
        root.createEl("h2", { text: LIBRARY_COPY.title });

        // Tab navigation using shared infrastructure
        const tabs: TabConfig<Mode>[] = [
            { id: "creatures", label: LIBRARY_COPY.modes.creatures },
            { id: "spells", label: LIBRARY_COPY.modes.spells },
            { id: "items", label: LIBRARY_COPY.modes.items },
            { id: "equipment", label: LIBRARY_COPY.modes.equipment },
            { id: "terrains", label: LIBRARY_COPY.modes.terrains },
            { id: "regions", label: LIBRARY_COPY.modes.regions },
        ];

        this.tabNav = createTabNavigation(root, {
            tabs,
            activeTab: this.mode,
            className: "sm-lib-header",
            onSelect: (mode) => { void this.activateMode(mode); },
        });

        // Search + create
        const bar = root.createDiv({ cls: "sm-cc-searchbar" });
        const search = bar.createEl("input", { attr: { type: "text", placeholder: LIBRARY_COPY.searchPlaceholder } }) as HTMLInputElement;
        search.value = this.getQueryForMode(this.mode);
        search.oninput = () => {
            const trimmed = search.value.trim();
            this.queries.set(this.mode, trimmed);
            this.activeRenderer?.setQuery(trimmed);
        };
        this.searchInput = search;
        const createBtn = bar.createEl("button", { text: LIBRARY_COPY.createButton });
        createBtn.onclick = () => { void this.onCreate(search.value.trim()); };

        // Source description
        this.descEl = root.createDiv({ cls: "desc" });

        // List container
        this.listEl = root.createDiv({ cls: "sm-cc-list" });
    }

    private async activateMode(mode: Mode) {
        if (this.activeRenderer?.mode === mode) {
            this.mode = mode;
            this.tabNav?.setActiveTab(mode);
            this.updateSourceDescription();
            const query = this.getQueryForMode(mode);
            if (this.searchInput) this.searchInput.value = query;
            this.activeRenderer.setQuery(query);
            this.activeRenderer.render();
            return;
        }
        if (this.activeRenderer) {
            await this.activeRenderer.destroy();
            this.activeRenderer = undefined;
        }
        this.mode = mode;
        this.tabNav?.setActiveTab(mode);
        this.updateSourceDescription();
        if (!this.listEl) return;
        const renderer = this.createRenderer(mode, this.listEl);
        this.activeRenderer = renderer;
        await renderer.init();
        const query = this.getQueryForMode(mode);
        if (this.searchInput) this.searchInput.value = query;
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
            case "terrains":
                return new TerrainsRenderer(this.app, container);
            case "regions":
                return new RegionsRenderer(this.app, container);
            default:
                throw new Error(`Unsupported mode: ${mode}`);
        }
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
        this.searchInput?.focus();
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
