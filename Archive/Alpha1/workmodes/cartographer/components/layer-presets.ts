// src/workmodes/cartographer/components/layer-presets.ts
// Layer visibility presets for quick map view switching

import { configurableLogger } from "@services/logging/configurable-logger";

const logger = configurableLogger.forModule("cartographer-layer-presets");

export interface LayerPreset {
    id: string;
    name: string;
    description: string;
    config: Record<string, { visible: boolean; opacity: number }>;
}

/**
 * Built-in layer presets
 */
export const BUILT_IN_PRESETS: LayerPreset[] = [
    {
        id: "clean-view",
        name: "Clean View",
        description: "Terrain and markers only - perfect for exploration",
        config: {
            // Base Layers
            "terrain": { visible: true, opacity: 25 },

            // Environment - mostly off
            "weather": { visible: false, opacity: 80 },
            "sea-level": { visible: false, opacity: 60 },
            "water-bodies": { visible: false, opacity: 60 },
            "wetlands": { visible: false, opacity: 60 },
            "tidal-zones": { visible: false, opacity: 50 },
            "elevation-hillshade": { visible: false, opacity: 50 },
            "elevation-contours": { visible: false, opacity: 60 },
            "elevation-gradient": { visible: false, opacity: 70 },
            "moisture-gradient": { visible: false, opacity: 60 },

            // Human Geography - minimal
            "elevation-line": { visible: false, opacity: 40 },
            "river": { visible: true, opacity: 80 },
            "road": { visible: true, opacity: 70 },
            "cliff": { visible: false, opacity: 90 },
            "border": { visible: false, opacity: 60 },
            "faction-overlay": { visible: false, opacity: 55 },
            "location-influence": { visible: false, opacity: 35 },

            // Markers & Indicators - on
            "location-marker": { visible: true, opacity: 100 },
            "building-indicator": { visible: true, opacity: 100 },
        }
    },
    {
        id: "full-detail",
        name: "Full Detail",
        description: "All layers enabled - comprehensive visualization",
        config: {
            "terrain": { visible: true, opacity: 25 },
            "weather": { visible: true, opacity: 80 },
            "sea-level": { visible: true, opacity: 60 },
            "water-bodies": { visible: true, opacity: 60 },
            "wetlands": { visible: true, opacity: 60 },
            "tidal-zones": { visible: true, opacity: 50 },
            "elevation-hillshade": { visible: true, opacity: 50 },
            "elevation-contours": { visible: true, opacity: 60 },
            "elevation-gradient": { visible: true, opacity: 70 },
            "moisture-gradient": { visible: true, opacity: 60 },
            "elevation-line": { visible: true, opacity: 40 },
            "river": { visible: true, opacity: 80 },
            "road": { visible: true, opacity: 70 },
            "cliff": { visible: true, opacity: 90 },
            "border": { visible: true, opacity: 60 },
            "faction-overlay": { visible: true, opacity: 55 },
            "location-influence": { visible: true, opacity: 35 },
            "location-marker": { visible: true, opacity: 100 },
            "building-indicator": { visible: true, opacity: 100 },
        }
    },
    {
        id: "tactical",
        name: "Tactical",
        description: "Terrain features + factions + locations - for combat and planning",
        config: {
            "terrain": { visible: true, opacity: 25 },
            "weather": { visible: false, opacity: 80 },
            "sea-level": { visible: false, opacity: 60 },
            "water-bodies": { visible: false, opacity: 60 },
            "wetlands": { visible: false, opacity: 60 },
            "tidal-zones": { visible: false, opacity: 50 },
            "elevation-hillshade": { visible: false, opacity: 50 },
            "elevation-contours": { visible: false, opacity: 60 },
            "elevation-gradient": { visible: false, opacity: 70 },
            "moisture-gradient": { visible: false, opacity: 60 },
            "elevation-line": { visible: true, opacity: 40 },
            "river": { visible: true, opacity: 80 },
            "road": { visible: true, opacity: 70 },
            "cliff": { visible: true, opacity: 90 },
            "border": { visible: true, opacity: 60 },
            "faction-overlay": { visible: true, opacity: 55 },
            "location-influence": { visible: true, opacity: 35 },
            "location-marker": { visible: true, opacity: 100 },
            "building-indicator": { visible: true, opacity: 100 },
        }
    },
    {
        id: "environmental",
        name: "Environmental",
        description: "Weather + water + elevation - nature focus",
        config: {
            "terrain": { visible: true, opacity: 25 },
            "weather": { visible: true, opacity: 80 },
            "sea-level": { visible: true, opacity: 60 },
            "water-bodies": { visible: true, opacity: 60 },
            "wetlands": { visible: true, opacity: 60 },
            "tidal-zones": { visible: true, opacity: 50 },
            "elevation-hillshade": { visible: true, opacity: 50 },
            "elevation-contours": { visible: true, opacity: 60 },
            "elevation-gradient": { visible: true, opacity: 70 },
            "moisture-gradient": { visible: true, opacity: 60 },
            "elevation-line": { visible: false, opacity: 40 },
            "river": { visible: true, opacity: 80 },
            "road": { visible: false, opacity: 70 },
            "cliff": { visible: false, opacity: 90 },
            "border": { visible: false, opacity: 60 },
            "faction-overlay": { visible: false, opacity: 55 },
            "location-influence": { visible: false, opacity: 35 },
            "location-marker": { visible: false, opacity: 100 },
            "building-indicator": { visible: false, opacity: 100 },
        }
    },
];

