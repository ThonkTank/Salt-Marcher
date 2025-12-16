/**
 * Environment Panel
 *
 * Global environmental settings for the map including sea level, tidal system,
 * and water visualization colors. Stored in map frontmatter.
 *
 * @module workmodes/cartographer/components/environment-panel
 */

import type { App, TFile } from "obsidian";
import { configurableLogger } from "@services/logging/configurable-logger";

const logger = configurableLogger.forModule("cartographer-environment-panel");
import {
    buildForm,
    type FormBuilderInstance,
    type FormSliderHandle,
} from "@ui/components/form-builder";
import { createDayCycleSimulator, type DayCycleSimulatorHandle } from "./day-cycle-simulator";

/**
 * Environment configuration stored in map frontmatter
 */
export interface EnvironmentConfig {
    seaLevel: number;        // Meters (-100 to +500)
    tidalRange: number;      // Meters (0 to 10)
    tidalPeriod: number;     // Hours per tidal cycle (default: 12.4)
    waterColor: string;      // Hex color for water bodies
    wetlandColor: string;    // Hex color for wetlands
    mudflatColor: string;    // Hex color for mudflats
}

/**
 * Default environment configuration
 */
const DEFAULT_CONFIG: EnvironmentConfig = {
    seaLevel: 0,            // Sea level at 0 meters
    tidalRange: 3,          // 3-meter tidal range (typical)
    tidalPeriod: 12.4,      // 12.4 hours (lunar semidiurnal)
    waterColor: "#0077BE",  // Ocean blue
    wetlandColor: "#4CAF50", // Wetland green
    mudflatColor: "#8D6E63", // Mudflat brown
};

/**
 * Environment Panel Handle
 */
export interface EnvironmentPanelHandle {
    /**
     * Get root HTML element
     */
    getElement(): HTMLElement;

    /**
     * Load configuration from map frontmatter
     */
    loadConfig(): Promise<void>;

    /**
     * Save configuration to map frontmatter
     */
    saveConfig(): Promise<void>;

    /**
     * Get current configuration
     */
    getConfig(): EnvironmentConfig;

    /**
     * Set configuration and update UI
     */
    setConfig(config: Partial<EnvironmentConfig>): void;

    /**
     * Register callback for config changes
     * @param callback - Called when config changes
     */
    onChange(callback: (config: EnvironmentConfig) => void): void;

    /**
     * Show/hide panel
     */
    show(): void;
    hide(): void;
    toggle(): void;
    isVisible(): boolean;

    /**
     * Destroy and cleanup
     */
    destroy(): void;
}

type EnvironmentUI = {
    root: HTMLElement;
    header: HTMLElement;
    body: HTMLElement;
    form: FormBuilderInstance<
        "seaLevel" | "tidalRange" | "tidalPeriod" | "waterColor" | "wetlandColor" | "mudflatColor",
        never,
        never,
        never
    > | null;
    seaLevel: FormSliderHandle | null;
    tidalRange: FormSliderHandle | null;
    tidalPeriod: FormSliderHandle | null;
    waterColorInput: HTMLInputElement | null;
    wetlandColorInput: HTMLInputElement | null;
    mudflatColorInput: HTMLInputElement | null;
};

/**
 * Create environment panel
 *
 * @param app - Obsidian app instance
 * @param mapFile - Map file to store config in frontmatter
 *
 * @example
 * ```typescript
 * const panel = createEnvironmentPanel(app, mapFile);
 *
 * // Mount to UI
 * rightSidebar.appendChild(panel.getElement());
 *
 * // Listen for changes
 * panel.onChange((config) => {
 *     // Update water layers based on new config
 *     seaLevelLayer.setSeaLevel(config.seaLevel);
 *     tidalLayer.setRange(config.tidalRange);
 * });
 *
 * // Cleanup
 * panel.destroy();
 * ```
 */
