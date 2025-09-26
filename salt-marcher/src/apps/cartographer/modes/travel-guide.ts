import type { MapHeaderSaveMode } from "../../../ui/map-header";
import type { CartographerMode, CartographerModeContext } from "../presenter";
import { loadTerrains } from "../../../core/terrain-store";
import { setTerrains } from "../../../core/terrain";
import { createSidebar, type Sidebar } from "../travel/ui/sidebar";
import {
    createPlaybackControls,
    type PlaybackControlsHandle,
} from "../travel/ui/controls";
import { createRouteLayer } from "../travel/ui/route-layer";
import { createTokenLayer } from "../travel/ui/token-layer";
import {
    createDragController,
    type DragController,
} from "../travel/ui/drag.controller";
import { bindContextMenu } from "../travel/ui/contextmenue";
import { createTravelLogic } from "../travel/domain/actions";
import type {
    LogicStateSnapshot,
    RouteNode,
} from "../travel/domain/types";
import type { RenderAdapter } from "../travel/infra/adapter";

export function createTravelGuideMode(): CartographerMode {
    let sidebar: Sidebar | null = null;
    let playback: PlaybackControlsHandle | null = null;
    let logic = null as ReturnType<typeof createTravelLogic> | null;
    let drag: DragController | null = null;
    let unbindContext: (() => void) | null = null;
    let routeLayer: ReturnType<typeof createRouteLayer> | null = null;
    let tokenLayer: ReturnType<typeof createTokenLayer> | null = null;
    let cleanupFile: (() => void | Promise<void>) | null = null;
    let terrainsReady = false;
    let hostEl: HTMLElement | null = null;

    const handleStateChange = (state: LogicStateSnapshot) => {
        if (routeLayer) {
            routeLayer.draw(state.route, state.editIdx ?? null, state.tokenRC ?? null);
        }
        sidebar?.setTile(state.currentTile ?? state.tokenRC ?? null);
        sidebar?.setSpeed(state.tokenSpeed);
        playback?.setState({ playing: state.playing, route: state.route });
        (playback as any)?.setClock?.(state.clockHours ?? 0);
        (playback as any)?.setTempo?.(state.tempo ?? 1);
    };

    const resetUi = () => {
        sidebar?.setTile(null);
        sidebar?.setSpeed(1);
        playback?.setState({ playing: false, route: [] as RouteNode[] });
    };

    const disposeInteractions = () => {
        if (drag) {
            drag.unbind();
            drag = null;
        }
        if (unbindContext) {
            unbindContext();
            unbindContext = null;
        }
    };

    const disposeFile = () => {
        disposeInteractions();
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

    const ensureTerrains = async (ctx: CartographerModeContext) => {
        if (terrainsReady) return;
        await setTerrains(await loadTerrains(ctx.app));
        terrainsReady = true;
    };

    return {
        id: "travel",
        label: "Travel",
        async onEnter(ctx) {
            // Ensure travel-specific styles are active in Cartographer
            hostEl = ctx.host;
            hostEl.classList.add("sm-cartographer--travel");
            await ensureTerrains(ctx);
            ctx.sidebarHost.empty();
            sidebar = createSidebar(ctx.sidebarHost);
            sidebar.setTitle?.(ctx.getFile()?.basename ?? "");
            sidebar.onSpeedChange((value) => {
                logic?.setTokenSpeed(value);
            });
            playback = createPlaybackControls(sidebar.controlsHost, {
                onPlay: () => {
                    void logic?.play();
                },
                onStop: () => {
                    logic?.pause();
                },
                onReset: () => {
                    void logic?.reset();
                },
                onTempoChange: (v) => { logic?.setTempo?.(v); },
            });
            resetUi();
        },
        async onExit() {
            // Remove travel-specific style scope when leaving mode
            await cleanupFile?.();
            cleanupFile = null;
            disposeFile();
            playback?.destroy();
            playback = null;
            sidebar?.destroy();
            sidebar = null;
            hostEl?.classList?.remove?.("sm-cartographer--travel");
            hostEl = null;
        },
        async onFileChange(file, handles, ctx) {
            await cleanupFile?.();
            cleanupFile = null;
            disposeFile();
            sidebar?.setTitle?.(file?.basename ?? "");
            resetUi();

            if (!file || !handles) {
                return;
            }

            const mapLayer = ctx.getMapLayer();
            if (!mapLayer) {
                return;
            }

            routeLayer = createRouteLayer(
                handles.contentG,
                (rc) => mapLayer.centerOf(rc)
            );
            tokenLayer = createTokenLayer(handles.contentG);

            const adapter: RenderAdapter = {
                ensurePolys: (coords) => mapLayer.ensurePolys(coords),
                centerOf: (rc) => mapLayer.centerOf(rc),
                draw: (route, tokenRC) => {
                    if (routeLayer) routeLayer.draw(route, null, tokenRC);
                },
                token: tokenLayer,
            };

            const activeLogic = createTravelLogic({
                app: ctx.app,
                minSecondsPerTile: 0.05,
                getMapFile: () => ctx.getFile(),
                adapter,
                onChange: (state) => handleStateChange(state),
                onEncounter: async () => {
                    try { activeLogic.pause(); } catch {}
                    // Open Encounter view in right leaf
                    const { getRightLeaf } = await import("../../../core/layout");
                    const { VIEW_ENCOUNTER } = await import("../../encounter/view");
                    const leaf = getRightLeaf(ctx.app);
                    await leaf.setViewState({ type: VIEW_ENCOUNTER, active: true });
                    ctx.app.workspace.revealLeaf(leaf);
                },
            });
            logic = activeLogic;

            handleStateChange(activeLogic.getState());
            await activeLogic.initTokenFromTiles();
            if (logic !== activeLogic) return;

            drag = createDragController({
                routeLayerEl: routeLayer.el,
                tokenEl: (tokenLayer as any).el as SVGGElement,
                token: tokenLayer,
                adapter,
                logic: {
                    getState: () => activeLogic.getState(),
                    selectDot: (idx) => activeLogic.selectDot(idx),
                    moveSelectedTo: (rc) => activeLogic.moveSelectedTo(rc),
                    moveTokenTo: (rc) => activeLogic.moveTokenTo(rc),
                },
                polyToCoord: mapLayer.polyToCoord,
            });
            drag.bind();

            unbindContext = bindContextMenu(routeLayer.el, {
                getState: () => activeLogic.getState(),
                deleteUserAt: (idx) => activeLogic.deleteUserAt(idx),
            });

            cleanupFile = async () => {
                disposeInteractions();
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
        },
        async onHexClick(coord, event, ctx) {
            if (drag?.consumeClickSuppression()) {
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
        async onSave(_mode: MapHeaderSaveMode, file, _ctx) {
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
