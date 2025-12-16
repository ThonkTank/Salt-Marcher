/**
 * Travel Experience Module
 *
 * Manages travel/route mechanics for Session Runner including:
 * - Travel logic lifecycle
 * - Route and token layers
 * - Hex interactions
 * - Terrain subscriptions
 * - Context sync service for weather/tile loading
 * - Playback controller
 *
 * This is the largest experience module as it handles the core
 * travel gameplay loop.
 *
 * @module workmodes/session-runner/view/experiences/travel-experience
 */

import { configurableLogger } from "@services/logging/configurable-logger";
import { fireAndForget } from "@services/error-handling";
import { loadTerrains, setBackgroundColorPalette, type RenderHandles } from "@features/maps";
import type { TFile } from "obsidian";
import type { MapHeaderSaveMode } from "@ui/maps/components/map-header";
import type { AxialCoord } from "@geometry";
import type { SessionRunnerLifecycleContext } from "../../controller";
import type { LogicStateSnapshot } from "../../travel/engine/travel-engine-types";
import type { RenderAdapter } from "../../travel/infra/adapter";
import { createTravelLogic } from "../../travel/engine/actions";
import { clearTravelStore } from "../../travel/engine/travel-store-registry";
import { createRouteLayer } from "../../travel/ui/route-layer";
import { createTokenLayer } from "../../travel/ui/token-layer";
import { TravelInteractionController } from "../controllers/interaction-controller";
import { TravelPlaybackController } from "../controllers/playback-controller";
import { createContextSyncService, type ContextSyncHandle } from "../services/context-sync";
import type { ExperienceCoordinator, ExperienceHandle } from "./experience-types";
import type { CalendarExperienceHandle } from "./calendar-experience";
import type { AudioExperienceHandle } from "./audio-experience";
import type { EncounterExperienceHandle } from "./encounter-experience";

const logger = configurableLogger.forModule("session-travel-experience");

/**
 * Extended handle for travel experience with route management methods
 */
export interface TravelExperienceHandle extends ExperienceHandle {
    /** Handle hex click interaction */
    onHexClick(
        coord: AxialCoord,
        event: MouseEvent,
        ctx: SessionRunnerLifecycleContext
    ): Promise<void>;

    /** Handle save request */
    onSave(
        mode: MapHeaderSaveMode,
        file: TFile,
        ctx: SessionRunnerLifecycleContext
    ): Promise<boolean>;

    /** Get travel logic state */
    getLogicState(): LogicStateSnapshot | null;
}

/**
 * Dependencies for travel experience
 */
export interface TravelExperienceDependencies {
    calendar: CalendarExperienceHandle;
    audio: AudioExperienceHandle;
    encounter: EncounterExperienceHandle;
}

/**
 * Create the travel experience module.
 *
 * @param coordinator - Shared experience coordinator
 * @param deps - Other experience modules this depends on
 * @returns Travel experience handle
 */
