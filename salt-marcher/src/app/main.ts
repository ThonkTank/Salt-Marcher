// src/app/main.ts
import { Plugin, WorkspaceLeaf } from "obsidian";
// Legacy views removed (consolidated into Library)
import { EncounterView, VIEW_ENCOUNTER } from "../apps/encounter/view";
import { VIEW_CARTOGRAPHER, CartographerView, openCartographer, detachCartographerLeaves } from "../apps/cartographer";
import { VIEW_LIBRARY, LibraryView } from "../apps/library/view";
import { HEX_PLUGIN_CSS } from "./css";
import { setupLayoutEditorBridge } from "./layout-editor-bridge";
import {
    createTerrainBootstrap,
    type TerrainBootstrapHandle,
    type TerrainBootstrapLogger,
} from "./bootstrap-services";

export default class SaltMarcherPlugin extends Plugin {
    private terrainBootstrap?: TerrainBootstrapHandle;
    private teardownLayoutBridge?: () => void;
    async onload() {
        // Views
        this.registerView(VIEW_CARTOGRAPHER,         (leaf: WorkspaceLeaf) => new CartographerView(leaf));
        this.registerView(VIEW_ENCOUNTER,            (leaf: WorkspaceLeaf) => new EncounterView(leaf));
        this.registerView(VIEW_LIBRARY,              (leaf: WorkspaceLeaf) => new LibraryView(leaf));

        // Terrains initial laden & live halten
        const terrainLogger: TerrainBootstrapLogger = {
            info: (message: string, context?: Record<string, unknown>) => {
                if (context) {
                    console.info(`[SaltMarcher/bootstrap] ${message}`, context);
                } else {
                    console.info(`[SaltMarcher/bootstrap] ${message}`);
                }
            },
            warn: (message: string, context?: Record<string, unknown>) => {
                if (context) {
                    console.warn(`[SaltMarcher/bootstrap] ${message}`, context);
                } else {
                    console.warn(`[SaltMarcher/bootstrap] ${message}`);
                }
            },
            error: (message: string, context?: Record<string, unknown>) => {
                if (context) {
                    console.error(`[SaltMarcher/bootstrap] ${message}`, context);
                } else {
                    console.error(`[SaltMarcher/bootstrap] ${message}`);
                }
            },
        };

        this.terrainBootstrap = createTerrainBootstrap(this.app, { logger: terrainLogger });
        const primed = await this.terrainBootstrap.start();
        if (!primed) {
            console.warn("[SaltMarcher] Terrain palette could not be initialised; defaults remain active until the vault updates.");
        }

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
            name: "Cartographer öffnen",
            callback: async () => {
                await openCartographer(this.app);
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

        this.injectCss();

        this.teardownLayoutBridge = setupLayoutEditorBridge(this);
    }

    async onunload() {
        this.terrainBootstrap?.stop();
        this.teardownLayoutBridge?.();
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
