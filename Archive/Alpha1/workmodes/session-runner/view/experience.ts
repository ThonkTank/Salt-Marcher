/**
 * Session Runner Experience Coordinator
 *
 * Orchestrates the individual experience modules (calendar, audio, encounter, travel)
 * and provides the unified SessionRunnerExperience interface.
 *
 * This file has been refactored from ~890 LOC to ~200 LOC by extracting
 * domain-specific logic into separate experience modules in ./experiences/.
 *
 * @module workmodes/session-runner/view/experience
 */

import "../session-runner.css";
import { configurableLogger } from "@services/logging/configurable-logger";
import type { TFile } from "obsidian";
import type { RenderHandles } from "@features/maps";
import type { MapHeaderSaveMode } from "@ui/maps/components/map-header";
import { getErrorNotificationService } from "@services/error-notification-service";
import { getPartyStore, getAveragePartyLevel, getPartySize } from "@services/state/party-store";
import { buildEncounterContext } from "../encounter-context-builder";
import { createSidebar, type Sidebar } from "../travel/ui/sidebar";
import type { SessionRunnerExperience, SessionRunnerLifecycleContext } from "../session-runner-controller";
import type { EncounterTrackerHandle } from "../encounter-tracker-handle";
import type { MutableCoordinatorState, ExperienceCoordinator } from "./experiences/types";
import {
    createCalendarExperience,
    createAudioExperience,
    createEncounterExperience,
    createTravelExperience,
    type CalendarExperienceHandle,
    type AudioExperienceHandle,
    type EncounterExperienceHandle,
    type TravelExperienceHandle,
} from "./experiences";

const logger = configurableLogger.forModule("session-experience");

/**
 * Create the unified Session Runner experience.
 *
 * This coordinator manages the lifecycle of individual experience modules
 * and routes events to the appropriate handlers.
 */
