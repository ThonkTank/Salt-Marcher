// src/workmodes/cartographer/editor/tools/area-brush/index.ts
// Area Brush tool registration

import { TOOL_REGISTRY } from "../../tool-registry";
import { mountAreaBrushPanel } from "./area-brush-options";

// Register area brush tool in global registry
TOOL_REGISTRY.register({
    id: "area-brush",
    label: "Area Brush",
    icon: "🗺️",
    tooltip: "Paint regions/factions with borders (Shortcut: 6)",
    factory: (root, ctx) => mountAreaBrushPanel(root, ctx),
});
