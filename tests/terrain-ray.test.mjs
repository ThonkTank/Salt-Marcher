import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildSync} from 'esbuild';
import {createRequire} from 'node:module';
buildSync({stdin:{resolveDir:process.cwd(),contents:"export * from './src/app/terrain-ray';export * from './src/app/terrain-grid-layout';export * from './src/app/terrain-surface-mesh';export * from './src/app/terrain-contours';export * as THREE from 'three';"},outfile:'.build/terrain-ray-test.cjs',bundle:true,platform:'node',format:'cjs'});
const {terrainRaycast,terrainGridLayout,updateTerrainMesh,terrainContourUniforms,THREE}=createRequire(import.meta.url)('../.build/terrain-ray-test.cjs');
const view=focused=>({box:{x:-300,y:-240,width:600,height:480},frame:{x:-200,y:-160,width:400,height:320},...(focused?{refinement:{x:-150,y:-120,width:300,height:240}}:{}),columns:33,rows:33,focusM:100,tilt:55,rotation:23,exaggeration:2,projection:'perspective'});
for(const focused of [false,true])test(`cell traversal matches full triangle raycasting, focused=${focused}`,()=>{
 const v=view(focused),l=terrainGridLayout(v),heights=Float32Array.from({length:v.columns*v.rows},(_,i)=>100+Math.sin(l.x.values[i%v.columns]/80)*30+Math.cos(l.y.values[Math.floor(i/v.columns)]/55)*40),grid={view:v,heights,seaLevelM:0};
 const {mesh}=updateTerrainMesh(null,{grid,width:16,height:16,pixels:new Uint8Array(1024)},null,{x:0,y:0},{x:0,y:0},undefined,terrainContourUniforms());mesh.updateMatrixWorld(true);
 for(const origin of [new THREE.Vector3(0,0,400),new THREE.Vector3(600,300,250),new THREE.Vector3(-550,-300,350),new THREE.Vector3(0,0,-400)]){
  for(let x=-350;x<=350;x+=19)for(let y=-280;y<=280;y+=23){
   const direction=new THREE.Vector3(x,y,0).sub(origin).normalize(),ray=new THREE.Raycaster(origin,direction),expected=ray.intersectObject(mesh)[0]?.distance??null;
   const actual=terrainRaycast(grid,{x:origin.x,y:-origin.y,z:v.focusM+origin.z/v.exaggeration},{x:direction.x,y:-direction.y,z:direction.z/v.exaggeration});
   assert.equal(actual===null,expected===null,JSON.stringify({origin,direction,actual,expected}));if(actual!==null)assert(Math.abs(actual-expected)<.002,JSON.stringify({actual,expected}));
  }
 }
 mesh.geometry.dispose();mesh.material.map.dispose();mesh.material.dispose();
});
test('axis-aligned rays, boundaries, near/far limits and far-away room coordinates remain exact',()=>{
 for(const offset of [0,-1e9,1e9]){
  const v=view(true);for(const key of ['box','frame','refinement']){v[key]={...v[key],x:v[key].x+offset,y:v[key].y-offset};}
  const grid={view:v,heights:new Float32Array(v.columns*v.rows).fill(100),seaLevelM:0};
  for(const x of [-300,-150,0,150,300])for(const y of [-240,-120,0,120,240]){
   const origin={x:x+offset,y:y-offset,z:200},direction={x:0,y:0,z:-1};
   assert.equal(terrainRaycast(grid,origin,direction),100);assert.equal(terrainRaycast(grid,origin,direction,101),null);assert.equal(terrainRaycast(grid,origin,direction,0,99),null);
  }
  assert.equal(terrainRaycast(grid,{x:offset+301,y:-offset,z:200},{x:0,y:0,z:-1}),null);
  assert.equal(terrainRaycast(grid,{x:offset,y:-offset,z:0},{x:0,y:0,z:1}),null,'undersides follow the front-face culling rule');
  assert.equal(terrainRaycast(grid,{x:offset-300,y:-offset,z:200},{x:1,y:0,z:-1}),100);
  assert.equal(terrainRaycast(grid,{x:offset+300,y:-offset,z:200},{x:-1,y:0,z:-1}),100);
 }
});
