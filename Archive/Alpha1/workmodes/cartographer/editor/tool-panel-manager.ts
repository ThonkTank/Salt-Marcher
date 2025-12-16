// src/workmodes/cartographer/editor/tool-panel-manager.ts
// Manages lifecycle of tool panels in Editor mode

import { configurableLogger } from "@services/logging/configurable-logger";
import { TOOL_REGISTRY, type ToolId } from "./tool-registry";

const logger = configurableLogger.forModule("cartographer-tool-panel-manager");
import type { UndoManager } from "@features/maps";
import type { AxialCoord, ToolPanelContext, ToolPanelHandle, ExtendedToolContext } from "../contracts/controller-interfaces";
import { createErrorBoundary, type ErrorBoundary } from "../services/error-boundary";

/**
 * Manages the lifecycle of all tool panels in the Cartographer Editor mode.
 *
 * Responsibilities:
 * - Lazy instantiation of tool panels (created on first activation)
 * - activate/deactivate calls on tool switches
 * - Delegation of map events (onMapRendered, handleHexClick)
 * - Cleanup on mode exit
 *
 * All panels are persistent - they remain in memory when inactive.
 * Only the currently active tool is visible and receives events.
 */
export class ToolPanelManager {
    private panels = new Map<ToolId, ToolPanelHandle>();
    private panelRoots = new Map<ToolId, HTMLElement>();  // Dedicated root element per tool
    private activeTool: ToolId | null = null;
    private switchAbort: AbortController | null = null;  // Explicit abort control for tool switches
    private onToolChanged?: (newTool: ToolId | null, oldTool: ToolId | null) => void;
    private errorBoundary: ErrorBoundary;

    constructor(
        private toolBody: HTMLElement,
        private context: ExtendedToolContext
    ) {
        // Create error boundary for tool operations
        this.errorBoundary = createErrorBoundary(
            (err, ctx) => {
                const errorDetails = err instanceof Error
                    ? { message: err.message, stack: err.stack, name: err.name }
                    : { raw: String(err) };
                logger.error("Tool operation failed", {
                    ...errorDetails,
                    context: ctx,
                });
            },
            () => this.resetToSafeState()
        );
    }

    /**
     * Register a callback that's invoked whenever the active tool changes.
     * @param callback - Function to call with (newTool, oldTool) parameters
     */
    setToolChangeCallback(callback: (newTool: ToolId | null, oldTool: ToolId | null) => void): void {
        this.onToolChanged = callback;
    }

    /**
     * Switch to a different tool.
     * Deactivates current tool (if any) and activates the new tool.
     * Creates the tool panel if not yet instantiated (lazy).
     *
     * Uses AbortController for explicit cancellation of superseded switches.
     *
     * @param toolId - ID of tool to switch to
     */
    async switchTo(toolId: ToolId): Promise<void> {
        // Abort any previous switch operation that may still be in flight
        this.switchAbort?.abort();
        this.switchAbort = new AbortController();
        const signal = this.switchAbort.signal;

        try {
            await this.errorBoundary.wrap(
                async () => this.doSwitchTo(toolId, signal),
                { toolId, operation: "switchTo" }
            );
        } catch (err) {
            // AbortError is expected when a switch is superseded - silently ignore
            if (err instanceof Error && err.name === "AbortError") {
                logger.debug("Tool switch aborted (superseded)", { toolId });
                return;
            }
            throw err;
        }
    }

    /**
     * Internal implementation of tool switching.
     * Extracted to enable error boundary wrapping.
     *
     * @param toolId - ID of tool to switch to
     * @param signal - AbortSignal to check for cancellation
     */
    private async doSwitchTo(toolId: ToolId, signal: AbortSignal): Promise<void> {
        logger.info("Switching tool", {
            from: this.activeTool,
            to: toolId,
        });

        // Validate tool exists
        const toolDef = TOOL_REGISTRY.get(toolId);
        if (!toolDef) {
            logger.warn("Unknown tool ID", { toolId });
            return;
        }

        // Deactivate current tool (if any)
        if (this.activeTool) {
            const currentPanel = this.panels.get(this.activeTool);
            if (currentPanel) {
                logger.info("Deactivating tool", {
                    toolId: this.activeTool,
                });
                currentPanel.deactivate();
            }
        }

        // Get or create panel (lazy instantiation)
        let panel = this.panels.get(toolId);
        if (!panel) {
            logger.info("Creating panel", { toolId });
            try {
                // Create dedicated root element for this tool
                const toolRoot = this.toolBody.createDiv({
                    cls: "sm-cartographer__tool-root",
                    attr: { "data-tool": toolId }
                });
                this.panelRoots.set(toolId, toolRoot);

                // Pass dedicated root to factory
                panel = toolDef.factory(toolRoot, this.context);
                this.panels.set(toolId, panel);
            } catch (error) {
                const errorDetails = error instanceof Error
                    ? { message: error.message, stack: error.stack, name: error.name }
                    : { raw: String(error) };
                logger.error("Failed to create panel", {
                    toolId,
                    ...errorDetails,
                });
                return;
            }
        }

        // Explicit abort check: throw if superseded during panel creation
        signal.throwIfAborted();

        // Activate new tool
        logger.info("Activating tool", { toolId });
        try {
            panel.activate();
        } catch (error) {
            const errorDetails = error instanceof Error
                ? { message: error.message, stack: error.stack, name: error.name }
                : { raw: String(error) };
            logger.error("Failed to activate panel", {
                toolId,
                ...errorDetails,
            });
            return;
        }
        const previousTool = this.activeTool;
        this.activeTool = toolId;

        // If map already rendered, notify the newly activated tool
        if (this.context.getFile() && panel.onMapRendered) {
            logger.info("Notifying newly activated tool of existing map render", { toolId });
            await panel.onMapRendered();

            // Explicit abort check: throw if superseded during async onMapRendered
            signal.throwIfAborted();
        }

        // Notify callback of tool change
        if (this.onToolChanged) {
            this.onToolChanged(toolId, previousTool);
        }
    }

