// src/core/hex-mapper/render/types.ts
import type { AxialCoord } from "@geometry";
import type { TerrainType, FloraType } from "../config/terrain";

export type Destroyable = { destroy(): void };
export type HexCoord = AxialCoord;

/**
 * Multi-channel overlay support
 * Allows multiple overlay types per hex with priority-based rendering
 */
export interface OverlayChannel {
    type: string;           // "faction" | "influence" | "weather" | "event"
    color: string;          // RGB hex color
    opacity: number;        // 0.0 - 1.0
    blendMode?: string;     // CSS blend mode (default: "multiply")
    priority: number;       // Higher = rendered on top
    metadata?: Record<string, unknown>; // Type-specific data
}

export type OverlayChannelMap = Record<string, OverlayChannel>;

export interface HexSceneConfig {
    host: HTMLElement;
    radius: number;
    padding: number;
    base: HexCoord;
    initialCoords: HexCoord[];
    tileStore?: import("../state/tile-store").TileStore; // Optional: enables variant-aware rendering
}

export interface HexScene extends Destroyable {
    svg: SVGSVGElement;
   contentG: SVGGElement;
   overlay: SVGRectElement;
   polyByCoord: Map<string, SVGPolygonElement>;
   ensurePolys(coords: readonly HexCoord[]): void;
   /** Removes a hex polygon and its associated icons from the scene */
   removeHex(coord: HexCoord): boolean;
   /** Sets the terrain fill color (base layer) independently of overlays */
   setTerrainFill(coord: HexCoord, color: string): void;
   /** Sets the faction overlay (middle layer) independently of terrain */
   setFactionOverlay(
       coord: HexCoord,
       overlay: { color: string; factionId?: string; factionName?: string; fillOpacity?: string; strokeWidth?: string } | null
   ): void;

   // Icon-based terrain system
   /** Sets the terrain icon for a hex */
   setTerrainIcon(coord: HexCoord, terrain: TerrainType | undefined): void;
   /** Sets the flora icon for a hex */
   setFloraIcon(coord: HexCoord, flora: FloraType | undefined): void;
   /** Sets the moisture icon for a hex */
   setMoistureIcon(coord: HexCoord, moisture: import("../domain/terrain").MoistureLevel | undefined): void;
   /** Sets the background color for a hex (optional colored background behind icons) */
   setBackgroundColor(coord: HexCoord, color: string | undefined): void;
   /** Controls visibility of icon layers (terrain, flora, or moisture) */
   setIconLayerVisibility(layer: 'terrain' | 'flora' | 'moisture', visible: boolean): void;
   /** Controls opacity of icon layers (terrain, flora, or moisture) */
   setIconLayerOpacity(layer: 'terrain' | 'flora' | 'moisture', opacity: number): void;

   getViewBox(): { minX: number; minY: number; width: number; height: number };
}

export type HexCameraController = Destroyable;

export interface HexInteractionController extends Destroyable {
    setDelegate(delegate: HexInteractionDelegate | null): void;
    setHexClickCallback(cb: ((coord: HexCoord, ev: MouseEvent) => HexInteractionOutcome | Promise<HexInteractionOutcome>) | null): void;
}

export interface HexCoordinateTranslator {
    toContentPoint(ev: MouseEvent | PointerEvent): DOMPoint | null;
    pointToCoord(x: number, y: number): HexCoord;
}

export type HexInteractionOutcome = "default" | "handled" | "start-paint";

export type HexInteractionPhase = "click" | "paint";

export type HexInteractionEventDetail = {
    r: number;
    c: number;
    /**
     * Phase der Interaktion. "click" = diskretes Auslösen (Mouse/Touch),
     * "paint" = kontinuierliches Ziehen über eine gedrückte Primärtaste.
     */
    phase: HexInteractionPhase;
    nativeEvent: MouseEvent | PointerEvent;
    /** Erlaubt Listenern, ein explizites Ergebnis zu liefern. */
    setOutcome(outcome: HexInteractionOutcome): void;
};

export interface HexInteractionDelegate {
    onClick?(coord: HexCoord, ev: MouseEvent): HexInteractionOutcome | Promise<HexInteractionOutcome>;
    onPaintStep?(coord: HexCoord, ev: PointerEvent): HexInteractionOutcome | Promise<HexInteractionOutcome>;
    onPaintEnd?(): void;
}

export type HexInteractionDelegateRef = { current: HexInteractionDelegate };

export interface HexInteractionAdapter {
    delegateRef: HexInteractionDelegateRef;
    setDelegate(delegate: HexInteractionDelegate | null): void;
}
