// src/features/maps/overlay/layer-registry.ts
// Unified Layer Registry: Single source of truth for all layer metadata
//
// Consolidates layer metadata from 3 previous locations:
// 1. layer-control-panel.ts (DEFAULT_LAYER_GROUPS - UI structure)
// 2. layer-id-mapping.ts (PANEL_TO_OVERLAY_MAP - ID mapping)
// 3. Overlay layer files (priority constants)

/**
 * Layer rendering priorities (6 tier system)
 * Lower numbers render first (behind), higher numbers render last (on top)
 *
 * Priority tiers:
 * - TERRAIN (0): Base terrain icons
 * - TERRAIN_FEATURES (10): Elevation, rivers, roads, cliffs, borders
 * - CLIMATE (20): Temperature, precipitation, cloud cover, wind
 * - WEATHER (30): Real-time weather effects
 * - MARKERS (40): Locations, faction markers
 * - INDICATORS (50): UI indicators, tooltips
 * - HIDDEN (100): Debug/hidden layers
 */
export const LAYER_PRIORITY = {
    // === TIER 1: BASE TERRAIN (0) ===
    /** Base terrain icons - foundation layer */
    TERRAIN: 0,

    // === TIER 2: TERRAIN FEATURES (10) ===
    /** Terrain features group: elevation lines, rivers, roads, cliffs, borders */
    TERRAIN_FEATURES: 10,
    /** @deprecated Use TERRAIN_FEATURES (10) - All terrain features render at same priority */
    ELEVATION_LINE: 10,
    /** @deprecated Use TERRAIN_FEATURES (10) - All terrain features render at same priority */
    RIVER: 10,
    /** @deprecated Use TERRAIN_FEATURES (10) - All terrain features render at same priority */
    ROAD: 10,
    /** @deprecated Use TERRAIN_FEATURES (10) - All terrain features render at same priority */
    CLIFF: 10,
    /** @deprecated Use TERRAIN_FEATURES (10) - All terrain features render at same priority */
    BORDER: 10,

    // === TIER 3: CLIMATE (20) ===
    /** Climate overlays group: temperature, precipitation, cloud cover, wind */
    CLIMATE: 20,
    /** @deprecated Use CLIMATE (20) - All climate overlays render at same priority */
    TEMPERATURE: 20,
    /** @deprecated Use CLIMATE (20) - All climate overlays render at same priority */
    PRECIPITATION: 20,
    /** @deprecated Use CLIMATE (20) - All climate overlays render at same priority */
    CLOUD_COVER: 20,
    /** @deprecated Use CLIMATE (20) - All climate overlays render at same priority */
    WIND: 20,

    // === TIER 4: WEATHER (30) ===
    /** Real-time weather effects */
    WEATHER: 30,
    /** @deprecated Use WEATHER (30) - Weather emoji layer */
    WEATHER_EMOJI: 30,

    // === TIER 5: MARKERS (40) ===
    /** Faction territories and location markers */
    MARKERS: 40,
    /** @deprecated Use MARKERS (40) - Faction territories */
    FACTION: 40,
    /** @deprecated Use MARKERS (40) - Location influence areas */
    LOCATION_INFLUENCE: 40,
    /** @deprecated Use MARKERS (40) - Location markers */
    INFLUENCE: 40, // Alias for LOCATION_INFLUENCE
    /** @deprecated Use MARKERS (40) - Location markers */
    LOCATION: 40,

    // === TIER 6: INDICATORS (50) ===
    /** UI indicators and tooltips */
    INDICATORS: 50,
    /** @deprecated Use INDICATORS (50) - Building indicators */
    BUILDING: 50,

    // === HIDDEN/DEBUG LAYERS (100+) ===
    /** Not-yet-implemented or debug layers */
    HIDDEN: 100,
    /** @deprecated Use HIDDEN (100) - Moisture layer */
    MOISTURE: 100,
    /** @deprecated Use HIDDEN (100) - Elevation visualization */
    ELEVATION_VIZ: 100,
    /** @deprecated Use HIDDEN (100) - Water systems */
    WATER_SYSTEMS: 100,
} as const;

/**
 * Type-safe layer IDs (overlay system identifiers)
 *
 * Use these constants instead of magic strings when registering or referencing layers.
 * Prevents typos and enables IDE autocomplete.
 *
 * @example
 * ```typescript
 * overlayManager.register(createWeatherLayer(...));
 * overlayManager.getLayer(LAYER_IDS.WEATHER); // Type-safe reference
 * overlayManager.setLayerConfig(LAYER_IDS.FACTION, true, 0.8);
 * ```
 */
