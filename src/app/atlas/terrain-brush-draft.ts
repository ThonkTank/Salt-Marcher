import { bounds, contains } from './landscape-geometry';
import { applyLakeBrush, type LakeBrushChanges } from './terrain-lake-brush';
import type { LakeStroke } from './landscape-action-contracts';
import type { HeightStroke } from './terrain-brush-contracts';
import { applyCoupledTerrainBrush } from './terrain-lake-coupling';
import { decodeHeights, TerrainSampler } from './terrain-height';
import { type TerrainGrid } from './terrain-grid-contracts';
import { terrainGridLayout } from './terrain-grid-layout';
import type { LandscapeBox } from './landscape-bounds';
import type { LandscapeRecord } from './landscape-contracts';

/** Exact changed author support, including Hermite's two-cell halo. All tiles
 * still adopt the complete author result; untouched display grids need no
 * resampling while a broad height gesture also changes a lake's water level. */
export function terrainDraftBounds(
  records: LandscapeRecord[],
  changes: LandscapeRecord[],
  removed: string[] = [],
) {
  const original = new Map(records.map((r) => [r.id, r]));
  const areas: LandscapeBox[] = [];
  for (const r of changes) {
    if (!r.height) {
      if (r.route || (r.surface === 'freshwater' && r.polygons.length)) areas.push(bounds(r));
      const old = original.get(r.id);
      if (old?.surface === 'freshwater' && old.polygons.length) areas.push(bounds(old));
      continue;
    }
    const t = r.height,
      old = original.get(r.id)?.height,
      before = old ? decodeHeights(old) : undefined,
      after = decodeHeights(t);
    let left = 64,
      top = 64,
      right = -1,
      bottom = -1;
    for (let i = 0; i < after.length; i++) {
      const a = before?.[i] ?? NaN,
        b = after[i]!;
      if (
        a === b ||
        (Number.isNaN(a) && Number.isNaN(b)) ||
        (t.version === 2 && (Number.isNaN(a) ? 0 : a) === (Number.isNaN(b) ? 0 : b))
      )
        continue;
      left = Math.min(left, i % 64);
      right = Math.max(right, i % 64);
      top = Math.min(top, Math.floor(i / 64));
      bottom = Math.max(bottom, Math.floor(i / 64));
    }
    if (right >= left)
      areas.push({
        x: t.x + (left - 2) * t.pixel,
        y: t.y + (top - 2) * t.pixel,
        width: (right - left + 4) * t.pixel,
        height: (bottom - top + 4) * t.pixel,
      });
  }
  for (const id of removed) {
    const r = original.get(id);
    if (r && (r.height || r.route || r.polygons.length)) areas.push(bounds(r));
  }
  return areas;
}

/** One immutable author source per gesture. Draft and writer edit identical
 * Float32 nodes and use the same interpolation before projecting to the screen. */
export class TerrainBrushDraft {
  readonly grid: TerrainGrid;
  readonly ground: Float32Array;
  private consumed = 1;
  private touched = false;
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
  update(
    stroke: HeightStroke | LakeStroke,
    prepared?: LandscapeRecord[] | LakeBrushChanges,
    affected?: LandscapeBox[],
  ) {
    if (stroke.samples.length <= this.consumed) return false;
    const source = this.base.editing!.author;
    const records = this.originalRecords;
    const lake = 'waterLevelM' in stroke;
    const result =
      prepared ??
      (lake
        ? applyLakeBrush(records, stroke, this.base)
        : applyCoupledTerrainBrush(
            records,
            { ...stroke, visibility: stroke.visibility ?? this.base.view },
            undefined,
            this.base,
            undefined,
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
    const box = this.base.view.box;
    if (
      !this.touched &&
      !(affected ?? terrainDraftBounds(records, changes, removed)).some(
        (b) =>
          b.x <= box.x + box.width &&
          b.x + b.width >= box.x &&
          b.y <= box.y + box.height &&
          b.y + b.height >= box.y,
      )
    ) {
      this.consumed = stroke.samples.length;
      this.changedRect = { x: 0, y: 0, width: 0, height: 0 };
      return false;
    }
    const next = new TerrainSampler(this.records, false),
      waterSampler =
        lake || changes.some((r) => r.surface === 'freshwater')
          ? new TerrainSampler(this.records)
          : null,
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
    this.touched ||= changed;
    this.changedRect = { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
    return changed;
  }
}
