// src/apps/cartographer/modes/travel-guide.ts
// Komplettmodus für Reisen inkl. UI und Logik.
import type { MapHeaderSaveMode } from "../../../ui/map-header";
import type { CartographerMode, CartographerModeLifecycleContext } from "../presenter";
import { loadTerrains } from "../../../core/terrain-store";
import { setTerrains } from "../../../core/terrain";
import { createSidebar, type Sidebar } from "../travel/ui/sidebar";
import { createRouteLayer } from "../travel/ui/route-layer";
import { createTokenLayer } from "../travel/ui/token-layer";
import { createTravelLogic } from "../travel/domain/actions";
import type { LogicStateSnapshot } from "../travel/domain/types";
import type { RenderAdapter } from "../travel/infra/adapter";
import { TravelPlaybackController } from "./travel-guide/playback-controller";
import { TravelInteractionController } from "./travel-guide/interaction-controller";
import {
    openEncounter,
    preloadEncounterModule,
    publishManualEncounter,
} from "./travel-guide/encounter-gateway";
import { createEncounterSync } from "../travel/infra/encounter-sync";

export function createTravelGuideMode(): CartographerMode {
    let sidebar: Sidebar | null = null;
    const playback = new TravelPlaybackController();
    let logic = null as ReturnType<typeof createTravelLogic> | null;
    const interactions = new TravelInteractionController();
    let routeLayer: ReturnType<typeof createRouteLayer> | null = null;
    let tokenLayer: ReturnType<typeof createTokenLayer> | null = null;
    let cleanupFile: (() => void | Promise<void>) | null = null;
    let hostEl: HTMLElement | null = null;
    let terrainEvent: { off(): void } | null = null;
    let lifecycleSignal: AbortSignal | null = null;
    let encounterSync: ReturnType<typeof createEncounterSync> | null = null;

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
    };

    const resetUi = () => {
        sidebar?.setTile(null);
        sidebar?.setSpeed(1);
        playback.reset();
    };

    const runCleanupFile = async () => {
        if (!cleanupFile) return;
        const fn = cleanupFile;
        cleanupFile = null;
        try {
            await fn();
        } catch (err) {
            console.error("[travel-mode] cleanupFile failed", err);
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
        detachSidebar();
        releaseTerrainEvent();
        removeTravelClass();
    };

    const disposeFile = () => {
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
                console.error("[travel-mode] pause failed", err);
            }
            logic = null;
        }
    };

    const ensureTerrains = async (ctx: CartographerModeLifecycleContext) => {
        if (ctx.signal.aborted) return;
        await setTerrains(await loadTerrains(ctx.app));
    };

    const subscribeToTerrains = (ctx: CartographerModeLifecycleContext) => {
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
        async onEnter(ctx: CartographerModeLifecycleContext) {
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

            resetUi();
        },
        async onExit(ctx: CartographerModeLifecycleContext) {
            lifecycleSignal = ctx.signal;
            await abortLifecycle();
            lifecycleSignal = null;
        },
        async onFileChange(file, handles, ctx: CartographerModeLifecycleContext) {
            lifecycleSignal = ctx.signal;

            await runCleanupFile();
            disposeFile();
            sidebar?.setTitle?.(file?.basename ?? "");
            resetUi();

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
                        console.error("[travel-mode] pause during encounter sync failed", err);
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
                    console.error("[travel-mode] pause during cleanup failed", err);
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
        async onHexClick(coord, event, ctx: CartographerModeLifecycleContext) {
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
        async onSave(_mode: MapHeaderSaveMode, file, ctx: CartographerModeLifecycleContext) {
            lifecycleSignal = ctx.signal;
            if (await bailIfAborted()) {
                return false;
            }
            if (!logic || !file) return false;
            try {
                await logic.persistTokenToTiles();
            } catch (err) {
                console.error("[travel-mode] persistTokenToTiles failed", err);
            }
            return false;
        },
    } satisfies CartographerMode;
}
