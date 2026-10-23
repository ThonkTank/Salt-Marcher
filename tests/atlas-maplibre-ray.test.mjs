import test from 'node:test';
import assert from 'node:assert/strict';
import {buildSync} from 'esbuild';

buildSync({entryPoints:['src/app/atlas-maplibre-ray.ts'],outfile:'.build/atlas-maplibre-ray-test.mjs',bundle:true,platform:'node',format:'esm'});
const {atlasMapLibreRayIndexBuildCount,atlasMapLibreRaySegment,refineAtlasMapLibreRayHit}=await import('../.build/atlas-maplibre-ray-test.mjs');

const viewport={x:10,y:20,width:100,height:100},pixel={x:60,y:70};
const root={x:0,y:0,size:100};
const frame=(mainMatrix=identity())=>({projection:identity(),mainMatrix,nearZ:.1,farZ:100});
function identity(){return [1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];}
function object(id,positions,indices){return {id,target:{kind:'terrain'},positions:new Float32Array(positions),indices:new Uint32Array(indices)};}
function query(mesh,changes={}){
  return {object:mesh,frame:frame(),viewport,pixel,root,sceneOrigin:{x:0,y:0},verticalOriginM:0,verticalExaggeration:1,...changes};
}

test('unprojects a canvas point through viewport offset and OpenGL near/far clip planes',()=>{
  const segment=atlasMapLibreRaySegment({frame:frame(),viewport,pixel,root,sceneOrigin:{x:0,y:0}});
  assert.deepEqual(segment,[[0,0,-1],[0,0,1]]);
  assert.deepEqual(atlasMapLibreRaySegment({frame:frame(),viewport,pixel:{x:100,y:70},root,sceneOrigin:{x:0,y:0}}),[[.8,0,-1],[.8,0,1]]);
});

test('refines an oblique elevated room triangle in the exact uploaded Float32 mesh',()=>{
  const oblique=identity();oblique[8]=.5;oblique[9]=.25;
  const mesh=object('room',[-.5,-.4,.25,0,-.4,.25,-.2,.1,.25],[0,1,2]);
  const result=refineAtlasMapLibreRayHit(query(mesh,{frame:frame(oblique),root:{x:100_000_000,y:200_000_000,size:1000},
    sceneOrigin:{x:100_000_100,y:200_000_100},verticalOriginM:20,verticalExaggeration:2}));
  assert.ok(result);
  assert.ok(Math.abs(result.point.x-(100_000_100-.225*1000))<1e-5);
  assert.ok(Math.abs(result.point.y-(200_000_100-.1625*1000))<1e-5);
  assert.ok(Math.abs(result.point.heightM-145)<1e-5);
  assert.ok(result.clipDistance>0&&result.clipDistance<1);
});

test('intersects indexed terrain triangles and returns interpolated elevated surface height',()=>{
  const terrain=object('terrain',[ -1,-1,0, 1,-1,0, -1,1,1, 1,1,1 ],[0,1,2,2,1,3]);
  const result=refineAtlasMapLibreRayHit(query(terrain,{root:{x:500,y:700,size:200},sceneOrigin:{x:600,y:800},verticalOriginM:10,verticalExaggeration:2}));
  assert.ok(result);
  assert.ok(Math.abs(result.point.x-500)<1e-9);
  assert.ok(Math.abs(result.point.y-700)<1e-9);
  assert.ok(Math.abs(result.point.heightM-35)<1e-5);
});

test('mesh holes and requested subpixel misses return null instead of a GPU-depth approximation',()=>{
  const positions=[],indices=[];
  const quad=(x0,y0,x1,y1,z)=>{
    const base=positions.length/3;positions.push(x0,y0,z,x1,y0,z,x0,y1,z,x1,y1,z);
    indices.push(base,base+1,base+2,base+2,base+1,base+3);
  };
  quad(-1,-1,1,-.25,.4);quad(-1,.25,1,1,.4);quad(-1,-.25,-.25,.25,.4);quad(.25,-.25,1,.25,.4);
  const ring=object('terrain-with-hole',positions,indices);
  assert.equal(refineAtlasMapLibreRayHit(query(ring)),null);
  const rightPixel={x:100,y:70};
  assert.ok(refineAtlasMapLibreRayHit(query(ring,{pixel:rightPixel})));

  const small=object('small-room',[-.2,-.2,.5,.2,-.2,.5,0,.2,.5],[0,1,2]);
  assert.ok(refineAtlasMapLibreRayHit(query(small)));
  assert.equal(refineAtlasMapLibreRayHit(query(small,{pixel:{x:100,y:70}})),null);
});

test('near/far clipping excludes geometry outside the captured clip segment',()=>{
  const beyondFar=object('far',[ -1,-1,1.2, 1,-1,1.2, 0,1,1.2 ],[0,1,2]);
  const beforeNear=object('near',[ -1,-1,-1.2, 1,-1,-1.2, 0,1,-1.2 ],[0,1,2]);
  const inside=object('inside',[ -1,-1,.5, 1,-1,.5, 0,1,.5 ],[0,1,2]);
  assert.equal(refineAtlasMapLibreRayHit(query(beyondFar)),null);
  assert.equal(refineAtlasMapLibreRayHit(query(beforeNear)),null);
  assert.ok(refineAtlasMapLibreRayHit(query(inside)));
  assert.equal(refineAtlasMapLibreRayHit(query(inside,{frame:frame(new Array(16).fill(0))})),null);
});

