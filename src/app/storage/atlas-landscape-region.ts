import { lineContains } from "../landscape-line";
import {PNG} from 'pngjs';
import type {Point} from '../contracts';
import {bounds,landscapePaintBox,type LandscapeRecord,type LandscapeBox} from '../atlas-landscape';
import {LandscapeRasterizer,LANDSCAPE_RASTER_PAD,landscapeRasterBounds,type LandscapeRaster} from '../landscape-raster';
import type {AtlasRegionQuery,AtlasRegionSource,AtlasLandscapeLayer,AtlasHitPage,AtlasHit} from '../atlas-region-contracts';
const overlap=(a:LandscapeBox,b:LandscapeBox)=>a.x<=b.x+b.width&&a.x+a.width>=b.x&&a.y<=b.y+b.height&&a.y+a.height>=b.y;
const visual=(r:LandscapeRecord):LandscapeRecord=>{const {id,revision,kind,name,points,polygons,resolution,width,order,style,locationId,assetId,imageWidth,imageHeight,angle,opacity,visible,locked,line}=r;return{id,revision,kind,name,points,polygons,resolution,width,order,style,locationId,assetId,imageWidth,imageHeight,angle,opacity,visible,locked,line,values:{}};};
/** A bounded, disposable landscape layer. Exact edits never consume this projection. */
export class AtlasLandscapeReader {
 private statements=new Map<string,any>();
 private cache=new Map<string,{box:LandscapeBox;json:string;bytes:number}>();private bytes=0;private identity='';
 private indexed=true;private sampleMath=true;
 private placeLabelUnits=0;
 constructor(private db:any,private cacheLimit=8*1024*1024){
  try{db.prepare('SELECT ceil(0),floor(0)').get();}catch{this.sampleMath=false;}
  db.exec('CREATE TEMP TABLE landscape_shape_bounds(id TEXT PRIMARY KEY,source_row INTEGER NOT NULL,kind TEXT,min_x REAL NOT NULL,max_x REAL NOT NULL,min_y REAL NOT NULL,max_y REAL NOT NULL,CHECK(min_x<=max_x AND min_y<=max_y AND max(abs(min_x),abs(max_x),abs(min_y),abs(max_y))<=1.7976931348623157e308)) WITHOUT ROWID');
  db.exec("CREATE INDEX temp.landscape_place_span ON landscape_shape_bounds(source_row) WHERE kind='place'");
  try{db.transaction(()=>db.exec(`CREATE VIRTUAL TABLE temp.landscape_region_index USING rtree(id,min_x,max_x,min_y,max_y);
   CREATE TEMP TRIGGER landscape_bound_insert AFTER INSERT ON landscape_shape_bounds WHEN new.kind IS NOT 'patch' BEGIN INSERT INTO landscape_region_index VALUES(new.source_row,new.min_x,new.max_x,new.min_y,new.max_y);END;
   CREATE TEMP TRIGGER landscape_bound_delete AFTER DELETE ON landscape_shape_bounds BEGIN DELETE FROM landscape_region_index WHERE id=old.source_row;END;`))();}catch{this.indexed=false;}
 }
 private sql(text:string){let s=this.statements.get(text);if(!s){s=this.db.prepare(text);this.statements.set(text,s);}return s;}
 sync(source:AtlasRegionSource){
  const identity=JSON.stringify([source.campaignId,source.epoch,source.shadow?.epoch]);
  let labelsChanged=this.identity!==identity||source.reset;
  if(this.identity!==identity||source.reset){
   this.cache.clear();this.bytes=0;this.db.exec('DELETE FROM temp.landscape_shape_bounds');
   this.sql(`INSERT INTO temp.landscape_shape_bounds SELECT id,rowid,CASE WHEN json_valid(payload) THEN json_extract(payload,'$.kind') END,min_x,max_x,min_y,max_y FROM atlas_landscape WHERE campaign_id=?`).run(source.campaignId);
  }else for(const c of source.changes){
   if(c.table==='location'){this.cache.clear();this.bytes=0;labelsChanged=true;continue;}
   if(c.table!=='atlas_landscape')continue;
   const old=this.sql('SELECT kind,min_x x,min_y y,max_x-min_x width,max_y-min_y height FROM temp.landscape_shape_bounds WHERE id=?').get(c.id);
   const row=this.sql(`SELECT rowid source_row,id,CASE WHEN json_valid(payload) THEN json_extract(payload,'$.kind') END kind,min_x,max_x,min_y,max_y FROM atlas_landscape WHERE campaign_id=? AND id=?`).get(source.campaignId,c.id);
   const current=row?{x:row.min_x,y:row.min_y,width:row.max_x-row.min_x,height:row.max_y-row.min_y}:null;
   if(old?.kind==='place'||row?.kind==='place')labelsChanged=true;
   for(const [key,v]of this.cache)if(old&&overlap(v.box,old)||current&&overlap(v.box,current)){this.bytes-=v.bytes;this.cache.delete(key);}
   this.sql('DELETE FROM temp.landscape_shape_bounds WHERE id=?').run(c.id);
   if(row)this.sql('INSERT INTO temp.landscape_shape_bounds VALUES(?,?,?,?,?,?,?)').run(row.id,row.source_row,row.kind,row.min_x,row.max_x,row.min_y,row.max_y);
  }
  // UTF-8 bytes conservatively bound JS text units too. Read only sparse place
  // rows on source/name changes; camera reads never rescan the author corpus.
  if(labelsChanged)this.placeLabelUnits=this.sql(`SELECT coalesce(max(length(CAST(coalesce(json_extract(l.payload,'$.name'),json_extract(a.payload,'$.name'),'') AS BLOB))),0) n FROM temp.landscape_shape_bounds s CROSS JOIN atlas_landscape a ON a.rowid=s.source_row LEFT JOIN location l ON l.campaign_id=a.campaign_id AND l.id=json_extract(a.payload,'$.locationId') WHERE s.kind='place' AND a.campaign_id=? AND coalesce(l.trashed,0)=0`).get(source.campaignId).n;
  this.identity=identity;
 }

