import {AtlasGeometryRaster} from './atlas-geometry-raster';
import {AtlasReadCancelled,atlasReadCheckpoint} from './atlas-read-cancellation';
import {AtlasDeferredGeometry} from './atlas-deferred-geometry';
import {atlasProjectionSource} from './atlas-shape-source';
import {AtlasProjectionIndex} from './atlas-projection-index';
import {mapExtentVisible} from '../atlas-scale-policy';
import {labelFromPolygon,lineLabels,boundedLabels,styledLabels,territoryLabels,labelScaleLimits,type MapLabelCandidate} from '../atlas-cartography';
import {readTerritories} from './atlas-territories';
import {validateTerrainDetail} from '../terrain-detail';
import {TerrainCache} from '../terrain-cache';
import {terrainFrameDelta,terrainFrameBytes,type TerrainFullFrame,type TerrainFrameIdentity} from '../terrain-frame';
import {AtlasLandscapeReader} from './atlas-landscape-region';
import {roomMapStyle} from './drawing';
import {readDungeonVolume} from './volume';
import {dungeonContentAnchor} from '../dungeon-content-model';
import {readCityHeader,checkedUnit} from './city';
import {validateDrawingElement} from '../drawing-contracts';
import {createHash} from 'node:crypto';
import {PNG} from 'pngjs';
import type {AtlasRegionSource,AtlasRegionQuery,AtlasRegionGeometry,AtlasObjectFocus,AtlasHit,AtlasHitPage} from '../atlas-region-contracts';
import {REGION_REPLY_BYTES,REGION_VECTOR_OBJECTS,emptyDrawing,validateRegion} from '../atlas-region-contracts';
import type {Point,Polygon,RoomGeometry} from '../contracts';
import {validateRoom} from '../contracts';
import {posedFootprint,roadPoints} from '../city-model';
import {anchored,inside} from '../drawing-model';
import {volumeProjection} from '../volume-model';
import {LandscapeRasterizer} from '../landscape-raster';
import type {AtlasBinding} from '../campaign-atlas-contracts';
import type {CityHeader} from '../city-contracts';
const digest=(s:string)=>createHash('sha256').update(s).digest('hex');
const parse=(r:any)=>{if(!r||digest(r.payload)!==r.checksum)throw new Error('Kartendaten beschädigt. Originaldaten bleiben erhalten.');return JSON.parse(r.payload);};
type Box={x:number;y:number;width:number;height:number};
type Frame={x:number;y:number;angle:number};
type BindingDetail={extent?:Box;scope?:{id:string;name:string}};
type Shape={value:any;style?:ReturnType<typeof roomMapStyle>;polygons?:Polygon[];points?:Point[];stroke?:number};
const bounds=(points:Iterable<Point>,pad=0):Box=>{let x=Infinity,y=Infinity,xx=-Infinity,yy=-Infinity;for(const p of points){if(!Number.isFinite(p.x+p.y))throw new Error('Kontur prüfen.');x=Math.min(x,p.x);xx=Math.max(xx,p.x);y=Math.min(y,p.y);yy=Math.max(yy,p.y);}return{x:x-pad,y:y-pad,width:xx-x+pad*2,height:yy-y+pad*2};};
const corners=(b:Box)=>[{x:b.x,y:b.y},{x:b.x+b.width,y:b.y},{x:b.x+b.width,y:b.y+b.height},{x:b.x,y:b.y+b.height}];
const at=(p:Point,f:Frame):Point=>({x:f.x+p.x*Math.cos(f.angle)-p.y*Math.sin(f.angle),y:f.y+p.x*Math.sin(f.angle)+p.y*Math.cos(f.angle)});
const inverse=(p:Point,f:Frame):Point=>({x:(p.x-f.x)*Math.cos(f.angle)+(p.y-f.y)*Math.sin(f.angle),y:-(p.x-f.x)*Math.sin(f.angle)+(p.y-f.y)*Math.cos(f.angle)});
const overlap=(a:Box,b:Box)=>a.x<=b.x+b.width&&a.x+a.width>=b.x&&a.y<=b.y+b.height&&a.y+a.height>=b.y;
const distance=(p:Point,a:Point,b:Point)=>{const dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1)));return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy);};
// Authored object footprints match elementPaint, independent of detail/raster display.
// The index's generous stroke bounds supply candidates, never the exact answer.
const touches=(s:Shape,p:Point,mpp:number)=>{
 if(['terrain','water','roof'].includes(s.value.kind)&&s.points)return inside(p,[{outer:s.points,holes:[]}]);
 if(s.value.kind==='door'&&s.points?.length){const a=s.points[0]!,b=s.points[1]??a;if(Math.hypot(p.x-(a.x+b.x)/2,p.y-(a.y+b.y)/2)<=Math.max(.15,mpp*3))return true;}
 if(['wall','door','path','stairs'].includes(s.value.kind)&&s.points&&s.points.length>1)return s.points.some((v,i,a)=>i>0&&distance(p,a[i-1]!,v)<=Math.max(s.value.kind==='door'?.11:s.value.width/2,mpp*3));
 if(s.value.kind==='object'&&s.points?.length===1){
  const e=s.value,a=s.points[0]!,dx=p.x-a.x,dy=p.y-a.y;
  if(e.variant==='barrel'||e.variant==='pillar')return (dx/(e.width/2))**2+(dy/(e.height/2))**2<=1;
  const angle=e.angle*Math.PI/180,x=dx*Math.cos(angle)+dy*Math.sin(angle),y=-dx*Math.sin(angle)+dy*Math.cos(angle);
  return Math.abs(x)<=e.width/2&&Math.abs(y)<=e.height/2;
 }
 return s.polygons?inside(p,s.polygons):!!s.points?.some((v,i,a)=>i?distance(p,a[i-1]!,v)<=Math.max((s.stroke??0)/2,mpp*3):a.length===1&&Math.hypot(p.x-v.x,p.y-v.y)<=mpp*8);
};
const bytes=(v:unknown)=>Buffer.byteLength(JSON.stringify(v));
const pause=()=>new Promise<void>(resolve=>setImmediate(resolve));
/** Rebuildable TEMP projections on a readonly source connection. No author data is written. */
export class AtlasRegionReader {
 private terrainBases=new TerrainCache<TerrainFullFrame>(8*1024*1024);
 // Only nearby derived shapes are retained; the full-world index holds bounds.
 private shapePayloads=new TerrainCache<string>(4*1024*1024);
 private buildingIndex=false;
 private geometryChanges=new AtlasDeferredGeometry();
 private statements=new Map<string,any>();
 private landscape:AtlasLandscapeReader;
 private projection:AtlasProjectionIndex;
 private landscapeFailure=false;
 private landscapeSyncChanged=true;
 private sql(text:string){let s=this.statements.get(text);if(!s){s=this.db.prepare(this.projection.readSql(text));this.statements.set(text,s);}return s;}
 private meta(text:string){return this.projection.prepare(text);}
 private readFaults=0;private countFaults=true;private ready=false;private indexed=true;private campaign='';private count=0;
 constructor(private db:any,shadow?:{filename:string;scopeId:string},projection?:AtlasProjectionIndex){
  if(!db.readonly)throw new Error('Atlasprojektion benötigt eine readonly Datenbank.');
  this.projection=projection??AtlasProjectionIndex.temporary(db);
  this.landscape=new AtlasLandscapeReader(db,8*1024*1024,this.projection);
  if(shadow){
   db.prepare('ATTACH DATABASE ? AS graph_preview').run(shadow.filename);
   const scope="'"+shadow.scopeId.replaceAll("'","''")+"'";
   // Scope-only overlays preserve canonical City/world tables and other Dungeons.
   for(const table of ['room','drawing_element','drawing_profile','drawing_hidden','drawing_floor','dungeon_volume','dungeon_key_content'])db.exec(`CREATE TEMP VIEW ${table} AS SELECT rowid AS rowid,* FROM main.${table} WHERE scope_id<>${scope} UNION ALL SELECT (SELECT coalesce(max(rowid),0) FROM main.${table})+rowid AS rowid,* FROM graph_preview.${table}`);
  }
  if(this.projection.init(`CREATE TEMP TABLE region_shape(key TEXT PRIMARY KEY,kind TEXT NOT NULL,owner TEXT NOT NULL,scope TEXT NOT NULL,floor TEXT NOT NULL,source_order INTEGER NOT NULL,min_x REAL,max_x REAL,min_y REAL,max_y REAL,paint_order INTEGER NOT NULL);
   CREATE INDEX temp.region_shape_owner ON region_shape(kind,owner,scope,floor);
   CREATE TEMP TABLE region_problem(key TEXT PRIMARY KEY,id TEXT NOT NULL);
   CREATE TEMP TABLE region_extent(scope TEXT,floor TEXT,x REAL,y REAL,width REAL,height REAL,PRIMARY KEY(scope,floor));
   CREATE TEMP TABLE region_hidden(kind TEXT,id TEXT,scope TEXT,PRIMARY KEY(kind,id,scope)) WITHOUT ROWID;`))this.projection.forget('geometry');
  try{if(this.projection.init('CREATE VIRTUAL TABLE temp.region_index USING rtree(id,min_x,max_x,min_y,max_y)'))this.projection.forget('geometry');}catch{this.indexed=false;}
 }
 terrainVisibility(source:AtlasRegionSource,view:import('../terrain-spatial-model').TerrainView){if(this.landscapeFailure)throw Error('Geländequelle konnte nicht gelesen werden.');return this.landscape.visibility(source,view);}
 /** Navigation resumes after the gesture; its new overview/fine tiles need the
  * full cache again. Live frames below deliberately bypass this handoff. */
 private navigationTerrain(){if(this.landscapeFailure)throw Error('Geländequelle konnte nicht gelesen werden.');this.landscape.projectionCache.tiles.clearRetained();return this.landscape;}
 terrain(source:AtlasRegionSource,q:import('../terrain-projection').TerrainProjectionRequest){return this.navigationTerrain().terrain(source,q);}
 colorSteps(source:AtlasRegionSource,q:import('../terrain-color').TerrainColorRequest){return this.navigationTerrain().colorSteps(source,q);}
 terrainSteps(source:AtlasRegionSource,q:import('../terrain-projection').TerrainProjectionRequest){return this.navigationTerrain().terrainSteps(source,q);}
 liveTerrain(source:AtlasRegionSource,q:import('../terrain-presentation').TerrainFrameQuery,base?:TerrainFrameIdentity):import('../terrain-presentation').TerrainFrame{
  const steps=this.liveTerrainSteps(source,q,base,false);for(;;){const step=steps.next();if(step.done)return step.value;}
 }
 *liveTerrainSteps(source:AtlasRegionSource,q:import('../terrain-presentation').TerrainFrameQuery,base?:TerrainFrameIdentity,cooperative=true):Generator<void,import('../terrain-presentation').TerrainFrame>{
  if(this.landscapeFailure)throw Error('Geländequelle konnte nicht gelesen werden.');
  const query=q.kind==='tilted'?{...q.query,revision:undefined,fence:undefined,colorBase:undefined,view:{...q.query.view,focusM:0}}:q.query;
  if(q.kind==='top')validateTerrainDetail(q.detail,q.query.box);
  const key=digest(JSON.stringify([source.campaignId,q.kind,query,q.kind==='top'?q.detail:undefined])),previous=this.terrainBases.get(key);
  const common={kind:'full' as const,target:{revision:source.revision,fence:source.fence,key},invalidation:this.landscape.invalidation};
  const full:TerrainFullFrame=q.kind==='top'?{...common,view:'top',layer:this.landscape.read(source,q.query,q.detail?REGION_REPLY_BYTES*3/4:REGION_REPLY_BYTES)}:
   {...common,view:'tilted',projection:cooperative?yield* this.landscape.terrainSteps(source,{...q.query,revision:source.revision,fence:source.fence}):this.landscape.terrain(source,{...q.query,revision:source.revision,fence:source.fence})};
  if(q.kind==='top'&&q.detail&&full.view==='top'){
   const detail=this.landscape.read(source,{...q.query,box:q.detail,width:256,height:256},REGION_REPLY_BYTES/4,true);
   if(detail.state!=='ready')throw Error(detail.error??'Geländedetail nicht verfügbar.');
   full.layer={...full.layer,tiles:[...full.layer.tiles,...detail.tiles.filter(t=>!full.layer.tiles.some(b=>JSON.stringify(b.box)===JSON.stringify(t.box)&&b.width>=t.width))]};
  }
  const result=terrainFrameDelta(previous,full,base),box=q.kind==='top'?q.query.box:q.query.view.box;
  this.terrainBases.put(key,box,full,terrainFrameBytes(full));return result;
 }
 private source(table:string,id:string){return this.sql(`SELECT rowid sourceOrder,* FROM ${table} WHERE campaign_id=? AND id=?`).get(this.campaign,id);}
 private store(kind:string,owner:string,scope:string,floor:string,id:string,value:Shape,sourceOrder:number){
  const pts=value.polygons?.flatMap(p=>[p.outer,...p.holes].flat())??value.points??[],b=bounds(pts,(value.stroke??0)/2);
  if(!Number.isFinite(b.x+b.y+b.width+b.height))return;
  const key=kind+':'+id,order=kind==='unit'?(value.value.kind==='building'?2:['road','wall'].includes(value.value.kind)?1:0):0;
  this.meta('INSERT INTO temp.region_shape VALUES(?,?,?,?,?,?,?,?,?,?,?)').run(key,kind,owner,scope,floor,sourceOrder,b.x,b.x+b.width,b.y,b.y+b.height,order);
  if(this.indexed&&!this.buildingIndex)this.meta('INSERT INTO temp.region_index SELECT rowid,min_x,max_x,min_y,max_y FROM temp.region_shape WHERE key=?').run(key);
 }
 private project(table:string,row:any){
  const shape=this.materialize(table,row);if(!shape)return;
  this.store(table==='room'?'room':table==='city_unit'?'unit':'element',table==='city_unit'?row.city_id:'',row.scope_id??'',row.floor_id??'',row.id,shape,row.sourceOrder);
 }
 /** Recreate a display shape from its canonical source only when it is needed. */
 private shape(row:any):Shape{
  let payload=this.shapePayloads.get(row.key);
  if(payload===undefined){
   const table=row.kind==='room'?'room':row.kind==='unit'?'city_unit':'drawing_element',source=this.source(table,row.key.slice(row.key.indexOf(':')+1));
   const shape=source&&this.materialize(table,source);if(!shape)throw Error('Kartendaten beschädigt. Originaldaten bleiben erhalten.');
   payload=JSON.stringify(shape);this.shapePayloads.put(row.key,{x:row.min_x,y:row.min_y,width:row.max_x-row.min_x,height:row.max_y-row.min_y},payload,payload.length*2);
   // The cache owns an immutable string. New room/drawing shapes are already
   // private to this read. Legacy city units still need JSON normalization of
   // their explicitly undefined optional fields, matching subsequent cache hits.
   if(row.kind!=='unit')return shape;
  }
  // Callers add per-view styles and slices; cached source shapes stay immutable.
  return JSON.parse(payload);
 }
 private materialize(table:string,row:any):Shape|undefined{
  if(table==='city_document'){readCityHeader(this.db,this.campaign,row.id);return;}
  if(table==='room'){
   if(digest(row.payload)!==row.checksum)throw new Error('Raum beschädigt.');
   const polygons=JSON.parse(row.polygons??this.sql("SELECT json_extract(payload,'$.polygons') p FROM room WHERE campaign_id=? AND id=?").get(this.campaign,row.id).p);validateRoom({name:row.name,polygons,sections:[]});
   const value:RoomGeometry={id:row.id,scopeId:row.scope_id,floorId:row.floor_id,number:row.number,name:row.name,revision:row.revision,polygons};
   return {value,polygons};
  }else if(table==='city_unit'){
   const u=parse(row);checkedUnit(u);if(u.id!==row.id||u.kind!==row.kind)throw new Error('Stadtelement widersprüchlich.');if(u.kind==='node')return;
   const {label,id,kind,name,protected:protectedValue,point,position,angle,width,interior,footprint,terrain}=u;
   let outline=u.outline,points:Point[]|undefined;
   if(['road','wall'].includes(kind)){
    const nodes=(u.nodeIds??[]).map((id:string)=>{const n=this.source('city_unit',id);if(n?.city_id!==row.city_id)throw new Error('Straßenknoten fehlt.');return parse(n);});
    points=roadPoints(u,nodes);if(points.length<2)throw new Error('Straßenknoten fehlt.');outline=points;
   }
   const value={label,id,kind,name,protected:protectedValue,point,position,angle,width,interior,footprint,terrain,outline};
   return {value,...(points?{points,stroke:width??6}:{polygons:kind==='building'?posedFootprint(value):[{outer:outline??[],holes:[]}]})};
  }else if(table==='drawing_element'){
   const e=parse(row);validateDrawingElement(e);if(e.id!==row.id||e.scopeId!==row.scope_id||e.floorId!==row.floor_id)throw new Error('Zeichnung widersprüchlich.');if(e.archived)return;
   const {notes:unused,content:unusedContent,...value}=e;
   if(e.content?.anchor&&e.roomId){const volume=readDungeonVolume(this.db,this.campaign,e.roomId),anchor=dungeonContentAnchor({drawing:{volumes:volume?[volume]:[]}},e);if(anchor){value.points=[anchor.point];value.zOffsetMeters=anchor.zOffsetMeters;value.anchor=null;}}
   if(value.anchor){
    const room=this.source('room',value.anchor.roomId);let r:RoomGeometry|undefined;
    try{r=room?this.materialize('room',room)?.value:undefined;}catch{/* A damaged anchor room is already reported by the index scan. */}
    value.points=anchored(value,r?[r]:[]);value.anchor=null;
   }
   const points=value.points as Point[],closed=['terrain','water','roof'].includes(value.kind),rectangle=value.kind==='object'&&!['barrel','pillar'].includes(value.variant);
   const polygons=closed?[{outer:points,holes:[]}]:rectangle?[{outer:corners({x:-value.width/2,y:-value.height/2,width:value.width,height:value.height}).map(p=>at(p,{...points[0]!,angle:value.angle*Math.PI/180})),holes:[]}]:undefined;
   const stroke=['wall','path','stairs'].includes(value.kind)?value.width:value.kind==='door'?.3:Math.max(value.width,value.height)*2;
   return {value,...(polygons?{polygons}:{points,stroke})};
  }
 }
 private async update(table:string,id:string){
  const kind=table==='room'?'room':table==='city_unit'?'unit':table==='city_document'?'city':'element',key=kind+':'+id;
  if(this.indexed)this.meta('DELETE FROM temp.region_index WHERE id=(SELECT rowid FROM temp.region_shape WHERE key=?)').run(key);
  this.meta('DELETE FROM temp.region_shape WHERE key=?').run(key);this.meta('DELETE FROM temp.region_problem WHERE key=?').run(key);
  const row=this.source(table,id);if(row)try{this.project(table,row);}catch{this.meta('INSERT OR REPLACE INTO temp.region_problem VALUES(?,?)').run(key,id);}
  if(++this.count%128===0)await pause();
 }
 /** A rolled-back worker snapshot also rolls back TEMP tables, not JS state. */
 rollback(geometry=true){
  if(geometry){this.ready=false;this.geometryChanges.invalidate();this.shapePayloads.clear();}
  if(this.landscapeSyncChanged)this.landscapeFailure=true;
 }
 async sync(source:AtlasRegionSource,geometry=true){
  this.projection.begin();
  try{await this.syncProjection(source,geometry);this.projection.commit();}
  catch(error){this.projection.rollback();this.rollback(geometry);throw error;}
 }
 private async syncProjection(source:AtlasRegionSource,geometry:boolean){
  const versions=atlasProjectionSource(this.db,source.campaignId);
  if(source.shapeVersion!==undefined&&source.shapeVersion!==versions.shapeVersion||source.geometryVersion!==undefined&&source.geometryVersion!==versions.geometryVersion)throw Error('Atlas inzwischen geändert. Ausschnitt erneut laden.');
  this.campaign=source.campaignId;
  this.geometryChanges.observe(source);
  // An invalid query on an unchanged snapshot must not discard precise terrain invalidation.
  this.landscapeSyncChanged=this.landscapeFailure||source.reset||source.changes.length>0;
  try{this.projection.transaction(()=>this.landscape.sync(this.landscapeFailure?{...source,reset:true}:source))();if(this.landscape.invalidation.reset)this.terrainBases.clear();this.landscapeFailure=false;}
  catch{this.landscapeFailure=true;}
  if(!geometry)return;
  source=this.geometryChanges.source(source);
  const rebuild=source.reset||!this.ready;
  let restored=false;
  if(source.reset||!this.ready||source.changes.some(c=>['city_document','city_unit','room','drawing_element','dungeon_volume'].includes(c.table)))this.shapePayloads.clear();
  if(source.reset||!this.ready){
   restored=this.projection.valid('geometry',source);
   if(!restored){
    this.projection.exec('DELETE FROM temp.region_shape; DELETE FROM temp.region_problem; DELETE FROM temp.region_extent;');
    if(this.indexed)this.projection.exec('DELETE FROM temp.region_index');
   }
   this.buildingIndex=true;
   try{
    if(!restored)for(const table of ['city_document','room','city_unit','drawing_element']){
     const fields=table==='room'?",CASE WHEN json_valid(payload) THEN json_extract(payload,'$.polygons') END polygons":'';
     let cursor=0;
     for(;;){
      // Walk rowids once. A campaign index otherwise re-sorts the remaining rows for each page.
      const batch=this.sql(`SELECT rowid sourceOrder,*${fields} FROM ${table} NOT INDEXED WHERE campaign_id=? AND rowid>? ORDER BY rowid LIMIT 128`).all(this.campaign,cursor);
      if(!batch.length)break;
      // Furnished towns have many more shapes than roof-only maps. Commit one
      // bounded TEMP batch, retaining the cancellation yield between batches.
      this.projection.transaction(()=>{for(const row of batch){try{this.project(table,row);}catch{this.meta('INSERT OR REPLACE INTO temp.region_problem VALUES(?,?)').run((table==='room'?'room':table==='city_unit'?'unit':table==='city_document'?'city':'element')+':'+row.id,row.id);}cursor=row.sourceOrder;}})();
      await pause();
     }
    }
   }finally{this.buildingIndex=false;}
   if(!restored&&this.indexed)this.projection.exec('INSERT INTO temp.region_index SELECT rowid,min_x,max_x,min_y,max_y FROM temp.region_shape');
  }else{
   const changes=new Map(source.changes.map(c=>[c.table+':'+c.id,c]));
   for(const c of changes.values()){
    if(['city_document','room','city_unit','drawing_element'].includes(c.table))await this.update(c.table,c.id);
    // Moving a node changes incident roads even though their source rows do not change.
    if(c.table==='city_unit')for(const r of this.sql("SELECT id FROM city_unit WHERE campaign_id=? AND kind IN('road','wall') AND EXISTS(SELECT 1 FROM json_each(city_unit.payload,'$.nodeIds') WHERE value=?)").all(this.campaign,c.id))await this.update('city_unit',r.id);
    if(c.table==='dungeon_volume')for(const r of this.sql("SELECT id FROM drawing_element WHERE campaign_id=? AND json_extract(payload,'$.content.anchor.volumeId')=?").all(this.campaign,c.id))await this.update('drawing_element',r.id);
    if(c.table==='room')for(const r of this.sql("SELECT id FROM drawing_element WHERE campaign_id=? AND json_extract(payload,'$.anchor.roomId')=?").all(this.campaign,c.id))await this.update('drawing_element',r.id);
   }
  }
  if(!restored&&(rebuild||source.changes.some(c=>['room','drawing_element','dungeon_volume','drawing_hidden','drawing_floor'].includes(c.table)))){
   this.projection.exec('DELETE FROM temp.region_extent; DELETE FROM temp.region_hidden');
   this.projection.copy('region_hidden',3,'SELECT kind,id,scope_id FROM drawing_hidden WHERE campaign_id=? AND hidden=1',[this.campaign]);
   this.meta("INSERT INTO temp.region_extent SELECT scope,floor,min(min_x),min(min_y),max(max_x)-min(min_x),max(max_y)-min(min_y) FROM temp.region_shape s WHERE s.kind IN ('room','element') AND NOT EXISTS(SELECT 1 FROM temp.region_hidden h WHERE h.kind='room' AND s.kind='room' AND h.id=substr(s.key,6) OR h.kind='floor' AND h.scope=s.scope AND h.id=s.floor) GROUP BY scope,floor").run();
  }
  this.projection.mark('geometry',source);
  this.ready=true;this.geometryChanges.accepted();
 }
 private binding(row:any):AtlasBinding{return{id:row.id,kind:row.kind,ownerId:row.owner_id,parent:row.parent,parentId:row.parent_id,x:row.x,y:row.y,angle:row.angle,revision:row.revision};}
 private frame(b:AtlasBinding):Frame{
  if(b.parent==='world')return{x:b.x,y:b.y,angle:b.angle};
  const unit=this.source('city_unit',b.parentId!);if(!unit)throw new Error('Elterngebäude fehlt.');const u=parse(unit);checkedUnit(u);const parent=this.sql("SELECT * FROM atlas_binding WHERE campaign_id=? AND kind='city' AND owner_id=?").get(this.campaign,unit.city_id);
  if(u.kind!=='building'||!u.position||!parent)throw new Error('Elterngebäude fehlt.');const f=this.frame(this.binding(parent)),p=at(u.position,f),pose={...p,angle:f.angle+(u.angle??0)},offset=at(b,pose);return{...offset,angle:pose.angle+b.angle};
 }
 private roomVisible(id:string,scope:string,floor:string){return!this.sql("SELECT 1 FROM drawing_hidden WHERE campaign_id=? AND hidden=1 AND (kind='room' AND id=? OR kind='floor' AND scope_id=? AND id=?)").get(this.campaign,id,scope,floor);}
 // Match citySvg's surface/road/roof order; exact hits use the same painter order.
 private candidates(kind:string,owner:string,scope:string,floor:string,box:Box){
  // Thousands of small buildings share the same local coordinates. Starting at
  // the spatial index for each one repeatedly visits every other building.
  // Bound the cardinality probe: a large dungeon still starts with its Rtree.
  const small=this.indexed&&this.sql('SELECT count(*) n FROM (SELECT 1 FROM temp.region_shape WHERE kind=? AND owner=? AND scope=? AND floor=? LIMIT 129)').get(kind,owner,scope,floor).n<=128;
  const from=this.indexed?(small?'temp.region_shape s INDEXED BY region_shape_owner CROSS JOIN temp.region_index i ON i.id=s.rowid':'temp.region_index i CROSS JOIN temp.region_shape s ON s.rowid=i.id'):'temp.region_shape s',alias=this.indexed?'i':'s';
  return this.sql(`SELECT s.* FROM ${from} WHERE s.kind=? AND s.owner=? AND s.scope=? AND s.floor=? AND ${alias}.max_x>=? AND ${alias}.min_x<=? AND ${alias}.max_y>=? AND ${alias}.min_y<=? ORDER BY s.paint_order,s.source_order,s.key`).iterate(kind,owner,scope,floor,box.x,box.x+box.width,box.y,box.y+box.height);
 }
 private roomShape(row:any,q:AtlasRegionQuery):Shape|null{
  const s=this.shape(row),r=s.value as RoomGeometry;if(!this.roomVisible(r.id,r.scopeId,r.floorId))return null;s.style=roomMapStyle(this.db,this.campaign,r.id);
  if(q.slice!==null&&q.scopeId===r.scopeId){
   const elevation=this.sql('SELECT source_elevation z FROM drawing_floor WHERE campaign_id=? AND scope_id=? AND id=?').get(this.campaign,r.scopeId,r.floorId)?.z??0,v=this.sql('SELECT payload,checksum FROM dungeon_volume WHERE campaign_id=? AND room_id=?').get(this.campaign,r.id);
   let polygons:Polygon[];
   if(v)polygons=volumeProjection(parse(v),(q.slice-elevation)/1.524);
   else{const height=s.style?.ceilingMeters??3.048;polygons=q.slice>=elevation&&q.slice<elevation+height?r.polygons:[];}
   if(!polygons.length)return null;s.value={...r,polygons};s.polygons=polygons;
  }return s;
 }
 private visit(q:AtlasRegionQuery,emit:(shape:Shape,frame:Frame,kind:string,binding:AtlasBinding,header?:CityHeader)=>void,metadata?:(b:AtlasBinding,f:Frame,h?:CityHeader,detail?:BindingDetail)=>void,searchBox?:Box,checkpoint?:()=>void){
  const mpp=q.box.width/q.width;
  // Workbench vectors paint all Cities first, then Dungeon contours.
  // Read extent/name metadata with each binding, without one metadata query
  // per owner. Dense views stream these shapes directly into their raster.
  for(const row of this.sql(`SELECT b.*,e.x extent_x,e.y extent_y,e.width extent_width,e.height extent_height,s.id scope_id,s.name scope_name
   FROM atlas_binding b LEFT JOIN temp.region_extent e ON b.kind='dungeon' AND e.scope=b.owner_id AND e.floor=CASE WHEN b.owner_id=? THEN ? ELSE 'ground' END
   LEFT JOIN scope s ON b.kind='dungeon' AND s.campaign_id=b.campaign_id AND s.id=b.owner_id
   WHERE b.campaign_id=? ORDER BY CASE b.kind WHEN 'city' THEN 0 ELSE 1 END,b.rowid`).iterate(q.scopeId,q.floorId,this.campaign)){
   checkpoint?.();
   const b=this.binding(row);let f:Frame;try{f=this.frame(b);}catch{if(this.countFaults)this.readFaults++;continue;}
   const local=bounds(corners(searchBox??q.box).map(p=>inverse(p,f)));
   if(b.kind==='city'){
    let h:CityHeader;try{h=readCityHeader(this.db,this.campaign,b.ownerId);}catch{continue;}
    metadata?.(b,f,h);
    for(const r of this.candidates('unit',b.ownerId,'','',local)){checkpoint?.();const s=this.shape(r);emit(s,f,'unit',b,h);}
   }else{
    const floor=b.ownerId===q.scopeId?q.floorId:'ground';
    if(b.parent==='building'&&q.roofs&&mpp>0.4&&b.ownerId!==q.scopeId)continue;
    const detail:BindingDetail={extent:row.extent_x===null?undefined:{x:row.extent_x,y:row.extent_y,width:row.extent_width,height:row.extent_height},scope:row.scope_id===null?undefined:{id:row.scope_id,name:row.scope_name}},extent=detail.extent;
    // An empty author frame remains available for editing/focus, but is not a
    // place on the landscape and must not contribute a marker, label or hit.
    if(!extent){if(b.ownerId===q.scopeId)metadata?.(b,f,undefined,detail);continue;}
    if(!overlap(bounds(corners(extent).map(p=>at(p,f))),q.box)){if(b.ownerId===q.scopeId)metadata?.(b,f,undefined,detail);continue;}
    if(b.parent==='world'&&!mapExtentVisible(extent.width,extent.height,mpp)){
     // Keep the selected editing frame and search target, without promoting
     // every tiny house/room group to a world-scale place marker.
     if(b.ownerId===q.scopeId)metadata?.(b,f,undefined,detail);continue;
    }
    metadata?.(b,f,undefined,detail);
    for(const r of this.candidates('room','',b.ownerId,floor,local)){checkpoint?.();try{const s=this.roomShape(r,q);if(s)emit(s,f,'room',b);}catch(error){if(error instanceof AtlasReadCancelled)throw error;if(this.countFaults)this.readFaults++;}}
    for(const r of this.candidates('element','',b.ownerId,floor,local)){checkpoint?.();emit(this.shape(r),f,'element',b);}
   }
  }
 }
 /** Camera-independent vector source for durable geometry. Never substitutes a
  * raster for semantic objects; a dense tile must be refined by its caller. */
 geometryTileSource(source:AtlasRegionSource,box:Box):import('../atlas-scene-geometry').AtlasSceneView {
  const region:AtlasRegionGeometry={campaignId:source.campaignId,token:source.token,revision:source.revision,fence:source.fence,box,slice:null,scopeId:null,floorId:'ground',rooms:[],floors:[],drawing:emptyDrawing(),cities:[],bindings:[],scopes:[],frames:Object.create(null),scopeBounds:Object.create(null),interiors:Object.create(null),coverage:{complete:true,mode:'detail',objects:0,unreadable:this.sql('SELECT count(*) n FROM temp.region_problem').get().n,index:this.indexed?'rtree':'scan'}};
  const bindings=this.sql('SELECT * FROM atlas_binding WHERE campaign_id=? ORDER BY rowid').all(source.campaignId);
  const bindingIds=new Set<string>(),cityResults=new Map<string,AtlasRegionGeometry['cities'][number]>(),floorCache=new Map<string,AtlasRegionGeometry['floors']>(),addedFloors=new Set<string>();
  const children=new Map<string,any>(),cityBindings=new Map<string,any>(),unitIds=new Set<string>();
  for(const b of bindings){if(b.parent==='building')children.set(b.parent_id,b);if(b.kind==='city')cityBindings.set(b.owner_id,b);}
  let used=0;
  const budget=(value:unknown)=>{used+=bytes(value);if(++region.coverage.objects>16384||used>16*1024*1024)throw Error('Geometriekachel benötigt feinere Detailstufe.');};
  const metadata=(b:AtlasBinding,f:Frame)=>{if(!bindingIds.has(b.id)){bindingIds.add(b.id);region.bindings.push(b);region.frames[b.id]=f;}};
  const floors=(scope:string)=>{let rows=floorCache.get(scope);if(!rows){rows=this.sql("SELECT id,scope_id scopeId,name,source_elevation sourceElevation FROM drawing_floor f WHERE campaign_id=? AND scope_id=? AND NOT EXISTS(SELECT 1 FROM drawing_hidden h WHERE h.campaign_id=f.campaign_id AND h.id=f.id AND h.scope_id=f.scope_id AND h.kind='floor' AND h.hidden=1) ORDER BY rowid").all(source.campaignId,scope) as AtlasRegionGeometry['floors'];floorCache.set(scope,rows);}return rows;};
  const addFloors=(scope:string)=>{if(!addedFloors.has(scope)){addedFloors.add(scope);region.floors.push(...floors(scope));}};
  const addBuilding=(row:any,unit:any)=>{
   const b=this.binding(row),f=this.frame(b);metadata(b,f);
   let city=cityResults.get(b.ownerId);
   if(!city){city={header:readCityHeader(this.db,source.campaignId,b.ownerId),units:[]};region.cities.push(city);cityResults.set(b.ownerId,city);}
   if(unitIds.has(unit.id))return;unitIds.add(unit.id);
   const child=children.get(unit.id);
   if(child){const cb=this.binding(child);metadata(cb,this.frame(cb));addFloors(cb.ownerId);unit.floorElevations=this.sql('SELECT source_elevation z FROM drawing_floor WHERE campaign_id=? AND scope_id=? ORDER BY rowid').all(source.campaignId,cb.ownerId).map((x:{z:number})=>x.z);region.interiors[unit.id]=cb.ownerId;}
   budget(unit);city.units.push(unit);
  };
  for(const row of bindings){
   const b=this.binding(row);let f:Frame;
   try{f=this.frame(b);}catch{region.coverage.unreadable++;continue;}
   const local=bounds(corners(box).map(p=>inverse(p,f)));
   if(b.kind==='city'){
    for(const candidate of this.candidates('unit',b.ownerId,'','',local))addBuilding(row,this.shape(candidate).value);
   }else{
    for(const floor of floors(b.ownerId)){
     for(const candidate of this.candidates('room','',b.ownerId,floor.id,local)){
      const room=this.shape(candidate).value as RoomGeometry;if(!this.roomVisible(room.id,room.scopeId,room.floorId))continue;
      budget(room);metadata(b,f);addFloors(b.ownerId);region.rooms.push(room);
      // A room may extend beyond its parent building footprint. Its ground
      // anchor still belongs to that building, even outside this tile's query.
      if(b.parent==='building'){
       const parent=this.source('city_unit',b.parentId!);if(!parent)throw Error('Elterngebäude fehlt.');
       const city=cityBindings.get(parent.city_id);if(!city)throw Error('Stadtanker fehlt.');
       addBuilding(city,this.materialize('city_unit',parent)!.value);
      }
     }
     for(const candidate of this.candidates('element','',b.ownerId,floor.id,local)){
      const element=this.shape(candidate).value;budget(element);metadata(b,f);region.drawing.elements.push(element);
     }
    }
   }
  }
  region.coverage.complete=region.coverage.unreadable===0;
  return {cities:region.cities,bindings:region.bindings,region,
   workspace:{rooms:region.rooms,floors:region.floors},
   geometry:{floors:region.floors.map(f=>({id:f.id,scopeId:f.scopeId,name:f.name,elevation:f.sourceElevation})),drawing:region.drawing}};
 }
 /** The point's fixed half-metre neighbourhood is independent of tile LOD.
  * Adjacent tiles therefore use identical physical anchors and wall bases. */
 geometryHeight(source:AtlasRegionSource,point:Point):number {
  const box={x:point.x-.5,y:point.y-.5,width:1,height:1};
  const grid=this.terrainVisibility(source,{box,frame:box,columns:3,rows:3,focusM:0,tilt:0,rotation:0,exaggeration:1});
  return grid.heights[4]!;
 }
 read(source:AtlasRegionSource,q:AtlasRegionQuery,cancellation?:Int32Array):AtlasRegionGeometry{
  const checkpoint=atlasReadCheckpoint(cancellation);
  checkpoint?.();
  this.readFaults=0;this.countFaults=true;validateRegion(q);if(q.revision!==undefined&&q.revision!==source.revision||q.fence!==undefined&&q.fence!==source.fence)throw new Error('Atlas inzwischen geändert. Ausschnitt erneut laden.');
  const result:AtlasRegionGeometry={campaignId:source.campaignId,token:source.token,revision:source.revision,fence:source.fence,box:{...q.box},slice:q.slice,scopeId:q.scopeId,floorId:q.floorId,rooms:[],floors:[],drawing:emptyDrawing(),cities:[],bindings:[],scopes:[],frames:Object.create(null),scopeBounds:Object.create(null),interiors:Object.create(null),coverage:{complete:true,mode:'detail',objects:0,unreadable:this.sql('SELECT count(*) n FROM temp.region_problem').get().n,index:this.indexed?'rtree':'scan'}};
  let labelCandidates:MapLabelCandidate[]=[];
  const labelFloorHeights=new Map<string,number>();
  const raster=new AtlasGeometryRaster(q,checkpoint);
  let used=bytes(result),dense=false;const cities=new Map<string,AtlasRegionGeometry['cities'][number]>();
  const metadata=(b:AtlasBinding,f:Frame,h?:CityHeader,detail?:BindingDetail)=>{
   if(dense||Object.hasOwn(result.frames,b.id))return;
   const scope=b.kind==='dungeon'?(detail?detail.scope:this.sql('SELECT id,name FROM scope WHERE campaign_id=? AND id=?').get(this.campaign,b.ownerId)):null,
    floors=scope?this.sql('SELECT id,scope_id scopeId,name,source_elevation sourceElevation FROM drawing_floor f WHERE campaign_id=? AND scope_id=? AND NOT EXISTS(SELECT 1 FROM drawing_hidden h WHERE h.campaign_id=f.campaign_id AND h.id=f.id AND h.scope_id=f.scope_id AND h.kind=\'floor\' AND h.hidden=1)').all(this.campaign,b.ownerId):[];
   used+=bytes([b,f,h,scope,floors]);if(used>REGION_REPLY_BYTES-800*1024){dense=true;return;}
   result.bindings.push(b);result.frames[b.id]=f;if(scope){const e=detail?detail.extent:this.sql('SELECT x,y,width,height FROM temp.region_extent WHERE scope=? AND floor=?').get(b.ownerId,b.ownerId===q.scopeId?q.floorId:'ground');if(e&&e.x!==null)result.scopeBounds[b.ownerId]=e;}if(scope){result.scopes.push(scope);result.floors.push(...floors);}
   if(h){const c={header:h,units:[]};cities.set(h.id,c);result.cities.push(c);}
  };
  this.visit(q,(s,_f,kind,b,h)=>{
   if((s.value.name||kind==='room'&&s.value.number)){
    const labelStart=labelCandidates.length;
    if(s.polygons){const polygons=s.polygons.map(p=>({outer:p.outer.map(p=>at(p,_f)),holes:p.holes.map(r=>r.map(p=>at(p,_f)))})),labelKind=kind==='room'?'room':s.value.kind==='building'?'building':'area',candidate=labelFromPolygon(kind+':'+s.value.id,kind==='room'?(s.value.number?'['+s.value.number+'] ':'')+s.value.name:s.value.name,labelKind,polygons,kind==='room'?0:s.value.kind==='building'?1:2);if(candidate)labelCandidates.push(candidate);}
    else if(s.points&&s.value.kind==='road')labelCandidates.push(...lineLabels('unit:'+s.value.id,s.value.name,'road',s.points.map(p=>at(p,_f)),2,q.box));
    if(kind==='room'){
     const key=JSON.stringify([b.ownerId,s.value.floorId]);
     if(!labelFloorHeights.has(key))labelFloorHeights.set(key,this.sql('SELECT source_elevation z FROM drawing_floor WHERE campaign_id=? AND scope_id=? AND id=?').get(this.campaign,b.ownerId,s.value.floorId)?.z??0);
     for(const candidate of labelCandidates.slice(labelStart))candidate.workplane={scopeId:b.ownerId,elevationM:labelFloorHeights.get(key)!,anchor:{x:_f.x,y:_f.y}};
    }
    const style=s.value.label;if(style){const transformed={...style,...(style.point?{point:at(style.point,_f)}:{}),...(style.angle===undefined?{}:{angle:style.angle+_f.angle})};labelCandidates.splice(labelStart,labelCandidates.length-labelStart,...styledLabels(labelCandidates.slice(labelStart),transformed));}
    if(labelCandidates.length>2400)labelCandidates=boundedLabels(labelCandidates,q.box);
   }
   result.coverage.objects++;if(result.coverage.objects>REGION_VECTOR_OBJECTS)dense=true;
   const cost=dense?0:bytes(s.value);if(used+cost>REGION_REPLY_BYTES-800*1024)dense=true;
   if(dense)raster.activate();
   raster.append(s,_f,kind,h?.roof);
   if(dense)return;
   used+=cost;
   if(kind==='room'){
    result.rooms.push(s.value);if(s.style){used+=bytes(s.style);result.drawing.styles.push(s.style);}
   }else if(kind==='unit'){
    cities.get(b.ownerId)?.units.push(s.value);
    if(s.value.kind==='building'){
      const child=this.sql("SELECT * FROM atlas_binding WHERE campaign_id=? AND parent='building' AND parent_id=?").get(this.campaign,s.value.id);
      if(child){
        const childBinding=this.binding(child);metadata(childBinding,this.frame(childBinding));
        s.value.floorElevations=result.floors.filter(f=>f.scopeId===child.owner_id).map(f=>f.sourceElevation);
        result.interiors[s.value.id]=child.owner_id;used+=bytes([s.value.id,child.owner_id,s.value.floorElevations]);
      }
    }
   }
   else if(kind==='element')result.drawing.elements.push(s.value);
  },metadata,undefined,checkpoint);
  checkpoint?.();
  if(bytes(result)>REGION_REPLY_BYTES-800*1024)dense=true;
  if(dense){
   this.countFaults=false;
   result.rooms=[];result.cities=[];result.bindings=[];result.frames=Object.create(null);result.scopeBounds=Object.create(null);result.interiors=Object.create(null);result.scopes=[];result.floors=[];result.drawing=emptyDrawing();result.coverage.mode='raster';
   // Keep the chosen author frame even when contours are represented by pixels.
   if(q.scopeId){const row=this.sql("SELECT * FROM atlas_binding WHERE campaign_id=? AND kind='dungeon' AND owner_id=?").get(this.campaign,q.scopeId);if(row){dense=false;metadata(this.binding(row),this.frame(this.binding(row)));dense=true;}}
   result.raster=raster.finish();
  }
  if(!q.perception){
   const state=readTerritories(this.db,source.campaignId,q.box);
   labelCandidates.push(...territoryLabels(state));
   if(bytes(state)<=256*1024)result.territories=state;
   else {
    const width=Math.min(512,q.width),height=Math.max(1,Math.min(512,Math.round(width*q.height/q.width))),image=new LandscapeRasterizer(q.box,width,height),mpp=q.box.width/q.width;
    for(const l of state.layers)if(l.visible)for(const t of state.territories.filter(t=>t.layerId===l.id).sort((a,b)=>b.rank-a.rank||a.id.localeCompare(b.id))){
     checkpoint?.();
     image.paintPolygons(t.polygons,t.color,t.opacity);
     if(mpp<=labelScaleLimits[t.rank]!*4)for(const p of t.polygons)for(const ring of [p.outer,...p.holes])image.paintLine([...ring,ring[0]!],mpp*(t.rank>=4?1.8:1.1),t.color);
    }
    result.territoryRaster={box:{...q.box},width,height,data:'data:image/png;base64,'+PNG.sync.write({width,height,data:Buffer.from(image.finish())} as PNG).toString('base64')};
   }
  }
  if(!q.perception)result.labels=boundedLabels(labelCandidates,q.box);
  result.coverage.unreadable+=this.readFaults;result.coverage.complete=result.coverage.unreadable===0;
  try{if(this.landscapeFailure)throw Error('Landschaftsprojektion nicht verfügbar.');result.landscape=this.landscape.read(source,q,Math.max(8192,REGION_REPLY_BYTES-bytes(result)-1024),false,checkpoint);}catch(error){if(error instanceof AtlasReadCancelled)throw error;result.landscape={state:'error',records:[],tiles:[],coverage:{complete:false,mode:'raster',objects:0,references:0},error:'Landschaft nicht verfügbar. Erneut laden.'};}
  checkpoint?.();
  if(bytes(result)>REGION_REPLY_BYTES)throw new Error('Ausschnitt überschreitet das Darstellungsbudget. Weiter hineinzoomen.');
  return result;
 }
 focus(source:AtlasRegionSource,kind:'room'|'city'|'building'|'element'|'scope',id:string):AtlasObjectFocus{
  this.campaign=source.campaignId;
  if(kind==='scope'){
   const row=this.sql("SELECT * FROM atlas_binding WHERE campaign_id=? AND kind='dungeon' AND owner_id=?").get(this.campaign,id);if(!row)throw new Error('Dungeon ist nicht im Atlas verortet.');
   const floor=this.sql("SELECT f.id FROM drawing_floor f WHERE campaign_id=? AND scope_id=? AND NOT EXISTS(SELECT 1 FROM drawing_hidden h WHERE h.campaign_id=f.campaign_id AND h.scope_id=f.scope_id AND h.id=f.id AND h.kind='floor' AND h.hidden=1) ORDER BY CASE WHEN f.id='ground' THEN 0 ELSE 1 END,source_elevation,id LIMIT 1").get(this.campaign,id)?.id??'ground';
   const extent=this.sql('SELECT x,y,width,height FROM temp.region_extent WHERE scope=? AND floor=?').get(id,floor)??{x:0,y:0,width:20,height:20},f=this.frame(this.binding(row)),box=bounds(corners(extent).map(p=>at(p,f)));
   return{kind:'scope',id,scopeId:id,floorId:floor,point:{x:box.x+box.width/2,y:box.y+box.height/2},box,revision:source.revision};
  }
  if(kind==='city'){
   const h=readCityHeader(this.db,this.campaign,id),r=this.sql("SELECT * FROM atlas_binding WHERE campaign_id=? AND kind='city' AND owner_id=?").get(this.campaign,id);if(!r)throw new Error('Stadt ist nicht im Atlas verortet.');const b=this.binding(r),f=this.frame(b),box=bounds(corners({x:0,y:0,width:h.width,height:h.height}).map(p=>at(p,f)));return{kind,id,point:{x:box.x+box.width/2,y:box.y+box.height/2},box,revision:source.revision};
  }
  const r=this.sql('SELECT * FROM temp.region_shape WHERE key=?').get((kind==='room'?'room:':kind==='element'?'element:':'unit:')+id);if(!r)throw new Error('Objekt fehlt oder ist beschädigt.');
  const s=this.shape(r),row=this.sql('SELECT * FROM atlas_binding WHERE campaign_id=? AND kind=? AND owner_id=?').get(this.campaign,kind==='room'||kind==='element'?'dungeon':'city',kind==='room'||kind==='element'?r.scope:r.owner);if(!row)throw new Error('Objekt ist nicht im Atlas verortet.');
  if(kind==='room'&&!this.roomVisible(id,r.scope,r.floor))throw new Error('Raum ist archiviert.');
  const f=this.frame(this.binding(row)),box=bounds(corners({x:r.min_x,y:r.min_y,width:r.max_x-r.min_x,height:r.max_y-r.min_y}).map(p=>at(p,f)));
  const child=kind==='building'?this.sql("SELECT owner_id FROM atlas_binding WHERE campaign_id=? AND parent='building' AND parent_id=?").get(this.campaign,id):null;
  return{kind:kind==='room'?'room':kind==='element'?'element':s.value.kind==='building'?'building':'city-unit',id,...(child?{interiorScopeId:child.owner_id}:{}),...(kind==='room'||kind==='element'?{scopeId:r.scope,floorId:r.floor}:{cityId:r.owner}),box,point:{x:box.x+box.width/2,y:box.y+box.height/2},revision:source.revision};
 }
 candidatesAt(source:AtlasRegionSource,q:AtlasRegionQuery,p:Point,offset=0,layer:'geometry'|'landscape'|'all'='geometry',visualElementId?:string):AtlasHitPage{
  validateRegion(q);if(!p||!Number.isFinite(p.x+p.y)||!overlap({x:p.x,y:p.y,width:0,height:0},q.box)||!Number.isSafeInteger(offset)||offset<0)throw new Error('Kartenauswahl prüfen.');
  if(q.fence!==undefined&&q.fence!==source.fence)throw new Error('Atlas inzwischen geändert.');
  const landscapeHits=(offset:number):AtlasHitPage=>{try{if(this.landscapeFailure)throw Error('Landschaftsprojektion nicht verfügbar.');return this.landscape.hits(source,q,p,offset);}catch{return{items:[],total:0,next:null,fence:source.fence,unavailable:['landscape']};}};
  if(layer==='landscape')return landscapeHits(offset);
  if(layer==='all'){
   const geometry=this.candidatesAt(source,q,p,offset,'geometry',visualElementId),landscape=landscapeHits(Math.max(0,offset-geometry.total)),items=[...geometry.items,...landscape.items].slice(0,40),total=geometry.total+landscape.total;
   return{items,total,next:offset+items.length<total?offset+items.length:null,fence:source.fence,...(geometry.unavailable||landscape.unavailable?{unavailable:[...(geometry.unavailable??[]),...(landscape.unavailable??[])]}:{})};
  }
  const items:AtlasHit[]=[];let matched=0,more=false;const radius=q.box.width/q.width*8;this.readFaults=0;this.countFaults=true;
  const emit=(s:Shape,_f:Frame,kind:string,_b:AtlasBinding)=>{
   if(matched++<offset)return;if(items.length>=40){more=true;return;}
   const focus=kind==='room'?this.focus(source,'room',s.value.id):kind==='element'?this.focus(source,'element',s.value.id):this.focus(source,'building',s.value.id);
   items.push({...focus,name:(kind==='room'?s.value.number+'. ':'')+(s.value.name||({room:'Raum',element:'Objekt',unit:'Stadtelement'}[kind]??'Objekt'))});
  };
  // A rendered glyph can extend beyond its logical anchor's point-pick radius.
  // Union that exact source ID with all canonical overlaps; never auto-prioritize it.
  // Re-run the regular floor/roof/binding visibility path before including it.
  let visual=false;
  if(visualElementId){
   const row=this.sql('SELECT 1 FROM temp.region_shape WHERE key=?').get('element:'+visualElementId);
   if(row){const focus=this.focus(source,'element',visualElementId);
    if(overlap(focus.box,q.box))this.visit(q,(s,f,k,b)=>{if(k==='element'&&s.value.id===visualElementId){visual=true;emit(s,f,k,b);}},undefined,focus.box);
   }
  }
  this.visit(q,(s,f,kind,b)=>{
   if(visual&&kind==='element'&&s.value.id===visualElementId)return;
   const touch=touches(s,inverse(p,f),q.box.width/q.width);
   if(touch)emit(s,f,kind,b);
  },undefined,{x:p.x-radius,y:p.y-radius,width:radius*2,height:radius*2});return{items,next:more?offset+items.length:null,fence:source.fence,total:matched,...(this.readFaults||this.sql('SELECT 1 FROM temp.region_problem LIMIT 1').get()?{unavailable:['geometry'] as ('geometry')[]}: {})};
 }
 hit(source:AtlasRegionSource,q:AtlasRegionQuery,p:Point):AtlasObjectFocus|null{
  validateRegion(q);if(!p||!Number.isFinite(p.x+p.y)||!overlap({x:p.x,y:p.y,width:0,height:0},q.box))throw new Error('Kartenauswahl prüfen.');
  let hit:AtlasObjectFocus|null=null;this.visit(q,(s,f,kind)=>{
   const touch=touches(s,inverse(p,f),q.box.width/q.width);
   if(touch)hit=kind==='room'?this.focus(source,'room',s.value.id):kind==='element'?this.focus(source,'element',s.value.id):this.focus(source,'building',s.value.id);
  });return hit;
 }
}