/**
 * Preset manager for loading/saving/applying layer visibility configurations
 */
export interface PresetManager {
    /** Get all available presets (built-in + custom) */
    getPresets(): LayerPreset[];
    /** Apply a preset by ID */
    applyPreset(presetId: string): void;
    /** Save current configuration as custom preset */
    saveCustomPreset(name: string, description: string, config: Record<string, { visible: boolean; opacity: number }>): void;
    /** Delete a custom preset */
    deleteCustomPreset(presetId: string): void;
    /** Load custom presets from storage */
    loadCustomPresets(presets: LayerPreset[]): void;
    /** Get custom presets for persistence */
    getCustomPresets(): LayerPreset[];
}

export function createPresetManager(
    onApply: (config: Record<string, { visible: boolean; opacity: number }>) => void
): PresetManager {
    const customPresets: LayerPreset[] = [];

    function getPresets(): LayerPreset[] {
        return [...BUILT_IN_PRESETS, ...customPresets];
    }

    function applyPreset(presetId: string): void {
        const preset = getPresets().find(p => p.id === presetId);
        if (!preset) {
            logger.warn("Preset not found", { presetId });
            return;
        }

        logger.info("Applying preset", { presetId, name: preset.name });
        onApply(preset.config);
    }

    function saveCustomPreset(
        name: string,
        description: string,
        config: Record<string, { visible: boolean; opacity: number }>
    ): void {
        const id = `custom-${Date.now()}`;
        const preset: LayerPreset = {
            id,
            name,
            description,
            config,
        };

        customPresets.push(preset);
        logger.info("Custom preset saved", { id, name });
    }

    function deleteCustomPreset(presetId: string): void {
        const index = customPresets.findIndex(p => p.id === presetId);
        if (index === -1) {
            logger.warn("Custom preset not found", { presetId });
            return;
        }

        customPresets.splice(index, 1);
        logger.info("Custom preset deleted", { presetId });
    }

    function loadCustomPresets(presets: LayerPreset[]): void {
        customPresets.length = 0;
        customPresets.push(...presets);
        logger.info("Custom presets loaded", { count: presets.length });
    }

    function getCustomPresets(): LayerPreset[] {
        return [...customPresets];
    }

    return {
        getPresets,
        applyPreset,
        saveCustomPreset,
        deleteCustomPreset,
        loadCustomPresets,
        getCustomPresets,
    };
}
