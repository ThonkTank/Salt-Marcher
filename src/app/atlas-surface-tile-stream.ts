import {AtlasRasterTileStream,type AtlasRasterStreamOptions} from './atlas-raster-tile-stream';
import type {AtlasTerrainTile,AtlasTerrainTileRequest} from './atlas-terrain-tile';
import type {AtlasMaterialTile} from './atlas-material-tile';
import type {AtlasRegionAPI} from './atlas-region-contracts';
import type {AtlasReadRequest} from './atlas-read-request';
import {CHANNEL_NAMES} from './terrain-material';

export interface AtlasSurfaceTile {
  tile:AtlasTerrainTile['tile'];revision:number;fence:string;
  terrain:AtlasTerrainTile;material:AtlasMaterialTile;
}

/** One budget, cancellation owner and atomic LOD transition for height/material.
 * A material reply can never refine a different revision's height surface. */
export class AtlasSurfaceTileStream extends AtlasRasterTileStream<AtlasSurfaceTile,AtlasTerrainTileRequest> {
  constructor(options:AtlasRasterStreamOptions={}){
    super({request:(tile,revision)=>({tile,revision,product:'height'}),validate:validateSurfaceTile},{maxTiles:32,...options});
  }
}

function validateSurfaceTile(reply:AtlasSurfaceTile,request:AtlasTerrainTileRequest,source:string):void {
  const matches=(tile:AtlasSurfaceTile|AtlasTerrainTile|AtlasMaterialTile|undefined)=>tile&&tile.revision===request.revision&&tile.fence===source&&
    tile.tile.lod===request.tile.lod&&tile.tile.x===request.tile.x&&tile.tile.y===request.tile.y;
  const p=reply?.terrain?.projection,m=reply?.material;
  if(!matches(reply)||!matches(reply.terrain)||!matches(m)||!p?.heightOnly||p.fence!==source||p.revision!==request.revision||
    p.grid?.view.columns!==65||p.grid.view.rows!==65||!(p.grid.heights instanceof Float32Array)||p.grid.heights.length!==65*65||
    m.width!==256||m.height!==256||CHANNEL_NAMES.some(c=>!(m.channels[c] instanceof Uint8Array)||m.channels[c].length!==256*256*(c==='baseColor'?4:1)))
    throw Error('Höhe und Material müssen vollständige Kacheln derselben Quelle bilden.');
}

type ReadPort=Pick<AtlasRegionAPI,'atlasTerrainTile'|'atlasMaterialTile'|'atlasCancelRead'>;
/** Restricted preload adapter. Cancellation only addresses a disposable read.
 * Await physical completion before another stream job; never retry a failed read. */
export function atlasSurfaceTileFetcher(api:ReadPort,token:string,owner:string){
  let sequence=0;
  return async(request:AtlasTerrainTileRequest,signal:AbortSignal):Promise<AtlasSurfaceTile>=>{
    const control:AtlasReadRequest={owner,id:String(++sequence)};
    const check=()=>{if(signal.aborted)throw new DOMException('Kartenleseauftrag abgebrochen.','AbortError');};
    const cancel=()=>{void api.atlasCancelRead(token,control).catch(()=>{});};
    check();signal.addEventListener('abort',cancel,{once:true});
    try{
      const height=await api.atlasTerrainTile(token,{tile:request.tile,revision:request.revision,product:'height'},control);
      check();if(!height.ok)throw Error(height.error);
      const material=await api.atlasMaterialTile(token,{tile:request.tile,revision:request.revision},control);
      check();if(!material.ok)throw Error(material.error);
      return {tile:request.tile,revision:request.revision,fence:height.value.fence,terrain:height.value,material:material.value};
    }finally{signal.removeEventListener('abort',cancel);}
  };
}
