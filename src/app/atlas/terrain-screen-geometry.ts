import { atlasWorldTileBounds } from './atlas-world-tiles';
import type { AtlasCameraPose } from './atlas-camera';
import type { TerrainLayoutView } from './terrain-grid-layout';
import type { TerrainGridGeometry } from './terrain-grid-geometry';
import type { TerrainSurfaceLayout } from './terrain-surface-layout';
import { terrainGridLayout } from './terrain-grid-layout';
import {
  atlasScreenTriangle,
  type ScreenPoint,
  type ScreenTriangle,
} from './atlas-screen-triangle';
import { terrainTraceStart } from './terrain-timing';

interface ScreenTerrainView extends AtlasCameraPose, TerrainLayoutView {
  surface?: TerrainSurfaceLayout;
}
export interface ScreenTerrainGrid extends TerrainGridGeometry {
  view: ScreenTerrainView;
  surface?: ScreenTerrainGrid[];
}
export interface TerrainScreenSource {
  token: string;
  revision: number;
  fence: string;
}
const sourceKey = (source: TerrainScreenSource) => JSON.stringify(source);
const layoutKey = (grid: ScreenTerrainGrid) =>
  JSON.stringify([grid.view, ...(grid.surface ?? [grid]).map((g) => g.view)]);

/** One frozen gesture owns this optional accelerator. It retains bounded
 * Float64 triangle bounds and only the current query's exact candidates; never
 * author records or duplicate height buffers. Oversized grids use uncached exact
 * projection. No result or complexity limit depends on the cache budget. */
