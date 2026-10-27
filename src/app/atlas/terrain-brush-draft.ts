import { applyTerrainBrush, type HeightStroke } from './terrain-brush';
import { TerrainSampler } from './terrain-height';
import { type TerrainGrid } from './terrain-spatial-model';
import { terrainGridLayout } from './terrain-grid-layout';
import type { LandscapeRecord } from './atlas-landscape';

/** One immutable author source per gesture. Draft and writer edit identical
 * Float32 nodes and use the same interpolation before projecting to the screen. */
export class TerrainBrushDraft {
  readonly grid: TerrainGrid;
  readonly ground: Float32Array;
  private consumed = 1;
  changedRect = { x: 0, y: 0, width: 0, height: 0 };
  maximumHeight = 0;
  records: LandscapeRecord[];
  private original: TerrainSampler;
  private readonly originalRecords: LandscapeRecord[];
  constructor(
    readonly base: TerrainGrid,
    records = base.editing?.author?.records,
  ) {
    if (!base.editing || !records) throw Error('Bearbeitbare Autorenhöhen fehlen.');
    this.records = records;
    this.originalRecords = records;
    this.original = new TerrainSampler(records, false);
    this.ground = base.editing.ground.slice();
    this.grid = {
      ...base,
      heights: base.heights.slice(),
      editing: { ...base.editing, ground: this.ground },
    };
  }
  update(stroke: HeightStroke, prepared?: LandscapeRecord[]) {
    if (stroke.samples.length <= this.consumed) return false;
    const source = this.base.editing!.author;
    const records = this.originalRecords;
    const changes =
      prepared ??
      applyTerrainBrush(
        records,
        { ...stroke, visibility: stroke.visibility ?? this.base.view },
        undefined,
        this.base,
        undefined,
        true,
      );
    const merged = new Map(records.map((r) => [r.id, r]));
    for (const r of changes) merged.set(r.id, r);
    this.records = [...merged.values()];
    if (source) this.grid.editing!.author = { ...source, records: this.records };
    const next = new TerrainSampler(this.records, false),
      layout = terrainGridLayout(this.base.view),
      v = this.base.view;
    let changed = false,
      minX = v.columns,
      minY = v.rows,
      maxX = -1,
      maxY = -1;
    for (let y = 0; y < v.rows; y++)
      for (let x = 0; x < v.columns; x++) {
        const i = y * v.columns + x,
          p = { x: layout.x.values[x]!, y: layout.y.values[y]! };
        // Preserve the displayed route/water contribution. The changed raw height
        // is sampled on author nodes, never smoothed on the display triangles.
        const value = Math.fround(
          this.base.editing!.ground[i]! +
            next.sample(p).heightM -
            Math.fround(this.original.sample(p).heightM),
        );
        if (this.ground[i] === value) continue;
        this.ground[i] = value;
        this.grid.heights[i] = Math.max(value, this.base.editing!.water[i]!);
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
    this.consumed = stroke.samples.length;
    this.changedRect = { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
    return changed;
  }
}
