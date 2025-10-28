// src/core/hex-mapper/render/types.ts

export type Destroyable = { destroy(): void };

export type HexCoord = { r: number; c: number };

export interface HexSceneConfig {
    host: HTMLElement;
    radius: number;
    padding: number;
    base: HexCoord;
    initialCoords: HexCoord[];
}

export interface HexScene extends Destroyable {
    svg: SVGSVGElement;
   contentG: SVGGElement;
   overlay: SVGRectElement;
   polyByCoord: Map<string, SVGPolygonElement>;
   ensurePolys(coords: HexCoord[]): void;
   setFill(coord: HexCoord, color: string): void;
    setOverlay(
        coord: HexCoord,
        overlay: { color: string; factionId?: string; factionName?: string; fillOpacity?: string; strokeWidth?: string } | null
    ): void;
   getViewBox(): { minX: number; minY: number; width: number; height: number };
}

export type HexCameraController = Destroyable;

export type HexInteractionController = Destroyable;

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
    handleDefaultClick(coord: HexCoord, ev: MouseEvent): Promise<void> | void;
}
