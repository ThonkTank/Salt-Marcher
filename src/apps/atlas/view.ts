// src/apps/atlas/view.ts
import { ItemView, WorkspaceLeaf } from "obsidian";
import type { App } from "obsidian";
import type { AtlasMode } from "./view/mode";
import type { AtlasModeRenderer } from "./view/mode";
import { TerrainsRenderer } from "./view/terrains";
import { RegionsRenderer } from "./view/regions";
import { ensureTerrainFile, TERRAIN_FILE } from "../../core/terrain-store";
import { ensureRegionsFile, REGIONS_FILE } from "../../core/regions-store";
import { createTabNavigation, type TabConfig, type TabNavigationHandle } from "../../ui/workmode";

/**
 * UI copy for the atlas view covering terrains and regions.
 */
export const ATLAS_COPY = {
    title: "Atlas",
    searchPlaceholder: "Search terrains and regions…",
    createButton: "Create entry",
    modes: {
        terrains: "Terrains",
        regions: "Regions",
    },
    sources: {
        prefix: "Source: ",
        terrains: TERRAIN_FILE,
        regions: REGIONS_FILE,
    },
} as const;

export const VIEW_ATLAS = "salt-atlas";

export class AtlasView extends ItemView {
    private mode: AtlasMode = "terrains";
    private queries = new Map<AtlasMode, string>();
    private tabNav?: TabNavigationHandle<AtlasMode>;
    private listEl?: HTMLElement;
    private descEl?: HTMLElement;
    private activeRenderer?: AtlasModeRenderer;
    private searchInput?: HTMLInputElement;

    getViewType() { return VIEW_ATLAS; }
    getDisplayText() { return ATLAS_COPY.title; }
    getIcon() { return "map" as const; }

    async onOpen() {
        this.contentEl.addClass("sm-atlas");
        await Promise.all([
            ensureTerrainFile(this.app),
            ensureRegionsFile(this.app),
        ]);
        this.renderShell();
        await this.activateMode(this.mode);
    }

    async onClose() {
        await this.activeRenderer?.destroy();
        this.activeRenderer = undefined;
        this.tabNav?.destroy();
        this.contentEl.removeClass("sm-atlas");
    }

    private renderShell() {
        const root = this.contentEl; root.empty();
        root.createEl("h2", { text: ATLAS_COPY.title });

        const tabs: TabConfig<AtlasMode>[] = [
            { id: "terrains", label: ATLAS_COPY.modes.terrains },
            { id: "regions", label: ATLAS_COPY.modes.regions },
        ];

        this.tabNav = createTabNavigation(root, {
            tabs,
            activeTab: this.mode,
            className: "sm-atlas-header",
            onSelect: (mode) => { void this.activateMode(mode); },
        });

        const bar = root.createDiv({ cls: "sm-cc-searchbar" });
        const search = bar.createEl("input", { attr: { type: "text", placeholder: ATLAS_COPY.searchPlaceholder } }) as HTMLInputElement;
        search.value = this.getQueryForMode(this.mode);
        search.oninput = () => {
            const trimmed = search.value.trim();
            this.queries.set(this.mode, trimmed);
            this.activeRenderer?.setQuery(trimmed);
        };
        this.searchInput = search;

        const createBtn = bar.createEl("button", { text: ATLAS_COPY.createButton });
        createBtn.onclick = () => { void this.onCreate(search.value.trim()); };

        this.descEl = root.createDiv({ cls: "desc" });
        this.listEl = root.createDiv({ cls: "sm-cc-list" });
    }

    private async activateMode(mode: AtlasMode) {
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

    private createRenderer(mode: AtlasMode, container: HTMLElement): AtlasModeRenderer {
        switch (mode) {
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
        const source = this.mode === "terrains"
            ? ATLAS_COPY.sources.terrains
            : ATLAS_COPY.sources.regions;
        this.descEl.setText(`${ATLAS_COPY.sources.prefix}${source}`);
    }

    private async onCreate(name: string) {
        if (!this.activeRenderer) return;
        if (this.activeRenderer.handleCreate) {
            await this.activeRenderer.handleCreate(name);
        }
        this.searchInput?.focus();
    }

    private getQueryForMode(mode: AtlasMode): string {
        return this.queries.get(mode) ?? "";
    }
}

/** Opens the atlas view in a dedicated workspace leaf. */
export async function openAtlas(app: App): Promise<void> {
    const leaf = app.workspace.getLeaf(true);
    await leaf.setViewState({ type: VIEW_ATLAS, active: true });
    app.workspace.revealLeaf(leaf);
}
