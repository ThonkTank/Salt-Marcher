// src/apps/library/view.ts
import { ItemView, WorkspaceLeaf } from "obsidian";
import { ensureCreatureDir } from "./core/creature-files";
import { ensureSpellDir } from "./core/spell-files";
import { ensureTerrainFile } from "../../core/terrain-store";
import { ensureRegionsFile } from "../../core/regions-store";
import type { ModeRenderer, Mode } from "./view/mode";
import { CreaturesRenderer } from "./view/creatures";
import { SpellsRenderer } from "./view/spells";
import { TerrainsRenderer, describeTerrainsSource } from "./view/terrains";
import { RegionsRenderer, describeRegionsSource } from "./view/regions";

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
        terrains: "Terrains",
        regions: "Regions",
    },
    sources: {
        prefix: "Source: ",
        creatures: "SaltMarcher/Creatures/",
        spells: "SaltMarcher/Spells/",
    },
} as const;

type ModeCopy = typeof LIBRARY_COPY.modes;

export const VIEW_LIBRARY = "salt-library";

export class LibraryView extends ItemView {
    private mode: Mode = "creatures";
    private query = "";
    private headerButtons = new Map<Mode, HTMLButtonElement>();
    private listEl?: HTMLElement;
    private descEl?: HTMLElement;
    private activeRenderer?: ModeRenderer;
    private searchInput?: HTMLInputElement;

    getViewType() { return VIEW_LIBRARY; }
    getDisplayText() { return LIBRARY_COPY.title; }
    getIcon() { return "library" as any; }

    async onOpen() {
        this.contentEl.addClass("sm-library");
        await Promise.all([
            ensureCreatureDir(this.app),
            ensureSpellDir(this.app),
            ensureTerrainFile(this.app),
            ensureRegionsFile(this.app),
        ]);
        this.renderShell();
        await this.activateMode(this.mode);
    }

    async onClose() {
        await this.activeRenderer?.destroy();
        this.activeRenderer = undefined;
        this.contentEl.removeClass("sm-library");
    }

    private renderShell() {
        const root = this.contentEl; root.empty();
        root.createEl("h2", { text: LIBRARY_COPY.title });

        // Mode header
        const header = root.createDiv({ cls: "sm-lib-header" });
        const mkBtn = (label: ModeCopy[Mode], m: Mode) => {
            const b = header.createEl("button", { text: label });
            this.headerButtons.set(m, b);
            b.onclick = () => { void this.activateMode(m); };
            return b;
        };
        mkBtn(LIBRARY_COPY.modes.creatures, "creatures");
        mkBtn(LIBRARY_COPY.modes.spells, "spells");
        mkBtn(LIBRARY_COPY.modes.terrains, "terrains");
        mkBtn(LIBRARY_COPY.modes.regions, "regions");

        // Search + create
        const bar = root.createDiv({ cls: "sm-cc-searchbar" });
        const search = bar.createEl("input", { attr: { type: "text", placeholder: LIBRARY_COPY.searchPlaceholder } }) as HTMLInputElement;
        search.value = this.query;
        search.oninput = () => {
            this.query = search.value;
            this.activeRenderer?.setQuery(this.query);
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
            this.updateHeaderButtons();
            this.updateSourceDescription();
            this.activeRenderer.setQuery(this.query);
            this.activeRenderer.render();
            return;
        }
        if (this.activeRenderer) {
            await this.activeRenderer.destroy();
            this.activeRenderer = undefined;
        }
        this.mode = mode;
        this.updateHeaderButtons();
        this.updateSourceDescription();
        if (!this.listEl) return;
        const renderer = this.createRenderer(mode, this.listEl);
        this.activeRenderer = renderer;
        await renderer.init();
        renderer.setQuery(this.query);
        renderer.render();
    }

    private createRenderer(mode: Mode, container: HTMLElement): ModeRenderer {
        switch (mode) {
            case "creatures":
                return new CreaturesRenderer(this.app, container);
            case "spells":
                return new SpellsRenderer(this.app, container);
            case "terrains":
                return new TerrainsRenderer(this.app, container);
            case "regions":
                return new RegionsRenderer(this.app, container);
            default:
                throw new Error(`Unsupported mode: ${mode}`);
        }
    }

    private updateHeaderButtons() {
        for (const [mode, btn] of this.headerButtons.entries()) {
            btn.classList.toggle("is-active", this.mode === mode);
        }
    }

    private updateSourceDescription() {
        if (!this.descEl) return;
        const text = this.mode === "creatures"
            ? `${LIBRARY_COPY.sources.prefix}${LIBRARY_COPY.sources.creatures}`
            : this.mode === "spells"
                ? `${LIBRARY_COPY.sources.prefix}${LIBRARY_COPY.sources.spells}`
                : this.mode === "terrains"
                    ? describeTerrainsSource()
                    : describeRegionsSource();
        this.descEl.setText(text);
    }

    private async onCreate(name: string) {
        if (!name && this.mode !== "creatures" && this.mode !== "spells") return;
        if (!this.activeRenderer) return;
        await this.activeRenderer.handleCreate(name);
        this.searchInput?.focus();
    }
}
