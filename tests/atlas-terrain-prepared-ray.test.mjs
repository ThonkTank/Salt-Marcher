import test from 'node:test';
import assert from 'node:assert/strict';
import {buildSync} from 'esbuild';

buildSync({entryPoints:['src/app/atlas-mesh-ray.ts'],outfile:'.build/terrain-water-d/prepared-ray-test.mjs',bundle:true,platform:'node',format:'esm'});
const {createAtlasTerrainPreparedRayIndex}=await import('../.build/terrain-water-d/prepared-ray-test.mjs');

const worldX=70_000_256,worldY=-90_000_256;
function geometry(){
  const basis=new Float32Array(3*14),draft=new Float32Array(3*6);
  for(let i=0;i<3;i++){
    const x=i===1?10:0,y=i===2?10:0,height=i===0?0:i===1?10:20;
    basis.set([x,y,100+height,0,0,0,0,0,200+height,0,0,0,0,0],i*14);
    draft.set([300+height,0,0,0,0,0],i*6);
  }
  const node=new ArrayBuffer(32),f=new Float32Array(node),u=new Uint32Array(node);
  f.set([0,0,10,10]);u.set([0,0,0,1],4);
  return{basis,draft,indices:new Uint32Array([0,1,2]),rayNodes:u,rayTriangles:new Uint32Array([0]),
    draws:[{origin:[worldX,worldY],bounds:[worldX,worldY,worldX+10,worldY+10],oldSlot:0,newSlot:0,
      firstIndex:0,indexCount:3,rayRoot:0,rayFirstTriangle:0,rayTriangleCount:1}]};
}

test('prepared ray intersects the original packed triangle at the confirmed Float32 alpha and vertical origin',()=>{
  const ray=createAtlasTerrainPreparedRayIndex(geometry()),segment=[[worldX+2,worldY+2,400],[worldX+2,worldY+2,0]];
  const mid=ray.intersect(segment,.5,200);
  assert(mid);assert.deepEqual(mid.point.slice(0,2),[worldX+2,worldY+2]);
  assert(Math.abs(mid.point[2]-256)<1e-10);
  assert(Math.abs(mid.segmentFraction-(400-256)/400)<1e-12);assert.equal(mid.sourceBank,'new');assert.equal(mid.sourceIndex,0);
  const end=ray.intersect(segment,1,200);assert(end);assert(Math.abs(end.point[2]-306)<1e-10,'alpha one selects the absolute draft pair');
  const canonical=createAtlasTerrainPreparedRayIndex({...geometry(),draft:null}).intersect(segment,.5,200);
  assert(canonical);assert(Math.abs(canonical.point[2]-156)<1e-10);
  assert.equal(ray.intersect([[worldX+12,worldY+2,400],[worldX+12,worldY+2,0]],.5,200),null);
});

test('packed ray retires an old-only triangle at the confirmed alpha-one endframe',()=>{
  const base=geometry(),basis=new Float32Array(6*14);basis.set(base.basis);
  for(const [i,[x,y]] of [[20,0],[30,0],[20,10]].entries())basis.set([x,y,100,0,0,0,0,0,200,0,0,0,0,0],(i+3)*14);
  const bytes=new ArrayBuffer(64),nodes=new Uint32Array(bytes),bounds=new Float32Array(bytes);
  nodes.set(base.rayNodes);bounds.set([20,0,30,10],8);nodes[14]=1;nodes[15]=1;
  const oldOnly={...base.draws[0],bounds:[worldX+20,worldY,worldX+30,worldY+10],oldSlot:0,newSlot:-1,firstIndex:3,rayRoot:1,rayFirstTriangle:1};
  const ray=createAtlasTerrainPreparedRayIndex({...base,basis,draft:null,indices:new Uint32Array([0,1,2,3,4,5]),rayNodes:nodes,rayTriangles:new Uint32Array([0,1]),draws:[...base.draws,oldOnly]});
  const oldSegment=[[worldX+22,worldY+2,400],[worldX+22,worldY+2,0]];
  assert.equal(ray.intersect(oldSegment,.5,200)?.sourceBank,'old');
  assert.equal(ray.intersect(oldSegment,1,200),null,'the actual endframe has no old-only screen triangle');
  assert.notEqual(ray.heightEnvelope([21,1,23,3],1,{x:worldX,y:worldY,z:200},1,false).maximum,null,'first alpha-one draw still includes its old-only geometry');
  assert.equal(ray.heightEnvelope([21,1,23,3],1,{x:worldX,y:worldY,z:200},1,true).maximum,null,'only the actual old-slot-free draw retires old-only geometry');
  assert(ray.intersect([[worldX+2,worldY+2,400],[worldX+2,worldY+2,0]],1,200));
});

test('camera hull clips every packed triangle, including a narrow slope and partial empty Q',()=>{
 const g=geometry(),ray=createAtlasTerrainPreparedRayIndex(g),origin={x:worldX,y:worldY,z:256};
 const hull=ray.heightEnvelope([1,1,3,3],1,origin,2);
 // At (3,3), the triangle is 309m; the render origin is subtracted once.
 assert(hull.maximum>=106);assert(hull.maximum<106.001);assert.equal(hull.visits,1);assert.equal(hull.triangles,1);
 const partial=ray.heightEnvelope([-2,-2,2,2],1,origin,.25);
 assert(partial.maximum>=12.5);assert(partial.maximum<12.501);
 const absent=ray.heightEnvelope([20,20,21,21],1,origin,8);
 assert.equal(absent.maximum,null,'empty draw geometry is absence, not invented zero terrain');
 // A peak at a triangle corner can lie between camera-body probe points. The
 // complete clipped affine face, not just eye/near corners, owns clearance.
 for(let i=0;i<3;i++)g.draft[i*6]=i===1?10_000:300;
 const steep=createAtlasTerrainPreparedRayIndex(g).heightEnvelope([4,-.01,5.01,.01],1,origin,1);
 assert(steep.maximum>4_900);assert(steep.maximum<5_100);
});
