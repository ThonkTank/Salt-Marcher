import {readTerrainGridSteps} from './terrain-grid';
import {readTerrainMaterialSteps} from './terrain-material';
import {terrainHeightBlocks} from './terrain-height-blocks';
import {AtlasProjectionIndex} from './atlas-projection-index';
import {compactVegetation} from '../vegetation-projection';
import {LANDSCAPE_BASE_INDEX,LANDSCAPE_COLOR_INDEX,LANDSCAPE_COVER_INDEX,landscapeColorRecords,landscapeCoverRecords,landscapeSampleFilter,type RasterSamples} from './landscape-record-stream';
import {TerrainChangeHistory} from '../terrain-change-history';
import {mapRecordVisible} from '../atlas-scale-policy';
import {landscapeLabels,boundedLabels,type MapLabelCandidate} from '../atlas-cartography';
import {readTerrainGrid} from './terrain-grid';
import {validateTerrainView} from '../terrain-spatial-model';
import {TerrainProjectionCache} from '../terrain-projection-cache';
import {readTerrainColorSteps} from './terrain-color';
import {readTerrainProjection,readTerrainProjectionSteps} from './terrain-projection';
import {vegetationEnvironmentReader} from './vegetation';
import {generateVegetation,VEGETATION_SURFACE_MPP} from '../vegetation';
import {streamTerrainField} from '../terrain-field-stream';
import { lineContains } from "../landscape-line";
import {PNG} from 'pngjs';
import type {Point} from '../contracts';
import {contains,bounds,landscapePaintBox,type LandscapeRecord,type LandscapeBox} from '../atlas-landscape';
import {LandscapeRasterizer,LANDSCAPE_RASTER_PAD,landscapeRasterBounds,landscapeRasterSlice,type LandscapeRaster} from '../landscape-raster';
import type {AtlasRegionQuery,AtlasRegionSource,AtlasLandscapeLayer,AtlasHitPage,AtlasHit} from '../atlas-region-contracts';
const overlap=(a:LandscapeBox,b:LandscapeBox)=>a.x<=b.x+b.width&&a.x+a.width>=b.x&&a.y<=b.y+b.height&&a.y+a.height>=b.y;
const visual=(r:LandscapeRecord):LandscapeRecord=>{const {label,route,id,revision,kind,name,points,polygons,resolution,width,order,style,locationId,assetId,imageWidth,imageHeight,angle,opacity,visible,locked,line,vegetation}=r;return{label,route,id,revision,kind,name,points,polygons,resolution,width,order,style,locationId,assetId,imageWidth,imageHeight,angle,opacity,visible,locked,line,vegetation,values:vegetation?{terrain:vegetation.preset.terrain}:{}};};
/** A bounded, disposable landscape layer. Exact edits never consume this projection. */
export class AtlasLandscapeReader {
 invalidation:import("../terrain-presentation").TerrainInvalidation={reset:true,bounds:[]};
 private colorHistory=new TerrainChangeHistory();
 readonly projectionCache=new TerrainProjectionCache();
 private statements=new Map<string,any>();
 private cache=new Map<string,{box:LandscapeBox;json:string;bytes:number}>();private bytes=0;private identity='';
 private indexed=true;private sampleMath=true;
 private placeLabelUnits=0;
 private terrainSignature="";private canonicalTerrain=false;
 private terrainSettingsIdentity="";private terrainSeaLevelM=0;private terrainSettingsReady=false;
 private terrainKinds=new Set<string>();
 private completeness:'none'|'field'|'full'='none';
 get complete(){return this.completeness==='full';}
 needsPreparation(mode:'full'|'field'){return this.completeness==='none'||mode==='full'&&!this.complete;}
 private projection:AtlasProjectionIndex;
 constructor(private db:any,private cacheLimit=8*1024*1024,projection?:AtlasProjectionIndex){
  this.projection=projection??AtlasProjectionIndex.temporary(db);
  const init=(sql:string)=>{if(this.projection.init(sql)){this.projection.forget('landscape');this.projection.forget('landscape-field');}};
  try{db.prepare('SELECT ceil(0),floor(0)').get();}catch{this.sampleMath=false;}
  init('CREATE TEMP TABLE landscape_shape_bounds(id TEXT PRIMARY KEY,source_row INTEGER NOT NULL,kind TEXT,terrain_kind TEXT,resolution REAL,paint_version INTEGER,paint_order REAL,payload_bytes INTEGER,min_x REAL NOT NULL,max_x REAL NOT NULL,min_y REAL NOT NULL,max_y REAL NOT NULL,CHECK(min_x<=max_x AND min_y<=max_y AND max(abs(min_x),abs(max_x),abs(min_y),abs(max_y))<=1.7976931348623157e308)) WITHOUT ROWID');
  init(LANDSCAPE_COLOR_INDEX);init(LANDSCAPE_COVER_INDEX);
  // Each field block reads these sparse kinds in canonical order. Cover bounds,
  // predicate and raw sort inputs too, so rejecting distant sources never
  // probes the much larger metadata table (including its base patches).
  for(const kind of ['height','route','lake'])init(`CREATE INDEX temp.landscape_${kind}_order ON landscape_shape_bounds(resolution DESC,coalesce(paint_order,0),source_row,min_x,max_x,min_y,max_y,terrain_kind,paint_order) WHERE terrain_kind='${kind}'`);
  init("CREATE INDEX temp.landscape_line_span ON landscape_shape_bounds(source_row) WHERE kind IN ('road','river')");
  init("CREATE INDEX temp.landscape_place_span ON landscape_shape_bounds(source_row) WHERE kind='place'");
  try{this.projection.transaction(()=>init(`CREATE VIRTUAL TABLE temp.landscape_region_index USING rtree(id,min_x,max_x,min_y,max_y);
   CREATE TEMP TRIGGER landscape_bound_insert AFTER INSERT ON landscape_shape_bounds WHEN new.kind IS NOT 'patch' BEGIN INSERT INTO landscape_region_index VALUES(new.source_row,new.min_x,new.max_x,new.min_y,new.max_y);END;
   CREATE TEMP TRIGGER landscape_bound_delete AFTER DELETE ON landscape_shape_bounds BEGIN DELETE FROM landscape_region_index WHERE id=old.source_row;END;`))();}catch{this.indexed=false;}
 }
 private metadata="CASE WHEN json_extract(payload,'$.height') IS NOT NULL THEN 'height' WHEN json_extract(payload,'$.route') IS NOT NULL THEN 'route' WHEN json_extract(payload,'$.paint') IS NOT NULL THEN 'color' WHEN json_extract(payload,'$.vegetation') IS NOT NULL THEN 'cover' WHEN json_extract(payload,'$.surface')='freshwater' THEN 'lake' WHEN json_extract(payload,'$.kind')='patch' AND (json_extract(payload,'$.values.terrain') IS NOT NULL OR json_extract(payload,'$.mask') IS NOT NULL) THEN 'base' END terrain_kind,CAST(json_extract(payload,'$.resolution') AS REAL) resolution,json_extract(payload,'$.paint.version') paint_version,json_extract(payload,'$.order') paint_order,length(CAST(payload AS BLOB)) payload_bytes";
 private sql(text:string){let s=this.statements.get(text);if(!s){s=this.db.prepare(this.projection.readSql(text));this.statements.set(text,s);}return s;}
 private meta(text:string){return this.projection.prepare(text);}
 private storeBounds(row:any){this.meta('INSERT INTO temp.landscape_shape_bounds VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').run(row.id,row.source_row,row.kind,row.terrain_kind,row.resolution,row.paint_version,row.paint_order,row.payload_bytes,row.min_x,row.max_x,row.min_y,row.max_y);}
 /** A field snapshot contains every physical anchor dependency, even outside
  * the camera. Promotion rebuilds from the current source rather than replaying
  * a cursor that already consumed omitted colour/place changes. */
 sync(source:AtlasRegionSource,requested:'full'|'field'='full'){
  const identity=JSON.stringify([source.campaignId,source.epoch,source.shadow?.epoch]);
  const full=requested==='full'||this.identity===identity&&this.complete||this.projection.valid('landscape',source);
  const part=full?'landscape':'landscape-field';
  const reset=this.identity!==identity||source.reset||this.completeness==='none'||full&&!this.complete;
  const settingsIdentity=JSON.stringify([source.campaignId,source.epoch,source.shadow?.epoch,source.fence]);
  let kindsChanged=reset;
  this.invalidation={reset,bounds:[]};
  const settings=this.sql("SELECT json_extract(payload,'$.terrainSettings') settings FROM atlas_landscape WHERE campaign_id=? AND json_valid(payload) AND json_extract(payload,'$.terrainSettings') IS NOT NULL").get(source.campaignId);
  const signature=settings?.settings??'',seaLevelM=settings?JSON.parse(settings.settings).seaLevelM:0;if(this.terrainSignature!==signature){this.invalidation.reset=true;this.cache.clear();this.bytes=0;this.terrainSignature=signature;}


  let labelsChanged=reset;
  if(reset){
   this.cache.clear();this.bytes=0;
   if(!this.projection.valid(part,source)){
    if(!full){
     // Preserve the global failures the full metadata copy would have exposed,
     // including unreadable offscreen records omitted by this field filter.
     if(this.sql('SELECT 1 FROM atlas_landscape WHERE campaign_id=? AND NOT json_valid(payload) LIMIT 1').get(source.campaignId)||
        this.sql('SELECT 1 FROM atlas_landscape WHERE campaign_id=? AND (min_x>max_x OR min_y>max_y OR max(abs(min_x),abs(max_x),abs(min_y),abs(max_y))>1.7976931348623157e308) LIMIT 1').get(source.campaignId))throw Error('Geländequelle beschädigt.');
    }
    this.projection.exec('DELETE FROM temp.landscape_shape_bounds');
    // Stream in the destination primary-key order. The canonical campaign/id
    // index supplies it without a global sort, keeping private-file writes local.
    this.projection.copy('landscape_shape_bounds',12,`SELECT id,CAST(rowid AS TEXT),CASE WHEN json_valid(payload) THEN json_extract(payload,'$.kind') END,${this.metadata},min_x,max_x,min_y,max_y FROM atlas_landscape WHERE campaign_id=?${full?'':" AND terrain_kind IN ('height','route','lake')"} ORDER BY id`,[source.campaignId]);
   }
  }else for(const c of source.changes){
   if(c.table==='location'){this.invalidation.reset=true;this.cache.clear();this.bytes=0;labelsChanged=true;continue;}
   if(['city_unit','city_document','atlas_binding'].includes(c.table)){
    this.invalidation.reset=true;labelsChanged=true;
    // Buildings affect vegetation exclusion, but not a terrain-only raster.
    if(this.sql("SELECT 1 FROM atlas_landscape WHERE campaign_id=? AND json_extract(payload,'$.vegetation') IS NOT NULL LIMIT 1").get(source.campaignId)){this.cache.clear();this.bytes=0;}
    continue;
   }
   if(c.table!=='atlas_landscape')continue;
   const old=this.meta('SELECT kind,terrain_kind,min_x x,min_y y,max_x-min_x width,max_y-min_y height FROM temp.landscape_shape_bounds WHERE id=?').get(c.id);
   const row=this.sql(`SELECT CAST(rowid AS TEXT) source_row,id,CASE WHEN json_valid(payload) THEN json_extract(payload,'$.kind') END kind,${this.metadata},min_x,max_x,min_y,max_y FROM atlas_landscape WHERE campaign_id=? AND id=?`).get(source.campaignId,c.id);
   if(old?.terrain_kind!==row?.terrain_kind)kindsChanged=true;
   const current=row?{x:row.min_x,y:row.min_y,width:row.max_x-row.min_x,height:row.max_y-row.min_y}:null;
   const dirty=c.terrainBounds?[c.terrainBounds]:[old,current].filter((b):b is NonNullable<typeof b>=>!!b);
   for(const b of dirty)if(!this.invalidation.reset){if(this.invalidation.bounds.length>=2048){this.invalidation={reset:true,bounds:[]};break;}this.invalidation.bounds.push({x:b.x,y:b.y,width:b.width,height:b.height});}
   if(old?.kind==='place'||row?.kind==='place')labelsChanged=true;
   for(const [key,v]of this.cache)if(dirty.some(b=>overlap(v.box,b))){this.bytes-=v.bytes;this.cache.delete(key);}
   this.meta('DELETE FROM temp.landscape_shape_bounds WHERE id=?').run(c.id);
   if(row){
    if(![row.min_x,row.max_x,row.min_y,row.max_y].every(Number.isFinite)||row.min_x>row.max_x||row.min_y>row.max_y)throw Error('Geländequelle beschädigt.');
    if(full||['height','route','lake'].includes(row.terrain_kind))this.storeBounds(row);
   }
  }
  // UTF-8 bytes conservatively bound JS text units too. Read only sparse place
  // rows on source/name changes; camera reads never rescan the author corpus.
  if(full&&labelsChanged){
   this.placeLabelUnits=0;
   const names=this.sql(`SELECT coalesce(max(length(CAST(coalesce(json_extract(l.payload,'$.name'),json_extract(a.payload,'$.name'),'') AS BLOB))),0) n FROM json_each(?) ids CROSS JOIN atlas_landscape a ON a.rowid=ids.value LEFT JOIN location l ON l.campaign_id=a.campaign_id AND l.id=json_extract(a.payload,'$.locationId') WHERE a.campaign_id=? AND coalesce(l.trashed,0)=0`);
   const read=(ids:string[])=>{if(ids.length)this.placeLabelUnits=Math.max(this.placeLabelUnits,names.get(JSON.stringify(ids),source.campaignId).n);};
   let ids:string[]=[];
   for(const row of this.meta("SELECT CAST(source_row AS TEXT) id FROM temp.landscape_shape_bounds WHERE kind='place'").iterate()){ids.push(row.id);if(ids.length===128){read(ids);ids=[];}}
   read(ids);
  }
  // Empty categories are common (a height-only world has no routes, lakes,
  // pigment or vegetation). Discover them once per metadata change, not once
  // per small grid/shading block. A new or removed kind is visible in this sync.
  if(kindsChanged){
   this.terrainKinds.clear();
   for(const row of this.meta('SELECT DISTINCT terrain_kind FROM temp.landscape_shape_bounds WHERE terrain_kind IS NOT NULL').iterate())this.terrainKinds.add(row.terrain_kind);
  }
  this.canonicalTerrain=!!settings||this.terrainKinds.has('height')||this.terrainKinds.has('route');
  this.projectionCache.invalidate(this.invalidation.bounds,this.invalidation.reset);
  this.identity=identity;this.terrainSettingsIdentity=settingsIdentity;this.terrainSeaLevelM=seaLevelM;this.terrainSettingsReady=true;
  this.colorHistory.record(source,this.invalidation);
  if(full)this.projection.mark('landscape',source);else this.projection.forget('landscape');
  this.projection.mark('landscape-field',source);
  this.completeness=full?'full':'field';
 }

