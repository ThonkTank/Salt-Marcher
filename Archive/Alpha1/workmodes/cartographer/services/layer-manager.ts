// src/workmodes/cartographer/services/layer-manager.ts
// Layer Management: Handles layer visibility, persistence, and configuration

import type { App, TFile } from "obsidian";
import { Notice } from "obsidian";
import { configurableLogger } from "@services/logging/configurable-logger";

const logger = configurableLogger.forModule("cartographer-layer-manager");
import type { LayerConfig, LayerControlPanelHandle } from "../components/layer-control-panel";
import type { RenderHandles } from "@features/maps/rendering/hex-render";
import { mapPanelLayerIdToOverlayLayerIds } from "../contracts/layer-id-mapping";
import {
    getContourRenderer,
    getHillshadeRenderer,
    clearContourRenderer,
    clearHillshadeRenderer,
    getHillshadeConfig,
    type ContourRenderer,
    type HillshadeRenderer,
} from "@features/maps/elevation";
import { createEnvironmentPanel } from "../components/environment-panel";
import type { EnvironmentPanelHandle } from "../components/environment-panel";

/**
 * Dependencies for LayerManager
 */
export interface LayerManagerDeps {
    app: App;
    plugin?: { settings: any; saveSettings(): Promise<void> };
    getLayerPanel: () => LayerControlPanelHandle | null;
    getHandles: () => RenderHandles | null;
}

/**
 * Manages layer visibility, persistence, and configuration
 *
 * Responsibilities:
 * - Load/save layer config from plugin settings
 * - Handle layer visibility changes (single and batch)
 * - Toggle layer panel visibility
 * - Apply layer presets
 * - Manage elevation renderers (contours and hillshade)
 * - Manage environment panel with day cycle integration
 */
export class LayerManager {
    private saveTimer: number | null = null;
    private panelVisible = true;

    // Elevation visualization
    private contourRenderer: ContourRenderer | null = null;
    private hillshadeRenderer: HillshadeRenderer | null = null;
    private environmentPanel: EnvironmentPanelHandle | null = null;

    constructor(private deps: LayerManagerDeps) {}

    /**
     * Create elevation renderers for a newly loaded map
     *
     * @param file - Map file
     * @param handles - RenderHandles from map layer
     * @param mapLayerHandles - MapLayer handles including sidebarHost
     */
    async createElevationRenderers(
        file: TFile,
        handles: RenderHandles,
        mapLayerHandles: RenderHandles & { sidebarHost: HTMLElement },
    ): Promise<void> {
        try {
            // Create contour and hillshade renderers
            this.contourRenderer = getContourRenderer(this.deps.app, file, handles.contentG);
            this.hillshadeRenderer = getHillshadeRenderer(this.deps.app, file, handles.contentG);
            logger.info("Elevation renderers created");

            // Create environment panel with day cycle integration
            if (handles.sidebarHost) {
                this.environmentPanel = createEnvironmentPanel(this.deps.app, file, {
                    refreshTidalLayerWithTime: (hours: number, day: number) => {
                        // Refresh tidal layer with simulated time
                        mapLayerHandles.refreshTidalLayerWithTime(hours, day);

                        // Update hillshade lighting based on celestial position (sun or moon)
                        if (this.hillshadeRenderer && this.hillshadeRenderer.isEnabled()) {
                            const config = getHillshadeConfig(day, hours);
                            if (config) {
                                // Celestial body is above horizon - update lighting
                                this.hillshadeRenderer.setStyle({
                                    azimuth: config.azimuth,
                                    altitude: config.altitude,
                                    opacity: config.intensity, // Dimmer for moon
                                });

                                const source = config.intensity >= 0.9 ? "Sun" : "Moon";
                                logger.debug(
                                    `[layer-manager] Updated hillshade lighting (${source}) - ` +
                                    `Azimuth: ${config.azimuth.toFixed(1)}°, ` +
                                    `Altitude: ${config.altitude.toFixed(1)}°, ` +
                                    `Intensity: ${(config.intensity * 100).toFixed(0)}%`
                                );
                            } else {
                                // No lighting available (both sun and moon below horizon)
                                logger.debug(`[layer-manager] No celestial lighting available at Day ${day}, Hour ${hours.toFixed(1)}`);
                            }
                        }
                    },
                });
                handles.sidebarHost.appendChild(this.environmentPanel.getElement());
                this.environmentPanel.show();
                logger.info("Environment panel created with day cycle integration");
            }
        } catch (error) {
            logger.warn("Failed to create environment panel", {
                mapPath: file?.path,
                error: error instanceof Error ? error.message : String(error),
            });
            // Non-fatal - continue loading map without environment panel
        }
    }

