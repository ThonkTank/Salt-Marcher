// src/workmodes/cartographer/editor/tools/feature-brush/feature-brush-registration.ts
// Feature Brush tool registration

import { TOOL_REGISTRY } from "../../tool-registry";
import { mountFeatureBrushPanel } from "./feature-brush-options";

// Register feature brush tool in global registry
TOOL_REGISTRY.register({
    id: "feature-brush",
    label: "Features",
    icon: "🏔️",
    tooltip: "Paint terrain features (Shortcut: 5)",
    factory: (root, ctx) => mountFeatureBrushPanel(root, ctx),
});
