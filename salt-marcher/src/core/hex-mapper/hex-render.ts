// src/core/hex-mapper/hex-render.ts
import { App } from "obsidian";
import type { HexOptions } from "../options";
import { TERRAIN_COLORS } from "../terrain";
import { createHexScene } from "./render/scene";
import { createCameraController } from "./render/camera-controller";
import { createInteractionController } from "./render/interactions";
import { createCoordinateTranslator } from "./render/coordinates";
import { createInteractionAdapter } from "./render/interaction-adapter";
import { bootstrapHexTiles } from "./render/bootstrap";
import { selectRenderSurface, type HexRenderSurfaceSelection } from "./render/surface";
import type { HexCoord, HexInteractionDelegate } from "./render/types";
export type { HexInteractionDelegate, HexInteractionOutcome } from "./render/types";
export { createEventBackedInteractionDelegate } from "./render/interaction-delegate";

export type RenderHandles = {
    readonly svg: SVGSVGElement;
    readonly contentG: SVGGElement;
    readonly overlay: SVGRectElement;
    readonly polyByCoord: ReadonlyMap<string, SVGPolygonElement>;
    readonly surface: HexRenderSurfaceSelection;
    setFill(coord: HexCoord, color: string): void;
    /** Fügt fehlende Polygone für die angegebenen Koordinaten hinzu und erweitert viewBox/Overlay. */
    ensurePolys(coords: readonly HexCoord[]): void;
    /** Ersetzt den aktiven Interaktions-Delegate (z. B. für Editor-Tools). */
    setInteractionDelegate(delegate: HexInteractionDelegate | null): void;
    destroy(): void;
};

const DEFAULT_PADDING = 12;
const CAMERA_OPTIONS = { minScale: 0.15, maxScale: 16, zoomSpeed: 1.01 } as const;

export async function renderHexMap(
    app: App,
    host: HTMLElement,
    opts: HexOptions,
    mapPath: string
): Promise<RenderHandles> {
    const radius = opts.radius;
    const padding = DEFAULT_PADDING;

    const { tiles, base, initialCoords } = await bootstrapHexTiles(app, mapPath);
    const surface = selectRenderSurface();

    const scene = createHexScene({
        host,
        radius,
        padding,
        base,
        initialCoords,
    });

    const camera = createCameraController(
        scene.svg,
        scene.contentG,
        scene.overlay,
        host,
        { ...CAMERA_OPTIONS }
    );

    const coordinates = createCoordinateTranslator({
        svg: scene.svg,
        contentG: scene.contentG,
        base,
        radius,
        padding,
    });

    const interactionAdapter = createInteractionAdapter({ app, host, mapPath });

    const interactions = createInteractionController({
        svg: scene.svg,
        overlay: scene.overlay,
        toContentPoint: coordinates.toContentPoint,
        pointToCoord: coordinates.pointToCoord,
        delegateRef: interactionAdapter.delegateRef,
        onDefaultClick: (coord, ev) => interactionAdapter.handleDefaultClick(coord, ev),
    });

    for (const { coord, data } of tiles) {
        const color = TERRAIN_COLORS[data.terrain] ?? "transparent";
        scene.setFill(coord, color);
    }

    const ensurePolys = (coords: readonly HexCoord[]) => {
        if (!coords.length) return;
        scene.ensurePolys(coords);
    };

    return {
        svg: scene.svg,
        contentG: scene.contentG,
        overlay: scene.overlay,
        polyByCoord: scene.polyByCoord,
        surface,
        setFill: (coord, color) => scene.setFill(coord, color),
        ensurePolys,
        setInteractionDelegate: (delegate) => {
            interactionAdapter.setDelegate(delegate);
        },
        destroy: () => {
            interactions.destroy();
            camera.destroy();
            scene.destroy();
        },
    };
}