test('large-world small-metre geometry preserves local precision and BVH is reused across camera frames',()=>{
  const size=2**26,worldX=1_000_000_000_000,worldY=-1_000_000_000_000;
  const sceneOrigin={x:worldX+8192,y:worldY+16384};
  const local=.125/size;
  const localX=(sceneOrigin.x-worldX)/size,localY=(sceneOrigin.y-worldY)/size;
  const tiny=object('tiny-room',[-localX-local,-localY-local,.25,-localX+local,-localY-local,.25,-localX,-localY+local,.25],[0,1,2]);
  const first=refineAtlasMapLibreRayHit(query(tiny,{root:{x:worldX,y:worldY,size},sceneOrigin,verticalOriginM:145,verticalExaggeration:1}));
  assert.ok(first);
  assert.ok(Math.abs(first.point.x-worldX)<1e-6);
  assert.ok(Math.abs(first.point.y-worldY)<1e-6);
  assert.ok(Math.abs(first.point.heightM-(145+.25*size))<1e-6);
  assert.equal(atlasMapLibreRayIndexBuildCount(tiny),1);
  const moved=identity();moved[12]=.1;
  assert.ok(refineAtlasMapLibreRayHit(query(tiny,{frame:frame(moved),root:{x:worldX,y:worldY,size},sceneOrigin,verticalOriginM:145,verticalExaggeration:1}))===null);
  assert.equal(atlasMapLibreRayIndexBuildCount(tiny),1);
  tiny.positions=new Float32Array(tiny.positions);
  assert.ok(refineAtlasMapLibreRayHit(query(tiny,{root:{x:worldX,y:worldY,size},sceneOrigin,verticalOriginM:145,verticalExaggeration:1})));
  assert.equal(atlasMapLibreRayIndexBuildCount(tiny),2);
});

test('expanded 2^44 root still refines a 20-metre mesh without a near-camera ray threshold',()=>{
  const size=2**44,worldX=1_000_000_000_000,worldY=-1_000_000_000_000;
  const sceneOrigin={x:worldX+size/2,y:worldY+size/2},delta=20/size;
  const tiny=object('expanded-root-room',[-delta,-delta,delta,delta,-delta,delta,0,delta,delta],[0,1,2]);
  const narrowClip=identity();narrowClip[0]=5e11;narrowClip[5]=5e11;narrowClip[10]=5e11;
  narrowClip[12]=-.5*5e11;narrowClip[13]=-.5*5e11;
  const result=refineAtlasMapLibreRayHit(query(tiny,{frame:frame(narrowClip),root:{x:worldX,y:worldY,size},sceneOrigin,verticalOriginM:0,verticalExaggeration:1}));
  assert.ok(result);
  assert.ok(Math.abs(result.point.x-sceneOrigin.x)<1e-5);
  assert.ok(Math.abs(result.point.y-sceneOrigin.y)<1e-5);
  assert.ok(Math.abs(result.point.heightM-20)<1e-6);
});

test('native rotated roof-apex pixel follows Deck matrix rounding and corrects only nanometre-scale edge error',()=>{
  const mainMatrix=[-154831507.50696588,-41811825.96289865,-52221026.83762383,-52014619.61692176,
    -116673909.5653953,55486167.12655848,69299643.24456918,69025731.61119144,
    0,259288739.64208254,-23250635.877745565,-23158736.131193213,
    135752805.63408422,-6837175.4721554,-8538361.493801538,-8504587.080782562];
  const root={x:-33554432,y:-33554432,size:67108864},sceneOrigin={x:16,y:12};
  const positions=[5.960464477539063e-8,1.1920928955078125e-7,0.0000022351741790771484,
    1.7881393432617188e-7,1.1920928955078125e-7,0.0000022351741790771484,
    1.1920928955078125e-7,1.7881393432617188e-7,0.0000022649765014648438];
  const apex=positions.slice(6,9),mesh=object('selected-watchtower',positions,[0,1,2]);
  const projection=[2.1666667461395264,0,0,0,0,3,0,0,0,0,-1.0039682388305664,-1,0,0,-26.05158805847168,0];
  const result=refineAtlasMapLibreRayHit(query(mesh,{frame:{projection,mainMatrix,nearZ:13,farZ:6565},
    viewport:{x:0,y:0,width:900,height:650},pixel:{x:449.9999999971985,y:118.10848255181689},
    root,sceneOrigin,verticalOriginM:0,verticalExaggeration:1}));
  assert.ok(result);
  const expected={x:sceneOrigin.x+apex[0]*root.size,y:sceneOrigin.y+apex[1]*root.size,heightM:apex[2]*root.size};
  assert.ok(Math.abs(result.point.x-expected.x)<=1e-5);
  assert.ok(Math.abs(result.point.y-expected.y)<=1e-5);
  assert.ok(Math.abs(result.point.heightM-expected.heightM)<=1e-5);
  assert.ok(result.clipDistance>0&&result.clipDistance<1);
});

test('a requested ray more than the 10-nanometre edge bound outside the selected mesh remains a miss',()=>{
  const twentyNanometreGap=2e-10;
  const mesh=object('nearby-but-not-hit',[twentyNanometreGap,-.5,0, 1,-.5,0, 1,.5,0],[0,1,2]);
  assert.equal(refineAtlasMapLibreRayHit(query(mesh)),null);
});
