import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildSync} from 'esbuild';
import {createRequire} from 'node:module';
buildSync({stdin:{resolveDir:process.cwd(),contents:"export * from './src/app/terrain-route-display';export * from './src/app/terrain-route-view';export * from './src/app/atlas-landscape';export * from './src/app/landscape-line';export * from './src/app/terrain-route';export {PerspectiveCamera,Raycaster,Vector2} from 'three';"},outfile:'.build/terrain-route-display-test.cjs',bundle:true,platform:'node',format:'cjs'});
const {routeMayDraw,routeDisplayVisible,routeDisplayOpacity,routeMeshes,emptyRecord,newLine,routeSpec,PerspectiveCamera,Raycaster,Vector2}=createRequire(import.meta.url)('../.build/terrain-route-display-test.cjs');
const road=()=>({...emptyRecord('road'),id:'road',width:2,line:{...newLine('road'),style:'solid',curve:'linear',roughness:0},points:[{x:-100,y:0},{x:100,y:0}]});
const dispose=meshes=>meshes.forEach(m=>{m.geometry.dispose();m.material.dispose();});
test('semantic visibility and overview handoff vary continuously and keep important routes available',()=>{
 for(const threshold of [.12,.18,.4]){
  assert.equal(routeDisplayOpacity(0,threshold,false),0);assert.equal(routeDisplayOpacity(10,threshold,false),1);
  assert.equal(routeDisplayOpacity(10,threshold,true),0);assert(Math.abs(routeDisplayOpacity(threshold,threshold,false)-.5)<1e-12);
  assert.equal(routeDisplayOpacity(0,threshold,true,true),1);
  let prior=0;for(let n=0;n<1000;n++){const next=routeDisplayOpacity(n/1000,threshold,false);assert(next>=prior&&next-prior<.013);prior=next;}
 }
});
test('minimum screen-width picking follows the existing camera while hidden detail cannot intercept selection',()=>{
 const r=road(),before=JSON.stringify(r),meshes=routeMeshes(r,()=>0,{x:0,y:0,z:0},1,10),camera=new PerspectiveCamera(45,1,.001,1e7),ray=new Raycaster();
 const position=cameraDistance=>{camera.position.set(0,0,cameraDistance);camera.lookAt(0,0,0);camera.updateMatrixWorld();camera.updateProjectionMatrix();for(const m of meshes){m.updateMatrixWorld();m.onBeforeRender({getSize:v=>v.set(1000,1000)});}};
 // 4 m per CSS pixel: physical width is .5 px; the visible overview is 1.4 px.
 position(4*500/Math.tan(Math.PI/8));ray.setFromCamera(new Vector2(0,.001),camera);
 assert(ray.intersectObjects(meshes,false).some(h=>h.object.userData.routeOverview),'visible half-pixel offset is selectable through the overview');
 position(100*500/Math.tan(Math.PI/8));ray.setFromCamera(new Vector2(0,0),camera);assert.equal(ray.intersectObjects(meshes,false).length,0,'faded route cannot steal a terrain hit');
 assert.equal(JSON.stringify(r),before);dispose(meshes);
});
test('overview retains canonical IDs and excludes tunnel sections rather than drawing through mountains',()=>{
 const r=road();r.route=routeSpec('road',r.points);r.route.nodes=[{x:-100,y:0,z:20,structure:'ground'},{x:0,y:0,z:20,structure:'tunnel'},{x:100,y:0,z:20,structure:'tunnel'}];
 const meshes=routeMeshes(r,()=>40,{x:0,y:0,z:0},1,10),overview=meshes.find(m=>m.userData.routeOverview);
 assert(overview);assert.equal(overview.userData.landscapeId,r.id);
 const starts=overview.geometry.getAttribute('instanceStart'),ends=overview.geometry.getAttribute('instanceEnd');
 for(let i=0;i<starts.count;i++)assert((starts.getX(i)+ends.getX(i))/2<0);
 dispose(meshes);
});
test('different route widths share shaders and keep their own width uniforms',()=>{
 const a=routeMeshes(road(),()=>0,{x:0,y:0,z:0},1,10),b=routeMeshes({...road(),width:9},()=>0,{x:0,y:0,z:0},1,10);
 assert.equal(a[0].material.customProgramCacheKey(),b[0].material.customProgramCacheKey());
 for(const [meshes,width]of [[a,2],[b,9]]){const shader={uniforms:{},vertexShader:'#include <fog_vertex>',fragmentShader:'#include <tonemapping_fragment>'};meshes[0].material.onBeforeCompile(shader);assert.equal(shader.uniforms.routePolicy.value.x,width);}
 dispose(a);dispose(b);
});
test('long world roads only sample their loaded terrain coverage, with unchanged author endpoints',()=>{
 const r=road();r.points=[{x:-1e6,y:0},{x:1e6,y:0}];r.line=undefined;const before=JSON.stringify(r),box={x:-100,y:-100,width:200,height:200};let samples=0;
 const meshes=routeMeshes(r,p=>{samples++;assert(Math.abs(p.x)<=105&&Math.abs(p.y)<=5);return 0;},{x:0,y:0,z:0},1,2,false,box);
 assert(meshes.length>=2,'a crossing world segment remains visible');assert(samples>0&&samples<1000,`bounded local samples: ${samples}`);
 assert.equal(JSON.stringify(r),before);dispose(meshes);
});
test('world-scale invisible routes skip draw calls and reappear without rebuilding geometry',()=>{
 const r=road(),meshes=routeMeshes(r,()=>0,{x:0,y:0,z:0},1,10),camera=new PerspectiveCamera(45,1,.001,1e9),geometries=meshes.map(m=>m.geometry);
 const at=distance=>{camera.position.set(0,0,distance);camera.lookAt(0,0,0);camera.updateMatrixWorld();camera.updateProjectionMatrix();return meshes.map(m=>routeDisplayVisible(m,camera,1000));};
 assert(at(1e8).every(v=>!v),'zero-alpha geometry must not enter the draw list');assert(at(1000).some(Boolean));assert.deepEqual(meshes.map(m=>m.geometry),geometries);
 const selected=routeMeshes(r,()=>0,{x:0,y:0,z:0},1,10,true);at(1e8);assert(selected.some(m=>routeDisplayVisible(m,camera,1000)),'selected routes remain visible');
 // A long route can extend much nearer than its centre. Culling must use its bound.
 const mesh=meshes.find(m=>m.userData.routeOverview);mesh.geometry.boundingSphere.radius=1e8;assert(routeDisplayVisible(mesh,camera,1000));dispose(meshes);dispose(selected);
});