export function createSessionRunnerExperience(): SessionRunnerExperience {
    // Mutable coordinator state
    const state: MutableCoordinatorState = {
        sidebar: null,
        currentMapFile: null,
    };

    // Lifecycle signal
    let lifecycleSignal: AbortSignal | null = null;

    // Notification service for error handling
    const notificationService = getErrorNotificationService(logger);

    // Create coordinator interface
    const coordinator: ExperienceCoordinator = {
        get sidebar() {
            return state.sidebar;
        },
        get currentMapFile() {
            return state.currentMapFile;
        },
        notificationService,
        isAborted: () => lifecycleSignal?.aborted ?? false,
    };

    // Experience handles
    let calendar: CalendarExperienceHandle | null = null;
    let audio: AudioExperienceHandle | null = null;
    let encounter: EncounterExperienceHandle | null = null;
    let travel: TravelExperienceHandle | null = null;

    /**
     * Set the encounter tracker handle from controller.
     */
    const setEncounterTrackerHandle = (handle: EncounterTrackerHandle): void => {
        encounter?.setTrackerHandle(handle);
        logger.info("Encounter tracker handle set");
    };

    return {
        id: "travel",
        label: "Travel",

        async onEnter(ctx: SessionRunnerLifecycleContext): Promise<void> {
            lifecycleSignal = ctx.signal;
            if (coordinator.isAborted()) return;

            // Clear sidebar hosts
            ctx.leftSidebarHost.empty();
            ctx.rightSidebarHost.empty();
            if (coordinator.isAborted()) return;

            // Create calendar experience first (provides gateway for sidebar)
            calendar = createCalendarExperience(coordinator);
            await calendar.init(ctx);
            if (coordinator.isAborted()) return;

            // Open Almanac workmode helper
            const onOpenAlmanac = (): void => {
                void ctx.app.workspace.getLeaf(true).setViewState({
                    type: "almanac",
                    active: true,
                });
            };

            // Get plugin instance
            const plugin = (ctx.app as any).plugins?.plugins?.["salt-marcher"];

            // Create sidebar
            const gateway = calendar.getGateway();
            if (!gateway) {
                logger.error("Calendar gateway not available for sidebar");
                return;
            }
            state.sidebar = createSidebar(
                ctx.leftSidebarHost,
                ctx.rightSidebarHost,
                ctx.app,
                gateway,
                calendar.getTravelId(),
                onOpenAlmanac,
                // Unified travel control callbacks
                {
                    onPlay: () => (coordinator.isAborted() ? undefined : travel?.getLogicState() ? undefined : undefined),
                    onStop: () => undefined,
                    onReset: () => undefined,
                    onTempoChange: (value) => undefined,
                    onRandomEncounter: async () => {
                        if (coordinator.isAborted() || !travel) return;
                        try {
                            const logicState = travel.getLogicState();
                            if (!logicState) return;

                            const currentCoord = logicState.currentTile ?? logicState.tokenCoord ?? null;

                            // Load tile data before building context
                            const { loadTile } = await import("@features/maps");
                            let tileData = null;
                            if (state.currentMapFile && currentCoord) {
                                tileData = await loadTile(ctx.app, state.currentMapFile, currentCoord);
                            }

                            const context = await buildEncounterContext(
                                ctx.app,
                                ctx.getFile(),
                                logicState
                            );
                            if (encounter) {
                                await encounter.generateRandomEncounter(context);
                            }
                        } catch (err) {
                            logger.error("Random encounter generation failed", err);
                        }
                    },
                    onSpeedChange: (value) => undefined,
                    onTimeAdvance: () => calendar?.refreshPanel(),
                    onJumpToDate: () => calendar?.refreshPanel(),
                }
            );
            if (coordinator.isAborted()) return;

            state.sidebar.setTitle?.(ctx.getFile()?.basename ?? "");

            // Create audio experience
            audio = createAudioExperience(coordinator);
            await audio.init(ctx);
            if (coordinator.isAborted()) return;

            // Create encounter experience (needs audio for combat music)
            encounter = createEncounterExperience(coordinator, audio);
            await encounter.init(ctx);
            if (coordinator.isAborted()) return;

            // Create travel experience (needs all other experiences)
            travel = createTravelExperience(coordinator, { calendar, audio, encounter });
            await travel.init(ctx);
            if (coordinator.isAborted()) return;

            logger.info("Session Runner experience initialized");
        },

        async onExit(ctx: SessionRunnerLifecycleContext): Promise<void> {
            lifecycleSignal = ctx.signal;

            // Dispose in reverse order
            if (travel) {
                await travel.dispose();
                travel = null;
            }

            if (encounter) {
                await encounter.dispose();
                encounter = null;
            }

            if (audio) {
                await audio.dispose();
                audio = null;
            }

            if (calendar) {
                await calendar.dispose();
                calendar = null;
            }

            // Cleanup sidebar
            state.sidebar?.destroy();
            state.sidebar = null;
            state.currentMapFile = null;

            lifecycleSignal = null;
            logger.info("Session Runner experience disposed");
        },

        async onFileChange(
            file: TFile | null,
            handles: RenderHandles | null,
            ctx: SessionRunnerLifecycleContext
        ): Promise<void> {
            lifecycleSignal = ctx.signal;

            // Update coordinator state
            state.currentMapFile = file;
            state.sidebar?.setTitle?.(file?.basename ?? "");

            // Propagate to experiences
            await calendar?.onFileChange?.(file, handles, ctx);
            if (coordinator.isAborted()) return;

            await travel?.onFileChange?.(file, handles, ctx);
            if (coordinator.isAborted()) return;

            await encounter?.onFileChange?.(file, handles, ctx);
        },

        async onHexClick(
            coord: { q: number; r: number },
            event: CustomEvent<{ q: number; r: number }>,
            ctx: SessionRunnerLifecycleContext
        ): Promise<void> {
            lifecycleSignal = ctx.signal;
            if (coordinator.isAborted()) return;

            await travel?.onHexClick(coord, event as any, ctx);
        },

        async onSave(
            mode: MapHeaderSaveMode,
            file: TFile | null,
            ctx: SessionRunnerLifecycleContext
        ): Promise<boolean> {
            lifecycleSignal = ctx.signal;
            if (coordinator.isAborted()) return false;

            if (!file) return false;
            return (await travel?.onSave(mode, file, ctx)) ?? false;
        },

        setEncounterTrackerHandle,
    } as SessionRunnerExperience & {
        setEncounterTrackerHandle: typeof setEncounterTrackerHandle;
    };
}
