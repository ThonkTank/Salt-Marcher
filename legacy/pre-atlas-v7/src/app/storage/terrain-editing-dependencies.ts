import type { LandscapeBox } from '../atlas/landscape-bounds';
import type { LandscapeRecord } from '../atlas/landscape-contracts';
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
    "SELECT payload FROM atlas_landscape WHERE campaign_id=? AND json_valid(payload) AND json_extract(payload,'$.surface')='freshwater' AND max_x>=? AND min_x<=? AND max_y>=? AND min_y<=? ORDER BY id",
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
     AND ((max_x>=? AND min_x<=? AND max_y>=? AND min_y<=?) OR id IN (SELECT value FROM json_each(?)) OR json_extract(payload,'$.route.mouth.id') IN (SELECT value FROM json_each(?))) ORDER BY id`,
  );
  const sharedOwners = db.prepare(`SELECT payload FROM atlas_landscape
    WHERE campaign_id=? AND json_valid(payload) AND json_extract(payload,'$.surface')='freshwater'
    AND EXISTS (SELECT 1 FROM json_each(payload,'$.lakeBed') bed
      WHERE json_extract(bed.value,'$.tileId') IN (SELECT value FROM json_each(?))) ORDER BY id`);
  function expandOwners() {
    for (;;) {
      const ids = [
        ...new Set([...selected.values()].flatMap((r) => r.lakeBed?.map((b) => b.tileId) ?? [])),
      ];
      let added = false;
      if (!ids.length) return;
      for (const row of sharedOwners.iterate(campaign, JSON.stringify(ids))) {
        const lake: LandscapeRecord = JSON.parse(row.payload);
        if (selected.has(lake.id)) continue;
        selected.set(lake.id, lake);
        pending.push(lake);
        added = true;
      }
      if (!added) return;
      expandLakes();
    }
  }
  expandOwners();
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
          expandOwners();
        }
      }
      const corridor = routeBounds(r);
      corridors.push(corridor);
      searches.push(corridor);
    }
  }
  // Excavation belongs to an explicit author tile. Geometry is only a search
  // aid: an empty/trimmed water polygon must not hide its remaining ownership.
  const tileIds = new Set<string>();
  const owner = db.prepare(`SELECT json_extract(payload,'$.height.version') version,
    json_extract(payload,'$.height.x') x,json_extract(payload,'$.height.y') y,
    json_extract(payload,'$.height.pixel') pixel FROM atlas_landscape WHERE campaign_id=? AND id=?`);
  for (const r of selected.values())
    for (const bed of r.lakeBed ?? []) {
      const tile = owner.get(campaign, bed.tileId);
      if (
        !tile ||
        tile.version !== 2 ||
        tile.x !== bed.tile.x ||
        tile.y !== bed.tile.y ||
        tile.pixel !== bed.tile.pixel
      )
        throw Error('Zugeordnete Seehöhe fehlt. Ausschnitt erneut laden.');
      tileIds.add(bed.tileId);
    }
  return { records: [...selected.values()], corridors, tileIds: [...tileIds].sort() };
}

/** Retain only the small query plan between packets, never another complete
 * parsed copy of the water/height payloads that those packets deliver. */
export function terrainEditingSourcePlan(
  db: any,
  campaign: string,
  box: LandscapeBox,
  supports: readonly LandscapeBox[] = [box],
) {
  if (
    db
      .prepare(
        'SELECT 1 FROM atlas_landscape WHERE campaign_id=? AND NOT json_valid(payload) LIMIT 1',
      )
      .get(campaign)
  )
    throw Error('Geländequelle beschädigt.');
  const ids = new Set<string>(),
    corridors = new Map<string, LandscapeBox>();
  for (const support of supports) {
    const dependencies = terrainEditingDependencies(db, campaign, support);
    for (const r of dependencies.records) ids.add(r.id);
    for (const id of dependencies.tileIds) ids.add(id);
    for (const b of dependencies.corridors) corridors.set(JSON.stringify(b), b);
    if (corridors.size > 128)
      throw Error('Verbundene See-/Verlaufquellen zu groß. Kleineren Bereich bearbeiten.');
  }
  return { ids: [...ids].sort(), corridors: [...corridors.values()] };
}
export type TerrainEditingSourcePlan = ReturnType<typeof terrainEditingSourcePlan>;

/** SQL suffix shared by paged and legacy editing readers. */
export const editingDependencySql = `OR id IN (SELECT value FROM json_each(?))
 OR (json_extract(payload,'$.height') IS NOT NULL AND EXISTS (
 SELECT 1 FROM json_each(?) b WHERE
 coalesce(max_x + 2 * CAST(json_extract(payload,'$.height.pixel') AS REAL),max_x)>=json_extract(b.value,'$.x') AND
 coalesce(min_x - 2 * CAST(json_extract(payload,'$.height.pixel') AS REAL),min_x)<=json_extract(b.value,'$.x')+json_extract(b.value,'$.width') AND
 coalesce(max_y + 2 * CAST(json_extract(payload,'$.height.pixel') AS REAL),max_y)>=json_extract(b.value,'$.y') AND
 coalesce(min_y - 2 * CAST(json_extract(payload,'$.height.pixel') AS REAL),min_y)<=json_extract(b.value,'$.y')+json_extract(b.value,'$.height'))) `;
