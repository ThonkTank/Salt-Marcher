// src/features/maps/rendering/hex-render.ts
import { App, TFile } from "obsidian";
import type { HexOptions } from "../domain/options";
import { TERRAIN_COLORS } from "../domain/terrain";
import { createHexScene } from "./scene/scene";
import { createCameraController } from "./scene/camera-controller";
import { createInteractionController } from "./interactions/interactions";
import { createCoordinateTranslator } from "./core/coordinates";
import { createInteractionAdapter } from "./interactions/interaction-adapter";
import { bootstrapHexTiles } from "./scene/bootstrap";
import { selectRenderSurface, type HexRenderSurfaceSelection } from "./scene/surface";
import type { HexCoord, HexInteractionDelegate } from "./types";
export type { HexInteractionDelegate, HexInteractionOutcome } from "./types";
export { createEventBackedInteractionDelegate } from "./interactions/interaction-delegate";
import { getFactionOverlayStore, type FactionOverlayEntry } from "../state/faction-overlay-store";
import type { FactionOverlayState } from "../state/faction-overlay-store";

const OVERLAY_STROKE_WIDTH = "3";
const OVERLAY_FILL_OPACITY = "0.55";

export type RenderHandles = {
    readonly svg: SVGSVGElement;
    readonly contentG: SVGGElement;
    readonly overlay: SVGRectElement;
    readonly polyByCoord: ReadonlyMap<string, SVGPolygonElement>;
    readonly surface: HexRenderSurfaceSelection;
    setFill(coord: HexCoord, color: string): void;
    /** Fügt fehlende Polygone für die angegebenen Koordinaten hinzu und erweitert das Overlay (viewBox nur initial). */
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
    mapFile: TFile,
    opts: HexOptions
): Promise<RenderHandles> {
    const radius = opts.radius;
    const padding = DEFAULT_PADDING;
    const mapPath = mapFile.path;

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

    const legendHost = createLegendHost(host);
    const overlayStore = getFactionOverlayStore(app, mapFile);
    let overlayKeys = new Set<string>();

    const applyOverlay = (state: FactionOverlayState) => {
        const entries = state.loaded ? Array.from(state.entries.values()) : [];
        const ensureCoords = entries.map((entry) => entry.coord);
        scene.ensurePolys(ensureCoords);

        const nextKeys = new Set<string>();
        for (const entry of entries) {
            const key = `${entry.coord.r},${entry.coord.c}`;
            nextKeys.add(key);
            scene.setOverlay(entry.coord, {
                color: entry.color,
                factionId: entry.factionId,
                factionName: entry.factionName ?? undefined,
                fillOpacity: OVERLAY_FILL_OPACITY,
                strokeWidth: OVERLAY_STROKE_WIDTH,
            });
        }

        for (const key of overlayKeys) {
            if (nextKeys.has(key)) continue;
            const [r, c] = key.split(",").map(Number);
            scene.setOverlay({ r, c }, null);
        }

        overlayKeys = nextKeys;
        updateLegend(legendHost, entries);
    };

    const overlayUnsubscribe = overlayStore.state.subscribe(applyOverlay);
    applyOverlay(overlayStore.state.get());

    const ensurePolys = (coords: readonly HexCoord[]) => {
        if (!coords.length) return;
        scene.ensurePolys(coords);
    };

    const cleanup = () => {
        overlayUnsubscribe();
        overlayKeys.clear();
        legendHost.remove();
        if (host.dataset.hexMapPositionChanged === "1") {
            host.style.position = host.dataset.hexMapPrevPosition ?? "";
        }
        delete host.dataset.hexMapPrevPosition;
        delete host.dataset.hexMapPositionChanged;
        host.classList.remove("sm-hex-map-host");
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
            cleanup();
            interactions.destroy();
            camera.destroy();
            scene.destroy();
        },
    };
}

function createLegendHost(host: HTMLElement): HTMLElement {
    host.classList.add("sm-hex-map-host");
    if (getComputedStyle(host).position === "static") {
        (host.dataset.hexMapPrevPosition ??= host.style.position ?? "");
        host.dataset.hexMapPositionChanged = "1";
        host.style.position = "relative";
    } else {
        host.dataset.hexMapPositionChanged = "0";
    }
    const legend = host.ownerDocument.createElement("div");
    legend.className = "sm-map-legend is-empty";
    host.appendChild(legend);
    return legend;
}

function updateLegend(container: HTMLElement, entries: FactionOverlayEntry[]): void {
    container.empty();
    if (!entries.length) {
        container.classList.add("is-empty");
        return;
    }

    container.classList.remove("is-empty");

    const aggregate = new Map<string, { id: string; name: string; color: string; count: number }>();
    for (const entry of entries) {
        const id = entry.factionId;
        const name = entry.factionName && entry.factionName.trim().length > 0 ? entry.factionName : id;
        const color = entry.color;
        const current = aggregate.get(id);
        if (current) {
            current.count += 1;
        } else {
            aggregate.set(id, { id, name, color, count: 1 });
        }
    }

    const items = Array.from(aggregate.values()).sort((a, b) => {
        if (b.count !== a.count) return b.count - a.count;
        return a.name.localeCompare(b.name);
    });

    for (const item of items) {
        const row = container.createDiv({ cls: "sm-map-legend__item" });
        row.createDiv({ cls: "sm-map-legend__swatch" }).style.backgroundColor = item.color;
        row.createDiv({ cls: "sm-map-legend__label", text: item.name });
        row.createDiv({ cls: "sm-map-legend__meta", text: `${item.count}` });
    }
}
