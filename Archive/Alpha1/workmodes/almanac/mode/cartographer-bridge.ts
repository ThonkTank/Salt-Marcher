// src/workmodes/almanac/mode/cartographer-bridge.ts
// Bridge zwischen Cartographer-Travel-UI und der Almanac-State-Machine.

import { configurableLogger } from '@services/logging/configurable-logger';
import { registerCartographerBridgeProvider, type CartographerBridgeHandle } from "@services/orchestration";

const logger = configurableLogger.forModule('almanac-cartographer-bridge');
import type { CalendarTimestamp } from "../helpers";
import type { TravelCalendarMode } from "./contracts";
import type { AlmanacStateMachine } from "./state-machine";
import type { TravelAdvancePayload } from "./travel";

// Re-export the service type for consumers that still import from this module
export type { CartographerBridgeHandle } from "@services/orchestration";

type AlmanacDispatch = AlmanacStateMachine["dispatch"];
type AlmanacGetState = AlmanacStateMachine["getState"];

type MaybePromise<T> = Promise<T> | T;

export interface CartographerBridgeHandlers {
    onAdvance(payload: TravelAdvancePayload): Promise<void>;
    onModeChange(mode: TravelCalendarMode): Promise<void>;
    onJump(): Promise<void>;
    onClose(): Promise<void>;
    onFollowUp(eventId: string): Promise<void>;
}

type BridgeOptions = {
    readonly onRequestJump?: () => MaybePromise<void>;
    readonly onClose?: () => MaybePromise<void>;
    readonly onFollowUp?: (eventId: string) => MaybePromise<void>;
};

let activeBridge: CartographerBridgeHandle | null = null;

function warnInactive(action: string): void {
    logger.warn(`cartographer bridge ignored ${action} – no active dispatcher registered.`);
}

function logDispatchError(event: string, error: unknown): void {
    logger.error(`cartographer bridge dispatch for ${event} failed`, error);
}

export function registerCartographerBridge(
    machine: AlmanacStateMachine,
    options: BridgeOptions = {},
): CartographerBridgeHandle {
    const dispatch: AlmanacDispatch = machine.dispatch.bind(machine);
    const getState: AlmanacGetState = machine.getState.bind(machine);
    let released = false;
    let currentTravelId: string | null = null;

    const safeDispatch = async (event: Parameters<AlmanacDispatch>[0], label: string): Promise<void> => {
        if (released) {
            warnInactive(label);
            return;
        }
        try {
            await dispatch(event);
        } catch (error) {
            logDispatchError(label, error);
        }
    };

    let handle: CartographerBridgeHandle;

    const handlers: CartographerBridgeHandlers = {
        async onAdvance(payload) {
            if (!currentTravelId) {
                warnInactive("travel advance");
                return;
            }
            await safeDispatch(
                { type: "TRAVEL_TIME_ADVANCE_REQUESTED", amount: payload.amount, unit: payload.unit },
                "travel advance",
            );
        },
        async onModeChange(mode) {
            if (!currentTravelId) {
                warnInactive("travel mode change");
                return;
            }
            await safeDispatch({ type: "TRAVEL_MODE_CHANGED", mode }, "travel mode change");
        },
        async onJump() {
            if (released) {
                warnInactive("time jump");
                return;
            }
            if (options.onRequestJump) {
                await options.onRequestJump();
                return;
            }
            const state = getState();
            const timestamp = state.travelLeafState.currentTimestamp ?? state.calendarState.currentTimestamp;
            if (!timestamp) {
                warnInactive("time jump");
                return;
            }
            await safeDispatch({ type: "TIME_JUMP_REQUESTED", timestamp }, "time jump");
        },
        async onClose() {
            if (released) {
                return;
            }
            if (options.onClose) {
                await options.onClose();
                return;
            }
            await handle.unmount();
        },
        async onFollowUp(eventId) {
            if (released) {
                warnInactive("event follow-up");
                return;
            }
            if (options.onFollowUp) {
                await options.onFollowUp(eventId);
                return;
            }
            await safeDispatch({ type: "ALMANAC_MODE_SELECTED", mode: "events" }, "event follow-up");
        },
    };

    handle = {
        handlers,
        async mount(travelId) {
            if (released) {
                warnInactive("travel mount");
                return;
            }
            if (!travelId) {
                currentTravelId = null;
                return;
            }
            if (currentTravelId === travelId) {
                return;
            }
            currentTravelId = travelId;
            await safeDispatch({ type: "TRAVEL_LEAF_MOUNTED", travelId }, "travel leaf mount");
        },
        async unmount() {
            currentTravelId = null;
        },
        async requestTimeJump(timestamp) {
            await safeDispatch({ type: "TIME_JUMP_REQUESTED", timestamp }, "time jump");
        },
        release() {
            if (released) {
                return;
            }
            released = true;
            currentTravelId = null;
            if (activeBridge === handle) {
                activeBridge = null;
            }
        },
    } satisfies CartographerBridgeHandle;

    activeBridge = handle;
    return handle;
}

export function getCartographerBridge(): CartographerBridgeHandle | null {
    return activeBridge;
}

export function resetCartographerBridge(): void {
    activeBridge?.release();
    activeBridge = null;
}

// Register with the orchestration service so Session Runner can access via @services/orchestration
registerCartographerBridgeProvider(getCartographerBridge);

