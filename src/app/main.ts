// src/app/main.ts
import { Plugin } from "obsidian";
// Legacy views removed (consolidated into Library)
import { detachCartographerLeaves } from "../apps/cartographer";
import { VIEW_MANIFEST } from "../apps/view-manifest";
import { HEX_PLUGIN_CSS } from "./css";
import { reportIntegrationIssue, type IntegrationId, type IntegrationOperation } from "./integration-telemetry";
import { createTerrainBootstrap, type TerrainBootstrapHandle } from "./bootstrap-services";

export default class SaltMarcherPlugin extends Plugin {
    private terrainBootstrap?: TerrainBootstrapHandle;
    async onload() {
        // Import preset creatures from plugin on first load
        try {
            const { shouldImportPluginPresets, importPluginPresets } = await import('../apps/library/core/plugin-presets');
            if (await shouldImportPluginPresets(this.app)) {
                await importPluginPresets(this.app);
            }
        } catch (err) {
            console.error("Failed to import preset creatures:", err);
        }

        // Import spell presets from reference file on first load
        try {
            const { shouldImportSpellPresets, importSpellPresets } = await import('../apps/library/core/plugin-presets');
            if (await shouldImportSpellPresets(this.app)) {
                await importSpellPresets(this.app);
            }
        } catch (err) {
            console.error("Failed to import spell presets:", err);
        }

        // Import item presets from plugin on first load
        try {
            const { shouldImportItemPresets, importItemPresets } = await import('../apps/library/core/plugin-presets');
            if (await shouldImportItemPresets(this.app)) {
                await importItemPresets(this.app);
            }
        } catch (err) {
            console.error("Failed to import item presets:", err);
        }

        // Import equipment presets from plugin on first load
        try {
            const { shouldImportEquipmentPresets, importEquipmentPresets } = await import('../apps/library/core/plugin-presets');
            if (await shouldImportEquipmentPresets(this.app)) {
                await importEquipmentPresets(this.app);
            }
        } catch (err) {
            console.error("Failed to import equipment presets:", err);
        }

        // Views
        for (const manifestEntry of VIEW_MANIFEST) {
            try {
                this.registerView(manifestEntry.viewType, manifestEntry.createView);
            } catch (error: unknown) {
                this.failIntegration("register-view", manifestEntry.integrationId, error, `${manifestEntry.displayName}-Ansicht konnte nicht registriert werden. Bitte die Konsole pruefen.`);
            }
        }

        // Load terrain data and keep it synchronised with the filesystem.
        this.terrainBootstrap = createTerrainBootstrap(this.app);
        const terrainBootstrapResult = await this.terrainBootstrap.start();
        if (!terrainBootstrapResult.primed) {
            const operation: IntegrationOperation = terrainBootstrapResult.primeError ? "prime-dataset" : "watch-dataset";
            const error = terrainBootstrapResult.primeError ?? terrainBootstrapResult.watchError ?? new Error("Terrain bootstrap failed");
            const userMessage = operation === "prime-dataset"
                ? "Terrain-Daten konnten nicht geladen werden. Bitte die Vault-Dateien pruefen."
                : "Terrain-Aenderungen koennen nicht ueberwacht werden. Bitte die Konsole pruefen.";
            this.failIntegration(operation, "obsidian:terrain-palette", error, userMessage);
        }

        // Ribbons
        for (const manifestEntry of VIEW_MANIFEST) {
            const activation = manifestEntry.activation;
            if (!activation?.ribbon) continue;

            try {
                this.addRibbonIcon(activation.ribbon.icon, activation.ribbon.title, async () => {
                    try {
                        await activation.open(this.app);
                    } catch (error: unknown) {
                        this.failIntegration("activate-view", manifestEntry.integrationId, error, `${manifestEntry.displayName} konnte nicht geoeffnet werden. Bitte die Konsole pruefen.`);
                    }
                });
            } catch (error: unknown) {
                this.failIntegration("register-ribbon", manifestEntry.integrationId, error, `${manifestEntry.displayName}-Ribbon konnte nicht erstellt werden. Bitte die Konsole pruefen.`);
            }
        }

        // Commands
        for (const manifestEntry of VIEW_MANIFEST) {
            const activation = manifestEntry.activation;
            if (!activation?.commands?.length) continue;

            for (const command of activation.commands) {
                try {
                    this.addCommand({
                        id: command.id,
                        name: command.name,
                        callback: async () => {
                            try {
                                await activation.open(this.app);
                            } catch (error: unknown) {
                                this.failIntegration("activate-view", manifestEntry.integrationId, error, `${manifestEntry.displayName} konnte nicht geoeffnet werden. Bitte die Konsole pruefen.`);
                            }
                        },
                    });
                } catch (error: unknown) {
                    this.failIntegration("register-command", manifestEntry.integrationId, error, `${manifestEntry.displayName}-Kommando konnte nicht registriert werden. Bitte die Konsole pruefen.`);
                }
            }
        }

        // Convert References Command (dev tool - use scripts/convert-references.mjs instead)
        this.addCommand({
            id: 'convert-reference-statblocks',
            name: 'Convert Reference Statblocks to Presets',
            callback: async () => {
                const { convertSpecificFiles } = await import('../apps/library/tools/convert-references');

                // Teste mit Ape und Aboleth zuerst
                const testFiles = [
                    'References/rulebooks/Statblocks/Creatures/Animals/ape.md',
                    'References/rulebooks/Statblocks/Creatures/Monsters/aboleth.md',
                ];

                console.log('Starting conversion of files:', testFiles);

                // Check if files exist
                for (const filePath of testFiles) {
                    const file = this.app.vault.getAbstractFileByPath(filePath);
                    console.log(`File ${filePath}:`, file ? 'found' : 'NOT FOUND');
                }

                const result = await convertSpecificFiles(this.app, testFiles, false);
                console.log('Konvertierung abgeschlossen:', result);

                if (result.errors.length > 0) {
                    console.error('Errors during conversion:', result.errors);
                }
            }
        });

        this.injectCss();

    }

    async onunload() {
        this.terrainBootstrap?.stop();
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
        document.querySelectorAll("#hex-css").forEach((existingStyle) => existingStyle.remove());
        const style = document.createElement("style");
        style.id = "hex-css";
        style.textContent = HEX_PLUGIN_CSS;
        document.head.appendChild(style);
    }

    private removeCss() {
        document.getElementById("hex-css")?.remove();
    }
}
