/**
 * Keyboard Handler for Cartographer
 *
 * Handles keyboard shortcuts for the Cartographer workmode.
 * Prevents conflicts with Obsidian's global shortcuts.
 *
 * Part of Cartographer UI Revamp - Phase 6: Keyboard Shortcuts
 */

import type { App } from "obsidian";
import { configurableLogger } from "@services/logging/configurable-logger";

const logger = configurableLogger.forModule("cartographer-keyboard-handler");

export type KeyboardHandlerContext = {
    /** Get current active mode ID (e.g., "editor", "inspector") */
    getCurrentMode(): string | null;

    /** Get current active tool (only for editor mode) */
    getCurrentTool(): string | null;

    /** Switch to a different mode */
    switchMode(modeId: string): Promise<void>;

    /** Switch to a different tool (only works in editor mode) */
    switchTool(toolId: string): Promise<void>;

    /** Toggle brush paint/erase mode (only when brush tool is active) */
    toggleBrushMode(): void;

    /** Toggle tool paint/erase mode (works for any tool that supports mode toggling) */
    toggleToolMode(): void;

    /** Focus region dropdown (when available) */
    focusRegionDropdown(): void;

    /** Focus faction dropdown (when available) */
    focusFactionDropdown(): void;

    /** Toggle layer panel visibility */
    toggleLayerPanel(): void;

    /** Toggle weather layer visibility */
    toggleWeatherLayer(): void;

    /** Toggle faction layer visibility */
    toggleFactionLayer(): void;

    /** Apply a layer preset (e.g., "faction-view", "weather-view") */
    applyLayerPreset(presetId: string): void;

    /** Show keyboard shortcuts help modal */
    showHelp(): void;

    /** Undo last operation (Ctrl+Z) */
    undo(): Promise<void>;

    /** Redo last undone operation (Ctrl+Shift+Z) */
    redo(): Promise<void>;
};

export type KeyboardHandlerHandle = {
    /** Clean up listeners */
    destroy(): void;
};

/**
 * Create and register keyboard handler for Cartographer
 */