 private *rows(source:AtlasRegionSource,box:LandscapeBox,patches:boolean,pixels=0,mpp=0){
  const search=landscapePaintBox(box,mpp,this.placeLabelUnits);
  // Terrain already has canonical bounded columns. Index only sparse objects:
  // building another 100k-row Rtree before the first view costs more than its scans.
  const indexed=this.indexed&&!patches;
  // A patch whose bounds contain no supersample center cannot change this tile.
  // Conservative epsilon and clipping match Rasterizer's 2x sample lattice.
  const sampling=patches&&pixels>0&&this.sampleMath;
  const sampleClause=sampling?` AND ceil((max(a.min_x,?)-?)/?*?-.5000001)<=floor((min(a.max_x,?)-?)/?*?-.4999999) AND ceil((max(a.min_y,?)-?)/?*?-.5000001)<=floor((min(a.max_y,?)-?)/?*?-.4999999)`:'';
  const sql=`SELECT CAST(a.rowid AS TEXT) source_row FROM ${indexed?'temp.landscape_region_index i CROSS JOIN atlas_landscape a ON a.rowid=i.id':'atlas_landscape a'} WHERE a.campaign_id=? AND ${indexed?'i':'a'}.max_x>=? AND ${indexed?'i':'a'}.min_x<=? AND ${indexed?'i':'a'}.max_y>=? AND ${indexed?'i':'a'}.min_y<=? ${sampleClause} ${patches?"AND json_extract(a.payload,'$.kind')='patch' AND (json_extract(a.payload,'$.values.terrain') IS NOT NULL OR json_extract(a.payload,'$.paint') IS NOT NULL OR json_extract(a.payload,'$.mask') IS NOT NULL)":"AND json_extract(a.payload,'$.kind')!='patch'"} ORDER BY ${patches?"CAST(json_extract(a.payload,'$.resolution') AS REAL) DESC,coalesce(json_extract(a.payload,'$.order'),0),a.rowid":"CASE WHEN json_extract(a.payload,'$.kind')='reference' THEN 0 WHEN json_extract(a.payload,'$.line.overSymbols')=1 THEN 3 WHEN json_extract(a.payload,'$.line') IS NOT NULL THEN 1 ELSE 2 END,CAST(json_extract(a.payload,'$.resolution') AS REAL) DESC,coalesce(json_extract(a.payload,'$.order'),0),a.rowid"}`;
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
  const args:any[]=[source.campaignId,search.x,search.x+search.width,search.y,search.y+search.height];
  if(sampling)for(const [origin,length]of [[box.x,box.width],[box.y,box.height]] as const)args.push(origin,origin,length,pixels*2,origin+length,origin,length,pixels*2);
  for(const row of this.sql(sql).iterate(...args)){
   ids.push(row.source_row);if(ids.length===128){yield*readPage(ids);ids=[];}
  }
  if(ids.length)yield*readPage(ids);
 }
 read(source:AtlasRegionSource,q:AtlasRegionQuery,budget:number):AtlasLandscapeLayer{
  const layer:AtlasLandscapeLayer={state:'ready',records:[],tiles:[],coverage:{complete:true,mode:'detail',objects:0,references:0}};
  let used=0,dense=false,referenceBytes=0;const references:LandscapeRecord[]=[];
  for(const r of this.rows(source,q.box,false,0,q.box.width/q.width)){
   if(q.references===false&&r.kind==='reference')continue;
   layer.coverage.objects++;if(r.kind==='reference')layer.coverage.references++;
   const record=visual(r),size=Buffer.byteLength(JSON.stringify(record));if(r.kind==='reference'){referenceBytes+=size;if(references.length<16&&referenceBytes<=128*1024)references.push(record);}
   if(layer.coverage.objects>500||layer.coverage.references>16||used+size>Math.min(512*1024,budget/3)){dense=true;layer.records=[];}else if(!dense){used+=size;layer.records.push(record);}
  }
  layer.coverage.mode=dense?'raster':'detail';const exactReferences=layer.coverage.references<=16&&referenceBytes<=128*1024;if(dense)layer.records=exactReferences?references:[];
  if(!dense&&!this.sql("SELECT 1 FROM atlas_landscape WHERE campaign_id=? AND json_extract(payload,'$.kind')='patch' AND max_x>=? AND min_x<=? AND max_y>=? AND min_y<=? LIMIT 1").get(source.campaignId,q.box.x,q.box.x+q.box.width,q.box.y,q.box.y+q.box.height))return layer;
  // At most four world-aligned tiles; a smaller detail level is explicit display aggregation.
  let edge=2**Math.ceil(Math.log2(Math.max(q.box.width,q.box.height)));
  if(!Number.isFinite(edge)||edge<=0||q.box.x+q.box.width===q.box.x||q.box.y+q.box.height===q.box.y)throw new Error('Ausschnitt nicht präzise darstellbar.');
  const boxes=()=>{const rows:LandscapeBox[]=[];for(let y=Math.floor(q.box.y/edge);y<=Math.floor((q.box.y+q.box.height-Number.EPSILON)/edge);y++)for(let x=Math.floor(q.box.x/edge);x<=Math.floor((q.box.x+q.box.width-Number.EPSILON)/edge);x++)rows.push({x:x*edge,y:y*edge,width:edge,height:edge});return rows;};
  let regions=boxes();while(regions.length>4){edge*=2;regions=boxes();}
  for(let pixels=1024;pixels>=16;pixels/=2){
   layer.tiles=[];
   for(const box of regions){
    const key=JSON.stringify([source.campaignId,box,pixels,dense,dense?q.box.width/q.width:0,q.references!==false,exactReferences]),hit=this.cache.get(key);
    let json=hit?.json;
    if(hit){this.cache.delete(key);this.cache.set(key,hit);}
    if(!json){
     const image=new LandscapeRasterizer(box,pixels,pixels),samplePixels=pixels+2*LANDSCAPE_RASTER_PAD;for(const r of this.rows(source,image.sampleBox,true,samplePixels))image.paint(r);
     for(const r of this.rows(source,image.sampleBox,true,samplePixels))if(r.paint)image.paintColor(r);
     if(dense)for(const r of this.rows(source,box,false,0,Math.max(q.box.width/q.width,edge/pixels))){
      if(r.kind==='road'||r.kind==='river')image.paintRecordLine(r,q.box.width/q.width);
      else if(r.kind==='place')image.paintLine(r.points,Math.max(q.box.width/q.width*10,edge/pixels),'#5b4338');
      else if(r.kind==='reference'&&q.references!==false&&!exactReferences){const b=bounds(r);image.paintLine([{x:b.x,y:b.y},{x:b.x+b.width,y:b.y},{x:b.x+b.width,y:b.y+b.height},{x:b.x,y:b.y+b.height},{x:b.x,y:b.y}],edge/pixels,'#75604e');}
     }
     const data=PNG.sync.write({width:pixels,height:pixels,data:Buffer.from(image.finish())} as PNG).toString('base64');
     json=JSON.stringify({campaignId:source.campaignId,revision:source.revision,box,width:pixels,height:pixels,data:'data:image/png;base64,'+data});
     const bytes=json.length*2;while(this.bytes+bytes>this.cacheLimit&&this.cache.size){const [k,v]=this.cache.entries().next().value!;this.bytes-=v.bytes;this.cache.delete(k);}if(bytes<=this.cacheLimit){this.cache.set(key,{box:landscapePaintBox(landscapeRasterBounds(box,pixels,pixels),Math.max(q.box.width/q.width,edge/pixels),this.placeLabelUnits),json,bytes});this.bytes+=bytes;}
    }
    const tile=JSON.parse(json) as LandscapeRaster;tile.revision=source.revision;layer.tiles.push(tile);
   }
   if(Buffer.byteLength(JSON.stringify(layer))<=budget)return layer;
  }
  return{state:'error',records:[],tiles:[],coverage:{...layer.coverage,complete:false},error:'Landschaftsausschnitt nicht verfügbar. Kleineren Ausschnitt wählen oder erneut laden.'};
 }
 hits(source:AtlasRegionSource,q:AtlasRegionQuery,p:Point,offset=0):AtlasHitPage{
  const mpp=q.box.width/q.width,tolerance=mpp*6,box={x:p.x-tolerance,y:p.y-tolerance,width:tolerance*2,height:tolerance*2},items:AtlasHit[]=[];let skipped=0,more=false;
  for(const r of this.rows(source,box,false)){
   const touch=r.kind==='reference'?(()=>{const a=-(r.angle??0),dx=p.x-r.points[0]!.x,dy=p.y-r.points[0]!.y,x=dx*Math.cos(a)-dy*Math.sin(a),y=dx*Math.sin(a)+dy*Math.cos(a);return x>=0&&x<=r.width&&y>=0&&y<=r.width*(r.imageHeight??1)/(r.imageWidth??1);})():r.kind==='place'?Math.hypot(p.x-r.points[0]!.x,p.y-r.points[0]!.y)<=tolerance:lineContains(r,p,tolerance);
   if(!touch)continue;if(skipped++<offset)continue;if(items.length===40){more=true;continue;}
   const b=bounds(r);items.push({kind:'landscape',id:r.id,name:r.name||({road:'Weg',river:'Fluss',place:'Ort',reference:'Bildvorlage',patch:'Gelände'}[r.kind]),landscapeKind:r.kind,point:{x:b.x+b.width/2,y:b.y+b.height/2},box:b,revision:r.revision});
  }
  return{items,next:more?offset+items.length:null,fence:source.fence,total:skipped};
 }
}
