import {atlasTerrainTileQuery} from './atlas-terrain-tile';
import type {AtlasWorldTile} from './atlas-world-tiles';
import type {TerrainMaterialChannel,TerrainMaterialChannels} from './terrain-material';

export interface AtlasMaterialTileRequest {tile:AtlasWorldTile;revision:number}
export interface AtlasMaterialTile {
 tile:AtlasWorldTile;revision:number;fence:string;width:number;height:number;
 channels:TerrainMaterialChannels;
 cache:Record<TerrainMaterialChannel,'hit'|'built'|'disabled'>;
}
/** Authoring and camera/style inputs cannot cross this display-only read boundary. */
export function atlasMaterialTileQuery(request:AtlasMaterialTileRequest){
 if(!request||Object.keys(request).some(k=>!['tile','revision'].includes(k)))throw Error('Materialkachel prüfen.');
 return atlasTerrainTileQuery(request);
}
