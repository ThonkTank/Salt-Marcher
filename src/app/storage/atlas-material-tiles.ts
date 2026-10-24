import {terrainChannelStride} from '../terrain-material';
import {createHash} from 'node:crypto';
import {atlasMaterialTileQuery,type AtlasMaterialTileRequest,type AtlasMaterialTile} from '../atlas-material-tile';
import {SURFACE_CHANNEL_NAMES,COVER_CHANNEL_NAMES,CHANNEL_NAMES,type TerrainMaterialChannel,type TerrainMaterialChannels,type TerrainMaterialRaster} from '../terrain-material';
import {DEFAULT_TERRAIN_STYLE} from '../terrain-relief';
import {landscapeRasterBounds} from '../landscape-raster';
import type {LandscapeRecord} from '../atlas-landscape';
import type {AtlasRegionSource} from '../atlas-region-contracts';
import {AtlasCacheScope} from './atlas-cache-scope';
import {readTerrainSettings} from './terrain-color-raster';
import type {AtlasRegionReader} from './atlas-region';

const FORMAT='material-tiles-v4-fantasy-cover';
const digest=(value:string|Uint8Array)=>createHash('sha256').update(value).digest('hex');
type Stored={version:string;fingerprint:string;bytes:Uint8Array;waterTopology?:Uint16Array};
type Inputs=Record<TerrainMaterialChannel,string>;
function validStored(value:Stored|undefined,channel:TerrainMaterialChannel,width:number,height:number):value is Stored {
 return !!value&&typeof value.version==='string'&&typeof value.fingerprint==='string'&&value.bytes instanceof Uint8Array&&
  value.bytes.length===width*height*terrainChannelStride(channel)&&
  (channel!=='water'||value.waterTopology instanceof Uint16Array&&value.waterTopology.length===width*height);
}
function reply(source:AtlasRegionSource,request:AtlasMaterialTileRequest,width:number,height:number,channels:TerrainMaterialRaster,cache:AtlasMaterialTile['cache']):AtlasMaterialTile {
 return {...(request.product?{product:request.product}:{}),tile:{...request.tile},revision:source.revision,fence:source.fence,width,height,channels:channels as TerrainMaterialChannels,cache};
}

/** Independently reusable raw material products, never baked display pixels.
 * Cache rows are individually atomic. A complete, source-validated reply is the
 * publication boundary; interrupted/evicted subsets are never published as a tile. */
