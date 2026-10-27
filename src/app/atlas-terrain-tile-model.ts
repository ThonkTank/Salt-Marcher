import {COVER_CHANNEL_NAMES} from './terrain-material';
import type {AtlasTerrainTile} from './atlas-terrain-tile';
import type {AtlasMaterialTile} from './atlas-material-tile';
import type {AtlasDeckSceneObject} from './atlas-deck-scene-model';
import {terrainGridLayout,terrainGridCoordinate} from './terrain-grid-layout';
import {atlasWorldTileBounds} from './atlas-world-tiles';
import {gridHeight,type TerrainGrid} from './terrain-spatial-model';
import type {AtlasSurfaceTile} from './atlas-surface-tile-stream';

export interface AtlasTerrainTileModel {
  grid:TerrainGrid;
  gridNormals:Float32Array;
  transition?:AtlasTerrainTransition;
  clipBounds?:readonly (readonly number[])[];
  object:AtlasDeckSceneObject;
  bounds:{min:readonly number[];max:readonly number[]};
  mesh:{attributes:{POSITION:{size:number;value:Float32Array};NORMAL:{size:number;value:Float32Array};TEXCOORD_0:{size:number;value:Float32Array}};indices:{size:number;value:Uint32Array}};
  data:AtlasDeckSceneObject[];
  texture:{data:Uint8Array;width:number;height:number};
  cover:{data:Uint8Array;width:number;height:number};
  relief:{data:Uint8Array;width:number;height:number};
  masks:{data:Uint8Array;width:number;height:number};
}
export interface AtlasTerrainTransition {
  start:number;duration:number;progress:number;presented:boolean;grid:TerrainGrid;normals:Float32Array;
  materialGrid:TerrainGrid;materialUv:readonly number[];
  heights:Float32Array;vertexNormals:Float32Array;
  texture:AtlasTerrainTileModel['texture'];masks:AtlasTerrainTileModel['masks'];cover:AtlasTerrainTileModel['cover'];relief:AtlasTerrainTileModel['relief'];
}
interface TerrainModelOptions {owner?:object;animate?:boolean;now?:number;geometryOnly?:boolean;normalField?:readonly AtlasTerrainTileModel[];fieldOnly?:boolean}
interface TerrainModelOwner {tiles:WeakRef<readonly AtlasSurfaceTile[]>;fence:string|undefined;revision:number|undefined;models:readonly AtlasTerrainTileModel[];frames:WeakMap<readonly AtlasSurfaceTile[],readonly AtlasTerrainTileModel[]>}
let modelMeasure:((phase:string,ms:number)=>void)|undefined;
export function withAtlasTerrainModelMeasurements<T>(measure:(phase:string,ms:number)=>void,run:()=>T):T{const previous=modelMeasure;modelMeasure=measure;try{return run();}finally{modelMeasure=previous;}}
let allocationBudget:((bytes:number)=>void)|undefined;
export function withAtlasTerrainAllocationBudget<T>(reserve:(bytes:number)=>void,run:()=>T):T{const previous=allocationBudget;allocationBudget=reserve;try{return run();}finally{allocationBudget=previous;}}
function array<T extends Float32Array|Uint32Array|Uint8Array>(kind:{new(source:number|ArrayLike<number>):T;BYTES_PER_ELEMENT:number},source:number|ArrayLike<number>):T{allocationBudget?.((typeof source==='number'?source:source.length)*kind.BYTES_PER_ELEMENT);return new kind(source);}
/** The worker owns the previous final field until the renderer explicitly
 * acknowledges its last alpha. Drop its obsolete morph inputs at that fence. */
export function completeAtlasTerrainModels(owner:object){const state=owners.get(owner);if(state)for(const model of state.models)delete model.transition;}
const owners=new WeakMap<object,TerrainModelOwner>();
const geometryCache=new WeakMap<AtlasTerrainTile['projection']['grid'],Pick<AtlasTerrainTileModel,'object'|'data'|'mesh'|'bounds'>>();
type TextureData=AtlasTerrainTileModel['texture'];
interface TextureNode {next:WeakMap<Uint8Array,TextureNode>;texture?:TextureData;}
const textureCache:TextureNode={next:new WeakMap()};
const directTextures=new WeakMap<Uint8Array,TextureData>();
function directTexture(data:Uint8Array,width:number,height:number):TextureData{const previous=directTextures.get(data);if(previous?.width===width&&previous.height===height)return previous;const texture={data,width,height};directTextures.set(data,texture);return texture;}
function* packedTextureSteps(buffers:Uint8Array[],width:number,height:number):Generator<void,TextureData> {
  let node=textureCache;
  for(const buffer of buffers){let child=node.next.get(buffer);if(!child){child={next:new WeakMap()};node.next.set(buffer,child);}node=child;}
  if(node.texture?.width===width&&node.texture.height===height)return node.texture;
  const data=array(Uint8Array,width*height*4);
  for(let i=0;i<width*height;i++){if((i&255)===0)yield;for(let c=0;c<4;c++)data[i*4+c]=buffers[c]?.[i]??255;}
  return node.texture={data,width,height};
}

const cached=new WeakMap<AtlasTerrainTile,WeakMap<AtlasMaterialTile,AtlasTerrainTileModel>>();
const frameCache=new WeakMap<readonly AtlasSurfaceTile[],readonly AtlasTerrainTileModel[]>();
const fieldFrameCache=new WeakMap<readonly AtlasSurfaceTile[],readonly AtlasTerrainTileModel[]>();
const identities=new WeakMap<object,number>();let identity=0;
function key(objects:readonly object[]):string{return objects.map(object=>{let id=identities.get(object);if(id===undefined){id=++identity;identities.set(object,id);}return id;}).join(',');}
const joinedGrids=new WeakMap<TerrainGrid,{key:string;grid:TerrainGrid}>();
const sharedNormals=new WeakMap<TerrainGrid,Float32Array>();
interface NormalNode {dependencies:WeakRef<TerrainGrid>[];queries:{x:number;y:number;width:number}[]}
interface NormalSupport {inputs:WeakSet<TerrainGrid>;nodes:NormalNode[];normals:Float32Array}
const normalSupport=new WeakMap<TerrainGrid,NormalSupport>();
const joinedMaterials=new WeakMap<AtlasSurfaceTile,{key:string;textures:Pick<AtlasTerrainTileModel,'texture'|'masks'|'cover'|'relief'>}>();
const clippedMeshes=new WeakMap<Float32Array,{key:string;normals:Float32Array;geometry:Pick<AtlasTerrainTileModel,'object'|'data'|'mesh'>}>();
/** Include derivations reachable through the current raw products or morph
 * fields, even when clipping makes their base mesh absent from the result. */
