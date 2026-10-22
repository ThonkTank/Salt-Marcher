import {invalidateColorFrame,colorFrameReference,colorFrameTile,retainedColorTile,type TerrainColorFrame,type TerrainTileColor} from './terrain-color-frame';
import type {LandscapeBox} from './atlas-landscape';
import type {TerrainRect} from './terrain-frame';
import type {TerrainColorRequest,TerrainColorTile} from './terrain-color';
import {TerrainCache} from './terrain-cache';
import {landscapeRasterBounds} from './landscape-raster';
import {equalTerrainSource,type TerrainColorChange} from './terrain-change-history';
import type {TerrainIdentity} from './terrain-frame';

export interface TerrainColorSource extends TerrainIdentity {token:string;rasterRouteKey?:string}
export const terrainColorIdentity=(s:TerrainColorSource)=>JSON.stringify([s.token,s.revision,s.fence,s.rasterRouteKey]);


const TILE_PIXELS=256;
/** A common power-of-two world lattice survives pans and small zoom changes.
 * At most 9×9 tiles cover the refinement, including padding. Rounding down
 * keeps at least the previous 1024-pixel colour density at every zoom level. */
export function terrainDetailTiles(area:LandscapeBox){
 const mpp=2**Math.floor(Math.log2(Math.max(area.width,area.height)/1024)),edge=TILE_PIXELS*mpp;
 const x=Math.floor(area.x/edge),y=Math.floor(area.y/edge),right=Math.ceil((area.x+area.width)/edge),bottom=Math.ceil((area.y+area.height)/edge);
 const box={x:x*edge,y:y*edge,width:(right-x)*edge,height:(bottom-y)*edge},width=(right-x)*TILE_PIXELS,height=(bottom-y)*TILE_PIXELS;
 if(!Number.isFinite(mpp)||mpp<=0||width<1||height<1||width>2304||height>2304)throw Error('Geländedetail nicht präzise darstellbar.');
 const tiles=[];
 for(let row=y;row<bottom;row++)for(let col=x;col<right;col++)tiles.push({box:{x:col*edge,y:row*edge,width:edge,height:edge},x:(col-x)*TILE_PIXELS,y:(row-y)*TILE_PIXELS,width:TILE_PIXELS,height:TILE_PIXELS});
 tiles.sort((a,b)=>Math.hypot(a.box.x+edge/2-area.x-area.width/2,a.box.y+edge/2-area.y-area.height/2)-Math.hypot(b.box.x+edge/2-area.x-area.width/2,b.box.y+edge/2-area.y-area.height/2));
 return {box,width,height,mpp,tiles};
}
/** Renderer-only derived cache: 32 MiB of accepted tile buffers; GPU composition owns display images.
 * Cross-revision reuse requires worker-confirmed, complete change history. */
export class TerrainDetailTiles {
 private cache=new TerrainCache<TerrainTileColor>(32*1024*1024);
 private identity='';
 private source:TerrainColorSource|undefined;
 frame:TerrainColorFrame|undefined;
 clear(){this.identity='';this.source=undefined;this.frame=undefined;this.cache.clear();}
 base(token:string):TerrainIdentity|undefined{
  return this.source?.token===token?{revision:this.source.revision,fence:this.source.fence}:undefined;
 }
 reconcile(source:TerrainColorSource,change?:TerrainColorChange){
  const identity=terrainColorIdentity(source);
  if(identity!==this.identity){
   if(change&&this.source?.token===source.token&&this.source.rasterRouteKey===source.rasterRouteKey&&
      equalTerrainSource(this.source,change.base)&&!change.invalidation.reset){
    this.cache.invalidate(change.invalidation.bounds);
    if(this.frame)this.frame=invalidateColorFrame(this.frame,change.invalidation);
   }else this.clear();
   this.source={token:source.token,revision:source.revision,fence:source.fence,rasterRouteKey:source.rasterRouteKey};this.identity=identity;
  }
  return this.frame;
 }
 async load(identity:string,area:LandscapeBox,query:Omit<TerrainColorRequest,'box'|'width'|'height'|'displayMpp'>,
   read:(q:TerrainColorRequest)=>Promise<TerrainColorTile>,current:()=>boolean,
   publish:(detail:TerrainColorFrame,rect:TerrainRect|undefined,done:number,total:number)=>void,previous?:TerrainColorFrame){
  if(identity!==this.identity){this.clear();this.identity=identity;previous=undefined;}
  const plan=terrainDetailTiles(area),detail:TerrainColorFrame={id:{},box:plan.box,width:plan.width,height:plan.height,tiles:new Map(),previous:previous?colorFrameReference(previous):undefined,coverage:{columns:plan.width/TILE_PIXELS,rows:plan.height/TILE_PIXELS,values:new Uint8Array(plan.tiles.length)}};
  const mark=(tile:TerrainRect)=>{detail.coverage!.values[tile.y/TILE_PIXELS*detail.coverage!.columns+tile.x/TILE_PIXELS]=255;};
  const pending=[];let done=0;
  for(const tile of plan.tiles){
   const key=JSON.stringify([tile.box,query.contours,plan.mpp]),pixels=this.cache.get(key);
   if(pixels){detail.tiles.set(colorFrameTile(detail,tile),{rect:tile,color:pixels});mark(tile);done++;}else {
    pending.push({tile,key});
    // Fully covered old world detail remains visible under the sharper level.
    if(previous&&retainedColorTile(detail,tile,previous))mark(tile);
   }
  }
  // A predecessor is needed only to infer coverage, not for asynchronous reads.
  // Do not pin its tile buffers after the GPU has accepted a successor.
  previous=undefined;
  if(!current())return false;
  if(done)publish(detail,undefined,done,plan.tiles.length);
  let first=done===0;
  for(const {tile,key}of pending){
   if(!current())return false;
   const value=await read({...query,box:tile.box,width:tile.width,height:tile.height,displayMpp:plan.mpp});
   if(!current()||identity!==this.identity)return false;
   if(value.revision!==query.revision||query.fence!==undefined&&value.fence!==query.fence)throw Error('Gelände inzwischen geändert. Ausschnitt erneut laden.');
   if(JSON.stringify(value.box)!==JSON.stringify(tile.box)||value.width!==tile.width||value.height!==tile.height||value.pixels.length!==tile.width*tile.height*4||value.forest!==undefined&&(!(value.forest instanceof Uint8Array)||value.forest.length!==tile.width*tile.height))throw Error('Geländefarbe passt nicht zum angeforderten Ausschnitt.');
   const color={pixels:value.pixels,forest:value.forest};
   this.cache.put(key,landscapeRasterBounds(tile.box,tile.width,tile.height),color,value.pixels.byteLength+(value.forest?.byteLength??0));
   detail.tiles.set(colorFrameTile(detail,tile),{rect:tile,color});mark(tile);done++;
   // The first upload initializes the full transparent image; later uploads are local.
   publish(detail,first?undefined:tile,done,plan.tiles.length);first=false;
  }
  return true;
 }
}
