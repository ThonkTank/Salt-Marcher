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
import {posed,roadPoints} from '../city-model';
import {anchored,inside} from '../drawing-model';
import {volumeProjection} from '../volume-model';
import {LandscapeRasterizer} from '../landscape-raster';
import type {AtlasBinding} from '../campaign-atlas-contracts';
import type {CityHeader} from '../city-contracts';
const digest=(s:string)=>createHash('sha256').update(s).digest('hex');
const parse=(r:any)=>{if(!r||digest(r.payload)!==r.checksum)throw new Error('Kartendaten beschädigt. Originaldaten bleiben erhalten.');return JSON.parse(r.payload);};
type Box={x:number;y:number;width:number;height:number};
type Frame={x:number;y:number;angle:number};
type Shape={value:any;style?:ReturnType<typeof roomMapStyle>;polygons?:Polygon[];points?:Point[];stroke?:number};
const bounds=(points:Iterable<Point>,pad=0):Box=>{let x=Infinity,y=Infinity,xx=-Infinity,yy=-Infinity;for(const p of points){if(!Number.isFinite(p.x+p.y))throw new Error('Kontur prüfen.');x=Math.min(x,p.x);xx=Math.max(xx,p.x);y=Math.min(y,p.y);yy=Math.max(yy,p.y);}return{x:x-pad,y:y-pad,width:xx-x+pad*2,height:yy-y+pad*2};};
const corners=(b:Box)=>[{x:b.x,y:b.y},{x:b.x+b.width,y:b.y},{x:b.x+b.width,y:b.y+b.height},{x:b.x,y:b.y+b.height}];
const at=(p:Point,f:Frame):Point=>({x:f.x+p.x*Math.cos(f.angle)-p.y*Math.sin(f.angle),y:f.y+p.x*Math.sin(f.angle)+p.y*Math.cos(f.angle)});
const inverse=(p:Point,f:Frame):Point=>({x:(p.x-f.x)*Math.cos(f.angle)+(p.y-f.y)*Math.sin(f.angle),y:-(p.x-f.x)*Math.sin(f.angle)+(p.y-f.y)*Math.cos(f.angle)});
const overlap=(a:Box,b:Box)=>a.x<=b.x+b.width&&a.x+a.width>=b.x&&a.y<=b.y+b.height&&a.y+a.height>=b.y;
const distance=(p:Point,a:Point,b:Point)=>{const dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1)));return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy);};
const bytes=(v:unknown)=>Buffer.byteLength(JSON.stringify(v));
const pause=()=>new Promise<void>(resolve=>setImmediate(resolve));
/** Rebuildable TEMP projections on a readonly source connection. No author data is written. */
export class AtlasRegionReader {
 private statements=new Map<string,any>();
 private landscape:AtlasLandscapeReader;
 private landscapeFailure=false;
 private sql(text:string){let s=this.statements.get(text);if(!s){s=this.db.prepare(text);this.statements.set(text,s);}return s;}
 private readFaults=0;private countFaults=true;private ready=false;private indexed=true;private campaign='';private count=0;
 constructor(private db:any,shadow?:{filename:string;scopeId:string}){
  if(!db.readonly)throw new Error('Atlasprojektion benötigt eine readonly Datenbank.');
  db.pragma('cache_size = -8192');db.pragma('temp_store = FILE');db.pragma('temp.cache_size = -8192');
  this.landscape=new AtlasLandscapeReader(db);
  if(shadow){
   db.prepare('ATTACH DATABASE ? AS graph_preview').run(shadow.filename);
   const scope="'"+shadow.scopeId.replaceAll("'","''")+"'";
   // Scope-only overlays preserve canonical City/world tables and other Dungeons.
   for(const table of ['room','drawing_element','drawing_profile','drawing_hidden','drawing_floor','dungeon_volume','dungeon_key_content'])db.exec(`CREATE TEMP VIEW ${table} AS SELECT rowid AS rowid,* FROM main.${table} WHERE scope_id<>${scope} UNION ALL SELECT (SELECT coalesce(max(rowid),0) FROM main.${table})+rowid AS rowid,* FROM graph_preview.${table}`);
  }
  db.exec(`CREATE TEMP TABLE region_shape(key TEXT PRIMARY KEY,kind TEXT NOT NULL,owner TEXT NOT NULL,scope TEXT NOT NULL,floor TEXT NOT NULL,source_order INTEGER NOT NULL,min_x REAL,max_x REAL,min_y REAL,max_y REAL,payload TEXT NOT NULL);
   CREATE INDEX temp.region_shape_owner ON region_shape(kind,owner,scope,floor);
   CREATE TEMP TABLE region_problem(key TEXT PRIMARY KEY,id TEXT NOT NULL);
   CREATE TEMP TABLE region_extent(scope TEXT,floor TEXT,x REAL,y REAL,width REAL,height REAL,PRIMARY KEY(scope,floor));`);
  try{db.transaction(()=>db.exec(`CREATE VIRTUAL TABLE temp.region_index USING rtree(id,min_x,max_x,min_y,max_y);
   CREATE TEMP TRIGGER region_shape_insert AFTER INSERT ON region_shape BEGIN INSERT INTO region_index VALUES(new.rowid,new.min_x,new.max_x,new.min_y,new.max_y);END;
   CREATE TEMP TRIGGER region_shape_delete AFTER DELETE ON region_shape BEGIN DELETE FROM region_index WHERE id=old.rowid;END;
   CREATE TEMP TRIGGER region_shape_update AFTER UPDATE ON region_shape BEGIN DELETE FROM region_index WHERE id=old.rowid;INSERT INTO region_index VALUES(new.rowid,new.min_x,new.max_x,new.min_y,new.max_y);END;`))();}catch{this.indexed=false;}
 }
 private source(table:string,id:string){return this.sql(`SELECT rowid sourceOrder,* FROM ${table} WHERE campaign_id=? AND id=?`).get(this.campaign,id);}
 private store(kind:string,owner:string,scope:string,floor:string,id:string,value:Shape,sourceOrder:number){
  const pts=value.polygons?.flatMap(p=>[p.outer,...p.holes].flat())??value.points??[],b=bounds(pts,(value.stroke??0)/2);
  if(!Number.isFinite(b.x+b.y+b.width+b.height))return;
  this.sql('INSERT INTO temp.region_shape VALUES(?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(key) DO UPDATE SET source_order=excluded.source_order,kind=excluded.kind,owner=excluded.owner,scope=excluded.scope,floor=excluded.floor,min_x=excluded.min_x,max_x=excluded.max_x,min_y=excluded.min_y,max_y=excluded.max_y,payload=excluded.payload').run(kind+':'+id,kind,owner,scope,floor,sourceOrder,b.x,b.x+b.width,b.y,b.y+b.height,JSON.stringify(value));
 }
 private project(table:string,row:any){
  if(table==='city_document'){readCityHeader(this.db,this.campaign,row.id);return;}
  if(table==='room'){
   if(digest(row.payload)!==row.checksum)throw new Error('Raum beschädigt.');
   const polygons=JSON.parse(row.polygons??this.sql("SELECT json_extract(payload,'$.polygons') p FROM room WHERE campaign_id=? AND id=?").get(this.campaign,row.id).p);validateRoom({name:row.name,polygons,sections:[]});
   const value:RoomGeometry={id:row.id,scopeId:row.scope_id,floorId:row.floor_id,number:row.number,name:row.name,revision:row.revision,polygons};
   this.store('room','',row.scope_id,row.floor_id,row.id,{value,polygons},row.sourceOrder);
  }else if(table==='city_unit'){
   const u=parse(row);checkedUnit(u);if(u.id!==row.id||u.kind!==row.kind)throw new Error('Stadtelement widersprüchlich.');if(u.kind==='node')return;
   const {id,kind,name,protected:protectedValue,point,position,angle,width,interior}=u;
   let outline=u.outline,points:Point[]|undefined;
   if(['road','wall'].includes(kind)){
    const nodes=(u.nodeIds??[]).map((id:string)=>{const n=this.source('city_unit',id);if(n?.city_id!==row.city_id)throw new Error('Straßenknoten fehlt.');return parse(n);});
    points=roadPoints(u,nodes);if(points.length<2)throw new Error('Straßenknoten fehlt.');outline=points;
   }
   const value={id,kind,name,protected:protectedValue,point,position,angle,width,interior,outline};
   this.store('unit',row.city_id,'','',id,{value,...(points?{points,stroke:width??6}:{polygons:[{outer:kind==='building'?posed(value):outline??[],holes:[]}]})},row.sourceOrder);
  }else if(table==='drawing_element'){
   const e=parse(row);validateDrawingElement(e);if(e.id!==row.id||e.scopeId!==row.scope_id||e.floorId!==row.floor_id)throw new Error('Zeichnung widersprüchlich.');if(e.archived)return;
   const {notes:unused,content:unusedContent,...value}=e;
   if(e.content?.anchor&&e.roomId){const volume=readDungeonVolume(this.db,this.campaign,e.roomId),anchor=dungeonContentAnchor({drawing:{volumes:volume?[volume]:[]}},e);if(anchor){value.points=[anchor.point];value.zOffsetMeters=anchor.zOffsetMeters;value.anchor=null;}}
   if(value.anchor){const room=this.sql('SELECT payload FROM temp.region_shape WHERE key=?').get('room:'+value.anchor.roomId);const r=room?JSON.parse(room.payload).value:null;value.points=anchored(value,r?[r]:[]);value.anchor=null;}
   this.store('element','',row.scope_id,row.floor_id,row.id,{value,points:value.points,stroke:Math.max(value.width,value.height)*2},row.sourceOrder);
  }
 }
 private async update(table:string,id:string){
  const kind=table==='room'?'room':table==='city_unit'?'unit':table==='city_document'?'city':'element',key=kind+':'+id;
  this.sql('DELETE FROM temp.region_shape WHERE key=?').run(key);this.sql('DELETE FROM temp.region_problem WHERE key=?').run(key);
  const row=this.source(table,id);if(row)try{this.project(table,row);}catch{this.sql('INSERT OR REPLACE INTO temp.region_problem VALUES(?,?)').run(key,id);}
  if(++this.count%128===0)await pause();
 }
 async sync(source:AtlasRegionSource){
  this.campaign=source.campaignId;
  try{this.db.transaction(()=>this.landscape.sync(this.landscapeFailure?{...source,reset:true}:source))();this.landscapeFailure=false;}
  catch{this.landscapeFailure=true;}
  if(source.reset||!this.ready){
   this.db.exec('DELETE FROM temp.region_shape; DELETE FROM temp.region_problem;');
   for(const table of ['city_document','room','city_unit','drawing_element']){
    const fields=table==='room'?",CASE WHEN json_valid(payload) THEN json_extract(payload,'$.polygons') END polygons":'';
    let cursor=0;
    for(;;){
     const batch=this.sql(`SELECT rowid sourceOrder,*${fields} FROM ${table} WHERE campaign_id=? AND rowid>? ORDER BY rowid LIMIT 128`).all(this.campaign,cursor);
     if(!batch.length)break;
     for(const row of batch){try{this.project(table,row);}catch{this.sql('INSERT OR REPLACE INTO temp.region_problem VALUES(?,?)').run((table==='room'?'room':table==='city_unit'?'unit':table==='city_document'?'city':'element')+':'+row.id,row.id);}cursor=row.sourceOrder;}
     await pause();
    }
   }
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
  if(source.reset||!this.ready||source.changes.some(c=>['room','drawing_hidden','drawing_floor'].includes(c.table))){
   this.db.exec('DELETE FROM temp.region_extent');
   this.sql(`INSERT INTO temp.region_extent SELECT scope,floor,min(min_x),min(min_y),max(max_x)-min(min_x),max(max_y)-min(min_y) FROM temp.region_shape s WHERE kind='room' AND NOT EXISTS(SELECT 1 FROM drawing_hidden h WHERE h.campaign_id=? AND h.hidden=1 AND (h.kind='room' AND h.id=substr(s.key,6) OR h.kind='floor' AND h.scope_id=s.scope AND h.id=s.floor)) GROUP BY scope,floor`).run(this.campaign);
  }
  this.ready=true;
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
  const from=this.indexed?'temp.region_index i CROSS JOIN temp.region_shape s ON s.rowid=i.id':'temp.region_shape s',alias=this.indexed?'i':'s';
  return this.sql(`SELECT s.* FROM ${from} WHERE s.kind=? AND s.owner=? AND s.scope=? AND s.floor=? AND ${alias}.max_x>=? AND ${alias}.min_x<=? AND ${alias}.max_y>=? AND ${alias}.min_y<=? ORDER BY CASE WHEN s.kind='unit' THEN CASE json_extract(s.payload,'$.value.kind') WHEN 'building' THEN 2 WHEN 'road' THEN 1 WHEN 'wall' THEN 1 ELSE 0 END ELSE 0 END,s.source_order,s.key`).iterate(kind,owner,scope,floor,box.x,box.x+box.width,box.y,box.y+box.height);
 }
 private roomShape(row:any,q:AtlasRegionQuery):Shape|null{
  const s=JSON.parse(row.payload) as Shape,r=s.value as RoomGeometry;if(!this.roomVisible(r.id,r.scopeId,r.floorId))return null;s.style=roomMapStyle(this.db,this.campaign,r.id);
  if(q.slice!==null&&q.scopeId===r.scopeId){
   const elevation=this.sql('SELECT source_elevation z FROM drawing_floor WHERE campaign_id=? AND scope_id=? AND id=?').get(this.campaign,r.scopeId,r.floorId)?.z??0,v=this.sql('SELECT payload,checksum FROM dungeon_volume WHERE campaign_id=? AND room_id=?').get(this.campaign,r.id);
   let polygons:Polygon[];
   if(v)polygons=volumeProjection(parse(v),(q.slice-elevation)/1.524);
   else{const height=s.style?.ceilingMeters??3.048;polygons=q.slice>=elevation&&q.slice<elevation+height?r.polygons:[];}
   if(!polygons.length)return null;s.value={...r,polygons};s.polygons=polygons;
  }return s;
 }
 private visit(q:AtlasRegionQuery,emit:(shape:Shape,frame:Frame,kind:string,binding:AtlasBinding,header?:CityHeader)=>void,metadata?:(b:AtlasBinding,f:Frame,h?:CityHeader)=>void,searchBox?:Box){
  const mpp=q.box.width/q.width;
  // Workbench vectors paint all Cities first, then Dungeon contours.
  for(const row of this.sql("SELECT * FROM atlas_binding WHERE campaign_id=? ORDER BY CASE kind WHEN 'city' THEN 0 ELSE 1 END,rowid").iterate(this.campaign)){
   const b=this.binding(row);let f:Frame;try{f=this.frame(b);}catch{if(this.countFaults)this.readFaults++;continue;}
   const local=bounds(corners(searchBox??q.box).map(p=>inverse(p,f)));
   if(b.kind==='city'){
    let h:CityHeader;try{h=readCityHeader(this.db,this.campaign,b.ownerId);}catch{continue;}
    if(!overlap(bounds(corners({x:0,y:0,width:h.width,height:h.height}).map(p=>at(p,f))),q.box))continue;
    metadata?.(b,f,h);
    if(mpp>h.width/25){emit({value:{id:h.id,name:h.name},points:[{x:h.width/2,y:h.height/2}],stroke:mpp*12},f,'city-marker',b,h);continue;}
    emit({value:{id:h.id},polygons:[{outer:corners({x:0,y:0,width:h.width,height:h.height}),holes:[]}]},f,'city-paper',b,h);
    for(const r of this.candidates('unit',b.ownerId,'','',local)){const s=JSON.parse(r.payload);emit(s,f,'unit',b,h);}
   }else{
    const floor=b.ownerId===q.scopeId?q.floorId:'ground';
    if(b.parent==='building'&&q.roofs&&mpp>0.4&&b.ownerId!==q.scopeId)continue;
    const extent=this.sql('SELECT x,y,width,height FROM temp.region_extent WHERE scope=? AND floor=?').get(b.ownerId,floor)??{x:null};
    if(extent.x===null){if(b.ownerId===q.scopeId)metadata?.(b,f);if(b.parent==='world'&&overlap({x:f.x,y:f.y,width:0,height:0},q.box)){metadata?.(b,f);emit({value:{id:b.ownerId},points:[{x:0,y:0}],stroke:mpp*12},f,'scope-marker',b);}continue;}
    if(!overlap(bounds(corners(extent).map(p=>at(p,f))),q.box)){if(b.ownerId===q.scopeId)metadata?.(b,f);continue;}
    metadata?.(b,f);
    if(b.parent==='world'&&mpp>Math.max(1,extent.width/25)){emit({value:{id:b.ownerId},points:[{x:extent.x+extent.width/2,y:extent.y+extent.height/2}],stroke:mpp*12},f,'scope-marker',b);continue;}
    for(const r of this.candidates('room','',b.ownerId,floor,local))try{const s=this.roomShape(r,q);if(s)emit(s,f,'room',b);}catch{if(this.countFaults)this.readFaults++;}
    for(const r of this.candidates('element','',b.ownerId,floor,local))emit(JSON.parse(r.payload),f,'element',b);
   }
  }
 }
 read(source:AtlasRegionSource,q:AtlasRegionQuery):AtlasRegionGeometry{
  this.readFaults=0;this.countFaults=true;validateRegion(q);if(q.revision!==undefined&&q.revision!==source.revision||q.fence!==undefined&&q.fence!==source.fence)throw new Error('Atlas inzwischen geändert. Ausschnitt erneut laden.');
  const result:AtlasRegionGeometry={campaignId:source.campaignId,token:source.token,revision:source.revision,fence:source.fence,box:{...q.box},slice:q.slice,scopeId:q.scopeId,floorId:q.floorId,rooms:[],floors:[],drawing:emptyDrawing(),cities:[],bindings:[],scopes:[],frames:Object.create(null),scopeBounds:Object.create(null),interiors:Object.create(null),coverage:{complete:true,mode:'detail',objects:0,unreadable:this.sql('SELECT count(*) n FROM temp.region_problem').get().n,index:this.indexed?'rtree':'scan'}};
  let used=bytes(result),dense=false;const cities=new Map<string,AtlasRegionGeometry['cities'][number]>();
  const metadata=(b:AtlasBinding,f:Frame,h?:CityHeader)=>{
   if(dense||Object.hasOwn(result.frames,b.id))return;
   const scope=b.kind==='dungeon'?this.sql('SELECT id,name FROM scope WHERE campaign_id=? AND id=?').get(this.campaign,b.ownerId):null,
    floors=scope?this.sql('SELECT id,scope_id scopeId,name,source_elevation sourceElevation FROM drawing_floor f WHERE campaign_id=? AND scope_id=? AND NOT EXISTS(SELECT 1 FROM drawing_hidden h WHERE h.campaign_id=f.campaign_id AND h.id=f.id AND h.scope_id=f.scope_id AND h.kind=\'floor\' AND h.hidden=1)').all(this.campaign,b.ownerId):[];
   used+=bytes([b,f,h,scope,floors]);if(used>REGION_REPLY_BYTES-32768){dense=true;return;}
   result.bindings.push(b);result.frames[b.id]=f;if(scope){const e=this.sql('SELECT x,y,width,height FROM temp.region_extent WHERE scope=? AND floor=?').get(b.ownerId,b.ownerId===q.scopeId?q.floorId:'ground');if(e)result.scopeBounds[b.ownerId]=e;}if(scope){result.scopes.push(scope);result.floors.push(...floors);}
   if(h){const c={header:h,units:[]};cities.set(h.id,c);result.cities.push(c);}
  };
  this.visit(q,(s,_f,kind,b)=>{
   if(kind==='city-paper')return;result.coverage.objects++;if(result.coverage.objects>REGION_VECTOR_OBJECTS)dense=true;
   if(dense)return;
   const cost=bytes(s.value);if(used+cost>REGION_REPLY_BYTES-32768){dense=true;return;}used+=cost;
   if(kind==='room'){
    result.rooms.push(s.value);if(s.style){used+=bytes(s.style);result.drawing.styles.push(s.style);}
   }else if(kind==='unit'){cities.get(b.ownerId)?.units.push(s.value);if(s.value.kind==='building'){const child=this.sql("SELECT owner_id FROM atlas_binding WHERE campaign_id=? AND parent='building' AND parent_id=?").get(this.campaign,s.value.id);if(child){result.interiors[s.value.id]=child.owner_id;used+=bytes([s.value.id,child.owner_id]);}}}
   else if(kind==='element')result.drawing.elements.push(s.value);
  },metadata);
  if(bytes(result)>REGION_REPLY_BYTES-32768)dense=true;
  if(dense){
   this.countFaults=false;
   result.rooms=[];result.cities=[];result.bindings=[];result.frames=Object.create(null);result.scopeBounds=Object.create(null);result.interiors=Object.create(null);result.scopes=[];result.floors=[];result.drawing=emptyDrawing();result.coverage.mode='raster';
   // Keep the chosen author frame even when contours are represented by pixels.
   if(q.scopeId){const row=this.sql("SELECT * FROM atlas_binding WHERE campaign_id=? AND kind='dungeon' AND owner_id=?").get(this.campaign,q.scopeId);if(row){dense=false;metadata(this.binding(row),this.frame(this.binding(row)));dense=true;}}
   const width=Math.min(512,q.width),height=Math.max(1,Math.min(512,Math.round(width*q.height/q.width))),image=new LandscapeRasterizer(q.box,width,height);
   this.visit(q,(s,f,kind,_b,h)=>{
    const polygons=s.polygons?.map(p=>({outer:p.outer.map(p=>at(p,f)),holes:p.holes.map(r=>r.map(p=>at(p,f)))}));
    let color=kind==='city-paper'?h!.paper:kind==='unit'?s.value.kind==='water'?'#8eafb9':s.value.kind==='building'?h!.roof:'#d9c6a4':kind==='room'?'#e2dac4':s.value.color??'#685b50';
    if(kind==='room')color=s.style?.fill??color;
    if(polygons){image.paintPolygons(polygons,color);const pixel=q.box.width/width;for(const polygon of polygons){const extent=bounds(polygon.outer);if(extent.width<pixel||extent.height<pixel)image.paintLine([{x:extent.x+extent.width/2,y:extent.y+extent.height/2}],pixel,color);}}
    else if(s.points){const p=s.points.map(p=>at(p,f));image.paintLine(p,kind.endsWith('marker')?q.box.width/q.width*8:s.stroke??q.box.width/q.width*2,color);}
   });
   const data=PNG.sync.write({width,height,data:Buffer.from(image.finish())} as PNG).toString('base64');
   result.raster={box:{...q.box},width,height,data:'data:image/png;base64,'+data};
  }
  result.coverage.unreadable+=this.readFaults;result.coverage.complete=result.coverage.unreadable===0;
  try{if(this.landscapeFailure)throw Error('Landschaftsprojektion nicht verfügbar.');result.landscape=this.landscape.read(source,q,Math.max(8192,REGION_REPLY_BYTES-bytes(result)-1024));}catch(error){result.landscape={state:'error',records:[],tiles:[],coverage:{complete:false,mode:'raster',objects:0,references:0},error:'Landschaft nicht verfügbar. Erneut laden.'};}
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
  const s=JSON.parse(r.payload),row=this.sql('SELECT * FROM atlas_binding WHERE campaign_id=? AND kind=? AND owner_id=?').get(this.campaign,kind==='room'||kind==='element'?'dungeon':'city',kind==='room'||kind==='element'?r.scope:r.owner);if(!row)throw new Error('Objekt ist nicht im Atlas verortet.');
  if(kind==='room'&&!this.roomVisible(id,r.scope,r.floor))throw new Error('Raum ist archiviert.');
  const f=this.frame(this.binding(row)),box=bounds(corners({x:r.min_x,y:r.min_y,width:r.max_x-r.min_x,height:r.max_y-r.min_y}).map(p=>at(p,f)));
  const child=kind==='building'?this.sql("SELECT owner_id FROM atlas_binding WHERE campaign_id=? AND parent='building' AND parent_id=?").get(this.campaign,id):null;
  return{kind:kind==='room'?'room':kind==='element'?'element':s.value.kind==='building'?'building':'city-unit',id,...(child?{interiorScopeId:child.owner_id}:{}),...(kind==='room'||kind==='element'?{scopeId:r.scope,floorId:r.floor}:{cityId:r.owner}),box,point:{x:box.x+box.width/2,y:box.y+box.height/2},revision:source.revision};
 }
 candidatesAt(source:AtlasRegionSource,q:AtlasRegionQuery,p:Point,offset=0,layer:'geometry'|'landscape'|'all'='geometry'):AtlasHitPage{
  validateRegion(q);if(!p||!Number.isFinite(p.x+p.y)||!overlap({x:p.x,y:p.y,width:0,height:0},q.box)||!Number.isSafeInteger(offset)||offset<0)throw new Error('Kartenauswahl prüfen.');
  if(q.fence!==undefined&&q.fence!==source.fence)throw new Error('Atlas inzwischen geändert.');
  const landscapeHits=(offset:number):AtlasHitPage=>{try{if(this.landscapeFailure)throw Error('Landschaftsprojektion nicht verfügbar.');return this.landscape.hits(source,q,p,offset);}catch{return{items:[],total:0,next:null,fence:source.fence,unavailable:['landscape']};}};
  if(layer==='landscape')return landscapeHits(offset);
  if(layer==='all'){
   const geometry=this.candidatesAt(source,q,p,offset,'geometry'),landscape=landscapeHits(Math.max(0,offset-geometry.total)),items=[...geometry.items,...landscape.items].slice(0,40),total=geometry.total+landscape.total;
   return{items,total,next:offset+items.length<total?offset+items.length:null,fence:source.fence,...(geometry.unavailable||landscape.unavailable?{unavailable:[...(geometry.unavailable??[]),...(landscape.unavailable??[])]}:{})};
  }
  const items:AtlasHit[]=[];let matched=0,more=false;const radius=q.box.width/q.width*8;this.readFaults=0;this.countFaults=true;
  this.visit(q,(s,f,kind,b)=>{
   if(kind==='city-paper')return;const local=inverse(p,f),touch=s.polygons?inside(local,s.polygons):s.points?.some((v,i,a)=>i?distance(local,a[i-1]!,v)<=Math.max((s.stroke??0)/2,q.box.width/q.width*3):a.length===1&&Math.hypot(local.x-v.x,local.y-v.y)<=radius);
   if(!touch||matched++<offset)return;if(items.length>=40){more=true;return;}
   const focus=kind==='city-marker'?this.focus(source,'city',b.ownerId):kind==='scope-marker'?this.focus(source,'scope',b.ownerId):kind==='room'?this.focus(source,'room',s.value.id):kind==='element'?this.focus(source,'element',s.value.id):this.focus(source,'building',s.value.id);
   items.push({...focus,name:(kind==='room'?s.value.number+'. ':'')+(s.value.name||({room:'Raum',element:'Objekt','city-marker':'Stadt','scope-marker':'Dungeon',unit:'Stadtelement'}[kind]??'Objekt'))});
  },undefined,{x:p.x-radius,y:p.y-radius,width:radius*2,height:radius*2});return{items,next:more?offset+items.length:null,fence:source.fence,total:matched,...(this.readFaults||this.sql('SELECT 1 FROM temp.region_problem LIMIT 1').get()?{unavailable:['geometry'] as ('geometry')[]}: {})};
 }
 hit(source:AtlasRegionSource,q:AtlasRegionQuery,p:Point):AtlasObjectFocus|null{
  validateRegion(q);if(!p||!Number.isFinite(p.x+p.y)||!overlap({x:p.x,y:p.y,width:0,height:0},q.box))throw new Error('Kartenauswahl prüfen.');
  let hit:AtlasObjectFocus|null=null;this.visit(q,(s,f,kind,b)=>{
   if(kind==='city-paper')return;const local=inverse(p,f),touch=s.polygons?inside(local,s.polygons):s.points?.some((b,i,a)=>i?distance(local,a[i-1]!,b)<=Math.max((s.stroke??0)/2,q.box.width/q.width*3):a.length===1&&Math.hypot(local.x-b.x,local.y-b.y)<=q.box.width/q.width*8);
   if(touch)hit=kind==='city-marker'?this.focus(source,'city',b.ownerId):kind==='scope-marker'?this.focus(source,'scope',b.ownerId):kind==='room'?this.focus(source,'room',s.value.id):kind==='element'?this.focus(source,'element',s.value.id):this.focus(source,'building',s.value.id);
  });return hit;
 }
}
