// src/app/main.ts
import { Plugin } from "obsidian";
// Legacy views removed (consolidated into Library)
import { detachCartographerLeaves } from "@workmodes/cartographer";
import { VIEW_MANIFEST } from "@workmodes/view-manifest";
import { createTerrainBootstrap, type TerrainBootstrapHandle } from "./bootstrap-services";
import { HEX_PLUGIN_CSS } from "./css";
import { reportIntegrationIssue, type IntegrationId, type IntegrationOperation } from "./integration-telemetry";
import { registerIPCCommands } from "./ipc-commands";
import { IPCServer } from "./ipc-server";
import { configurableLogger, logger as pluginLogger } from '@services/logging/configurable-logger';
const logger = configurableLogger.forModule('plugin-main');
import { SaltMarcherSettingTab } from "./settings-tab";
import type { IPluginHost, SaltMarcherSettings } from "./interfaces";

// ==================== Settings Interface ====================

const DEFAULT_SETTINGS: SaltMarcherSettings = {
    cartographer: {
        layerConfig: undefined, // Will use component defaults
        layerPanelVisible: true,
        layerPanelCollapsed: false
    },
    sessionRunner: {
        leftSidebarCollapsed: false,
        rightSidebarCollapsed: false,
        defaultPartyLevel: 5,
        defaultPartySize: 4,
        panels: {
            weather: { expanded: true },
            calendar: { expanded: true },
            hexInfo: { expanded: true },
            controls: { expanded: true },
            speed: { expanded: true },
            party: { expanded: true }
        }
    }
};

// ==================== Plugin Class ====================

export default class SaltMarcherPlugin extends Plugin implements IPluginHost {
    settings: SaltMarcherSettings = DEFAULT_SETTINGS;
    private terrainBootstrap?: TerrainBootstrapHandle;
    private ipcServer?: IPCServer;
    private inboxStatusBar?: import("../features/events").InboxStatusBar;

