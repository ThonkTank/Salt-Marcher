// src/app/main.ts
import { Plugin, WorkspaceLeaf } from "obsidian";
import { VIEW_TYPE_HEX_GALLERY, HexGalleryView } from "../apps/map-gallery";
import { VIEW_TYPE_MAP_EDITOR, MapEditorView } from "../apps/map-editor";
import { TerrainEditorView, VIEW_TERRAIN_EDITOR } from "../apps/terrain-editor/view";
import { VIEW_TRAVEL_GUIDE, TravelGuideView } from "../apps/travel-guide";
import { ensureTerrainFile, loadTerrains, watchTerrains } from "../apps/terrain-editor/terrain-store";
import { setTerrains } from "../core/terrain";
import { HEX_PLUGIN_CSS } from "./css";

export default class SaltMarcherPlugin extends Plugin {
    private unwatchTerrains?: () => void;

    async onload() {
        // Views
        this.registerView(VIEW_TYPE_HEX_GALLERY, (leaf) => new HexGalleryView(leaf));
        this.registerView(VIEW_TYPE_MAP_EDITOR,  (leaf) => new MapEditorView(leaf));
        this.registerView(VIEW_TERRAIN_EDITOR,   (leaf: WorkspaceLeaf) => new TerrainEditorView(leaf));
        this.registerView(VIEW_TRAVEL_GUIDE,     (leaf: WorkspaceLeaf) => new TravelGuideView(leaf));

        // Terrains initial laden & live halten
        await ensureTerrainFile(this.app);
        setTerrains(await loadTerrains(this.app));
        this.unwatchTerrains = watchTerrains(this.app, () => { /* Views reagieren via Event */ });

        // Ribbons
        this.addRibbonIcon("images", "Open Map Gallery", async () => {
            const leaf = this.app.workspace.getRightLeaf(false);
            await leaf.setViewState({ type: VIEW_TYPE_HEX_GALLERY, active: true });
            this.app.workspace.revealLeaf(leaf);
        });

        const terrainRibbon = this.addRibbonIcon("palette", "Open Terrain Editor", async () => {
            const leaf = this.app.workspace.getLeaf(true);
            await leaf.setViewState({ type: VIEW_TERRAIN_EDITOR, active: true });
            this.app.workspace.revealLeaf(leaf);
        });
        terrainRibbon.addClass("salt-terrain-ribbon");

        this.addRibbonIcon("rocket", "Open Travel Guide", async () => {
            const leaf = this.app.workspace.getLeaf(false);
            await leaf.setViewState({ type: VIEW_TRAVEL_GUIDE, active: true });
            this.app.workspace.revealLeaf(leaf);
        });

        // Commands
        this.addCommand({
            id: "open-map-editor",
            name: "Open Map Editor (empty)",
                        callback: async () => {
                            const leaf = this.app.workspace.getLeaf(true);
                            await leaf.setViewState({ type: VIEW_TYPE_MAP_EDITOR, active: true });
                        },
        });

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
            id: "open-travel-guide",
            name: "Travel Guide öffnen",
            callback: async () => {
                const leaf = this.app.workspace.getLeaf(false);
                await leaf.setViewState({ type: VIEW_TRAVEL_GUIDE, active: true });
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
