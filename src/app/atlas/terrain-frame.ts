import type { AtlasLandscapeLayer } from './atlas-region-contracts';
import type { LandscapeBox } from './atlas-landscape';
import type { TerrainProjection } from './terrain-projection';
import type { TerrainGrid } from './terrain-spatial-model';

export interface TerrainIdentity {
  revision: number;
  fence: string;
}
export interface TerrainFrameIdentity extends TerrainIdentity {
  key: string;
}
export interface TerrainInvalidation {
  bounds: LandscapeBox[];
  reset: boolean;
}
export interface TerrainRect {
  x: number;
  y: number;
  width: number;
  height: number;
}
export interface TerrainPatch<T extends Uint8Array | Float32Array> extends TerrainRect {
  data: T;
}
type Common = { target: TerrainFrameIdentity; invalidation: TerrainInvalidation };
export type TerrainFullFrame = Common & { kind: 'full' } & (
    | { view: 'top'; layer: AtlasLandscapeLayer }
    | { view: 'tilted'; projection: TerrainProjection }
  );
export type TerrainDeltaFrame = Common & { kind: 'delta'; base: TerrainFrameIdentity } & (
    | {
        view: 'top';
        layer: Omit<AtlasLandscapeLayer, 'tiles'>;
        tiles: AtlasLandscapeLayer['tiles'];
        removed: string[];
      }
    | {
        view: 'tilted';
        projection: Omit<TerrainProjection, 'grid' | 'pixels' | 'forest' | 'detail'>;
        grid: Omit<TerrainGrid, 'heights' | 'editing'>;
        editing?: {
          ground: TerrainPatch<Float32Array>[];
          water: TerrainPatch<Float32Array>[];
          source?: import('./terrain-editing-source').TerrainEditingSource;
        };
        heights: TerrainPatch<Float32Array>[];
        pixels: TerrainPatch<Uint8Array>[];
        forest?: TerrainPatch<Uint8Array>[];
        detail?: Omit<import('./terrain-detail').TerrainDetail, 'pixels' | 'forest'> & {
          patches: TerrainPatch<Uint8Array>[];
          forest?: TerrainPatch<Uint8Array>[];
        };
      }
  );
export type TerrainFrame = TerrainFullFrame | TerrainDeltaFrame;
export const sameTerrainIdentity = (
  a: TerrainFrameIdentity | undefined,
  b: TerrainFrameIdentity | undefined,
) => !!a && !!b && a.key === b.key && a.revision === b.revision && a.fence === b.fence;
export const terrainRasterKey = (t: AtlasLandscapeLayer['tiles'][number]) =>
  JSON.stringify([t.box, t.width, t.height]);

