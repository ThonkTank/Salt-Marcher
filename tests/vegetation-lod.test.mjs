import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildSync} from 'esbuild';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
buildSync({stdin:{contents:"export * from './src/app/vegetation';export * from './src/app/vegetation-lod';export * from './src/app/atlas-spatial-vegetation';export * as THREE from 'three';",resolveDir:process.cwd()},outfile:'.build/vegetation-lod-test.cjs',bundle:true,platform:'node',format:'cjs'});
const {vegetationSpec,vegetationRepresentative,vegetationStride,vegetationScaleLimit,vegetationOpacity,AtlasSpatialVegetation,THREE}=require('../.build/vegetation-lod-test.cjs');
test('every coarse representative survives from its child, including negative cells and multiple seeds',()=>{
 for(const seed of [0,1,123,4294967295])for(const stride of [2,4,8,16,64,256])for(let x=-4*stride;x<=4*stride;x+=stride)for(let y=-4*stride;y<=4*stride;y+=stride){
  const p=vegetationRepresentative(seed,x,y,stride),half=stride/2;
  assert(p.x>=x&&p.x<x+stride&&p.y>=y&&p.y<y+stride);
  assert.deepEqual(p,vegetationRepresentative(seed,Math.floor(p.x/half)*half,Math.floor(p.y/half)*half,half));
 }
});
test('a removed candidate is already invisible before any coarser source arrives',()=>{
 for(const spacing of [2,12,60,1000])for(const layout of ['natural','row']){
  const spec={...vegetationSpec(),spacing,layout};
  for(let x=-20;x<=20;x++)for(let y=-4;y<=4;y++){
   const i={id:layout==='row'?`row:${x}`:`tree:${x}:${y}`,asset:'oak'},limit=vegetationScaleLimit(i,spec);
   for(const mpp of [1,1.9,2.001,3,4,8,20,79,81]){
    const stride=vegetationStride(spacing,mpp),p=vegetationRepresentative(spec.seed,Math.floor(x/stride)*stride,Math.floor(y/stride)*stride,stride);
    const present=mpp<=80&&(layout==='row'?x%stride===0:p.x===x&&p.y===y);
    if(!present)assert.equal(vegetationOpacity(mpp,limit),0);
   }
  }
 }
});
test('undergrowth fades at detail scale and protected objects stay visible',()=>{
 const spec=vegetationSpec();
 for(const asset of ['shrub','grass','rock']){
  const i={id:'under:0:0',asset},limit=vegetationScaleLimit(i,spec);
  assert.equal(limit,2);assert.equal(vegetationOpacity(1,limit),1);assert.equal(vegetationOpacity(1.75,limit),.5);assert.equal(vegetationOpacity(2,limit),0);
  assert.equal(vegetationOpacity(1000,vegetationScaleLimit({...i,protected:true},spec)),1);
 }
});
function fixture(protectedObject=false){
 const i={id:'row:1',asset:'oak',x:0,y:0,z:0,size:10,angle:0,normal:{x:0,y:0,z:1},protected:protectedObject};
 const spec=vegetationSpec();spec.spacing=12;spec.layout='row';
 const vegetation=new AtlasSpatialVegetation([{id:'wood',vegetation:spec,vegetationView:{mode:'individual',instances:[i]}}],{origin:{x:0,y:0},focusM:0,exaggeration:1});
 vegetation.group.updateMatrixWorld(true);
 const camera=new THREE.PerspectiveCamera(45,1,.01,10000),ray=new THREE.Raycaster();
 for(const mesh of vegetation.group.children)mesh.onBeforeRender({getSize:v=>v.set(100,100)});
 const pick=(mpp,x)=>{
  camera.position.set(0,0,50*mpp/Math.tan(Math.PI/8));camera.lookAt(0,0,0);camera.updateMatrixWorld(true);
  ray.setFromCamera(new THREE.Vector2(x/(50*mpp),0),camera);
  return vegetation.hit(ray,['vegetation-trees']);
 };
 return {vegetation,pick};
}
test('picking follows expanded crown pixels during camera-only zoom, then ignores faded trees',()=>{
 const {vegetation,pick}=fixture();
 try{
  const before=vegetation.group.children.map(m=>Array.from(m.instanceMatrix.array));
  assert.equal(pick(.5,4.2),null);assert.equal(pick(1.5,4.2)?.data.vegetationInstance,'row:1');
  assert.equal(pick(2.1,0),null);
  assert.deepEqual(vegetation.group.children.map(m=>Array.from(m.instanceMatrix.array)),before);
 }finally{vegetation.dispose();}
});
test('protected crowns retain physical size and remain pickable beyond automatic levels',()=>{
 const {vegetation,pick}=fixture(true);
 try{assert.equal(pick(1.5,4.2),null);assert.equal(pick(100,0)?.data.vegetationInstance,'row:1');}
 finally{vegetation.dispose();}
});
