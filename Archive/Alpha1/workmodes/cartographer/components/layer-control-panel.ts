// src/workmodes/cartographer/components/layer-control-panel.ts
// Hierarchical layer visibility and opacity controls for map overlays
//
// REDESIGNED: Phase 2 - Purpose-based organization with dynamic layer discovery

import type { App } from "obsidian";
import { configurableLogger } from "@services/logging/configurable-logger";

const logger = configurableLogger.forModule("cartographer-layer-control-panel");
import { LifecycleManager } from "@services/app-lifecycle-manager";
import { createPresetManager, type PresetManager, type LayerPreset } from "./layer-presets";
import { LAYER_REGISTRY, LAYER_GROUP, getLayersByGroup, getVisibleLayers } from "@features/maps";

/**
 * Layer configuration with visibility and hierarchical structure
 */
export interface LayerConfig {
    id: string;
    label: string;
    visible: boolean;
    color?: string;
    children?: LayerConfig[];
    priority?: number;
}

/**
 * Layer group configuration for organizing related layers
 */
export interface LayerGroup {
    id: string;
    label: string;
    children: LayerConfig[];
    collapsible: boolean;
}

/**
 * Public API for layer control panel
 */
export interface LayerControlPanelHandle {
    mount(parentElement: HTMLElement): void;
    destroy(): void;
    getLayerConfig(): LayerConfig[];
    setLayerConfig(config: LayerConfig[]): void;
    onLayerChange(callback: (layerId: string, config: LayerConfig) => void): void;
    /** Batch notification callback for group operations (much more efficient) */
    onLayerChangeBatch(callback: (changes: Array<{ layerId: string; config: LayerConfig }>) => void): void;
    /** Get configuration for a specific layer by ID */
    getLayerConfigById(layerId: string): LayerConfig | null;
    /** Set configuration for a specific layer by ID */
    setLayerConfigById(layerId: string, config: Partial<Pick<LayerConfig, 'visible'>>): void;
    /** Load custom presets from storage */
    loadCustomPresets(presets: LayerPreset[]): void;
    /** Get custom presets for persistence */
    getCustomPresets(): LayerPreset[];
}

type LayerChangeCallback = (layerId: string, config: LayerConfig) => void;
type LayerChangeBatchCallback = (changes: Array<{ layerId: string; config: LayerConfig }>) => void;

/**
 * Build layer configuration from registry definition
 * Converts registry LayerDefinition to panel LayerConfig
 *
 * @param layerDef Registry layer definition
 * @param filterHidden If true, skip hidden children (default: true)
 */
function buildLayerConfig(layerDef: typeof LAYER_REGISTRY[number], filterHidden = true): LayerConfig | null {
    // Skip hidden layers when filtering is enabled
    if (filterHidden && layerDef.panelConfig.hidden) {
        return null;
    }

    const config: LayerConfig = {
        id: layerDef.id,
        label: layerDef.panelConfig.label,
        visible: layerDef.panelConfig.visible,
        color: layerDef.panelConfig.color,
        priority: layerDef.priority,
    };

    // Add children if specified in panel config (filter out hidden children)
    if (layerDef.panelConfig.children) {
        config.children = layerDef.panelConfig.children
            .map(childId => {
                const childDef = LAYER_REGISTRY.find(l => l.id === childId);
                if (!childDef) {
                    logger.warn(`Child layer not found in registry: ${childId}`);
                    return null;
                }
                // Recursively build, respecting hidden filter
                return buildLayerConfig(childDef, filterHidden);
            })
            .filter((c): c is LayerConfig => c !== null);

        // If all children are hidden, don't show this parent either
        if (config.children.length === 0) {
            return null;
        }
    }

    return config;
}

/**
 * Generate default layer groups from registry
 * Single source of truth - derived from layer-registry.ts
 *
 * Only includes visible layers (hidden: false or undefined)
 */