export function createKeyboardHandler(
    app: App,
    container: HTMLElement,
    context: KeyboardHandlerContext
): KeyboardHandlerHandle {
    const handleKeyDown = async (event: KeyboardEvent) => {
        // Ignore if user is typing in an input/textarea/select
        const target = event.target as HTMLElement;
        if (
            target.tagName === "INPUT" ||
            target.tagName === "TEXTAREA" ||
            target.tagName === "SELECT" ||
            target.isContentEditable
        ) {
            return;
        }

        // Check for Shift modifier (allow Shift combinations)
        const hasShift = event.shiftKey;

        // Handle Ctrl/Cmd combinations first (undo/redo)
        if ((event.ctrlKey || event.metaKey) && !event.altKey) {
            if (!event.shiftKey && event.key.toLowerCase() === "z") {
                // Ctrl+Z: Undo
                event.preventDefault();
                event.stopPropagation();
                try {
                    await context.undo();
                } catch (error) {
                    logger.error("undo failed", error);
                }
                return;
            } else if (event.shiftKey && event.key.toLowerCase() === "z") {
                // Ctrl+Shift+Z: Redo
                event.preventDefault();
                event.stopPropagation();
                try {
                    await context.redo();
                } catch (error) {
                    logger.error("redo failed", error);
                }
                return;
            }
            // Other Ctrl/Cmd combinations - ignore
            return;
        }

        // Ignore if other modifier keys are pressed
        if (event.altKey) {
            return;
        }

        const key = event.key.toLowerCase();
        const currentMode = context.getCurrentMode();
        const currentTool = context.getCurrentTool();

        let handled = false;

        try {
            // Mode switching shortcuts (1-7 for tools)
            if (key === "1" && !hasShift) {
                // Switch to Tile Brush tool (in editor mode)
                if (currentMode === "editor") {
                    await context.switchTool("tile-brush");
                } else {
                    // Ensure editor mode is active, then switch to tile brush tool
                    await context.switchMode("editor");
                    await context.switchTool("tile-brush");
                }
                handled = true;
            } else if (key === "2" && !hasShift) {
                // Switch to Terrain Brush tool (in editor mode)
                if (currentMode === "editor") {
                    await context.switchTool("terrain-brush");
                } else {
                    // Ensure editor mode is active, then switch to terrain brush tool
                    await context.switchMode("editor");
                    await context.switchTool("terrain-brush");
                }
                handled = true;
            } else if (key === "3" && !hasShift) {
                // Switch to Location Marker tool (in editor mode)
                if (currentMode === "editor") {
                    await context.switchTool("location-marker");
                } else {
                    // Ensure editor mode is active, then switch to location marker tool
                    await context.switchMode("editor");
                    await context.switchTool("location-marker");
                }
                handled = true;
            } else if (key === "4" && !hasShift) {
                // Switch to Inspector tool (in editor mode)
                if (currentMode === "editor") {
                    await context.switchTool("inspector");
                } else {
                    // Ensure editor mode is active, then switch to inspector tool
                    await context.switchMode("editor");
                    await context.switchTool("inspector");
                }
                handled = true;
            } else if (key === "5" && !hasShift) {
                // Switch to Feature Brush tool (in editor mode)
                if (currentMode === "editor") {
                    await context.switchTool("feature-brush");
                } else {
                    // Ensure editor mode is active, then switch to feature brush tool
                    await context.switchMode("editor");
                    await context.switchTool("feature-brush");
                }
                handled = true;
            } else if (key === "6" && !hasShift) {
                // Switch to Area Brush tool (in editor mode)
                if (currentMode === "editor") {
                    await context.switchTool("area-brush");
                } else {
                    // Ensure editor mode is active, then switch to area brush tool
                    await context.switchMode("editor");
                    await context.switchTool("area-brush");
                }
                handled = true;
            } else if (key === "7" && !hasShift) {
                // Switch to Gradient Brush tool (in editor mode)
                if (currentMode === "editor") {
                    await context.switchTool("gradient-brush");
                } else {
                    // Ensure editor mode is active, then switch to gradient brush tool
                    await context.switchMode("editor");
                    await context.switchTool("gradient-brush");
                }
                handled = true;
            }
            // Layer preset shortcuts (Shift+1/2/3/4)
            else if (key === "1" && hasShift) {
                // Apply Faction View preset
                context.applyLayerPreset("faction-view");
                handled = true;
            } else if (key === "2" && hasShift) {
                // Apply Weather View preset
                context.applyLayerPreset("weather-view");
                handled = true;
            } else if (key === "3" && hasShift) {
                // Apply Terrain View preset
                context.applyLayerPreset("terrain-view");
                handled = true;
            } else if (key === "4" && hasShift) {
                // Apply All Layers preset
                context.applyLayerPreset("all-layers");
                handled = true;
            }
            // Tool switching shortcuts (only in editor mode)
            else if (currentMode === "editor") {
                if (key === "b") {
                    // Toggle brush paint/erase mode (only when terrain brush tool is active)
                    if (currentTool === "terrain-brush") {
                        context.toggleBrushMode();
                        handled = true;
                    }
                } else if (key === "x") {
                    // Toggle tool paint/erase mode (universal - works for any brush tool)
                    context.toggleToolMode();
                    handled = true;
                } else if (key === "r") {
                    // Focus region dropdown
                    context.focusRegionDropdown();
                    handled = true;
                } else if (key === "f" && !hasShift) {
                    // Focus faction dropdown
                    context.focusFactionDropdown();
                    handled = true;
                }
            }
            // Global shortcuts (work in all modes)
            if (!handled) {
                if (key === "l") {
                    // Toggle layer panel visibility
                    context.toggleLayerPanel();
                    handled = true;
                } else if (key === "w") {
                    // Toggle weather layer
                    context.toggleWeatherLayer();
                    handled = true;
                } else if (key === "f" && hasShift) {
                    // Toggle faction layer (Shift+F to avoid conflict with faction dropdown)
                    context.toggleFactionLayer();
                    handled = true;
                } else if (key === "?") {
                    // Show keyboard shortcuts help
                    context.showHelp();
                    handled = true;
                }
            }
        } catch (error) {
            logger.error("shortcut handler error", error);
        }

        // Prevent default if we handled the event
        if (handled) {
            event.preventDefault();
            event.stopPropagation();
        }
    };

    // Register listener
    container.addEventListener("keydown", handleKeyDown);

    logger.info("keyboard handler registered");

    return {
        destroy() {
            container.removeEventListener("keydown", handleKeyDown);
            logger.info("keyboard handler destroyed");
        },
    };
}
