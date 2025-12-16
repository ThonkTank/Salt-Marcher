// src/workmodes/cartographer/contracts/events.ts
// Type-safe event system for Cartographer workmode

import type { AxialCoord } from "@geometry";

/**
 * Event type constants for Cartographer workmode
 * Prevents magic string errors and enables autocomplete
 */
export const CARTOGRAPHER_EVENTS = {
    /** Hex clicked by user */
    HEX_CLICK: "hex:click",
    /** Hex hovered by user */
    HEX_HOVER: "hex:hover",
    /** Tool changed in toolbar */
    TOOL_CHANGE: "tool:change",
    /** Layer visibility/config changed */
    LAYER_CHANGE: "layer:change",
    /** Terrains updated in tile store */
    TERRAINS_UPDATED: "salt:terrains-updated",
} as const;

export type CartographerEventType = typeof CARTOGRAPHER_EVENTS[keyof typeof CARTOGRAPHER_EVENTS];

/**
 * Typed payload definitions for each event
 * Ensures compile-time safety for event handlers
 */
export interface CartographerEventPayloads {
    [CARTOGRAPHER_EVENTS.HEX_CLICK]: {
        coord: AxialCoord;
        nativeEvent: PointerEvent | MouseEvent;
    };
    [CARTOGRAPHER_EVENTS.HEX_HOVER]: {
        coord: AxialCoord;
        nativeEvent: MouseEvent;
    };
    [CARTOGRAPHER_EVENTS.TOOL_CHANGE]: {
        from: string | null;
        to: string;
    };
    [CARTOGRAPHER_EVENTS.LAYER_CHANGE]: {
        layerId: string;
        visible: boolean;
        opacity?: number;
    };
    [CARTOGRAPHER_EVENTS.TERRAINS_UPDATED]: {
        mapPath: string;
        count: number;
    };
}

/**
 * Type-safe event emission helper
 *
 * @example
 * ```ts
 * emitCartographerEvent(
 *     element,
 *     CARTOGRAPHER_EVENTS.HEX_CLICK,
 *     { coord: { q: 0, r: 0 }, nativeEvent: evt }
 * );
 * ```
 */
export function emitCartographerEvent<K extends CartographerEventType>(
    target: EventTarget,
    type: K,
    detail: CartographerEventPayloads[K]
): void {
    const event = new CustomEvent(type, {
        detail,
        bubbles: true,
        cancelable: true,
    });
    target.dispatchEvent(event);
}

/**
 * Type-safe event listener helper
 * Returns cleanup function for easy disposal
 *
 * @example
 * ```ts
 * const cleanup = onCartographerEvent(
 *     element,
 *     CARTOGRAPHER_EVENTS.HEX_CLICK,
 *     ({ coord, nativeEvent }) => {
 *         console.log("Clicked hex:", coord);
 *     }
 * );
 * // Later...
 * cleanup();
 * ```
 */
export function onCartographerEvent<K extends CartographerEventType>(
    target: EventTarget,
    type: K,
    handler: (payload: CartographerEventPayloads[K]) => void,
    options?: AddEventListenerOptions
): () => void {
    const listener = (e: Event) => {
        if (e instanceof CustomEvent) {
            handler(e.detail);
        }
    };
    target.addEventListener(type, listener, options);
    return () => target.removeEventListener(type, listener, options);
}

/**
 * Legacy compatibility: Extract AxialCoord from CustomEvent detail
 * Used during migration period to support old event handlers
 *
 * @deprecated Use typed event handlers instead
 */
export function extractHexCoord(event: Event): AxialCoord | null {
    if (!(event instanceof CustomEvent)) return null;
    const detail = event.detail;

    // Check if detail is already an AxialCoord
    if (detail && typeof detail === 'object' && 'q' in detail && 'r' in detail) {
        return { q: detail.q, r: detail.r };
    }

    // Check if detail contains coord property
    if (detail && typeof detail === 'object' && 'coord' in detail) {
        const coord = detail.coord;
        if (coord && typeof coord === 'object' && 'q' in coord && 'r' in coord) {
            return { q: coord.q, r: coord.r };
        }
    }

    return null;
}
