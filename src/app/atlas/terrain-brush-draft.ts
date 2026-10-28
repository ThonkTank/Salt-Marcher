import { contains } from './landscape-geometry';
import { applyLakeBrush, type LakeBrushChanges } from './terrain-lake-brush';
import type { LakeStroke } from './atlas-landscape';
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
      editing: { ...base.editing, ground: this.ground, water: base.editing.water.slice() },
    };
  }
  update(stroke: HeightStroke | LakeStroke, prepared?: LandscapeRecord[] | LakeBrushChanges) {
    if (stroke.samples.length <= this.consumed) return false;
    const source = this.base.editing!.author;
    const records = this.originalRecords;
    const lake = 'waterLevelM' in stroke;
    const result =
      prepared ??
      (lake
        ? applyLakeBrush(records, stroke, this.base)
        : applyTerrainBrush(
            records,
            { ...stroke, visibility: stroke.visibility ?? this.base.view },
            undefined,
            this.base,
            undefined,
            true,
          ));
    const changes = Array.isArray(result) ? result : result.records;
    const removed = Array.isArray(result) ? [] : result.remove;
    const merged = new Map(records.map((r) => [r.id, r]));
    for (const r of changes) merged.set(r.id, r);
    for (const id of removed) merged.delete(id);
    this.records = [...merged.values()];
    if (source)
      this.grid.editing!.author = {
        ...source,
        records: this.records,
        removed: [...new Set([...(source.removed ?? []), ...removed])].filter(
          (id) => !merged.has(id),
        ),
      };
    const next = new TerrainSampler(this.records, false),
      waterSampler = lake ? new TerrainSampler(this.records) : null,
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
        let level = this.base.editing!.water[i]!;
        if (waterSampler) {
          const originalLake = records.some(
            (r) => r.surface === 'freshwater' && contains(p, r.polygons),
          );
          const authored = Math.max(
            this.base.seaLevelM,
            waterSampler.waterLevel(p, -Infinity) ?? -Infinity,
          );
          level = originalLake ? authored : Math.max(level, authored);
        }
        if (this.ground[i] === value && this.grid.editing!.water[i] === level) continue;
        this.grid.editing!.water[i] = level;
        this.ground[i] = value;
        this.grid.heights[i] = Math.max(value, level);
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