function patches<T extends Float32Array | Uint8Array>(
  before: T,
  after: T,
  width: number,
  height: number,
  components: number,
  edge: number,
): TerrainPatch<T>[] {
  const result: TerrainPatch<T>[] = [];
  for (let y = 0; y < height; y += edge)
    for (let x = 0; x < width; x += edge) {
      const w = Math.min(edge, width - x),
        h = Math.min(edge, height - y);
      let changed = false;
      for (let row = 0; row < h && !changed; row++)
        for (let i = 0; i < w * components; i++) {
          const at = ((y + row) * width + x) * components + i;
          if (before[at] !== after[at]) {
            changed = true;
            break;
          }
        }
      if (!changed) continue;
      const data = (
        after instanceof Float32Array
          ? new Float32Array(w * h * components)
          : new Uint8Array(w * h * components)
      ) as T;
      for (let row = 0; row < h; row++)
        data.set(
          after.subarray(
            ((y + row) * width + x) * components,
            ((y + row) * width + x + w) * components,
          ),
          row * w * components,
        );
      result.push({ x, y, width: w, height: h, data });
    }
  return result;
}
export function terrainFrameDelta(
  before: TerrainFullFrame | undefined,
  after: TerrainFullFrame,
  requested?: TerrainFrameIdentity,
): TerrainFrame {
  if (
    !before ||
    after.invalidation.reset ||
    !sameTerrainIdentity(before.target, requested) ||
    before.target.key !== after.target.key ||
    before.view !== after.view
  )
    return after;
  const common = {
    kind: 'delta' as const,
    base: before.target,
    target: after.target,
    invalidation: after.invalidation,
  };
  if (before.view === 'top' && after.view === 'top') {
    if (
      JSON.stringify(before.layer.tiles.map(terrainRasterKey)) !==
      JSON.stringify(after.layer.tiles.map(terrainRasterKey))
    )
      return after;
    const old = new Map(before.layer.tiles.map((t) => [terrainRasterKey(t), t]));
    const tiles = after.layer.tiles.filter((t) => old.get(terrainRasterKey(t))?.data !== t.data);
    const keys = new Set(after.layer.tiles.map(terrainRasterKey)),
      removed = [...old.keys()].filter((k) => !keys.has(k));
    const { tiles: unused, ...layer } = after.layer;
    return { ...common, view: 'top', layer, tiles, removed };
  }
  if (before.view === 'tilted' && after.view === 'tilted') {
    const a = before.projection,
      b = after.projection;
    if (
      !!a.grid.editing !== !!b.grid.editing ||
      !!a.forest !== !!b.forest ||
      !!a.detail?.forest !== !!b.detail?.forest
    )
      return after;
    if (
      a.width !== b.width ||
      a.height !== b.height ||
      a.grid.heights.length !== b.grid.heights.length
    )
      return after;
    if (
      JSON.stringify(a.detail && [a.detail.box, a.detail.width, a.detail.height]) !==
      JSON.stringify(b.detail && [b.detail.box, b.detail.width, b.detail.height])
    )
      return after;
    const {
        pixels: unusedPixels,
        forest: unusedForest,
        grid: unusedGrid,
        detail: unusedDetail,
        ...projection
      } = b,
      { heights: unusedHeights, editing: unusedEditing, ...grid } = b.grid;
    return {
      ...common,
      view: 'tilted',
      projection,
      grid,
      editing: b.grid.editing
        ? {
            source: b.grid.editing.source,
            ground: patches(
              a.grid.editing!.ground,
              b.grid.editing.ground,
              b.grid.view.columns,
              b.grid.view.rows,
              1,
              16,
            ),
            water: patches(
              a.grid.editing!.water,
              b.grid.editing.water,
              b.grid.view.columns,
              b.grid.view.rows,
              1,
              16,
            ),
          }
        : undefined,
      heights: patches(
        a.grid.heights,
        b.grid.heights,
        b.grid.view.columns,
        b.grid.view.rows,
        1,
        16,
      ),
      pixels: patches(a.pixels, b.pixels, b.width, b.height, 4, 64),
      forest: b.forest ? patches(a.forest!, b.forest, b.width, b.height, 1, 64) : undefined,
      detail: b.detail
        ? {
            box: b.detail.box,
            width: b.detail.width,
            height: b.detail.height,
            ...(b.detail.forest
              ? {
                  forest: patches(
                    a.detail!.forest!,
                    b.detail.forest,
                    b.detail.width,
                    b.detail.height,
                    1,
                    64,
                  ),
                }
              : {}),
            patches: patches(
              a.detail!.pixels,
              b.detail.pixels,
              b.detail.width,
              b.detail.height,
              4,
              64,
            ),
          }
        : undefined,
    };
  }
  return after;
}
function applyPatches<T extends Float32Array | Uint8Array>(
  base: T,
  patches: TerrainPatch<T>[],
  width: number,
  height: number,
  components: number,
): T {
  const data = base.slice() as T;
  for (const p of patches) {
    if (
      ![p.x, p.y, p.width, p.height].every(Number.isInteger) ||
      p.x < 0 ||
      p.y < 0 ||
      p.width < 1 ||
      p.height < 1 ||
      p.x + p.width > width ||
      p.y + p.height > height ||
      p.data.length !== p.width * p.height * components
    )
      throw Error('Gelände-Teilbereich ungültig.');
    for (let row = 0; row < p.height; row++)
      data.set(
        p.data.subarray(row * p.width * components, (row + 1) * p.width * components),
        ((p.y + row) * width + p.x) * components,
      );
  }
  return data;
}
export function applyTerrainFrame(
  before: TerrainFullFrame | undefined,
  frame: TerrainFrame,
): TerrainFullFrame {
  if (frame.kind === 'full') return frame;
  if (
    !before ||
    !sameTerrainIdentity(before.target, frame.base) ||
    frame.target.key !== frame.base.key ||
    before.view !== frame.view
  )
    throw Error('Gelände-Basis fehlt. Vollständige Ansicht erneut laden.');
  const common = { kind: 'full' as const, target: frame.target, invalidation: frame.invalidation };
  if (before.view === 'top' && frame.view === 'top') {
    const tiles = new Map(before.layer.tiles.map((t) => [terrainRasterKey(t), t]));
    for (const key of frame.removed) tiles.delete(key);
    for (const tile of frame.tiles) tiles.set(terrainRasterKey(tile), tile);
    return { ...common, view: 'top', layer: { ...frame.layer, tiles: [...tiles.values()] } };
  }
  if (before.view === 'tilted' && frame.view === 'tilted') {
    const p = frame.projection,
      g = frame.grid;
    if (
      (frame.forest && !before.projection.forest) ||
      (frame.detail?.forest && !before.projection.detail?.forest)
    )
      throw Error('Waldabdeckung-Basis fehlt.');
    if (frame.editing && !before.projection.grid.editing)
      throw Error('Gelände-Basis für Bearbeitung fehlt.');
    return {
      ...common,
      view: 'tilted',
      projection: {
        ...p,
        grid: {
          ...g,
          ...(frame.editing
            ? {
                editing: {
                  ...(frame.editing.source ? { source: frame.editing.source } : {}),
                  ground: applyPatches(
                    before.projection.grid.editing!.ground,
                    frame.editing.ground,
                    g.view.columns,
                    g.view.rows,
                    1,
                  ),
                  water: applyPatches(
                    before.projection.grid.editing!.water,
                    frame.editing.water,
                    g.view.columns,
                    g.view.rows,
                    1,
                  ),
                },
              }
            : {}),
          heights: applyPatches(
            before.projection.grid.heights,
            frame.heights,
            g.view.columns,
            g.view.rows,
            1,
          ),
        },
        pixels: applyPatches(before.projection.pixels, frame.pixels, p.width, p.height, 4),
        ...(frame.forest
          ? { forest: applyPatches(before.projection.forest!, frame.forest, p.width, p.height, 1) }
          : {}),
        detail: frame.detail
          ? {
              box: frame.detail.box,
              width: frame.detail.width,
              height: frame.detail.height,
              ...(frame.detail.forest
                ? {
                    forest: applyPatches(
                      before.projection.detail!.forest!,
                      frame.detail.forest,
                      frame.detail.width,
                      frame.detail.height,
                      1,
                    ),
                  }
                : {}),
              pixels: applyPatches(
                before.projection.detail!.pixels,
                frame.detail.patches,
                frame.detail.width,
                frame.detail.height,
                4,
              ),
            }
          : undefined,
        identity: frame.target,
        update: {
          base: frame.base,
          heights: frame.heights.map(({ data, ...r }) => r),
          pixels: frame.pixels.map(({ data, ...r }) => r),
          forest: frame.forest?.map(({ data, ...r }) => r),
          detailForest: frame.detail?.forest?.map(({ data, ...r }) => r),
          detail: frame.detail?.patches.map(({ data, ...r }) => r),
        },
      },
    };
  }
  throw Error('Geländeansicht passt nicht zur Basis.');
}
export function terrainFrameBytes(frame: TerrainFullFrame) {
  if (frame.view === 'top') return JSON.stringify(frame).length * 2;
  const { pixels, forest, grid, detail, brushDetail, ...rest } = frame.projection,
    { heights, editing, ...view } = grid;
  return (
    pixels.byteLength +
    (forest?.byteLength ?? 0) +
    heights.byteLength +
    (editing ? editing.ground.byteLength + editing.water.byteLength : 0) +
    (detail?.pixels.byteLength ?? 0) +
    (detail?.forest?.byteLength ?? 0) +
    (brushDetail?.pixels.byteLength ?? 0) +
    (brushDetail?.forest?.byteLength ?? 0) +
    JSON.stringify([
      rest,
      view,
      detail && [detail.box, detail.width, detail.height],
      brushDetail && [brushDetail.box, brushDetail.width, brushDetail.height],
      frame.target,
      frame.invalidation,
    ]).length *
      2
  );
}
