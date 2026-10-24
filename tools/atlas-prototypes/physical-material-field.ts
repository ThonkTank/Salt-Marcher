// Isolated bridge from the canonical terrain readers to exact point queries.
// This is an input snapshot for material-area experiments, not area integration.
import type {LandscapeBox,LandscapeRecord} from '../../src/app/atlas-landscape.js';
import {bounds,contains,segmentDistance} from '../../src/app/atlas-landscape.js';
import {TerrainSampler,settingsRecord,validateTerrain,type TerrainSettings} from '../../src/app/terrain-height.js';
import type {TerrainStream} from '../../src/app/terrain-field-stream.js';
import type {Point} from '../../src/app/contracts.js';
import {createHeightFieldIntervals} from './height-field-interval';

const DEFAULT_MAX_RECORDS=4096,DEFAULT_MAX_BYTES=64*1024*1024,
  DECODED_HEIGHT_BYTES=4096*Float32Array.BYTES_PER_ELEMENT;
export interface PhysicalMaterialFieldOptions {
  maxRecords?:number;
  maxBytes?:number;
  /** Read separately with the canonical campaign settings reader, even for an empty field. */
  settings:TerrainSettings;
}
export interface PhysicalMaterialFieldDiagnostics {
  query:Readonly<LandscapeBox>;
  sourceBounds:Readonly<{height:LandscapeBox;route:LandscapeBox;lake:LandscapeBox}>;
  recordCount:number;
  records:Readonly<{height:number;route:number;lake:number}>;
  sourceBytes:number;
  decodedHeightBytes:number;
  chargedBytes:number;
  maxRecords:number;
  maxBytes:number;
  seaLevelM:number;
}
export interface PhysicalMaterialFieldSnapshot {
  readonly diagnostics:PhysicalMaterialFieldDiagnostics;
  sample(point:Point):Readonly<{heightM:number;water:boolean;waterLevelM:number|undefined}>;
  range(box:LandscapeBox):{heightM:[number,number];water:[number,number]};
  integrationCut(triangle:readonly Point[]):{axis:'x'|'y';value:number}|undefined;
}

const overlaps=(a:LandscapeBox,b:LandscapeBox)=>a.x<=b.x+b.width&&a.x+a.width>=b.x&&a.y<=b.y+b.height&&a.y+a.height>=b.y;
/** A disk enclosing the query must miss every polygon boundary before a point
 * containment result can certify the entire query, including islands/holes. */
function lakeCoverage(record:LandscapeRecord,box:LandscapeBox):[number,number]{
  const center={x:box.x+box.width/2,y:box.y+box.height/2},reach=Math.hypot(box.width,box.height)/2;
  for(const polygon of record.polygons)for(const ring of [polygon.outer,...polygon.holes]){
    for(let i=0;i<ring.length;i++){
      const a=ring[i]!,b=ring[(i+1)%ring.length]!;
      const guard=128*Number.EPSILON*Math.max(1,Math.abs(center.x),Math.abs(center.y),Math.abs(a.x),Math.abs(a.y),Math.abs(b.x),Math.abs(b.y));
      if(segmentDistance(center,a,b)<=reach+guard)return [0,1];
    }
  }
  const inside=Number(contains(center,record.polygons));return [inside,inside];
}

function checkedBox(box:LandscapeBox):LandscapeBox {
  if(![box.x,box.y,box.width,box.height,box.x+box.width,box.y+box.height].every(Number.isFinite)||box.width<=0||box.height<=0)
    throw Error('Materialfeldausschnitt prüfen.');
  return {...box};
}
function freezeTree<T>(value:T):T {
  if(value&&typeof value==='object'&&!Object.isFrozen(value)){
    for(const child of Object.values(value as Record<string,unknown>))freezeTree(child);
    Object.freeze(value);
  }
  return value;
}
/**
 * Material-area prototype input. Readers are queried with geometric bounds only;
 * in particular no sample-center filter is requested. The canonical terrain
 * reader's height bounds include heightInfluenceBounds for Hermite neighbours.
 * Byte accounting bounds serialized retained sources plus decoded height data,
 * not the JavaScript heap or TerrainSampler's route index (which has its own cap).
 */