function generateDefaultLayerGroups(): LayerGroup[] {
    const groups: LayerGroup[] = [
        {
            id: LAYER_GROUP.BASE,
            label: "Base Layers",
            collapsible: false,
            children: getLayersByGroup(LAYER_GROUP.BASE)
                .filter(layer => !layer.panelConfig.parentOnly && !layer.panelConfig.hidden)
                .map(layer => buildLayerConfig(layer))
                .filter((c): c is LayerConfig => c !== null),
        },
        {
            id: LAYER_GROUP.ENVIRONMENT,
            label: "Environment",
            collapsible: true,
            children: getLayersByGroup(LAYER_GROUP.ENVIRONMENT)
                .filter(layer => !layer.panelConfig.parentOnly && !layer.panelConfig.children && !layer.panelConfig.hidden)
                .map(layer => buildLayerConfig(layer))
                .filter((c): c is LayerConfig => c !== null),
        },
        {
            id: LAYER_GROUP.HUMAN_GEOGRAPHY,
            label: "Human Geography",
            collapsible: true,
            children: getLayersByGroup(LAYER_GROUP.HUMAN_GEOGRAPHY)
                .filter(layer => !layer.panelConfig.parentOnly && !layer.panelConfig.children && !layer.panelConfig.hidden)
                .map(layer => buildLayerConfig(layer))
                .filter((c): c is LayerConfig => c !== null),
        },
        {
            id: LAYER_GROUP.MARKERS,
            label: "Markers & Indicators",
            collapsible: true,
            children: getLayersByGroup(LAYER_GROUP.MARKERS)
                .filter(layer => !layer.panelConfig.parentOnly && !layer.panelConfig.hidden)
                .map(layer => buildLayerConfig(layer))
                .filter((c): c is LayerConfig => c !== null),
        },
    ];

    // Add parent layers with children (only if not hidden and have visible children)
    // Climate parent
    const climateLayer = LAYER_REGISTRY.find(l => l.id === 'climate');
    if (climateLayer && !climateLayer.panelConfig.hidden) {
        const envGroup = groups.find(g => g.id === LAYER_GROUP.ENVIRONMENT);
        const climateConfig = buildLayerConfig(climateLayer);
        if (envGroup && climateConfig) {
            envGroup.children.unshift(climateConfig);
        }
    }

    // Terrain features parent
    const terrainFeaturesLayer = LAYER_REGISTRY.find(l => l.id === 'terrain-features');
    if (terrainFeaturesLayer && !terrainFeaturesLayer.panelConfig.hidden) {
        const humanGeoGroup = groups.find(g => g.id === LAYER_GROUP.HUMAN_GEOGRAPHY);
        const terrainFeaturesConfig = buildLayerConfig(terrainFeaturesLayer);
        if (humanGeoGroup && terrainFeaturesConfig) {
            humanGeoGroup.children.unshift(terrainFeaturesConfig);
        }
    }

    // Filter out empty groups
    return groups.filter(group => group.children.length > 0);
}

/**
 * Default layer configuration organized by purpose
 *
 * GENERATED FROM LAYER REGISTRY - DO NOT EDIT MANUALLY
 * To modify layers, edit src/features/maps/overlay/layer-registry.ts
 *
 * STRUCTURE:
 * - Group 1: Base Layers (terrain icons)
 * - Group 2: Environment (weather, elevation visualization)
 * - Group 3: Human Geography (terrain features, factions, influence)
 * - Group 4: Markers & Indicators (locations, buildings)
 */
export const DEFAULT_LAYER_GROUPS: LayerGroup[] = generateDefaultLayerGroups();

/**
 * Flatten layer groups into flat config list for backward compatibility
 */
function flattenLayerGroups(groups: LayerGroup[]): LayerConfig[] {
    const result: LayerConfig[] = [];

    for (const group of groups) {
        for (const layer of group.children) {
            result.push(layer);
        }
    }

    return result;
}

/**
 * Internal state for layer control panel
 */
type PanelState = {
    app: App;
    groups: LayerGroup[];
    callbacks: LayerChangeCallback[];
    batchCallbacks: LayerChangeBatchCallback[];
    collapsed: boolean;
    expandedGroups: Set<string>;
    expandedLayers: Set<string>;
    presetManager: PresetManager;
    selectedPreset: string | null;
};

/**
 * Internal UI element references
 */