export function atlasTerrainModelRetained(tiles:readonly AtlasSurfaceTile[],models:readonly AtlasTerrainTileModel[]):unknown[]{
  const retained:unknown[]=[tiles,models],seen=new Set<TerrainGrid>();
  const grid=(g:TerrainGrid)=>{if(seen.has(g))return;seen.add(g);const geometry=geometryCache.get(g);retained.push(g,terrainGridLayout(g.view),geometry,sharedNormals.get(g),normalSupport.get(g)?.normals);if(geometry)retained.push(clippedMeshes.get(geometry.mesh.attributes.POSITION.value)?.geometry);const joined=joinedGrids.get(g);if(joined)grid(joined.grid);};
  for(const tile of tiles){grid(tile.terrain.projection.grid);retained.push(cached.get(tile.terrain)?.get(tile.material),joinedMaterials.get(tile)?.textures);const c=tile.material.channels;for(const buffers of [[c.water,c.forest,c.debris],COVER_CHANNEL_NAMES.slice(0,4).map(name=>c[name])]){let node:TextureNode|undefined=textureCache;for(const buffer of buffers)node=node?.next.get(buffer);retained.push(node?.texture);}}
  for(const model of models){grid(model.grid);if(model.transition)grid(model.transition.grid);}
  return retained;
}
/** Signed tile lookup for repeated edge/texel support queries. Exact boundary
 * points also inspect the touching tile; no rounded pixel surrogate is used. */
function tileLookup<T>(values:readonly T[],box:(value:T)=>{x:number;y:number;width:number}){
  const levels=new Map<number,Map<number,Map<number,T[]>>>();
  for(const value of values){const b=box(value);let columns=levels.get(b.width);if(!columns){columns=new Map();levels.set(b.width,columns);}const x=Math.round(b.x/b.width),y=Math.round(b.y/b.width);let rows=columns.get(x);if(!rows){rows=new Map();columns.set(x,rows);}const cell=rows.get(y)??[];cell.push(value);rows.set(y,cell);}
  const ordered=[...levels].sort((a,b)=>a[0]-b[0]);
  return(p:{x:number;y:number},accept:(value:T)=>boolean=()=>true):T|undefined=>{
    for(const [size,columns]of ordered){const x=Math.floor(p.x/size),y=Math.floor(p.y/size),xs=p.x===x*size?[x,x-1]:[x],ys=p.y===y*size?[y,y-1]:[y];for(const xx of xs)for(const yy of ys){const value=columns.get(xx)?.get(yy)?.find(accept);if(value)return value;}}
    return undefined;
  };
}
/** The finest visible source at a physical point. Inclusive edges use a stable
 * spatial tie-break, never publication order. Preparation may inspect all 32
 * sources; the renderer consumes the finite lookup prepared from these bounds. */
export function atlasTerrainFieldPointOwner(models:readonly AtlasTerrainTileModel[],p:{x:number;y:number}):number{
  let selected=-1;
  for(let i=0;i<models.length;i++){const b=models[i]!.grid.view.box;if(p.x<b.x||p.x>b.x+b.width||p.y<b.y||p.y>b.y+b.height)continue;
    if(selected<0||atlasTerrainFieldSourceOrder(models[i]!,models[selected]!)<0)selected=i;
  }return selected;
}
export function atlasTerrainFieldSourceOrder(a:AtlasTerrainTileModel,b:AtlasTerrainTileModel):number{
  const x=a.grid.view.box,y=b.grid.view.box;return x.width-y.width||x.x-y.x||x.y-y.y||String(a.object.id).localeCompare(String(b.object.id));
}
/** Resolve all incident sides at a source node, including a diagonal corner.
 * Only disposable displayed heights are joined; author arrays are untouched. */
export function atlasTerrainFieldBoundaryOwner(models:readonly AtlasTerrainTileModel[],slot:number,p:{x:number;y:number}):number{
  const model=models[slot]!,b=model.grid.view.box,step=terrainGridLayout(model.grid.view).minimumStep;
  const epsilon=Math.max(step*1e-6,Math.max(Math.abs(p.x),Math.abs(p.y))*Number.EPSILON*4,1e-9);
  if(Math.min(Math.abs(p.x-b.x),Math.abs(p.x-b.x-b.width),Math.abs(p.y-b.y),Math.abs(p.y-b.y-b.height))>epsilon)return slot;
  let selected=slot;
  for(const q of [{x:p.x-epsilon,y:p.y-epsilon},{x:p.x+epsilon,y:p.y-epsilon},{x:p.x-epsilon,y:p.y+epsilon},{x:p.x+epsilon,y:p.y+epsilon}]){
    const candidate=atlasTerrainFieldPointOwner(models,q);if(candidate<0)continue;
    const a=models[candidate]!,c=models[selected]!,as=terrainGridLayout(a.grid.view).minimumStep,cs=terrainGridLayout(c.grid.view).minimumStep;
    if(as>cs||as===cs&&atlasTerrainFieldSourceOrder(a,c)<0)selected=candidate;
  }return selected;
}
export function atlasTerrainFieldPhysicalSupport(models:readonly AtlasTerrainTileModel[],slot:number,p:{x:number;y:number}):number{
  if(slot<0)return 0;const model=models[slot]!,layout=terrainGridLayout(model.grid.view);
  let step=layout.minimumStep;const epsilon=Math.max(step*1e-6,Math.max(Math.abs(p.x),Math.abs(p.y))*Number.EPSILON*4,1e-9);
  for(const q of [{x:p.x-epsilon,y:p.y-epsilon},{x:p.x+epsilon,y:p.y-epsilon},{x:p.x-epsilon,y:p.y+epsilon},{x:p.x+epsilon,y:p.y+epsilon}]){
    const owner=atlasTerrainFieldPointOwner(models,q);if(owner>=0)step=Math.max(step,terrainGridLayout(models[owner]!.grid.view).minimumStep);
  }return step;
}

/** Triangular interpolation of resolved source nodes, matching the field ray.
 * The caller already knows the triangle owner; support probes resolve their
 * actual visible owner first. */
export function atlasTerrainFieldSample(models:readonly AtlasTerrainTileModel[],slot:number,p:{x:number;y:number}):number{
  const model=models[slot]!,view=model.grid.view,layout=terrainGridLayout(view),x=terrainGridCoordinate(layout.x,p.x),y=terrainGridCoordinate(layout.y,p.y),ix=Math.min(view.columns-2,Math.floor(x)),iy=Math.min(view.rows-2,Math.floor(y)),u=x-ix,v=y-iy;
  const node=(xx:number,yy:number)=>{const at={x:layout.x.values[xx]!,y:layout.y.values[yy]!};return gridHeight(models[atlasTerrainFieldBoundaryOwner(models,slot,at)]!.grid,at);};
  return u+v<=1?node(ix,iy)*(1-u-v)+node(ix+1,iy)*u+node(ix,iy+1)*v:node(ix+1,iy+1)*(u+v-1)+node(ix+1,iy)*(1-v)+node(ix,iy+1)*(1-u);
}
/** Physical diagnostic counterpart of the linked vertex gradient. It keeps
 * the one-sided denominator and never mixes already normalized vectors. */
