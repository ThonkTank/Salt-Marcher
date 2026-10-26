import { copyEditingSource, type TerrainEditingSource } from './terrain-editing-source';
import {
  heightBrushDabs,
  heightBrushAmount,
  heightBrushPixel,
  type HeightStroke,
} from './terrain-brush';
import { gridHeight, terrainVisibility, type TerrainGrid } from './terrain-spatial-model';
import { terrainGridLayout, terrainGridCoordinate } from './terrain-grid-layout';

/** Bounded display approximation, anchored to the gesture's loaded ground.
 * Consumes each input segment once. No author records, storage or source mutation.
 * Main still owns precise sampling, protected routes and the committed result. */
export class TerrainBrushDraft {
  readonly grid: TerrainGrid;
  readonly ground: Float32Array;
  readonly editingSource?: TerrainEditingSource;
  private scale?: number;
  private dose: Float64Array;
  private visible: Uint8Array;
  private consumed = 1;
  changedRect = { x: 0, y: 0, width: 0, height: 0 };
  maximumHeight = 0;
  private source: (p: { x: number; y: number }) => number;
  private visibility: (p: { x: number; y: number }) => boolean;
  constructor(
    readonly base: TerrainGrid,
    private neighbours: readonly TerrainGrid[] = [base],
  ) {
    if (!base.editing) throw Error('Bearbeitbares Höhenraster fehlt.');
    this.ground = base.editing.ground.slice();
    this.editingSource = base.editing.source && copyEditingSource(base.editing.source);
    this.grid = { ...base, heights: base.heights.slice() };
    this.dose = new Float64Array(this.ground.length);
    this.visible = new Uint8Array(this.ground.length);
    const raw = { ...base, heights: base.editing.ground };
    this.source = (p) => gridHeight(raw, p);
    this.visibility = terrainVisibility(base);
  }
  update(stroke: HeightStroke) {
    if (stroke.samples.length <= this.consumed) return false;
    const pixel = heightBrushPixel(stroke.radius);
    if (this.scale !== undefined && this.scale !== pixel)
      throw Error('Pinselmaßstab während der Geste geändert.');
    if (this.scale === undefined) {
      this.scale = pixel;
      this.source = editingScaleSampler(this.neighbours, this.base, pixel);
    }
    let band = this.editingSource?.bands.find((b) => b.pixel === pixel);
    if (this.editingSource && !band) {
      band = { pixel, heights: new Float32Array(this.ground.length) };
      this.editingSource.bands.push(band);
      this.editingSource.bands.sort((a, b) => b.pixel - a.pixel);
    }
    const originalBand = this.base.editing!.source?.bands.find((b) => b.pixel === pixel);
    const samples = stroke.samples.slice(this.consumed - 1);
    this.consumed = stroke.samples.length;
    const layout = terrainGridLayout(this.base.view),
      v = this.base.view,
      water = this.base.editing!.water;
    let changed = false,
      minX = v.columns,
      minY = v.rows,
      maxX = -1,
      maxY = -1;
    for (const dab of heightBrushDabs({ ...stroke, samples })) {
      if (dab.seconds <= 0) continue;
      const left = Math.ceil(terrainGridCoordinate(layout.x, dab.x - stroke.radius)),
        right = Math.floor(terrainGridCoordinate(layout.x, dab.x + stroke.radius));
      const top = Math.ceil(terrainGridCoordinate(layout.y, dab.y - stroke.radius)),
        bottom = Math.floor(terrainGridCoordinate(layout.y, dab.y + stroke.radius));
      for (let y = top; y <= bottom; y++)
        for (let x = left; x <= right; x++) {
          const p = { x: layout.x.values[x]!, y: layout.y.values[y]! },
            r = Math.hypot(p.x - dab.x, p.y - dab.y) / stroke.radius;
          if (r >= 1) continue;
          const i = y * v.columns + x;
          if (!this.visible[i]) this.visible[i] = this.visibility(p) ? 1 : 2;
          if (this.visible[i] === 2) continue;
          const t = stroke.feather === 0 ? 1 : Math.min(1, (1 - r) / stroke.feather);
          this.dose[i] = this.dose[i]! + dab.seconds * t * t * (3 - 2 * t);
          const amount = heightBrushAmount(
            stroke,
            p,
            this.dose[i]!,
            stroke.mode === 'smooth' || stroke.targetM !== undefined ? this.source : undefined,
          );
          this.ground[i] = this.base.editing!.ground[i]! + amount;
          if (band) band.heights[i] = (originalBand?.heights[i] ?? 0) + amount;
          this.grid.heights[i] = Math.max(this.ground[i]!, water[i]!);
          changed = true;
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
          this.maximumHeight = Math.max(
            this.maximumHeight,
            Math.abs(this.grid.heights[i]! - v.focusM),
          );
        }
    }
    this.changedRect = { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
    return changed;
  }
}

/** Same scale selection as the canonical brush, on the bounded display lattice.
 * Adjacent loaded tiles supply smoothing neighbours; interpolation remains display-only. */
function editingScaleSampler(grids: readonly TerrainGrid[], fallback: TerrainGrid, pixel: number) {
  const gridAt = (p: { x: number; y: number }) =>
    grids.find(
      (g) =>
        p.x >= g.view.box.x &&
        p.y >= g.view.box.y &&
        p.x <= g.view.box.x + g.view.box.width &&
        p.y <= g.view.box.y + g.view.box.height,
    ) ?? fallback;
  const sample = (g: TerrainGrid, heights: Float32Array, p: { x: number; y: number }) =>
    gridHeight({ ...g, heights }, p);
  const values = new Map<string, number>();
  const read = (p: { x: number; y: number }) => {
    const g = gridAt(p),
      source = g.editing?.source;
    if (!source) return sample(g, g.editing!.ground, p);
    let base = 0;
    for (const y of [-0.375, -0.125, 0.125, 0.375])
      for (const x of [-0.375, -0.125, 0.125, 0.375]) {
        const at = { x: p.x + x * pixel, y: p.y + y * pixel },
          tile = gridAt(at);
        base += sample(tile, tile.editing?.source?.base ?? tile.editing!.ground, at) / 16;
      }
    for (const band of source.bands) if (band.pixel >= pixel) base += sample(g, band.heights, p);
    return base;
  };
  // A frozen gesture visits at most its grid nodes and fixed smoothing offsets.
  return (p: { x: number; y: number }) => {
    const key = `${p.x},${p.y}`;
    const old = values.get(key);
    if (old !== undefined) return old;
    const value = read(p);
    values.set(key, value);
    return value;
  };
}