export function createPhysicalMaterialFieldSnapshot(
  stream:TerrainStream,queryInput:LandscapeBox,options:PhysicalMaterialFieldOptions,
):PhysicalMaterialFieldSnapshot {
  if(!options?.settings)throw Error('Kanonische Geländeeinstellungen fehlen.');
  const seaLevelM=options.settings.seaLevelM,setting=settingsRecord(seaLevelM);
  setting.terrainSettings=options.settings;validateTerrain(setting);
  const query=checkedBox(queryInput),maxRecords=options.maxRecords??DEFAULT_MAX_RECORDS,maxBytes=options.maxBytes??DEFAULT_MAX_BYTES;
  if(!Number.isSafeInteger(maxRecords)||maxRecords<1||!Number.isSafeInteger(maxBytes)||maxBytes<1)throw Error('Materialfeldbudget prüfen.');
  // Do not expand this box: the canonical height reader indexes each source by
  // its full interpolation-influence bounds, rather than tile sample centers.
  const sourceBounds={height:{...query},route:{...query},lake:{...query}},records:LandscapeRecord[]=[],counts={height:0,route:0,lake:0};
  let sourceBytes=0,decodedHeightBytes=0;
  const seen=new Set<string>();
  const read=(kind:'height'|'route'|'lake')=>{
    const iterable=stream(kind,sourceBounds[kind]);
    const iterator=iterable[Symbol.iterator]();
    try {
      for(;;){
        const next=iterator.next();if(next.done)break;
        const original=next.value;
        if(kind==='height'?!original.height:kind==='route'?!original.route:original.surface!=='freshwater')
          throw Error(`Falsche Geländequellenart: ${kind}`);
        // Do not post-filter by record geometry: a height tile can affect this
        // query through a neighbour node beyond its authored tile rectangle.
        if(seen.has(original.id))throw Error(`Doppelte Geländequelle: ${original.id}`);
        const json=JSON.stringify(original);
        if(json===undefined)throw Error('Geländequelle nicht serialisierbar.');
        const bytes=new TextEncoder().encode(json).byteLength,heightBytes=original.height?DECODED_HEIGHT_BYTES:0;
        if(records.length+1>maxRecords||sourceBytes+decodedHeightBytes+bytes+heightBytes>maxBytes)
          throw Error('Materialfeldbudget überschritten.');
        const copy=freezeTree(JSON.parse(json) as LandscapeRecord);
        records.push(copy);seen.add(copy.id);counts[kind]++;sourceBytes+=bytes;decodedHeightBytes+=heightBytes;
      }
    } finally { iterator.return?.(); }
  };
  // Explicit iterators let us close the active SQL/source cursor even when
  // serialization, validation, or either budget check fails.
  read('height');read('route');read('lake');
  const settingsJson=JSON.stringify(setting)!,settingsBytes=new TextEncoder().encode(settingsJson).byteLength;
  if(records.length+1>maxRecords||sourceBytes+decodedHeightBytes+settingsBytes>maxBytes)throw Error('Materialfeldbudget überschritten.');
  // Deep-copy optional style too: freezing a snapshot must not freeze caller data.
  records.unshift(freezeTree(JSON.parse(settingsJson) as LandscapeRecord));sourceBytes+=settingsBytes;
  const sampler=new TerrainSampler(records),heights=createHeightFieldIntervals(records),frozenQuery=freezeTree(query),frozenBounds=freezeTree(sourceBounds);
  const lakes=records.filter(r=>r.surface==='freshwater').map(record=>({record,box:bounds(record)}));
  const routes=records.filter(r=>r.route?.nodes.length&&!r.route.conflict).map(record=>({record,box:bounds(record)}));
  const requireInside=(box:LandscapeBox)=>{
    if(![box.x,box.y,box.width,box.height,box.x+box.width,box.y+box.height].every(Number.isFinite)||box.width<0||box.height<0||box.x<query.x||box.y<query.y||box.x+box.width>query.x+query.width||box.y+box.height>query.y+query.height)
      throw Error('Materialfeldabfrage liegt außerhalb des Schnappschusses.');
  };
  const diagnostics=freezeTree({query:frozenQuery,sourceBounds:frozenBounds,recordCount:records.length,
    records:counts,sourceBytes,decodedHeightBytes,chargedBytes:sourceBytes+decodedHeightBytes,maxRecords,maxBytes,seaLevelM:sampler.seaLevelM});
  const range=(box:LandscapeBox)=>{
    requireInside(box);
    // Route blending still needs its own converging interval evaluator. Preserve
    // an explicitly unknown range here; never certify base terrain beneath it.
    const heightM:[number,number]=routes.some(r=>overlaps(r.box,box))?[-Infinity,Infinity]:heights.range(box);
    let lo=Number(heightM[1]<=seaLevelM),hi=Number(heightM[0]<=seaLevelM);
    if(routes.some(r=>r.record.kind==='river'&&overlaps(r.box,box)))hi=1;
    for(const {record,box:lakeBox}of lakes){
      if(!overlaps(lakeBox,box))continue;
      const coverage=lakeCoverage(record,box),level=record.waterLevelM??seaLevelM+1;
      if(coverage[0]===1&&heightM[1]<=level)lo=1;
      if(coverage[1]===1&&heightM[0]<=level)hi=1;
    }
    return {heightM,water:[lo,hi] as [number,number]};
  };
  return Object.freeze({diagnostics,range,integrationCut(triangle:readonly Point[]){
    for(const p of triangle)requireInside({x:p.x,y:p.y,width:0,height:0});
    const grid=heights.integrationCut(triangle);if(grid)return grid;
    const x=Math.min(...triangle.map(p=>p.x)),y=Math.min(...triangle.map(p=>p.y));
    const box={x,y,width:Math.max(...triangle.map(p=>p.x))-x,height:Math.max(...triangle.map(p=>p.y))-y};
    let best:{axis:'x'|'y';value:number}|undefined,score=2;
    // Refine only along an axis whose halves certify less unknown water area.
    // This is a scheduling hint, not a value/error certificate. The integrator
    // still bounds and counts every resulting triangle at unchanged tolerance.
    for(const axis of ['x','y'] as const){
      const length=axis==='x'?box.width:box.height,value=box[axis]+length/2;
      if(!(value>box[axis]&&value<box[axis]+length))continue;
      const low=axis==='x'?{...box,width:value-x}:{...box,height:value-y};
      const high=axis==='x'?{...box,x:value,width:x+box.width-value}:{...box,y:value,height:y+box.height-value};
      const unknown=[low,high].reduce((n,b)=>{const w=range(b).water;return n+Number(w[0]!==w[1]);},0);
      if(unknown<score){score=unknown;best={axis,value};}
    }
    return best;
  },sample(point:Point){
    requireInside({x:point.x,y:point.y,width:0,height:0});
    const heightM=sampler.sample(point).heightM;
    return Object.freeze({heightM,water:sampler.water(point,heightM),waterLevelM:sampler.waterLevel(point,heightM)});
  }});
}
