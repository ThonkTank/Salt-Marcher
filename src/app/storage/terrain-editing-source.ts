import type { LandscapeBox, LandscapeRecord } from '../atlas/atlas-landscape';

/** Exact author nodes, spatially bounded including Hermite's two-node halo.
 * Unlike a display read this must never discard fine nodes between pixels. */
export function readTerrainEditingRecords(
  db: any,
  campaignId: string,
  box: LandscapeBox,
  pixel?: number,
  fine = true,
  legacy = true,
): LandscapeRecord[] {
  const rows = db
    .prepare(
      `SELECT payload FROM atlas_landscape
    WHERE campaign_id=? AND json_valid(payload)
    AND (json_extract(payload,'$.height') IS NOT NULL ${pixel === undefined ? "OR json_extract(payload,'$.surface')='freshwater' OR json_extract(payload,'$.route') IS NOT NULL" : ''})
    AND coalesce(max_x + 2 * CAST(json_extract(payload,'$.height.pixel') AS REAL),max_x) >= ?
    AND coalesce(min_x - 2 * CAST(json_extract(payload,'$.height.pixel') AS REAL),min_x) <= ?
    AND coalesce(max_y + 2 * CAST(json_extract(payload,'$.height.pixel') AS REAL),max_y) >= ?
    AND coalesce(min_y - 2 * CAST(json_extract(payload,'$.height.pixel') AS REAL),min_y) <= ?
    ${legacy ? '' : "AND json_extract(payload,'$.height.version')=2"}
    ${pixel === undefined || fine ? '' : "AND (json_extract(payload,'$.height.version')=1 OR CAST(json_extract(payload,'$.height.pixel') AS REAL)>=?)"}
    ORDER BY CAST(json_extract(payload,'$.height.pixel') AS REAL) DESC,id`,
    )
    .iterate(
      campaignId,
      box.x,
      box.x + box.width,
      box.y,
      box.y + box.height,
      ...(pixel !== undefined && !fine ? [pixel] : []),
    );
  const records: LandscapeRecord[] = [];
  let bytes = 0;
  for (const row of rows) {
    bytes += row.payload.length * 2;
    if (bytes > 32 * 1024 * 1024)
      throw Error('Zu viele Höhendetails im Bearbeitungsbereich. Kleineren Bereich wählen.');
    records.push(JSON.parse(row.payload));
  }
  return records;
}

/** A bounded IPC packet from one spatial/revision snapshot. The cursor is an
 * author id, never a display resolution: fine nodes are not sampled away. */
export function readTerrainEditingPage(
  db: any,
  campaignId: string,
  box: LandscapeBox,
  after = '',
  maxBytes = 2 * 1024 * 1024,
  filter: { pixel?: number; fine?: boolean; legacy?: boolean } = {},
): { records: LandscapeRecord[]; complete: boolean; next?: string } {
  const rows = db
    .prepare(
      `SELECT id,payload FROM atlas_landscape
    WHERE campaign_id=? AND id>? AND json_valid(payload)
    AND (json_extract(payload,'$.height') IS NOT NULL ${filter.pixel === undefined ? "OR json_extract(payload,'$.surface')='freshwater' OR json_extract(payload,'$.route') IS NOT NULL" : ''})
    AND coalesce(max_x + 2 * CAST(json_extract(payload,'$.height.pixel') AS REAL),max_x) >= ?
    AND coalesce(min_x - 2 * CAST(json_extract(payload,'$.height.pixel') AS REAL),min_x) <= ?
    AND coalesce(max_y + 2 * CAST(json_extract(payload,'$.height.pixel') AS REAL),max_y) >= ?
    AND coalesce(min_y - 2 * CAST(json_extract(payload,'$.height.pixel') AS REAL),min_y) <= ?
    ${filter.legacy === false ? "AND json_extract(payload,'$.height.version')=2" : ''}
    ${filter.pixel === undefined || filter.fine !== false ? '' : "AND (json_extract(payload,'$.height.version')=1 OR CAST(json_extract(payload,'$.height.pixel') AS REAL)>=?)"}
    ORDER BY id`,
    )
    .iterate(
      campaignId,
      after,
      box.x,
      box.x + box.width,
      box.y,
      box.y + box.height,
      ...(filter.pixel !== undefined && filter.fine === false ? [filter.pixel] : []),
    );
  const records: LandscapeRecord[] = [];
  let bytes = 0,
    next = after;
  for (const row of rows) {
    const size = row.payload.length * 2;
    if (records.length && bytes + size > maxBytes) return { records, complete: false, next };
    // A height record is an indivisible bounded author tile. Never truncate it.
    if (size > 32 * 1024 * 1024) throw Error('Einzelner Höhenblock überschreitet die Paketgröße.');
    records.push(JSON.parse(row.payload));
    bytes += size;
    next = row.id;
  }
  return { records, complete: true };
}

/** Canonical brush reads use the same complete spatial packets as the renderer.
 * Keep the shared author kernel intact; no fine records are cut to fit an IPC cap. */
export function readTerrainEditingPackets(
  db: any,
  campaignId: string,
  box: LandscapeBox,
  pixel?: number,
  fine = true,
  legacy = true,
): LandscapeRecord[] {
  const records: LandscapeRecord[] = [];
  let after = '';
  for (;;) {
    const page = readTerrainEditingPage(db, campaignId, box, after, undefined, {
      pixel,
      fine,
      legacy,
    });
    records.push(...page.records);
    if (page.complete) return records;
    if (!page.next || page.next <= after) throw Error('Unvollständige Autorenpakete.');
    after = page.next;
  }
}
