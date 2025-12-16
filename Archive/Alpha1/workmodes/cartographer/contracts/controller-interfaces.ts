// src/workmodes/cartographer/contracts/controller-interfaces.ts
// Shared interfaces and types to prevent circular dependencies
//
// This file contains interfaces extracted from cartographer-controller.ts and cartographer-types.ts
// to break circular import chains. All files that previously imported from controller.ts
// should now import shared types from here instead.

import type { App, TFile } from "obsidian";
import type { HexOptions } from "@features/maps/config/options";
import type { RenderHandles } from "@features/maps/rendering/hex-render";
import type { UndoManager } from "@features/maps";
import type { ViewContainerHandle } from "@ui/components/view-container";
import type { AxialCoord } from "./contract-types";
import type { CartographerStore } from "../store";

/**
 * Core tool context - minimal interface for all tools.
 * Provides basic app access, file info, status updates, and abort signals.
 */
export interface CoreToolContext {
    /** Obsidian App instance for vault/workspace access */
    app: App;

    /** Current map file being edited (null if no map loaded) */
    getFile(): TFile | null;

    /** Display status message to user */
    setStatus(message: string, tone?: "info" | "loading" | "error"): void;

    /** Abort signal for cancellable operations (null if no map loaded) */
    getAbortSignal(): AbortSignal | null;
}

/**
 * Rendering context - provides access to canvas and coordinate conversion.
 * Used by tools that need to render on or interact with the map canvas.
 */
export interface RenderingContext {
    /** Canvas rendering handles (null if no map loaded) */
    getHandles(): RenderHandles | null;

    /** View container for rendering (null if no map loaded) */
    getSurface(): ViewContainerHandle | null;

    /** Convert mouse event to content-space coordinates */
    toContentPoint(ev: MouseEvent | PointerEvent): DOMPoint | null;
}

/**
 * Map context - provides map configuration and coordinate info.
 * Used by tools that need to understand map layout and positioning.
 */
export interface MapContext {
    /** Map rendering options (null if no map loaded) */
    getOptions(): HexOptions | null;

    /** Base coordinate offset of the map */
    getBase(): AxialCoord;

    /** Map padding in pixels */
    getPadding(): number;
}

/**
 * Undo context - provides undo/redo functionality.
 * Used by tools that make reversible changes to the map.
 */
export interface UndoContext {
    /** Safe accessor - returns null when no map loaded */
    getUndoManager(): UndoManager | null;
    /** Throws with clear error if undo not available */
    requireUndoManager(): UndoManager;
}

/**
 * Layer context - provides access to layer visibility controls.
 * Used by tools that need to manage overlay layers.
 */
export interface LayerContext {
    /** Layer control panel handle (null if no map loaded) */
    getLayerPanel(): LayerControlPanelHandle | null;
}

/**
 * Navigation context - provides tool switching capability.
 * Used by tools that need to programmatically switch to other tools.
 */
export interface NavContext {
    /** Switch to a different tool by ID */
    switchTool?(toolId: string): Promise<void>;
}

/**
 * Guided setup context - provides access to the guided map setup flow.
 * Used by tools that participate in the new-map onboarding workflow.
 */
export interface GuidedSetupContext {
    /** Returns true if guided setup is active (new map just created) */
    isGuidedSetup?(): boolean;
    /** Clear the guided setup flag (called when setup completes) */
    clearGuidedSetup?(): void;
}

/**
 * Full tool panel context - composition of all sub-contexts.
 * This is the complete interface provided to tool panels for backward compatibility.
 *
 * @deprecated Use StoreToolContext instead. This interface will be removed
 * once all tools are migrated to use the Store directly.
 */
export type ToolPanelContext =
    CoreToolContext &
    RenderingContext &
    MapContext &
    UndoContext &
    LayerContext &
    NavContext &
    GuidedSetupContext;

// ============================================================================
// NEW: Store-based Tool Context (Phase 3)
// ============================================================================

/**
 * Simplified tool context using Store as single source of truth.
 *
 * Benefits over ToolPanelContext:
 * - 3 properties instead of 15+ getters
 * - State accessed directly from store (reactive)
 * - No indirection through getter functions
 *
 * Access patterns:
 * - `ctx.store.get().currentFile` instead of `ctx.getFile()`
 * - `ctx.store.get().handles` instead of `ctx.getHandles()`
 */
export interface StoreToolContext {
    /** Obsidian App instance */
    app: App;

    /** Unified state store - access all state via store.get() */
    store: CartographerStore;

    /** Convert mouse event to content-space coordinates */
    toContentPoint(ev: MouseEvent | PointerEvent): DOMPoint | null;
}

/**
 * Extended context that combines legacy getters with store.
 * Used during migration - tools can access either pattern.
 *
 * New tools should only use store.
 * Existing tools can gradually migrate from getters to store.
 */
export type ExtendedToolContext = ToolPanelContext & {
    /** Unified state store */
    store: CartographerStore;
};

/**
 * Minimal context for simple tools that don't interact with the canvas.
 * Example: Info panels, settings panels
 */
export type MinimalToolContext = CoreToolContext & UndoContext;

/**
 * Brush tool context - for tools that paint/edit the map.
 * Example: Terrain brush, area brush, climate brush
 */
export type BrushToolContext =
    CoreToolContext &
    RenderingContext &
    MapContext &
    UndoContext;

/**
 * Inspector tool context - for tools that display and manage map overlays.
 * Example: Tile inspector, location marker tool
 */
export type InspectorToolContext =
    CoreToolContext &
    RenderingContext &
    MapContext &
    LayerContext;

/**
 * Unified interface that all tool panels must implement.
 * All panels are persistent - they remain in memory when inactive.
 *
 * Lifecycle:
 * 1. Created once via factory (lazy instantiation on first activation)
 * 2. activate() / deactivate() called on tool switches (CSS toggle + event hooks)
 * 3. destroy() called only on plugin unload
 */
export type ToolPanelHandle = {
    /**
     * Called when this tool becomes active.
     * Should show the panel and enable event listeners.
     */
    activate(): void;

    /**
     * Called when this tool becomes inactive.
     * Should hide the panel and disable event listeners.
     * Panel state should be preserved!
     */
    deactivate(): void;

    /**
     * Called when the plugin is unloaded.
     * Should cleanup all resources.
     */
    destroy(): void;

    /**
     * Optional: Called when the map is rendered or file changes.
     * Use this to update tool state based on new map data.
     */
    onMapRendered?(): void | Promise<void>;

    /**
     * Optional: Called when user clicks on a hex.
     * Return true if the click was consumed (prevent other handlers).
     * @param coord Hex coordinate that was clicked
     * @param event Pointer event with mouse position for precise corner detection
     */
    handleHexClick?(coord: AxialCoord, event: PointerEvent): Promise<boolean>;

    /**
     * Optional: Called when the panel should be disabled (e.g., no map loaded).
     */
    setDisabled?(disabled: boolean): void;

    /**
     * Optional: Toggle tool mode (e.g., Paint/Erase for brush tools).
     * Called when user presses X key shortcut.
     */
    toggleMode?(): void;
};

// Import type dependencies (avoiding circular imports)
import type { LayerControlPanelHandle } from "../components/layer-control-panel";
import type { MapLayer } from "../../session-runner/travel/ui/map-layer";

// Re-export AxialCoord for convenience
export type { AxialCoord };
