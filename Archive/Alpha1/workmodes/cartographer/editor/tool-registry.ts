// src/workmodes/cartographer/editor/tool-registry.ts
// Central registry for all Cartographer tool panels

import { configurableLogger } from "@services/logging/configurable-logger";

const logger = configurableLogger.forModule("cartographer-tool-registry");
import type { ToolPanelContext, ToolPanelHandle } from "./tool-panel.interface";

export type ToolId = string;

/**
 * Definition of a tool that can be registered in the Cartographer.
 */
export type ToolDefinition = {
    /** Unique identifier for this tool */
    id: ToolId;

    /** Display name shown in toolbar */
    label: string;

    /** Icon/emoji shown in toolbar */
    icon: string;

    /** Tooltip text for toolbar button */
    tooltip: string;

    /**
     * Factory function that creates the tool panel.
     * Called lazily on first activation.
     *
     * @param root - Container element where panel should be mounted
     * @param ctx - Context object with app dependencies
     * @returns ToolPanelHandle implementing the lifecycle interface
     */
    factory: (root: HTMLElement, ctx: ToolPanelContext) => ToolPanelHandle;
};

/**
 * Central registry for all Cartographer tools.
 * Tools self-register on module load.
 *
 * @example
 * ```typescript
 * // In your tool module (e.g., brush/index.ts)
 * import { TOOL_REGISTRY } from "../../tool-registry";
 * import { mountBrushPanel } from "./brush-options";
 *
 * TOOL_REGISTRY.register({
 *     id: "brush",
 *     label: "Brush",
 *     icon: "🖌️",
 *     tooltip: "Paint terrain (Shortcut: 1)",
 *     factory: (root, ctx) => mountBrushPanel(root, ctx),
 * });
 * ```
 */
class ToolRegistry {
    private tools = new Map<ToolId, ToolDefinition>();

    /**
     * Register a new tool in the registry.
     * Should be called once per tool, typically on module load.
     */
    register(def: ToolDefinition): void {
        if (this.tools.has(def.id)) {
            logger.warn(`[ToolRegistry] Tool "${def.id}" already registered, replacing`);
        }
        this.tools.set(def.id, def);
    }

    /**
     * Get a tool definition by ID.
     * Returns undefined if tool not found.
     */
    get(id: ToolId): ToolDefinition | undefined {
        return this.tools.get(id);
    }

    /**
     * Get all registered tools.
     * Useful for generating toolbar buttons.
     */
    getAllTools(): ToolDefinition[] {
        return Array.from(this.tools.values());
    }

    /**
     * Check if a tool is registered.
     */
    has(id: ToolId): boolean {
        return this.tools.has(id);
    }

    /**
     * Remove a tool from registry.
     * Mainly for testing.
     */
    unregister(id: ToolId): boolean {
        return this.tools.delete(id);
    }

    /**
     * Clear all tools.
     * Mainly for testing.
     */
    clear(): void {
        this.tools.clear();
    }
}

/**
 * Global tool registry instance.
 * Tools register themselves by calling TOOL_REGISTRY.register().
 */
export const TOOL_REGISTRY = new ToolRegistry();
