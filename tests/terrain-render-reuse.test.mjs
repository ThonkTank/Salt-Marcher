import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildSync} from 'esbuild';
import {createRequire} from 'node:module';
buildSync({stdin:{resolveDir:process.cwd(),contents:"export * from './src/app/terrain-ring';export * from './src/app/terrain-route-visibility';export * from './src/app/terrain-route-display';export * from './src/app/terrain-route-view';export * from './src/app/terrain-spatial-model';export * from './src/app/atlas-landscape';export * as THREE from 'three';"},outfile:'.build/terrain-render-reuse-test.cjs',bundle:true,platform:'node',format:'cjs'});
const {TerrainRing,TerrainRouteVisibility,routeMeshes,routeDisplayVisible,gridHeight,emptyRecord,THREE}=createRequire(import.meta.url)('../.build/terrain-render-reuse-test.cjs');
const box={x:-100,y:-100,width:200,height:200};
const grid=()=>({view:{box,frame:box,columns:17,rows:17,focusM:30,exaggeration:2,tilt:0,rotation:0},heights:Float32Array.from({length:289},(_,i)=>30+i%17)});
test('ring retains its GPU resources and exact circle geometry through movement, hiding and terrain changes',()=>{
 const ring=new TerrainRing('#a65f30'),g=grid(),origin={x:12,y:-8},geometry=ring.line.geometry,material=ring.line.material,positions=geometry.getAttribute('position');
 let disposed=0;geometry.addEventListener('dispose',()=>disposed++);material.addEventListener('dispose',()=>disposed++);
 const verify=(point,radius)=>{
  ring.set(point,radius,g,origin);
  const expected=[];for(let i=0;i<=64;i++){const angle=i*Math.PI/32,p={x:point.x+Math.cos(angle)*radius,y:point.y+Math.sin(angle)*radius};expected.push(p.x-origin.x,origin.y-p.y,(gridHeight(g,p)-g.view.focusM)*g.view.exaggeration+g.view.frame.width*.00015);}
  assert.deepEqual(positions.array,new Float32Array(expected));assert.equal(ring.line.geometry,geometry);assert.equal(ring.line.material,material);assert(ring.line.visible);
  assert.equal(ring.set(point,radius,g,origin),false,'unchanged vertices require neither an upload nor a draw');
 };
 verify({x:0,y:0},12);const version=positions.version;
 for(let i=0;i<40;i++)verify({x:i/3,y:-i/5},12+i/7);
 assert(positions.version>version);assert.equal(ring.set(null,12,g,origin),true);assert.equal(ring.set(null,12,g,origin),false);assert(!ring.line.visible);assert.equal(disposed,0);
 verify({x:10,y:10},30);const before=positions.array.slice();g.heights.fill(180);assert(ring.refresh(g,origin));assert.notDeepEqual(positions.array,before);verify({x:10,y:10},30);
 g.view={...g.view,focusM:160,exaggeration:3};origin.x=60;verify({x:5,y:-20},7);
 const scene=new THREE.Scene();scene.add(ring.line);ring.dispose();assert.equal(disposed,2);assert.equal(ring.line.parent,null);
});
test('route visibility reuses identical frames and follows zoom, pose, viewport and changed geometry',()=>{
 const r={...emptyRecord('road'),id:'route',width:2,points:[{x:-100,y:0},{x:100,y:0}]},routes=routeMeshes(r,()=>0,{x:0,y:0,z:0},1,10),cache=new TerrainRouteVisibility(),camera=new THREE.PerspectiveCamera(45,1,.001,1e9);
 const pose=(z,angle=0)=>{camera.position.set(Math.sin(angle)*z,0,Math.cos(angle)*z);camera.lookAt(0,0,0);camera.updateMatrixWorld();camera.updateProjectionMatrix();};
 const check=height=>{assert(cache.update(routes,camera,height));assert.deepEqual(routes.map(r=>r.visible),routes.map(r=>routeDisplayVisible(r,camera,height)));assert.equal(cache.update(routes,camera,height),false);};
 pose(1e8);check(1000);assert(routes.every(r=>!r.visible));pose(1000);check(1000);assert(routes.some(r=>r.visible));pose(1000,.4);check(1000);check(2000);
 const selected=routeMeshes(r,()=>0,{x:0,y:0,z:0},1,10,true);pose(1e8);assert(cache.update(selected,camera,1000));assert(selected.some(r=>r.visible));
 cache.clear();assert(cache.update(selected,camera,1000));
 for(const mesh of [...routes,...selected]){mesh.geometry.dispose();mesh.material.dispose();}
});
