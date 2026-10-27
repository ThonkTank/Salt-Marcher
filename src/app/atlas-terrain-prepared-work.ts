import {terrainAuthorGroundSample,terrainAuthorVisibilitySteps,terrainAuthorWater,type TerrainAuthorVisibilityContext} from './terrain-author-visibility';
import {atlasTerrainTileModelSteps,atlasTerrainFieldPointOwner,atlasTerrainFieldBoundaryOwner,atlasTerrainFieldPhysicalSupport,atlasTerrainFieldGradient,atlasTerrainFieldSample,type AtlasTerrainTileModel} from './atlas-terrain-tile-model';
import {prepareAtlasTerrainFieldGeometrySteps} from './atlas-terrain-field-presentation';
import {gridHeight} from './terrain-spatial-model';
import {terrainGridLayout,terrainGridCoordinate} from './terrain-grid-layout';
import {atlasTerrainTileQuery} from './atlas-terrain-tile';
import type {AtlasSurfaceTile} from './atlas-surface-tile-stream';
import type {TerrainMaterialChannel} from './terrain-material';
import {MACRO_RELIEF_RADIUS} from './terrain-material';
import {atlasSurfaceHeightMaterialSteps} from './atlas-surface-draft';
import {terrainPackBasis,terrainPackDraft} from './atlas-terrain-prepared-field';
import {terrainPreparedFamilyCache,terrainPreparedCensus} from './atlas-terrain-prepared-budget';
import {terrainPreparedView,type TerrainPreparedSource,type TerrainPreparedDisplaySource,type TerrainPreparedView,type TerrainPreparedGeometry,type TerrainPreparedBasis,type TerrainPreparedDraw,type TerrainPreparedDraftSource} from './atlas-terrain-prepared-contract';
import {applyTerrainBrushSteps} from './terrain-brush';
import {heightRecord,decodeHeights,TerrainSampler} from './terrain-height';
import type {LandscapeRecord} from './atlas-landscape';
import type {TerrainAuthorCheckpoint,TerrainAuthorPage,TerrainAuthorGround} from './terrain-author-checkpoint';
import type {TerrainAuthorReplayResult} from './terrain-author-state';
import type {TerrainPreparedCapture} from './atlas-terrain-prepared-contract';

/** The local registry distinguishes physical stores; IDs on wire name contents.
 * A transport copy retains its logical ID but is a separate physical owner. */
