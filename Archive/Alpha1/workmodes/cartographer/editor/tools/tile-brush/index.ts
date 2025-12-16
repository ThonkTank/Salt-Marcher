// src/workmodes/cartographer/editor/tools/tile-brush/index.ts
// Tile Brush tool registration

import { TOOL_REGISTRY } from "../../tool-registry";
import { mountTileBrushPanel } from "./tile-brush-options";

// Register tile brush tool in global registry
TOOL_REGISTRY.register({
    id: "tile-brush",
    label: "Tile Brush",
    icon: "🔲",
    tooltip: "Create/delete tiles (Shortcut: 1)",
    factory: (root, ctx) => mountTileBrushPanel(root, ctx),
});
