import { type LandscapeBox, type LandscapeRecord } from '../atlas/atlas-landscape';
import type { AtlasRegionSource } from '../atlas/atlas-region-contracts';
import { TerrainCache } from '../atlas/terrain-cache';
import { streamTerrainField, type TerrainStream } from '../atlas/terrain-field-stream';
import { heightRecord, TerrainSampler } from '../atlas/terrain-height';
import {
  applyTerrainBrush,
  heightBrushBounds,
  heightBrushPixel,
  validateHeightStroke,
  type HeightStroke,
} from '../atlas/terrain-brush';
import { coupleRouteEdits } from '../atlas/terrain-route-planner';
import { routeBounds } from '../atlas/terrain-route';
import { readRouteTerrain } from './terrain-route';
import { readTerrainEditingRecords } from './terrain-editing-source';
import { readTerrainGrid } from './terrain-grid';
import type { TerrainGrid } from '../atlas/terrain-spatial-model';

/** Internal worker result. Never part of the renderer action/bridge contract. */
export interface PreparedTerrainStroke {
  fence: string;
  revision: number;
  stroke: string;
  records: LandscapeRecord[];
}
const queryBounds = (b: LandscapeBox) => [b.x, b.x + b.width, b.y, b.y + b.height];
const heightFilter = "json_valid(payload) AND json_extract(payload,'$.height') IS NOT NULL";

/** Only the legacy base is filtered. New additive edits never invalidate it.
 * Tiles are built on demand, four samples per axis per coarse cell, and retain
 * 4096 floats rather than source records. The original base stays untouched.
 */
export class TerrainScalePyramid {
  private cache = new TerrainCache<Float32Array>(8 * 1024 * 1024);
  private identity = '';
  private versions = new Map<string, number>();
  sync(db: any, source: AtlasRegionSource) {
    const identity = JSON.stringify([source.filename, source.campaignId, source.epoch]);
    if (source.reset || identity !== this.identity) {
      this.cache.clear();
      this.versions.clear();
      this.identity = identity;
      return;
    }
    for (const c of source.changes)
      if (c.table === 'atlas_landscape') {
        const row = db
          .prepare(
            "SELECT json_extract(payload,'$.height.version') version,min_x x,min_y y,max_x-min_x width,max_y-min_y height FROM atlas_landscape WHERE campaign_id=? AND id=?",
          )
          .get(source.campaignId, c.id);
        const previous = this.versions.get(c.id);
        if (row?.version === 2) {
          this.versions.set(c.id, 2);
          if (previous !== 1) continue;
        } else {
          this.versions.delete(c.id);
          if (!row && previous === 2) continue;
        }
        if (row && row.version == null && previous === undefined) continue;
        const box = c.terrainBounds ?? (row as LandscapeBox | undefined);
        if (box) this.cache.invalidate([box]);
        else this.cache.clear();
      }
    // Metadata is bounded too. Forgetting old classifications is conservative.
    if (this.versions.size > 4096) this.versions.clear();
  }
  get diagnostics() {
    return { bytes: this.cache.bytes, hits: this.cache.hits, misses: this.cache.misses };
  }
  private *build(
    db: any,
    cam: string,
    x: number,
    y: number,
    pixel: number,
  ): Generator<void, Float32Array> {
    const key = JSON.stringify([cam, x, y, pixel]),
      hit = this.cache.get(key);
    if (hit) return hit;
    const stream: TerrainStream = function* (kind, box) {
      if (kind !== 'height') return;
      const rows = db
        .prepare(
          `SELECT rowid FROM atlas_landscape WHERE campaign_id=? AND ${heightFilter} AND json_extract(payload,'$.height.version')=1 AND max_x>=? AND min_x<=? AND max_y>=? AND min_y<=? ORDER BY CAST(json_extract(payload,'$.height.pixel') AS REAL) DESC,rowid`,
        )
        .iterate(cam, ...queryBounds(box));
      const get = db.prepare('SELECT payload FROM atlas_landscape WHERE rowid=?');
      for (const row of rows) yield JSON.parse(get.get(row.rowid).payload);
    };
    const values = new Float32Array(4096);
    // Four independently bounded read slices. The worker releases its snapshot
    // between slices so a confirmed display request can take priority.
    for (let first = 0; first < 64; first += 16) {
      const lattice = {
        x: x - 0.375 * pixel,
        y: y + (first - 0.375) * pixel,
        dx: pixel / 4,
        dy: pixel / 4,
        columns: 256,
        rows: 64,
      };
      const field = streamTerrainField(lattice, 0, stream, false).heights;
      for (let iy = 0; iy < 16; iy++)
        for (let ix = 0; ix < 64; ix++) {
          let total = 0;
          for (let dy = 0; dy < 4; dy++)
            for (let dx = 0; dx < 4; dx++) total += field[(iy * 4 + dy) * 256 + ix * 4 + dx]! / 16;
          values[(first + iy) * 64 + ix] = total;
        }
      yield;
    }
    this.cache.put(
      key,
      { x: x - 0.375 * pixel, y: y - 0.375 * pixel, width: 63.75 * pixel, height: 63.75 * pixel },
      values,
      values.byteLength + key.length * 2 + 128,
    );
    return values;
  }
  tile(db: any, cam: string, x: number, y: number, pixel: number) {
    const build = this.build(db, cam, x, y, pixel);
    let next = build.next();
    while (!next.done) next = build.next();
    return next.value;
  }
  *warm(db: any, cam: string, stroke: HeightStroke): Generator<void> {
    validateHeightStroke(stroke);
    if (stroke.mode !== 'smooth' && stroke.targetM === undefined) return;
    const pixel = heightBrushPixel(stroke.radius),
      area = heightBrushBounds({ ...stroke, visibility: undefined }),
      edge = 64 * pixel;
    const left = Math.floor((area.x - 2 * pixel) / edge),
      right = Math.floor((area.x + area.width + 2 * pixel) / edge),
      top = Math.floor((area.y - 2 * pixel) / edge),
      bottom = Math.floor((area.y + area.height + 2 * pixel) / edge);
    if ((right - left + 1) * (bottom - top + 1) > 256)
      throw Error('Höhenzug zu lang. In kürzeren Zügen bearbeiten.');
    for (let y = top; y <= bottom; y++)
      for (let x = left; x <= right; x++) yield* this.build(db, cam, x * edge, y * edge, pixel);
  }
  sampler(db: any, cam: string, box: LandscapeBox, pixel: number) {
    const edge = 64 * pixel,
      records: LandscapeRecord[] = [];
    const left = Math.floor((box.x - 2 * pixel) / edge),
      right = Math.floor((box.x + box.width + 2 * pixel) / edge),
      top = Math.floor((box.y - 2 * pixel) / edge),
      bottom = Math.floor((box.y + box.height + 2 * pixel) / edge);
    if ((right - left + 1) * (bottom - top + 1) > 256)
      throw Error('Höhenzug zu lang. In kürzeren Zügen bearbeiten.');
    for (let y = top; y <= bottom; y++)
      for (let x = left; x <= right; x++)
        records.push(
          heightRecord(x * edge, y * edge, pixel, this.tile(db, cam, x * edge, y * edge, pixel)),
        );
    return new TerrainSampler(records, false);
  }
}