 rollback(){this.completeness='none';this.identity='';this.terrainSettingsReady=false;this.projectionCache.invalidate([],true);}
 private requireFull(){if(!this.complete)throw Error('Vollständige Landschaft muss zuerst synchronisiert werden.');}

 visibility(source:AtlasRegionSource,view:import('../terrain-spatial-model').TerrainView){
  const identity=JSON.stringify([source.campaignId,source.epoch,source.shadow?.epoch,source.fence]),settings=this.terrainSettingsReady&&this.terrainSettingsIdentity===identity?{seaLevelM:this.terrainSeaLevelM}:undefined;
  return readTerrainGrid(this.db,source.campaignId,view,this.terrainStream(source),this.projectionCache,settings);
 }
 /** Keep the full 3x3 source neighbourhood, including corruption checks, but
  * retain only its scalar anchor for cross-tile reuse. Decoded height blocks
  * and anchors share the existing bounded LRU with display rasters. */
 geometryHeight(source:AtlasRegionSource,point:Point):number{
  const box={x:point.x-.5,y:point.y-.5,width:1,height:1},view={box,frame:box,columns:3,rows:3,focusM:0,tilt:0,rotation:0,exaggeration:1};
  validateTerrainView(view);
  const identity=JSON.stringify([source.campaignId,source.epoch,source.shadow?.epoch,source.fence]);
  if(!this.terrainSettingsReady||this.terrainSettingsIdentity!==identity)return this.visibility(source,view).heights[4]!;
  return this.projectionCache.geometryAnchor(point.x,point.y,this.terrainSeaLevelM,()=>streamTerrainField({x:box.x,y:box.y,dx:.5,dy:.5,columns:3,rows:3},this.terrainSeaLevelM,this.terrainStream(source),true).surface![4]!);
 }
 private *rows(source:AtlasRegionSource,box:LandscapeBox,patches:boolean,pixels:RasterSamples=0,mpp=0,kind?:'height'|'route'|'lake'|'color'|'cover'|'base'|'line'){
  if(kind&&kind!=='line'&&!this.terrainKinds.has(kind))return;
  const search=landscapePaintBox(box,mpp,this.placeLabelUnits);
  // Terrain already has canonical bounded columns. Index only sparse objects:
  // building another 100k-row Rtree before the first view costs more than its scans.
  const indexed=this.indexed&&!patches,line=kind==='line';
  // A patch whose bounds contain no supersample center cannot change this tile.
  // Conservative epsilon and clipping match Rasterizer's 2x sample lattice.
  const sampleFilter=landscapeSampleFilter(box,pixels,patches&&this.sampleMath);
  if(kind==='cover'){yield* landscapeCoverRecords(text=>this.sql(text),source.campaignId,search,sampleFilter);return;}
  if(kind==='color'){yield* landscapeColorRecords(text=>this.sql(text),source.campaignId,search,sampleFilter);return;}
  const filter=kind?"m.terrain_kind='"+kind+"'":"m.terrain_kind IS NOT NULL";
  // Colour projection only needs route lines. Use the small kind index before
  // fetching payloads, rather than loading every place and vegetation object.
  const objects=line?'temp.landscape_shape_bounds m CROSS JOIN atlas_landscape a ON a.rowid=m.source_row':indexed?'temp.landscape_region_index i CROSS JOIN atlas_landscape a ON a.rowid=i.id':'atlas_landscape a';
  const range=line?'m':indexed?'i':'a',objectKinds=line?"m.kind IN ('road','river')":"json_extract(a.payload,'$.kind')!='patch'";
  const sql=patches
   ?`SELECT CAST(m.source_row AS TEXT) source_row FROM temp.landscape_shape_bounds m WHERE m.max_x>=? AND m.min_x<=? AND m.max_y>=? AND m.min_y<=? ${sampleFilter.sql} AND ${filter} ORDER BY m.resolution DESC,coalesce(m.paint_order,0),m.source_row`
   :`SELECT CAST(a.rowid AS TEXT) source_row FROM ${objects} WHERE a.campaign_id=? AND ${range}.max_x>=? AND ${range}.min_x<=? AND ${range}.max_y>=? AND ${range}.min_y<=? AND ${objectKinds} ORDER BY CASE WHEN json_extract(a.payload,'$.kind')='reference' THEN 0 WHEN json_extract(a.payload,'$.line.overSymbols')=1 THEN 3 WHEN json_extract(a.payload,'$.line') IS NOT NULL THEN 1 ELSE 2 END,CAST(json_extract(a.payload,'$.resolution') AS REAL) DESC,coalesce(json_extract(a.payload,'$.order'),0),a.rowid`;
  // Sort narrow keys, then read complete bounded pages. Sorting full payloads
  // spills authors' large contours/prose into SQLite temporary files.
  const page=this.sql(`SELECT CAST(a.rowid AS TEXT) source_row,a.payload,a.min_x,a.max_x,a.min_y,a.max_y,json_extract(l.payload,'$.name') location_name,l.trashed FROM json_each(?) ids CROSS JOIN atlas_landscape a ON a.rowid=ids.value LEFT JOIN location l ON l.campaign_id=a.campaign_id AND l.id=json_extract(a.payload,'$.locationId') WHERE a.campaign_id=? ORDER BY CAST(ids.key AS INTEGER)`);
  const readPage=function*(ids:string[]){
   // SQLite bounds its temporary sort with the existing file/cache budget.
   // Stream the page so 128 unusually large author payloads never accumulate in JS.
   for(const row of page.iterate(JSON.stringify(ids),source.campaignId)){if(row.trashed)continue;const record=JSON.parse(row.payload) as LandscapeRecord;
    if(row.location_name!==null)record.name=row.location_name;
    const paint=landscapePaintBox(box,mpp,record.kind==='place'?record.name.length:undefined);
    if(row.max_x<paint.x||row.min_x>paint.x+paint.width||row.max_y<paint.y||row.min_y>paint.y+paint.height)continue;
    if(record.kind==='reference'&&record.visible===false)continue;
    yield record;
   }
  };
  let ids:string[]=[];
  const args:any[]=[...(patches?[]:[source.campaignId]),search.x,search.x+search.width,search.y,search.y+search.height];
  args.push(...sampleFilter.args);
  for(const row of this.sql(sql).iterate(...args)){
   ids.push(row.source_row);if(ids.length===128){yield*readPage(ids);ids=[];}
  }
  if(ids.length)yield*readPage(ids);
 }
 private *lines(source:AtlasRegionSource,box:LandscapeBox){yield* this.rows(source,box,false,0,0,'line');}
 /** Read only height records whose interpolation support touches a sample.
  * The source bounds already include the two-cell Hermite neighbourhood. */
 private terrainStream(source:AtlasRegionSource):import('./terrain-color-raster').ProjectionStream{
  const stream:import('./terrain-color-raster').ProjectionStream=(kind,box,samples)=>kind==='line'?this.lines(source,box):this.rows(source,box,true,samples?{width:samples.columns/2,height:samples.rows/2}:0,0,kind);
  stream.heightSources=(box,samples)=>this.terrainKinds.has('height')?terrainHeightBlocks(text=>this.sql(text),this.projectionCache,source.campaignId,box,samples,this.sampleMath):[];
  return stream;
 }
 *heightSteps(source:AtlasRegionSource,q:import('../terrain-projection').TerrainProjectionRequest):Generator<void,import('../terrain-projection').TerrainProjection>{
  this.requireFull();
  let start=performance.now();function* checkpoint(){if(performance.now()-start>=8){yield;start=performance.now();}}
  const grid=yield* readTerrainGridSteps(this.db,source.campaignId,q.view,checkpoint,this.terrainStream(source),this.projectionCache);
  return {heightOnly:true,revision:source.revision,fence:source.fence,source:source.fence,generation:0,grid,pixels:new Uint8Array(0),width:0,height:0,draft:false};
 }
 materialSteps(source:AtlasRegionSource,q:import('../atlas-material-tile').AtlasMaterialTileRequest,channels:ReadonlySet<import('../terrain-material').TerrainMaterialChannel>){
  this.requireFull();
  return readTerrainMaterialSteps(this.db,source,q,this.terrainStream(source),channels);
 }
 terrain(source:AtlasRegionSource,q:import('../terrain-projection').TerrainProjectionRequest){
  this.requireFull();
  const projection=readTerrainProjection(this.db,source,q,this.terrainStream(source),this.projectionCache);
  return {...projection,colorChange:q.colorBase?this.colorHistory.since(q.colorBase):undefined};
 }
 colorSteps(source:AtlasRegionSource,q:import('../terrain-color').TerrainColorRequest){
  this.requireFull();
  // Leave the first terrain overview unblocked. SQLite owns maintenance and
  // rollback; no separate build cursor or index-validity state is needed.
  if(this.terrainKinds.has('base'))this.projection.init(LANDSCAPE_BASE_INDEX);
  return readTerrainColorSteps(this.db,source,q,this.terrainStream(source),this.projectionCache);
 }
 *terrainSteps(source:AtlasRegionSource,q:import('../terrain-projection').TerrainProjectionRequest):Generator<void,import('../terrain-projection').TerrainProjection>{
  this.requireFull();
  const colorChange=q.colorBase?this.colorHistory.since(q.colorBase):undefined;
  const projection=yield* readTerrainProjectionSteps(this.db,source,q,this.terrainStream(source),this.projectionCache);
  return {...projection,colorChange};
 }
 read(source:AtlasRegionSource,q:AtlasRegionQuery,budget:number,forceRaster=false,checkpoint?:()=>void):AtlasLandscapeLayer{
  this.requireFull();
  checkpoint?.();
  const terrain=q.terrainRaster!==false||q.perception===true;
  const setting=this.sql("SELECT payload FROM atlas_landscape WHERE campaign_id=? AND json_valid(payload) AND json_extract(payload,'$.terrainSettings') IS NOT NULL").get(source.campaignId);
  const layer:AtlasLandscapeLayer={...(setting&&JSON.parse(setting.payload).terrainSettings.style?{terrainStyle:JSON.parse(setting.payload).terrainSettings.style}:{}),seaLevelM:setting?JSON.parse(setting.payload).terrainSettings.seaLevelM:0,state:'ready',records:[],tiles:[],coverage:{complete:true,mode:'detail',objects:0,references:0}};
  let labelCandidates:MapLabelCandidate[]=[];
  const environment=vegetationEnvironmentReader(this.db,source.campaignId,q.box,q.box.width/q.width);
  const vectorBudget=Math.min(512*1024,budget/3);
  let used=0,dense=forceRaster,referenceBytes=0,protectedBytes=0,rasterObjects=false;const references:LandscapeRecord[]=[],protectedCovers:LandscapeRecord[]=[];
  for(const r of this.rows(source,q.box,false,0,q.box.width/q.width)){
   checkpoint?.();
   if(q.references===false&&r.kind==='reference')continue;
   if(!q.perception&&(q.terrainRaster===false||mapRecordVisible(r,q.box.width/q.width)))labelCandidates.push(...landscapeLabels(r,q.box));if(labelCandidates.length>2400)labelCandidates=boundedLabels(labelCandidates,q.box);
   layer.coverage.objects++;if(r.kind==='reference')layer.coverage.references++;
   // Track possible ink independently of labels and exact hit coverage. The
   // fallback samples at this scale or coarser, so an automatic surface-only
   // cover cannot add crowns there. Overrides are conservative even offscreen.
   if(r.vegetation)rasterObjects||=q.box.width/q.width<=VEGETATION_SURFACE_MPP||r.vegetation.overrides.some(o=>!o.removed);
   else if(r.kind==='road'||r.kind==='river'||r.kind==='place')rasterObjects||=mapRecordVisible(r,q.box.width/q.width);
   const record=visual(r),vegetation=r.vegetation?generateVegetation(r,environment,q.box,q.box.width/q.width):undefined;
   if(vegetation)record.vegetationView=vegetation;
   let size=Buffer.byteLength(JSON.stringify(record));if(r.kind==='reference'){referenceBytes+=size;if(references.length<16&&referenceBytes<=128*1024)references.push(record);}
   if(vegetation?.instances.some(i=>i.protected)){
    const protectedRecord={...record,vegetationView:{...vegetation,instances:vegetation.instances.filter(i=>i.protected)}},
      bytes=Buffer.byteLength(JSON.stringify(protectedRecord));
    if(protectedBytes+bytes<=Math.min(128*1024,budget/8)){protectedCovers.push(protectedRecord);protectedBytes+=bytes;}
   }
   // Preserve the inexpensive ordinary path while it fits. Compact only when
   // the accumulated layer would otherwise lose individual geometry to raster.
   if(!dense&&layer.coverage.objects<=500&&layer.coverage.references<=16&&used+size>vectorBudget){
    for(const previous of layer.records)if(previous.vegetationView&&'instances' in previous.vegetationView)previous.vegetationView=compactVegetation(previous.vegetationView);
    used=layer.records.reduce((sum,r)=>sum+Buffer.byteLength(JSON.stringify(r)),0);
    if(vegetation)record.vegetationView=compactVegetation(vegetation);
    size=Buffer.byteLength(JSON.stringify(record));
   }
   if(layer.coverage.objects>500||layer.coverage.references>16||used+size>vectorBudget){dense=true;layer.records=[];}else if(!dense){used+=size;layer.records.push(record);}
  }
  layer.labels=boundedLabels(labelCandidates,q.box);
  layer.coverage.mode=dense?'raster':'detail';const exactReferences=layer.coverage.references<=16&&referenceBytes<=128*1024;if(dense)layer.records=[...(exactReferences?references:[]),...protectedCovers];
  // Dense hidden symbols need no second object pass or transparent PNGs.
  // Exact reference images and protected objects remain in layer.records;
  // excess references still require their visible raster outlines.
  if(!terrain&&(!dense||!rasterObjects&&(exactReferences||!layer.coverage.references)))return layer;
  if(!setting&&!dense&&!this.sql("SELECT 1 FROM atlas_landscape WHERE campaign_id=? AND json_extract(payload,'$.kind') IN ('patch','vegetation') AND max_x>=? AND min_x<=? AND max_y>=? AND min_y<=? LIMIT 1").get(source.campaignId,q.box.x,q.box.x+q.box.width,q.box.y,q.box.y+q.box.height))return layer;
  // At most four world-aligned tiles; a smaller detail level is explicit display aggregation.
  let edge=2**Math.ceil(Math.log2(Math.max(q.box.width,q.box.height)));
  if(!Number.isFinite(edge)||edge<=0||q.box.x+q.box.width===q.box.x||q.box.y+q.box.height===q.box.y)throw new Error('Ausschnitt nicht präzise darstellbar.');
  const boxes=()=>{const rows:LandscapeBox[]=[];for(let y=Math.floor(q.box.y/edge);y<=Math.ceil((q.box.y+q.box.height)/edge)-1;y++)for(let x=Math.floor(q.box.x/edge);x<=Math.ceil((q.box.x+q.box.width)/edge)-1;x++)rows.push({x:x*edge,y:y*edge,width:edge,height:edge});return rows;};
  let regions=boxes();while(regions.length>4){edge*=2;regions=boxes();}
  for(let pixels=Math.min(1024,2**Math.ceil(Math.log2(Math.max(256,edge/(q.box.width/q.width)))));pixels>=16;pixels/=2){
   layer.tiles=[];
   for(const region of regions){
    checkpoint?.();
    const {box,width,height}=landscapeRasterSlice(region,pixels,q.box);
    const key=JSON.stringify([source.campaignId,box,width,height,dense,terrain,q.box.width/q.width,q.references!==false,exactReferences,q.contours??0]),hit=this.cache.get(key);
    let json=hit?.json;
    if(hit){this.cache.delete(key);this.cache.set(key,hit);}
    if(!json){
     const image=new LandscapeRasterizer(box,width,height,terrain?q.contours:0,q.box.width/q.width);
     if(terrain){
      checkpoint?.();
      if(setting)image.paint(JSON.parse(setting.payload));const samplePixels={width:width+2*LANDSCAPE_RASTER_PAD,height:height+2*LANDSCAPE_RASTER_PAD};
      if(this.canonicalTerrain){
       // Small source files can still cover millions of output samples. Share
       // the bounded lattice sampler with the spatial projection at every size.
       image.setTerrainField(streamTerrainField(image.sampleLattice(),layer.seaLevelM??0,(kind,band)=>{checkpoint?.();return this.rows(source,band,true,0,0,kind);},false));
       for(const r of this.rows(source,image.sampleBox,true,samplePixels,0,'base')){checkpoint?.();image.paint(r);}
      }else for(const r of this.rows(source,image.sampleBox,true,samplePixels)){checkpoint?.();if(!r.paint&&!r.vegetation)image.paint(r);}
      for(const r of this.rows(source,image.sampleBox,true,samplePixels,0,'cover')){checkpoint?.();image.paintCover(r);}
      // Order in SQL, then paint one record at a time. No spread/sort of the author corpus.
      for(const r of this.rows(source,image.sampleBox,true,samplePixels,0,'color')){checkpoint?.();image.paintColor(r);}
     }
     let tileEnvironment:ReturnType<typeof vegetationEnvironmentReader>|undefined;
     if(dense)for(const r of this.rows(source,box,false,0,Math.max(q.box.width/q.width,edge/pixels))){
      checkpoint?.();
      if(r.vegetation){
       // A raster fallback represents groups, even when its tile happens to be
       // sampled at exactly 2 m/px. Generating every local blade on a padded
       // 2048 m tile can otherwise exceed the candidate budget and blank the map.
       const displayMpp=Math.max(2.01,q.box.width/q.width,edge/pixels),
         environment=tileEnvironment??=vegetationEnvironmentReader(this.db,source.campaignId,box,displayMpp),
         view=generateVegetation(r,environment,box,displayMpp),
         overlay=protectedCovers.some(c=>c.id===r.id);
       for(const i of view.instances)if(!overlay||!i.protected)image.paintLine([i],Math.max(i.size*.6,edge/pixels*2),i.asset==='rock'?'#807967':'#4e6c48');
      }
      else if(r.kind==='road'||r.kind==='river')image.paintRecordLine(r,q.box.width/q.width);
      else if(r.kind==='place'&&mapRecordVisible(r,q.box.width/q.width))image.paintLine(r.points,Math.max(q.box.width/q.width*10,edge/pixels),'#5b4338');
      else if(r.kind==='reference'&&q.references!==false&&!exactReferences){const b=bounds(r);image.paintLine([{x:b.x,y:b.y},{x:b.x+b.width,y:b.y},{x:b.x+b.width,y:b.y+b.height},{x:b.x,y:b.y+b.height},{x:b.x,y:b.y}],edge/pixels,'#75604e');}
     }
     checkpoint?.();
     const data=PNG.sync.write({width,height,data:Buffer.from(image.finish())} as PNG).toString('base64');
     json=JSON.stringify({...(!terrain?{content:'objects'}:{}),campaignId:source.campaignId,revision:source.revision,box,width,height,data:'data:image/png;base64,'+data});
     const bytes=json.length*2;while(this.bytes+bytes>this.cacheLimit&&this.cache.size){const [k,v]=this.cache.entries().next().value!;this.bytes-=v.bytes;this.cache.delete(k);}if(bytes<=this.cacheLimit){this.cache.set(key,{box:landscapePaintBox(landscapeRasterBounds(box,width,height),Math.max(q.box.width/q.width,edge/pixels),this.placeLabelUnits),json,bytes});this.bytes+=bytes;}
    }
    checkpoint?.();
    const tile=JSON.parse(json) as LandscapeRaster;tile.revision=source.revision;layer.tiles.push(tile);
   }
   if(Buffer.byteLength(JSON.stringify(layer))<=budget)return layer;
  }
  return{state:'error',records:[],tiles:[],coverage:{...layer.coverage,complete:false},error:'Landschaftsausschnitt nicht verfügbar. Kleineren Ausschnitt wählen oder erneut laden.'};
 }
 hits(source:AtlasRegionSource,q:AtlasRegionQuery,p:Point,offset=0):AtlasHitPage{
  this.requireFull();
  const mpp=q.box.width/q.width,tolerance=mpp*6,box={x:p.x-tolerance,y:p.y-tolerance,width:tolerance*2,height:tolerance*2},items:AtlasHit[]=[];let skipped=0,more=false;
  for(const r of this.rows(source,box,false)){
   const touch=r.kind==='vegetation'?contains(p,r.polygons):r.kind==='reference'?(()=>{const a=-(r.angle??0),dx=p.x-r.points[0]!.x,dy=p.y-r.points[0]!.y,x=dx*Math.cos(a)-dy*Math.sin(a),y=dx*Math.sin(a)+dy*Math.cos(a);return x>=0&&x<=r.width&&y>=0&&y<=r.width*(r.imageHeight??1)/(r.imageWidth??1);})():r.kind==='place'?Math.hypot(p.x-r.points[0]!.x,p.y-r.points[0]!.y)<=tolerance:lineContains(r,p,tolerance);
   if(!touch)continue;if(skipped++<offset)continue;if(items.length===40){more=true;continue;}
   const b=bounds(r);items.push({kind:'landscape',id:r.id,name:r.name||({road:'Weg',river:'Fluss',place:'Ort',reference:'Bildvorlage',patch:'Gelände',vegetation:'Landschaftsbestand'}[r.kind]),landscapeKind:r.kind,point:{x:b.x+b.width/2,y:b.y+b.height/2},box:b,revision:r.revision});
  }
  return{items,next:more?offset+items.length:null,fence:source.fence,total:skipped};
 }
}
