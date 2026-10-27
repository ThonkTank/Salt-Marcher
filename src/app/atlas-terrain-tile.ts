import {atlasWorldTileBounds,type AtlasWorldTile} from './atlas-world-tiles';
import type {TerrainProjection,TerrainProjectionRequest} from './terrain-projection';
import {validateTerrainView} from './terrain-spatial-model';

export const ATLAS_TERRAIN_TILE_PIXELS=256;
export const ATLAS_TERRAIN_TILE_NODES=65;
export interface AtlasTerrainTileRequest {tile:AtlasWorldTile;revision:number;contours?:number;product?:'height'}
export interface AtlasTerrainTile {
  tile:AtlasWorldTile;revision:number;fence:string;
  cache:'hit'|'built'|'disabled';projection:TerrainProjection;
}
const invalid=()=>{throw Error('Atlas-Terrainquelle ungültig.');};
const sameBox=(a:TerrainProjection['grid']['view']['box']|undefined,b:TerrainProjection['grid']['view']['box'])=>
  !!a&&a.x===b.x&&a.y===b.y&&a.width===b.width&&a.height===b.height;
const finite=(array:Float32Array)=>array.every(Number.isFinite);

/** The numerical lattice is shared by raw tiles and camera-bound local drafts. */
export function validateAtlasTerrainRaster(projection:TerrainProjection,request:AtlasTerrainTileRequest):void {
  const p=projection,g=p?.grid,v=g?.view,q=atlasTerrainTileQuery(request);
  try{validateTerrainView(v);}catch{invalid();}
  if(!p||!g||!v||v.columns!==ATLAS_TERRAIN_TILE_NODES||v.rows!==ATLAS_TERRAIN_TILE_NODES||
    !sameBox(v.box,q.view.box)||v.refinement!==undefined||
    !Number.isFinite(v.focusM)||!Number.isFinite(v.tilt)||v.tilt<0||v.tilt>75||
    !Number.isFinite(v.rotation)||Math.abs(v.rotation)>360||
    !Number.isFinite(v.exaggeration)||v.exaggeration<.25||v.exaggeration>8||
    !Number.isFinite(g.seaLevelM)||typeof p.draft!=='boolean'||!Number.isSafeInteger(p.generation)||p.generation<0||
    typeof p.source!=='string'||typeof p.fence!=='string'||p.source!==p.fence||!Number.isSafeInteger(p.revision)||p.revision<0||
    !(g.heights instanceof Float32Array)||g.heights.length!==ATLAS_TERRAIN_TILE_NODES**2||!finite(g.heights)||
    !(g.editing?.ground instanceof Float32Array)||g.editing.ground.length!==g.heights.length||!finite(g.editing.ground)||
    !(g.editing.water instanceof Float32Array)||g.editing.water.length!==g.heights.length||!finite(g.editing.water)||
    (request.product==='height'
      ?p.heightOnly!==true||p.width!==0||p.height!==0||!(p.pixels instanceof Uint8Array)||p.pixels.length!==0
      :p.heightOnly===true||p.width!==ATLAS_TERRAIN_TILE_PIXELS||p.height!==ATLAS_TERRAIN_TILE_PIXELS||
        !(p.pixels instanceof Uint8Array)||p.pixels.length!==ATLAS_TERRAIN_TILE_PIXELS**2*4||
        !(p.forest instanceof Uint8Array)||p.forest.length!==ATLAS_TERRAIN_TILE_PIXELS**2))invalid();
}

/** Raw products have a canonical tile frame; a draft may carry a camera frame. */
export function validateAtlasTerrainTileProjection(projection:TerrainProjection,request:AtlasTerrainTileRequest,source?:string,raw=true):void {
  validateAtlasTerrainRaster(projection,request);
  const v=projection.grid.view,q=atlasTerrainTileQuery(request);
  if(source!==undefined&&(projection.source!==source||projection.fence!==source||projection.revision!==request.revision)||
    raw&&(projection.draft!==false||!sameBox(v.frame,q.view.box)||v.projection!==undefined||v.tilt!==0||v.rotation!==0||v.exaggeration!==1||
      request.product==='height'&&v.focusM!==0))invalid();
}

export function validateAtlasTerrainTileReply(reply:AtlasTerrainTile,request:AtlasTerrainTileRequest,source:string,raw=true):void {
  if(typeof source!=='string'||!source)invalid();
  atlasTerrainTileQuery(request,source);
  if(!reply?.tile||reply.tile.lod!==request.tile.lod||reply.tile.x!==request.tile.x||reply.tile.y!==request.tile.y||
    reply.revision!==request.revision||reply.fence!==source)invalid();
  validateAtlasTerrainTileProjection(reply.projection,request,source,raw);
}
/** Display tiles have a fixed lattice; neither camera pose nor window size is a key. */
export function atlasTerrainTileQuery(request:AtlasTerrainTileRequest,fence?:string):TerrainProjectionRequest {
  if(!request||Object.keys(request).some(k=>!['tile','revision','contours','product'].includes(k))||
    request.product!==undefined&&request.product!=='height'||
    !request.tile||Object.keys(request.tile).some(k=>!['lod','x','y'].includes(k))||
    !Number.isSafeInteger(request.revision)||request.revision<0||request.tile.lod< -8||request.tile.lod>32||
    request.contours!==undefined&&(!Number.isFinite(request.contours)||request.contours<0&&request.contours!==-1||request.contours>100000))throw Error('Atlaskachel prüfen.');
  const b=atlasWorldTileBounds(request.tile);
  if(Math.max(Math.abs(b.minX),Math.abs(b.minY),Math.abs(b.maxX),Math.abs(b.maxY))>1e12||b.maxX<=b.minX||b.maxY<=b.minY)throw Error('Atlaskachel außerhalb des darstellbaren Bereichs.');
  const box={x:b.minX,y:b.minY,width:b.sizeM,height:b.sizeM};
  return {view:{box,frame:box,columns:ATLAS_TERRAIN_TILE_NODES,rows:ATLAS_TERRAIN_TILE_NODES,focusM:0,tilt:0,rotation:0,exaggeration:1},
    width:ATLAS_TERRAIN_TILE_PIXELS,height:ATLAS_TERRAIN_TILE_PIXELS,displayMpp:b.sizeM/ATLAS_TERRAIN_TILE_PIXELS,
    contours:request.contours??0,revision:request.revision,fence};
}