export function atlasTerrainFieldGradient(models:readonly AtlasTerrainTileModel[],slot:number,p:{x:number;y:number},step:number):readonly [number,number]{
  const sample=(x:number,y:number)=>{const q={x,y},owner=atlasTerrainFieldPointOwner(models,q);return owner<0?undefined:atlasTerrainFieldSample(models,owner,q);};
  const center=atlasTerrainFieldSample(models,slot,p),l=sample(p.x-step,p.y),r=sample(p.x+step,p.y),t=sample(p.x,p.y-step),b=sample(p.x,p.y+step);
  const sx=l===undefined&&r===undefined?0:((r??center)-(l??center))/(step*(Number(l!==undefined)+Number(r!==undefined))),sy=t===undefined&&b===undefined?0:((b??center)-(t??center))/(step*(Number(t!==undefined)+Number(b!==undefined)));
  return[sx,sy];
}

/** Diagnostic presentation normal: interpolate shared coarse edge nodes at
 * cuts, while interior nodes keep the finer common source triangulation. */
export function atlasTerrainFieldPresentationNormal(old:readonly AtlasTerrainTileModel[],oldSlot:number,next:readonly AtlasTerrainTileModel[],nextSlot:number,p:{x:number;y:number},alpha:number,draft:readonly AtlasTerrainTileModel[]=[]):number[]{
  let basis=oldSlot<0?{models:next,slot:nextSlot}:nextSlot<0?{models:old,slot:oldSlot}:old[oldSlot]!.grid.view.box.width<next[nextSlot]!.grid.view.box.width?{models:old,slot:oldSlot}:{models:next,slot:nextSlot};
  const edge=(models:readonly AtlasTerrainTileModel[],slot:number)=>{if(slot<0)return false;const b=models[slot]!.grid.view.box,e=terrainGridLayout(models[slot]!.grid.view).minimumStep*1e-6;return Math.min(Math.abs(p.x-b.x),Math.abs(p.x-b.x-b.width),Math.abs(p.y-b.y),Math.abs(p.y-b.y-b.height))<=e;};
  if(edge(old,oldSlot)||edge(next,nextSlot))for(const side of [{models:old,slot:oldSlot},{models:next,slot:nextSlot}])if(side.slot>=0){const slot=atlasTerrainFieldBoundaryOwner(side.models,side.slot,p);if(side.models[slot]!.grid.view.box.width>=basis.models[basis.slot]!.grid.view.box.width)basis={models:side.models,slot};}
  const normal=(at:{x:number;y:number})=>{const o=atlasTerrainFieldPointOwner(old,at),n=atlasTerrainFieldPointOwner(next,at),d=atlasTerrainFieldPointOwner(draft,at),step=Math.max(atlasTerrainFieldPhysicalSupport(old,o,at),atlasTerrainFieldPhysicalSupport(next,n,at));
    if(o<0&&n<0)return[0,0,1];const before=o<0?atlasTerrainFieldGradient(next,n,at,step):atlasTerrainFieldGradient(old,o,at,step),after=n<0?before:atlasTerrainFieldGradient(next,n,at,step),delta=n>=0&&d>=0?atlasTerrainFieldGradient(draft,d,at,step).map((v,i)=>v-after[i]!):[0,0],g=before.map((v,i)=>(o<0?after[i]!:n<0?v:v*(1-alpha)+after[i]!*alpha)+delta[i]!),length=Math.hypot(...g,1);return[-g[0]!/length,-g[1]!/length,1/length];
  };
  const layout=terrainGridLayout(basis.models[basis.slot]!.grid.view),gx=terrainGridCoordinate(layout.x,p.x),gy=terrainGridCoordinate(layout.y,p.y),x=Math.min(63,Math.floor(gx)),y=Math.min(63,Math.floor(gy)),u=gx-x,v=gy-y;
  const nodes=u+v<=1?[[x,y,1-u-v],[x+1,y,u],[x,y+1,v]]:[[x+1,y+1,u+v-1],[x+1,y,1-v],[x,y+1,1-u]],result=[0,0,0];
  for(const [xx,yy,w] of nodes){if(!w)continue;const n=normal({x:layout.x.values[xx!]!,y:layout.y.values[yy!]!});for(let c=0;c<3;c++)result[c]!+=n[c]!*w;}return result;
}

/** A published height/material partition shares physical edge normals. Independent
 * one-sided derivatives illuminate the same world vertex differently on either
 * side of a tile border. Coarse/fine joins use the same central support size. */
