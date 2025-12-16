// src/workmodes/cartographer/editor/tools/climate-brush/index.ts
// Temperature Brush tool registration

import { TOOL_REGISTRY } from "../../tool-registry";
import { mountClimateBrushPanel } from "./climate-brush-tool";

// Register temperature brush tool in global registry
TOOL_REGISTRY.register({
    id: "climate-brush",
    label: "Temperature",
    icon: "🌡️",
    tooltip: "Paint temperature offsets to modify local climate (Shortcut: 7)",
    factory: (root, ctx) => mountClimateBrushPanel(root, ctx),
});