export class TerrainScreenGeometry {
  private key: string;
  private source: string;
  private surfaces: { view: TerrainLayoutView; heights: Float32Array }[];
  private view: ScreenTerrainView;
  private bounds: Float64Array[] | undefined;
  private candidates = new Map<number, ScreenTriangle>();
  private cacheable: boolean;
  constructor(grid: ScreenTerrainGrid, source: TerrainScreenSource, retain = true) {
    const view = grid.view;
    if (view.surface) {
      if (!grid.surface || grid.surface.length !== view.surface.tiles.length)
        throw Error('Gebundene Geländeoberfläche fehlt. Erneut laden.');
      const boxes = new Set(
        grid.surface.map((g) =>
          [g.view.box.x, g.view.box.y, g.view.box.width, g.view.box.height].join(':'),
        ),
      );
      for (const tile of view.surface.tiles) {
        const b = atlasWorldTileBounds(tile);
        if (!boxes.has([b.minX, b.minY, b.maxX - b.minX, b.maxY - b.minY].join(':')))
          throw Error('Gebundene Geländekachel fehlt. Erneut laden.');
      }
    }
    this.key = layoutKey(grid);
    this.source = sourceKey(source);
    this.view = structuredClone(view);
    this.surfaces = (grid.surface ?? [grid]).map((g) => {
      if (g.heights.length !== g.view.columns * g.view.rows || !g.heights.every(Number.isFinite))
        throw Error('Gebundene Geländeoberfläche fehlt. Erneut laden.');
      return { view: structuredClone(g.view), heights: g.heights };
    });
    const bytes = this.surfaces.reduce(
      (sum, g) => sum + (g.view.columns - 1) * (g.view.rows - 1) * 2 * 4 * 8,
      0,
    );
    this.cacheable = retain && bytes <= 64 * 1024 * 1024;
  }
  matchesGrid(grid: ScreenTerrainGrid) {
    const surfaces = grid.surface ?? [grid];
    return (
      this.key === layoutKey(grid) &&
      surfaces.length === this.surfaces.length &&
      surfaces.every((g, i) => g.heights === this.surfaces[i]!.heights)
    );
  }
  matches(grid: ScreenTerrainGrid, source: TerrainScreenSource) {
    return this.source === sourceKey(source) && this.matchesGrid(grid);
  }
  get retainedBytes() {
    return this.bounds?.reduce((sum, b) => sum + b.byteLength, 0) ?? 0;
  }
  get retainedTriangles() {
    return this.candidates.size;
  }
  /** Retain neither buffers nor closures after the gesture owner's release. */
  dispose() {
    this.bounds = undefined;
    this.candidates.clear();
    this.surfaces = [];
  }
  query(events: readonly ScreenPoint[]) {
    if (!this.surfaces.length) throw Error('Bildschirmgeometrie bereits freigegeben.');
    const end = terrainTraceStart('screen.projection');
    const left = Math.min(...events.map((p) => p.u)),
      right = Math.max(...events.map((p) => p.u)),
      top = Math.min(...events.map((p) => p.v)),
      bottom = Math.max(...events.map((p) => p.v));
    const previous = this.bounds;
    const next = new Map<number, ScreenTriangle>();
    const bounds: Float64Array[] = [];
    let index = 0,
      projected = 0,
      reused = 0;
    for (const [surfaceIndex, g] of this.surfaces.entries()) {
      const v = g.view,
        cols = v.columns,
        layout = terrainGridLayout(v),
        count = (cols - 1) * (v.rows - 1) * 2,
        box =
          previous?.[surfaceIndex] ?? (this.cacheable ? new Float64Array(count * 4) : undefined);
      if (box) bounds.push(box);
      const vertices = previous
        ? undefined
        : Array.from(g.heights, (z, i) => ({
            x: layout.x.values[i % cols]!,
            y: layout.y.values[Math.floor(i / cols)]!,
            z,
          }));
      const vertex = (i: number) =>
        vertices?.[i] ?? {
          x: layout.x.values[i % cols]!,
          y: layout.y.values[Math.floor(i / cols)]!,
          z: g.heights[i]!,
        };
      for (let local = 0; local < count; local++) {
        const id = index++,
          offset = local * 4;
        if (
          previous &&
          box &&
          (box[offset]! > right ||
            box[offset + 1]! < left ||
            box[offset + 2]! > bottom ||
            box[offset + 3]! < top)
        )
          continue;
        let triangle = this.candidates.get(id);
        if (triangle) reused++;
        else {
          const cell = Math.floor(local / 2),
            y = Math.floor(cell / (cols - 1)),
            x = cell % (cols - 1),
            side = local % 2,
            i = y * cols + x;
          const ids = side ? [i + 1, i + cols + 1, i + cols] : [i, i + 1, i + cols];
          projected++;
          triangle =
            atlasScreenTriangle(this.view, ids.map(vertex), `${surfaceIndex}:${x}:${y}:${side}`) ??
            undefined;
        }
        if (!previous && box) {
          box[offset] = triangle ? Math.min(...triangle.polygon.map((p) => p.u)) : Infinity;
          box[offset + 1] = triangle ? Math.max(...triangle.polygon.map((p) => p.u)) : -Infinity;
          box[offset + 2] = triangle ? Math.min(...triangle.polygon.map((p) => p.v)) : Infinity;
          box[offset + 3] = triangle ? Math.max(...triangle.polygon.map((p) => p.v)) : -Infinity;
        }
        if (!triangle) continue;
        const polygon = triangle.polygon;
        if (
          Math.max(...polygon.map((p) => p.u)) < left ||
          Math.min(...polygon.map((p) => p.u)) > right ||
          Math.max(...polygon.map((p) => p.v)) < top ||
          Math.min(...polygon.map((p) => p.v)) > bottom
        )
          continue;
        next.set(id, triangle);
        if (next.size > 20000)
          throw Error('Bildschirmzug zu komplex. In kürzeren Zügen bearbeiten.');
      }
    }
    if (this.cacheable) {
      this.bounds = bounds;
      this.candidates = next;
    }
    end({
      projected,
      candidates: next.size,
      reused,
      surfaces: this.surfaces.length,
      boundsBytes: this.retainedBytes,
    });
    return [...next.values()];
  }
}
