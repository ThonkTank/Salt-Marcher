/**
 * Cartographer Unified Store
 *
 * Single source of truth for all Cartographer state.
 * Replaces scattered state across Controller, ToolPanelManager, and LayerManager.
 *
 * Benefits:
 * - All state in one place - easy to debug and serialize
 * - Derived state via selectors - no stale computed values
 * - Reactive updates via subscriptions
 * - Clear state transitions through update()
 *
 * @module workmodes/cartographer/store
 */

import type { TFile } from "obsidian";
import type { AxialCoord } from "@geometry";
import type { HexOptions } from "@features/maps/config/options";
import type { RenderHandles } from "@features/maps/rendering/hex-render";
import type { UndoManager } from "@features/maps";
import type { ToolId } from "../editor/tool-registry";
import { writable, type WritableStore } from "@services/state/writable-store";
import { configurableLogger } from "@services/logging/configurable-logger";

const logger = configurableLogger.forModule("cartographer-store");

// ============================================================================
// State Types
// ============================================================================

/**
 * Layer configuration for a single layer
 */
export interface LayerConfig {
	id: string;
	visible: boolean;
	opacity: number;
}

/**
 * Complete Cartographer state
 */
export interface CartographerState {
	// ==================== File State ====================
	/** Currently loaded map file (null if none) */
	currentFile: TFile | null;

	/** Parsed hex options from current file */
	hexOptions: HexOptions | null;

	/** Whether there are unsaved changes */
	isDirty: boolean;

	// ==================== Tool State ====================
	/** Currently active tool */
	activeTool: ToolId;

	/** Brush radius (1-6) */
	brushRadius: number;

	/** Current brush mode */
	brushMode: "paint" | "erase";

	// ==================== Selection State ====================
	/** Currently selected hex (for inspector) */
	selectedHex: AxialCoord | null;

	/** Currently hovered hex (for tooltips) */
	hoveredHex: AxialCoord | null;

	// ==================== Layer State ====================
	/** Configuration for all layers */
	layerConfigs: LayerConfig[];

	/** Whether left sidebar (layer panel) is visible */
	layerPanelVisible: boolean;

	/** Active layer preset ID (if any) */
	activePreset: string | null;

	// ==================== Rendering State ====================
	/** Canvas rendering handles (null if no map loaded) */
	handles: RenderHandles | null;

	// ==================== Editor State ====================
	/** Undo manager instance (null if no map loaded) */
	undoManager: UndoManager | null;

	/** Whether undo is available */
	canUndo: boolean;

	/** Whether redo is available */
	canRedo: boolean;

	// ==================== UI State ====================
	/** Whether the workmode is currently loading */
	isLoading: boolean;

	/** Current status message (if any) */
	statusMessage: string | null;

	/** Status message variant */
	statusVariant: "info" | "loading" | "error" | null;

	/** Whether guided setup is active (new map) */
	isGuidedSetup: boolean;
}

// ============================================================================
// Initial State
// ============================================================================

/**
 * Default initial state for a fresh Cartographer session
 */
export const INITIAL_STATE: CartographerState = {
	// File
	currentFile: null,
	hexOptions: null,
	isDirty: false,

	// Tool
	activeTool: "gradient-brush",
	brushRadius: 1,
	brushMode: "paint",

	// Selection
	selectedHex: null,
	hoveredHex: null,

	// Layers
	layerConfigs: [],
	layerPanelVisible: true,
	activePreset: null,

	// Rendering
	handles: null,

	// Editor
	undoManager: null,
	canUndo: false,
	canRedo: false,

	// UI
	isLoading: false,
	statusMessage: null,
	statusVariant: null,
	isGuidedSetup: false,
};

// ============================================================================
// Store Creation
// ============================================================================

/**
 * CartographerStore interface extending WritableStore with convenience methods
 */
export interface CartographerStore extends WritableStore<CartographerState> {
	/** Reset to initial state */
	reset(): void;

	/** Partial update (merges with current state) */
	patch(partial: Partial<CartographerState>): void;
}

/**
 * Create a new Cartographer store instance
 */
export function createCartographerStore(initialState?: Partial<CartographerState>): CartographerStore {
	const store = writable<CartographerState>(
		{ ...INITIAL_STATE, ...initialState },
		{ debug: false, name: "cartographer-store" }
	);

	return {
		...store,

		reset(): void {
			logger.debug("Store reset to initial state");
			store.set(INITIAL_STATE);
		},

		patch(partial: Partial<CartographerState>): void {
			store.update((state) => ({ ...state, ...partial }));
		},
	};
}

