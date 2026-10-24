import {atlasTerrainTileQuery} from './atlas-terrain-tile';
import type {AtlasWorldTile} from './atlas-world-tiles';
import type {TerrainMaterialChannel,TerrainMaterialChannels} from './terrain-material';

export interface AtlasMaterialTileRequest {tile:AtlasWorldTile;revision:number;product?:'surface'}
export interface AtlasMaterialTile {
 tile:AtlasWorldTile;revision:number;fence:string;width:number;height:number;
 product?:'surface';
 channels:Pick<TerrainMaterialChannels,'baseColor'|'water'|'forest'|'relief'|import('./terrain-material').TerrainCoverChannel>&Partial<Pick<TerrainMaterialChannels,'rock'|'snow'>>;
 cache:Partial<Record<TerrainMaterialChannel,'hit'|'built'|'disabled'>>;
}
/** Authoring and camera/style inputs cannot cross this display-only read boundary. */
export function atlasMaterialTileQuery(request:AtlasMaterialTileRequest){
 if(request?.product!==undefined&&request.product!=='surface')throw Error('Materialprodukt prüfen.');
 if(!request||Object.keys(request).some(k=>!['tile','revision','product'].includes(k)))throw Error('Materialkachel prüfen.');
 const {product:_product,...tile}=request;return atlasTerrainTileQuery(tile);
}
