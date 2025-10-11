// src/apps/atlas/view.ts
import { ItemView, WorkspaceLeaf } from "obsidian";
import type { App } from "obsidian";
import type { AtlasMode } from "./view/mode";
import type { AtlasModeRenderer } from "./view/mode";
import { TerrainsRenderer } from "./view/terrains";
import { RegionsRenderer } from "./view/regions";
import { ensureTerrainFile, TERRAIN_FILE } from "../../core/terrain-store";
import { ensureRegionsFile, REGIONS_FILE } from "../../core/regions-store";
import { createWorkmodeHeader, type TabConfig, type WorkmodeHeaderHandle } from "../../ui/workmode";

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
    private header?: WorkmodeHeaderHandle<AtlasMode>;
    private listEl?: HTMLElement;
    private descEl?: HTMLElement;
    private activeRenderer?: AtlasModeRenderer;

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
        this.header?.destroy();
        this.header = undefined;
        this.contentEl.removeClass("sm-atlas");
    }

    private renderShell() {
        const root = this.contentEl; root.empty();
        const tabs: TabConfig<AtlasMode>[] = [
            { id: "terrains", label: ATLAS_COPY.modes.terrains },
            { id: "regions", label: ATLAS_COPY.modes.regions },
        ];

        this.header = createWorkmodeHeader(root, {
            title: ATLAS_COPY.title,
            tabs: {
                items: tabs,
                active: this.mode,
                className: "sm-lib-header",
                onSelect: (mode) => { void this.activateMode(mode); },
            },
            search: {
                placeholder: ATLAS_COPY.searchPlaceholder,
                value: this.getQueryForMode(this.mode),
                onChange: (value) => {
                    this.queries.set(this.mode, value);
                    this.activeRenderer?.setQuery(value);
                },
            },
            action: {
                label: ATLAS_COPY.createButton,
                onClick: (value) => { void this.onCreate(value); },
            },
        });

        this.descEl = root.createDiv({ cls: "desc" });
        this.listEl = root.createDiv({ cls: "sm-cc-list" });
    }

    private async activateMode(mode: AtlasMode) {
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
        this.header?.focusSearch();
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