/** Indexed scale lookup: no legacy/fine height payloads are read by free sculpt. */
function scaleRecords(
  db: any,
  cam: string,
  box: LandscapeBox,
  pixel: number,
  coarser: boolean,
): LandscapeRecord[] {
  const rows = db
    .prepare(
      `SELECT payload FROM atlas_landscape INDEXED BY landscape_height_scale WHERE campaign_id=? AND ${heightFilter} AND json_extract(payload,'$.height.version')=2 AND CAST(json_extract(payload,'$.height.pixel') AS REAL) ${coarser ? '>=' : '='} ? AND max_x>=? AND min_x<=? AND max_y>=? AND min_y<=? ORDER BY CAST(json_extract(payload,'$.height.pixel') AS REAL) DESC`,
    )
    .iterate(cam, pixel, ...queryBounds(box));
  const result: LandscapeRecord[] = [];
  let bytes = 0;
  for (const row of rows) {
    bytes += Buffer.byteLength(row.payload);
    if (bytes > 8 * 1024 * 1024) throw Error('Höhenzug zu lang. In kürzeren Zügen bearbeiten.');
    result.push(JSON.parse(row.payload));
  }
  return result;
}

/** Routes bring their local corridors/dependencies, not all terrain under the
 * world-sized brush. Canonical fine samples still constrain protected routes.
 */
function routeSources(db: any, cam: string, box: LandscapeBox) {
  const rows = db
    .prepare(
      "SELECT payload FROM atlas_landscape WHERE campaign_id=? AND json_valid(payload) AND json_extract(payload,'$.route') IS NOT NULL AND max_x>=? AND min_x<=? AND max_y>=? AND min_y<=?",
    )
    .iterate(cam, ...queryBounds(box));
  const records = new Map<string, LandscapeRecord>();
  let bytes = 0;
  for (const row of rows) {
    const route: LandscapeRecord = JSON.parse(row.payload);
    if (records.has(route.id)) continue;
    for (const r of readRouteTerrain(db, cam, routeBounds(route))) {
      if (records.has(r.id)) continue;
      bytes += JSON.stringify(r).length * 2;
      if (bytes > 16 * 1024 * 1024)
        throw Error('Zu viele verbundene Verläufe. Kleineren Bereich bearbeiten.');
      records.set(r.id, r);
    }
  }
  return [...records.values()];
}

export function computeTerrainStroke(
  db: any,
  cam: string,
  stroke: HeightStroke,
  _pyramid = new TerrainScalePyramid(),
  visibility?: TerrainGrid,
): LandscapeRecord[] {
  validateHeightStroke(stroke);
  if (
    db
      .prepare(
        'SELECT 1 FROM atlas_landscape WHERE campaign_id=? AND NOT json_valid(payload) LIMIT 1',
      )
      .get(cam)
  )
    throw Error('Geländequelle beschädigt.');
  const pixel = heightBrushPixel(stroke.radius),
    area = heightBrushBounds({ ...stroke, visibility: undefined });
  // Interpolation support and smoothing samples may read neighbouring nodes.
  const box = {
    x: area.x - 3 * pixel,
    y: area.y - 3 * pixel,
    width: area.width + 6 * pixel,
    height: area.height + 6 * pixel,
  };
  const needsSource = stroke.mode === 'smooth' || stroke.targetM !== undefined;
  const records =
    stroke.preserveDetails === false || needsSource
      ? readTerrainEditingRecords(
          db,
          cam,
          box,
          pixel,
          stroke.preserveDetails === false,
          needsSource || stroke.preserveDetails === false,
        )
      : scaleRecords(db, cam, box, pixel, false);
  const visible =
    visibility ?? (stroke.visibility ? readTerrainGrid(db, cam, stroke.visibility) : undefined);
  const tiles = applyTerrainBrush(records, stroke, undefined, visible, undefined, true);
  if (!tiles.length) return [];
  const local = routeSources(db, cam, box);
  if (!local.some((r) => r.route)) return tiles;
  const ids = new Set(local.map((r) => r.id));
  return coupleRouteEdits([...local, ...records.filter((r) => !ids.has(r.id))], tiles);
}
