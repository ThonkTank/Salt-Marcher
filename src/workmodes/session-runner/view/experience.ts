// src/workmodes/session-runner/view/experience.ts
// Reiseerlebnis für den Session Runner inklusive UI, Logik und Encounter-Übergaben.
import type { MapHeaderSaveMode } from "../../../features/maps/map-header";
import type { SessionRunnerExperience, SessionRunnerLifecycleContext } from "../controller";
import { loadTerrains } from "../../../features/maps/data/terrain-repository";
import { setTerrains } from "../../../features/maps/domain/terrain";
import { createSidebar, type Sidebar } from "../travel/ui/sidebar";
import { createRouteLayer } from "../travel/ui/route-layer";
import { createTokenLayer } from "../travel/ui/token-layer";
import { createTravelLogic } from "../travel/domain/actions";
import type { LogicStateSnapshot } from "../travel/domain/types";
import type { RenderAdapter } from "../travel/infra/adapter";
import { cartographerHookGateway } from "../../almanac/mode/cartographer-gateway";
import { getCartographerBridge } from "../../almanac/mode/cartographer-bridge";
import type { CartographerBridgeHandle } from "../../almanac/mode/cartographer-bridge";
import { TravelPlaybackController } from "./controllers/playback-controller";
import { TravelInteractionController } from "./controllers/interaction-controller";
import { logger } from "../../../app/plugin-logger";
import {
    openEncounter,
    preloadEncounterModule,
    publishManualEncounter,
} from "./controllers/encounter-gateway";
import { createEncounterSync } from "../travel/infra/encounter-sync";
import { createAudioController, type AudioControllerHandle } from "../components/audio-controller";

