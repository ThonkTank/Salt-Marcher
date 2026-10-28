import { checkedLandscapeValue } from './landscape-read';
import { type LandscapeBox } from '../atlas/landscape-bounds';
import { type LandscapeRecord } from '../atlas/landscape-contracts';
import { REGION_REPLY_BYTES } from '../atlas/atlas-region-limits';
import { bounds } from '../atlas/landscape-geometry';
import { applyHeightArea } from '../atlas/terrain-height';
import { readRouteTerrain } from './terrain-route';
export const attemptedIndexes = new WeakSet<object>();

/** Rebuildable connection-local index; never exported or captured in author history. */
function installLandscapeIndex(db: any) {
  attemptedIndexes.add(db);
  // Separate point/line/image candidates keep a world overview from scanning
  // every fine patch just to exclude it before requesting its display raster.
  try {
    db.transaction(() => {
      for (const [name, objects] of [
        ['atlas_landscape_area', false],
        ['atlas_landscape_objects', true],
      ] as const) {
        const condition = objects
          ? "CASE WHEN json_valid(payload) THEN json_extract(payload,'$.kind')!='patch' ELSE 1 END"
          : '1';
        const next = objects
          ? "CASE WHEN json_valid(new.payload) THEN json_extract(new.payload,'$.kind')!='patch' ELSE 1 END"
          : '1';
        db.exec(`CREATE VIRTUAL TABLE temp.${name} USING rtree(id,min_x,max_x,min_y,max_y);
      INSERT INTO temp.${name} SELECT rowid,min_x,max_x,min_y,max_y FROM main.atlas_landscape WHERE ${condition};
      CREATE TEMP TRIGGER ${name}_prior BEFORE INSERT ON main.atlas_landscape BEGIN
        DELETE FROM ${name} WHERE id IN(SELECT rowid FROM main.atlas_landscape WHERE campaign_id=new.campaign_id AND id=new.id); END;
      CREATE TEMP TRIGGER ${name}_insert AFTER INSERT ON main.atlas_landscape WHEN ${next} BEGIN
        INSERT INTO ${name} VALUES(new.rowid,new.min_x,new.max_x,new.min_y,new.max_y); END;
      CREATE TEMP TRIGGER ${name}_update AFTER UPDATE ON main.atlas_landscape BEGIN
        DELETE FROM ${name} WHERE id=old.rowid;
        INSERT INTO ${name} SELECT new.rowid,new.min_x,new.max_x,new.min_y,new.max_y WHERE ${next}; END;
      CREATE TEMP TRIGGER ${name}_delete AFTER DELETE ON main.atlas_landscape BEGIN
        DELETE FROM ${name} WHERE id=old.rowid; END;`);
      }
    })();
    return true;
  } catch {
    // Derived structures are optional. A failed rebuild rolls back all its TEMP
    // DDL and must never block access to a different campaign's author data.
    console.warn('Atlas spatial cache unavailable; using canonical bounds.');
    return false;
  }
}