    /**
     * Load layer config from plugin settings and apply to panel
     */
    async loadConfig(): Promise<void> {
        if (!this.deps.plugin) return;

        const panel = this.deps.getLayerPanel();
        if (!panel) return;

        const savedConfig = this.deps.plugin.settings.cartographer?.layerConfig;

        if (savedConfig) {
            // Validate and merge with defaults (in case new layers were added)
            const defaultConfig = panel.getLayerConfig();
            const mergedConfig = this.mergeLayerConfig(defaultConfig, savedConfig);
            panel.setLayerConfig(mergedConfig);
            logger.info("Loaded layer config from settings", { layerCount: mergedConfig.length });
        }

        // Load custom presets
        const savedPresets = this.deps.plugin.settings.cartographer?.customPresets;
        if (savedPresets) {
            panel.loadCustomPresets(savedPresets);
            logger.info("Loaded custom presets from settings", { count: savedPresets.length });
        }

        // Load panel visibility state
        const panelVisible = this.deps.plugin.settings.cartographer?.layerPanelVisible ?? true;
        this.panelVisible = panelVisible;
    }

    /**
     * Handle single layer config change
     */
    handleConfigChange(layerId: string, config: LayerConfig): void {
        logger.info(`[layer-manager] Layer ${layerId} changed:`, config);

        // Save settings (debounced)
        this.saveDebounced();

        const handles = this.deps.getHandles();
        if (!handles) {
            logger.warn('No render handles available for layer change');
            return;
        }

        // Special handling for terrain layer (icon-based, not overlay-based)
        if (layerId === 'terrain') {
            handles.setIconLayerVisibility('terrain', config.visible);
            handles.setIconLayerVisibility('flora', config.visible);
            handles.setIconLayerOpacity('terrain', 1.0);
            handles.setIconLayerOpacity('flora', 1.0);
            logger.info(`[layer-manager] Updated terrain/flora icon layers`, { visible: config.visible });
            return;
        }

        // Handle elevation layer changes
        if (layerId === "elevation-contours") {
            this.handleContourLayerChange(config);
            return;
        } else if (layerId === "elevation-hillshade") {
            this.handleHillshadeLayerChange(config);
            return;
        }

        // Map panel layer IDs to overlay layer IDs and update all mapped layers
        const overlayLayerIds = mapPanelLayerIdToOverlayLayerIds(layerId);

        for (const overlayLayerId of overlayLayerIds) {
            handles.setLayerConfig(overlayLayerId, config.visible, 1.0);
            logger.info(`[layer-manager] Updated overlay layer ${overlayLayerId}`, { visible: config.visible });
        }
    }