export class TerrainPreparedRegistry {
 private ids=new WeakMap<ArrayBuffer,number>();private next=1_000_000_000;
 readonly buffers=new Map<number,ArrayBuffer>();
 add(id:number,buffer:ArrayBuffer){const old=this.buffers.get(id);if(old&&old!==buffer)throw Error('Terrain-Arbeitsbuffer ersetzt.');this.buffers.set(id,buffer);this.ids.set(buffer,id);}
 ref(value:Float32Array|Float64Array|Uint32Array|Uint8Array):TerrainPreparedView{const buffer=value.buffer as ArrayBuffer;let id=this.ids.get(buffer);if(id===undefined){id=++this.next;this.add(id,buffer);}return{buffer:id,kind:value instanceof Float32Array?'f32':value instanceof Float64Array?'f64':value instanceof Uint32Array?'u32':'u8',offset:value.byteOffset,length:value.length};}
 retain(ids:ReadonlySet<number>){for(const id of this.buffers.keys())if(!ids.has(id))this.buffers.delete(id);}
 bytes(){return [...new Set(this.buffers.values())].reduce((s,b)=>s+b.byteLength,0);}
}
export function preparedSourceTile(source:TerrainPreparedSource,table:ReadonlyMap<number,ArrayBuffer>):AtlasSurfaceTile{
 const tile={lod:source.lod,x:source.x,y:source.y},view=atlasTerrainTileQuery({tile,revision:source.source.revision,product:'height'}).view;
 const channels=Object.fromEntries(Object.entries(source.material).map(([name,ref])=>[name,terrainPreparedView(ref!,table)]));
 return{tile,revision:source.source.revision,fence:source.source.fence,terrain:{tile,revision:source.source.revision,fence:source.source.fence,cache:'disabled',projection:{source:source.source.fence,fence:source.source.fence,revision:source.source.revision,generation:0,draft:false,heightOnly:true,width:0,height:0,pixels:new Uint8Array(),grid:{view,seaLevelM:source.seaLevelM,heights:terrainPreparedView(source.height,table) as Float32Array,editing:{ground:terrainPreparedView(source.ground,table) as Float32Array,water:terrainPreparedView(source.water,table) as Float32Array}}}},material:{tile,revision:source.source.revision,fence:source.source.fence,cache:'disabled',width:256,height:256,channels:channels as Record<TerrainMaterialChannel,Uint8Array>}} as AtlasSurfaceTile;
}
export function* preparedModels(tiles:readonly AtlasSurfaceTile[],owners:(roots:unknown)=>void=()=>{}):Generator<void,AtlasTerrainTileModel[]>{const models:AtlasTerrainTileModel[]=[];owners([tiles,models]);for(const t of tiles){models.push(yield* atlasTerrainTileModelSteps(t.terrain,t.material));yield;}return models;}
export function preparedDisplay(source:TerrainPreparedSource,model:AtlasTerrainTileModel,registry:TerrainPreparedRegistry,height?:TerrainPreparedView):TerrainPreparedDisplaySource{return{id:source.id,source:source.source,lod:source.lod,x:source.x,y:source.y,seaLevelM:source.seaLevelM,height:height??registry.ref(model.grid.heights),material:{texture:registry.ref(model.texture.data),masks:registry.ref(model.masks.data),cover:registry.ref(model.cover.data),relief:registry.ref(model.relief.data)}};}
const pointKey=(x:number,y:number)=>`${x}/${y}`;
export interface TerrainPreparedFamily {
 readonly models:readonly AtlasTerrainTileModel[];
 readonly nodeIds:ReadonlyMap<string,number>;
 readonly cache:ReturnType<typeof terrainPreparedFamilyCache>;
 readonly gradients:Float64Array;
}
export interface TerrainPreparedWorkBasis {
 basis:TerrainPreparedBasis;geometry:TerrainPreparedGeometry;tiles:AtlasSurfaceTile[];sources:readonly TerrainPreparedSource[];
 oldModels:readonly AtlasTerrainTileModel[];models:readonly AtlasTerrainTileModel[];
 oldFamily:TerrainPreparedFamily|null;family:TerrainPreparedFamily;
 cache:ReturnType<typeof terrainPreparedFamilyCache>;nodeIds:ReadonlyMap<string,number>;
 stencilNodes:Uint32Array;stencilWeights:Float64Array;
 changedRegions:readonly {x:number;y:number;width:number;height:number}[];draftModels:readonly AtlasTerrainTileModel[]|null;draftSources:readonly TerrainPreparedDraftSource[];confirmedDraft:{editSeries:number;draftRevision:number}|null;
}
/** A family has its own affine partition. A hanging edge node is evaluated on
 * its incident coarse triangle, not differentiated at a foreign finer point. */
export function terrainPreparedFamilyStencil(family:TerrainPreparedFamily,p:{x:number;y:number}){
 const owner=atlasTerrainFieldPointOwner(family.models,p);if(owner<0)return null;
 const slot=atlasTerrainFieldBoundaryOwner(family.models,owner,p),l=terrainGridLayout(family.models[slot]!.grid.view),gx=terrainGridCoordinate(l.x,p.x),gy=terrainGridCoordinate(l.y,p.y),x=Math.min(63,Math.floor(gx)),y=Math.min(63,Math.floor(gy)),u=gx-x,v=gy-y;
 const points=u+v<=1?[[x,y,1-u-v],[x+1,y,u],[x,y+1,v]]:[[x+1,y+1,u+v-1],[x+1,y,1-v],[x,y+1,1-u]];
 return points.map(q=>{const node=family.nodeIds.get(pointKey(l.x.values[q[0]!]!,l.y.values[q[1]!]!));if(node===undefined)throw Error('Terrain-Familienknoten fehlt.');return{node,weight:q[2]!};});
}
export function terrainPreparedFamilyGradient(family:TerrainPreparedFamily,p:{x:number;y:number}):readonly[number,number]{
 const nodes=terrainPreparedFamilyStencil(family,p);if(!nodes)throw Error('Terrain-Familienabdeckung fehlt.');let x=0,y=0;
 for(const n of nodes){x+=family.gradients[n.node*2]!*n.weight;y+=family.gradients[n.node*2+1]!*n.weight;}return[x,y];
}
/** Mutable draft arrays are never captured as an old family through the cache
 * object: the immutable endpoint holds the exact confirmed typed array. */