export function landscapeRegion(
  db: any,
  cam: string,
  box?: LandscapeBox,
  metersPerPixel = 0,
  includePatches = true,
): LandscapeRecord[] {
  if (
    box &&
    (!Object.values(box).every(Number.isFinite) ||
      box.width <= 0 ||
      box.height <= 0 ||
      !Number.isFinite(box.x + box.width) ||
      !Number.isFinite(box.y + box.height))
  )
    throw new Error('Ausschnitt prüfen.');
  if (!Number.isFinite(metersPerPixel) || metersPerPixel < 0)
    throw new Error('Darstellungsmaßstab prüfen.');
  if (typeof includePatches !== 'boolean') throw new Error('Darstellungsfilter prüfen.');
  if (box && !attemptedIndexes.has(db)) installLandscapeIndex(db);
  const areaTable = includePatches ? 'atlas_landscape_area' : 'atlas_landscape_objects';
  const indexed =
    box && db.prepare("SELECT 1 FROM sqlite_temp_master WHERE name='atlas_landscape_area'").get();
  const select =
    'SELECT a.payload,a.min_x,a.max_x,a.min_y,a.max_y,l.payload location_payload,l.trashed FROM ' +
    (indexed
      ? areaTable + ' s CROSS JOIN main.atlas_landscape a ON a.rowid=s.id'
      : 'atlas_landscape a') +
    " LEFT JOIN location l ON l.campaign_id=a.campaign_id AND l.id=json_extract(a.payload,'$.locationId') WHERE a.campaign_id=?" +
    (includePatches ? '' : " AND json_extract(a.payload,'$.kind')!='patch'");
  const statement = db.prepare(
    select +
      (box
        ? ` AND ${indexed ? 's' : 'a'}.max_x>=? AND ${indexed ? 's' : 'a'}.min_x<=? AND ${indexed ? 's' : 'a'}.max_y>=? AND ${indexed ? 's' : 'a'}.min_y<=? AND ((a.max_x=a.min_x AND a.max_y=a.min_y) OR a.max_x-a.min_x>=? OR a.max_y-a.min_y>=?) ORDER BY a.rowid`
        : ' ORDER BY a.rowid'),
  );
  const parameters = box
    ? [
        cam,
        box.x,
        box.x + box.width,
        box.y,
        box.y + box.height,
        metersPerPixel / 2,
        metersPerPixel / 2,
      ]
    : [cam];
  const settings = includePatches
    ? db
        .prepare(
          "SELECT payload FROM atlas_landscape WHERE campaign_id=? AND json_valid(payload) AND json_extract(payload,'$.terrainSettings') IS NOT NULL",
        )
        .get(cam)
    : undefined;
  const records: LandscapeRecord[] = settings ? [JSON.parse(settings.payload)] : [];
  let used = 2;
  for (const r of statement.iterate(...parameters) as Iterable<any>) {
    if (
      r.trashed ||
      (box &&
        !(
          r.max_x >= box.x &&
          r.min_x <= box.x + box.width &&
          r.max_y >= box.y &&
          r.min_y <= box.y + box.height
        ))
    )
      continue;
    const record = JSON.parse(r.payload);
    if (r.location_payload) record.name = JSON.parse(r.location_payload).name;
    if (!includePatches) {
      used += Buffer.byteLength(JSON.stringify(record)) + 1;
      if (used > REGION_REPLY_BYTES)
        throw new Error(
          'Landschaftsobjekte überschreiten das Darstellungsbudget. Weiter hineinzoomen.',
        );
    }
    if (!record.terrainSettings) records.push(record);
  }
  return records;
}

// Keep only four prepared programs per connection, never row values. Repeated
// tile writes otherwise allocate a new native SQLite program for every query;
// its memory is not reflected in V8's small JavaScript statement wrapper.
const writeStatements = new WeakMap<object, ReturnType<typeof prepareWrites>>();

function prepareWrites(db: any) {
  return {
    prior: db.prepare('SELECT revision,payload FROM atlas_landscape WHERE campaign_id=? AND id=?'),
    order: db.prepare(
      "SELECT coalesce(max(json_extract(payload,'$.order')),0)+1 n FROM atlas_landscape WHERE campaign_id=? AND json_valid(payload)",
    ),
    height: db.prepare(
      "SELECT id FROM atlas_landscape WHERE campaign_id=? AND json_valid(payload) AND id!=? AND json_extract(payload,'$.height.x')=? AND json_extract(payload,'$.height.y')=? AND json_extract(payload,'$.height.pixel')=? AND json_extract(payload,'$.height.version')=?",
    ),
    put: db.prepare(
      'INSERT INTO atlas_landscape VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(campaign_id,id) DO UPDATE SET revision=excluded.revision,min_x=excluded.min_x,max_x=excluded.max_x,min_y=excluded.min_y,max_y=excluded.max_y,payload=excluded.payload',
    ),
  };
}