    /**
     * Handle batch layer config changes (much more efficient for group operations)
     */
    handleConfigChangeBatch(changes: Array<{ layerId: string; config: LayerConfig }>): void {
        logger.info(`[layer-manager] Batch layer change`, { count: changes.length });

        // Save settings once (debounced)
        this.saveDebounced();

        const handles = this.deps.getHandles();
        if (!handles) {
            logger.warn('No render handles available for batch layer change');
            return;
        }

        // Group changes by type for efficient processing
        const terrainChanges: Array<{ config: LayerConfig }> = [];
        const elevationChanges: Array<{ layerId: string; config: LayerConfig }> = [];
        const overlayChanges: Array<{ layerId: string; overlayLayerIds: string[]; config: LayerConfig }> = [];

        for (const { layerId, config } of changes) {
            if (layerId === 'terrain') {
                terrainChanges.push({ config });
            } else if (layerId === "elevation-contours" || layerId === "elevation-hillshade") {
                elevationChanges.push({ layerId, config });
            } else {
                const overlayLayerIds = mapPanelLayerIdToOverlayLayerIds(layerId);
                if (overlayLayerIds.length > 0) {
                    overlayChanges.push({ layerId, overlayLayerIds, config });
                } else {
                    logger.debug(`[layer-manager] Skipping layer with no overlay mapping: ${layerId}`);
                }
            }
        }

        // Apply terrain changes (all at once, they share the same visibility)
        if (terrainChanges.length > 0) {
            const config = terrainChanges[terrainChanges.length - 1].config; // Use last config
            handles.setIconLayerVisibility('terrain', config.visible);
            handles.setIconLayerVisibility('flora', config.visible);
            handles.setIconLayerOpacity('terrain', 1.0);
            handles.setIconLayerOpacity('flora', 1.0);
            logger.info(`[layer-manager] Batch updated terrain/flora icon layers`, { visible: config.visible });
        }

        // Apply elevation changes
        if (elevationChanges.length > 0) {
            for (const { layerId, config } of elevationChanges) {
                if (layerId === "elevation-contours") {
                    this.handleContourLayerChange(config);
                } else if (layerId === "elevation-hillshade") {
                    this.handleHillshadeLayerChange(config);
                }
            }
        }

        // Apply overlay changes (batch these together for better performance)
        for (const { overlayLayerIds, config } of overlayChanges) {
            for (const overlayLayerId of overlayLayerIds) {
                handles.setLayerConfig(overlayLayerId, config.visible, 1.0);
            }
        }

        if (overlayChanges.length > 0) {
            const totalLayers = overlayChanges.reduce((sum, c) => sum + c.overlayLayerIds.length, 0);
            logger.info(`[layer-manager] Batch updated ${totalLayers} overlay layers`);
        }
    }

    /**
     * Toggle layer panel visibility
     */
    togglePanel(leftSidebarHost: HTMLElement | null): void {
        this.panelVisible = !this.panelVisible;

        if (leftSidebarHost) {
            if (this.panelVisible) {
                leftSidebarHost.removeClass('is-collapsed');
            } else {
                leftSidebarHost.addClass('is-collapsed');
            }
        }

        logger.info('Layer panel toggled', { visible: this.panelVisible });

        // Save panel state immediately (not debounced)
        this.save().catch(error => {
            logger.error("Failed to save panel state", error);
        });
    }

    /**
     * Toggle single layer visibility
     */
    toggleLayer(layerId: string): void {
        const panel = this.deps.getLayerPanel();
        if (!panel) return;

        const config = panel.getLayerConfig() ?? [];
        const layer = this.findLayerById(config, layerId);
        if (layer) {
            layer.visible = !layer.visible;
            panel.setLayerConfig(config);
            logger.info('Layer toggled', { layerId, visible: layer.visible });

            // Save settings (debounced)
            this.saveDebounced();
        }
    }

    /**
     * Apply a layer preset
     */
    applyPreset(presetId: string): void {
        // Placeholder for Phase 16.2
        logger.info(`[layer-manager] Apply preset: ${presetId}`);
        new Notice(`Layer preset "${presetId}" will be available in Phase 16.2`);
    }

    /**
     * Get current panel visibility state
     */
    isPanelVisible(): boolean {
        return this.panelVisible;
    }

    /**
     * Clean up elevation renderers and environment panel
     */
    destroyElevationRenderers(file: TFile | null): void {
        // Clear elevation renderers
        if (file) {
            if (this.contourRenderer) {
                clearContourRenderer(file);
                this.contourRenderer = null;
            }
            if (this.hillshadeRenderer) {
                clearHillshadeRenderer(file);
                this.hillshadeRenderer = null;
            }
            logger.info("Elevation renderers cleared");
        }

        // Destroy environment panel
        if (this.environmentPanel) {
            this.environmentPanel.destroy();
            this.environmentPanel = null;
            logger.info("Environment panel destroyed");
        }
    }

    /**
     * Get contour renderer (if available)
     */
    getContourRenderer(): ContourRenderer | null {
        return this.contourRenderer;
    }

    /**
     * Get hillshade renderer (if available)
     */
    getHillshadeRenderer(): HillshadeRenderer | null {
        return this.hillshadeRenderer;
    }

    /**
     * Get environment panel (if available)
     */
    getEnvironmentPanel(): EnvironmentPanelHandle | null {
        return this.environmentPanel;
    }

    /**
     * Cleanup (cancel pending save)
     */
    destroy(): void {
        this.cancelPendingSave();
    }

    // ==================== Private Methods ====================

    private cancelPendingSave(): void {
        if (this.saveTimer !== null) {
            window.clearTimeout(this.saveTimer);
            this.saveTimer = null;
        }
    }