test('preflight only defers zero-opacity ground routes across camera poses and output sizes',()=>{
 const r=road(),box={x:-100,y:-100,width:200,height:200},origin={x:0,y:0},camera=new PerspectiveCamera(45,1,.001,1e9);
 let skipped=0,visible=0;
 for(const elevation of [-20,0,20])for(const distance of [100,1000,100000,1e8])for(const tilt of [0,.5,1.1])for(const pixels of [300,1000,6000]){
  camera.position.set(0,-Math.sin(tilt)*distance,Math.cos(tilt)*distance);camera.lookAt(0,0,0);camera.updateMatrixWorld();camera.updateProjectionMatrix();
  const may=routeMayDraw(r,camera,pixels,box,origin,20,2);
  if(may){visible++;continue;}skipped++;
  const meshes=routeMeshes(r,()=>elevation,{...origin,z:0},2,10,false,box);
  for(const mesh of meshes.filter(m=>!m.userData.routeOverview)){
   const a=mesh.geometry.getAttribute('position'),m=camera.matrixWorldInverse.elements;
   for(let i=0;i<a.count;i++){
    const depth=-(m[2]*a.getX(i)+m[6]*a.getY(i)+m[10]*a.getZ(i)+m[14]);
    assert.equal(routeDisplayOpacity(r.width*camera.projectionMatrix.elements[5]*pixels*.5/Math.max(1e-6,depth),.18,false),0);
   }
  }dispose(meshes);
 }
 assert(skipped>30);assert(visible>30);
 camera.position.set(0,0,1e8);camera.lookAt(0,0,0);camera.updateMatrixWorld();
 assert(routeMayDraw({...r,route:routeSpec('road',r.points)},camera,1000,box,origin,20,2),'planned routes keep portals and conflict/selection indicators');
});
