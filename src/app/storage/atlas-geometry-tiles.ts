import {createHash} from 'node:crypto';
import {atlasGeometryTileBox,type AtlasGeometryTile,type AtlasGeometryTileRequest} from '../atlas-geometry-tile';
import {buildAtlasGeometryMesh} from '../atlas-geometry-mesh';
import type {AtlasSceneView} from '../atlas-scene-geometry';
import type {AtlasDeckSceneModel} from '../atlas-deck-scene-model';
import type {AtlasRegionSource} from '../atlas-region-contracts';
import type {Point} from '../contracts';
import type {AtlasRegionReader} from './atlas-region';
import {AtlasTileCache} from './atlas-tile-cache';
import {projectionKey} from './atlas-projection-index';

// Bump for mesh, sampling or physical-floor semantics, not only SQL schema.
const FORMAT='geometry-tiles-v2';
type Sample={point:Point;heightM:number};
interface StoredGeometry {shapeVersion:string;geometryVersion:string;input:string;samples:Sample[];model:AtlasDeckSceneModel}
/** Geometry-only identity: names, labels and author revision counters do not
 * alter triangles. Frames, hidden floors/rooms and anchor data do. */
function inputFingerprint(view:AtlasSceneView):string{
 const input={cities:view.cities.map(c=>({id:c.header.id,units:c.units})),bindings:view.bindings,
  frames:view.region.frames,interiors:view.region.interiors,rooms:view.workspace.rooms,
  floors:view.geometry.floors,drawing:view.geometry.drawing};
 return createHash('sha256').update(JSON.stringify(input,(key,value)=>['name','label','revision','number','protected'].includes(key)?undefined:value)).digest('hex');
}
function sourceCoverage(model:AtlasDeckSceneModel,view:AtlasSceneView):AtlasDeckSceneModel{
 // Broken sources whose bounds cannot be recovered remain an explicit global
 // uncertainty. Updating that warning alone must not retriangulate good tiles.
 const unsupported=model.coverage.unsupported.filter(x=>x.code!=='region-coverage-incomplete');
 if(!view.region.coverage.complete)unsupported.push({code:'region-coverage-incomplete',detail:`Atlasregion meldet ${view.region.coverage.unreadable} nicht lesbare Geometrien.`});
 return {...model,coverage:{...model.coverage,complete:unsupported.length===0,unsupported}};
}
function valid(value:StoredGeometry|undefined):value is StoredGeometry{
 return !!value&&typeof value.shapeVersion==='string'&&typeof value.geometryVersion==='string'&&typeof value.input==='string'&&
  Array.isArray(value.samples)&&value.samples.every(s=>s&&s.point&&[s.point.x,s.point.y,s.heightM].every(Number.isFinite))&&
  !!value.model&&Array.isArray(value.model.objects)&&value.model.targets instanceof Map&&!!value.model.coverage&&
  value.model.objects.every(o=>o.positions instanceof Float32Array&&o.indices instanceof Uint32Array);
}
/** Persistent clipped meshes, independent of camera pose, floors and roof UI.
 * Tile geometry is derived in the pinned read-only worker snapshot. */
export class AtlasGeometryTiles {
 private cache?:AtlasTileCache;private namespace='';
 constructor(private directory?:string){}
 private open(source:AtlasRegionSource){
  if(!this.directory||source.shadow||!source.shapeVersion||!source.geometryVersion)return undefined;
  const namespace=projectionKey(source.filename,source.campaignId);
  if(namespace!==this.namespace){this.cache?.close();this.cache=AtlasTileCache.open(this.directory,namespace);this.namespace=namespace;}
  return this.cache?.enabled?this.cache:undefined;
 }
 *read(source:AtlasRegionSource,request:AtlasGeometryTileRequest,reader:AtlasRegionReader):Generator<void,AtlasGeometryTile>{
  const box=atlasGeometryTileBox(request);if(source.revision!==request.revision)throw Error('Geometriekachel inzwischen geändert.');
  const cache=this.open(source),key=JSON.stringify(['geometry',request.tile.lod,request.tile.x,request.tile.y]);
  const previous=cache?.get<StoredGeometry>(key,FORMAT),old=valid(previous)?previous:undefined;
  const reply=(model:AtlasDeckSceneModel,status:AtlasGeometryTile['cache']):AtlasGeometryTile=>{const {targets:_,...dto}=model;return {tile:{...request.tile},revision:source.revision,fence:source.fence,cache:status,model:dto};};
  if(old&&old.shapeVersion===source.shapeVersion&&old.geometryVersion===source.geometryVersion)return reply(old.model,'hit');
  let view:AtlasSceneView|undefined,input=old?.input;
  if(!old||old.geometryVersion!==source.geometryVersion){view=reader.geometryTileSource(source,box);input=inputFingerprint(view);}
  yield;
  const samples=new Map<string,Sample>();
  const heightAt=(point:Point)=>{
   const key=JSON.stringify([point.x,point.y]);let sample=samples.get(key);
   if(!sample){const heightM=reader.geometryHeight(source,point);if(!Number.isFinite(heightM))throw Error('Geometriehöhe ungültig.');sample={point:{...point},heightM};samples.set(key,sample);}
   return sample.heightM;
  };
  if(old&&input===old.input){
   let same=true,count=0;
   for(const sample of old.samples){if(heightAt(sample.point)!==sample.heightM)same=false;if(++count%32===0)yield;}
   if(same){const model=view?sourceCoverage(old.model,view):old.model;cache?.put(key,FORMAT,{...old,model,shapeVersion:source.shapeVersion!,geometryVersion:source.geometryVersion!});return reply(model,'hit');}
  }
  view??=reader.geometryTileSource(source,box);input??=inputFingerprint(view);
  // Replayed old samples outside the new topology are not dependencies of it.
  const used=new Map<string,Sample>();
  const model=buildAtlasGeometryMesh(view,request.tile,{
   contains:p=>[p.x,p.y].every(Number.isFinite)&&Math.max(Math.abs(p.x),Math.abs(p.y))<1e12,
   heightAt:p=>{const heightM=heightAt(p);used.set(JSON.stringify([p.x,p.y]),{point:{...p},heightM});return heightM;}
  });
  if(cache)cache.put(key,FORMAT,{shapeVersion:source.shapeVersion!,geometryVersion:source.geometryVersion!,input,samples:[...used.values()],model} satisfies StoredGeometry);
  return reply(model,cache?'built':'disabled');
 }
 close(){this.cache?.close();this.cache=undefined;this.namespace='';}
}
