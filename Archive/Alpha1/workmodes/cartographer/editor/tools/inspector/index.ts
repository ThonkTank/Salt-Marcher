// src/workmodes/cartographer/editor/tools/inspector/index.ts
// Inspector tool registration - Adapter to standard ToolPanelHandle interface

import { createInspectorPanel, type InspectorPanelHandle } from "@workmodes/cartographer/components/inspector-panel";
import { TOOL_REGISTRY } from "../../tool-registry";
import type { ToolPanelHandle, ToolPanelContext } from "../base";

/**
 * Adapter function that bridges the inspector panel's original API
 * to the ToolPanelManager's expected factory signature
 *
 * Updated to use new base types (ToolPanelHandle, ToolPanelContext)
 */
function mountInspectorPanel(
    root: HTMLElement,
    ctx: ToolPanelContext
): ToolPanelHandle {
    // Create the inspector panel using its original API (now with full context)
    const inspector: InspectorPanelHandle = createInspectorPanel(ctx.app, root, ctx);

    // Adapter: wrap inspector to match ToolPanelHandle interface
    return {
        activate: () => inspector.activate(),
        deactivate: () => inspector.deactivate(),
        destroy: () => inspector.destroy(),

        // Forward map render events to inspector
        onMapRendered: async () => {
            const file = ctx.getFile();
            const handles = ctx.getHandles();
            await inspector.setFile(file, handles);
        },

        // Forward hex click events to inspector
        handleHexClick: async (coord) => {
            await inspector.setSelection(coord);
            return true; // Click consumed
        },

        // Inspector doesn't have modes - no-op
        toggleMode: () => {
            // Inspector is view-only, no mode to toggle
        },
    };
}

// Register inspector as a tool
TOOL_REGISTRY.register({
    id: "inspector",
    label: "Inspector",
    icon: "🔍",
    tooltip: "Inspect and edit hex data (Shortcut: 4)",
    factory: mountInspectorPanel,
});