function writes(db: any) {
  let statements = writeStatements.get(db);
  if (!statements) {
    statements = prepareWrites(db);
    writeStatements.set(db, statements);
  }
  return statements;
}

export function putLandscape(db: any, cam: string, r: LandscapeRecord, expected: number | null) {
  checkedLandscapeValue(r);
  if (r.vegetationView) throw Error('Darstellungsdaten sind nicht schreibbar.');
  for (const o of r.vegetation?.overrides ?? [])
    if (
      o.locationId &&
      !db
        .prepare('SELECT 1 FROM location WHERE campaign_id=? AND id=? AND trashed=0')
        .get(cam, o.locationId)
    )
      throw Error('Verknüpfter Ort fehlt.');
  if (
    r.height &&
    writes(db).height.get(cam, r.id, r.height.x, r.height.y, r.height.pixel, r.height.version)
  )
    throw Error('Doppelte Höhenkachel.');
  if (
    r.kind === 'reference' &&
    !db
      .prepare('SELECT 1 FROM atlas_reference_asset WHERE campaign_id=? AND id=?')
      .get(cam, r.assetId)
  )
    throw Error('Bildkalibrierung prüfen.');
  const statements = writes(db),
    old = statements.prior.get(cam, r.id);
  if ((old?.revision ?? null) !== expected)
    throw new Error('Landschaft inzwischen geändert. Neu laden.');
  if (old) {
    const prior: LandscapeRecord = JSON.parse(old.payload);
    if (
      prior.height &&
      (!r.height ||
        prior.height.version !== r.height.version ||
        prior.height.x !== r.height.x ||
        prior.height.y !== r.height.y ||
        prior.height.pixel !== r.height.pixel)
    )
      throw Error('Höhenkacheladresse ist unveränderlich.');
  }
  const b = bounds(r),
    next = {
      ...r,
      ...(r.kind === 'patch' &&
      r.values.terrain &&
      !r.propertyOnly &&
      !r.mask &&
      !r.height &&
      r.surface !== 'freshwater'
        ? { maskManaged: true }
        : {}),
      order: r.order ?? statements.order.get(cam).n,
      revision: (expected ?? 0) + 1,
    };
  statements.put.run(
    cam,
    r.id,
    next.revision,
    b.x,
    b.x + b.width,
    b.y,
    b.y + b.height,
    JSON.stringify(next),
  );
  if (
    r.kind === 'patch' &&
    (r.values.elevationM !== undefined || (r.values.terrain && !r.propertyOnly)) &&
    !r.mask &&
    !r.height &&
    r.surface !== 'freshwater'
  ) {
    const prior = old ? JSON.parse(old.payload) : null,
      moved = prior && JSON.stringify(prior.polygons) !== JSON.stringify(r.polygons);
    if (moved && prior.values.terrain)
      writeTerrainHeight(db, cam, { ...prior, values: { terrain: 'water' } });
    if (
      !prior ||
      moved ||
      prior.values.terrain !== r.values.terrain ||
      prior.values.elevationM !== r.values.elevationM
    )
      writeTerrainHeight(db, cam, r);
  }
}

/** Read-only author data for previews/point queries; never installs TEMP indexes or changes a source fence. */
export function terrainRegion(
  db: any,
  cam: string,
  box: LandscapeBox,
  allPatches = false,
): LandscapeRecord[] {
  return readRouteTerrain(db, cam, box, allPatches);
}

export function landMaskRegion(db: any, cam: string, box: LandscapeBox): LandscapeRecord[] {
  return terrainRegion(db, cam, box, true).filter((r) => r.height || r.terrainSettings || r.mask);
}

export function writeTerrainHeight(db: any, cam: string, r: LandscapeRecord) {
  const records = landMaskRegion(db, cam, bounds(r));
  for (const tile of applyHeightArea(records, r))
    putLandscape(db, cam, tile, tile.revision || null);
}