export function atlasTerrainTileModels(tiles:readonly AtlasSurfaceTile[],options:TerrainModelOptions={}):readonly AtlasTerrainTileModel[]{
  if(options.owner){const owner=owners.get(options.owner),displayed=owner?.frames.get(tiles);if(displayed)return displayed;
    if(owner&&owner.tiles.deref()?.length===tiles.length){const old=new Set(owner.tiles.deref());if(tiles.every(t=>old.has(t))){owner.tiles=new WeakRef(tiles);owner.frames.set(tiles,owner.models);return owner.models;}}
  }
  const cache=options.fieldOnly?fieldFrameCache:frameCache,previous=cache.get(tiles);if(previous)return options.fieldOnly?previous:transitionModels(tiles,previous,options);
  let phaseStart=performance.now();const mark=(phase:string)=>{const now=performance.now();modelMeasure?.(phase,now-phaseStart);phaseStart=now;};
  const entries=tiles.map(t=>({tile:t,grid:t.terrain.projection.grid,box:atlasWorldTileBounds(t.tile)}));
  if(options.fieldOnly){
    const models=entries.map(({tile})=>atlasTerrainTileModel(tile.terrain,tile.material));cache.set(tiles,models);mark('fieldModelsMs');
    if(options.owner){const prior=owners.get(options.owner),frames=prior?.frames??new WeakMap();frames.set(tiles,models);owners.set(options.owner,{tiles:new WeakRef(tiles),fence:tiles[0]?.fence,revision:tiles[0]?.revision,models,frames});}
    return models;
  }
  const lookup=tileLookup(entries,e=>({x:e.box.minX,y:e.box.minY,width:e.box.sizeM}));
  const owner=(p:{x:number;y:number},source:AtlasSurfaceTile)=>lookup(p,e=>e.tile.fence===source.fence&&e.tile.revision===source.revision);
  const support=(entry:typeof entries[number])=>entries.filter(e=>e!==entry&&e.tile.fence===entry.tile.fence&&e.tile.revision===entry.tile.revision&&((e.box.minY<=entry.box.maxY&&e.box.maxY>=entry.box.minY&&(e.box.minX<entry.box.minX&&e.box.maxX>=entry.box.minX||e.box.minX<=entry.box.maxX&&e.box.maxX>entry.box.maxX))||(e.box.minX<=entry.box.maxX&&e.box.maxX>=entry.box.minX&&(e.box.minY<entry.box.minY&&e.box.maxY>=entry.box.minY||e.box.minY<=entry.box.maxY&&e.box.maxY>entry.box.maxY))));
  // Resolve coarser boundaries first. Fine edge nodes lie on the displayed
  // coarse segment, including a corner already joined to an even coarser tile.
  // This is disposable presentation geometry; author grids stay immutable.
  for(const entry of [...entries].sort((a,b)=>b.tile.tile.lod-a.tile.tile.lod)){
    const {tile,box,grid}=entry,v=grid.view,layout=terrainGridLayout(v);
    const neighbours=support(entry);if(!neighbours.some(e=>e.tile.tile.lod>tile.tile.lod))continue;
    const signature=key(neighbours.flatMap(e=>[e.tile,...(e.tile.tile.lod>tile.tile.lod?[e.grid]:[])])),cached=joinedGrids.get(grid);
    if(cached?.key===signature){entry.grid=cached.grid;continue;}
    const epsilon=Math.max(layout.minimumStep*1e-6,Math.max(Math.abs(box.minX),Math.abs(box.minY))*Number.EPSILON*4);
    const heights=array(Float32Array,grid.heights);let changed=false;
    for(let y=0;y<v.rows;y++)for(let x=0;x<v.columns;x++){
      if(x>0&&x<v.columns-1&&y>0&&y<v.rows-1)continue;
      const p={x:layout.x.values[x]!,y:layout.y.values[y]!};
      const adjacent=[...(x===0?[owner({x:p.x-epsilon,y:p.y},tile)]:[]),...(x===v.columns-1?[owner({x:p.x+epsilon,y:p.y},tile)]:[]),...(y===0?[owner({x:p.x,y:p.y-epsilon},tile)]:[]),...(y===v.rows-1?[owner({x:p.x,y:p.y+epsilon},tile)]:[])];
      const other=adjacent.filter((e):e is typeof entry=>!!e&&e.tile.fence===tile.fence&&e.tile.revision===tile.revision&&e.tile.tile.lod>tile.tile.lod).sort((a,b)=>b.tile.tile.lod-a.tile.tile.lod)[0];
      if(!other)continue;
      const i=y*v.columns+x,h=Math.fround(gridHeight(other.grid,p));if(h!==heights[i]){heights[i]=h;changed=true;}
    }
    if(changed)entry.grid=cached&&sameBuffer(cached.grid.heights,heights)?cached.grid:{...grid,heights};joinedGrids.set(grid,{key:signature,grid:entry.grid});
  }
  mark('joinsMs');
  const normalField=options.normalField&&tileLookup(options.normalField,m=>m.grid.view.box);
  const models=entries.map(({tile,grid,box})=>{
    const terrain=grid===tile.terrain.projection.grid?tile.terrain:{...tile.terrain,projection:{...tile.terrain.projection,grid}};
    const base=atlasTerrainTileModel(terrain,tile.material),v=grid.view,layout=terrainGridLayout(v);
    const clipBounds=mergeClipBounds(entries.filter(e=>e.tile.fence===tile.fence&&e.tile.revision===tile.revision&&e.tile.tile.lod<tile.tile.lod&&e.box.minX<box.maxX&&e.box.maxX>box.minX&&e.box.minY<box.maxY&&e.box.maxY>box.minY).map(e=>[(e.box.minX-box.minX)/box.sizeM,(e.box.minY-box.minY)/box.sizeM,(e.box.maxX-box.minX)/box.sizeM,(e.box.maxY-box.minY)/box.sizeM]));
    if(normalField){
      // Morph support samples the already displayed normal field. Re-deriving
      // every old boundary against the target partition is both redundant and
      // can change its first-frame lighting before the morph has even begun.
      const old=options.normalField!.find(m=>m.object.id===base.object.id);
      let normals=old&&(!old.transition||old.transition.progress>=1)?old.gridNormals:undefined;
      if(normals)modelMeasure?.('normalFieldNodesReused',grid.heights.length);
      if(!normals){modelMeasure?.('normalFieldNodesComputed',grid.heights.length);normals=array(Float32Array,grid.heights.length*3);for(let y=0;y<v.rows;y++)for(let x=0;x<v.columns;x++){
        const p={x:layout.x.values[x]!,y:layout.y.values[y]!},source=normalField(p);if(!source){normals.set(normalAt(grid,base.gridNormals,p),(y*v.columns+x)*3);continue;}
        const target=normalAt(source.grid,source.gridNormals,p),t=source.transition,before=t?normalAt(t.grid,t.normals,p):target;normals.set(target.map((n,i)=>before[i]!*(1-(t?.progress??1))+n*(t?.progress??1)),(y*v.columns+x)*3);
      }}
      return {...base,clipBounds,gridNormals:normals,mesh:{...base.mesh,attributes:{...base.mesh.attributes,NORMAL:{size:3,value:normals}}}};
    }
    const neighbours=entries.filter(e=>e.tile.fence===tile.fence&&e.tile.revision===tile.revision&&e.box.minX<=box.maxX&&e.box.maxX>=box.minX&&e.box.minY<=box.maxY&&e.box.maxY>=box.minY);
    if(neighbours.length===1)return base;
    const compatible=entries.filter(e=>e.tile.fence===tile.fence&&e.tile.revision===tile.revision),grids=new Set(compatible.map(e=>e.grid)),prior=normalSupport.get(grid);
    const added=prior?compatible.filter(e=>!prior.inputs.has(e.grid)):[];
    const valid=prior?.nodes.map(node=>node.dependencies.every(ref=>{const value=ref.deref();return value&&grids.has(value);})&&!added.some(e=>node.queries.some(p=>e.box.sizeM<=p.width&&p.x>=e.box.minX&&p.x<=e.box.maxX&&p.y>=e.box.minY&&p.y<=e.box.maxY)));
    if(prior&&valid?.every(Boolean)){
      modelMeasure?.('normalNodesReused',prior.nodes.length);prior.inputs=new WeakSet(grids);
      return {...base,clipBounds,gridNormals:prior.normals,mesh:{...base.mesh,attributes:{...base.mesh.attributes,NORMAL:{size:3,value:prior.normals}}}};
    }
    const normals=array(Float32Array,prior?.normals??base.mesh.attributes.NORMAL.value),nodes:NormalNode[]=[];let nodeIndex=0;
    for(let y=0;y<v.rows;y++)for(let x=0;x<v.columns;x++){
      if(x>0&&x<v.columns-1&&y>0&&y<v.rows-1)continue;
      const index=nodeIndex++;if(valid?.[index]){nodes.push(prior!.nodes[index]!);continue;}
      const dependencies=new Set<TerrainGrid>(),queries:NormalNode['queries']=[];
      const query=(p:{x:number;y:number})=>{const chosen=owner(p,tile);queries.push({...p,width:chosen?.box.sizeM??Infinity});if(chosen)dependencies.add(chosen.grid);return chosen;};
      const sample=(p:{x:number;y:number})=>{const chosen=query(p);return chosen?gridHeight(chosen.grid,p):undefined;};
      const p={x:layout.x.values[x]!,y:layout.y.values[y]!};
      const epsilon=Math.max(layout.minimumStep*1e-6,Math.max(Math.abs(p.x),Math.abs(p.y))*Number.EPSILON*4);
      let step=layout.minimumStep;for(const at of [{x:p.x-epsilon,y:p.y},{x:p.x+epsilon,y:p.y},{x:p.x,y:p.y-epsilon},{x:p.x,y:p.y+epsilon}]){const e=query(at);if(e)step=Math.max(step,terrainGridLayout(e.grid.view).minimumStep);}
      const l=sample({x:p.x-step,y:p.y}),r=sample({x:p.x+step,y:p.y}),t=sample({x:p.x,y:p.y-step}),b=sample({x:p.x,y:p.y+step});
      const old=base.mesh.attributes.NORMAL.value.subarray((y*v.columns+x)*3,(y*v.columns+x+1)*3);
      const h=l===undefined||r===undefined||t===undefined||b===undefined?sample(p)!:0;
      const sx=l===undefined&&r===undefined?-old[0]!/old[2]!:((r??h)-(l??h))/(step*(Number(l!==undefined)+Number(r!==undefined)));
      const sy=t===undefined&&b===undefined?-old[1]!/old[2]!:((b??h)-(t??h))/(step*(Number(t!==undefined)+Number(b!==undefined))),n=Math.hypot(sx,sy,1);
      normals.set([-sx/n,-sy/n,1/n],(y*v.columns+x)*3);nodes.push({dependencies:[...dependencies].map(g=>new WeakRef(g)),queries});
    }
    modelMeasure?.('normalNodesComputed',nodes.length-(valid?.filter(Boolean).length??0));modelMeasure?.('normalNodesReused',valid?.filter(Boolean).length??0);
    const previous=sharedNormals.get(grid),shared=previous&&sameBuffer(previous,normals)?previous:normals;sharedNormals.set(grid,shared);normalSupport.set(grid,{inputs:new WeakSet(grids),nodes,normals:shared});
    return {...base,clipBounds,gridNormals:shared,mesh:{...base.mesh,attributes:{...base.mesh.attributes,NORMAL:{size:3,value:shared}}}};
  });
  mark('normalsMs');
  // Material support follows the same visible neighbour as the mesh join.
  // Blend over two fine mesh cells; no authored channel is mutated or hidden.
  if(!options.geometryOnly)for(const entry of [...entries].sort((a,b)=>b.tile.tile.lod-a.tile.tile.lod)){
    const index=entries.indexOf(entry),base=models[index]!,b=entry.box,width=base.texture.width,height=base.texture.height,band=2*terrainGridLayout(entry.grid.view).minimumStep;
    const epsilon=Math.max(b.sizeM*1e-9,Math.max(Math.abs(b.minX),Math.abs(b.minY))*Number.EPSILON*4);
    // A band texel queries the same outside-edge point as every other
    // texel on its row/column. Resolve that finite support once, and key the
    // result by the owners actually selected (occluded neighbours are irrelevant).
    const left=Array.from({length:height},(_,y)=>owner({x:b.minX-epsilon,y:b.minY+(y+.5)/height*b.sizeM},entry.tile));
    const right=Array.from({length:height},(_,y)=>owner({x:b.maxX+epsilon,y:b.minY+(y+.5)/height*b.sizeM},entry.tile));
    const top=Array.from({length:width},(_,x)=>owner({x:b.minX+(x+.5)/width*b.sizeM,y:b.minY-epsilon},entry.tile));
    const bottom=Array.from({length:width},(_,x)=>owner({x:b.minX+(x+.5)/width*b.sizeM,y:b.maxY+epsilon},entry.tile));
    const neighbours=[...new Set([...left,...right,...top,...bottom].filter((e):e is typeof entry=>!!e))];
    const signature=key(neighbours.flatMap(e=>{const m=models[entries.indexOf(e)]!;return[e.tile,...(e.tile.tile.lod>entry.tile.tile.lod?[m.texture,m.masks,m.cover,m.relief]:[])];})),cached=joinedMaterials.get(entry.tile);
    if(cached?.key===signature){modelMeasure?.('materialTilesReused',1);models[index]={...base,...cached.textures};continue;}
    let blendedTexels=0;let textures:Record<'texture'|'masks'|'cover'|'relief',TextureData>|undefined;const sampleBuffer=[0,0,0,0];
    for(let y=0;y<height;y++)for(let x=0;x<width;x++){
      if(Math.min(x+.5,width-x-.5)*b.sizeM/width>=band&&Math.min(y+.5,height-y-.5)*b.sizeM/height>=band)continue;
      const p={x:b.minX+(x+.5)/width*b.sizeM,y:b.minY+(y+.5)/height*b.sizeM};
      const edges=[{distance:p.x-b.minX,other:left[y]},{distance:b.maxX-p.x,other:right[y]},{distance:p.y-b.minY,other:top[x]},{distance:b.maxY-p.y,other:bottom[x]}];
      let adjacent:typeof entry|undefined,weight=0;
      for(const edge of edges){if(edge.distance>=band)continue;const other=edge.other;if(!other||other.tile.tile.lod<=entry.tile.tile.lod)continue;const t=1-edge.distance/band,w=t*t*(3-2*t);if(w>weight){weight=w;adjacent=other;}}
      if(!adjacent)continue;blendedTexels++;
      const other=models[entries.indexOf(adjacent)]!;
      textures??=Object.fromEntries((['texture','masks','cover','relief'] as const).map(name=>[name,{...base[name],data:array(Uint8Array,base[name].data)}])) as Record<'texture'|'masks'|'cover'|'relief',TextureData>;
      for(const name of ['texture','masks','cover','relief'] as const){const sample=atlasTerrainTextureSample(other[name],adjacent.grid,p,sampleBuffer),at=(y*width+x)*4;for(let c=0;c<4;c++)textures![name].data[at+c]=Math.round(base[name].data[at+c]!*(1-weight)+sample[c]!*weight);}
    }
    modelMeasure?.('materialTexelsBlended',blendedTexels);const material=textures??{texture:base.texture,masks:base.masks,cover:base.cover,relief:base.relief};joinedMaterials.set(entry.tile,{key:signature,textures:material});if(textures)models[index]={...base,...textures};
  }
  mark('materialsMs');
  const clipped=options.geometryOnly?models:models.filter(model=>!model.clipBounds?.some(r=>r[0]!<=0&&r[1]!<=0&&r[2]!>=1&&r[3]!>=1)).map(clipTerrainModel).filter(model=>model.mesh.indices.value.length>0);frameCache.set(tiles,clipped);mark('clipMs');const result=transitionModels(tiles,clipped,options);mark('morphInclusiveMs');return result;
}