    async onload() {
        // Load settings FIRST
        await this.loadSettings();

        // Initialize SettingsService with loaded settings
        const { SettingsService } = await import('../services/settings/settings-service');
        SettingsService.initialize(this.settings);

        // Register settings tab
        this.addSettingTab(new SaltMarcherSettingTab(this.app, this));

        // Initialize logger FIRST to capture all startup logs
        await pluginLogger.init(this.app);
        logger.info('Plugin loading...');

        // Initialize configurable logger (loads .claude/debug.json for log levels)
        const { configurableLogger } = await import('@services/logging/configurable-logger');
        await configurableLogger.loadConfig(this.app);

        // Initialize debug logger (legacy field/category debugging)
        const { debugLogger } = await import('@services/logging/debug-logger');
        await debugLogger.loadConfig(this.app);

        // Initialize shared party store EARLY (used by Session Runner and Encounter Calculator)
        try {
            const { initializePartyStore, loadPartyData } = await import('../services/state/party-store');
            initializePartyStore(this.app);
            await loadPartyData();
            logger.info('Initialized and loaded');
        } catch (err) {
            logger.error("Failed to initialize party store:", err);
        }

        // Initialize shared character store EARLY (used by Library, Session Runner, and Encounter Calculator)
        try {
            const { initializeCharacterStore, loadCharacterData } = await import('../services/state/character-store');
            initializeCharacterStore(this.app);
            await loadCharacterData();
            logger.info('Initialized and loaded');
        } catch (err) {
            logger.error("Failed to initialize character store:", err);
        }

        // Initialize creature store EARLY (used by Session Runner encounters)
        // Auto-imports presets to SaltMarcher/Creatures/ on first run
        try {
            const { initializeCreatureStore, getCreatureStore } = await import('../features/encounters/creature-store');
            initializeCreatureStore(this.app);
            await getCreatureStore().initialize();
            logger.info('Initialized and loaded');
        } catch (err) {
            logger.error("Failed to initialize creature store:", err);
        }

        // Register region data source adapter EARLY (decouples features from workmodes)
        try {
            const { registerRegionDataSource } = await import('../features/maps/data/region-data-source');
            const { regionDataSourceAdapter } = await import('../workmodes/library/storage/region-data-source-adapter');
            registerRegionDataSource(regionDataSourceAdapter);
            logger.info('Adapter registered');
        } catch (err) {
            logger.error("Failed to register region data source:", err);
        }

        // Inject TileCache provider EARLY (breaks circular dependency: session → weather-overlay-store)
        // IMPORTANT: Use createTileCache directly, NOT getMapSession().tileCache
        // because getMapSession() calls getWeatherOverlayStore() which triggers
        // the provider, causing infinite recursion.
        try {
            const { setTileCacheProvider } = await import('../features/maps/state/weather-overlay-store');
            const { createTileCache } = await import('../features/maps/data/tile-cache');
            setTileCacheProvider((app, mapFile) => createTileCache(app, mapFile));
            logger.info('TileCache provider injected');
        } catch (err) {
            logger.error("Failed to inject TileCache provider:", err);
        }

        // Inject CSS IMMEDIATELY so views have styling when workspace is restored
        this.injectCss();

        // Generate library index files BEFORE views are registered
        // This ensures data is available when workspace is restored
        try {
            const { generateAllIndexes } = await import('../workmodes/library/core/index-files');
            await generateAllIndexes(this.app);
        } catch (err) {
            // Only log if there's an actual error object
            if (err) {
                logger.error("Failed to generate library indexes:", err);
            }
        }

        // Register views EARLY (required before ribbons)
        for (const manifestEntry of VIEW_MANIFEST) {
            try {
                this.registerView(manifestEntry.viewType, manifestEntry.createView);
            } catch (error: unknown) {
                // Ignore "existing view type" errors during hot reload
                // The previously registered view is still functional
                const errorMessage = error instanceof Error ? error.message : String(error);
                if (errorMessage.includes('existing view type')) {
                    logger.info(`View '${manifestEntry.viewType}' already registered (hot reload), continuing...`);
                    continue;
                }
                // Other errors should still fail
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
            this.ipcServer.logRegisteredCommands('Production');

            // Load dev commands (bundled with esbuild)
            try {
                const { registerDevCommands } = await import('../../devkit/core/ipc/register-dev-commands');
                registerDevCommands(this.ipcServer);
                this.ipcServer.logRegisteredCommands('Dev');
            } catch (err) {
                // Dev commands not available or import failed
                logger.debug('Dev commands not available:', err);
            }

            await this.ipcServer.start();
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

        // Import playlist presets from plugin on first load
        try {
            const { shouldImportPlaylistPresets, importPlaylistPresets } = await import('../../Presets/lib/plugin-presets');
            if (await shouldImportPlaylistPresets(this.app)) {
                await importPlaylistPresets(this.app);
            }
        } catch (err) {
            logger.error("Failed to import playlist presets:", err);
        }

        // Import faction presets from plugin on first load
        try {
            const { shouldImportFactionPresets, importFactionPresets } = await import('../../Presets/lib/plugin-presets');
            if (await shouldImportFactionPresets(this.app)) {
                await importFactionPresets(this.app);
            }
        } catch (err) {
            logger.error("Failed to import faction presets:", err);
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

        // Setup Inbox StatusBar Widget
        try {
            const { createInboxStatusBar, globalEventHistoryStore } = await import('../features/events');
            const statusBarItem = this.addStatusBarItem();
            this.inboxStatusBar = createInboxStatusBar(this.app, globalEventHistoryStore, statusBarItem);
            logger.info('Widget registered');
        } catch (error) {
            logger.error('Failed to setup widget', error);
        }

    }

    async onunload() {
        logger.info('Plugin unloading...');

        // Cleanup Inbox StatusBar Widget
        this.inboxStatusBar?.destroy();
        this.inboxStatusBar = undefined;

        // Dispose party store (clears auto-save timeouts, saves dirty data)
        try {
            const { disposePartyStore } = await import('../services/state/party-store');
            await disposePartyStore(true);
            logger.info('Disposed');
        } catch (error) {
            logger.error('Failed to dispose party store:', error);
        }

        // Dispose character store (clears auto-save timeouts, saves dirty data)
        try {
            const { disposeCharacterStore } = await import('../services/state/character-store');
            await disposeCharacterStore(true);
            logger.info('Disposed');
        } catch (error) {
            logger.error('Failed to dispose character store:', error);
        }

        // Dispose creature store (unregisters vault watchers)
        try {
            const { disposeCreatureStore } = await import('../features/encounters/creature-store');
            disposeCreatureStore();
            logger.info('Disposed');
        } catch (error) {
            logger.error('Failed to dispose creature store:', error);
        }

        // Dispose all map sessions (clears all per-map stores, flushes pending saves)
        try {
            const { disposeAllSessions } = await import('../features/maps/session');
            disposeAllSessions();
            logger.info('All map sessions disposed');
        } catch (error) {
            logger.error('Failed to dispose map sessions:', error);
        }

        // Stop IPC server
        this.ipcServer?.stop();

        this.terrainBootstrap?.stop();
        try {
            await detachCartographerLeaves(this.app);
        } catch (error: unknown) {
            this.failIntegration("detach-view", "obsidian:cartographer-view", error, "Cartographer-Ansichten konnten nicht geschlossen werden. Bitte die Konsole pruefen.");
        }
        this.removeCss();

        // Release global stores (regions, terrains) - only on plugin unload!
        try {
            const { getGlobalStoreManager } = await import('../features/maps/state/global-store-manager');
            getGlobalStoreManager().releaseGlobalStores(this.app);
        } catch (error: unknown) {
            logger.error('Failed to release global stores:', error);
        }

        // Cleanup SettingsService
        try {
            const { SettingsService } = await import('../services/settings/settings-service');
            SettingsService.cleanup();
            logger.info('Cleaned up');
        } catch (error) {
            logger.error('Failed to cleanup settings service:', error);
        }

        // Shutdown logger LAST to capture all unload logs
        await pluginLogger.shutdown();
    }

    // ==================== Settings Management ====================

    async loadSettings(): Promise<void> {
        const data = await this.loadData();
        this.settings = Object.assign({}, DEFAULT_SETTINGS, data);

        // Migrate settings if needed
        if (!this.settings.cartographer) {
            this.settings.cartographer = {
                layerConfig: undefined,
                layerPanelVisible: true,
                layerPanelCollapsed: false
            };
        }
    }

    async saveSettings(): Promise<void> {
        await this.saveData(this.settings);

        // Update SettingsService when settings change
        const { SettingsService } = await import('../services/settings/settings-service');
        SettingsService.updateSettings(this.settings);
    }

    // ==================== Integration Handling ====================

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
