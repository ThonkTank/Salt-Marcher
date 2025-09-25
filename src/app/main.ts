// src/app/main.ts
import { Plugin, WorkspaceLeaf } from "obsidian";
// Legacy views removed (consolidated into Library)
import { EncounterView, VIEW_ENCOUNTER } from "../apps/encounter/view";
import { VIEW_CARTOGRAPHER, CartographerView } from "../apps/cartographer";
import { VIEW_LIBRARY, LibraryView } from "../apps/library/view";
import { createLayoutEditorPlugin, LayoutEditorPluginApi } from "../plugins/layout-editor";
import { ensureTerrainFile, loadTerrains, watchTerrains } from "../core/terrain-store";
import { setTerrains } from "../core/terrain";
import { getCenterLeaf } from "../core/layout";
import { HEX_PLUGIN_CSS } from "./css";

export default class SaltMarcherPlugin extends Plugin {
    private unwatchTerrains?: () => void;
    private layoutEditor!: LayoutEditorPluginApi;

    async onload() {
        this.layoutEditor = createLayoutEditorPlugin(this);

        // Views
        this.registerView(VIEW_CARTOGRAPHER,         (leaf: WorkspaceLeaf) => new CartographerView(leaf));
        this.registerView(VIEW_ENCOUNTER,            (leaf: WorkspaceLeaf) => new EncounterView(leaf));
        this.registerView(VIEW_LIBRARY,              (leaf: WorkspaceLeaf) => new LibraryView(leaf));
        this.layoutEditor.registerView();

        // Terrains initial laden & live halten
        await ensureTerrainFile(this.app);
        setTerrains(await loadTerrains(this.app));
        this.unwatchTerrains = watchTerrains(this.app, () => { /* Views reagieren via Event */ });

        // Ribbons
        this.addRibbonIcon("compass", "Open Cartographer", async () => {
            const leaf = getCenterLeaf(this.app);
            await leaf.setViewState({ type: VIEW_CARTOGRAPHER, active: true });
            this.app.workspace.revealLeaf(leaf);
        });
        this.addRibbonIcon("book", "Open Library", async () => {
            const leaf = this.app.workspace.getLeaf(true);
            await leaf.setViewState({ type: VIEW_LIBRARY, active: true });
            this.app.workspace.revealLeaf(leaf);
        });
        this.addRibbonIcon("layout-grid", "Open Layout Editor", async () => {
            const leaf = getCenterLeaf(this.app);
            await leaf.setViewState({ type: this.layoutEditor.viewType, active: true });
            this.app.workspace.revealLeaf(leaf);
        });

        // Commands
        this.addCommand({
            id: "open-cartographer",
            name: "Cartographer öffnen",
            callback: async () => {
                const leaf = getCenterLeaf(this.app);
                await leaf.setViewState({ type: VIEW_CARTOGRAPHER, active: true });
                this.app.workspace.revealLeaf(leaf);
            },
        });
        this.addCommand({
            id: "open-library",
            name: "Library öffnen",
            callback: async () => {
                const leaf = this.app.workspace.getLeaf(true);
                await leaf.setViewState({ type: VIEW_LIBRARY, active: true });
                this.app.workspace.revealLeaf(leaf);
            },
        });
        this.addCommand({
            id: "open-layout-editor",
            name: "Layout Editor öffnen",
            callback: async () => {
                const leaf = getCenterLeaf(this.app);
                await leaf.setViewState({ type: this.layoutEditor.viewType, active: true });
                this.app.workspace.revealLeaf(leaf);
            },
        });

        this.injectCss();
    }

    onunload() {
        this.unwatchTerrains?.();
        this.removeCss();
    }

    private injectCss() {
        const style = document.createElement("style");
        style.id = "hex-css";
        style.textContent = HEX_PLUGIN_CSS;
        document.head.appendChild(style);
    }

    private removeCss() {
        document.getElementById("hex-css")?.remove();
    }
}
