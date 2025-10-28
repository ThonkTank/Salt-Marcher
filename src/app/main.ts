// src/app/main.ts
import { Plugin } from "obsidian";
import { logger } from "./plugin-logger";
// Legacy views removed (consolidated into Library)
import { detachCartographerLeaves } from "../workmodes/cartographer";
import { VIEW_MANIFEST } from "../workmodes/view-manifest";
import { HEX_PLUGIN_CSS } from "./css";
import { reportIntegrationIssue, type IntegrationId, type IntegrationOperation } from "./integration-telemetry";
import { createTerrainBootstrap, type TerrainBootstrapHandle } from "./bootstrap-services";
import { IPCServer } from "./ipc-server";
import { registerIPCCommands } from "./ipc-commands";

export default class SaltMarcherPlugin extends Plugin {
    private terrainBootstrap?: TerrainBootstrapHandle;
    private ipcServer?: IPCServer;

    async onload() {
        // Initialize logger FIRST to capture all startup logs
        await logger.init(this.app);
        logger.log('Plugin loading...');

        // Initialize debug logger
        const { debugLogger } = await import('./debug-logger');
        await debugLogger.loadConfig(this.app);

        // Inject CSS IMMEDIATELY so views have styling when workspace is restored
        this.injectCss();

        // Generate library index files BEFORE views are registered
        // This ensures data is available when workspace is restored
        try {
            const { generateAllIndexes } = await import('../workmodes/library/core/index-files');
            await generateAllIndexes(this.app);
        } catch (err) {
            logger.error("Failed to generate library indexes:", err);
        }

        // Register views EARLY (required before ribbons)
        for (const manifestEntry of VIEW_MANIFEST) {
            try {
                this.registerView(manifestEntry.viewType, manifestEntry.createView);
            } catch (error: unknown) {
                this.failIntegration("register-view", manifestEntry.integrationId, error, `${manifestEntry.displayName}-Ansicht konnte nicht registriert werden. Bitte die Konsole pruefen.`);
            }
        }

        // Register ribbons EARLY so they appear immediately on startup
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

        // Start IPC server for CLI control
        try {
            this.ipcServer = new IPCServer(this.app);
            registerIPCCommands(this.ipcServer, this);

            // Load dev commands (bundled with esbuild)
            try {
                const { registerDevCommands } = await import('../../devkit/core/ipc/register-dev-commands');
                registerDevCommands(this.ipcServer);
                logger.log('[IPC] Dev commands loaded - available: measure-ui, validate-ui-rule, validate-ui-config, dump-dom, navigate-to-section, validate-grid-layout, debug-stepper-styles, validate-ui, start-test, end-test, log-marker, set-debug-config, get-debug-config, get-test-logs, assert-log-contains, get-field-state, dump-field-states, get-modal-data');
            } catch (err) {
                // Dev commands not available or import failed
                logger.log('[IPC] Dev commands not available:', err);
            }

            await this.ipcServer.start();
            logger.log('[IPC] Server ready - production commands: reload-plugin, edit-creature, edit-spell, edit-item, edit-equipment, get-logs');
        } catch (err) {
            logger.error("Failed to start IPC server:", err);
        }

        // Import preset creatures from plugin on first load
        try {
            const { shouldImportPluginPresets, importPluginPresets } = await import('../../Presets/lib/plugin-presets');
            if (await shouldImportPluginPresets(this.app)) {
                await importPluginPresets(this.app);
            }
        } catch (err) {
            logger.error("Failed to import preset creatures:", err);
        }

        // Import spell presets from reference file on first load
        try {
            const { shouldImportSpellPresets, importSpellPresets } = await import('../../Presets/lib/plugin-presets');
            if (await shouldImportSpellPresets(this.app)) {
                await importSpellPresets(this.app);
            }
        } catch (err) {
            logger.error("Failed to import spell presets:", err);
        }

        // Import item presets from plugin on first load
        try {
            const { shouldImportItemPresets, importItemPresets } = await import('../../Presets/lib/plugin-presets');
            if (await shouldImportItemPresets(this.app)) {
                await importItemPresets(this.app);
            }
        } catch (err) {
            logger.error("Failed to import item presets:", err);
        }

        // Import equipment presets from plugin on first load
        try {
            const { shouldImportEquipmentPresets, importEquipmentPresets } = await import('../../Presets/lib/plugin-presets');
            if (await shouldImportEquipmentPresets(this.app)) {
                await importEquipmentPresets(this.app);
            }
        } catch (err) {
            logger.error("Failed to import equipment presets:", err);
        }

        // Import terrain presets from plugin on first load
        try {
            const { shouldImportTerrainPresets, importTerrainPresets } = await import('../../Presets/lib/plugin-presets');
            if (await shouldImportTerrainPresets(this.app)) {
                await importTerrainPresets(this.app);
            }
        } catch (err) {
            logger.error("Failed to import terrain presets:", err);
        }

        // Import region presets from plugin on first load
        try {
            const { shouldImportRegionPresets, importRegionPresets } = await import('../../Presets/lib/plugin-presets');
            if (await shouldImportRegionPresets(this.app)) {
                await importRegionPresets(this.app);
            }
        } catch (err) {
            logger.error("Failed to import region presets:", err);
        }

        // Import calendar presets from plugin on first load
        try {
            const { shouldImportCalendarPresets, importCalendarPresets } = await import('../../Presets/lib/plugin-presets');
            if (await shouldImportCalendarPresets(this.app)) {
                await importCalendarPresets(this.app);
            }
        } catch (err) {
            logger.error("Failed to import calendar presets:", err);
        }

        // Watch library directories and regenerate indexes on changes
        try {
            const {
                generateCreaturesIndex,
                generateEquipmentIndex,
                generateSpellsIndex,
                generateItemsIndex,
                generateCalendarsIndex,
                generateLibraryHub
            } = await import('../workmodes/library/core/index-files');

            // Helper to debounce index updates
            const createDebouncedIndexUpdater = (updateFn: () => Promise<void>, delay: number = 1000) => {
                let timeoutId: NodeJS.Timeout | null = null;
                return () => {
                    if (timeoutId) clearTimeout(timeoutId);
                    timeoutId = setTimeout(async () => {
                        try {
                            await updateFn();
                        } catch (err) {
                            logger.error("Failed to update index:", err);
                        }
                    }, delay);
                };
            };

            // Watch Creatures directory
            const creaturesWatcher = createDebouncedIndexUpdater(() => generateCreaturesIndex(this.app));
            this.registerEvent(this.app.vault.on("create", (file) => {
                if (file.path.startsWith("SaltMarcher/Creatures/") && file.path !== "SaltMarcher/Creatures.md") creaturesWatcher();
            }));
            this.registerEvent(this.app.vault.on("delete", (file) => {
                if (file.path.startsWith("SaltMarcher/Creatures/") && file.path !== "SaltMarcher/Creatures.md") creaturesWatcher();
            }));
            this.registerEvent(this.app.vault.on("rename", (file) => {
                if (file.path.startsWith("SaltMarcher/Creatures/") && file.path !== "SaltMarcher/Creatures.md") creaturesWatcher();
            }));

            // Watch Equipment directory
            const equipmentWatcher = createDebouncedIndexUpdater(() => generateEquipmentIndex(this.app));
            this.registerEvent(this.app.vault.on("create", (file) => {
                if (file.path.startsWith("SaltMarcher/Equipment/") && file.path !== "SaltMarcher/Equipment.md") equipmentWatcher();
            }));
            this.registerEvent(this.app.vault.on("delete", (file) => {
                if (file.path.startsWith("SaltMarcher/Equipment/") && file.path !== "SaltMarcher/Equipment.md") equipmentWatcher();
            }));
            this.registerEvent(this.app.vault.on("rename", (file) => {
                if (file.path.startsWith("SaltMarcher/Equipment/") && file.path !== "SaltMarcher/Equipment.md") equipmentWatcher();
            }));

            // Watch Spells directory
            const spellsWatcher = createDebouncedIndexUpdater(() => generateSpellsIndex(this.app));
            this.registerEvent(this.app.vault.on("create", (file) => {
                if (file.path.startsWith("SaltMarcher/Spells/") && file.path !== "SaltMarcher/Spells.md") spellsWatcher();
            }));
            this.registerEvent(this.app.vault.on("delete", (file) => {
                if (file.path.startsWith("SaltMarcher/Spells/") && file.path !== "SaltMarcher/Spells.md") spellsWatcher();
            }));
            this.registerEvent(this.app.vault.on("rename", (file) => {
                if (file.path.startsWith("SaltMarcher/Spells/") && file.path !== "SaltMarcher/Spells.md") spellsWatcher();
            }));

            // Watch Items directory
            const itemsWatcher = createDebouncedIndexUpdater(() => generateItemsIndex(this.app));
            this.registerEvent(this.app.vault.on("create", (file) => {
                if (file.path.startsWith("SaltMarcher/Items/") && file.path !== "SaltMarcher/Items.md") itemsWatcher();
            }));
            this.registerEvent(this.app.vault.on("delete", (file) => {
                if (file.path.startsWith("SaltMarcher/Items/") && file.path !== "SaltMarcher/Items.md") itemsWatcher();
            }));
            this.registerEvent(this.app.vault.on("rename", (file) => {
                if (file.path.startsWith("SaltMarcher/Items/") && file.path !== "SaltMarcher/Items.md") itemsWatcher();
            }));

            // Watch Calendars directory
            const calendarsWatcher = createDebouncedIndexUpdater(() => generateCalendarsIndex(this.app));
            this.registerEvent(this.app.vault.on("create", (file) => {
                if (file.path.startsWith("SaltMarcher/Calendars/") && file.path !== "SaltMarcher/Calendars.md") calendarsWatcher();
            }));
            this.registerEvent(this.app.vault.on("delete", (file) => {
                if (file.path.startsWith("SaltMarcher/Calendars/") && file.path !== "SaltMarcher/Calendars.md") calendarsWatcher();
            }));
            this.registerEvent(this.app.vault.on("rename", (file) => {
                if (file.path.startsWith("SaltMarcher/Calendars/") && file.path !== "SaltMarcher/Calendars.md") calendarsWatcher();
            }));

        } catch (err) {
            logger.error("Failed to setup library index watchers:", err);
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

        // Dev tool command removed - use devkit/utilities/conversions/convert-references.mjs instead

    }

    async onunload() {
        logger.log('Plugin unloading...');

        // Stop IPC server
        this.ipcServer?.stop();

        this.terrainBootstrap?.stop();
        try {
            await detachCartographerLeaves(this.app);
        } catch (error: unknown) {
            this.failIntegration("detach-view", "obsidian:cartographer-view", error, "Cartographer-Ansichten konnten nicht geschlossen werden. Bitte die Konsole pruefen.");
        }
        this.removeCss();

        // Shutdown logger LAST to capture all unload logs
        await logger.shutdown();
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