export const LAYER_IDS = {
    // Base layers
    TERRAIN: "terrain",

    // Terrain features
    TERRAIN_FEATURES_ELEVATION: "terrain-features-elevation-line",
    TERRAIN_FEATURES_RIVER: "terrain-features-river",
    TERRAIN_FEATURES_ROAD: "terrain-features-road",
    TERRAIN_FEATURES_CLIFF: "terrain-features-cliff",
    TERRAIN_FEATURES_BORDER: "terrain-features-border",

    // Climate overlays
    TEMPERATURE: "temperature-overlay",
    PRECIPITATION: "precipitation-overlay",
    CLOUD_COVER: "cloudcover-overlay",
    WIND: "wind-overlay",

    // Weather
    WEATHER: "weather-overlay",

    // Territory overlays
    FACTION: "faction-overlay",
    LOCATION_INFLUENCE: "location-influence",

    // Markers
    LOCATION_MARKER: "location-marker",
    BUILDING_INDICATOR: "building-indicator",

    // Hidden/Debug
    MOISTURE: "moisture-overlay",
    MOISTURE_GRADIENT: "moisture-gradient",
    ELEVATION_HILLSHADE: "elevation-hillshade",
    ELEVATION_CONTOURS: "elevation-contours",
    ELEVATION_GRADIENT: "elevation-gradient",
    SEA_LEVEL: "sea-level",
    WATER_BODIES: "water-bodies",
    WETLANDS: "wetlands",
    TIDAL_ZONES: "tidal-zones",
    RIVER_LAYER: "river-layer",
} as const;

/** Type representing valid layer IDs */
export type LayerId = typeof LAYER_IDS[keyof typeof LAYER_IDS];

/**
 * Layer group identifiers for organizing related layers
 */
export const LAYER_GROUP = {
    BASE: 'base-layers',
    ENVIRONMENT: 'environment',
    HUMAN_GEOGRAPHY: 'human-geography',
    MARKERS: 'markers-indicators',
} as const;

/**
 * Panel configuration for UI rendering
 * Defines visibility, color, and nesting structure
 */
export interface LayerPanelConfig {
    /** Display label in UI */
    label: string;

    /** Default visibility state */
    visible: boolean;

    /** Color indicator for UI */
    color?: string;

    /** Child layers (for hierarchical panel controls) */
    children?: string[];

    /** Whether this is a parent-only control (has no overlay itself) */
    parentOnly?: boolean;

    /** Hide from panel UI but keep in registry for future use */
    hidden?: boolean;
}

/**
 * Complete layer definition with all metadata
 */
export interface LayerDefinition {
    /** Unique layer identifier (used in both panel and overlay systems) */
    id: string;

    /** Display name */
    name: string;

    /** Layer group for organization */
    group: string;

    /** Rendering priority (lower = behind, higher = on top) */
    priority: number;

    /** Overlay layer IDs controlled by this panel layer
     * Empty array means icon-based layer (no overlays)
     * Multiple IDs means parent control for multiple overlays
     */
    overlayIds: string[];

    /** Panel-specific configuration */
    panelConfig: LayerPanelConfig;
}

/**
 * Complete layer registry - single source of truth
 *
 * Design notes:
 * - Panel IDs and overlay IDs are kept separate for clarity
 * - Parent layers (like 'terrain-features') control multiple child overlays
 * - Some layers like 'terrain' have no overlays (icon-based rendering)
 * - Climate parent controls 4 child overlays but has no overlay itself
 * - Layers ordered by priority (low to high)
 * - Hidden layers remain in registry but excluded from UI
 */
