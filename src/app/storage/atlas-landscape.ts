import { randomUUID } from 'node:crypto';
import polygonClipping from 'polygon-clipping';
import { type LandscapeAction } from '../atlas/landscape-action-contracts';
import { type LandscapeRecord } from '../atlas/landscape-contracts';
import { validateProminence } from '../atlas/atlas-prominence';
import { bounds } from '../atlas/landscape-geometry';
import { decodeHeights, resetHeightArea, settingsRecord } from '../atlas/terrain-height';
import { terrainTraceMeasure } from '../atlas/terrain-timing';
import { eraseVegetation } from '../atlas/vegetation-erase';
import type { Polygon } from '../shared/contracts';
import { installSourceCellIndex } from './atlas-source-cell';
import { executeBrush } from './landscape-brush-edit';
import { routeProposal } from './terrain-route';
import { computeTerrainStroke, computeLakeStroke } from './terrain-scale';
import { putLandscape, landscapeRegion, writeTerrainHeight } from './landscape-records';
export { landscapeRegion, putLandscape, terrainRegion, landMaskRegion } from './landscape-records';
const clip = (polys: Polygon[]) =>
  polys.map((p) => [p.outer, ...p.holes].map((r) => r.map((p) => [p.x, p.y] as [number, number])));

const unclip = (a: ReturnType<typeof polygonClipping.difference>): Polygon[] =>
  a.map((p) => ({
    outer: p[0]!.map(([x, y]) => ({ x, y })),
    holes: p.slice(1).map((r) => r.map(([x, y]) => ({ x, y }))),
  }));

export function installLandscape(db: any) {
  // Cell imports/updates look up their existing footprint once per cell.
  // Index the complete source key so map writes do not scan all prior cells.
  db.exec(`
 CREATE TABLE IF NOT EXISTS atlas_landscape(campaign_id TEXT NOT NULL REFERENCES campaign(id),id TEXT NOT NULL,revision INTEGER NOT NULL,min_x REAL NOT NULL,max_x REAL NOT NULL,min_y REAL NOT NULL,max_y REAL NOT NULL,payload TEXT NOT NULL,PRIMARY KEY(campaign_id,id)) STRICT;
 CREATE INDEX IF NOT EXISTS landscape_area ON atlas_landscape(campaign_id,min_x,max_x,min_y,max_y);
 -- These rebuildable access paths avoid parsing every height payload for small metadata lookups.
 CREATE INDEX IF NOT EXISTS landscape_invalid_fast ON atlas_landscape(campaign_id) WHERE NOT json_valid(payload);
 CREATE INDEX IF NOT EXISTS landscape_settings_fast ON atlas_landscape(campaign_id) WHERE json_valid(payload) AND json_extract(payload,'$.terrainSettings') IS NOT NULL;
 CREATE INDEX IF NOT EXISTS landscape_height_address ON atlas_landscape(campaign_id,json_extract(payload,'$.height.x'),json_extract(payload,'$.height.y'),json_extract(payload,'$.height.pixel')) WHERE json_valid(payload);
 CREATE INDEX IF NOT EXISTS landscape_height_scale ON atlas_landscape(campaign_id,json_extract(payload,'$.height.version'),CAST(json_extract(payload,'$.height.pixel') AS REAL),min_x,max_x,min_y,max_y) WHERE json_valid(payload) AND json_extract(payload,'$.height') IS NOT NULL;
 CREATE INDEX IF NOT EXISTS landscape_order_fast ON atlas_landscape(campaign_id,json_extract(payload,'$.order')) WHERE json_valid(payload);
 CREATE INDEX IF NOT EXISTS landscape_route_fast ON atlas_landscape(campaign_id,min_x,max_x,min_y,max_y) WHERE json_valid(payload) AND json_extract(payload,'$.route') IS NOT NULL;
 CREATE INDEX IF NOT EXISTS landscape_height_scan ON atlas_landscape(campaign_id,CAST(json_extract(payload,'$.resolution') AS REAL) DESC,coalesce(json_extract(payload,'$.order'),0),min_x,max_x,min_y,max_y) WHERE json_valid(payload) AND json_extract(payload,'$.height') IS NOT NULL;
 CREATE INDEX IF NOT EXISTS landscape_lake_scan ON atlas_landscape(campaign_id,min_x,max_x,min_y,max_y) WHERE json_valid(payload) AND json_extract(payload,'$.surface')='freshwater';
 CREATE TABLE IF NOT EXISTS atlas_reference_asset(campaign_id TEXT NOT NULL REFERENCES campaign(id),id TEXT NOT NULL,mime TEXT NOT NULL,bytes BLOB NOT NULL,PRIMARY KEY(campaign_id,id)) STRICT;
 `);
  installSourceCellIndex(db);
}

