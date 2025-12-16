// src/workmodes/cartographer/cartographer-types.ts
/**
 * Public type definitions for Cartographer workmode
 *
 * Contains all controller types and domain types in one unified file.
 */

import type { App, TFile } from "obsidian";
import type { HexOptions } from "@features/maps/config/options";
import type { LayerControlPanelHandle } from "./components/layer-control-panel";
import type { ToolToolbarHandle } from "./components/tool-toolbar";
import type { TooltipHandle } from "./components/tooltip-renderer";
import type { KeyboardHandlerHandle } from "./keyboard-handler";
import type SaltMarcherPlugin from "@app/main";
import type { RenderHandles } from "@features/maps/rendering/hex-render";
import type { ViewContainerHandle } from "@ui/components/view-container";
import type { MapHeaderSaveMode } from "@ui/maps/components/map-header";
import type { MapManagerHandle } from "@ui/maps/workflows/map-manager";
import type { MapLayer } from "../session-runner/travel/ui/map-layer";
import type { AxialCoord } from "./contracts/controller-interfaces";

// Re-export coordinate type
export type { AxialCoord };

type MaybePromise<T> = T | Promise<T>;

/**
 * Callbacks exposed by CartographerController
 *
 * These are invoked by UI components (header, layer panel, toolbar) to coordinate
 * controller state.
 */
export type CartographerControllerCallbacks = {
    onModeSelect(id: string, ctx?: { readonly signal: AbortSignal }): MaybePromise<void>; // Legacy - no-op
    onOpen(file: TFile): MaybePromise<void>;
    onCreate(file: TFile): MaybePromise<void>;
    onDelete(file: TFile): MaybePromise<void>;
    onSave(mode: MapHeaderSaveMode, file: TFile | null): MaybePromise<boolean>;
    onHexClick(coord: AxialCoord, event: CustomEvent<AxialCoord>): MaybePromise<void>;
};

/**
 * View handle encapsulating all UI components
 *
 * Created once per controller mount and destroyed on unmount.
 * Provides handles to all UI components for lifecycle management.
 */
export type CartographerViewHandle = {
    readonly mapHost: HTMLElement;
    readonly sidebarHost: HTMLElement;
    readonly leftSidebarHost: HTMLElement;
    readonly surface: ViewContainerHandle;
    readonly layerPanel: LayerControlPanelHandle;
    readonly keyboardHandler: KeyboardHandlerHandle;
    readonly toolbar: ToolToolbarHandle;
    readonly tooltip: TooltipHandle;
    setFileLabel(file: TFile | null): void;
    setOverlay(content: string | null): void;
    clearMap(): void;
    attachTooltipListeners(handles: RenderHandles, file: TFile): void;
    destroy(): void;
};

/**
 * Dependency injection container for CartographerController
 *
 * Allows injecting custom implementations of map loading and creation
 * for testing and customization.
 */
export type CartographerControllerDeps = {
    createMapManager(app: App, options: Parameters<typeof import("../../ui/maps/workflows/map-manager").createMapManager>[1]): MapManagerHandle;
    createMapLayer(app: App, host: HTMLElement, file: TFile, opts: HexOptions): Promise<MapLayer>;
    loadHexOptions(app: App, file: TFile): Promise<HexOptions | null>;
    plugin?: SaltMarcherPlugin;
};

/**
 * CartographerController public interface
 *
 * Main controller for the Cartographer workmode. Orchestrates:
 * - File operations (open, save, delete)
 * - Tool panel management (integrated editor)
 * - Map layer lifecycle
 * - View creation and destruction
 * - Layer panel state persistence
 * - Elevation visualization
 * - Keyboard shortcuts
 */
export interface CartographerControllerInterface {
    readonly callbacks: CartographerControllerCallbacks;

    // Lifecycle
    onOpen(host: HTMLElement, fallbackFile: TFile | null): Promise<void>;
    onClose(): Promise<void>;
    setFile(file: TFile | null): Promise<void>;

    // Mode management (legacy - returns "editor" always)
    getCurrentMode(): string | null;

    // Keyboard shortcuts
    getCurrentTool(): string | null;
    switchTool(toolId: string): Promise<void>;
    toggleBrushMode(): void;
    toggleToolMode(): void;
    focusRegionDropdown(): void;
    focusFactionDropdown(): void;
    showHelp(): void;
    undo(): Promise<void>;
    redo(): Promise<void>;

    // Layer panel
    toggleLayerPanel(): void;
    toggleLayer(layerId: string): void;
    applyLayerPreset(presetId: string): void;
}

// Re-export domain types from contracts
export type {
    ToolPanelHandle,
    ToolPanelContext,
    // Sub-context interfaces
    CoreToolContext,
    RenderingContext,
    MapContext,
    UndoContext,
    LayerContext,
    NavContext,
    // Specialized context types
    MinimalToolContext,
    BrushToolContext,
    InspectorToolContext,
} from './contracts/controller-interfaces';
