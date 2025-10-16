// src/core/hex-mapper/render/interaction-delegate.ts
import type {
    HexCoord,
    HexInteractionDelegate,
    HexInteractionEventDetail,
    HexInteractionOutcome,
    HexInteractionPhase,
} from "./types";

const EVENT_NAME = "hex:click";

type DispatchResult = HexInteractionOutcome;

function dispatchInteraction(
    host: HTMLElement,
    coord: HexCoord,
    phase: HexInteractionPhase,
    nativeEvent: MouseEvent | PointerEvent
): DispatchResult {
    let outcome: HexInteractionOutcome | null = null;
    const detail: HexInteractionEventDetail = {
        r: coord.r,
        c: coord.c,
        phase,
        nativeEvent,
        setOutcome(next) {
            outcome = next;
        },
    };
    const evt = new CustomEvent<HexInteractionEventDetail>(EVENT_NAME, {
        detail,
        bubbles: true,
        cancelable: true,
    });
    host.dispatchEvent(evt);
    if (outcome) return outcome;
    if (evt.defaultPrevented) {
        if (phase === "paint" && nativeEvent instanceof PointerEvent) {
            const pointer = nativeEvent as PointerEvent;
            if (pointer.button === 0 || pointer.buttons === 1) {
                return "start-paint";
            }
        }
        return "handled";
    }
    return "default";
}

export function createEventBackedInteractionDelegate(host: HTMLElement): HexInteractionDelegate {
    return {
        onClick(coord, ev) {
            return dispatchInteraction(host, coord, "click", ev);
        },
        onPaintStep(coord, ev) {
            return dispatchInteraction(host, coord, "paint", ev);
        },
    };
}