function normalAt(grid:TerrainGrid,normals:Float32Array,p:{x:number;y:number}):number[]{
  const l=terrainGridLayout(grid.view),x=terrainGridCoordinate(l.x,p.x),y=terrainGridCoordinate(l.y,p.y),ix=Math.min(grid.view.columns-2,Math.floor(x)),iy=Math.min(grid.view.rows-2,Math.floor(y)),u=x-ix,v=y-iy,i=iy*grid.view.columns+ix;
  const nodes=u+v<=1?[[i,1-u-v],[i+1,u],[i+grid.view.columns,v]]:[[i+grid.view.columns+1,u+v-1],[i+1,1-v],[i+grid.view.columns,1-u]];
  return [0,1,2].map(c=>nodes.reduce((sum,[at,w])=>sum+normals[at!*3+c]!*w!,0));
}
function sameBuffer(a:Uint8Array|Uint32Array|Float32Array,b:Uint8Array|Uint32Array|Float32Array):boolean{if(a===b)return true;if(a.length!==b.length)return false;for(let i=0;i<a.length;i++)if(a[i]!==b[i])return false;return true;}
function transitionModels(tiles:readonly AtlasSurfaceTile[],models:readonly AtlasTerrainTileModel[],options:TerrainModelOptions):readonly AtlasTerrainTileModel[]{
  if(!options.owner)return models;
  const previous=owners.get(options.owner),frames=previous?.frames??new WeakMap(),start=options.now??performance.now();
  let result=models;const created:AtlasTerrainTransition[]=[];
  if(previous&&options.animate!==false&&tiles[0]?.fence===previous.fence&&tiles[0]?.revision===previous.revision){
    const source=tileLookup(previous.models,m=>m.grid.view.box);
    const height=(p:{x:number;y:number},fallback:TerrainGrid)=>{const m=source(p);if(!m)return gridHeight(fallback,p);const t=m.transition;return t?gridHeight(t.grid,p)*(1-t.progress)+gridHeight(m.grid,p)*t.progress:gridHeight(m.grid,p);};
    const fromTiles=tiles.map(tile=>{const old=previous.models.find(m=>m.object.id===`terrain-tile:${tile.tile.lod}/${tile.tile.x}/${tile.tile.y}`);if(old&&(!old.transition||old.transition.progress>=1))return {...tile,terrain:{...tile.terrain,projection:{...tile.terrain.projection,grid:old.grid}}};const grid=tile.terrain.projection.grid,l=terrainGridLayout(grid.view),heights=array(Float32Array,grid.heights.length);for(let y=0;y<grid.view.rows;y++)for(let x=0;x<grid.view.columns;x++)heights[y*grid.view.columns+x]=height({x:l.x.values[x]!,y:l.y.values[y]!},grid);return{...tile,terrain:{...tile.terrain,projection:{...tile.terrain.projection,grid:{...grid,heights}}}};});
    const fromModels=atlasTerrainTileModels(fromTiles,{geometryOnly:true,normalField:previous.models});
    const fields=new Map(previous.models.map(m=>{const t=m.transition,unchanged=t&&JSON.stringify(t.materialGrid.view.box)===JSON.stringify(m.grid.view.box)&&(['texture','masks','cover','relief'] as const).every(name=>t[name].data===m[name].data);return[m,t&&t.progress<=0?{grid:t.materialGrid,texture:t.texture,masks:t.masks,cover:t.cover,relief:t.relief}:!t||t.progress>=1||unchanged?{grid:m.grid,texture:m.texture,masks:m.masks,cover:m.cover,relief:m.relief}:undefined] as const;}));
    const sameField=(a:NonNullable<ReturnType<typeof fields.get>>,c:ReturnType<typeof fields.get>)=>c&&JSON.stringify(a.grid.view.box)===JSON.stringify(c.grid.view.box)&&(['texture','masks','cover','relief'] as const).every(name=>a[name].data===c[name].data);
    result=models.map(model=>{
      const old=previous.models.find(m=>m.object.id===model.object.id);
      const unchanged=old&&(old.grid===model.grid||sameBuffer(old.grid.heights,model.grid.heights))&&sameBuffer(old.gridNormals,model.gridNormals)&&(['texture','masks','cover','relief'] as const).every(name=>old[name].data===model[name].data);
      if(unchanged&&(!old.transition||old.transition.progress>=1))return model;
      if(unchanged&&old.transition&&JSON.stringify(old.object.origin)===JSON.stringify(model.object.origin)&&sameBuffer(old.mesh.attributes.POSITION.value,model.mesh.attributes.POSITION.value)&&sameBuffer(old.mesh.indices.value,model.mesh.indices.value))return {...model,bounds:old.bounds,transition:old.transition};
      const from=fromModels.find(m=>m.object.id===model.object.id)!;
      const positions=model.mesh.attributes.POSITION.value,heights=array(Float32Array,positions.length/3),vertexNormals=array(Float32Array,positions.length);
      for(let i=0;i<heights.length;i++){const p={x:positions[i*3]!+model.object.origin.x,y:positions[i*3+1]!+model.object.origin.y};heights[i]=gridHeight(from.grid,p)-model.object.origin.heightM;vertexNormals.set(normalAt(from.grid,from.gridNormals,p),i*3);}
      const b=model.grid.view.box,w=model.texture.width,h=model.texture.height;
      const visible=(other:AtlasTerrainTileModel)=>{const a=other.grid.view.box,r=[Math.max(b.x,a.x),Math.max(b.y,a.y),Math.min(b.x+b.width,a.x+a.width),Math.min(b.y+b.height,a.y+a.height)];return r[0]!<r[2]!&&r[1]!<r[3]!&&!model.clipBounds?.some(q=>b.x+q[0]!*b.width<=r[0]!&&b.y+q[1]!*b.height<=r[1]!&&b.x+q[2]!*b.width>=r[2]!&&b.y+q[3]!*b.height>=r[3]!);};
      const paletteModel=previous.models.filter(m=>{const a=m.grid.view.box,field=fields.get(m);return field&&a.x<=b.x&&a.y<=b.y&&a.x+a.width>=b.x+b.width&&a.y+a.height>=b.y+b.height&&!previous.models.some(other=>other.grid.view.box.width<a.width&&visible(other)&&!sameField(field,fields.get(other)));}).sort((a,c)=>a.grid.view.box.width-c.grid.view.box.width)[0],palette=paletteModel&&fields.get(paletteModel);
      const textures=palette?{texture:palette.texture,masks:palette.masks,cover:palette.cover,relief:palette.relief}:Object.fromEntries((['texture','masks','cover','relief'] as const).map(name=>[name,{...model[name],data:array(Uint8Array,model[name].data.length)}])) as Pick<AtlasTerrainTransition,'texture'|'masks'|'cover'|'relief'>;
      const nextSample=[0,0,0,0],beforeSample=[0,0,0,0];
      if(!palette)for(let y=0;y<h;y++)for(let x=0;x<w;x++){
        const p={x:b.x+(x+.5)/w*b.width,y:b.y+(y+.5)/h*b.height},old=source(p),t=old?.transition;
        for(const name of ['texture','masks','cover','relief'] as const){const next=old?atlasTerrainTextureSample(old[name],old.grid,p,nextSample):atlasTerrainTextureSample(model[name],model.grid,p,nextSample),before=t?atlasTerrainTextureSample(t[name],t.materialGrid,p,beforeSample):next;
          for(let c=0;c<4;c++)textures[name].data[(y*w+x)*4+c]=Math.round(before[c]!*(1-(t?.progress??1))+next[c]!*(t?.progress??1));}
      }
      let low=model.bounds.min[2]!,high=model.bounds.max[2]!;for(const h of from.grid.heights){low=Math.min(low,h);high=Math.max(high,h);}
      const materialGrid=palette?.grid??model.grid,a=materialGrid.view.box,materialUv=[(b.x-a.x)/a.width,(b.y-a.y)/a.height,b.width/a.width,b.height/a.height];
      const transition:AtlasTerrainTransition={start,duration:180,progress:0,presented:false,grid:from.grid,normals:from.gridNormals,materialGrid,materialUv,heights,vertexNormals,...textures};created.push(transition);
      return {...model,bounds:{min:[model.bounds.min[0]!,model.bounds.min[1]!,low],max:[model.bounds.max[0]!,model.bounds.max[1]!,high]},transition};
    });
  }
  const armed=options.now??performance.now();for(const transition of created)transition.start=armed;
  frames.set(tiles,result);owners.set(options.owner,{tiles:new WeakRef(tiles),fence:tiles[0]?.fence,revision:tiles[0]?.revision,models:result,frames});return result;
}

