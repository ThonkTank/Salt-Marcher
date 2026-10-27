import { randomUUID } from 'node:crypto';
import { type LandscapeAction, type LandscapeRecord } from '../atlas/atlas-landscape';
import { isLandMode, maskLandSpans, strokeBox } from '../atlas/land-mask';
import {
  colorParts,
  intersectPolygons,
  subtractPolygons,
  unionPolygons,
  validateColor,
} from '../atlas/landscape-brush';
import { colorSurface } from '../atlas/landscape-color-surface';
import { bounds, contains } from '../atlas/landscape-geometry';
import { applyHeightStroke, TerrainSampler } from '../atlas/terrain-height';
import type { Polygon } from '../shared/contracts';
import { landMaskRegion, landscapeRegion, putLandscape } from './atlas-landscape';
import { readTerrainGrid } from './terrain-grid';
import { readRouteTerrain } from './terrain-route';

/** Runs inside the existing Atlas transaction/history, never as a renderer-side read/modify/write. */
export function executeBrush(
  db: any,
  cam: string,
  a: Extract<LandscapeAction, { kind: 'landscape-brush' }>,
  colorRevision: number | null = null,
  visibilityGrid?: import('../atlas/terrain-spatial-model').TerrainGrid,
) {
  if (isLandMode(a.mode)) {
    if (a.record?.paint) throw Error('Landpinsel darf keine Farbmaske enthalten.');
    const stroke = {
      mode: a.mode,
      radius: a.radius,
      roughness: a.roughness,
      seed: a.seed,
      samples: a.samples ?? [],
    };
    if (!stroke.samples.length) throw Error('Zeitstempel des Landpinsels fehlen.');
    const records = landMaskRegion(db, cam, strokeBox(stroke));
    for (const tile of applyHeightStroke(records, stroke))
      putLandscape(db, cam, tile, tile.revision || null);
    return;
  }
  let r = structuredClone(a.record);
  if (r.mask || r.height || r.terrainSettings)
    throw Error('Pinselauftrag darf keine zusätzlichen Geländedaten enthalten.');
  if (
    r.kind !== 'patch' ||
    !r.polygons.length ||
    !Number.isFinite(a.radius) ||
    a.radius <= 0 ||
    !Number.isFinite(a.roughness) ||
    a.roughness < 0 ||
    a.roughness > 2 ||
    ![
      'land',
      'land-erase',
      'raise',
      'lower',
      'freshwater',
      'freshwater-erase',
      'ground-color',
      'water-color',
      'color-erase',
    ].includes(a.mode)
  )
    throw Error('Landschaftspinsel prüfen.');
  const points = [...r.points, ...r.polygons.flatMap((p) => [...p.outer, ...p.holes.flat()])];
  if (
    points.length > 100000 ||
    points.some((p) => !Number.isFinite(p.x) || !Number.isFinite(p.y)) ||
    r.polygons.some((p) => p.outer.length < 3) ||
    !Number.isSafeInteger(a.seed) ||
    a.seed < 0 ||
    a.seed > 0xffffffff ||
    typeof a.fill !== 'boolean' ||
    a.fill !== !!r.paint?.fill
  )
    throw Error('Pinselgeometrie prüfen.');
  validateColor(r);
  let box = bounds(r),
    records: LandscapeRecord[];
  if (r.paint?.version === 2) {
    const mode =
      r.paint.operation === 'erase'
        ? 'color-erase'
        : r.paint.target === 'water'
          ? 'water-color'
          : 'ground-color';
    if (a.mode !== mode || r.propertyOnly || r.mask || r.surface)
      throw Error('Farbauftrag prüfen.');
    if (
      a.fill &&
      db
        .prepare(
          "SELECT count(*) n FROM atlas_landscape WHERE campaign_id=? AND json_extract(payload,'$.kind')='patch'",
        )
        .get(cam).n > 10000
    )
      throw Error('Zu viele Flächen zum Füllen.');
    records = r.paint.visibility
      ? readRouteTerrain(db, cam, box, true)
      : landscapeRegion(db, cam, a.fill ? undefined : box);
    r = colorSurface(
      r,
      records,
      visibilityGrid ??
        (r.paint.visibility ? readTerrainGrid(db, cam, r.paint.visibility) : undefined),
    );
    if (!r.polygons.length) {
      if (a.fill) throw Error('Keine passende Fläche zum Füllen.');
      return;
    }
    putLandscape(db, cam, r, colorRevision);
    return;
  }
  if (a.fill) {
    // Filling is explicit, not a camera read. A bounded author set avoids unbounded global allocation.
    if (
      db
        .prepare(
          "SELECT count(*) n FROM atlas_landscape WHERE campaign_id=? AND json_extract(payload,'$.kind')='patch'",
        )
        .get(cam).n > 10000
    )
      throw Error('Zu viele Flächen zum Füllen. Mit dem Farbpinsel abschnittsweise malen.');
    records = landscapeRegion(db, cam);
    const p = r.points[0];
    if (!p) throw Error('Füllpunkt fehlt.');
    const ordered = records
      .filter((x) => x.kind === 'patch' && x.values.terrain)
      .sort((x, y) => y.resolution - x.resolution || (x.order ?? 0) - (y.order ?? 0));
    let land: Polygon[] = [];
    const masks = records.filter((x) => x.mask).sort((a, b) => b.resolution - a.resolution);
    if (masks.length) {
      for (const tile of masks)
        land = unionPolygons(subtractPolygons(land, tile.polygons), maskLandSpans(tile.mask!));
    } else
      for (const x of ordered)
        land =
          x.values.terrain === 'water'
            ? subtractPolygons(land, x.polygons)
            : unionPolygons(land, x.polygons);
    for (const surface of records.filter((x) => x.surface === 'freshwater'))
      land = subtractPolygons(land, surface.polygons);
    const water = r.paint?.target === 'water';
    if (water) {
      // Only enclosed lakes can be filled on an unbounded ocean.
      const lakes = land.flatMap((poly) => poly.holes.map((outer) => ({ outer, holes: [] })));
      r.polygons = lakes.filter((poly) => contains(p, [poly]));
    } else r.polygons = land.filter((poly) => contains(p, [poly]));
    if (!r.polygons.length)
      throw Error(
        'Zum Füllen eine zusammenhängende Landfläche oder einen geschlossenen See anklicken.',
      );
    box = bounds(r);
  } else {
    const pad = a.radius * 2;
    records = landscapeRegion(db, cam, {
      x: box.x - pad,
      y: box.y - pad,
      width: box.width + pad * 2,
      height: box.height + pad * 2,
    });
  }
  if (a.mode === 'color-erase' || a.mode === 'freshwater-erase') {
    for (const old of records) {
      if (a.mode === 'color-erase' ? !old.paint : old.surface !== 'freshwater') continue;
      if (!intersectPolygons(old.polygons, r.polygons).length) continue;
      const polygons = subtractPolygons(old.polygons, r.polygons);
      if (polygons.length) putLandscape(db, cam, { ...old, polygons }, old.revision);
      else db.prepare('DELETE FROM atlas_landscape WHERE campaign_id=? AND id=?').run(cam, old.id);
    }
    return;
  }
  if (a.mode === 'ground-color' || a.mode === 'water-color') {
    if (!r.paint || r.paint.target !== (a.mode === 'water-color' ? 'water' : 'ground'))
      throw Error('Farbziel prüfen.');
    colorParts(r);
    putLandscape(db, cam, r, null);
    return;
  }
  if (r.paint) throw Error('Landpinsel darf keine Farbmaske enthalten.');
  const water = ['land-erase', 'lower', 'freshwater'].includes(a.mode);
  if (a.mode === 'freshwater') {
    const sampler = new TerrainSampler(records);
    r.waterLevelM ??=
      Math.max(sampler.seaLevelM, sampler.sample(r.points[0] ?? r.polygons[0]!.outer[0]!).heightM) +
      1;
  }
  r.surface = a.mode === 'freshwater' ? 'freshwater' : water ? 'sea' : 'land';
  r.values = {
    terrain: water
      ? 'water'
      : r.values.terrain && r.values.terrain !== 'water'
        ? r.values.terrain
        : 'plains',
  };
  // Fine authored overrides remain authoritative, as with the existing terrain brush.
  putLandscape(db, cam, { ...r, id: r.id || randomUUID() }, null);
}
