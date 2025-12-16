/**
 * Calendar Experience Module
 *
 * Manages calendar/time integration for Session Runner including:
 * - Calendar gateway lifecycle
 * - Cartographer bridge communication
 * - Travel panel subscriptions
 * - Time advancement coordination
 *
 * @module workmodes/session-runner/view/experiences/calendar-experience
 */

import { configurableLogger } from "@services/logging/configurable-logger";
import { fireAndForget } from "@services/error-handling";
import {
    createAlmanacGateway,
    getCartographerBridge,
    getCartographerHookGateway,
} from "@services/orchestration";
import type { CartographerBridgeHandle } from "@services/orchestration";
import type { TFile } from "obsidian";
import type { RenderHandles } from "@features/maps";
import type { SessionRunnerLifecycleContext } from "../../controller";
import type { ExperienceCoordinator, ExperienceHandle } from "./experience-types";

const logger = configurableLogger.forModule("session-calendar-experience");

/**
 * Extended handle for calendar experience with time management methods
 */
export interface CalendarExperienceHandle extends ExperienceHandle {
    /** Get the current travel ID (map file path) */
    getTravelId(): string | null;

    /** Refresh the calendar panel display */
    refreshPanel(): void;

    /** Get the calendar gateway for time operations */
    getGateway(): ReturnType<typeof createAlmanacGateway> | null;

    /**
     * Update travel context when map file changes.
     * Manages bridge mounting and panel subscriptions.
     */
    updateTravelContext(file: TFile | null): void;
}

/**
 * Create the calendar experience module.
 *
 * @param coordinator - Shared experience coordinator
 * @returns Calendar experience handle
 */
export function createCalendarExperience(
    coordinator: ExperienceCoordinator
): CalendarExperienceHandle {
    // State
    let calendarGateway: ReturnType<typeof createAlmanacGateway> | null = null;
    let activeTravelId: string | null = null;
    let bridgeTravelId: string | null = null;
    let panelUnsubscribe: (() => void) | null = null;
    let app: import("obsidian").App | null = null;

    /**
     * Run a function against the cartographer bridge if available.
     */
    const runBridge = (
        label: string,
        fn: (bridge: CartographerBridgeHandle) => Promise<void> | void
    ): void => {
        const bridge = getCartographerBridge();
        if (!bridge) {
            logger.debug(
                `${label} skipped – Cartographer bridge not available (Almanac workmode not open)`
            );
            return;
        }
        fireAndForget(
            Promise.resolve(fn(bridge)),
            `session-runner-calendar-${label}`,
            coordinator.notificationService
        );
    };

    /**
     * Detach the panel update subscription.
     */
    const detachPanelSubscription = (): void => {
        if (!panelUnsubscribe) return;
        try {
            panelUnsubscribe();
        } finally {
            panelUnsubscribe = null;
        }
    };

    /**
     * Refresh the calendar panel display in the sidebar.
     */
    const refreshCalendarPanel = (): void => {
        if (coordinator.sidebar) {
            void coordinator.sidebar.refreshCalendar();
            void coordinator.sidebar.refreshEvents();
        }
    };

    /**
     * Update panel snapshot from the gateway.
     */
    const updatePanelSnapshotFromGateway = (travelId: string | null): void => {
        refreshCalendarPanel();
    };

    /**
     * Update travel context when map file changes.
     * Manages bridge mounting, travel start/end notifications, and panel subscriptions.
     */
    const updateTravelContext = (file: TFile | null): void => {
        const nextId = file ? file.path : null;
        const hookGateway = getCartographerHookGateway();

        if (activeTravelId === nextId) {
            updatePanelSnapshotFromGateway(nextId);
            return;
        }

        // Notify travel end for previous travel
        if (activeTravelId && hookGateway) {
            hookGateway.emitTravelEnd(activeTravelId);
        }

        // Unmount previous bridge travel
        if (bridgeTravelId) {
            runBridge("travel unmount", (bridge) => bridge.unmount());
            bridgeTravelId = null;
        }

        detachPanelSubscription();
        activeTravelId = nextId;

        if (activeTravelId) {
            // Notify travel start
            if (hookGateway) {
                hookGateway.emitTravelStart(activeTravelId);
                panelUnsubscribe = hookGateway.onPanelUpdate(
                    activeTravelId,
                    (panel) => {
                        if (!coordinator.isAborted()) {
                            refreshCalendarPanel();
                        }
                    }
                );
            }

            updatePanelSnapshotFromGateway(activeTravelId);

            // Mount bridge for new travel
            const travelIdToMount = activeTravelId;
            runBridge("travel mount", (bridge) => bridge.mount(travelIdToMount));
            bridgeTravelId = travelIdToMount;
        } else {
            refreshCalendarPanel();
            runBridge("travel unmount", (bridge) => bridge.unmount());
        }
    };

    /**
     * Initialize calendar for a map file.
     */
    const initializeCalendarForFile = async (file: TFile): Promise<void> => {
        if (!calendarGateway) return;

        try {
            const snapshot = await calendarGateway.loadSnapshot();
            const activeCalendarId = calendarGateway.getActiveCalendarId();
            const hasActiveCalendar = activeCalendarId !== null;

            // If a calendar exists but isn't set as active, set it now
            if (!hasActiveCalendar && snapshot.activeCalendar) {
                logger.info(`Initializing calendar: ${snapshot.activeCalendar.id}`);

                const initialTimestamp = snapshot.currentTimestamp ?? {
                    calendarId: snapshot.activeCalendar.id,
                    year: snapshot.activeCalendar.epoch.year,
                    monthId: snapshot.activeCalendar.months[0].id,
                    day: 1,
                    hour: 0,
                    minute: 0,
                };

                await calendarGateway.setActiveCalendar(snapshot.activeCalendar.id, {
                    initialTimestamp: initialTimestamp as any,
                });

                logger.info(`Calendar initialized successfully`, {
                    calendarId: snapshot.activeCalendar.id,
                    travelId: activeTravelId,
                    timestamp: initialTimestamp,
                });
            } else if (!snapshot.activeCalendar) {
                logger.warn(`No calendar available - time tracking will be disabled`);
            } else {
                logger.info(`Calendar already active for travel scope: ${activeCalendarId}`);
            }
        } catch (err) {
            logger.error("Failed to initialize calendar", err);
        }
    };

    return {
        async init(ctx: SessionRunnerLifecycleContext): Promise<void> {
            app = ctx.app;

            // Create calendar gateway for sidebar
            if (!calendarGateway) {
                calendarGateway = createAlmanacGateway(ctx.app);
            }

            logger.info("Calendar experience initialized");
        },

        async dispose(): Promise<void> {
            // Clean up travel context
            updateTravelContext(null);

            // Release gateway reference
            calendarGateway = null;
            app = null;

            logger.info("Calendar experience disposed");
        },

        async onFileChange(
            file: TFile | null,
            handles: RenderHandles | null,
            ctx: SessionRunnerLifecycleContext
        ): Promise<void> {
            updateTravelContext(file);

            // Initialize calendar gateway for this travel scope
            if (!calendarGateway && app) {
                calendarGateway = createAlmanacGateway(app);
            }

            if (file && calendarGateway) {
                await initializeCalendarForFile(file);
            }
        },

        getTravelId(): string | null {
            return activeTravelId;
        },

        refreshPanel(): void {
            refreshCalendarPanel();
        },

        getGateway(): ReturnType<typeof createAlmanacGateway> | null {
            return calendarGateway;
        },

        updateTravelContext,
    };
}