export const LAYER_REGISTRY: readonly LayerDefinition[] = [
    // ==================== BASE LAYERS ====================
    {
        id: 'terrain',
        name: 'Terrain Icons',
        group: LAYER_GROUP.BASE,
        priority: LAYER_PRIORITY.TERRAIN,
        overlayIds: [], // Icon-based, no overlay system
        panelConfig: {
            label: 'Terrain Icons',
            visible: true,
            color: '#A8E6CF',
        },
    },

    // ==================== TERRAIN FEATURES (10-19) ====================
    {
        id: 'terrain-features',
        name: 'Terrain Features',
        group: LAYER_GROUP.HUMAN_GEOGRAPHY,
        priority: LAYER_PRIORITY.TERRAIN_FEATURES,
        overlayIds: [
            'terrain-features-elevation-line',
            'terrain-features-river',
            'terrain-features-road',
            'terrain-features-cliff',
            'terrain-features-border',
        ],
        panelConfig: {
            label: 'Terrain Features',
            visible: true,
            parentOnly: true,
            children: ['elevation-line', 'river', 'road', 'cliff', 'border'],
        },
    },
    {
        id: 'elevation-line',
        name: 'Elevation Lines',
        group: LAYER_GROUP.HUMAN_GEOGRAPHY,
        priority: LAYER_PRIORITY.ELEVATION_LINE,
        overlayIds: ['terrain-features-elevation-line'],
        panelConfig: {
            label: 'Elevation Lines',
            visible: true,
            color: '#999999',
        },
    },
    {
        id: 'river',
        name: 'Rivers',
        group: LAYER_GROUP.HUMAN_GEOGRAPHY,
        priority: LAYER_PRIORITY.RIVER,
        overlayIds: ['terrain-features-river'],
        panelConfig: {
            label: 'Rivers',
            visible: true,
            color: '#4A90E2',
        },
    },
    {
        id: 'road',
        name: 'Roads',
        group: LAYER_GROUP.HUMAN_GEOGRAPHY,
        priority: LAYER_PRIORITY.ROAD,
        overlayIds: ['terrain-features-road'],
        panelConfig: {
            label: 'Roads',
            visible: true,
            color: '#D4A574',
        },
    },
    {
        id: 'cliff',
        name: 'Cliffs',
        group: LAYER_GROUP.HUMAN_GEOGRAPHY,
        priority: LAYER_PRIORITY.CLIFF,
        overlayIds: ['terrain-features-cliff'],
        panelConfig: {
            label: 'Cliffs',
            visible: true,
            color: '#8B7355',
        },
    },
    {
        id: 'border',
        name: 'Borders',
        group: LAYER_GROUP.HUMAN_GEOGRAPHY,
        priority: LAYER_PRIORITY.BORDER,
        overlayIds: ['terrain-features-border'],
        panelConfig: {
            label: 'Borders',
            visible: true,
            color: '#FF6B6B',
        },
    },

    // ==================== CLIMATE OVERLAYS (50-59) ====================
    {
        id: 'climate',
        name: 'Climate Layers',
        group: LAYER_GROUP.ENVIRONMENT,
        priority: LAYER_PRIORITY.CLIMATE,
        overlayIds: [
            'temperature-overlay',
            'precipitation-overlay',
            'cloudcover-overlay',
            'wind-overlay',
        ],
        panelConfig: {
            label: 'Climate Layers',
            visible: false, // Off by default (group toggle)
            parentOnly: true,
            children: ['temperature-overlay', 'precipitation-overlay', 'wind-overlay', 'cloudcover-overlay'],
        },
    },
    {
        id: 'temperature-overlay',
        name: 'Temperature',
        group: LAYER_GROUP.ENVIRONMENT,
        priority: LAYER_PRIORITY.TEMPERATURE,
        overlayIds: ['temperature-overlay'],
        panelConfig: {
            label: 'Temperature',
            visible: false,
            color: '#FF6B6B', // Red for hot
        },
    },
    {
        id: 'precipitation-overlay',
        name: 'Precipitation',
        group: LAYER_GROUP.ENVIRONMENT,
        priority: LAYER_PRIORITY.PRECIPITATION,
        overlayIds: ['precipitation-overlay'],
        panelConfig: {
            label: 'Precipitation',
            visible: false,
            color: '#4A90E2', // Blue for rain
        },
    },
    {
        id: 'cloudcover-overlay',
        name: 'Cloud Cover',
        group: LAYER_GROUP.ENVIRONMENT,
        priority: LAYER_PRIORITY.CLOUD_COVER,
        overlayIds: ['cloudcover-overlay'],
        panelConfig: {
            label: 'Cloud Cover',
            visible: false,
            color: '#ECF0F1', // Light gray for clouds
        },
    },
    {
        id: 'wind-overlay',
        name: 'Wind',
        group: LAYER_GROUP.ENVIRONMENT,
        priority: LAYER_PRIORITY.WIND,
        overlayIds: ['wind-overlay'],
        panelConfig: {
            label: 'Wind',
            visible: false,
            color: '#9B59B6', // Purple for wind
        },
    },

    // ==================== WEATHER (60-69) ====================
    {
        id: 'weather',
        name: 'Weather Overlay',
        group: LAYER_GROUP.ENVIRONMENT,
        priority: LAYER_PRIORITY.WEATHER_EMOJI,
        overlayIds: ['weather-overlay'],
        panelConfig: {
            label: 'Weather Overlay',
            visible: true,
            color: '#4A90E2',
        },
    },

    // ==================== HIDDEN LAYERS (100+) ====================
    // Not-yet-implemented or out-of-scope layers

    // Moisture (100)
    {
        id: 'moisture-overlay',
        name: 'Moisture Level',
        group: LAYER_GROUP.ENVIRONMENT,
        priority: LAYER_PRIORITY.MOISTURE,
        overlayIds: ['moisture-overlay'],
        panelConfig: {
            label: 'Moisture Level',
            visible: false,
            color: '#0066FF',
            hidden: true,
        },
    },
    {
        id: 'moisture-gradient',
        name: 'Moisture Gradient',
        group: LAYER_GROUP.ENVIRONMENT,
        priority: LAYER_PRIORITY.MOISTURE,
        overlayIds: ['moisture-gradient'],
        panelConfig: {
            label: 'Moisture Gradient',
            visible: false,
            color: '#0066FF',
            hidden: true,
        },
    },

    // Elevation Visualization (110)
    {
        id: 'elevation-visualization',
        name: 'Elevation Visualization',
        group: LAYER_GROUP.ENVIRONMENT,
        priority: LAYER_PRIORITY.ELEVATION_VIZ,
        overlayIds: [
            'elevation-hillshade',
            'elevation-contours',
            'elevation-gradient',
            'moisture-gradient',
        ],
        panelConfig: {
            label: 'Elevation Visualization',
            visible: false,
            parentOnly: true,
            children: ['elevation-hillshade', 'elevation-contours', 'elevation-gradient', 'moisture-gradient'],
            hidden: true,
        },
    },
    {
        id: 'elevation-gradient',
        name: 'Elevation Gradient',
        group: LAYER_GROUP.ENVIRONMENT,
        priority: LAYER_PRIORITY.ELEVATION_VIZ,
        overlayIds: ['elevation-gradient'],
        panelConfig: {
            label: 'Elevation Gradient',
            visible: false,
            color: '#8B4513',
            hidden: true,
        },
    },
    {
        id: 'elevation-hillshade',
        name: 'Hillshade',
        group: LAYER_GROUP.ENVIRONMENT,
        priority: LAYER_PRIORITY.ELEVATION_VIZ,
        overlayIds: ['elevation-hillshade'],
        panelConfig: {
            label: 'Hillshade',
            visible: false,
            color: '#666666',
            hidden: true,
        },
    },
    {
        id: 'elevation-contours',
        name: 'Contour Lines',
        group: LAYER_GROUP.ENVIRONMENT,
        priority: LAYER_PRIORITY.ELEVATION_VIZ,
        overlayIds: ['elevation-contours'],
        panelConfig: {
            label: 'Contour Lines',
            visible: false,
            color: '#8B4513',
            hidden: true,
        },
    },

    // Water Systems (120)
    {
        id: 'water-systems',
        name: 'Water Systems',
        group: LAYER_GROUP.ENVIRONMENT,
        priority: LAYER_PRIORITY.WATER_SYSTEMS,
        overlayIds: [
            'sea-level',
            'water-bodies',
            'wetlands',
            'tidal-zones',
            'river-layer',
        ],
        panelConfig: {
            label: 'Water Systems',
            visible: false,
            parentOnly: true,
            children: ['sea-level', 'water-bodies', 'wetlands', 'tidal-zones', 'river-layer'],
            hidden: true,
        },
    },
    {
        id: 'sea-level',
        name: 'Sea Level',
        group: LAYER_GROUP.ENVIRONMENT,
        priority: LAYER_PRIORITY.WATER_SYSTEMS,
        overlayIds: ['sea-level'],
        panelConfig: {
            label: 'Sea Level',
            visible: false,
            color: '#0066CC',
            hidden: true,
        },
    },
    {
        id: 'water-bodies',
        name: 'Water Bodies',
        group: LAYER_GROUP.ENVIRONMENT,
        priority: LAYER_PRIORITY.WATER_SYSTEMS,
        overlayIds: ['water-bodies'],
        panelConfig: {
            label: 'Water Bodies',
            visible: false,
            color: '#4A90E2',
            hidden: true,
        },
    },
    {
        id: 'wetlands',
        name: 'Wetlands',
        group: LAYER_GROUP.ENVIRONMENT,
        priority: LAYER_PRIORITY.WATER_SYSTEMS,
        overlayIds: ['wetlands'],
        panelConfig: {
            label: 'Wetlands',
            visible: false,
            color: '#2E8B57',
            hidden: true,
        },
    },
    {
        id: 'tidal-zones',
        name: 'Tidal Zones',
        group: LAYER_GROUP.ENVIRONMENT,
        priority: LAYER_PRIORITY.WATER_SYSTEMS,
        overlayIds: ['tidal-zones'],
        panelConfig: {
            label: 'Tidal Zones',
            visible: false,
            color: '#20B2AA',
            hidden: true,
        },
    },
    {
        id: 'river-layer',
        name: 'Rivers',
        group: LAYER_GROUP.ENVIRONMENT,
        priority: LAYER_PRIORITY.WATER_SYSTEMS,
        overlayIds: ['river-layer'],
        panelConfig: {
            label: 'Rivers',
            visible: false,
            color: '#4A90E2',
            hidden: true,
        },
    },

    // Faction (130)
    {
        id: 'faction-overlay',
        name: 'Faction Territories',
        group: LAYER_GROUP.HUMAN_GEOGRAPHY,
        priority: LAYER_PRIORITY.FACTION,
        overlayIds: ['faction-overlay'],
        panelConfig: {
            label: 'Faction Territories',
            visible: true,
            color: '#FF6B6B',
            hidden: true,
        },
    },

    // Location Influence (135)
    {
        id: 'location-influence',
        name: 'Location Influence Areas',
        group: LAYER_GROUP.HUMAN_GEOGRAPHY,
        priority: LAYER_PRIORITY.LOCATION_INFLUENCE,
        overlayIds: ['location-influence'],
        panelConfig: {
            label: 'Location Influence Areas',
            visible: true,
            color: '#4ECDC4',
            hidden: true,
        },
    },

    // Location Markers (140)
    {
        id: 'location-marker',
        name: 'Location Markers',
        group: LAYER_GROUP.MARKERS,
        priority: LAYER_PRIORITY.LOCATION,
        overlayIds: ['location-marker'],
        panelConfig: {
            label: 'Location Markers',
            visible: true,
            color: '#4ECDC4',
            hidden: true,
        },
    },

    // Building Indicators (150)
    {
        id: 'building-indicator',
        name: 'Building Indicators',
        group: LAYER_GROUP.MARKERS,
        priority: LAYER_PRIORITY.BUILDING,
        overlayIds: ['building-indicator'],
        panelConfig: {
            label: 'Building Indicators',
            visible: true,
            color: '#FFE66D',
            hidden: true,
        },
    },
] as const;