/** The same interpolated heights used by the GPU, at its last submitted frame. */
export function atlasTerrainDisplayedGrid(model:AtlasTerrainTileModel):TerrainGrid{
  const t=model.transition;if(!t||t.progress>=1)return model.grid;
  return {...model.grid,heights:Float32Array.from(model.grid.heights,(h,i)=>t.grid.heights[i]!*(1-t.progress)+h*t.progress)};
}

function mergeClipBounds(input:number[][]):number[][]{
  const rects=input.slice();
  for(let changed=true;changed;){changed=false;
    outer:for(let i=0;i<rects.length;i++)for(let j=i+1;j<rects.length;j++){
      const a=rects[i]!,b=rects[j]!,r=[Math.min(a[0]!,b[0]!),Math.min(a[1]!,b[1]!),Math.max(a[2]!,b[2]!),Math.max(a[3]!,b[3]!)];
      const overlap=Math.max(0,Math.min(a[2]!,b[2]!)-Math.max(a[0]!,b[0]!))*Math.max(0,Math.min(a[3]!,b[3]!)-Math.max(a[1]!,b[1]!));
      if((r[2]!-r[0]!)*(r[3]!-r[1]!)!==(a[2]!-a[0]!)*(a[3]!-a[1]!)+(b[2]!-b[0]!)*(b[3]!-b[1]!)-overlap)continue;
      rects[i]=r;rects.splice(j,1);changed=true;break outer;
    }
  }return rects;
}