export function executeLandscape(
  db: any,
  cam: string,
  a: LandscapeAction,
  liveColorRevision: number | null = null,
  visibilityGrid?: import('../atlas/terrain-grid-contracts').TerrainGrid,
  prepared?: import('./terrain-scale').PreparedTerrainStroke,
) {
  if (a.kind === 'landscape-prominence') {
    if (
      Object.keys(a).some((k) => !['kind', 'id', 'expectedRevision', 'prominence'].includes(k)) ||
      typeof a.id !== 'string' ||
      !Number.isSafeInteger(a.expectedRevision) ||
      a.expectedRevision < 0 ||
      a.prominence === undefined
    )
      throw Error('Prominenzauftrag prüfen.');
    validateProminence(a.prominence === null ? undefined : a.prominence);
    const row = db
      .prepare('SELECT payload FROM atlas_landscape WHERE campaign_id=? AND id=? AND revision=?')
      .get(cam, a.id, a.expectedRevision);
    if (!row) throw Error('Landschaft inzwischen geändert. Neu laden.');
    const record: LandscapeRecord = JSON.parse(row.payload);
    if (record.kind !== 'road' && record.kind !== 'river')
      throw Error('Kartenprominenz gehört zu Straßen und Flüssen.');
    if (record.prominence === (a.prominence ?? undefined)) return;
    if (a.prominence === null) delete record.prominence;
    else record.prominence = a.prominence;
    return putLandscape(db, cam, record, a.expectedRevision);
  }
  if (a.kind === 'landscape-route') {
    if (
      db.prepare('SELECT revision FROM campaign_atlas WHERE campaign_id=?').get(cam).revision !==
      a.sourceRevision
    )
      throw Error('Gelände inzwischen geändert. Vorschau erneut berechnen.');
    const proposal = routeProposal(db, cam, a.record);
    for (const r of proposal.records)
      if (
        r.route &&
        (r.id === a.record.id ||
          JSON.stringify(r) !==
            db
              .prepare('SELECT payload FROM atlas_landscape WHERE campaign_id=? AND id=?')
              .get(cam, r.id)?.payload)
      )
        putLandscape(db, cam, r, r.id === a.record.id ? a.expectedRevision : r.revision);
    return;
  }
  if (
    ((a.kind === 'landscape-put' || a.kind === 'landscape-place') && a.record.route) ||
    (a.kind === 'landscape-batch' && a.records.some((x) => x.record.route))
  )
    throw Error('Geplante Verläufe mit Vorschau im Verlaufseditor bearbeiten.');
  if (a.kind === 'landscape-vegetation-edit') {
    if (
      !['clear', 'thin', 'dense', 'erase'].includes(a.mode) ||
      !Array.isArray(a.polygons) ||
      !a.polygons.length ||
      a.polygons.length > 1000 ||
      a.polygons.some(
        (p) =>
          !p ||
          !Array.isArray(p.outer) ||
          p.outer.length < 3 ||
          !Array.isArray(p.holes) ||
          [p.outer, ...p.holes].some(
            (r) =>
              !Array.isArray(r) ||
              r.length < 3 ||
              r.some((v) => !v || !Number.isFinite(v.x) || !Number.isFinite(v.y)),
          ),
      )
    )
      throw Error('Bestandskorrektur prüfen.');
    const area = bounds({
      id: '',
      revision: 0,
      name: '',
      kind: 'vegetation',
      points: [],
      polygons: a.polygons,
      width: 0,
      resolution: 1,
      values: {},
    });
    if (!Object.values(area).every(Number.isFinite)) throw Error('Bestandskorrektur prüfen.');
    const records = landscapeRegion(db, cam, area).filter((r) => r.vegetation);
    if (!records.length && a.mode !== 'erase')
      throw Error('Hier liegt keine Bewuchsfläche. Zuerst eine Landschaft malen.');
    for (const record of records) {
      if (a.mode === 'erase') {
        const remaining = eraseVegetation(record, a.polygons);
        if (!remaining)
          db.prepare('DELETE FROM atlas_landscape WHERE campaign_id=? AND id=?').run(
            cam,
            record.id,
          );
        else if (remaining !== record) putLandscape(db, cam, remaining, record.revision);
      } else {
        record.vegetation!.edits.push({ polygons: a.polygons, mode: a.mode });
        putLandscape(db, cam, record, record.revision);
      }
    }
    return;
  }

  if (a.kind === 'landscape-sea-level' || a.kind === 'landscape-terrain-style') {
    const old = db
      .prepare(
        "SELECT payload FROM atlas_landscape WHERE campaign_id=? AND json_valid(payload) AND json_extract(payload,'$.terrainSettings') IS NOT NULL",
      )
      .get(cam);
    const record: LandscapeRecord = old ? JSON.parse(old.payload) : settingsRecord(0);
    if (a.kind === 'landscape-sea-level') record.terrainSettings!.seaLevelM = a.seaLevelM;
    else record.terrainSettings!.style = a.style;
    return putLandscape(db, cam, record, old ? record.revision : null);
  }
  if (a.kind === 'landscape-lake-stroke') {
    const edited = prepared ?? computeLakeStroke(db, cam, a.stroke, visibilityGrid);
    for (const id of edited.remove ?? [])
      db.prepare('DELETE FROM atlas_landscape WHERE campaign_id=? AND id=?').run(cam, id);
    for (const r of edited.records) putLandscape(db, cam, r, r.revision || null);
    return;
  }
  if (a.kind === 'landscape-height-stroke') {
    const edited =
      prepared?.records ??
      terrainTraceMeasure('author.brush', () =>
        computeTerrainStroke(db, cam, a.stroke, undefined, visibilityGrid),
      );
    for (const tile of edited) putLandscape(db, cam, tile, tile.revision || null);
    return;
  }
  if (a.kind === 'landscape-land-stroke') {
    if (
      !a.stroke ||
      Object.keys(a).some((k) => !['kind', 'stroke'].includes(k)) ||
      Object.keys(a.stroke).some(
        (k) => !['mode', 'radius', 'roughness', 'seed', 'samples'].includes(k),
      )
    )
      throw Error('Landauftrag prüfen.');
    return executeBrush(db, cam, {
      kind: 'landscape-brush',
      record: {} as LandscapeRecord,
      ...a.stroke,
      fill: false,
    });
  }
  if (a.kind === 'landscape-color-stroke') {
    const p = a.record?.paint;
    if (
      !p ||
      p.version !== 2 ||
      a.record.propertyOnly ||
      a.record.mask ||
      a.record.surface ||
      Object.keys(a.record.values).length
    )
      throw Error('Farbauftrag prüfen.');
    return executeBrush(
      db,
      cam,
      {
        kind: 'landscape-brush',
        record: a.record,
        mode:
          p.operation === 'erase'
            ? 'color-erase'
            : p.target === 'water'
              ? 'water-color'
              : 'ground-color',
        radius: p.radius,
        roughness: 0,
        seed: p.seed,
        fill: p.fill,
      },
      liveColorRevision,
      visibilityGrid,
    );
  }
  if (a.kind === 'landscape-brush') return executeBrush(db, cam, a);
  if (
    ((a.kind === 'landscape-put' || a.kind === 'landscape-place') &&
      (a.record.mask || a.record.terrainSettings)) ||
    (a.kind === 'landscape-batch' &&
      a.records.some((x) => x.record.mask || x.record.terrainSettings))
  )
    throw Error('Landmasken sind nicht mehr schreibbar. Landwerkzeug verwenden.');
  if (a.kind === 'landscape-batch') {
    for (const r of a.remove ?? []) executeLandscape(db, cam, { kind: 'landscape-remove', ...r });
    for (const r of a.records) putLandscape(db, cam, r.record, r.expectedRevision);
    return;
  }
  if (a.kind === 'landscape-put' || a.kind === 'landscape-place')
    return putLandscape(db, cam, a.record, a.expectedRevision);
  if (a.kind === 'landscape-remove') {
    for (const row of db
      .prepare(
        "SELECT payload FROM atlas_landscape WHERE campaign_id=? AND json_extract(payload,'$.route.mouth.id')=?",
      )
      .all(cam, a.id)) {
      const dependent = JSON.parse(row.payload);
      delete dependent.route.mouth;
      dependent.route.conflict = 'Mündungsanschluss gelöscht. Mündung neu verbinden.';
      putLandscape(db, cam, dependent, dependent.revision);
    }
    const row = db
      .prepare('SELECT payload FROM atlas_landscape WHERE campaign_id=? AND id=? AND revision=?')
      .get(cam, a.id, a.expectedRevision);
    if (row) {
      const r = JSON.parse(row.payload);
      if (r.mask || r.height || r.terrainSettings)
        throw Error('Gelände mit den Landschaftswerkzeugen bearbeiten.');
      if (r.kind === 'patch' && r.values.terrain && !r.propertyOnly && r.surface !== 'freshwater')
        writeTerrainHeight(db, cam, { ...r, values: { terrain: 'water' } });
    }

    if (
      db
        .prepare('DELETE FROM atlas_landscape WHERE campaign_id=? AND id=? AND revision=?')
        .run(cam, a.id, a.expectedRevision).changes !== 1
    )
      throw new Error('Landschaft inzwischen geändert.');
    return;
  }
  if (
    ![
      'terrain',
      'elevationM',
      'climate',
      'road',
      'river',
      'label',
      'faction',
      'interrupt',
      'access',
    ].includes(a.field) ||
    !Number.isFinite(a.resolution) ||
    a.resolution <= 0
  )
    throw new Error('Zurücksetzbereich prüfen.');
  const records = landscapeRegion(
    db,
    cam,
    bounds({
      points: [],
      polygons: a.polygons,
      kind: 'patch',
      width: 0,
    } as any),
  );
  if (a.field === 'elevationM')
    for (const tile of resetHeightArea(records, a.polygons, a.resolution)) {
      if (decodeHeights(tile.height!).every(Number.isNaN))
        db.prepare('DELETE FROM atlas_landscape WHERE campaign_id=? AND id=?').run(cam, tile.id);
      else putLandscape(db, cam, tile, tile.revision);
    }
  if (a.field === 'terrain' && !a.propertyOnly)
    writeTerrainHeight(db, cam, {
      id: 'reset',
      revision: 0,
      name: '',
      kind: 'patch',
      width: 0,
      resolution: a.resolution,
      points: [],
      polygons: a.polygons,
      values: { terrain: 'water' },
    });
  for (const r of records) {
    if (
      r.kind !== 'patch' ||
      (a.propertyOnly === true && r.propertyOnly !== true) ||
      r.resolution > a.resolution ||
      r.resolution <= a.resolution / 3 ||
      !Object.hasOwn(r.values, a.field)
    )
      continue;
    const outside = unclip(polygonClipping.difference(clip(r.polygons), clip(a.polygons))),
      inside = unclip(polygonClipping.intersection(clip(r.polygons), clip(a.polygons)));
    if (!inside.length) continue;
    db.prepare('DELETE FROM atlas_landscape WHERE campaign_id=? AND id=?').run(cam, r.id);
    if (outside.length) putLandscape(db, cam, { ...r, polygons: outside }, null);
    const values = { ...r.values };
    delete values[a.field];
    if (Object.keys(values).length)
      putLandscape(
        db,
        cam,
        {
          ...r,
          id: outside.length ? randomUUID() : r.id,
          polygons: inside,
          values,
        },
        null,
      );
  }
}