// ==================== HELPER FUNCTIONS ====================

/**
 * Get layer definition by ID
 * @param id Layer ID (panel or overlay ID)
 * @returns Layer definition or undefined if not found
 */
export function getLayerById(id: string): LayerDefinition | undefined {
    return LAYER_REGISTRY.find(layer => layer.id === id);
}

/**
 * Get all layers in a specific group
 * @param group Group identifier (from LAYER_GROUP)
 * @returns Array of layer definitions in that group
 */
export function getLayersByGroup(group: string): readonly LayerDefinition[] {
    return LAYER_REGISTRY.filter(layer => layer.group === group);
}

/**
 * Get all visible layers (not hidden) for panel rendering
 * @returns Array of layer definitions that should be shown in UI
 */
export function getVisibleLayers(): readonly LayerDefinition[] {
    return LAYER_REGISTRY.filter(layer => !layer.panelConfig.hidden);
}

/**
 * Map panel layer ID to overlay layer IDs
 *
 * This is the core mapping function used by the overlay system.
 * Returns overlay IDs that should be affected when a panel layer is toggled.
 *
 * @param panelLayerId Panel layer ID
 * @returns Array of overlay layer IDs (may be empty for icon-based layers)
 *
 * @example
 * ```typescript
 * getOverlayIdsForPanel('weather') // => ['weather-overlay']
 * getOverlayIdsForPanel('terrain-features') // => ['terrain-features-elevation-line', ...]
 * getOverlayIdsForPanel('terrain') // => [] (icon-based, no overlays)
 * ```
 */
export function getOverlayIdsForPanel(panelLayerId: string): string[] {
    const layer = getLayerById(panelLayerId);
    return layer?.overlayIds ?? [];
}

/**
 * Build panel-to-overlay mapping object
 * Useful for batch operations and backward compatibility
 *
 * @returns Record mapping panel IDs to overlay ID arrays
 */
export function buildPanelToOverlayMap(): Record<string, string[]> {
    const map: Record<string, string[]> = {};

    for (const layer of LAYER_REGISTRY) {
        map[layer.id] = [...layer.overlayIds];
    }

    return map;
}

/**
 * Get all unique overlay IDs from registry
 * Useful for validation and debugging
 *
 * @returns Set of all overlay IDs
 */
export function getAllOverlayIds(): Set<string> {
    const ids = new Set<string>();

    for (const layer of LAYER_REGISTRY) {
        for (const overlayId of layer.overlayIds) {
            ids.add(overlayId);
        }
    }

    return ids;
}
