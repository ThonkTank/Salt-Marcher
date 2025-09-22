// src/app/main.ts
import { Plugin, WorkspaceLeaf } from "obsidian";
import { TerrainEditorView, VIEW_TERRAIN_EDITOR } from "../apps/terrain-editor/view";
import { VIEW_CARTOGRAPHER, CartographerView } from "../apps/cartographer";
import { ensureTerrainFile, loadTerrains, watchTerrains } from "../core/terrain-store";
import { setTerrains } from "../core/terrain";
import { getCenterLeaf } from "../core/layout";
import { HEX_PLUGIN_CSS } from "./css";

export default class SaltMarcherPlugin extends Plugin {
    private unwatchTerrains?: () => void;

    async onload() {
        // Views
        this.registerView(VIEW_TERRAIN_EDITOR,   (leaf: WorkspaceLeaf) => new TerrainEditorView(leaf));
        this.registerView(VIEW_CARTOGRAPHER,     (leaf: WorkspaceLeaf) => new CartographerView(leaf));

        // Terrains initial laden & live halten
        await ensureTerrainFile(this.app);
        setTerrains(await loadTerrains(this.app));
        this.unwatchTerrains = watchTerrains(this.app, () => { /* Views reagieren via Event */ });

        // Ribbons
        const terrainRibbon = this.addRibbonIcon("palette", "Open Terrain Editor", async () => {
            const leaf = this.app.workspace.getLeaf(true);
            await leaf.setViewState({ type: VIEW_TERRAIN_EDITOR, active: true });
            this.app.workspace.revealLeaf(leaf);
        });
        terrainRibbon.addClass("salt-terrain-ribbon");

        this.addRibbonIcon("compass", "Open Cartographer", async () => {
            const leaf = getCenterLeaf(this.app);
            await leaf.setViewState({ type: VIEW_CARTOGRAPHER, active: true });
            this.app.workspace.revealLeaf(leaf);
        });

        // Commands
        this.addCommand({
            id: "open-terrain-editor",
            name: "Terrain Editor öffnen",
            callback: async () => {
                const leaf = this.app.workspace.getLeaf(true);
                await leaf.setViewState({ type: VIEW_TERRAIN_EDITOR, active: true });
                this.app.workspace.revealLeaf(leaf);
            },
        });

        this.addCommand({
            id: "open-cartographer",
            name: "Cartographer öffnen",
            callback: async () => {
                const leaf = getCenterLeaf(this.app);
                await leaf.setViewState({ type: VIEW_CARTOGRAPHER, active: true });
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
