import {installSourceCellIndex} from './atlas-source-cell';
import {validateMapLabelStyle} from '../map-label-style';
import {terrainTraceMeasure} from '../terrain-timing';
import {readRouteTerrain,routeProposal} from './terrain-route';
import {validateRoute} from '../terrain-route';
import {validateVegetation} from '../vegetation';
import {eraseVegetation} from '../vegetation-erase';
import {computeTerrainStroke} from './terrain-scale';
import {applyHeightArea,resetHeightArea,decodeHeights,validateTerrain,settingsRecord} from '../terrain-height';
import {validateMask} from '../land-mask';
import {executeBrush} from "./landscape-brush-edit";
import { validateLine } from "../landscape-line";
import { validateColor } from "../landscape-brush";
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
 CREATE TABLE IF NOT EXISTS atlas_landscape_migration(campaign_id TEXT PRIMARY KEY REFERENCES campaign(id)) STRICT;
 `);
  installSourceCellIndex(db);
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
  const legacy=db.pragma('user_version',{simple:true})>=47?[]:db.prepare("SELECT campaign_id,payload FROM atlas_landscape WHERE json_extract(payload,'$.kind')='patch' AND json_extract(payload,'$.values.terrain') IS NOT NULL AND json_extract(payload,'$.maskManaged') IS NOT 1 AND json_extract(payload,'$.surface') IS NOT 'freshwater' ORDER BY CAST(json_extract(payload,'$.resolution') AS REAL) DESC,coalesce(json_extract(payload,'$.order'),0),rowid").all();
  for(const row of legacy){const r=JSON.parse(row.payload);writeTerrainHeight(db,row.campaign_id,r);r.maskManaged=true;db.prepare('UPDATE atlas_landscape SET payload=? WHERE campaign_id=? AND id=?').run(JSON.stringify(r),row.campaign_id,r.id);}
  // Polygon-era deltas cannot restore the new canonical raster. Establish a checkpoint.
  for(const cam of new Set(legacy.map((r:any)=>r.campaign_id))){db.prepare('DELETE FROM atlas_command WHERE campaign_id=?').run(cam);db.prepare('UPDATE campaign_atlas SET cursor=0,revision=revision+1 WHERE campaign_id=?').run(cam);}

}
const attemptedIndexes=new WeakSet<object>();
/** Rebuildable connection-local index; never exported or captured in author history. */
function installLandscapeIndex(db: any) {
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
  const settings=includePatches?db.prepare("SELECT payload FROM atlas_landscape WHERE campaign_id=? AND json_valid(payload) AND json_extract(payload,'$.terrainSettings') IS NOT NULL").get(cam):undefined;
  const records:LandscapeRecord[]=settings?[JSON.parse(settings.payload)]:[];let used=2;
  for(const r of statement.iterate(...parameters) as Iterable<any>){
    if(r.trashed||box&&!(r.max_x>=box.x&&r.min_x<=box.x+box.width&&r.max_y>=box.y&&r.min_y<=box.y+box.height))continue;
    const record=JSON.parse(r.payload);if(r.location_payload)record.name=JSON.parse(r.location_payload).name;
    if(!includePatches){used+=Buffer.byteLength(JSON.stringify(record))+1;if(used>REGION_REPLY_BYTES)throw new Error('Landschaftsobjekte überschreiten das Darstellungsbudget. Weiter hineinzoomen.');}
    if(!record.terrainSettings)records.push(record);
  }
  return records;
}
// Keep only four prepared programs per connection, never row values. Repeated
// tile writes otherwise allocate a new native SQLite program for every query;
// its memory is not reflected in V8's small JavaScript statement wrapper.
const writeStatements = new WeakMap<object, ReturnType<typeof prepareWrites>>();
function prepareWrites(db:any) {
  return {
    prior:db.prepare('SELECT revision,payload FROM atlas_landscape WHERE campaign_id=? AND id=?'),
    order:db.prepare("SELECT coalesce(max(json_extract(payload,'$.order')),0)+1 n FROM atlas_landscape WHERE campaign_id=? AND json_valid(payload)"),
    height:db.prepare("SELECT id FROM atlas_landscape WHERE campaign_id=? AND json_valid(payload) AND id!=? AND json_extract(payload,'$.height.x')=? AND json_extract(payload,'$.height.y')=? AND json_extract(payload,'$.height.pixel')=? AND json_extract(payload,'$.height.version')=?"),
    put:db.prepare('INSERT INTO atlas_landscape VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(campaign_id,id) DO UPDATE SET revision=excluded.revision,min_x=excluded.min_x,max_x=excluded.max_x,min_y=excluded.min_y,max_y=excluded.max_y,payload=excluded.payload'),
  };
}
function writes(db:any) {
  let statements=writeStatements.get(db);
  if(!statements){statements=prepareWrites(db);writeStatements.set(db,statements);}
  return statements;
}
export function putLandscape(
  db: any,
  cam: string,
  r: LandscapeRecord,
  expected: number | null,
) {
  if (
    !r ||
    !["patch", "river", "road", "reference", "place", "vegetation"].includes(r.kind) ||
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
  validateMapLabelStyle(r.label);
  validateVegetation(r);
  validateRoute(r);
  if(r.vegetationView)throw Error("Darstellungsdaten sind nicht schreibbar.");
  if(r.vegetation)for(const o of r.vegetation.overrides)if(o.locationId&&!db.prepare("SELECT 1 FROM location WHERE campaign_id=? AND id=? AND trashed=0").get(cam,o.locationId))throw Error("Verknüpfter Ort fehlt.");
  validateMask(r);
  validateTerrain(r);
  if(r.height&&writes(db).height.get(cam,r.id,r.height.x,r.height.y,r.height.pixel,r.height.version))throw Error('Doppelte Höhenkachel.');
  validateLine(r);
  validateColor(r);
  const pts = [
    ...r.points,
    ...r.polygons.flatMap((p) => [...p.outer, ...p.holes.flat()]),
  ];
  if (
    !pts.length ||
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
  const statements=writes(db),old=statements.prior.get(cam,r.id);
  if ((old?.revision ?? null) !== expected)
    throw new Error("Landschaft inzwischen geändert. Neu laden.");
  if(old){
    const prior:LandscapeRecord=JSON.parse(old.payload);
    if(prior.height&&(!r.height||prior.height.version!==r.height.version||prior.height.x!==r.height.x||prior.height.y!==r.height.y||prior.height.pixel!==r.height.pixel))throw Error('Höhenkacheladresse ist unveränderlich.');
  }
  const b = bounds(r),
    next = {
      ...r,
      ...(r.kind==='patch'&&r.values.terrain&&!r.propertyOnly&&!r.mask&&!r.height&&r.surface!=='freshwater'?{maskManaged:true}:{}),
      order:
        r.order ??
        statements.order.get(cam).n,
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
  if(r.kind==='patch'&&(r.values.elevationM!==undefined||r.values.terrain&&!r.propertyOnly)&&!r.mask&&!r.height&&r.surface!=='freshwater'){
    const prior=old?JSON.parse(old.payload):null,moved=prior&&JSON.stringify(prior.polygons)!==JSON.stringify(r.polygons);
    if(moved&&prior.values.terrain)writeTerrainHeight(db,cam,{...prior,values:{terrain:'water'}});
    if(!prior||moved||prior.values.terrain!==r.values.terrain||prior.values.elevationM!==r.values.elevationM)writeTerrainHeight(db,cam,r);
  }
}
/** Read-only author data for previews/point queries; never installs TEMP indexes or changes a source fence. */
export function terrainRegion(db:any,cam:string,box:LandscapeBox,allPatches=false):LandscapeRecord[]{
  return readRouteTerrain(db,cam,box,allPatches);
}
export function landMaskRegion(db:any,cam:string,box:LandscapeBox):LandscapeRecord[]{
  return terrainRegion(db,cam,box,true).filter(r=>r.height||r.terrainSettings||r.mask);
}
function writeTerrainHeight(db:any,cam:string,r:LandscapeRecord){
  const records=landMaskRegion(db,cam,bounds(r));
  for(const tile of applyHeightArea(records,r))putLandscape(db,cam,tile,tile.revision||null);
}
export function executeLandscape(db: any, cam: string, a: LandscapeAction, liveColorRevision:number|null=null,visibilityGrid?:import('../terrain-spatial-model').TerrainGrid,prepared?:import('./terrain-scale').PreparedTerrainStroke) {
  if(a.kind==='landscape-route'){
    if(db.prepare('SELECT revision FROM campaign_atlas WHERE campaign_id=?').get(cam).revision!==a.sourceRevision)throw Error('Gelände inzwischen geändert. Vorschau erneut berechnen.');
    const proposal=routeProposal(db,cam,a.record);
    for(const r of proposal.records)if(r.route&&(r.id===a.record.id||JSON.stringify(r)!==db.prepare('SELECT payload FROM atlas_landscape WHERE campaign_id=? AND id=?').get(cam,r.id)?.payload))putLandscape(db,cam,r,r.id===a.record.id?a.expectedRevision:r.revision);
    return;
  }
  if((a.kind==='landscape-put'||a.kind==='landscape-place')&&a.record.route||a.kind==='landscape-batch'&&a.records.some(x=>x.record.route))throw Error('Geplante Verläufe mit Vorschau im Verlaufseditor bearbeiten.');
  if(a.kind==='landscape-vegetation-edit'){
    if(
      !['clear','thin','dense','erase'].includes(a.mode)||
      !Array.isArray(a.polygons)||!a.polygons.length||a.polygons.length>1000||
      a.polygons.some(p=>
        !p||!Array.isArray(p.outer)||p.outer.length<3||!Array.isArray(p.holes)||
        [p.outer,...p.holes].some(r=>
          !Array.isArray(r)||r.length<3||
          r.some(v=>!v||!Number.isFinite(v.x)||!Number.isFinite(v.y))))
    )throw Error('Bestandskorrektur prüfen.');
    const area=bounds({id:'',revision:0,name:'',kind:'vegetation',points:[],polygons:a.polygons,width:0,resolution:1,values:{}});
    if(!Object.values(area).every(Number.isFinite))throw Error('Bestandskorrektur prüfen.');
    const records=landscapeRegion(db,cam,area).filter(r=>r.vegetation);
    if(!records.length&&a.mode!=='erase')throw Error('Hier liegt keine Bewuchsfläche. Zuerst eine Landschaft malen.');
    for(const record of records){
      if(a.mode==='erase'){
        const remaining=eraseVegetation(record,a.polygons);
        if(!remaining)db.prepare('DELETE FROM atlas_landscape WHERE campaign_id=? AND id=?').run(cam,record.id);
        else if(remaining!==record)putLandscape(db,cam,remaining,record.revision);
      }else{
        record.vegetation!.edits.push({polygons:a.polygons,mode:a.mode});
        putLandscape(db,cam,record,record.revision);
      }
    }
    return;
  }

  if(a.kind==='landscape-sea-level'||a.kind==='landscape-terrain-style'){
    const old=db.prepare("SELECT payload FROM atlas_landscape WHERE campaign_id=? AND json_valid(payload) AND json_extract(payload,'$.terrainSettings') IS NOT NULL").get(cam);
    const record:LandscapeRecord=old?JSON.parse(old.payload):settingsRecord(0);
    if(a.kind==='landscape-sea-level')record.terrainSettings!.seaLevelM=a.seaLevelM;
    else record.terrainSettings!.style=a.style;
    return putLandscape(db,cam,record,old?record.revision:null);
  }
  if(a.kind==='landscape-height-stroke'){
    const edited=prepared?.records??terrainTraceMeasure("author.brush",()=>computeTerrainStroke(db,cam,a.stroke,undefined,visibilityGrid));
    for(const tile of edited)putLandscape(db,cam,tile,tile.revision||null);
    return;
  }
  if(a.kind==='landscape-land-stroke'){
    if(!a.stroke||Object.keys(a).some(k=>!['kind','stroke'].includes(k))||Object.keys(a.stroke).some(k=>!['mode','radius','roughness','seed','samples'].includes(k)))throw Error('Landauftrag prüfen.');
    return executeBrush(db,cam,{kind:'landscape-brush',record:{} as LandscapeRecord,...a.stroke,fill:false});
  }
  if(a.kind==='landscape-color-stroke'){
    const p=a.record?.paint;
    if(!p||p.version!==2||a.record.propertyOnly||a.record.mask||a.record.surface||Object.keys(a.record.values).length)throw Error('Farbauftrag prüfen.');
    return executeBrush(db,cam,{kind:'landscape-brush',record:a.record,mode:p.operation==='erase'?'color-erase':p.target==='water'?'water-color':'ground-color',radius:p.radius,roughness:0,seed:p.seed,fill:p.fill},liveColorRevision,visibilityGrid);
  }
  if(a.kind==="landscape-brush")return executeBrush(db,cam,a);
  if((a.kind==='landscape-put'||a.kind==='landscape-place')&&(a.record.mask||a.record.terrainSettings)||a.kind==='landscape-batch'&&a.records.some(x=>x.record.mask||x.record.terrainSettings))throw Error('Landmasken sind nicht mehr schreibbar. Landwerkzeug verwenden.');
  if (a.kind === "landscape-batch") {
    for(const r of a.remove??[])executeLandscape(db,cam,{kind:"landscape-remove",...r});
    for (const r of a.records)
      putLandscape(db, cam, r.record, r.expectedRevision);
    return;
  }
  if (a.kind === "landscape-put" || a.kind === "landscape-place")
    return putLandscape(db, cam, a.record, a.expectedRevision);
  if (a.kind === "landscape-remove") {
    for(const row of db.prepare("SELECT payload FROM atlas_landscape WHERE campaign_id=? AND json_extract(payload,'$.route.mouth.id')=?").all(cam,a.id)){
      const dependent=JSON.parse(row.payload);delete dependent.route.mouth;dependent.route.conflict='Mündungsanschluss gelöscht. Mündung neu verbinden.';putLandscape(db,cam,dependent,dependent.revision);
    }
    const row=db.prepare('SELECT payload FROM atlas_landscape WHERE campaign_id=? AND id=? AND revision=?').get(cam,a.id,a.expectedRevision);
    if(row){const r=JSON.parse(row.payload);if(r.mask||r.height||r.terrainSettings)throw Error('Gelände mit den Landschaftswerkzeugen bearbeiten.');if(r.kind==='patch'&&r.values.terrain&&!r.propertyOnly&&r.surface!=='freshwater')writeTerrainHeight(db,cam,{...r,values:{terrain:'water'}});}

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
  if(a.field==='elevationM')for(const tile of resetHeightArea(records,a.polygons,a.resolution)){
    if(decodeHeights(tile.height!).every(Number.isNaN))db.prepare('DELETE FROM atlas_landscape WHERE campaign_id=? AND id=?').run(cam,tile.id);
    else putLandscape(db,cam,tile,tile.revision);
  }
  if(a.field==='terrain'&&!a.propertyOnly)writeTerrainHeight(db,cam,{id:'reset',revision:0,name:'',kind:'patch',width:0,resolution:a.resolution,points:[],polygons:a.polygons,values:{terrain:'water'}});
  for (const r of records) {
    if (
      r.kind !== "patch" ||
      (a.propertyOnly===true && r.propertyOnly!==true) ||
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
