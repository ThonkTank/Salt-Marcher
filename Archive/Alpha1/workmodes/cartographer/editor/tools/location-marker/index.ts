// src/workmodes/cartographer/editor/tools/location-marker/index.ts
// Location Marker tool registration

import { TOOL_REGISTRY } from "../../tool-registry";
import { mountLocationMarkerPanel } from "./marker-panel";

// Register location marker tool in global registry
TOOL_REGISTRY.register({
    id: "location-marker",
    label: "Marker",
    icon: "📍",
    tooltip: "Place location markers (Shortcut: 3)",
    factory: (root, ctx) => mountLocationMarkerPanel(root, ctx),
});
