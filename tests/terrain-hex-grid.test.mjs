import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {buildSync} from 'esbuild';
buildSync({stdin:{resolveDir:process.cwd(),contents:"export {atlasPaint} from './src/app/atlas-paint';export {drawLandscapeGrid} from './src/app/atlas-landscape-view';export {TerrainHexGrid} from './src/app/terrain-hex-grid';export {terrainContourSlope} from './src/app/terrain-contours';"},outfile:'.build/terrain-hex-grid-test.cjs',bundle:true,platform:'node',format:'cjs'});
const {atlasPaint,drawLandscapeGrid,TerrainHexGrid,terrainContourSlope}=createRequire(import.meta.url)('../.build/terrain-hex-grid-test.cjs');
test('main grid keeps the same level as vector export without generating cell geometry',()=>{
 for(const width of [1000,100000,40000000]){
  const box={x:-width/2,y:-width/2,width,height:width},level=width>1e6?'quarter':'hour',vector=atlasPaint('group'),gpu=atlasPaint('group');
  drawLandscapeGrid(vector,box,level,width/1000);drawLandscapeGrid(gpu,box,level,width/1000,true);
  assert.deepEqual(gpu.mapGrid,vector.mapGrid);assert.equal(gpu.children.length,0);assert(vector.children.length>0);
 }
});
test('grid crossfade and world anchoring only update shared uniforms',()=>{
 const grid=new TerrainHexGrid(),root=atlasPaint('group'),a=atlasPaint('group',{opacity:.25}),b=atlasPaint('group',{opacity:.75});a.mapGrid={size:10};b.mapGrid={size:80};root.append(a,b);grid.set({root},true);
 const material={userData:{},onBeforeCompile(){},customProgramCacheKey(){return 'base';}},shader={uniforms:{},vertexShader:'#include <begin_vertex>',fragmentShader:'#include <opaque_fragment>'};grid.attach(material);material.onBeforeCompile(shader);
 grid.update({x:-10000001,y:20000001},2);const before=shader.uniforms.terrainHexA.value.clone();assert.equal(before.w,.25);assert.equal(shader.uniforms.terrainHexB.value.w,.75);assert(before.x>=0&&before.x<1);assert(before.y>=0&&before.y<Math.sqrt(3));
 grid.update({x:-9999991,y:20000001},2);assert.equal(shader.uniforms.terrainHexA.value.x,before.x);
 root.children.length=0;grid.set({root},true);grid.update({x:0,y:0},1);assert.equal(shader.uniforms.terrainHexA.value.w,0);assert.equal(shader.uniforms.terrainHexB.value.w,0);
});
test('contour slope uses world metres and both displayed triangles',()=>{
 const view={box:{x:-10,y:-20,width:20,height:40},frame:{x:-10,y:-20,width:20,height:40},columns:2,rows:2,focusM:0,tilt:0,rotation:0,exaggeration:1};
 assert.equal(terrainContourSlope({view,heights:new Float32Array([5,5,5,5])}),0);
 assert.equal(terrainContourSlope({view,heights:new Float32Array([0,0,0,40])}),Math.hypot(2,1));
 assert.equal(terrainContourSlope({view:{...view,exaggeration:8,frame:{...view.frame,width:2000}},heights:new Float32Array([0,0,0,40])}),Math.hypot(2,1));
});