/** Cut covered parts out of the original triangles in physical metres. A
 * fragment/UV cut loses metre-scale precision inside a world-scale parent and
 * lets the parent's coplanar surface shimmer through fine terrain. Every new
 * vertex remains on its original triangle; the ray grid therefore stays exact. */
function clipTerrainModel(model:AtlasTerrainTileModel):AtlasTerrainTileModel{
  if(!model.clipBounds?.length)return model;
  const clipKey=JSON.stringify(model.clipBounds),cached=clippedMeshes.get(model.mesh.attributes.POSITION.value);
  if(cached?.key===clipKey){modelMeasure?.('clippedMeshesReused',1);
    if(cached.normals!==model.gridNormals){const positions=cached.geometry.mesh.attributes.POSITION.value,normals=array(Float32Array,positions.length);for(let i=0;i<positions.length;i+=3)normals.set(normalAt(model.grid,model.gridNormals,{x:positions[i]!+cached.geometry.object.origin.x,y:positions[i+1]!+cached.geometry.object.origin.y}),i);cached.geometry={...cached.geometry,mesh:{...cached.geometry.mesh,attributes:{...cached.geometry.mesh.attributes,NORMAL:{size:3,value:normals}}}};cached.normals=model.gridNormals;}
    return {...model,...cached.geometry};
  }
  const b=model.grid.view.box,rects=model.clipBounds.map(r=>[b.x+r[0]!*b.width,b.y+r[1]!*b.height,b.x+r[2]!*b.width,b.y+r[3]!*b.height]);
  const origin={...model.object.origin,x:Math.round((Math.min(...rects.map(r=>r[0]!))+Math.max(...rects.map(r=>r[2]!)))/512)*256,y:Math.round((Math.min(...rects.map(r=>r[1]!))+Math.max(...rects.map(r=>r[3]!)))/512)*256};
  const clips=rects.map(r=>[r[0]!-origin.x,r[1]!-origin.y,r[2]!-origin.x,r[3]!-origin.y]);
  const a=model.mesh.attributes,source=a.POSITION.value,n=a.NORMAL.value,uv=a.TEXCOORD_0.value;
  const vertices=Array.from({length:source.length/3},(_,i)=>[source[i*3]!+model.object.origin.x-origin.x,source[i*3+1]!+model.object.origin.y-origin.y,source[i*3+2]!,n[i*3]!,n[i*3+1]!,n[i*3+2]!,uv[i*2]!,uv[i*2+1]!]);
  const half=(polygon:number[][],axis:number,value:number,positive:boolean)=>{
    const result:number[][]=[];
    for(let i=0;i<polygon.length;i++){
      const p=polygon[i]!,q=polygon[(i+1)%polygon.length]!,inside=positive?p[axis]!>=value:p[axis]!<=value,next=positive?q[axis]!>=value:q[axis]!<=value;
      if(inside)result.push(p);
      if(inside!==next){const t=(value-p[axis]!)/(q[axis]!-p[axis]!),r=p.map((v,k)=>v+(q[k]!-v)*t);r[axis]=value;result.push(r);}
    }return result;
  };
  const positions:number[]=[],normals:number[]=[],texCoords:number[]=[],indices:number[]=[],seen=new Map<string,number>(),seenVertices=new Map<number[],number>();
  const add=(v:number[])=>{const known=seenVertices.get(v);if(known!==undefined)return known;const key=`${v[0]},${v[1]}`;let i=seen.get(key);if(i===undefined){i=seen.size;seen.set(key,i);positions.push(...v.slice(0,3));normals.push(...v.slice(3,6));texCoords.push(...v.slice(6,8));}seenVertices.set(v,i);return i;};
  const sourceIndices=model.mesh.indices.value;modelMeasure?.('clippedTrianglesVisited',sourceIndices.length/3);
  for(let i=0;i<sourceIndices.length;i+=3){
    const triangle=[vertices[sourceIndices[i]!]!,vertices[sourceIndices[i+1]!]!,vertices[sourceIndices[i+2]!]!],minX=Math.min(triangle[0]![0]!,triangle[1]![0]!,triangle[2]![0]!),maxX=Math.max(triangle[0]![0]!,triangle[1]![0]!,triangle[2]![0]!),minY=Math.min(triangle[0]![1]!,triangle[1]![1]!,triangle[2]![1]!),maxY=Math.max(triangle[0]![1]!,triangle[1]![1]!,triangle[2]![1]!);
    if(clips.some(r=>minX>=r[0]!&&maxX<=r[2]!&&minY>=r[1]!&&maxY<=r[3]!))continue;
    if(!clips.some(r=>minX<r[2]!&&maxX>r[0]!&&minY<r[3]!&&maxY>r[1]!)){indices.push(add(triangle[0]!),add(triangle[1]!),add(triangle[2]!));continue;}
    let polygons:number[][][]=[triangle];
    for(const r of clips){if(minX>=r[2]!||maxX<=r[0]!||minY>=r[3]!||maxY<=r[1]!)continue;const next:number[][][]=[];
      for(const polygon of polygons){
        if(Math.min(...polygon.map(p=>p[0]!))>=r[2]!||Math.max(...polygon.map(p=>p[0]!))<=r[0]!||Math.min(...polygon.map(p=>p[1]!))>=r[3]!||Math.max(...polygon.map(p=>p[1]!))<=r[1]!){next.push(polygon);continue;}
        let remaining=polygon;
        for(const [axis,value,positive]of [[0,r[0]!,true],[0,r[2]!,false],[1,r[1]!,true],[1,r[3]!,false]] as const){const outside=half(remaining,axis,value,!positive);if(outside.length>=3)next.push(outside);remaining=half(remaining,axis,value,positive);if(!remaining.length)break;}
      }polygons=next;
    }
    for(const polygon of polygons)for(let j=1;j<polygon.length-1;j++){
      const p=polygon[0]!,q=polygon[j]!,r=polygon[j+1]!;
      if((q[0]!-p[0]!)*(r[1]!-p[1]!)===(q[1]!-p[1]!)*(r[0]!-p[0]!))continue;
      indices.push(add(p),add(q),add(r));
    }
  }
  const packed=array(Float32Array,positions),triangles=array(Uint32Array,indices),object={...model.object,origin,positions:packed,indices:triangles};
  const geometry={object,data:[object],mesh:{attributes:{POSITION:{size:3,value:packed},NORMAL:{size:3,value:array(Float32Array,normals)},TEXCOORD_0:{size:2,value:array(Float32Array,texCoords)}},indices:{size:1,value:triangles}}};clippedMeshes.set(model.mesh.attributes.POSITION.value,{key:clipKey,normals:model.gridNormals,geometry});return {...model,...geometry};
}