export function createSessionRunnerExperience(): SessionRunnerExperience {
    let sidebar: Sidebar | null = null;
    const playback = new TravelPlaybackController();
    let activeTravelId: string | null = null;
    let panelUnsubscribe: (() => void) | null = null;
    let logic = null as ReturnType<typeof createTravelLogic> | null;
    const interactions = new TravelInteractionController();
    let routeLayer: ReturnType<typeof createRouteLayer> | null = null;
    let tokenLayer: ReturnType<typeof createTokenLayer> | null = null;
    let cleanupFile: (() => void | Promise<void>) | null = null;
    let hostEl: HTMLElement | null = null;
    let terrainEvent: { off(): void } | null = null;
    let lifecycleSignal: AbortSignal | null = null;
    let encounterSync: ReturnType<typeof createEncounterSync> | null = null;
    let bridgeTravelId: string | null = null;
    let audioController: AudioControllerHandle | null = null;
    let currentMapFile: ReturnType<SessionRunnerLifecycleContext["getFile"]> = null;

    const runBridge = (
        label: string,
        fn: (bridge: CartographerBridgeHandle) => Promise<void> | void,
    ): void => {
        const bridge = getCartographerBridge();
        if (!bridge) {
            logger.warn(`[session-runner] skipped ${label} – no Almanac bridge available`);
            return;
        }
        void Promise.resolve(fn(bridge)).catch(error => {
            logger.error(`[session-runner] ${label} failed`, error);
        });
    };

    const isAborted = () => lifecycleSignal?.aborted ?? false;

    const bailIfAborted = async (): Promise<boolean> => {
        if (!isAborted()) {
            return false;
        }
        await abortLifecycle();
        return true;
    };

    const handleStateChange = (state: LogicStateSnapshot) => {
        if (routeLayer) {
            routeLayer.draw(state.route, state.editIdx ?? null, state.tokenRC ?? null);
        }
        sidebar?.setTile(state.currentTile ?? state.tokenRC ?? null);
        sidebar?.setSpeed(state.tokenSpeed);
        playback.sync(state);

        // Update audio context when tile changes
        if (audioController) {
            const currentCoord = state.currentTile ?? state.tokenRC ?? null;
            void audioController.updateContext(currentMapFile, currentCoord);
        }
    };

    const resetUi = () => {
        sidebar?.setTile(null);
        sidebar?.setSpeed(1);
        sidebar?.setTravelPanel(null);
        playback.reset();
    };

    const detachPanelSubscription = () => {
        if (!panelUnsubscribe) return;
        try {
            panelUnsubscribe();
        } finally {
            panelUnsubscribe = null;
        }
    };

    const pushPanelSnapshot = (panel: ReturnType<typeof cartographerHookGateway.getPanelSnapshot>) => {
        if (sidebar) {
            sidebar.setTravelPanel(panel);
        }
    };

    const updatePanelSnapshotFromGateway = (travelId: string | null) => {
        pushPanelSnapshot(cartographerHookGateway.getPanelSnapshot(travelId));
    };

    const updateTravelContext = (file: ReturnType<SessionRunnerLifecycleContext["getFile"]>) => {
        const nextId = file ? file.path : null;
        if (activeTravelId === nextId) {
            updatePanelSnapshotFromGateway(nextId);
            return;
        }
        if (activeTravelId) {
            cartographerHookGateway.emitTravelEnd(activeTravelId);
        }
        if (bridgeTravelId) {
            runBridge("travel unmount", (bridge) => bridge.unmount());
            bridgeTravelId = null;
        }
        detachPanelSubscription();
        activeTravelId = nextId;
        if (activeTravelId) {
            cartographerHookGateway.emitTravelStart(activeTravelId);
            panelUnsubscribe = cartographerHookGateway.onPanelUpdate(activeTravelId, (panel) => {
                if (!isAborted()) {
                    pushPanelSnapshot(panel);
                }
            });
            updatePanelSnapshotFromGateway(activeTravelId);
            const travelIdToMount = activeTravelId;
            runBridge("travel mount", (bridge) => bridge.mount(travelIdToMount));
            bridgeTravelId = travelIdToMount;
        } else {
            pushPanelSnapshot(null);
            runBridge("travel unmount", (bridge) => bridge.unmount());
        }
    };

    const runCleanupFile = async () => {
        if (!cleanupFile) return;
        const fn = cleanupFile;
        cleanupFile = null;
        try {
            await fn();
        } catch (err) {
            logger.error("[session-runner] cleanupFile failed", err);
        }
    };

    const detachSidebar = () => {
        sidebar?.destroy();
        sidebar = null;
    };

    const releaseTerrainEvent = () => {
        terrainEvent?.off();
        terrainEvent = null;
    };

    const removeTravelClass = () => {
        hostEl?.classList?.remove?.("sm-cartographer--travel");
        hostEl = null;
    };

    const abortLifecycle = async () => {
        await runCleanupFile();
        disposeFile();
        resetUi();
        playback.dispose();
        if (audioController) {
            audioController.dispose();
            audioController = null;
        }
        detachSidebar();
        releaseTerrainEvent();
        removeTravelClass();
    };

    const disposeFile = () => {
        updateTravelContext(null);
        interactions.dispose();
        encounterSync?.dispose();
        encounterSync = null;
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
                logger.error("[session-runner] pause failed", err);
            }
            logic = null;
        }
    };

    const ensureTerrains = async (ctx: SessionRunnerLifecycleContext) => {
        if (ctx.signal.aborted) return;
        await setTerrains(await loadTerrains(ctx.app));
    };

    const subscribeToTerrains = (ctx: SessionRunnerLifecycleContext) => {
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

    return {
        id: "travel",
        label: "Travel",
        async onEnter(ctx: SessionRunnerLifecycleContext) {
            lifecycleSignal = ctx.signal;
            if (await bailIfAborted()) {
                return;
            }

            hostEl = ctx.host;
            hostEl.classList.add("sm-cartographer--travel");

            await ensureTerrains(ctx);
            if (await bailIfAborted()) {
                return;
            }

            terrainEvent = subscribeToTerrains(ctx);
            if (await bailIfAborted()) {
                return;
            }

            preloadEncounterModule();
            if (await bailIfAborted()) {
                return;
            }

            ctx.sidebarHost.empty();
            if (await bailIfAborted()) {
                return;
            }

            sidebar = createSidebar(ctx.sidebarHost);
            if (await bailIfAborted()) {
                return;
            }

            sidebar.setTitle?.(ctx.getFile()?.basename ?? "");
            sidebar.setTravelHandlers({
                onAdvance: (payload) => runBridge("travel advance", (bridge) => bridge.handlers.onAdvance(payload)),
                onModeChange: (mode) => runBridge("travel mode change", (bridge) => bridge.handlers.onModeChange(mode)),
                onJump: () => runBridge("time jump", (bridge) => bridge.handlers.onJump()),
                onClose: () => runBridge("travel close", (bridge) => bridge.handlers.onClose()),
                onFollowUp: (eventId) => runBridge("event follow-up", (bridge) => bridge.handlers.onFollowUp(eventId)),
            });
            sidebar.onSpeedChange((value) => {
                if (!isAborted()) {
                    logic?.setTokenSpeed(value);
                }
            });

            playback.mount(sidebar, {
                play: () => (isAborted() ? undefined : logic?.play() ?? undefined),
                pause: () => (isAborted() ? undefined : logic?.pause()),
                reset: () => (isAborted() ? undefined : logic?.reset()),
                setTempo: (value) => (isAborted() ? undefined : logic?.setTempo?.(value)),
            });

            if (await bailIfAborted()) {
                return;
            }

            // Initialize audio controller
            try {
                audioController = await createAudioController({
                    app: ctx.app,
                    host: ctx.sidebarHost,
                });
                logger.info("[session-runner] Audio controller initialized");
            } catch (error) {
                logger.error("[session-runner] Failed to initialize audio controller", error);
            }

            if (await bailIfAborted()) {
                return;
            }

            resetUi();
        },
        async onExit(ctx: SessionRunnerLifecycleContext) {
            lifecycleSignal = ctx.signal;
            await abortLifecycle();
            lifecycleSignal = null;
        },
        async onFileChange(file, handles, ctx: SessionRunnerLifecycleContext) {
            lifecycleSignal = ctx.signal;

            await runCleanupFile();
            disposeFile();
            sidebar?.setTitle?.(file?.basename ?? "");
            resetUi();

            // Update current map file for audio context
            currentMapFile = file;

            if (await bailIfAborted()) {
                return;
            }

            if (!file || !handles) {
                return;
            }

            const mapLayer = ctx.getMapLayer();
            if (!mapLayer) {
                return;
            }

            updateTravelContext(file);

            routeLayer = createRouteLayer(handles.contentG, (rc) => mapLayer.centerOf(rc));
            tokenLayer = createTokenLayer(handles.contentG);

            const adapter: RenderAdapter = {
                ensurePolys: (coords) => mapLayer.ensurePolys(coords),
                centerOf: (rc) => mapLayer.centerOf(rc),
                draw: (route, tokenRC) => {
                    if (routeLayer) routeLayer.draw(route, null, tokenRC);
                },
                token: tokenLayer,
            };

            if (await bailIfAborted()) {
                return;
            }

            const activeLogic = createTravelLogic({
                app: ctx.app,
                minSecondsPerTile: 0.05,
                getMapFile: () => ctx.getFile(),
                adapter,
                onChange: (state) => handleStateChange(state),
                onEncounter: async () => {
                    if (isAborted()) {
                        return;
                    }
                    if (encounterSync) {
                        await encounterSync.handleTravelEncounter();
                    }
                },
            });
            logic = activeLogic;

            encounterSync = createEncounterSync({
                getMapFile: () => ctx.getFile?.() ?? null,
                getState: () => activeLogic.getState(),
                pausePlayback: () => {
                    try {
                        activeLogic.pause();
                    } catch (err) {
                        logger.error("[session-runner] pause during encounter sync failed", err);
                    }
                },
                openEncounter: (context) => openEncounter(ctx.app, context),
                onExternalEncounter: () => !isAborted(),
            });

            const triggerManualEncounterAt = async (idx: number) => {
                if (!encounterSync || isAborted()) {
                    return;
                }
                const state = activeLogic.getState();
                const node = state.route[idx];
                if (!node) {
                    return;
                }
                await publishManualEncounter(
                    ctx.app,
                    {
                        mapFile: ctx.getFile?.() ?? null,
                        state,
                    },
                    {
                        coordOverride: { r: node.r, c: node.c },
                    },
                );
            };

            handleStateChange(activeLogic.getState());
            await activeLogic.initTokenFromTiles();
            if (isAborted() || logic !== activeLogic) {
                await runCleanupFile();
                disposeFile();
                return;
            }

            interactions.bind(
                {
                    routeLayerEl: routeLayer.el,
                    tokenLayerEl: (tokenLayer as any).el as SVGGElement,
                    token: tokenLayer,
                    adapter,
                    polyToCoord: mapLayer.polyToCoord,
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
                encounterSync?.dispose();
                encounterSync = null;
                if (logic === activeLogic) {
                    logic = null;
                }
                try {
                    activeLogic.pause();
                } catch (err) {
                    logger.error("[session-runner] pause during cleanup failed", err);
                }
                tokenLayer?.destroy?.();
                tokenLayer = null;
                routeLayer?.destroy();
                routeLayer = null;
            };

            if (await bailIfAborted()) {
                return;
            }
        },
        async onHexClick(coord, event, ctx: SessionRunnerLifecycleContext) {
            lifecycleSignal = ctx.signal;
            if (await bailIfAborted()) {
                return;
            }
            if (interactions.consumeClickSuppression()) {
                if (event.cancelable) event.preventDefault();
                event.stopPropagation();
                return;
            }
            // Ignore clicks that are not on an existing tile (no visual poly)
            const handles = ctx?.getRenderHandles?.();
            if (handles && !handles.polyByCoord?.has?.(`${coord.r},${coord.c}`)) {
                return;
            }
            if (!logic) return;
            if (event.cancelable) event.preventDefault();
            event.stopPropagation();
            logic.handleHexClick(coord);
        },
        async onSave(_mode: MapHeaderSaveMode, file, ctx: SessionRunnerLifecycleContext) {
            lifecycleSignal = ctx.signal;
            if (await bailIfAborted()) {
                return false;
            }
            if (!logic || !file) return false;
            try {
                await logic.persistTokenToTiles();
            } catch (err) {
                logger.error("[session-runner] persistTokenToTiles failed", err);
            }
            return false;
        },
    } satisfies SessionRunnerExperience;
}