function endpointFamily(base:TerrainPreparedWorkBasis,draft:boolean):TerrainPreparedFamily{return{models:draft?base.draftModels!:base.models,nodeIds:base.nodeIds,cache:base.cache,gradients:draft?base.cache.draftGradients:base.cache.gradients};}
function* familyGradients(family:TerrainPreparedFamily,models:readonly AtlasTerrainTileModel[],target:Float64Array,reserve:(n:number)=>void,invalidations?:readonly {x:number;y:number;width:number;height:number}[],owners:(roots:unknown)=>void=()=>{}):Generator<void>{
 const {cache}=family,count=cache.sources.length;reserve(count);const visited=new Uint8Array(count);owners([family,target,visited]);
 function* evaluate(i:number):Generator<void>{if(visited[i]===2)return;if(visited[i]===1)throw Error('Terrain-Familienknotenzyklus.');visited[i]=1;yield;
  const rect=i*4,changed=!invalidations||invalidations.some(r=>r.x<=cache.rectangles[rect+2]!&&r.x+r.width>=cache.rectangles[rect]!&&r.y<=cache.rectangles[rect+3]!&&r.y+r.height>=cache.rectangles[rect+1]!);
  if(!changed){visited[i]=2;return;}
  const p={x:cache.xySupport[i*3]!,y:cache.xySupport[i*3+1]!},stencil=terrainPreparedFamilyStencil(family,p)!;
  const own=stencil.find(n=>n.node===i&&n.weight===1);
  if(own){target.set(atlasTerrainFieldGradient(models,cache.sources[i]!,p,cache.xySupport[i*3+2]!),i*2);}
  else{let x=0,y=0,mask=0,l=Infinity,t=Infinity,r=-Infinity,b=-Infinity;for(const n of stencil){if(n.weight===0)continue;yield* evaluate(n.node);x+=target[n.node*2]!*n.weight;y+=target[n.node*2+1]!*n.weight;mask|=cache.sourceMasks[n.node]!;l=Math.min(l,cache.rectangles[n.node*4]!);t=Math.min(t,cache.rectangles[n.node*4+1]!);r=Math.max(r,cache.rectangles[n.node*4+2]!);b=Math.max(b,cache.rectangles[n.node*4+3]!);}
   target.set([x,y],i*2);if(!invalidations){cache.rectangles.set([l,t,r,b],rect);cache.sourceMasks[i]=mask;}
  }visited[i]=2;
 }
 for(let i=0;i<count;i++)yield* evaluate(i);
}
export function* prepareTerrainFamily(models:readonly AtlasTerrainTileModel[],reserve:(n:number)=>void,owners:(roots:unknown)=>void=()=>{}):Generator<void,TerrainPreparedFamily>{
 const nodeIds=new Map<string,number>();for(const m of models){const l=terrainGridLayout(m.grid.view);for(let y=0;y<65;y++){yield;for(let x=0;x<65;x++){const key=pointKey(l.x.values[x]!,l.y.values[y]!);if(!nodeIds.has(key))nodeIds.set(key,nodeIds.size);}}}
 const cache=terrainPreparedFamilyCache(nodeIds.size,reserve);let i=0;for(const key of nodeIds.keys()){if((i&31)===0)yield;const [x,y]=key.split('/').map(Number),p={x:x!,y:y!},owner=atlasTerrainFieldPointOwner(models,p),step=atlasTerrainFieldPhysicalSupport(models,owner,p);cache.xySupport.set([p.x,p.y,step],i*3);cache.sources[i]=owner;
  let reach=step,mask=0;for(let j=0;j<models.length;j++){const m=models[j]!,b=m.grid.view.box;if(p.x+step>=b.x&&p.x-step<=b.x+b.width&&p.y+step>=b.y&&p.y-step<=b.y+b.height){reach=Math.max(reach,terrainGridLayout(m.grid.view).minimumStep+step);mask|=1<<j;}}
  cache.rectangles.set([p.x-reach,p.y-reach,p.x+reach,p.y+reach],i*4);cache.sourceMasks[i]=mask;i++;
 }
 const family={models,nodeIds,cache,gradients:cache.gradients};owners([family]);yield* familyGradients(family,models,cache.gradients,reserve,undefined,owners);cache.draftGradients.set(cache.gradients);owners([family]);return family;
}
function* rayIndex(vertices:Float32Array,indices:Uint32Array,draws:readonly {origin:{x:number;y:number};bounds:{x:number;y:number;width:number;height:number};oldSlot:number;newSlot:number;firstIndex:number;indexCount:number}[],reserve:(n:number)=>void):Generator<void,{nodes:Uint32Array;triangles:Uint32Array;draws:TerrainPreparedDraw[]}>{
 const count=(n:number):number=>n<=8?1:1+count(Math.floor(n/2))+count(n-Math.floor(n/2));
 let nodeCount=0;for(const d of draws)nodeCount+=count(d.indexCount/3);
 reserve(nodeCount*32+indices.length/3*4);const nodes=new Uint32Array(nodeCount*8),bounds=new Float32Array(nodes.buffer),triangles=new Uint32Array(indices.length/3),result:TerrainPreparedDraw[]=[];let node=0,triangle=0;
 function* build(first:number,n:number):Generator<void,number>{const id=node++,k=id*8;let left=Infinity,top=Infinity,right=-Infinity,bottom=-Infinity;
  for(let t=first;t<first+n;t++){if((t&63)===0)yield;for(let c=0;c<3;c++){const v=indices[t*3+c]!*14,x=vertices[v]!,y=vertices[v+1]!;left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}}
  bounds.set([left,top,right,bottom],k);if(n<=8){nodes[k+6]=triangle;nodes[k+7]=n;for(let i=0;i<n;i++)triangles[triangle++]=first+i;}else{const a=Math.floor(n/2);nodes[k+4]=yield* build(first,a);nodes[k+5]=yield* build(first+a,n-a);}return id;
 }
 for(const d of draws){const first=triangle,root=yield* build(d.firstIndex/3,d.indexCount/3);result.push({origin:[d.origin.x,d.origin.y],bounds:[d.bounds.x,d.bounds.y,d.bounds.x+d.bounds.width,d.bounds.y+d.bounds.height],oldSlot:d.oldSlot,newSlot:d.newSlot,firstIndex:d.firstIndex,indexCount:d.indexCount,rayRoot:root,rayFirstTriangle:first,rayTriangleCount:d.indexCount/3});}
 return{nodes,triangles,draws:result};
}
export function* prepareTerrainBasis(basis:TerrainPreparedBasis,old:TerrainPreparedWorkBasis|null,sources:readonly TerrainPreparedSource[],table:ReadonlyMap<number,ArrayBuffer>,registry:TerrainPreparedRegistry,reserve:(n:number)=>void,oldDraftEndpoint=false,phase:(name:string)=>void=()=>{},owners:(roots:unknown)=>void=()=>{}):Generator<void,TerrainPreparedWorkBasis>{
 phase('models');const tiles=sources.map(s=>preparedSourceTile(s,table)),models=yield* preparedModels(tiles,owners),oldModels=(oldDraftEndpoint?old?.draftModels:old?.models)??[];
 phase('topology');const geometry=yield* prepareAtlasTerrainFieldGeometrySteps(oldModels,models,0,0,{reserve});owners([tiles,models,oldModels,geometry]);
 phase('nodes');const family=yield* prepareTerrainFamily(models,reserve,roots=>owners([tiles,models,oldModels,geometry,roots])),cache=family.cache,nodeIds=family.nodeIds,oldFamily=old?endpointFamily(old,oldDraftEndpoint):null;
 phase('stencils');const v=geometry.vertices.length/4;reserve(v*(56+28));const vertices=new Float32Array(v*14),stencilNodes=new Uint32Array(v*3),stencilWeights=new Float64Array(v*2);owners([tiles,models,oldModels,geometry,family,oldFamily,vertices,stencilNodes,stencilWeights]);
 for(const d of geometry.draws){const done=new Set<number>();for(let t=d.firstIndex;t<d.firstIndex+d.indexCount;t++){if((t&255)===0)yield;const i=geometry.indices[t]!;if(done.has(i))continue;done.add(i);const p={x:d.origin.x+geometry.vertices[i*4]!,y:d.origin.y+geometry.vertices[i*4+1]!};
  const stencil=d.newSlot<0?null:terrainPreparedFamilyStencil(family,p),ga=oldFamily&&d.oldSlot>=0?terrainPreparedFamilyGradient(oldFamily,p):terrainPreparedFamilyGradient(family,p),gb=stencil?terrainPreparedFamilyGradient(family,p):ga;
  if(stencil)for(let k=0;k<3;k++){stencilNodes[i*3+k]=stencil[k]!.node;if(k<2)stencilWeights[i*2+k]=stencil[k]!.weight;}
  const h0=d.oldSlot<0?atlasTerrainFieldSample(models,d.newSlot,p):atlasTerrainFieldSample(oldModels,d.oldSlot,p),h1=d.newSlot<0?h0:atlasTerrainFieldSample(models,d.newSlot,p);
  terrainPackBasis(vertices,i,[geometry.vertices[i*4]!,geometry.vertices[i*4+1]!],{height:h0,gradientX:ga[0]!,gradientY:ga[1]!},{height:h1,gradientX:gb[0]!,gradientY:gb[1]!},d.newSlot<0);
 }}
 phase('ray');const ray=yield* rayIndex(vertices,geometry.indices,geometry.draws,reserve);
 const result:TerrainPreparedGeometry={basis,vertices:registry.ref(vertices),indices:registry.ref(geometry.indices),draws:ray.draws,rayNodes:registry.ref(ray.nodes),rayTriangles:registry.ref(ray.triangles),oldSources:old?old.sources.map((s,i)=>preparedDisplay(s,oldModels[i]!,registry,oldDraftEndpoint?old.draftSources[i]!.height!:undefined)):[],newSources:sources.map((s,i)=>preparedDisplay(s,models[i]!,registry))};
 const value:TerrainPreparedWorkBasis={basis,geometry:result,tiles,sources,oldModels,models,oldFamily,family,cache,nodeIds,stencilNodes,stencilWeights,changedRegions:[],draftModels:null,draftSources:[],confirmedDraft:null};owners(value);return value;
}
const pageKey=(p:Pick<TerrainAuthorPage,'x'|'y'|'pixel'>)=>`${p.pixel}:${p.x},${p.y}`;
export interface TerrainPreparedNeedSeed {gesture:string}
/** Same authored-band form operations as A's reference replay. Only scheduling
 * boundaries differ. The receiver supplies the exact immutable gesture's seed. */
