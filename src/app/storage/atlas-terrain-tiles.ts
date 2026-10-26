import { validEditingSource } from '../atlas/terrain-editing-source';
import { createHash } from 'node:crypto';
import {
  atlasTerrainTileQuery,
  type AtlasTerrainTileRequest,
  type AtlasTerrainTile,
} from '../atlas/atlas-terrain-tile';
import type { AtlasRegionSource } from '../atlas/atlas-region-contracts';
import type { TerrainProjection } from '../atlas/terrain-projection';
import { landscapeRasterBounds } from '../atlas/landscape-raster';
import { AtlasCacheScope } from './atlas-cache-scope';
import type { AtlasRegionReader } from './atlas-region';

// Change for any lattice, material, source-selection or serialization semantic change.
const FORMAT = 'terrain-tiles-v2-scale-source';
const tileKey = (request: AtlasTerrainTileRequest) =>
  JSON.stringify([
    request.tile.lod,
    request.tile.x,
    request.tile.y,
    request.contours ?? 0,
    ...(request.product ? ['height'] : []),
  ]);
interface StoredTile {
  version: string;
  fingerprint: string;
  projection: TerrainProjection;
}

/** Durable display-only products. Canonical SQLite remains read-only in this worker. */
export class AtlasTerrainTiles {
  private readonly cache: AtlasCacheScope;
  constructor(
    private db: any,
    private directory?: string,
  ) {
    this.cache = new AtlasCacheScope(directory);
  }
  private open(source: AtlasRegionSource) {
    return this.cache.open(source);
  }
  /** Source rows include their full interpolation/paint support in canonical bounds.
   * The raster halo plus a grid-node half-cell covers every source query made by
   * the fixed tile projection. Global settings participate even outside this area.
   * Hash content (not author revisions) so Undo/import cannot alias different data.
   * The unchanged durable shape stamp skips this scan on ordinary warm opens. */
  private fingerprint(source: AtlasRegionSource, request: AtlasTerrainTileRequest): string {
    const q = atlasTerrainTileQuery(request),
      box = landscapeRasterBounds(q.view.box, q.width, q.height);
    const pad = q.view.box.width / (q.view.columns - 1);
    const hash = createHash('sha256').update(FORMAT);
    const rows = this.db
      .prepare(`SELECT CAST(a.rowid AS TEXT) source_row,a.id,a.payload,l.trashed,json_extract(l.payload,'$.name') location_name
      FROM atlas_landscape a LEFT JOIN location l ON l.campaign_id=a.campaign_id AND l.id=json_extract(a.payload,'$.locationId')
      WHERE a.campaign_id=? AND a.max_x>=? AND a.min_x<=? AND a.max_y>=? AND a.min_y<=? ORDER BY a.rowid`);
    for (const row of rows.iterate(
      source.campaignId,
      box.x - pad,
      box.x + box.width + pad,
      box.y - pad,
      box.y + box.height + pad,
    ))
      hash.update(JSON.stringify(row));
    for (const row of this.db
      .prepare(
        `SELECT id,payload FROM atlas_landscape WHERE campaign_id=? AND json_valid(payload)
      AND json_extract(payload,'$.terrainSettings') IS NOT NULL ORDER BY rowid`,
      )
      .iterate(source.campaignId))
      hash.update(JSON.stringify(row));
    return hash.digest('hex');
  }
  private valid(
    value: StoredTile | undefined,
    request: AtlasTerrainTileRequest,
  ): value is StoredTile {
    if (!value || typeof value.version !== 'string' || typeof value.fingerprint !== 'string')
      return false;
    const p = value.projection,
      q = atlasTerrainTileQuery(request);
    return (
      !!p &&
      !p.draft &&
      (request.product === 'height'
        ? p.heightOnly === true &&
          p.width === 0 &&
          p.height === 0 &&
          p.pixels instanceof Uint8Array &&
          p.pixels.length === 0
        : !p.heightOnly &&
          p.width === q.width &&
          p.height === q.height &&
          p.pixels instanceof Uint8Array &&
          p.pixels.length === q.width * q.height * 4 &&
          p.forest instanceof Uint8Array &&
          p.forest.length === q.width * q.height) &&
      p.grid?.heights instanceof Float32Array &&
      p.grid.heights.length === q.view.columns * q.view.rows &&
      validEditingSource(p.grid.editing?.source, q.view.columns * q.view.rows) &&
      JSON.stringify(p.grid.view.box) === JSON.stringify(q.view.box) &&
      p.grid.view.columns === q.view.columns &&
      p.grid.view.rows === q.view.rows
    );
  }
  /** Exact durable-stamp lookup for callers that already validated the pinned
   * source. It deliberately skips the local content fingerprint scan. */
  cached(
    source: AtlasRegionSource,
    request: AtlasTerrainTileRequest,
  ): AtlasTerrainTile | undefined {
    atlasTerrainTileQuery(request, source.fence);
    if (request.revision !== source.revision) throw Error('Atlaskachel inzwischen geändert.');
    if (!this.directory || source.shadow || !source.shapeVersion) return undefined;
    const cache = this.open(source);
    if (!cache) return undefined;
    const key = tileKey(request);
    const old = cache.get<StoredTile>(key, FORMAT);
    if (!this.valid(old, request) || old.version !== source.shapeVersion) return undefined;
    const projection = {
      ...old.projection,
      revision: source.revision,
      fence: source.fence,
      source: source.fence,
    };
    return {
      tile: { ...request.tile },
      revision: source.revision,
      fence: source.fence,
      cache: 'hit',
      projection,
    };
  }
  *read(
    source: AtlasRegionSource,
    request: AtlasTerrainTileRequest,
    reader: AtlasRegionReader,
  ): Generator<void, AtlasTerrainTile> {
    const query = atlasTerrainTileQuery(request, source.fence);
    if (request.revision !== source.revision) throw Error('Atlaskachel inzwischen geändert.');
    const cache = this.open(source),
      key = tileKey(request);
    const old = cache?.get<StoredTile>(key, FORMAT),
      valid = this.valid(old, request);
    let fingerprint: string | undefined;
    if (
      valid &&
      (old.version === source.shapeVersion ||
        (fingerprint = this.fingerprint(source, request)) === old.fingerprint)
    ) {
      if (old.version !== source.shapeVersion)
        cache?.put(key, FORMAT, { ...old, version: source.shapeVersion });
      const projection = {
        ...old.projection,
        revision: source.revision,
        fence: source.fence,
        source: source.fence,
      };
      return {
        tile: { ...request.tile },
        revision: source.revision,
        fence: source.fence,
        cache: 'hit',
        projection,
      };
    }
    if (cache) fingerprint ??= this.fingerprint(source, request);
    const projection = yield* request.product === 'height'
      ? reader.heightSteps(source, query)
      : reader.terrainSteps(source, query);
    // Only complete projections are published. Every resumed worker step pins
    // and revalidates the source snapshot before reaching this point.
    if (cache)
      cache.put(key, FORMAT, {
        version: source.shapeVersion!,
        fingerprint: fingerprint!,
        projection,
      });
    return {
      tile: { ...request.tile },
      revision: source.revision,
      fence: source.fence,
      cache: cache ? 'built' : 'disabled',
      projection,
    };
  }
  close() {
    this.cache.close();
  }
}