    private saveDebounced(): void {
        this.cancelPendingSave();
        this.saveTimer = window.setTimeout(() => {
            this.save().catch(error => {
                logger.error("Failed to save layer config", error);
            });
            this.saveTimer = null;
        }, 500);
    }

    private async save(): Promise<void> {
        if (!this.deps.plugin) {
            logger.info("Cannot save layer config - no plugin instance");
            return;
        }

        const panel = this.deps.getLayerPanel();
        if (!panel) {
            logger.info("Cannot save layer config - no panel available");
            return;
        }

        const config = panel.getLayerConfig();
        if (!config) {
            logger.info("Cannot save layer config - no config available");
            return;
        }

        // Get custom presets for persistence
        const customPresets = panel.getCustomPresets();

        if (!this.deps.plugin.settings.cartographer) {
            this.deps.plugin.settings.cartographer = {};
        }

        this.deps.plugin.settings.cartographer.layerConfig = config;
        this.deps.plugin.settings.cartographer.customPresets = customPresets;
        this.deps.plugin.settings.cartographer.layerPanelVisible = this.panelVisible;

        await this.deps.plugin.saveSettings();
        logger.info("Saved layer config to settings", {
            layerCount: config.length,
            customPresetsCount: customPresets.length,
            panelVisible: this.panelVisible
        });
    }

    private mergeLayerConfig(
        defaultConfig: LayerConfig[],
        savedConfig: LayerConfig[]
    ): LayerConfig[] {
        const merged: LayerConfig[] = [];

        for (const defaultLayer of defaultConfig) {
            const savedLayer = savedConfig.find(l => l.id === defaultLayer.id);

            if (savedLayer) {
                // Merge saved settings with defaults (preserve user changes)
                merged.push({
                    ...defaultLayer,
                    visible: savedLayer.visible,
                    children: defaultLayer.children && savedLayer.children
                        ? this.mergeLayerConfig(defaultLayer.children, savedLayer.children)
                        : defaultLayer.children
                });
            } else {
                // New layer added since last save, use defaults
                merged.push(defaultLayer);
            }
        }

        return merged;
    }

    private findLayerById(config: LayerConfig[], id: string): LayerConfig | null {
        for (const layer of config) {
            if (layer.id === id) return layer;
            if (layer.children) {
                const found = this.findLayerById(layer.children, id);
                if (found) return found;
            }
        }
        return null;
    }

    private handleContourLayerChange(config: LayerConfig): void {
        if (!this.contourRenderer) {
            return;
        }

        if (config.visible && !this.contourRenderer.isEnabled()) {
            // Enable with default config
            void this.contourRenderer.enable({
                interval: 100,
                majorInterval: 500,
                smoothing: 1,
            }).then(() => {
                this.contourRenderer!.setStyle({ opacity: 1.0 });
                logger.info(`[layer-manager] Enabled contour renderer`);
            });
        } else if (!config.visible && this.contourRenderer.isEnabled()) {
            this.contourRenderer.disable();
            logger.info(`[layer-manager] Disabled contour renderer`);
        } else if (config.visible && this.contourRenderer.isEnabled()) {
            // Just update opacity
            this.contourRenderer.setStyle({ opacity: 1.0 });
            logger.info(`[layer-manager] Updated contour opacity to 100%`);
        }
    }

    private handleHillshadeLayerChange(config: LayerConfig): void {
        if (!this.hillshadeRenderer) {
            return;
        }

        if (config.visible && !this.hillshadeRenderer.isEnabled()) {
            // Enable with default config (azimuth/altitude will be set by day cycle)
            void this.hillshadeRenderer.enable({
                azimuth: 315,
                altitude: 45,
                zFactor: 1.0,
            }).then(() => {
                this.hillshadeRenderer!.setStyle({ opacity: 1.0 });
                logger.info(`[layer-manager] Enabled hillshade renderer`);
            });
        } else if (!config.visible && this.hillshadeRenderer.isEnabled()) {
            this.hillshadeRenderer.disable();
            logger.info(`[layer-manager] Disabled hillshade renderer`);
        } else if (config.visible && this.hillshadeRenderer.isEnabled()) {
            // Just update opacity
            this.hillshadeRenderer.setStyle({ opacity: 1.0 });
            logger.info(`[layer-manager] Updated hillshade opacity to 100%`);
        }
    }
}
