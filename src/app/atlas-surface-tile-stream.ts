import {terrainChannelStride} from './terrain-material';
import {AtlasRasterTileStream,type AtlasRasterStreamOptions} from './atlas-raster-tile-stream';
import {validateAtlasTerrainTileReply,type AtlasTerrainTile,type AtlasTerrainTileRequest} from './atlas-terrain-tile';
import type {AtlasMaterialTile} from './atlas-material-tile';
import type {AtlasRegionAPI} from './atlas-region-contracts';
import type {AtlasReadRequest} from './atlas-read-request';
import {SURFACE_CHANNEL_NAMES} from './terrain-material';

export interface AtlasSurfaceTile {
  tile:AtlasTerrainTile['tile'];revision:number;fence:string;
  terrain:AtlasTerrainTile;material:AtlasMaterialTile;
}

/** One budget, cancellation owner and atomic LOD transition for height/material.
 * A material reply can never refine a different revision's height surface. */
export class AtlasSurfaceTileStream extends AtlasRasterTileStream<AtlasSurfaceTile,AtlasTerrainTileRequest> {
  constructor(options:AtlasRasterStreamOptions={}){
    super({request:(tile,revision)=>({tile,revision,product:'height'}),validate:validateSurfaceTile},{maxTiles:32,coverageLod:20,...options});
  }
}

export function validateSurfaceTile(reply:AtlasSurfaceTile,request:AtlasTerrainTileRequest,source:string,raw=true):void {
  const matches=(tile:AtlasSurfaceTile|AtlasTerrainTile|AtlasMaterialTile|undefined)=>tile&&tile.revision===request.revision&&tile.fence===source&&
    tile.tile?.lod===request.tile.lod&&tile.tile.x===request.tile.x&&tile.tile.y===request.tile.y;
  const m=reply?.material;
  if(!matches(reply)||!matches(m)||!m||
    m.width!==256||m.height!==256||SURFACE_CHANNEL_NAMES.some(c=>!(m.channels?.[c] instanceof Uint8Array)||m.channels[c].length!==256*256*terrainChannelStride(c)))
    throw Error('Höhe und Material müssen vollständige Kacheln derselben Quelle bilden.');
  validateAtlasTerrainTileReply(reply.terrain,request,source,raw);
}

type ReadPort=Pick<AtlasRegionAPI,'atlasTerrainTile'|'atlasMaterialTile'|'atlasCancelRead'>;
/** Restricted preload adapter. Cancellation only addresses a disposable read.
 * Await physical completion before another stream job; never retry a failed read. */
export function atlasSurfaceTileFetcher(api:ReadPort,token:string,owner:string,consumer:'view'|'export'='view'){
  return async(request:AtlasTerrainTileRequest,signal:AbortSignal):Promise<AtlasSurfaceTile>=>{
    const control:AtlasReadRequest={owner,id:crypto.randomUUID()};
    const check=()=>{if(signal.aborted)throw new DOMException('Kartenleseauftrag abgebrochen.','AbortError');};
    const cancel=()=>{void api.atlasCancelRead(token,control,consumer).catch(()=>{});};
    check();signal.addEventListener('abort',cancel,{once:true});
    try{
      const height=await api.atlasTerrainTile(token,{tile:request.tile,revision:request.revision,product:'height'},control,consumer);
      check();if(!height.ok)throw Error(height.error);
      const material=await api.atlasMaterialTile(token,{tile:request.tile,revision:request.revision,product:'surface'},control,consumer);
      check();if(!material.ok)throw Error(material.error);
      return {tile:request.tile,revision:request.revision,fence:height.value.fence,terrain:height.value,material:material.value};
    }finally{signal.removeEventListener('abort',cancel);}
  };
}
