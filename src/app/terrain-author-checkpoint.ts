import type {LandscapeBox} from './atlas-landscape';

export interface TerrainAuthorSource {token:string;fence:string;revision:number}
export interface TerrainAuthorReceipt {commandId:string;fingerprint:string}
export interface TerrainAuthorLattice {id:number;x:number;y:number;dx:number;dy:number}
export interface TerrainAuthorQuery extends TerrainAuthorSource {
 owner:string;series:number;request:number;prefix:number;
 box:LandscapeBox;pixel:number;lattices:readonly TerrainAuthorLattice[];
 receipt?:TerrainAuthorReceipt;
}
export interface TerrainAuthorPage {x:number;y:number;pixel:number;revision:number;values:Float32Array}
export interface TerrainAuthorGround {lattice:TerrainAuthorLattice;values:Float64Array}
export interface TerrainAuthorCheckpoint {
 query:TerrainAuthorQuery;pages:TerrainAuthorPage[];ground:TerrainAuthorGround[];
 coverage:{left:number;right:number;top:number;bottom:number;complete:true};
}
export const TERRAIN_AUTHOR_INPUT_BYTES=40*1024*1024;
const integer=(n:number)=>Number.isSafeInteger(n)&&n>=0;
const fail=()=>{throw Error('Autorencheckpoint prüfen.');};
const fields=(v:object,allowed:readonly string[])=>Object.keys(v).every(k=>allowed.includes(k));
/** Validate every scalar and the full rectangular edit box before allocating pages. */
export function terrainAuthorWindow(q:TerrainAuthorQuery){
 if(!q||!fields(q,['owner','series','request','prefix','revision','token','fence','box','pixel','lattices','receipt'])||typeof q.owner!=='string'||!q.owner||q.owner.length>1000||typeof q.token!=='string'||!q.token||q.token.length>1000||typeof q.fence!=='string'||!q.fence||q.fence.length>1000||![q.series,q.request,q.prefix,q.revision].every(integer)||!Number.isFinite(q.pixel)||q.pixel<2**-24||q.pixel>2**24||!Number.isInteger(Math.log2(q.pixel)))fail();
 const b=q.box;if(!b||!fields(b,['x','y','width','height'])||![b.x,b.y,b.width,b.height,b.x+b.width,b.y+b.height].every(Number.isFinite)||b.width<0||b.height<0||Math.max(Math.abs(b.x),Math.abs(b.y),Math.abs(b.x+b.width),Math.abs(b.y+b.height))>1e12)fail();
 const edge=64*q.pixel,x0=Math.floor(b.x/edge),x1=Math.floor((b.x+b.width)/edge),y0=Math.floor(b.y/edge),y1=Math.floor((b.y+b.height)/edge);
 if(![x0,x1,y0,y1].every(Number.isSafeInteger)||(x1-x0+1)*(y1-y0+1)>256)fail();
 if(!Array.isArray(q.lattices)||q.lattices.length<1||q.lattices.length>32)fail();
 const ids=new Set<number>();for(const l of q.lattices){if(!l||!fields(l,['id','x','y','dx','dy'])||!integer(l.id)||ids.has(l.id)||![l.x,l.y,l.dx,l.dy,l.x+64*l.dx,l.y+64*l.dy].every(Number.isFinite)||l.dx<=0||l.dy<=0||Math.max(Math.abs(l.x),Math.abs(l.y),Math.abs(l.x+64*l.dx),Math.abs(l.y+64*l.dy))>1e12)fail();ids.add(l.id);}
 if(q.prefix>0&&!q.receipt)fail();
 if(q.receipt&&(!fields(q.receipt,['commandId','fingerprint'])||typeof q.receipt.commandId!=='string'||!q.receipt.commandId||q.receipt.commandId.length>1000||typeof q.receipt.fingerprint!=='string'||!q.receipt.fingerprint||q.receipt.fingerprint.length>100000))fail();
 const left=Math.floor((b.x-4*q.pixel)/edge),right=Math.floor((b.x+b.width+4*q.pixel)/edge),top=Math.floor((b.y-4*q.pixel)/edge),bottom=Math.floor((b.y+b.height+4*q.pixel)/edge),pages=(right-left+1)*(bottom-top+1);
 const bytes=pages*(16384+64)+q.lattices.length*(65*65*8+64)+4096+2*(q.owner.length+q.token.length+q.fence.length+(q.receipt?.commandId.length??0)+(q.receipt?.fingerprint.length??0));
 if(pages>774||!Number.isSafeInteger(bytes)||bytes>TERRAIN_AUTHOR_INPUT_BYTES)fail();
 return{left,right,top,bottom,pages,bytes,edge};
}
/** Receivers bind the complete numerical query, not just a higher world revision. */
export function decodeTerrainAuthorCheckpoint(value:TerrainAuthorCheckpoint,q:TerrainAuthorQuery):TerrainAuthorCheckpoint{
 const w=terrainAuthorWindow(q);
 if(!value||JSON.stringify(value.query)!==JSON.stringify(q)||!value.coverage||value.coverage.complete!==true||value.coverage.left!==w.left||value.coverage.right!==w.right||value.coverage.top!==w.top||value.coverage.bottom!==w.bottom||value.pages?.length!==w.pages||value.ground?.length!==q.lattices.length)fail();
 const buffers=new Set<ArrayBufferLike>();let i=0;
 for(let y=w.top;y<=w.bottom;y++)for(let x=w.left;x<=w.right;x++){
  const p=value.pages[i++]!;if(!p||p.x!==x*w.edge||p.y!==y*w.edge||p.pixel!==q.pixel||!integer(p.revision)||!(p.values instanceof Float32Array)||p.values.length!==4096||p.values.byteOffset!==0||!(p.values.buffer instanceof ArrayBuffer)||p.values.buffer.byteLength!==16384||buffers.has(p.values.buffer))fail();
  buffers.add(p.values.buffer);if(!p.values.every(v=>Number.isNaN(v)||Number.isFinite(v)&&Math.abs(v)<=1e6))fail();
 }
 value.ground.forEach((g,j)=>{if(!g||JSON.stringify(g.lattice)!==JSON.stringify(q.lattices[j])||!(g.values instanceof Float64Array)||g.values.length!==4225||g.values.byteOffset!==0||!(g.values.buffer instanceof ArrayBuffer)||g.values.buffer.byteLength!==33800||buffers.has(g.values.buffer)||!g.values.every(v=>Number.isFinite(v)&&Math.abs(v)<=50e6))fail();buffers.add(g.values.buffer);});
 return value;
}
