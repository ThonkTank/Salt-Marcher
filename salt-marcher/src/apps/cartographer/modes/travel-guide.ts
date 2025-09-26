import type { MapHeaderSaveMode } from "../../../ui/map-header";
import type { CartographerMode, CartographerModeContext } from "../presenter";
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
} from "./travel-guide/encounter-gateway";

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

    const disposeFile = () => {
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
                console.error("[travel-mode] pause failed", err);
            }
            logic = null;
        }
    };

    const ensureTerrains = async (ctx: CartographerModeContext) => {
        await setTerrains(await loadTerrains(ctx.app));
    };

    const subscribeToTerrains = (ctx: CartographerModeContext) => {
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
        async onEnter(ctx) {
            // Ensure travel-specific styles are active in Cartographer
            hostEl = ctx.host;
            hostEl.classList.add("sm-cartographer--travel");
            await ensureTerrains(ctx);
            terrainEvent = subscribeToTerrains(ctx);
            preloadEncounterModule();
            ctx.sidebarHost.empty();
            sidebar = createSidebar(ctx.sidebarHost);
            sidebar.setTitle?.(ctx.getFile()?.basename ?? "");
            sidebar.onSpeedChange((value) => {
                logic?.setTokenSpeed(value);
            });
            playback.mount(sidebar, {
                play: () => logic?.play() ?? undefined,
                pause: () => logic?.pause(),
                reset: () => logic?.reset(),
                setTempo: (value) => logic?.setTempo?.(value),
            });
            resetUi();
        },
        async onExit() {
            // Remove travel-specific style scope when leaving mode
            await cleanupFile?.();
            cleanupFile = null;
            disposeFile();
            playback.dispose();
            sidebar?.destroy();
            sidebar = null;
            terrainEvent?.off();
            terrainEvent = null;
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
                    try {
                        activeLogic.pause();
                    } catch {}
                    void openEncounter(ctx.app);
                },
            });
            logic = activeLogic;

            handleStateChange(activeLogic.getState());
            await activeLogic.initTokenFromTiles();
            if (logic !== activeLogic) return;

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
                    console.error("[travel-mode] pause during cleanup failed", err);
                }
                tokenLayer?.destroy?.();
                tokenLayer = null;
                routeLayer?.destroy();
                routeLayer = null;
            };
        },
        async onHexClick(coord, event, ctx) {
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