export class AtlasMaterialTiles {
 private readonly cache:AtlasCacheScope;
 constructor(private db:any,private directory?:string){this.cache=new AtlasCacheScope(directory);}
 private open(source:AtlasRegionSource){return this.cache.open(source);}
 /** Exact-stamp hit for callers that already hold a validated durable source. */
 cached(source:AtlasRegionSource,request:AtlasMaterialTileRequest):AtlasMaterialTile|undefined {
  const q=atlasMaterialTileQuery(request),selected=request.product==='surface'?SURFACE_CHANNEL_NAMES:CHANNEL_NAMES;
  if(source.revision!==request.revision)throw Error('Materialkachel inzwischen geändert.');
  if(!this.directory||source.shadow||!source.shapeVersion)return undefined;
  const cache=this.open(source);if(!cache)return undefined;
  const channels:TerrainMaterialRaster={},states={} as AtlasMaterialTile['cache'];
  for(const channel of selected){
   const item=cache.get<Stored>(JSON.stringify(['material',request.tile.lod,request.tile.x,request.tile.y,channel]),FORMAT);
   if(!validStored(item,channel,q.width,q.height)||item.version!==source.shapeVersion)return undefined;
   channels[channel]=item.bytes;states[channel]='hit';
  }
  return reply(source,request,q.width,q.height,channels,states);
 }
 private *inputs(source:AtlasRegionSource,request:AtlasMaterialTileRequest):Generator<void,Inputs>{
  const q=atlasMaterialTileQuery(request),box=landscapeRasterBounds(q.view.box,q.width,q.height);
  const settings=readTerrainSettings(this.db,source.campaignId).terrainSettings!,style=settings.style??DEFAULT_TERRAIN_STYLE;
  const field=createHash('sha256').update(FORMAT+JSON.stringify(settings.seaLevelM));
  const base=createHash('sha256').update(FORMAT+JSON.stringify(style.land));
  const cover=createHash('sha256').update(FORMAT),forest=createHash('sha256').update(FORMAT),waterBase=createHash('sha256').update(FORMAT);
  // Page narrow keys, then one owned payload at a time. No SQLite iterator is
  // suspended across a worker continuation and no world-sized author list lives in JS.
  const keySql=`SELECT CAST(rowid AS TEXT) source_row FROM atlas_landscape WHERE campaign_id=? AND max_x>=? AND min_x<=? AND max_y>=? AND min_y<=?`;
  const first=this.db.prepare(keySql+' ORDER BY rowid LIMIT 128'),next=this.db.prepare(keySql+' AND rowid>CAST(? AS INTEGER) ORDER BY rowid LIMIT 128');
  const payload=this.db.prepare(`SELECT a.payload,l.trashed FROM atlas_landscape a LEFT JOIN location l ON l.campaign_id=a.campaign_id AND l.id=json_extract(a.payload,'$.locationId') WHERE a.campaign_id=? AND a.rowid=?`);
  let after:string|undefined,start=performance.now();
  for(;;){
   const args=[source.campaignId,box.x,box.x+box.width,box.y,box.y+box.height];
   const rows=(after===undefined?first.all(...args):next.all(...args,after)) as {source_row:string}[];
   if(!rows.length)break;
   for(const row of rows){
    const stored=payload.get(source.campaignId,row.source_row);after=row.source_row;if(!stored||stored.trashed)continue;
    const r=JSON.parse(stored.payload) as LandscapeRecord;
    // Author IDs/revisions/names are not material. Row order and the properties
    // actually consumed by each raster pass are; a trash transition changes membership.
    const shape=[row.source_row,r.kind,r.resolution,r.order,r.polygons,r.points,r.width];
    if(r.height||r.route||r.surface==='freshwater')field.update(JSON.stringify([shape,r.height,r.route,r.surface,r.waterLevelM]));
    else if(r.paint)base.update(JSON.stringify([shape,r.paint]));
    else if(r.vegetation){
     const p=r.vegetation.preset;
     cover.update(JSON.stringify([shape,p.id,p.tree,p.edge,p.density,p.undergrowth,p.rocks,r.vegetation.edits]));
     base.update(JSON.stringify([shape,p.edge,p.ground]));
     forest.update(JSON.stringify([shape,p.edge,p.density,r.vegetation.edits]));
    }else if(r.kind==='patch'&&(r.values.terrain||r.mask)&&!r.terrainSettings){
     cover.update(JSON.stringify([shape,r.values.terrain,r.mask,r.maskManaged,r.propertyOnly]));
     base.update(JSON.stringify([shape,r.values.terrain,r.mask,r.maskManaged,r.propertyOnly]));
     forest.update(JSON.stringify([shape,r.values.terrain==='forest',r.mask,r.maskManaged,r.propertyOnly]));
     waterBase.update(JSON.stringify([shape,r.values.terrain==='water',r.mask,r.maskManaged,r.propertyOnly]));
    }
    if(performance.now()-start>=8){yield;start=performance.now();}
   }
   if(performance.now()-start>=8){yield;start=performance.now();}
   if(rows.length<128)break;
  }
  const terrain=field.digest('hex'),water=digest(JSON.stringify([terrain,waterBase.digest('hex')]));
  const coverHash=cover.digest('hex'),coverInputs=Object.fromEntries(COVER_CHANNEL_NAMES.map(c=>[c,coverHash])) as Record<typeof COVER_CHANNEL_NAMES[number],string>;
  return {...coverInputs,relief:terrain,water,baseColor:base.digest('hex'),forest:forest.digest('hex'),
   rock:digest(JSON.stringify([terrain,!!style.mountains])),snow:digest(JSON.stringify([terrain,!!style.mountains,style.snowlineM??2500]))};
 }
 *read(source:AtlasRegionSource,request:AtlasMaterialTileRequest,reader:AtlasRegionReader):Generator<void,AtlasMaterialTile>{
  const q=atlasMaterialTileQuery(request),selected=request.product==='surface'?SURFACE_CHANNEL_NAMES:CHANNEL_NAMES;
  if(source.revision!==request.revision)throw Error('Materialkachel inzwischen geändert.');
  const cache=this.open(source),channels:TerrainMaterialRaster={},states={} as AtlasMaterialTile['cache'];
  const key=(c:TerrainMaterialChannel)=>JSON.stringify(['material',request.tile.lod,request.tile.x,request.tile.y,c]);
  const old=new Map<TerrainMaterialChannel,Stored>();
  for(const c of selected){
   const item=cache?.get<Stored>(key(c),FORMAT);
   if(validStored(item,c,q.width,q.height))old.set(c,item);
  }
  if(cache&&selected.every(c=>old.get(c)?.version===source.shapeVersion)){
   for(const c of selected){channels[c]=old.get(c)!.bytes;states[c]='hit';}
  }else{
   const inputs=cache?yield* this.inputs(source,request):undefined;
   let built:TerrainMaterialRaster={},waterTopology:Uint16Array|undefined;
   const water=old.get('water');
   if(water&&inputs&&(water.version===source.shapeVersion||water.fingerprint===inputs.water)){channels.water=water.bytes;waterTopology=water.waterTopology;states.water='hit';}
   else {
    // A fully cold tile needs one shared raster pass, not five copies of its field.
    built=yield* reader.materialSteps(source,request,new Set(old.size?['water'] as const:selected));
    channels.water=built.water!;waterTopology=built.waterTopology;states.water=cache?'built':'disabled';
   }
   // Ground colour and vegetation depend on water classification, not the exact
   // elevation that produced it. Raising dry land leaves these channels reusable.
   const waterIdentity=digest(new Uint8Array(waterTopology!.buffer,waterTopology!.byteOffset,waterTopology!.byteLength)),fingerprints=inputs?Object.fromEntries(CHANNEL_NAMES.map(c=>[c,c==='water'?inputs.water:digest(inputs[c]+waterIdentity)])) as Inputs:undefined;
   const missing=new Set<TerrainMaterialChannel>();
   for(const c of selected){
    if(c==='water')continue;
    const prior=old.get(c);
    if(prior&&fingerprints&&(prior.version===source.shapeVersion||prior.fingerprint===fingerprints[c])){channels[c]=prior.bytes;states[c]='hit';}
    else if(built[c]){channels[c]=built[c];states[c]=cache?'built':'disabled';}
    else missing.add(c);
   }
   if(missing.size){const more=yield* reader.materialSteps(source,request,missing);for(const c of missing){channels[c]=more[c]!;states[c]=cache?'built':'disabled';}}
   // No yield within publication: all channels describe the same revalidated source.
   if(cache&&fingerprints)for(const c of selected)if(old.get(c)?.version!==source.shapeVersion||states[c]!=='hit')cache.put(key(c),FORMAT,{version:source.shapeVersion!,fingerprint:fingerprints[c],bytes:channels[c],...(c==='water'?{waterTopology}:{})});
  }
  return reply(source,request,q.width,q.height,channels,states);
 }
 close(){this.cache.close();}
}
