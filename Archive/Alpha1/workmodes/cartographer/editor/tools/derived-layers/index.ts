// src/workmodes/cartographer/editor/tools/derived-layers/index.ts
// Derived Layers tool registration

import { TOOL_REGISTRY } from "../../tool-registry";
import { mountDerivedLayersPanel } from "./derived-layers-panel";

/**
 * Register Derived Layers tool with Cartographer toolbar.
 *
 * This tool provides guided derivation of moisture, flora, and terrain
 * from base layers (elevation, groundwater, fertility).
 *
 * Part of Phase 2 in the map setup workflow:
 * - Phase 1: Base Layers (elevation, groundwater, etc.)
 * - Phase 2: Derived Layers (moisture, flora, terrain) ← This tool
 * - Phase 3: Manual refinement and inspection
 */
TOOL_REGISTRY.register({
	id: "derived-layers",
	label: "Derived Layers",
	icon: "⚡",
	tooltip: "Calculate moisture, flora, terrain from base layers (Shortcut: D)",
	factory: (root, ctx) => mountDerivedLayersPanel(root, ctx),
});

// Re-export panel factory
export { mountDerivedLayersPanel } from "./derived-layers-panel";
