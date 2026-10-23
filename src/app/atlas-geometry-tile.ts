import {atlasTerrainTileQuery} from './atlas-terrain-tile';
import type {AtlasWorldTile} from './atlas-world-tiles';
import type {AtlasDeckSceneModel} from './atlas-deck-scene-model';

export interface AtlasGeometryTileRequest {tile:AtlasWorldTile;revision:number}
export interface AtlasGeometryTile {
 tile:AtlasWorldTile;revision:number;fence:string;cache:'hit'|'built'|'disabled';model:Omit<AtlasDeckSceneModel,'targets'>;
}
/** Preload carries plain DTOs and typed buffers, never a Map or live renderer. */
export function atlasGeometryTileModel(tile:AtlasGeometryTile):AtlasDeckSceneModel{
 return {...tile.model,targets:new Map(tile.model.objects.map(o=>[o.id,o.target]))};
}
export function atlasGeometryTileBox(request:AtlasGeometryTileRequest){
 if(!request||Object.keys(request).some(k=>!['tile','revision'].includes(k)))throw Error('Geometriekachel prüfen.');
 return atlasTerrainTileQuery(request).view.box;
}
