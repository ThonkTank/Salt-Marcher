// src/workmodes/cartographer/contracts/layer-id-mapping.ts
// Layer ID Mapping: Declarative mapping from panel layer IDs to overlay layer IDs
//
// NOW DERIVED FROM: src/features/maps/overlay/layer-registry.ts
// Single source of truth for all layer metadata

import { buildPanelToOverlayMap } from "@features/maps";

/**
 * Declarative mapping from panel layer IDs to overlay layer IDs.
 *
 * Panel layers may control:
 * - Zero overlay layers (e.g., terrain base layer - icon-based, not overlay-based)
 * - One overlay layer (e.g., weather-overlay)
 * - Multiple overlay layers (e.g., terrain-features controls 5 child layers)
 *
 * Special handling:
 * - 'terrain': Uses icon layers (terrain, flora), not overlay layers
 * - Parent layers (terrain-features, water-systems, elevation-visualization, climate):
 *   Return all child overlay layers for bulk operations
 *
 * DERIVED FROM LAYER REGISTRY - DO NOT EDIT DIRECTLY
 * To add/modify layers, edit src/features/maps/overlay/layer-registry.ts
 */
export const PANEL_TO_OVERLAY_MAP: Record<string, string[]> = buildPanelToOverlayMap();

/**
 * Map panel layer ID to overlay layer IDs.
 *
 * Returns an array of overlay layer IDs that the given panel layer controls.
 * Returns empty array if:
 * - Panel layer has no corresponding overlays (e.g., 'terrain')
 * - Panel layer ID is unknown
 *
 * @param panelLayerId - The panel layer ID to look up
 * @returns Array of overlay layer IDs (may be empty)
 *
 * @example
 * mapPanelLayerIdToOverlayLayerIds('weather') // => ['weather-overlay']
 * mapPanelLayerIdToOverlayLayerIds('terrain-features') // => ['terrain-features-elevation-line', ...]
 * mapPanelLayerIdToOverlayLayerIds('terrain') // => []
 * mapPanelLayerIdToOverlayLayerIds('unknown') // => []
 */
export function mapPanelLayerIdToOverlayLayerIds(panelLayerId: string): string[] {
    return PANEL_TO_OVERLAY_MAP[panelLayerId] ?? [];
}
