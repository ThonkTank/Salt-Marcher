// src/app/main.ts
import { Plugin, WorkspaceLeaf } from "obsidian";
// Legacy views removed (consolidated into Library)
import { EncounterView, VIEW_ENCOUNTER } from "../apps/encounter/view";
import { VIEW_CARTOGRAPHER, CartographerView, openCartographer, detachCartographerLeaves } from "../apps/cartographer";
import { VIEW_LIBRARY, LibraryView } from "../apps/library/view";
import { ensureTerrainFile, loadTerrains, watchTerrains } from "../core/terrain-store";
import { setTerrains } from "../core/terrain";
import { HEX_PLUGIN_CSS } from "./css";

export default class SaltMarcherPlugin extends Plugin {
    private unwatchTerrains?: () => void;
    async onload() {
        // Views
        this.registerView(VIEW_CARTOGRAPHER, (leaf: WorkspaceLeaf) => new CartographerView(leaf));
        this.registerView(VIEW_ENCOUNTER, (leaf: WorkspaceLeaf) => new EncounterView(leaf));
        this.registerView(VIEW_LIBRARY, (leaf: WorkspaceLeaf) => new LibraryView(leaf));

        // Load terrain data and keep it synchronised with the filesystem.
        await ensureTerrainFile(this.app);
        setTerrains(await loadTerrains(this.app));
        this.unwatchTerrains = watchTerrains(this.app, () => {
            /* Views react through events */
        });

        // Ribbons
        this.addRibbonIcon("compass", "Open Cartographer", async () => {
            await openCartographer(this.app);
        });
        this.addRibbonIcon("book", "Open Library", async () => {
            const leaf = this.app.workspace.getLeaf(true);
            await leaf.setViewState({ type: VIEW_LIBRARY, active: true });
            this.app.workspace.revealLeaf(leaf);
        });

        // Commands
        this.addCommand({
            id: "open-cartographer",
            name: "Open Cartographer",
            callback: async () => {
                await openCartographer(this.app);
            },
        });
        this.addCommand({
            id: "open-library",
            name: "Open Library",
            callback: async () => {
                const leaf = this.app.workspace.getLeaf(true);
                await leaf.setViewState({ type: VIEW_LIBRARY, active: true });
                this.app.workspace.revealLeaf(leaf);
            },
        });

        this.injectCss();

    }

    async onunload() {
        this.unwatchTerrains?.();
        await detachCartographerLeaves(this.app);
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
