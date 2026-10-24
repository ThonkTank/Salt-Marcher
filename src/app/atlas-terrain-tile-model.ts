import {COVER_CHANNEL_NAMES} from './terrain-material';
import type {AtlasTerrainTile} from './atlas-terrain-tile';
import type {AtlasMaterialTile} from './atlas-material-tile';
import type {AtlasDeckSceneObject} from './atlas-deck-scene-model';
import {terrainGridLayout} from './terrain-grid-layout';
import {atlasWorldTileBounds} from './atlas-world-tiles';

export interface AtlasTerrainTileModel {
  object:AtlasDeckSceneObject;
  bounds:{min:readonly number[];max:readonly number[]};
  mesh:{attributes:{POSITION:{size:number;value:Float32Array};NORMAL:{size:number;value:Float32Array};TEXCOORD_0:{size:number;value:Float32Array}};indices:{size:number;value:Uint32Array}};
  data:AtlasDeckSceneObject[];
  texture:{data:Uint8Array;width:number;height:number};
  cover:{data:Uint8Array;width:number;height:number};
  relief:{data:Uint8Array;width:number;height:number};
  masks:{data:Uint8Array;width:number;height:number};
}
const geometryCache=new WeakMap<AtlasTerrainTile['projection']['grid'],Pick<AtlasTerrainTileModel,'object'|'data'|'mesh'|'bounds'>>();
type TextureData=AtlasTerrainTileModel['texture'];
interface TextureNode {next:WeakMap<Uint8Array,TextureNode>;texture?:TextureData;}
const textureCache:TextureNode={next:new WeakMap()};
function packedTexture(buffers:Uint8Array[],width:number,height:number):TextureData {
  let node=textureCache;
  for(const buffer of buffers){let child=node.next.get(buffer);if(!child){child={next:new WeakMap()};node.next.set(buffer,child);}node=child;}
  if(node.texture?.width===width&&node.texture.height===height)return node.texture;
  const data=new Uint8Array(width*height*4);
  for(let i=0;i<width*height;i++)for(let c=0;c<4;c++)data[i*4+c]=buffers[c]?.[i]??255;
  return node.texture={data,width,height};
}
const cached=new WeakMap<AtlasTerrainTile,WeakMap<AtlasMaterialTile,AtlasTerrainTileModel>>();
/** Immutable source pair; camera and style never rebuild these buffers. */
export function atlasTerrainTileModel(terrain:AtlasTerrainTile,material:AtlasMaterialTile):AtlasTerrainTileModel {
  if(terrain.fence!==material.fence||terrain.revision!==material.revision||['lod','x','y'].some(k=>terrain.tile[k as keyof typeof terrain.tile]!==material.tile[k as keyof typeof material.tile]))throw Error('Höhe und Material gehören nicht zur selben Kachel.');
  let materials=cached.get(terrain);if(!materials){materials=new WeakMap();cached.set(terrain,materials);}
  const existing=materials.get(material);if(existing)return existing;
  let geometry=geometryCache.get(terrain.projection.grid);
  if(!geometry){
  const grid=terrain.projection.grid,v=grid.view,layout=terrainGridLayout(v),box=atlasWorldTileBounds(terrain.tile);
  const origin={x:box.minX,y:box.minY,heightM:Math.round(grid.heights[0]!/256)*256};
  const positions=new Float32Array(grid.heights.length*3),normals=new Float32Array(positions.length),uv=new Float32Array(grid.heights.length*2);
  for(let y=0;y<v.rows;y++)for(let x=0;x<v.columns;x++){
    const i=y*v.columns+x,left=Math.max(0,x-1),right=Math.min(v.columns-1,x+1),top=Math.max(0,y-1),bottom=Math.min(v.rows-1,y+1);
    const sx=(grid.heights[y*v.columns+right]!-grid.heights[y*v.columns+left]!)/(layout.x.values[right]!-layout.x.values[left]!);
    const sy=(grid.heights[bottom*v.columns+x]!-grid.heights[top*v.columns+x]!)/(layout.y.values[bottom]!-layout.y.values[top]!);
    positions.set([layout.x.values[x]!-origin.x,layout.y.values[y]!-origin.y,grid.heights[i]!-origin.heightM],i*3);
    const length=Math.hypot(sx,sy,1);normals.set([-sx/length,-sy/length,1/length],i*3);
    uv.set([(layout.x.values[x]!-box.minX)/box.sizeM,(layout.y.values[y]!-box.minY)/box.sizeM],i*2);
  }
  const indices=new Uint32Array((v.columns-1)*(v.rows-1)*6);let at=0;
  for(let y=0;y<v.rows-1;y++)for(let x=0;x<v.columns-1;x++){
    const i=y*v.columns+x;indices.set([i,i+1,i+v.columns,i+1,i+v.columns+1,i+v.columns],at);at+=6;
  }
  const object:AtlasDeckSceneObject={id:`terrain-tile:${terrain.tile.lod}/${terrain.tile.x}/${terrain.tile.y}`,target:{kind:'terrain'},origin,positions,indices};
  let low=Infinity,high=-Infinity;for(const h of grid.heights){low=Math.min(low,h);high=Math.max(high,h);}
  geometry={bounds:{min:[box.minX,box.minY,low],max:[box.maxX,box.maxY,high]},object,data:[object],mesh:{attributes:{POSITION:{size:3,value:positions},NORMAL:{size:3,value:normals},TEXCOORD_0:{size:2,value:uv}},indices:{size:1,value:indices}}};
  geometryCache.set(terrain.projection.grid,geometry);
  }
  const {width,height,channels}=material;
  const materialData={
    masks:packedTexture([channels.water,channels.forest,channels.debris],width,height),
    cover:packedTexture(COVER_CHANNEL_NAMES.slice(0,4).map(c=>channels[c]),width,height),
    relief:{data:channels.relief,width,height}
  };
  const result={...geometry,texture:{data:channels.baseColor,width,height},...materialData};
  materials.set(material,result);return result;
}

/** Reject distant tile meshes before building their triangle index. */
export function atlasTerrainRayIntersects(model:AtlasTerrainTileModel,segment:readonly (readonly number[])[]):boolean {
  let near=0,far=1;
  for(let axis=0;axis<3;axis++){
    const start=segment[0]![axis]!,delta=segment[1]![axis]!-start,min=model.bounds.min[axis]!-1e-7,max=model.bounds.max[axis]!+1e-7;
    if(Math.abs(delta)<1e-15){if(start<min||start>max)return false;continue;}
    const a=(min-start)/delta,b=(max-start)/delta;near=Math.max(near,Math.min(a,b));far=Math.min(far,Math.max(a,b));if(far<near)return false;
  }
  return true;
}
