import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildSync} from 'esbuild';
import {createRequire} from 'node:module';
buildSync({stdin:{resolveDir:process.cwd(),contents:"export * from './src/app/vegetation-geometry';export * from './src/app/vegetation-shape';export {AtlasSpatialVegetation} from './src/app/atlas-spatial-vegetation';export * as THREE from 'three';"},outfile:'.build/vegetation-geometry-test.cjs',bundle:true,platform:'node',format:'cjs'});
const {vegetationGeometry,crownTone,AtlasSpatialVegetation,THREE}=createRequire(import.meta.url)('../.build/vegetation-geometry-test.cjs');
test('shared tree models keep finite metre bounds and bounded triangle budgets',()=>{
 for(const asset of ['oak','pine']){
  const g=vegetationGeometry(asset,'crown');try{
   assert(g.index.count/3<=144,'shared crown budget');
   for(const name of ['position','normal','color'])assert([...g.getAttribute(name).array].every(Number.isFinite),asset+' '+name);
   g.computeBoundingBox();const b=g.boundingBox;assert(b.min.z>=.15&&b.max.z<=1.001);
   assert(b.min.x>=-.4&&b.max.x<=.4&&b.min.y>=-.4&&b.max.y<=.4);
   assert(b.max.x-b.min.x>.5,'readable crown width');
  }finally{g.dispose();}
 }
 const tones=Array.from({length:50},(_,n)=>crownTone('tree:'+n));assert(new Set(tones).size>40);assert(tones.every(t=>t>=.88&&t<1.1));assert.equal(crownTone('ancient-oak'),crownTone('ancient-oak'));
});
test('crown appearance preserves source instances and composes with camera LOD and disposal',()=>{
 const instances=Array.from({length:20},(_,n)=>({id:'tree:'+n,asset:n%2?'pine':'oak',x:n*10,y:0,z:40,size:12,angle:n/10,normal:{x:0,y:0,z:1},protected:true})),records=[{id:'forest',vegetationView:{mode:'individual',instances}}],before=structuredClone(records);
 const view=new AtlasSpatialVegetation(records,{origin:{x:0,y:0},focusM:0,exaggeration:1});
 let disposed=0;assert.equal(view.group.children.length,4,'one trunk and one crown batch per species');
 for(const mesh of view.group.children){
  mesh.geometry.addEventListener('dispose',()=>disposed++);mesh.material.addEventListener('dispose',()=>disposed++);
  const shader={uniforms:{},vertexShader:THREE.ShaderLib.lambert.vertexShader,fragmentShader:THREE.ShaderLib.lambert.fragmentShader};mesh.material.onBeforeCompile(shader,{});
  assert(shader.vertexShader.includes('plantOpacity='));assert(shader.fragmentShader.includes('gl_FragColor.a*=plantOpacity'));
  if(mesh.geometry.getAttribute('color'))assert(shader.fragmentShader.includes('crownEdge'));
 }
 assert.deepEqual(records,before);view.dispose();assert.equal(disposed,8);assert.equal(view.group.children.length,0);
});