export function createEnvironmentPanel(
    app: App,
    mapFile: TFile,
    renderHandles?: { refreshTidalLayerWithTime: (hours: number, day: number) => void }
): EnvironmentPanelHandle {
    let config: EnvironmentConfig = { ...DEFAULT_CONFIG };
    let saveTimer: number | null = null;
    const changeCallbacks: Array<(config: EnvironmentConfig) => void> = [];
    let dayCycleSimulator: DayCycleSimulatorHandle | null = null;

    const ui: EnvironmentUI = {
        root: document.createElement("div"),
        header: document.createElement("div"),
        body: document.createElement("div"),
        form: null,
        seaLevel: null,
        tidalRange: null,
        tidalPeriod: null,
        waterColorInput: null,
        wetlandColorInput: null,
        mudflatColorInput: null,
    };

    ui.root.className = "sm-environment-panel";
    ui.root.style.display = "none"; // Hidden by default
    ui.header.className = "sm-panel__header";
    ui.body.className = "sm-panel__body";

    ui.root.appendChild(ui.header);
    ui.root.appendChild(ui.body);

    /**
     * Schedule save to frontmatter (debounced)
     */
    const scheduleSave = () => {
        if (saveTimer) clearTimeout(saveTimer);
        saveTimer = window.setTimeout(() => {
            saveConfig().catch((error) => {
                logger.error("Failed to save config:", error);
            });
        }, 500);
    };

    /**
     * Notify change callbacks
     */
    const notifyChange = () => {
        for (const callback of changeCallbacks) {
            try {
                callback(config);
            } catch (error) {
                logger.error("Change callback error:", error);
            }
        }
    };

    /**
     * Update config and notify
     */
    const updateConfig = (partial: Partial<EnvironmentConfig>) => {
        config = { ...config, ...partial };
        notifyChange();
        scheduleSave();
    };

    /**
     * Build UI
     */
    const buildUI = () => {
        // Header
        ui.header.innerHTML = "";
        const title = ui.header.createEl("h3", { text: "Environment Settings" });
        title.className = "sm-panel__title";

        // Form
        const formInstance = buildForm(ui.body, [
            {
                kind: "header",
                text: "Water Levels",
                level: 4,
                cls: "sm-environment-panel__section-header",
            },
            {
                kind: "row",
                label: "Sea Level:",
                rowCls: "sm-environment-panel__row",
                controls: [
                    {
                        kind: "slider",
                        id: "seaLevel",
                        value: config.seaLevel,
                        min: -100,
                        max: 500,
                        step: 10,
                        showValue: true,
                        valueFormatter: (v) => `${v}m`,
                        onInput: (change) => {
                            updateConfig({ seaLevel: change.value });
                        },
                    },
                ],
            },
            {
                kind: "header",
                text: "Tidal System",
                level: 4,
                cls: "sm-environment-panel__section-header",
            },
            {
                kind: "row",
                label: "Tidal Range:",
                rowCls: "sm-environment-panel__row",
                controls: [
                    {
                        kind: "slider",
                        id: "tidalRange",
                        value: config.tidalRange,
                        min: 0,
                        max: 10,
                        step: 0.5,
                        showValue: true,
                        valueFormatter: (v) => `${v}m`,
                        onInput: (change) => {
                            updateConfig({ tidalRange: change.value });
                        },
                    },
                ],
            },
            {
                kind: "row",
                label: "Tidal Period:",
                rowCls: "sm-environment-panel__row",
                controls: [
                    {
                        kind: "slider",
                        id: "tidalPeriod",
                        value: config.tidalPeriod,
                        min: 6,
                        max: 24,
                        step: 0.1,
                        showValue: true,
                        valueFormatter: (v) => `${v}h`,
                        onInput: (change) => {
                            updateConfig({ tidalPeriod: change.value });
                        },
                    },
                ],
            },
            {
                kind: "header",
                text: "Colors",
                level: 4,
                cls: "sm-environment-panel__section-header",
            },
        ]);

        ui.form = formInstance;
        ui.seaLevel = formInstance.controls.seaLevel;
        ui.tidalRange = formInstance.controls.tidalRange;
        ui.tidalPeriod = formInstance.controls.tidalPeriod;

        // Color pickers (manual creation - not in form-builder yet)
        const colorSection = ui.body.createDiv({ cls: "sm-environment-panel__colors" });

        // Water color
        const waterRow = colorSection.createDiv({ cls: "sm-environment-panel__row" });
        waterRow.createEl("label", { text: "Water:" });
        ui.waterColorInput = waterRow.createEl("input", {
            type: "color",
            attr: { value: config.waterColor },
        });
        ui.waterColorInput.addEventListener("input", (e) => {
            const value = (e.target as HTMLInputElement).value;
            updateConfig({ waterColor: value });
        });

        // Wetland color
        const wetlandRow = colorSection.createDiv({ cls: "sm-environment-panel__row" });
        wetlandRow.createEl("label", { text: "Wetlands:" });
        ui.wetlandColorInput = wetlandRow.createEl("input", {
            type: "color",
            attr: { value: config.wetlandColor },
        });
        ui.wetlandColorInput.addEventListener("input", (e) => {
            const value = (e.target as HTMLInputElement).value;
            updateConfig({ wetlandColor: value });
        });

        // Mudflat color
        const mudflatRow = colorSection.createDiv({ cls: "sm-environment-panel__row" });
        mudflatRow.createEl("label", { text: "Mudflats:" });
        ui.mudflatColorInput = mudflatRow.createEl("input", {
            type: "color",
            attr: { value: config.mudflatColor },
        });
        ui.mudflatColorInput.addEventListener("input", (e) => {
            const value = (e.target as HTMLInputElement).value;
            updateConfig({ mudflatColor: value });
        });
    };

    /**
     * Update UI from config
     */
    const updateUI = () => {
        if (ui.seaLevel) ui.seaLevel.setValue(config.seaLevel);
        if (ui.tidalRange) ui.tidalRange.setValue(config.tidalRange);
        if (ui.tidalPeriod) ui.tidalPeriod.setValue(config.tidalPeriod);
        if (ui.waterColorInput) ui.waterColorInput.value = config.waterColor;
        if (ui.wetlandColorInput) ui.wetlandColorInput.value = config.wetlandColor;
        if (ui.mudflatColorInput) ui.mudflatColorInput.value = config.mudflatColor;
    };

    /**
     * Load configuration from map frontmatter
     */
    const loadConfig = async (): Promise<void> => {
        try {
            await app.fileManager.processFrontMatter(mapFile, (frontmatter) => {
                if (frontmatter.environment) {
                    config = {
                        seaLevel: frontmatter.environment.seaLevel ?? DEFAULT_CONFIG.seaLevel,
                        tidalRange: frontmatter.environment.tidalRange ?? DEFAULT_CONFIG.tidalRange,
                        tidalPeriod: frontmatter.environment.tidalPeriod ?? DEFAULT_CONFIG.tidalPeriod,
                        waterColor: frontmatter.environment.waterColor ?? DEFAULT_CONFIG.waterColor,
                        wetlandColor: frontmatter.environment.wetlandColor ?? DEFAULT_CONFIG.wetlandColor,
                        mudflatColor: frontmatter.environment.mudflatColor ?? DEFAULT_CONFIG.mudflatColor,
                    };
                } else {
                    config = { ...DEFAULT_CONFIG };
                }
            });

            updateUI();
            notifyChange();
            logger.debug(`[EnvironmentPanel] Loaded config from ${mapFile.path}:`, config);
        } catch (error) {
            logger.error(`[EnvironmentPanel] Failed to load config from ${mapFile.path}:`, error);
            config = { ...DEFAULT_CONFIG };
            updateUI();
        }
    };

    /**
     * Save configuration to map frontmatter
     */
    const saveConfig = async (): Promise<void> => {
        try {
            await app.fileManager.processFrontMatter(mapFile, (frontmatter) => {
                frontmatter.environment = {
                    seaLevel: config.seaLevel,
                    tidalRange: config.tidalRange,
                    tidalPeriod: config.tidalPeriod,
                    waterColor: config.waterColor,
                    wetlandColor: config.wetlandColor,
                    mudflatColor: config.mudflatColor,
                };
            });

            logger.debug(`[EnvironmentPanel] Saved config to ${mapFile.path}:`, config);
        } catch (error) {
            logger.error(`[EnvironmentPanel] Failed to save config to ${mapFile.path}:`, error);
        }
    };

    /**
     * Get current configuration
     */
    const getConfig = (): EnvironmentConfig => {
        return { ...config };
    };

    /**
     * Set configuration and update UI
     */
    const setConfig = (partial: Partial<EnvironmentConfig>): void => {
        config = { ...config, ...partial };
        updateUI();
        notifyChange();
        scheduleSave();
    };

    /**
     * Register change callback
     */
    const onChange = (callback: (config: EnvironmentConfig) => void): void => {
        changeCallbacks.push(callback);
    };

    /**
     * Show/hide panel
     */
    const show = (): void => {
        ui.root.style.display = "block";
    };

    const hide = (): void => {
        ui.root.style.display = "none";
    };

    const toggle = (): void => {
        if (ui.root.style.display === "none") {
            show();
        } else {
            hide();
        }
    };

    const isVisible = (): boolean => {
        return ui.root.style.display !== "none";
    };

    /**
     * Get root element
     */
    const getElement = (): HTMLElement => {
        return ui.root;
    };

    /**
     * Cleanup
     */
    const destroy = (): void => {
        if (saveTimer) clearTimeout(saveTimer);
        if (ui.form) ui.form.destroy();
        if (dayCycleSimulator) dayCycleSimulator.destroy();
        ui.root.remove();
        changeCallbacks.length = 0;
        logger.debug("Destroyed");
    };

    // Initialize
    buildUI();
    loadConfig().catch((error) => {
        logger.error("Failed to initialize:", error);
    });

    // Create day cycle simulator (if render handles provided)
    if (renderHandles) {
        // Create simulator container after form
        const simulatorHost = ui.body.createDiv({ cls: "sm-environment-panel__simulator" });

        dayCycleSimulator = createDayCycleSimulator({
            host: simulatorHost,
            onTimeUpdate: (state) => {
                // Refresh tidal layer with simulated time
                renderHandles.refreshTidalLayerWithTime(state.currentTimeHours, state.dayOfYear);
                logger.debug(`[EnvironmentPanel] Tidal layer refreshed - Time: ${state.currentTimeHours.toFixed(2)}h, Day: ${state.dayOfYear}`);
            },
            initialTime: 12.0,    // Noon
            initialDay: 180,      // Mid-summer
        });

        logger.info("Day cycle simulator created");
    }

    return {
        getElement,
        loadConfig,
        saveConfig,
        getConfig,
        setConfig,
        onChange,
        show,
        hide,
        toggle,
        isVisible,
        destroy,
    };
}