/** Bilinear texture sampling in world metres, including clamp-to-edge support. */
export function atlasTerrainTextureSample(texture:TextureData,grid:TerrainGrid,p:{x:number;y:number},out:number[]=[0,0,0,0]):number[]{
  const b=grid.view.box,x=Math.max(0,Math.min(texture.width-1,(p.x-b.x)/b.width*texture.width-.5)),y=Math.max(0,Math.min(texture.height-1,(p.y-b.y)/b.height*texture.height-.5));
  const left=Math.floor(x),right=Math.min(texture.width-1,left+1),top=Math.floor(y),bottom=Math.min(texture.height-1,top+1),u=x-left,v=y-top;
  const a=(top*texture.width+left)*4,c=(top*texture.width+right)*4,d=(bottom*texture.width+left)*4,e=(bottom*texture.width+right)*4,w=(1-u)*(1-v),z=u*(1-v),r=(1-u)*v,s=u*v;
  for(let i=0;i<4;i++)out[i]=texture.data[a+i]!*w+texture.data[c+i]!*z+texture.data[d+i]!*r+texture.data[e+i]!*s;return out;
}
/** Immutable source pair; camera and style never rebuild these buffers. */
export function* atlasTerrainTileModelSteps(terrain:AtlasTerrainTile,material:AtlasMaterialTile):Generator<void,AtlasTerrainTileModel> {
  if(terrain.fence!==material.fence||terrain.revision!==material.revision||['lod','x','y'].some(k=>terrain.tile[k as keyof typeof terrain.tile]!==material.tile[k as keyof typeof material.tile]))throw Error('Höhe und Material gehören nicht zur selben Kachel.');
  let materials=cached.get(terrain);if(!materials){materials=new WeakMap();cached.set(terrain,materials);}
  const existing=materials.get(material);if(existing)return existing;
  let geometry=geometryCache.get(terrain.projection.grid);
  if(!geometry){
  const grid=terrain.projection.grid,v=grid.view,layout=terrainGridLayout(v),box=atlasWorldTileBounds(terrain.tile);
  const origin={x:box.minX,y:box.minY,heightM:Math.round(grid.heights[0]!/256)*256};
  const positions=array(Float32Array,grid.heights.length*3),normals=array(Float32Array,positions.length),uv=array(Float32Array,grid.heights.length*2);
  for(let y=0;y<v.rows;y++){yield;for(let x=0;x<v.columns;x++){
    const i=y*v.columns+x,left=Math.max(0,x-1),right=Math.min(v.columns-1,x+1),top=Math.max(0,y-1),bottom=Math.min(v.rows-1,y+1);
    const sx=(grid.heights[y*v.columns+right]!-grid.heights[y*v.columns+left]!)/(layout.x.values[right]!-layout.x.values[left]!);
    const sy=(grid.heights[bottom*v.columns+x]!-grid.heights[top*v.columns+x]!)/(layout.y.values[bottom]!-layout.y.values[top]!);
    positions.set([layout.x.values[x]!-origin.x,layout.y.values[y]!-origin.y,grid.heights[i]!-origin.heightM],i*3);
    const length=Math.hypot(sx,sy,1);normals.set([-sx/length,-sy/length,1/length],i*3);
    uv.set([(layout.x.values[x]!-box.minX)/box.sizeM,(layout.y.values[y]!-box.minY)/box.sizeM],i*2);
  }
  }
  const indices=array(Uint32Array,(v.columns-1)*(v.rows-1)*6);let at=0;
  for(let y=0;y<v.rows-1;y++){yield;for(let x=0;x<v.columns-1;x++){
    const i=y*v.columns+x;indices.set([i,i+1,i+v.columns,i+1,i+v.columns+1,i+v.columns],at);at+=6;
  }
  }
  const object:AtlasDeckSceneObject={id:`terrain-tile:${terrain.tile.lod}/${terrain.tile.x}/${terrain.tile.y}`,target:{kind:'terrain'},origin,positions,indices};
  let low=Infinity,high=-Infinity;for(const h of grid.heights){low=Math.min(low,h);high=Math.max(high,h);}
  geometry={bounds:{min:[box.minX,box.minY,low],max:[box.maxX,box.maxY,high]},object,data:[object],mesh:{attributes:{POSITION:{size:3,value:positions},NORMAL:{size:3,value:normals},TEXCOORD_0:{size:2,value:uv}},indices:{size:1,value:indices}}};
  geometryCache.set(terrain.projection.grid,geometry);
  }
  const {width,height,channels}=material;
  const materialData={
    masks:yield* packedTextureSteps([channels.water,channels.forest,channels.debris],width,height),
    cover:yield* packedTextureSteps(COVER_CHANNEL_NAMES.slice(0,4).map(c=>channels[c]),width,height),
    relief:directTexture(channels.relief,width,height)
  };
  const result={...geometry,grid:terrain.projection.grid,gridNormals:geometry.mesh.attributes.NORMAL.value,texture:directTexture(channels.baseColor,width,height),...materialData};
  materials.set(material,result);return result;
}

export function atlasTerrainTileModel(terrain:AtlasTerrainTile,material:AtlasMaterialTile):AtlasTerrainTileModel{const work=atlasTerrainTileModelSteps(terrain,material);let step=work.next();while(!step.done)step=work.next();return step.value;}

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
