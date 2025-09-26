// src/core/hex-mapper/render/types.ts

export type HexCoord = { r: number; c: number };

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

export type Destroyable = { destroy(): void };