    /**
     * Get the currently active tool ID.
     */
    getCurrentTool(): ToolId | null {
        return this.activeTool;
    }

    /**
     * Get the currently active tool panel.
     * Returns null if no tool is active.
     */
    getActivePanel(): ToolPanelHandle | null {
        if (!this.activeTool) return null;
        return this.panels.get(this.activeTool) ?? null;
    }

    /**
     * Notify active tool that the map was rendered.
     * Called when file changes or map is re-rendered.
     */
    onMapRendered(): void {
        if (!this.activeTool) return;

        const panel = this.panels.get(this.activeTool);
        if (panel?.onMapRendered) {
            logger.info("Notifying tool of map render", {
                toolId: this.activeTool,
            });
            panel.onMapRendered();
        }
    }

    /**
     * Delegate hex click to active tool.
     * Returns true if the click was consumed.
     */
    async handleHexClick(coord: AxialCoord, event: PointerEvent): Promise<boolean> {
        const result = await this.errorBoundary.wrap(
            async () => this.doHandleHexClick(coord, event),
            { toolId: this.activeTool ?? undefined, operation: "handleHexClick", coord }
        );
        return result ?? false;
    }

    /**
     * Internal implementation of hex click handling.
     * Extracted to enable error boundary wrapping.
     */
    private async doHandleHexClick(coord: AxialCoord, event: PointerEvent): Promise<boolean> {
        if (!this.activeTool) return false;

        const panel = this.panels.get(this.activeTool);
        if (panel?.handleHexClick) {
            logger.info("Delegating hex click to tool", {
                toolId: this.activeTool,
                coord,
            });
            return await panel.handleHexClick(coord, event);
        }

        return false;
    }

    /**
     * Set disabled state on all panels.
     * Typically called when no map is loaded.
     */
    setDisabled(disabled: boolean): void {
        logger.info("Setting disabled state", { disabled });
        this.panels.forEach((panel, toolId) => {
            if (panel.setDisabled) {
                panel.setDisabled(disabled);
            }
        });
    }

    /**
     * Update the UndoManager reference when map file changes.
     * Called by editor-mode when a new file is loaded.
     *
     * NOTE: The context object's getUndoManager() and requireUndoManager() closures
     * already reference the controller's editorUndoManager field, so they automatically
     * return the current value. This method is kept for logging purposes and potential
     * future use.
     *
     * @param newUndoManager - The new UndoManager instance (or null when no map loaded)
     */
    updateUndoManager(newUndoManager: UndoManager | null): void {
        // Context closures already read from the controller's field,
        // so we just log for debugging purposes.
        logger.info("UndoManager updated", {
            hasManager: !!newUndoManager,
        });
    }

    /**
     * Reset to a safe state after an error.
     * Currently logs the recovery attempt - future implementations
     * may disable the errored tool or switch to a safe fallback.
     */
    private resetToSafeState(): void {
        logger.info("Resetting to safe state after error", {
            activeTool: this.activeTool,
        });
        // TODO: Consider switching to a safe fallback tool or disabling the current tool
    }

    /**
     * Destroy a specific panel, forcing recreation on next switch.
     * Used when panel needs to be rebuilt with new context state.
     *
     * @param toolId - ID of the tool panel to destroy
     */
    destroyPanel(toolId: ToolId): void {
        const panel = this.panels.get(toolId);
        if (panel) {
            logger.info("Destroying panel for recreation", { toolId });
            panel.destroy();
            this.panels.delete(toolId);
        }
        const root = this.panelRoots.get(toolId);
        if (root) {
            root.remove();
            this.panelRoots.delete(toolId);
        }
    }

    /**
     * Destroy all panels and cleanup resources.
     * Called when Editor mode is exited.
     */
    destroy(): void {
        logger.info("Destroying all panels", {
            panelCount: this.panels.size,
        });

        // Abort any in-flight switch operation
        this.switchAbort?.abort();
        this.switchAbort = null;

        this.panels.forEach((panel, toolId) => {
            logger.info("Destroying panel", { toolId });
            panel.destroy();
        });

        this.panels.clear();
        this.panelRoots.clear();
        this.activeTool = null;
    }
}