// ============================================================================
// Selectors (Derived State)
// ============================================================================

/**
 * Selector functions for deriving state
 * Use these instead of accessing state properties directly for computed values
 */
export const selectors = {
	/** Is a map currently loaded? */
	hasMap: (state: CartographerState): boolean => state.currentFile !== null && state.hexOptions !== null,

	/** Can the user perform brush operations? */
	canBrush: (state: CartographerState): boolean =>
		state.currentFile !== null && state.hexOptions !== null && !state.isLoading,

	/** Is the current tool a brush-type tool? */
	isBrushTool: (state: CartographerState): boolean =>
		["tile-brush", "terrain-brush", "area-brush", "climate-brush", "gradient-brush", "feature-brush"].includes(
			state.activeTool
		),

	/** Get layer config by ID */
	getLayerConfig: (state: CartographerState, layerId: string): LayerConfig | undefined =>
		state.layerConfigs.find((l) => l.id === layerId),

	/** Is a specific layer visible? */
	isLayerVisible: (state: CartographerState, layerId: string): boolean =>
		state.layerConfigs.find((l) => l.id === layerId)?.visible ?? false,

	/** Get visible layer IDs */
	visibleLayers: (state: CartographerState): string[] =>
		state.layerConfigs.filter((l) => l.visible).map((l) => l.id),

	/** Has any user interaction occurred? */
	hasInteracted: (state: CartographerState): boolean =>
		state.selectedHex !== null || state.isDirty || state.canUndo,
};

// ============================================================================
// Action Helpers
// ============================================================================

/**
 * Helper functions for common state transitions
 * These return partial state objects for use with store.patch()
 */
export const actions = {
	/** Set file loading state */
	startLoading: (): Partial<CartographerState> => ({
		isLoading: true,
		statusMessage: "Loading...",
		statusVariant: "loading",
	}),

	/** Clear loading state */
	stopLoading: (): Partial<CartographerState> => ({
		isLoading: false,
		statusMessage: null,
		statusVariant: null,
	}),

	/** Set error state */
	setError: (message: string): Partial<CartographerState> => ({
		isLoading: false,
		statusMessage: message,
		statusVariant: "error",
	}),

	/** Update file state after successful load */
	fileLoaded: (file: TFile, options: HexOptions, handles?: RenderHandles | null, undoManager?: UndoManager | null): Partial<CartographerState> => ({
		currentFile: file,
		hexOptions: options,
		handles: handles ?? null,
		undoManager: undoManager ?? null,
		isLoading: false,
		isDirty: false,
		selectedHex: null,
		canUndo: false,
		canRedo: false,
	}),

	/** Clear file state */
	fileClosed: (): Partial<CartographerState> => ({
		currentFile: null,
		hexOptions: null,
		handles: null,
		undoManager: null,
		isDirty: false,
		selectedHex: null,
		hoveredHex: null,
		canUndo: false,
		canRedo: false,
	}),

	/** Update tool state */
	toolChanged: (toolId: ToolId): Partial<CartographerState> => ({
		activeTool: toolId,
		// Reset selection when changing tools (optional)
		// selectedHex: null,
	}),

	/** Update brush settings */
	brushSettingsChanged: (radius?: number, mode?: "paint" | "erase"): Partial<CartographerState> => {
		const partial: Partial<CartographerState> = {};
		if (radius !== undefined) partial.brushRadius = radius;
		if (mode !== undefined) partial.brushMode = mode;
		return partial;
	},

	/** Update selection */
	hexSelected: (coord: AxialCoord | null): Partial<CartographerState> => ({
		selectedHex: coord,
	}),

	/** Update hover */
	hexHovered: (coord: AxialCoord | null): Partial<CartographerState> => ({
		hoveredHex: coord,
	}),

	/** Update undo/redo availability */
	undoStateChanged: (canUndo: boolean, canRedo: boolean): Partial<CartographerState> => ({
		canUndo,
		canRedo,
	}),

	/** Mark as dirty (has unsaved changes) */
	markDirty: (): Partial<CartographerState> => ({
		isDirty: true,
	}),

	/** Mark as clean (no unsaved changes) */
	markClean: (): Partial<CartographerState> => ({
		isDirty: false,
	}),
};
