import {TERRAIN_PREPARED_LAYOUT} from './atlas-terrain-prepared-field';

export interface TerrainPreparedOwner {readonly owner:string;readonly value:unknown}
export interface TerrainPreparedOwnedStore {readonly id:number;readonly bytes:number;readonly owners:readonly string[]}
/** Local only. No retained graph is serialized into a worker inventory. IDs
 * here identify PHYSICAL stores in this census, not logical wire contents.
 * Workeroriginal/rendererclone may share a logical content ID but have distinct
 * physical IDs and are both charged. Only a transfer moves a physical owner. */
export function terrainPreparedCensus(owners:readonly TerrainPreparedOwner[],idFor:(store:ArrayBuffer)=>number){
 const stores=new Map<ArrayBuffer,Set<string>>();
 for(const {owner,value} of owners){const visited=new Set<object>();
  const visit=(v:unknown)=>{if(!v||typeof v!=='object'||visited.has(v))return;visited.add(v);
   const b=v instanceof ArrayBuffer?v:ArrayBuffer.isView(v)&&v.buffer instanceof ArrayBuffer?v.buffer:null;
   if(b){let names=stores.get(b);if(!names){names=new Set();stores.set(b,names);}names.add(owner);return;}
   if(v instanceof Map){for(const [key,item] of v){visit(key);visit(item);}return;}
   if(v instanceof Set){for(const item of v)visit(item);return;}
   for(const item of Object.values(v))visit(item);
  };visit(value);
 }
 const ids=new Set<number>(),entries:TerrainPreparedOwnedStore[]=[];
 for(const [store,names] of stores){const id=idFor(store);if(!Number.isSafeInteger(id)||id<1||ids.has(id))throw Error('Terrain-Inventaridentität prüfen.');ids.add(id);entries.push({id,bytes:store.byteLength,owners:[...names]});}
 return{bytes:entries.reduce((s,e)=>s+e.bytes,0),stores:entries};
}
const count=(n:number)=>{if(!Number.isSafeInteger(n)||n<0)throw Error('Terrain-Allokationszählung prüfen.');return n;};
export function terrainPreparedAllocation(vertices:number,indices:number,nodes:number,rayNodes:number,triangles:number){
 [vertices,indices,nodes,rayNodes,triangles].forEach(count);
 const result={basis:vertices*TERRAIN_PREPARED_LAYOUT.basisBytes,draft:vertices*TERRAIN_PREPARED_LAYOUT.draftBytes,
  indices:indices*4,nodeCache:nodes*120,stencils:vertices*28,rayNodes:rayNodes*32,rayTriangles:triangles*4,rayScratch:triangles*16};
 Object.values(result).forEach(count);return result;
}
/** Call before the allocation/copy, with every still-live owner included. GPU
 * resources have a separate inventory and cannot be deducted from CPU stores. */
export function terrainPreparedReserve(liveBytes:number,nextBytes:number,limit:number){
 [liveBytes,nextBytes,limit].forEach(count);const peak=liveBytes+nextBytes;count(peak);
 if(peak>limit)throw Error('Terrain-Allokationsetat überschritten.');return peak;
}
/** Exact backingstore count for the agreed SoA cache; separate arrays avoid
 * hidden Float64 alignment padding for odd node counts. Worker-only. */
export function terrainPreparedNodeCache(nodes:number,reserve:(bytes:number)=>void){
 count(nodes);count(nodes*120);reserve(nodes*120);
 return{xySupport:new Float64Array(nodes*3),gradients:new Float64Array(nodes*4),sources:new Int32Array(nodes*2),
  rectangles:new Float64Array(nodes*4),sourceMasks:new Uint32Array(nodes),draftGradients:new Float64Array(nodes*2),draftRevisions:new Uint32Array(nodes)};
}

/** One family's native nodes, never foreign transition vertices. 100 B/node:
 * XY/support 24, affine gradients 16, owner 4, dependency rectangle 32,
 * dependency source mask 4, confirmed draft gradients 16, revisions 4.
 * Map keys/objects are heap, reported separately from these backingstores. */
export function terrainPreparedFamilyCache(nodes:number,reserve:(bytes:number)=>void){
 count(nodes);count(nodes*100);reserve(nodes*100);
 return{xySupport:new Float64Array(nodes*3),gradients:new Float64Array(nodes*2),sources:new Int32Array(nodes),
  rectangles:new Float64Array(nodes*4),sourceMasks:new Uint32Array(nodes),draftGradients:new Float64Array(nodes*2),draftRevisions:new Uint32Array(nodes)};
}

/** Conservative simultaneous A owners; no identity/alias saving assumed.
 * W=canonical halo, D=edited pages/gesture, K=32+active disjoint page union.
 * A producer clones installed/escape independently; a seed/read/transport can
 * coexist with a replay. Actual census replaces this bound once integrated. */
export function terrainPreparedAuthorBound(lattices:number,windowPages:number,editPages:number,suffix=32){
 [lattices,windowPages,editPages,suffix].forEach(count);
 if(lattices>32||windowPages>774||editPages>256||suffix>32)throw Error('Terrain-Autorenhülle prüfen.');
 const G=lattices*4225*8,W=windowPages*16384,D=editPages*16384,K=(suffix+1)*D;
 const owners={installed:G+W+K,escapeBeginning:G+W+K,
  replayInitialSeed:G+W,replayBandBasis:W,replayOverlay:K,replayGroundCurrentAndNext:2*G,
  readNodeAndMainAndRenderer:3*(G+W),dispatchClone:G+W+K,
  // Workeroriginals remain alive while this separate result copy travels to A.
  outgoingAuthorResult:G+W+K,
  formDecodedBeforeAndAfter:2*W+D,
  // Read SQL rows keep their decoded arrays while output pages are sliced.
  readPageDecodeCache:W,readOneDecodeBytes:16384,
  // accumulateHeightSources: <=4*65 nodes/axis, absolute+additive grids,
  // two horizontal Double grids, axis arrays and one additions field.
  readGroundLevelScratch:2*260*260*4+2*260*65*8+2*(260*8+65*4+65*8)+65*65*8+2*65*8,
  formEncodeDecodeScratch:3*16384};
 // heightRecord creates base64 strings in the existing form adapter, plus
 // request/response JSON clones. This UTF16 reservation is separate from stores.
 const base64Chars=4*Math.ceil(16384/3),adapterUtf16=2*base64Chars*(3*windowPages+editPages)+2*16384;
 // Original UI capture, journal, installed, escape, running replay, dispatch:
 // contents can alias locally, but only a census may deduct them. Samples are
 // ordinary objects, not backingstores; 3 doubles/sample is numeric content only.
 const actionNumericContent=6*(suffix+1)*20000*3*8;
 // Page: x/y/pixel/revision + view buffer/offset/length =7 numbers.
 // Ground: five lattice numbers + three view numbers; ten held G versions.
 // These are numeric contents, not invented fixed object descriptor sizes.
 const metadataNumericContent=(12*windowPages+5*(suffix+1)*editPages+editPages)*7*8+10*lattices*8*8;
 return{G,W,D,K,owners,backingBytes:Object.values(owners).reduce((s,v)=>s+v,0),adapterUtf16,actionNumericContent,metadataNumericContent,
  unboundedHeap:'DTO/object/property/string overhead, SQLite and driver heap require observed heap/RSS; no hard cap follows from backingstores'};
}