export function* replayTerrainAuthorSteps(capture:TerrainPreparedCapture,initial:TerrainAuthorCheckpoint,owners:(roots:unknown)=>void=()=>{},table?:ReadonlyMap<number,ArrayBuffer>,phase:(name:string)=>void=()=>{}):Generator<void|TerrainPreparedNeedSeed,TerrainAuthorReplayResult,TerrainAuthorCheckpoint|undefined>{
 let ground:TerrainAuthorGround[]=[];for(const g of initial.ground){ground.push({lattice:{...g.lattice},values:g.values.slice()});yield;}
 let basis:TerrainAuthorPage[]=[];for(const p of initial.pages){basis.push({...p,values:p.values.slice()});yield;}
 const overlay=new Map<string,TerrainAuthorPage>(),operations=[...capture.suffix.map(g=>({id:g.id,stroke:g.stroke})),...(capture.active?[capture.active]:[])];
 const sample=(p:{x:number;y:number})=>terrainAuthorGroundSample(ground,p);
 for(const action of operations){phase('replay-seed');const v=capture.visibilityContexts?.find(v=>v.gesture===action.id),context:TerrainAuthorVisibilityContext|undefined=v?{owner:v.owner,series:v.editSeries,source:v.source,sources:v.sources.map(s=>({...s,water:terrainPreparedView(s.water,table!) as Float32Array}))}:undefined;owners([initial,ground,basis,overlay]);const seed=yield{gesture:action.id};if(!seed)throw Error('Terrain-Replayseed fehlt.');phase('replay-pages');basis=[];for(const p of seed.pages){basis.push({...p,values:p.values.slice()});yield;}
  owners([initial,ground,basis,overlay,seed]);const before:LandscapeRecord[]=[];for(const p of basis){const v=overlay.get(pageKey(p))??p;before.push(heightRecord(v.x,v.y,v.pixel,v.values,2));yield;}
  owners([initial,ground,basis,overlay,seed,before]);phase('replay-visibility');const p0=yield* TerrainSampler.steps(before,false),visible=action.stroke.visibility?yield* terrainAuthorVisibilitySteps(ground,action.stroke.visibility,terrainAuthorWater(context!)):undefined,edited=yield* replayBrush(before,action.stroke,visible,sample,phase),after=new Map(before.map(r=>[r.id,r]));
  for(const r of edited){after.set(r.id,r);const h=r.height!;overlay.set(pageKey(h),{x:h.x,y:h.y,pixel:h.pixel,revision:r.revision,values:decodeHeights(h).slice()});yield;}
  owners([initial,ground,basis,overlay,seed,before,p0,visible,edited,after]);phase('replay-ground');const p1=yield* TerrainSampler.steps([...after.values()],false),next:TerrainAuthorGround[]=[];owners([initial,ground,basis,overlay,seed,before,p0,visible,edited,after,p1,next]);
  for(const g of ground){const values=g.values.slice(),l=g.lattice;for(let y=0;y<65;y++){yield;for(let x=0;x<65;x++){const p={x:l.x+x*l.dx,y:l.y+y*l.dy};values[y*65+x]=values[y*65+x]!+p1.sample(p).heightM-p0.sample(p).heightM;}}next.push({lattice:g.lattice,values});}ground=next;
 }return{ground,basis,bands:[...overlay.values()]};
}
function* replayBrush(before:LandscapeRecord[],stroke:import('./terrain-brush').HeightStroke,visible:import('./terrain-spatial-model').TerrainGrid|undefined,sample:(p:{x:number;y:number})=>number,phase:(name:string)=>void){phase('replay-form');return yield* applyTerrainBrushSteps(before,stroke,undefined,visible,sample,true);}
export interface TerrainPreparedDraftState {gradients:Float64Array<ArrayBuffer>;revisions:Uint32Array<ArrayBuffer>;regions:readonly {x:number;y:number;width:number;height:number}[];models:readonly AtlasTerrainTileModel[];sources:readonly TerrainPreparedDraftSource[]}
export function* prepareTerrainDraft(base:TerrainPreparedWorkBasis,ground:readonly TerrainAuthorGround[],revision:number,registry:TerrainPreparedRegistry,reserve:(n:number)=>void,phase:(name:string)=>void=()=>{},landColor:string,owners:(roots:unknown)=>void=()=>{}):Generator<void,{draft:TerrainPreparedView;sources:readonly TerrainPreparedDraftSource[];state:TerrainPreparedDraftState}>{
 phase('draft-ground');const regions:{x:number;y:number;width:number;height:number}[]=[],tiles:AtlasSurfaceTile[]=[];
 for(let i=0;i<base.tiles.length;i++){const tile=base.tiles[i]!,grid=tile.terrain.projection.grid,g=ground.find(g=>g.lattice.id===base.sources[i]!.id);if(!g)throw Error('Terrain-Draftgrund fehlt.');const l=terrainGridLayout(grid.view);if(g.lattice.x!==l.x.values[0]||g.lattice.y!==l.y.values[0]||g.lattice.dx!==l.minimumStep||g.lattice.dy!==l.minimumStep)throw Error('Terrain-Draftlattice passt nicht zur Quelle.');
  reserve(2*4225*8);const raw=new Float64Array(4225),heights=new Float64Array(4225);owners([tiles,raw,heights]);let x0=65,y0=65,x1=-1,y1=-1;
  for(let y=0;y<65;y++){yield;for(let x=0;x<65;x++){const j=y*65+x;raw[j]=g.values[j]!;heights[j]=Math.max(raw[j]!,grid.editing!.water[j]!);if(raw[j]!==grid.editing!.ground[j]){x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);}}}
  if(x1<0){tiles.push(tile);continue;}regions.push({x:l.x.values[Math.max(0,x0-1)]!,y:l.y.values[Math.max(0,y0-1)]!,width:l.x.values[Math.min(64,x1+1)]!-l.x.values[Math.max(0,x0-1)]!,height:l.y.values[Math.min(64,y1+1)]!-l.y.values[Math.max(0,y0-1)]!});tiles.push({...tile,terrain:{...tile.terrain,projection:{...tile.terrain.projection,grid:{...grid,heights:heights as unknown as Float32Array,editing:{ground:raw as unknown as Float32Array,water:grid.editing!.water}}}}});
 }
 const heights=tiles.map(t=>t.terrain.projection.grid);
 const sample=(p:{x:number;y:number},fallback:AtlasSurfaceTile['terrain']['projection']['grid'])=>{let selected:typeof fallback|undefined;for(const g of heights){const b=g.view.box;if(p.x>=b.x&&p.x<=b.x+b.width&&p.y>=b.y&&p.y<=b.y+b.height&&(!selected||b.width<selected.view.box.width))selected=g;}return gridHeight(selected??fallback,p);};
 phase('draft-material');const materialTiles:AtlasSurfaceTile[]=[];for(let i=0;i<tiles.length;i++){const tile=base.tiles[i]!,old=tiles[i]!,b=old.terrain.projection.grid.view.box,r=b.width/256*MACRO_RELIEF_RADIUS,affected=regions.filter(q=>q.x<=b.x+b.width+r&&q.x+q.width>=b.x-r&&q.y<=b.y+b.height+r&&q.y+q.height>=b.y-r);materialTiles.push(affected.length?yield* atlasSurfaceHeightMaterialSteps(tile,old,affected,sample,landColor):old);}
 phase('draft-nodes');const models=yield* preparedModels(materialTiles,roots=>owners([tiles,materialTiles,roots])),cache=base.cache;reserve(cache.draftGradients.byteLength+cache.draftRevisions.byteLength);const draftGradients=cache.draftGradients.slice(),draftRevisions=cache.draftRevisions.slice(),invalidations=[...base.changedRegions,...regions];
 yield* familyGradients(base.family,models,draftGradients,reserve,invalidations,roots=>owners([tiles,materialTiles,models,draftGradients,draftRevisions,roots]));for(let i=0;i<draftRevisions.length;i++){if((i&255)===0)yield;const k=i*4;if(invalidations.some(r=>r.x<=cache.rectangles[k+2]!&&r.x+r.width>=cache.rectangles[k]!&&r.y<=cache.rectangles[k+3]!&&r.y+r.height>=cache.rectangles[k+1]!))draftRevisions[i]=revision;}
 phase('draft-fill');const packed=terrainPreparedView(base.geometry.vertices,registry.buffers) as Float32Array,indices=terrainPreparedView(base.geometry.indices,registry.buffers) as Uint32Array,vertices=packed.length/14;reserve(vertices*24);const draft=new Float32Array(vertices*6);owners([tiles,materialTiles,models,draftGradients,draftRevisions,draft]);
 for(const draw of base.geometry.draws){const done=new Set<number>();for(let t=draw.firstIndex;t<draw.firstIndex+draw.indexCount;t++){if((t&127)===0)yield;const i=indices[t]!;if(done.has(i))continue;done.add(i);const p={x:draw.origin[0]+packed[i*14]!,y:draw.origin[1]+packed[i*14+1]!},n=atlasTerrainFieldPointOwner(models,p),o=atlasTerrainFieldPointOwner(base.oldModels,p),h=draw.newSlot<0?atlasTerrainFieldSample(base.oldModels,o,p):atlasTerrainFieldSample(models,n,p);let gx=0,gy=0;const a=base.stencilWeights[i*2]!,b=base.stencilWeights[i*2+1]!,weights=[a,b,1-a-b];for(let k=0;k<3;k++){const node=base.stencilNodes[i*3+k]!;gx+=draftGradients[node*2]!*weights[k]!;gy+=draftGradients[node*2+1]!*weights[k]!;}if(draw.newSlot<0){const g=terrainPreparedFamilyGradient(base.oldFamily!,p);gx=g[0];gy=g[1];}terrainPackDraft(draft,i,{height:h,gradientX:gx,gradientY:gy});}}

 const sources=models.map((m,i)=>{reserve(4225*4);return{sourceId:base.sources[i]!.id,material:preparedDisplay(base.sources[i]!,m,registry).material,height:registry.ref(new Float32Array(m.grid.heights))};});return{draft:registry.ref(draft),sources,state:{gradients:draftGradients,revisions:draftRevisions,regions,models,sources}};
}
export function preparedWorkBytes(value:unknown){let id=0;return terrainPreparedCensus([{owner:'worker',value}],()=>++id).bytes;}
