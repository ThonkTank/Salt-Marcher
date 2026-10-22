import type { Point } from './contracts';
import type { LandscapeBox, LandscapeRecord } from './atlas-landscape';
import type { AtlasAction, AtlasRenderView } from './campaign-atlas-contracts';
import type { HeightStroke } from './terrain-brush';
import type { TerrainLiveAction, TerrainLiveContext } from './terrain-live-stroke';
export interface LandscapeHost {
    box: () => LandscapeBox;
    planning?: () => void;
    navigation?: (e: PointerEvent) => boolean;
    visibility?: () => import("./terrain-spatial-model").TerrainView | undefined;
    navigate?: (box: LandscapeBox) => void;
    hit: (e: MouseEvent, keys: string[]) => {
        data: Record<string, string>;
    } | null;
    point: (e: MouseEvent) => Point;
    refresh?: () => Promise<unknown>;
    selected?: (id: string, kind: LandscapeRecord['kind']) => void;
    choose?: (point: Point) => Promise<void>;
    current?: () => boolean;
    redraw: () => void;
    redrawOverlay?: () => void;
    write: (a: AtlasAction) => Promise<unknown>;
    previewHeight?: (stroke: HeightStroke) => void;
    terrainGesture: (active: boolean) => void | Promise<void>;
    writeTerrain: (a: TerrainLiveAction, c: TerrainLiveContext) => Promise<import("./campaign-atlas-contracts").AtlasCommitAck>;
    error: (e: unknown) => void;
    data: () => AtlasRenderView | null;
}
export type LandscapeTool = "vegetation" | "vegetation-area" | "vegetation-line" | "vegetation-erase" | "vegetation-thin" | "vegetation-dense" | "vegetation-object" | "select" | "height" | "smooth" | "color" | "property" | "freshwater" | "hex" | "reset" | "river" | "road" | "place" | "measure";
