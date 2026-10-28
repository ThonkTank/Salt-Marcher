import type { LandscapeBox, LandscapeRecord } from '../atlas/atlas-landscape';
import { bounds } from '../atlas/landscape-geometry';
import { intersectPolygons } from '../atlas/landscape-brush';
import { routeBounds } from '../atlas/terrain-route';

/** Complete water bodies and connected route corridors are author dependencies,
 * independent of camera clipping. Height payloads stay in the existing packets. */
export function terrainEditingDependencies(db: any, campaign: string, box: LandscapeBox) {
  const selected = new Map<string, LandscapeRecord>();
  const setting = db
    .prepare(
      "SELECT payload FROM atlas_landscape INDEXED BY landscape_settings_fast WHERE campaign_id=? AND json_valid(payload) AND json_extract(payload,'$.terrainSettings') IS NOT NULL",
    )
    .get(campaign);
  const settings: LandscapeRecord | undefined = setting ? JSON.parse(setting.payload) : undefined;
  if (settings) selected.set(settings.id, settings);
  const defaultLevel = (settings?.terrainSettings?.seaLevelM ?? 0) + 1;
  const lakes = db.prepare(
    "SELECT payload FROM atlas_landscape WHERE campaign_id=? AND json_valid(payload) AND json_extract(payload,'$.surface')='freshwater' AND max_x>=? AND min_x<=? AND max_y>=? AND min_y<=?",
  );
  const nearLakes = (b: LandscapeBox): LandscapeRecord[] =>
    [...lakes.iterate(campaign, b.x, b.x + b.width, b.y, b.y + b.height)].map((row: any) =>
      JSON.parse(row.payload),
    );
  const pending = nearLakes(box);
  for (const lake of pending) selected.set(lake.id, lake);
  let expanded = 0;
  function expandLakes() {
    for (; expanded < pending.length; expanded++) {
      const lake = pending[expanded]!;
      if (!lake.polygons.length) continue;
      for (const next of nearLakes(bounds(lake))) {
        if (
          selected.has(next.id) ||
          (lake.waterLevelM ?? defaultLevel) !== (next.waterLevelM ?? defaultLevel) ||
          !intersectPolygons(lake.polygons, next.polygons).length
        )
          continue;
        selected.set(next.id, next);
        pending.push(next);
      }
    }
  }
  expandLakes();
  const corridors: LandscapeBox[] = [];
  const routes = db.prepare(
    `SELECT payload FROM atlas_landscape WHERE campaign_id=? AND json_valid(payload) AND json_extract(payload,'$.route') IS NOT NULL
     AND ((max_x>=? AND min_x<=? AND max_y>=? AND min_y<=?) OR id IN (SELECT value FROM json_each(?)) OR json_extract(payload,'$.route.mouth.id') IN (SELECT value FROM json_each(?)))`,
  );
  const searches = [box];
  for (let i = 0; i < searches.length; i++) {
    const b = searches[i]!,
      ids = [...selected.keys()],
      targets = [...selected.values()].flatMap((r) => (r.route?.mouth ? [r.route.mouth.id] : []));
    for (const row of routes.iterate(
      campaign,
      b.x,
      b.x + b.width,
      b.y,
      b.y + b.height,
      JSON.stringify(targets),
      JSON.stringify(ids),
    )) {
      const r: LandscapeRecord = JSON.parse(row.payload);
      if (selected.has(r.id)) continue;
      if (corridors.length >= 128)
        throw Error('Verbundene See-/Verlaufquellen zu groß. Kleineren Bereich bearbeiten.');
      selected.set(r.id, r);
      if (r.route?.mouth && !selected.has(r.route.mouth.id)) {
        const row = db
          .prepare(
            "SELECT payload FROM atlas_landscape WHERE campaign_id=? AND id=? AND json_valid(payload) AND json_extract(payload,'$.surface')='freshwater'",
          )
          .get(campaign, r.route.mouth.id);
        if (row) {
          const target: LandscapeRecord = JSON.parse(row.payload);
          selected.set(target.id, target);
          pending.push(target);
          expandLakes();
        }
      }
      const corridor = routeBounds(r);
      corridors.push(corridor);
      searches.push(corridor);
    }
  }
  return { records: [...selected.values()], corridors };
}

/** SQL suffix shared by paged and legacy editing readers. */
export const editingDependencySql = `OR id IN (SELECT value FROM json_each(?))
 OR (json_extract(payload,'$.height') IS NOT NULL AND EXISTS (
 SELECT 1 FROM json_each(?) b WHERE
 coalesce(max_x + 2 * CAST(json_extract(payload,'$.height.pixel') AS REAL),max_x)>=json_extract(b.value,'$.x') AND
 coalesce(min_x - 2 * CAST(json_extract(payload,'$.height.pixel') AS REAL),min_x)<=json_extract(b.value,'$.x')+json_extract(b.value,'$.width') AND
 coalesce(max_y + 2 * CAST(json_extract(payload,'$.height.pixel') AS REAL),max_y)>=json_extract(b.value,'$.y') AND
 coalesce(min_y - 2 * CAST(json_extract(payload,'$.height.pixel') AS REAL),min_y)<=json_extract(b.value,'$.y')+json_extract(b.value,'$.height'))) `;