export function createTravelExperience(
    coordinator: ExperienceCoordinator,
    deps: TravelExperienceDependencies
): TravelExperienceHandle {
    const { calendar, audio, encounter } = deps;

    // State
    let app: import("obsidian").App | null = null;
    let hostEl: HTMLElement | null = null;
    let lifecycleContext: SessionRunnerLifecycleContext | null = null;

    // Travel logic
    let logic: ReturnType<typeof createTravelLogic> | null = null;
    const playback = new TravelPlaybackController();
    const interactions = new TravelInteractionController();

    // Layers
    let routeLayer: ReturnType<typeof createRouteLayer> | null = null;
    let tokenLayer: ReturnType<typeof createTokenLayer> | null = null;

    // Context sync
    let contextSyncService: ContextSyncHandle | null = null;

    // Terrain subscription
    let terrainEvent: { off(): void } | null = null;

    // Cleanup function for current file
    let cleanupFile: (() => void | Promise<void>) | null = null;

    /**
     * Handle state changes from travel logic.
     */
    const handleStateChange = (state: LogicStateSnapshot): void => {
        if (routeLayer) {
            routeLayer.draw(state.route, state.editIdx ?? null, state.tokenCoord ?? null);
        }
        coordinator.sidebar?.setSpeed(state.tokenSpeed);
        playback.sync(state);

        // Update audio context when tile changes
        const currentCoord = state.currentTile ?? state.tokenCoord ?? null;
        void audio.updateContext(coordinator.currentMapFile, currentCoord);

        // Sync hex context using ContextSyncService
        if (contextSyncService && coordinator.currentMapFile && coordinator.sidebar) {
            if (currentCoord) {
                fireAndForget(
                    contextSyncService.syncHex(
                        coordinator.currentMapFile,
                        currentCoord,
                        state.tokenSpeed
                    ),
                    `session-runner-context-sync`,
                    coordinator.notificationService
                );
            } else {
                contextSyncService.clearContext();
                coordinator.sidebar.setWeatherPlaceholder("Wähle ein Hex aus, um das Wetter zu sehen");
                coordinator.sidebar.setWeather(null);
                coordinator.sidebar.setWeatherHistory([]);
                coordinator.sidebar.setWeatherForecast([]);
                coordinator.sidebar.setCurrentHex(null);
                coordinator.sidebar.setSpeedCalculation({});
            }
        }
    };

    /**
     * Reset UI to default state.
     */
    const resetUi = (): void => {
        coordinator.sidebar?.setSpeed(1);
        coordinator.sidebar?.setWeather(null);
        coordinator.sidebar?.setWeatherHistory([]);
        coordinator.sidebar?.setWeatherForecast([]);
        coordinator.sidebar?.setCurrentHex(null);
        playback.reset();
    };

    /**
     * Load terrains and set color palette.
     */
    const ensureTerrains = async (ctx: SessionRunnerLifecycleContext): Promise<void> => {
        if (ctx.signal.aborted) return;
        const terrainMap = await loadTerrains(ctx.app);
        const colorMap = Object.fromEntries(
            Object.entries(terrainMap).map(([name, data]) => [name, data.color])
        );
        setBackgroundColorPalette(colorMap);
    };

    /**
     * Subscribe to terrain updates.
     */
    const subscribeToTerrains = (
        ctx: SessionRunnerLifecycleContext
    ): { off(): void } | null => {
        if (ctx.signal.aborted) {
            return null;
        }
        const workspace = ctx.app.workspace as any;
        const ref = workspace.on?.("salt:terrains-updated", () => {
            void ensureTerrains(ctx);
        });
        if (!ref) {
            return null;
        }
        return {
            off: () => {
                workspace.offref?.(ref);
            },
        };
    };

    /**
     * Run cleanup for current file.
     */
    const runCleanupFile = async (): Promise<void> => {
        if (!cleanupFile) return;
        const fn = cleanupFile;
        cleanupFile = null;
        try {
            await fn();
        } catch (err) {
            logger.error("cleanupFile failed", err);
        }
    };

    /**
     * Dispose file-specific resources.
     */
    const disposeFile = (): void => {
        interactions.dispose();
        if (tokenLayer) {
            tokenLayer.destroy?.();
            tokenLayer = null;
        }
        if (routeLayer) {
            routeLayer.destroy();
            routeLayer = null;
        }
        if (logic) {
            try {
                logic.pause();
            } catch (err) {
                logger.error("pause failed", err);
            }
            logic = null;
        }
    };

    /**
     * Refresh tidal layer after time advancement.
     */
    const refreshTidalLayer = (): void => {
        const mapLayer = lifecycleContext?.getMapLayer?.();
        if (mapLayer) {
            try {
                mapLayer.refreshTidalLayer();
                logger.info("Tidal layer refreshed after time advancement");
            } catch (err) {
                coordinator.notificationService.warning(
                    "Failed to refresh tidal layer",
                    { context: "session-runner-tidal", showToUser: false, logToConsole: true }
                );
            }
        }
    };

    /**
     * Create context sync service callbacks for sidebar updates.
     */
    const createContextSyncCallbacks = () => ({
        onTileLoaded: (coord: AxialCoord, tileData: any) => {
            if (coord.r < 0) {
                coordinator.sidebar?.setCurrentHex(null);
                return;
            }
            if (tileData) {
                coordinator.sidebar?.setCurrentHex({
                    coord,
                    terrain: tileData.terrain,
                    flora: tileData.flora,
                    moisture: tileData.moisture,
                });
                // Update encounter tracker with hex habitat
                const trackerHandle = encounter.getTrackerHandle();
                if (trackerHandle) {
                    void trackerHandle.updateHex(
                        { x: coord.q, y: coord.r },
                        {
                            terrain: tileData.terrain,
                            flora: tileData.flora,
                            moisture: tileData.moisture,
                        }
                    );
                }
            } else {
                coordinator.sidebar?.setCurrentHex({
                    coord,
                    terrain: undefined,
                    flora: undefined,
                    moisture: undefined,
                });
            }
        },
        onWeatherLoaded: (coord: AxialCoord, weather: any) => {
            if (coord.r < 0) {
                coordinator.sidebar?.setWeather(null);
                return;
            }
            coordinator.sidebar?.setWeather(weather);
            coordinator.sidebar?.setWeatherHistory([]);
            coordinator.sidebar?.setWeatherForecast([]);
        },
        onWeatherGenerating: (coord: AxialCoord) => {
            coordinator.sidebar?.setWeatherPlaceholder("Wetter wird generiert...");
            coordinator.sidebar?.setWeather(null);
        },
        onSpeedCalculated: (coord: AxialCoord, calculation: any) => {
            if (coord.r < 0 || !calculation) {
                coordinator.sidebar?.setSpeedCalculation({});
                return;
            }
            coordinator.sidebar?.setSpeedCalculation(calculation);
        },
        onError: (coord: AxialCoord, error: Error) => {
            logger.warn("Context sync error", { coord, error });
        },
    });

    return {
        async init(ctx: SessionRunnerLifecycleContext): Promise<void> {
            app = ctx.app;
            hostEl = ctx.host;
            lifecycleContext = ctx;

            hostEl.classList.add("sm-cartographer--travel");

            await ensureTerrains(ctx);
            if (coordinator.isAborted()) return;

            terrainEvent = subscribeToTerrains(ctx);
            if (coordinator.isAborted()) return;

            // Initialize context sync service
            if (coordinator.sidebar) {
                contextSyncService = createContextSyncService({
                    app: ctx.app,
                    callbacks: createContextSyncCallbacks(),
                });
                logger.info("Context sync service initialized");
            }

            // Mount playback to sidebar
            if (coordinator.sidebar) {
                playback.mount(coordinator.sidebar, {
                    play: () => {},
                    pause: () => {},
                    reset: () => {},
                });
            }

            resetUi();
            logger.info("Travel experience initialized");
        },

        async dispose(): Promise<void> {
            await runCleanupFile();
            disposeFile();
            resetUi();
            playback.dispose();

            if (contextSyncService) {
                contextSyncService.dispose();
                contextSyncService = null;
            }

            terrainEvent?.off();
            terrainEvent = null;

            // Clear global TravelStore to prevent stale state on re-entry
            clearTravelStore();

            hostEl?.classList?.remove?.("sm-cartographer--travel");
            hostEl = null;
            app = null;
            lifecycleContext = null;

            logger.info("Travel experience disposed");
        },

        async onFileChange(
            file: TFile | null,
            handles: RenderHandles | null,
            ctx: SessionRunnerLifecycleContext
        ): Promise<void> {
            lifecycleContext = ctx;

            await runCleanupFile();
            disposeFile();
            coordinator.sidebar?.setTitle?.(file?.basename ?? "");
            resetUi();

            if (coordinator.isAborted()) return;

            if (!file || !handles) {
                return;
            }

            const mapLayer = ctx.getMapLayer();
            if (!mapLayer) {
                return;
            }

            if (coordinator.isAborted()) return;

            routeLayer = createRouteLayer(handles.contentG, (rc) => mapLayer.centerOf(rc));
            tokenLayer = createTokenLayer(handles.contentG);

            const adapter: RenderAdapter = {
                ensurePolys: (coords) => mapLayer.ensurePolys(coords),
                centerOf: (coord) => mapLayer.centerOf(coord),
                draw: (route, tokenCoord) => {
                    if (routeLayer) routeLayer.draw(route, null, tokenCoord);
                },
                token: tokenLayer,
            };

            if (coordinator.isAborted()) return;

            const calendarGateway = calendar.getGateway();

            const activeLogic = createTravelLogic({
                app: ctx.app,
                minSecondsPerTile: 0.05,
                getMapFile: () => ctx.getFile(),
                adapter,
                onChange: (state) => handleStateChange(state),
                onEncounter: async () => {
                    if (coordinator.isAborted()) return;
                    await encounter.handleTravelEncounter();
                },
                onTimeAdvance: async (hours) => {
                    if (coordinator.isAborted()) return;
                    try {
                        if (!calendarGateway) {
                            logger.error("[travel] calendarGateway is not available");
                            return;
                        }

                        const activeCalendarId = calendarGateway.getActiveCalendarId();
                        if (!activeCalendarId) {
                            logger.info("[travel] No calendar active - skipping time advancement");
                            return;
                        }

                        await calendarGateway.advanceTimeBy(hours, "hour", {
                            hookContext: {
                                scope: "global",
                                travelId: null,
                                reason: "advance",
                            },
                        });

                        logger.info(`[travel] Attempting to refresh calendar (sidebar exists: ${!!coordinator.sidebar})`);
                        if (coordinator.sidebar) {
                            logger.info("[travel] Calling sidebar.refreshCalendar()");
                            await coordinator.sidebar.refreshCalendar();
                            logger.info("[travel] sidebar.refreshCalendar() completed");
                        }

                        refreshTidalLayer();

                        logger.info(`[travel] Advanced calendar time by ${hours.toFixed(2)} hours`);
                    } catch (err) {
                        logger.error("[travel] Failed to advance calendar time during playback", err);
                    }
                },
                onHexChange: async (coord) => {
                    logger.info("[travel] Hex change detected", { coord });
                },
            });
            logic = activeLogic;

            // Subscribe encounter controller to TravelStore
            encounter.subscribeToTravelStore();

            const triggerManualEncounterAt = async (idx: number): Promise<void> => {
                if (!logic || coordinator.isAborted()) return;
                const state = activeLogic.getState();
                const node = state.route[idx];
                if (!node) return;
                await encounter.handleManualEncounter({ q: node.q, r: node.r });
            };

            handleStateChange(activeLogic.getState());
            await activeLogic.initTokenFromTiles();
            if (coordinator.isAborted() || logic !== activeLogic) {
                await runCleanupFile();
                disposeFile();
                return;
            }

            // Trigger habitat update with initial token position
            handleStateChange(activeLogic.getState());

            interactions.bind(
                {
                    routeLayerEl: routeLayer.el,
                    tokenLayerEl: (tokenLayer as any).el as SVGGElement,
                    token: tokenLayer,
                    adapter,
                    polyToCoord: (poly) => mapLayer.polyToCoord.get(poly) ?? { q: 0, r: 0 },
                },
                {
                    getState: () => activeLogic.getState(),
                    selectDot: (idx) => activeLogic.selectDot(idx),
                    moveSelectedTo: (rc) => activeLogic.moveSelectedTo(rc),
                    moveTokenTo: (rc) => activeLogic.moveTokenTo(rc),
                    deleteUserAt: (idx) => activeLogic.deleteUserAt(idx),
                    triggerEncounterAt: (idx) => triggerManualEncounterAt(idx),
                }
            );

            cleanupFile = async () => {
                interactions.dispose();
                if (logic === activeLogic) {
                    logic = null;
                }
                try {
                    activeLogic.pause();
                } catch (err) {
                    logger.error("pause during cleanup failed", err);
                }
                tokenLayer?.destroy?.();
                tokenLayer = null;
                routeLayer?.destroy();
                routeLayer = null;
            };

            if (coordinator.isAborted()) return;
        },

        async onHexClick(
            coord: AxialCoord,
            event: MouseEvent,
            ctx: SessionRunnerLifecycleContext
        ): Promise<void> {
            if (coordinator.isAborted()) return;
            if (interactions.consumeClickSuppression()) {
                if (event.cancelable) event.preventDefault();
                event.stopPropagation();
                return;
            }
            // Ignore clicks that are not on an existing tile
            const handles = ctx?.getRenderHandles?.();
            if (handles && !handles.polyByCoord?.has?.(`${coord.q},${coord.r}`)) {
                return;
            }
            if (!logic) return;
            if (event.cancelable) event.preventDefault();
            event.stopPropagation();
            logic.handleHexClick(coord);
        },

        async onSave(
            mode: MapHeaderSaveMode,
            file: TFile,
            ctx: SessionRunnerLifecycleContext
        ): Promise<boolean> {
            if (coordinator.isAborted()) return false;
            if (!logic || !file) return false;
            try {
                await logic.persistTokenToTiles();
            } catch (err) {
                logger.error("persistTokenToTiles failed", err);
            }
            return false;
        },

        getLogicState(): LogicStateSnapshot | null {
            return logic?.getState() ?? null;
        },
    };
}
