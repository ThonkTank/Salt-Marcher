import { routeBounds, validateRoute } from '../atlas/terrain-route';
import { planRoute, replanRoutes } from '../atlas/terrain-route-planner';
import type { LandscapeRecord, LandscapeBox } from '../atlas/atlas-landscape';

const union = (a: LandscapeBox, b: LandscapeBox) => {
  const x = Math.min(a.x, b.x),
    y = Math.min(a.y, b.y);
  return {
    x,
    y,
    width: Math.max(a.x + a.width, b.x + b.width) - x,
    height: Math.max(a.y + a.height, b.y + b.height) - y,
  };
};
/** Include full affected routes and their neighbours, not just the camera cut.
 * Explicit limits fail before a preview or transaction can partially succeed. */
export function readRouteTerrain(
  db: any,
  cam: string,
  box: LandscapeBox,
  allPatches = false,
): LandscapeRecord[] {
  if (
    db
      .prepare(
        'SELECT 1 FROM atlas_landscape WHERE campaign_id=? AND NOT json_valid(payload) LIMIT 1',
      )
      .get(cam)
  )
    throw Error('Geländequelle beschädigt.');
  let bytes = 0;
  let search = { ...box };
  const selected = new Map<string, LandscapeRecord>();
  for (let pass = 0; pass <= 128; pass++) {
    const ids = [...selected.keys()],
      targets = [...selected.values()].flatMap((r) => (r.route?.mouth ? [r.route.mouth.id] : []));
    const rows = db
      .prepare(
        `SELECT payload FROM atlas_landscape WHERE campaign_id=? AND json_valid(payload) AND json_extract(payload,'$.route') IS NOT NULL
      AND ((max_x>=? AND min_x<=? AND max_y>=? AND min_y<=?) OR id IN (SELECT value FROM json_each(?))
      OR json_extract(payload,'$.route.mouth.id') IN (SELECT value FROM json_each(?)))`,
      )
      .iterate(
        cam,
        search.x,
        search.x + search.width,
        search.y,
        search.y + search.height,
        JSON.stringify(targets),
        JSON.stringify(ids),
      );
    let added = false;
    for (const row of rows) {
      const r: LandscapeRecord = JSON.parse(row.payload);
      if (selected.has(r.id)) continue;
      bytes += Buffer.byteLength(row.payload);
      if (bytes > 4 * 1024 * 1024 || selected.size >= 128)
        throw Error('Zu viele verbundene Verläufe. Kleineren Bereich bearbeiten.');
      selected.set(r.id, r);
      search = union(search, routeBounds(r));
      added = true;
    }
    if (!added) break;
  }
  // Keep the tiny settings lookup separate: an OR with global settings forces
  // SQLite to inspect every large height payload before considering local bounds.
  const rows = db
    .prepare(
      `SELECT id,payload FROM atlas_landscape INDEXED BY landscape_settings_fast WHERE campaign_id=? AND json_valid(payload) AND json_extract(payload,'$.terrainSettings') IS NOT NULL
    UNION SELECT id,payload FROM atlas_landscape WHERE campaign_id=? AND
    max_x>=? AND min_x<=? AND max_y>=? AND min_y<=? AND
    (? OR json_extract(payload,'$.height') IS NOT NULL OR json_extract(payload,'$.surface')='freshwater' OR json_extract(payload,'$.route') IS NOT NULL) ORDER BY id`,
    )
    .iterate(
      cam,
      cam,
      search.x,
      search.x + search.width,
      search.y,
      search.y + search.height,
      allPatches ? 1 : 0,
    );
  const records: LandscapeRecord[] = [];
  bytes = 0;
  for (const row of rows) {
    bytes += Buffer.byteLength(row.payload);
    if (bytes > 16 * 1024 * 1024)
      throw Error('Planungsbereich zu groß. Kürzere Abschnitte anlegen.');
    records.push(JSON.parse(row.payload));
  }
  return records;
}
export function routeProposal(db: any, cam: string, record: LandscapeRecord) {
  validateRoute(record, false);
  const source = readRouteTerrain(db, cam, routeBounds(record), true);
  const planned = planRoute(source, record);
  const all = replanRoutes([...source.filter((r) => r.id !== record.id), planned]);
  const invalid = all.find((r) => r.route?.conflict);
  if (invalid) throw Error(invalid.route!.conflict);
  return { record: all.find((r) => r.id === record.id)!, records: all };
}
