import type { LandscapeBox, LandscapeRecord } from '../atlas/atlas-landscape';
import { decodeHeights } from '../atlas/terrain-height';
import type { TerrainHeightSource } from '../atlas/terrain-height-lattice';
import type { TerrainProjectionCache } from '../atlas/terrain-projection-cache';
import type { TerrainSamples } from '../atlas/terrain-field-stream';
import { landscapeSampleFilter } from './landscape-record-stream';

/** Same coarse-to-fine source order as the raw record stream. The consumer's
 * shared LRU owns decoded blocks; only a cache miss reads canonical payload. */
export function* terrainHeightBlocks(
  prepare: (sql: string) => any,
  cache: TerrainProjectionCache,
  campaignId: string,
  box: LandscapeBox,
  samples: TerrainSamples,
  sampleMath: boolean,
): Generator<TerrainHeightSource> {
  const filter = landscapeSampleFilter(
    box,
    { width: samples.columns / 2, height: samples.rows / 2 },
    sampleMath,
  );
  const keys = prepare(
    `SELECT CAST(source_row AS TEXT) source_row,min_x,min_y,max_x,max_y FROM temp.landscape_shape_bounds WHERE terrain_kind='height' AND max_x>=? AND min_x<=? AND max_y>=? AND min_y<=? ${filter.sql} ORDER BY resolution DESC,coalesce(paint_order,0),source_row`,
  );
  const payload = prepare(
    "SELECT a.payload,l.trashed FROM atlas_landscape a LEFT JOIN location l ON l.campaign_id=a.campaign_id AND l.id=json_extract(a.payload,'$.locationId') WHERE a.rowid=? AND a.campaign_id=?",
  );
  for (const row of keys.iterate(
    box.x,
    box.x + box.width,
    box.y,
    box.y + box.height,
    ...filter.args,
  )) {
    const hit = cache.heightBlock(row.source_row);
    if (hit) {
      yield { version: hit.version, x: hit.x, y: hit.y, pixel: hit.pixel, read: () => hit.values };
      continue;
    }
    const stored = payload.get(row.source_row, campaignId);
    if (!stored || stored.trashed) continue;
    const record = JSON.parse(stored.payload) as LandscapeRecord;
    if (record.kind === 'reference' && record.visible === false) continue;
    const tile = record.height;
    if (!tile) throw Error('Höhenkachel fehlt.');
    yield {
      version: tile.version,
      x: tile.x,
      y: tile.y,
      pixel: tile.pixel,
      read: () => {
        const values = decodeHeights(tile);
        cache.rememberHeightBlock(
          row.source_row,
          {
            x: row.min_x,
            y: row.min_y,
            width: row.max_x - row.min_x,
            height: row.max_y - row.min_y,
          },
          { version: tile.version, x: tile.x, y: tile.y, pixel: tile.pixel, values },
        );
        return values;
      },
    };
  }
}
