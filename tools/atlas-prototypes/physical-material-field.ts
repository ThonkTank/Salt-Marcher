// Isolated bridge from the canonical terrain readers to exact point queries.
// This is an input snapshot for material-area experiments, not area integration.
import type {LandscapeBox,LandscapeRecord} from '../../src/app/atlas-landscape.js';
import {TerrainSampler,settingsRecord,validateTerrain,type TerrainSettings} from '../../src/app/terrain-height.js';
import type {TerrainStream} from '../../src/app/terrain-field-stream.js';
import type {Point} from '../../src/app/contracts.js';

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
  const sampler=new TerrainSampler(records),frozenQuery=freezeTree(query),frozenBounds=freezeTree(sourceBounds);
  const diagnostics=freezeTree({query:frozenQuery,sourceBounds:frozenBounds,recordCount:records.length,
    records:counts,sourceBytes,decodedHeightBytes,chargedBytes:sourceBytes+decodedHeightBytes,maxRecords,maxBytes,seaLevelM:sampler.seaLevelM});
  return Object.freeze({diagnostics,sample(point:Point){
    if(!Number.isFinite(point.x)||!Number.isFinite(point.y)||point.x<query.x||point.y<query.y||point.x>query.x+query.width||point.y>query.y+query.height)
      throw Error('Materialfeldabfrage liegt außerhalb des Schnappschusses.');
    const heightM=sampler.sample(point).heightM;
    return Object.freeze({heightM,water:sampler.water(point,heightM),waterLevelM:sampler.waterLevel(point,heightM)});
  }});
}
