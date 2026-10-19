import {validateTerritory,validateLayer,territoryBox} from '../atlas-territory';
import {REGION_REPLY_BYTES} from '../atlas-region-contracts';
import { createHash, randomUUID } from "node:crypto";
import polygonClipping from "polygon-clipping";
import type { Polygon } from "../contracts";
import {
  bounds,
  hexPolygon,
  HEX_METERS,
  terrainValue,
  type LandscapeRecord,
  type LandscapeBox,
  type LandscapeAction,
} from "../atlas-landscape";
const hash = (s: string) => createHash("sha256").update(s).digest("hex");
const clip = (polys: Polygon[]) =>
  polys.map((p) =>
    [p.outer, ...p.holes].map((r) =>
      r.map((p) => [p.x, p.y] as [number, number]),
    ),
  );
const unclip = (a: ReturnType<typeof polygonClipping.difference>): Polygon[] =>
  a.map((p) => ({
    outer: p[0]!.map(([x, y]) => ({ x, y })),
    holes: p.slice(1).map((r) => r.map(([x, y]) => ({ x, y }))),
  }));
export function installLandscape(db: any) {
  db.exec(`
 CREATE TABLE IF NOT EXISTS atlas_landscape(campaign_id TEXT NOT NULL REFERENCES campaign(id),id TEXT NOT NULL,revision INTEGER NOT NULL,min_x REAL NOT NULL,max_x REAL NOT NULL,min_y REAL NOT NULL,max_y REAL NOT NULL,payload TEXT NOT NULL,PRIMARY KEY(campaign_id,id)) STRICT;
 CREATE INDEX IF NOT EXISTS landscape_area ON atlas_landscape(campaign_id,min_x,max_x,min_y,max_y);
 CREATE TABLE IF NOT EXISTS atlas_reference_asset(campaign_id TEXT NOT NULL REFERENCES campaign(id),id TEXT NOT NULL,mime TEXT NOT NULL,bytes BLOB NOT NULL,PRIMARY KEY(campaign_id,id)) STRICT;
 CREATE TABLE IF NOT EXISTS atlas_landscape_migration(campaign_id TEXT PRIMARY KEY REFERENCES campaign(id)) STRICT;
 `);
  for (const root of db
    .prepare(
      "SELECT * FROM campaign_atlas WHERE campaign_id NOT IN(SELECT campaign_id FROM atlas_landscape_migration)",
    )
    .all()) {
    const row = db
      .prepare(
        "SELECT * FROM world_record WHERE campaign_id=? AND kind='map' AND id=?",
      )
      .get(root.campaign_id, root.map_id);
    if (!row) continue;
    const map = JSON.parse(row.payload);
    const hadCells = map.cells.length > 0;
    for (const c of map.cells) {
      const { q, r, level, ...values } = c;
      putLandscape(
        db,
        root.campaign_id,
        {
          id: randomUUID(),
          revision: 0,
          kind: "patch",
          name: "Übernommenes Gelände",
          points: [],
          polygons: [hexPolygon(q, r, map.hexMeters * (map.metricVersion===2?3:2) ** level)],
          resolution: map.hexMeters * (map.metricVersion===2?3:2) ** level,
          width: 0,
          values,
        },
        null,
      );
    }
    for (const place of db
      .prepare(
        "SELECT a.*,l.payload FROM atlas_place a JOIN location l ON l.campaign_id=a.campaign_id AND l.id=a.location_id WHERE a.campaign_id=? AND a.map_id=? AND l.trashed=0 AND NOT EXISTS(SELECT 1 FROM city_document c WHERE c.campaign_id=a.campaign_id AND c.location_id=a.location_id)",
      )
      .all(root.campaign_id, root.map_id)) {
      if (
        db
          .prepare(
            "SELECT 1 FROM atlas_landscape WHERE campaign_id=? AND json_extract(payload,'$.locationId')=?",
          )
          .get(root.campaign_id, place.location_id)
      )
        continue;
      putLandscape(
        db,
        root.campaign_id,
        {
          id: randomUUID(),
          revision: 0,
          kind: "place",
          name: JSON.parse(place.payload).name,
          points: [
            {
              x: (place.q + place.r / 2) * map.hexMeters,
              y: ((place.r * Math.sqrt(3)) / 2) * map.hexMeters,
            },
          ],
          polygons: [],
          resolution: HEX_METERS,
          width: 0,
          values: {},
          locationId: place.location_id,
        },
        null,
      );
    }
    if (map.hexMeters !== HEX_METERS)
      for (const row of db
        .prepare("SELECT * FROM scene_position WHERE campaign_id=?")
        .all(root.campaign_id)) {
        const p = JSON.parse(row.payload);
        if (p.mapId !== root.map_id || p.outdoor || p.city || p.dungeon)
          continue;
        p.outdoor = {
          x: (p.q + p.r / 2) * map.hexMeters,
          y: ((p.r * Math.sqrt(3)) / 2) * map.hexMeters,
        };
        const payload = JSON.stringify(p);
        db.prepare(
          "UPDATE scene_position SET payload=?,checksum=? WHERE campaign_id=? AND scene_id=?",
        ).run(payload, hash(payload), root.campaign_id, row.scene_id);
      }
    // Preserve exact old footprints. A new grid never resamples existing author work.
    map.cells = [];
    map.hexMeters = HEX_METERS;
    map.metricVersion = 2;
    const payload = JSON.stringify(map);
    db.prepare(
      "UPDATE world_record SET payload=?,checksum=? WHERE campaign_id=? AND kind='map' AND id=?",
    ).run(payload, hash(payload), root.campaign_id, root.map_id);
    if (hadCells) {
      db.prepare("DELETE FROM atlas_command WHERE campaign_id=?").run(
        root.campaign_id,
      );
      db.prepare("UPDATE campaign_atlas SET cursor=0 WHERE campaign_id=?").run(
        root.campaign_id,
      );
    }
    db.prepare("INSERT INTO atlas_landscape_migration VALUES(?)").run(
      root.campaign_id,
    );
  }
}
const attemptedIndexes=new WeakSet<object>();
/** Rebuildable connection-local index; never exported or captured in author history. */
export function installLandscapeIndex(db: any) {
  attemptedIndexes.add(db);
  // Separate point/line/image candidates keep a world overview from scanning
  // every fine patch just to exclude it before requesting its display raster.
  try { db.transaction(()=>{
  for(const [name,objects] of [['atlas_landscape_area',false],['atlas_landscape_objects',true]] as const){
    const condition=objects?"CASE WHEN json_valid(payload) THEN json_extract(payload,'$.kind')!='patch' ELSE 1 END":"1";
    const next=objects?"CASE WHEN json_valid(new.payload) THEN json_extract(new.payload,'$.kind')!='patch' ELSE 1 END":"1";
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
  })();return true;
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
  metersPerPixel=0,
  includePatches=true,
): LandscapeRecord[] {
  if (
    box &&
    (!Object.values(box).every(Number.isFinite) ||
      box.width <= 0 ||
      box.height <= 0 || !Number.isFinite(box.x+box.width) || !Number.isFinite(box.y+box.height))
  )
    throw new Error("Ausschnitt prüfen.");
  if(!Number.isFinite(metersPerPixel)||metersPerPixel<0)throw new Error('Darstellungsmaßstab prüfen.');
  if(typeof includePatches!=='boolean')throw new Error('Darstellungsfilter prüfen.');
  if(box&&!attemptedIndexes.has(db))installLandscapeIndex(db);
  const areaTable=includePatches?'atlas_landscape_area':'atlas_landscape_objects';
  const indexed = box && db.prepare("SELECT 1 FROM sqlite_temp_master WHERE name='atlas_landscape_area'").get();
  const select =
    "SELECT a.payload,a.min_x,a.max_x,a.min_y,a.max_y,l.payload location_payload,l.trashed FROM " +
    (indexed ? areaTable+" s CROSS JOIN main.atlas_landscape a ON a.rowid=s.id" : "atlas_landscape a") +
    " LEFT JOIN location l ON l.campaign_id=a.campaign_id AND l.id=json_extract(a.payload,'$.locationId') WHERE a.campaign_id=?" + (includePatches ? "" : " AND json_extract(a.payload,'$.kind')!='patch'");
  const statement=db.prepare(select+(box
    ? ` AND ${indexed ? 's' : 'a'}.max_x>=? AND ${indexed ? 's' : 'a'}.min_x<=? AND ${indexed ? 's' : 'a'}.max_y>=? AND ${indexed ? 's' : 'a'}.min_y<=? AND ((a.max_x=a.min_x AND a.max_y=a.min_y) OR a.max_x-a.min_x>=? OR a.max_y-a.min_y>=?) ORDER BY a.rowid`
    : " ORDER BY a.rowid"));
  const parameters=box?[cam,box.x,box.x+box.width,box.y,box.y+box.height,metersPerPixel/2,metersPerPixel/2]:[cam];
  const records:LandscapeRecord[]=[];let used=2;
  for(const r of statement.iterate(...parameters) as Iterable<any>){
    if(r.trashed||box&&!(r.max_x>=box.x&&r.min_x<=box.x+box.width&&r.max_y>=box.y&&r.min_y<=box.y+box.height))continue;
    const record=JSON.parse(r.payload);if(r.location_payload)record.name=JSON.parse(r.location_payload).name;
    if(!includePatches){used+=Buffer.byteLength(JSON.stringify(record))+1;if(used>REGION_REPLY_BYTES)throw new Error('Landschaftsobjekte überschreiten das Darstellungsbudget. Weiter hineinzoomen.');}
    records.push(record);
  }
  return records;
}
export function putLandscape(
  db: any,
  cam: string,
  r: LandscapeRecord,
  expected: number | null,
) {
  if (
    !r ||
    !["patch", "river", "road", "reference", "place", "territory", "region-layer"].includes(r.kind) ||
    typeof r.id !== "string" ||
    !r.id ||
    typeof r.name !== "string" ||
    !Array.isArray(r.points) ||
    !Array.isArray(r.polygons) ||
    !Number.isFinite(r.width) ||
    r.width < 0 ||
    !Number.isFinite(r.resolution) ||
    r.resolution <= 0 ||
    !r.values
  )
    throw new Error("Landschaftsdaten prüfen.");
  const pts = [
    ...r.points,
    ...r.polygons.flatMap((p) => [...p.outer, ...p.holes.flat()]),
  ];
  if (
    (!pts.length && r.kind!=="territory") ||
    pts.length > 100000 ||
    pts.some((p) => !Number.isFinite(p.x) || !Number.isFinite(p.y))
  )
    throw new Error("Landschaftsgeometrie prüfen.");
  if (
    (r.kind === "river" || r.kind === "road") &&
    (r.points.length < 2 || r.width <= 0)
  )
    throw new Error("Verlauf braucht zwei Punkte und positive Breite.");
  if (
    r.kind === "patch" &&
    (!r.polygons.length || r.polygons.some((p) => p.outer.length < 3))
  )
    throw new Error("Geländefläche fehlt.");
  if (
    r.values.elevationM !== undefined &&
    !Number.isFinite(r.values.elevationM)
  )
    throw new Error("Höhenwert prüfen.");
  if (
    r.values.climate !== undefined &&
    r.values.climate !== null &&
    !["temperate", "cold", "arid", "tropical"].includes(r.values.climate)
  )
    throw new Error("Klima: temperate, cold, arid oder tropical.");
  if (r.values.terrain !== undefined && !terrainValue(r.values.terrain))
    throw new Error("Geländeart prüfen.");
  if (
    r.kind === "reference" &&
    (!r.assetId ||
      !db
        .prepare(
          "SELECT 1 FROM atlas_reference_asset WHERE campaign_id=? AND id=?",
        )
        .get(cam, r.assetId) ||
      r.width <= 0 ||
      !Number.isFinite(r.angle) ||
      !Number.isFinite(r.opacity) ||
      r.opacity! < 0 ||
      r.opacity! > 1)
  )
    throw new Error("Bildkalibrierung prüfen.");
  const old = db
    .prepare(
      "SELECT revision FROM atlas_landscape WHERE campaign_id=? AND id=?",
    )
    .get(cam, r.id);
  if ((old?.revision ?? null) !== expected)
    throw new Error("Landschaft inzwischen geändert. Neu laden.");
  if(r.kind==="territory")validateTerritory(r);
  if(r.kind==="region-layer")validateLayer(r.regionLayer!);
  const b = r.kind==="territory"?territoryBox(r):bounds(r),
    next = {
      ...r,
      order:
        r.order ??
        db
          .prepare(
            "SELECT coalesce(max(json_extract(payload,'$.order')),0)+1 n FROM atlas_landscape WHERE campaign_id=?",
          )
          .get(cam).n,
      revision: (expected ?? 0) + 1,
    };
  if(r.territory?.label.position&&r.polygons.length){const p=r.territory.label.position,right=Math.max(b.x+b.width,p.x),bottom=Math.max(b.y+b.height,p.y);b.x=Math.min(b.x,p.x);b.y=Math.min(b.y,p.y);b.width=right-b.x;b.height=bottom-b.y;}
  db.prepare(
    "INSERT INTO atlas_landscape VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(campaign_id,id) DO UPDATE SET revision=excluded.revision,min_x=excluded.min_x,max_x=excluded.max_x,min_y=excluded.min_y,max_y=excluded.max_y,payload=excluded.payload",
  ).run(
    cam,
    r.id,
    next.revision,
    b.x,
    b.x + b.width,
    b.y,
    b.y + b.height,
    JSON.stringify(next),
  );
}
export function executeLandscape(db: any, cam: string, a: Exclude<LandscapeAction,{kind:"landscape-territory"|"landscape-region-layer"|"landscape-territory-delete"}>) {
  const protectedId=(id:string)=>["territory","region-layer"].includes(db.prepare("SELECT json_extract(payload,'$.kind') kind FROM atlas_landscape WHERE campaign_id=? AND id=?").get(cam,id)?.kind);
  if(a.kind==="landscape-remove"?protectedId(a.id):a.kind==="landscape-batch"?a.records.some(x=>["territory","region-layer"].includes(x.record.kind)||protectedId(x.record.id)):a.kind!=="landscape-reset"&&(["territory","region-layer"].includes(a.record.kind)||protectedId(a.record.id)))throw Error("Regionen nur über das Regionswerkzeug ändern.");
  if (a.kind === "landscape-batch") {
    for (const r of a.records)
      putLandscape(db, cam, r.record, r.expectedRevision);
    return;
  }
  if (a.kind === "landscape-put" || a.kind === "landscape-place")
    return putLandscape(db, cam, a.record, a.expectedRevision);
  if (a.kind === "landscape-remove") {
    if (
      db
        .prepare(
          "DELETE FROM atlas_landscape WHERE campaign_id=? AND id=? AND revision=?",
        )
        .run(cam, a.id, a.expectedRevision).changes !== 1
    )
      throw new Error("Landschaft inzwischen geändert.");
    return;
  }
  if (
    ![
      "terrain",
      "elevationM",
      "climate",
      "road",
      "river",
      "label",
      "faction",
      "interrupt",
      "access",
    ].includes(a.field) ||
    !Number.isFinite(a.resolution) ||
    a.resolution <= 0
  )
    throw new Error("Zurücksetzbereich prüfen.");
  const records = landscapeRegion(
    db,
    cam,
    bounds({
      points: [],
      polygons: a.polygons,
      kind: "patch",
      width: 0,
    } as any),
  );
  for (const r of records) {
    if (
      r.kind !== "patch" ||
      r.resolution > a.resolution ||
      r.resolution <= a.resolution / 3 ||
      !Object.hasOwn(r.values, a.field)
    )
      continue;
    const outside = unclip(
        polygonClipping.difference(clip(r.polygons), clip(a.polygons)),
      ),
      inside = unclip(
        polygonClipping.intersection(clip(r.polygons), clip(a.polygons)),
      );
    if (!inside.length) continue;
    db.prepare("DELETE FROM atlas_landscape WHERE campaign_id=? AND id=?").run(
      cam,
      r.id,
    );
    if (outside.length)
      putLandscape(db, cam, { ...r, polygons: outside }, null);
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
