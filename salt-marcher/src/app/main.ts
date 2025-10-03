// src/app/main.ts
import { Plugin, WorkspaceLeaf } from "obsidian";
// Legacy views removed (consolidated into Library)
import { EncounterView, VIEW_ENCOUNTER } from "../apps/encounter/view";
import { VIEW_CARTOGRAPHER, CartographerView, openCartographer, detachCartographerLeaves } from "../apps/cartographer";
import { VIEW_LIBRARY, LibraryView } from "../apps/library/view";
import { ensureTerrainFile, loadTerrains, watchTerrains } from "../core/terrain-store";
import { setTerrains } from "../core/terrain";
import { HEX_PLUGIN_CSS } from "./css";
import { reportIntegrationIssue, type IntegrationId, type IntegrationOperation } from "./integration-telemetry";

export default class SaltMarcherPlugin extends Plugin {
    private unwatchTerrains?: () => void;
    async onload() {
        // Views
        try {
            this.registerView(VIEW_CARTOGRAPHER, (leaf: WorkspaceLeaf) => new CartographerView(leaf));
        } catch (error: unknown) {
            this.failIntegration("register-view", "obsidian:cartographer-view", error, "Cartographer-Ansicht konnte nicht registriert werden. Bitte die Konsole pruefen.");
        }
        try {
            this.registerView(VIEW_ENCOUNTER, (leaf: WorkspaceLeaf) => new EncounterView(leaf));
        } catch (error: unknown) {
            this.failIntegration("register-view", "obsidian:encounter-view", error, "Encounter-Ansicht konnte nicht registriert werden. Bitte die Konsole pruefen.");
        }
        try {
            this.registerView(VIEW_LIBRARY, (leaf: WorkspaceLeaf) => new LibraryView(leaf));
        } catch (error: unknown) {
            this.failIntegration("register-view", "obsidian:library-view", error, "Library-Ansicht konnte nicht registriert werden. Bitte die Konsole pruefen.");
        }

        // Load terrain data and keep it synchronised with the filesystem.
        try {
            await ensureTerrainFile(this.app);
            const palette = await loadTerrains(this.app);
            setTerrains(palette);
        } catch (error: unknown) {
            this.failIntegration("prime-dataset", "obsidian:terrain-palette", error, "Terrain-Daten konnten nicht geladen werden. Bitte die Vault-Dateien pruefen.");
        }
        try {
            this.unwatchTerrains = watchTerrains(this.app, () => {
                /* Views react through events */
            });
        } catch (error: unknown) {
            this.failIntegration("watch-dataset", "obsidian:terrain-palette", error, "Terrain-Aenderungen koennen nicht ueberwacht werden. Bitte die Konsole pruefen.");
        }

        // Ribbons
        try {
            this.addRibbonIcon("compass", "Open Cartographer", async () => {
                try {
                    await openCartographer(this.app);
                } catch (error: unknown) {
                    this.failIntegration("activate-view", "obsidian:cartographer-view", error, "Cartographer konnte nicht geoeffnet werden. Bitte die Konsole pruefen.");
                }
            });
        } catch (error: unknown) {
            this.failIntegration("register-ribbon", "obsidian:cartographer-view", error, "Cartographer-Ribbon konnte nicht erstellt werden. Bitte die Konsole pruefen.");
        }
        try {
            this.addRibbonIcon("book", "Open Library", async () => {
                try {
                    const leaf = this.app.workspace.getLeaf(true);
                    await leaf.setViewState({ type: VIEW_LIBRARY, active: true });
                    this.app.workspace.revealLeaf(leaf);
                } catch (error: unknown) {
                    this.failIntegration("activate-view", "obsidian:library-view", error, "Library konnte nicht geoeffnet werden. Bitte die Konsole pruefen.");
                }
            });
        } catch (error: unknown) {
            this.failIntegration("register-ribbon", "obsidian:library-view", error, "Library-Ribbon konnte nicht erstellt werden. Bitte die Konsole pruefen.");
        }

        // Commands
        try {
            this.addCommand({
                id: "open-cartographer",
                name: "Open Cartographer",
                callback: async () => {
                    try {
                        await openCartographer(this.app);
                    } catch (error: unknown) {
                        this.failIntegration("activate-view", "obsidian:cartographer-view", error, "Cartographer konnte nicht geoeffnet werden. Bitte die Konsole pruefen.");
                    }
                },
            });
        } catch (error: unknown) {
            this.failIntegration("register-command", "obsidian:cartographer-view", error, "Cartographer-Kommando konnte nicht registriert werden. Bitte die Konsole pruefen.");
        }
        try {
            this.addCommand({
                id: "open-library",
                name: "Open Library",
                callback: async () => {
                    try {
                        const leaf = this.app.workspace.getLeaf(true);
                        await leaf.setViewState({ type: VIEW_LIBRARY, active: true });
                        this.app.workspace.revealLeaf(leaf);
                    } catch (error: unknown) {
                        this.failIntegration("activate-view", "obsidian:library-view", error, "Library konnte nicht geoeffnet werden. Bitte die Konsole pruefen.");
                    }
                },
            });
        } catch (error: unknown) {
            this.failIntegration("register-command", "obsidian:library-view", error, "Library-Kommando konnte nicht registriert werden. Bitte die Konsole pruefen.");
        }

        this.injectCss();

    }

    async onunload() {
        try {
            this.unwatchTerrains?.();
        } catch (error: unknown) {
            this.failIntegration("watch-dataset", "obsidian:terrain-palette", error, "Terrain-Ueberwachung konnte nicht beendet werden. Bitte die Konsole pruefen.");
        }
        try {
            await detachCartographerLeaves(this.app);
        } catch (error: unknown) {
            this.failIntegration("detach-view", "obsidian:cartographer-view", error, "Cartographer-Ansichten konnten nicht geschlossen werden. Bitte die Konsole pruefen.");
        }
        this.removeCss();
    }

    private failIntegration(operation: IntegrationOperation, integrationId: IntegrationId, error: unknown, userMessage: string): never {
        reportIntegrationIssue({ integrationId, operation, error, userMessage });
        throw error;
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
