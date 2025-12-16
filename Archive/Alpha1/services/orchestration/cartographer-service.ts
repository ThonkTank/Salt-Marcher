/**
 * Cartographer Service
 *
 * Provides cross-workmode communication for cartographer integration.
 * Session Runner uses this service to communicate with Almanac's cartographer bridge
 * without direct imports between workmodes.
 *
 * Architecture:
 * - Almanac registers the bridge implementation at startup
 * - Session Runner consumes via this service interface
 * - No direct cross-workmode imports needed
 *
 * @module services/orchestration/cartographer-service
 */

// ============================================================================
// Types (minimal, consumer-focused)
// ============================================================================

/**
 * Travel panel snapshot for UI updates
 */
export type TravelPanelSnapshot = {
    readonly travelId: string | null;
    readonly timestampLabel?: string;
    readonly message?: string;
    readonly reason: "advance" | "jump" | "init";
    readonly logEntries: ReadonlyArray<{
        readonly kind: "event" | "phenomenon";
        readonly id: string;
        readonly title: string;
        readonly occurrenceLabel: string;
        readonly skipped?: boolean;
    }>;
};

// Re-export CalendarTimestamp from the proper domain module
import type { CalendarTimestamp } from "@services/domain/calendar/calendar-timestamp";
export type { CalendarTimestamp } from "@services/domain/calendar/calendar-timestamp";

/**
 * Travel calendar mode (calendar view type)
 */
export type TravelCalendarMode = "month" | "week" | "day" | "upcoming";

/**
 * Cartographer bridge handle for time management
 */
export interface CartographerBridgeHandle {
    mount(travelId: string | null): Promise<void>;
    unmount(): Promise<void>;
    requestTimeJump(timestamp: CalendarTimestamp): Promise<void>;
    release(): void;
    readonly handlers: {
        onAdvance(payload: { amount: number; unit: "minute" | "hour" | "day" }): Promise<void>;
        onModeChange(mode: TravelCalendarMode): Promise<void>;
        onJump(): Promise<void>;
        onClose(): Promise<void>;
        onFollowUp(eventId: string): Promise<void>;
    };
}

/**
 * Cartographer hook gateway for event subscriptions and travel lifecycle
 */
export interface CartographerHookGateway {
    // Subscription methods (for listeners)
    onPanelUpdate(
        travelId: string | null,
        listener: (snapshot: TravelPanelSnapshot) => void | Promise<void>
    ): () => void;
    onTravelStart(listener: (travelId: string | null) => void | Promise<void>): () => void;
    onTravelEnd(listener: (travelId: string | null) => void | Promise<void>): () => void;
    getPanelSnapshot(travelId: string | null): TravelPanelSnapshot | null;

    // Emission methods (for producers - Session Runner notifies travel context changes)
    emitTravelStart(travelId: string): void;
    emitTravelEnd(travelId: string): void;
}

// ============================================================================
// Service Registry
// ============================================================================

let bridgeProvider: (() => CartographerBridgeHandle | null) | null = null;
let hookGatewayInstance: CartographerHookGateway | null = null;

/**
 * Register the cartographer bridge provider.
 * Called by Almanac at startup.
 *
 * @param provider - Function that returns the active bridge handle
 */
export function registerCartographerBridgeProvider(
    provider: () => CartographerBridgeHandle | null
): void {
    bridgeProvider = provider;
}

/**
 * Register the cartographer hook gateway instance.
 * Called by Almanac at startup.
 *
 * @param gateway - The hook gateway instance
 */
export function registerCartographerHookGateway(
    gateway: CartographerHookGateway
): void {
    hookGatewayInstance = gateway;
}

/**
 * Get the current cartographer bridge (if Almanac is active).
 * Used by Session Runner for time advancement.
 *
 * @returns Bridge handle or null if unavailable
 */
export function getCartographerBridge(): CartographerBridgeHandle | null {
    return bridgeProvider?.() ?? null;
}

/**
 * Get the cartographer hook gateway.
 * Used by Session Runner for panel update subscriptions.
 *
 * @returns Hook gateway or null if not registered
 */
export function getCartographerHookGateway(): CartographerHookGateway | null {
    return hookGatewayInstance;
}

/**
 * Check if cartographer service is available.
 * True when Almanac workmode has registered its implementation.
 */
export function isCartographerServiceAvailable(): boolean {
    return bridgeProvider !== null || hookGatewayInstance !== null;
}

/**
 * Reset the service (for testing).
 */
export function resetCartographerService(): void {
    bridgeProvider = null;
    hookGatewayInstance = null;
}
