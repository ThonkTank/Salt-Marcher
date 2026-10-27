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
    AND json_extract(payload,'$.height') IS NOT NULL
    AND max_x + 2 * CAST(json_extract(payload,'$.height.pixel') AS REAL) >= ?
    AND min_x - 2 * CAST(json_extract(payload,'$.height.pixel') AS REAL) <= ?
    AND max_y + 2 * CAST(json_extract(payload,'$.height.pixel') AS REAL) >= ?
    AND min_y - 2 * CAST(json_extract(payload,'$.height.pixel') AS REAL) <= ?
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
