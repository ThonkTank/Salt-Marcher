// src/workmodes/cartographer/editor/tools/terrain-brush/index.ts
// Brush tool registration

import { TOOL_REGISTRY } from "../../tool-registry";
import { mountBrushPanel } from "./brush-options";

// Register terrain brush tool in global registry
TOOL_REGISTRY.register({
    id: "terrain-brush",
    label: "Terrain Brush",
    icon: "🖌️",
    tooltip: "Paint terrain (Shortcut: 2)",
    factory: (root, ctx) => mountBrushPanel(root, ctx),
});