type PanelUI = {
    root: HTMLElement | null;
    header: HTMLElement | null;
    collapseButton: HTMLButtonElement | null;
    resetButton: HTMLButtonElement | null;
    presetDropdown: HTMLSelectElement | null;
    savePresetButton: HTMLButtonElement | null;
    body: HTMLElement | null;
    groupsContainer: HTMLElement | null;
};

/**
 * Create layer control panel with hierarchical visibility and opacity controls
 */
export function createLayerControlPanel(app: App): LayerControlPanelHandle {
    // Lifecycle management for proper cleanup of event listeners and callbacks
    const lifecycle = new LifecycleManager();

    const state: PanelState = {
        app,
        groups: JSON.parse(JSON.stringify(DEFAULT_LAYER_GROUPS)), // Deep clone
        callbacks: [],
        batchCallbacks: [],
        collapsed: false,
        expandedGroups: new Set(["environment", "human-geography"]),
        expandedLayers: new Set(["terrain-features", "climate"]),
        presetManager: null as any, // Initialize after onApplyPreset
        selectedPreset: null,
    };

    // Initialize preset manager
    state.presetManager = createPresetManager((config) => {
        applyPresetConfig(config);
    });

    const ui: PanelUI = {
        root: null,
        header: null,
        collapseButton: null,
        resetButton: null,
        presetDropdown: null,
        savePresetButton: null,
        body: null,
        groupsContainer: null,
    };

    // ==================== Rendering ====================

    function render() {
        if (!ui.root || !ui.groupsContainer) {
            logger.warn("cannot render, not mounted");
            return;
        }

        // Clear existing content
        ui.groupsContainer.empty();

        // Render all groups
        for (const group of state.groups) {
            renderGroup(ui.groupsContainer, group);
        }

        // Update preset dropdown selection
        updatePresetDropdown();
    }

    function renderGroup(container: HTMLElement, group: LayerGroup) {
        const isExpanded = state.expandedGroups.has(group.id);

        // Group container
        const groupContainer = container.createDiv({ cls: "sm-layer-group" });

        // Group header
        const groupHeader = groupContainer.createDiv({ cls: "sm-layer-group__header" });
        if (group.collapsible) {
            groupHeader.style.cursor = "pointer";
            groupHeader.addEventListener("click", () => toggleGroupExpansion(group.id));
        }

        // Expand/collapse icon (only for collapsible groups)
        if (group.collapsible) {
            const expandIcon = groupHeader.createDiv({ cls: "sm-layer-group__expand-icon" });
            expandIcon.textContent = "▶";
            if (isExpanded) {
                expandIcon.addClass("is-expanded");
            }
        }

        // Group label
        const groupLabel = groupHeader.createDiv({ cls: "sm-layer-group__label" });
        groupLabel.textContent = group.label;

        // Bulk actions for group
        if (group.collapsible) {
            const bulkActions = groupHeader.createDiv({ cls: "sm-layer-group__bulk-actions" });

            const showAllBtn = bulkActions.createEl("button", {
                cls: "sm-btn sm-btn--ghost sm-btn--tiny",
                text: "All",
                attr: { "aria-label": "Show all layers in group", title: "Show all layers" }
            });
            showAllBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                toggleGroupLayers(group, true);
            });

            const hideAllBtn = bulkActions.createEl("button", {
                cls: "sm-btn sm-btn--ghost sm-btn--tiny",
                text: "None",
                attr: { "aria-label": "Hide all layers in group", title: "Hide all layers" }
            });
            hideAllBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                toggleGroupLayers(group, false);
            });
        }

        // Group body (layers)
        if (!group.collapsible || isExpanded) {
            const groupBody = groupContainer.createDiv({ cls: "sm-layer-group__body" });

            for (const layer of group.children) {
                renderLayer(groupBody, layer, 0);
            }
        }
    }

    function renderLayer(container: HTMLElement, layer: LayerConfig, depth: number) {
        const isParent = layer.children && layer.children.length > 0;
        const isExpanded = state.expandedLayers.has(layer.id);

        // Layer item
        const layerItem = container.createDiv({ cls: "sm-layer-item" });
        layerItem.style.paddingLeft = `${depth * 12}px`;

        if (layer.visible) {
            layerItem.addClass("is-active");
        }

        // Layer header
        const header = layerItem.createDiv({ cls: "sm-layer-item__header" });

        if (isParent) {
            header.style.cursor = "pointer";
            header.addEventListener("click", () => toggleLayerExpansion(layer.id));
        }

        // Expand/collapse icon (only for parent layers)
        if (isParent) {
            const expandIcon = header.createDiv({ cls: "sm-layer-item__expand-icon" });
            expandIcon.textContent = "▶";
            if (isExpanded) {
                expandIcon.addClass("is-expanded");
            }
        }

        // Visibility checkbox
        const checkbox = header.createEl("input", {
            cls: "sm-layer-item__checkbox",
            type: "checkbox",
        });
        checkbox.checked = layer.visible;
        checkbox.addEventListener("change", (e) => {
            e.stopPropagation();
            handleVisibilityChange(layer, checkbox.checked);
        });

        // Color indicator
        if (layer.color) {
            const colorDot = header.createDiv({ cls: "sm-layer-item__color" });
            colorDot.style.backgroundColor = layer.color;
        }

        // Layer label
        const label = header.createDiv({ cls: "sm-layer-item__label" });
        label.textContent = layer.label;
        if (!layer.visible) {
            label.addClass("is-disabled");
        }

        // Children container (for parent layers)
        if (isParent && isExpanded) {
            for (const child of layer.children!) {
                renderLayer(layerItem, child, depth + 1);
            }
        }
    }

    // ==================== Event Handlers ====================

    function handleVisibilityChange(layer: LayerConfig, visible: boolean) {
        layer.visible = visible;

        // If parent layer, update all children
        if (layer.children) {
            for (const child of layer.children) {
                child.visible = visible;
            }
        }

        // Re-render to update UI
        render();

        // Notify callbacks
        notifyChange(layer.id, layer);

        // If parent, notify for all children too
        if (layer.children) {
            for (const child of layer.children) {
                notifyChange(child.id, child);
            }
        }

        // Clear preset selection (user made manual change)
        state.selectedPreset = null;

        logger.info("visibility changed", { layerId: layer.id, visible });
    }

    function toggleLayerExpansion(layerId: string) {
        if (state.expandedLayers.has(layerId)) {
            state.expandedLayers.delete(layerId);
        } else {
            state.expandedLayers.add(layerId);
        }

        render();
    }

    function toggleGroupExpansion(groupId: string) {
        if (state.expandedGroups.has(groupId)) {
            state.expandedGroups.delete(groupId);
        } else {
            state.expandedGroups.add(groupId);
        }

        render();
    }

    function toggleGroupLayers(group: LayerGroup, visible: boolean) {
        // Collect all layer changes for batch notification
        const changes: Array<{ layerId: string; config: LayerConfig }> = [];

        for (const layer of group.children) {
            layer.visible = visible;
            changes.push({ layerId: layer.id, config: layer });

            // Also update children
            if (layer.children) {
                for (const child of layer.children) {
                    child.visible = visible;
                    changes.push({ layerId: child.id, config: child });
                }
            }
        }

        // Re-render
        render();

        // Notify all changed layers in batch (much more efficient)
        notifyBatchChange(changes);

        // Clear preset selection
        state.selectedPreset = null;

        logger.info("group layers toggled", { groupId: group.id, visible, layerCount: changes.length });
    }

    function handleCollapseToggle() {
        state.collapsed = !state.collapsed;

        if (ui.root && ui.collapseButton) {
            if (state.collapsed) {
                ui.root.addClass("sm-layer-panel--collapsed");
                ui.collapseButton.textContent = "▶"; // Right arrow = expand
            } else {
                ui.root.removeClass("sm-layer-panel--collapsed");
                ui.collapseButton.textContent = "◀"; // Left arrow = collapse
            }
        }

        logger.info("panel collapsed", { collapsed: state.collapsed });
    }

    function handleReset() {
        // Reset to default configuration
        state.groups = JSON.parse(JSON.stringify(DEFAULT_LAYER_GROUPS));
        state.expandedGroups.clear();
        state.expandedGroups.add("environment");
        state.expandedGroups.add("human-geography");
        state.expandedLayers.clear();
        state.expandedLayers.add("terrain-features");
        state.expandedLayers.add("climate");
        state.selectedPreset = null;

        render();

        // Notify all layers changed
        forEachLayer((layer) => {
            notifyChange(layer.id, layer);
        });

        logger.info("reset to default configuration");
    }

    function handlePresetChange(presetId: string) {
        if (!presetId) {
            state.selectedPreset = null;
            return;
        }

        state.selectedPreset = presetId;
        state.presetManager.applyPreset(presetId);
        logger.info("preset applied", { presetId });
    }

    function handleSavePreset() {
        const name = prompt("Enter preset name:");
        if (!name) return;

        const description = prompt("Enter preset description (optional):") || "";

        // Build config from current state
        const config: Record<string, { visible: boolean }> = {};
        forEachLayer((layer) => {
            config[layer.id] = {
                visible: layer.visible,
            };
        });

        state.presetManager.saveCustomPreset(name, description, config);
        state.selectedPreset = null;

        // Update dropdown
        updatePresetDropdown();

        logger.info("custom preset saved", { name });
    }

    function applyPresetConfig(config: Record<string, { visible: boolean }>) {
        // Apply config to all layers
        forEachLayer((layer) => {
            const layerConfig = config[layer.id];
            if (layerConfig) {
                layer.visible = layerConfig.visible;
            }
        });

        // Re-render
        render();

        // Notify all layers
        forEachLayer((layer) => {
            notifyChange(layer.id, layer);
        });
    }

    function updatePresetDropdown() {
        if (!ui.presetDropdown) return;

        // Clear existing options
        ui.presetDropdown.empty();

        // Add default option
        const defaultOption = ui.presetDropdown.createEl("option", {
            value: "",
            text: "-- Select Preset --",
        });

        // Add built-in presets
        const presets = state.presetManager.getPresets();
        for (const preset of presets) {
            const option = ui.presetDropdown.createEl("option", {
                value: preset.id,
                text: preset.name,
            });
            option.title = preset.description;

            if (state.selectedPreset === preset.id) {
                option.selected = true;
            }
        }
    }

    // ==================== Helper Functions ====================

    function forEachLayer(callback: (layer: LayerConfig) => void) {
        function visit(layer: LayerConfig) {
            callback(layer);
            if (layer.children) {
                for (const child of layer.children) {
                    visit(child);
                }
            }
        }

        for (const group of state.groups) {
            for (const layer of group.children) {
                visit(layer);
            }
        }
    }

    function findLayerById(layerId: string): LayerConfig | null {
        let result: LayerConfig | null = null;

        forEachLayer((layer) => {
            if (layer.id === layerId) {
                result = layer;
            }
        });

        return result;
    }

    function notifyChange(layerId: string, config: LayerConfig) {
        for (const callback of state.callbacks) {
            try {
                callback(layerId, config);
            } catch (error) {
                logger.error("callback error", { layerId, error });
            }
        }
    }

    function notifyBatchChange(changes: Array<{ layerId: string; config: LayerConfig }>) {
        // If batch callbacks registered, use them (much more efficient)
        if (state.batchCallbacks.length > 0) {
            for (const callback of state.batchCallbacks) {
                try {
                    callback(changes);
                } catch (error) {
                    logger.error("batch callback error", { changeCount: changes.length, error });
                }
            }
        } else {
            // Fallback to individual notifications if no batch callbacks registered
            for (const { layerId, config } of changes) {
                notifyChange(layerId, config);
            }
        }
    }

    // ==================== Public API ====================

    function mount(parentElement: HTMLElement) {
        if (ui.root) {
            logger.warn("already mounted");
            return;
        }

        // Create panel structure
        ui.root = parentElement.createDiv({ cls: "sm-layer-panel" });

        // Header
        ui.header = ui.root.createDiv({ cls: "sm-layer-panel__header" });

        const title = ui.header.createDiv({ cls: "sm-layer-panel__title" });
        title.textContent = "Layer Controls";

        const actions = ui.header.createDiv({ cls: "sm-layer-panel__actions" });

        ui.resetButton = actions.createEl("button", {
            cls: "sm-btn sm-btn--ghost sm-btn--small",
            text: "Reset",
            attr: { "aria-label": "Reset to default" }
        });
        lifecycle.addEventListener(ui.resetButton, "click", handleReset);

        ui.collapseButton = actions.createEl("button", {
            cls: "sm-layer-panel__collapse-btn",
            text: "◀",
            attr: { "aria-label": "Collapse panel" }
        });
        lifecycle.addEventListener(ui.collapseButton, "click", handleCollapseToggle);

        // Preset controls
        const presetRow = ui.root.createDiv({ cls: "sm-layer-panel__presets" });

        ui.presetDropdown = presetRow.createEl("select", {
            cls: "sm-preset-dropdown",
            attr: { "aria-label": "Select layer preset" }
        });
        lifecycle.addEventListener(ui.presetDropdown, "change", () => {
            handlePresetChange(ui.presetDropdown!.value);
        });

        ui.savePresetButton = presetRow.createEl("button", {
            cls: "sm-btn sm-btn--ghost sm-btn--small",
            text: "Save",
            attr: { "aria-label": "Save current configuration as preset" }
        });
        lifecycle.addEventListener(ui.savePresetButton, "click", handleSavePreset);

        // Body
        ui.body = ui.root.createDiv({ cls: "sm-layer-panel__body" });

        // Groups container
        ui.groupsContainer = ui.body.createDiv({ cls: "sm-layer-groups" });

        // Initial render
        render();

        logger.info("mounted");
    }

    function destroy() {
        // Clear callbacks
        state.callbacks = [];
        state.batchCallbacks = [];

        // Clean up event listeners and other resources
        lifecycle.cleanup();

        // Remove DOM
        if (ui.root) {
            ui.root.remove();
        }

        // Clear references
        ui.root = null;
        ui.header = null;
        ui.collapseButton = null;
        ui.resetButton = null;
        ui.presetDropdown = null;
        ui.savePresetButton = null;
        ui.body = null;
        ui.groupsContainer = null;

        logger.info("destroyed");
    }

    function getLayerConfig(): LayerConfig[] {
        return flattenLayerGroups(state.groups);
    }

    function setLayerConfig(config: LayerConfig[]) {
        // Reconstruct groups from flat config (backward compatibility)
        // For now, just update existing layers by ID
        forEachLayer((layer) => {
            const match = config.find(c => c.id === layer.id);
            if (match) {
                layer.visible = match.visible;
            }
        });

        render();
        logger.info("configuration updated");
    }

    function onLayerChange(callback: LayerChangeCallback) {
        state.callbacks.push(callback);
    }

    function onLayerChangeBatch(callback: LayerChangeBatchCallback) {
        state.batchCallbacks.push(callback);
    }

    function getLayerConfigById(layerId: string): LayerConfig | null {
        return findLayerById(layerId);
    }

    function setLayerConfigById(layerId: string, config: Partial<Pick<LayerConfig, 'visible'>>): void {
        const layer = findLayerById(layerId);
        if (!layer) {
            logger.warn("Layer not found", { layerId });
            return;
        }

        // Update config
        if (config.visible !== undefined) layer.visible = config.visible;

        // Trigger re-render and callbacks
        render();
        notifyChange(layerId, layer);
    }

    function loadCustomPresets(presets: LayerPreset[]): void {
        state.presetManager.loadCustomPresets(presets);
        updatePresetDropdown();
        logger.info("custom presets loaded", { count: presets.length });
    }

    function getCustomPresets(): LayerPreset[] {
        return state.presetManager.getCustomPresets();
    }

    return {
        mount,
        destroy,
        getLayerConfig,
        setLayerConfig,
        onLayerChange,
        onLayerChangeBatch,
        getLayerConfigById,
        setLayerConfigById,
        loadCustomPresets,
        getCustomPresets,
    };
}
