import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {buildSync} from 'esbuild';
const require=createRequire(import.meta.url);
buildSync({stdin:{contents:"export * from './src/app/terrain-spatial-model';export * from './src/app/terrain-height';export * from './src/app/terrain-brush';export * from './src/app/terrain-color-visibility';export * from './src/app/terrain-spatial-worker';",resolveDir:process.cwd()},outfile:'.build/terrain-tilted-atlas-test.cjs',bundle:true,platform:'node',format:'cjs'});
const {terrainSourceBounds,heightBrushBounds,terrainGrid,terrainVisible,gridHeight,projectTerrain,validateTerrainView,heightRecord,applyTerrainBrush,TerrainSampler,visibleTerrainColor,renderTerrainSpatial}=require('../.build/terrain-tilted-atlas-test.cjs');
import * as THREE from 'three';
const view=(extra={})=>({box:{x:-64,y:-64,width:128,height:128},frame:{x:-64,y:-64,width:128,height:128},columns:33,rows:33,focusM:100,tilt:60,rotation:0,exaggeration:1,...extra});
const surface=fn=>{const result=[];for(let y=-1;y<=1;y++)for(let x=-1;x<=1;x++)result.push(heightRecord(x*64,y*64,1,Float32Array.from({length:4096},(_,i)=>fn(x*64+i%64,y*64+Math.floor(i/64)))));return result;};
const mountain=()=>surface((x,y)=>100+Math.max(0,1-Math.abs(y)/12)*50);
const stroke=(mode,visibility)=>({mode,radius:48,strength:200,feather:0,visibility,samples:[{x:0,y:-18,t:0},{x:0,y:-18,t:500}]});
const merged=(records,change)=>[...records.filter(r=>!change.some(c=>r.id===c.id)),...change];
test('rotation, tilt and exaggeration project to the same position as the orthographic Three camera',()=>{
 for(const tilt of [0,30,65])for(const rotation of [-120,0,80])for(const exaggeration of [.25,2,8]){
  const v=view({tilt,rotation,exaggeration}),a=rotation*Math.PI/180,t=tilt*Math.PI/180,c=new THREE.OrthographicCamera(-64,64,64,-64,.001,30000);c.up.set(0,0,1);if(!tilt)c.up.set(-Math.sin(a),Math.cos(a),0);c.position.set(Math.sin(a)*Math.sin(t)*10000,-Math.cos(a)*Math.sin(t)*10000,Math.cos(t)*10000);c.lookAt(0,0,0);c.updateMatrixWorld();c.updateProjectionMatrix();
  const p={x:12,y:-21},h=130,expected=projectTerrain(v,p,h),actual=new THREE.Vector3(p.x,-p.y,(h-v.focusM)*exaggeration).project(c);assert(Math.abs((actual.x+1)/2-expected.x)<1e-10);assert(Math.abs((1-actual.y)/2-expected.y)<1e-10);
 }
});
test('triangular interpolation matches GPU triangles rather than smoothing across their diagonal',()=>{
 const g={view:view({columns:2,rows:2,box:{x:0,y:0,width:1,height:1}}),heights:new Float32Array([0,0,0,100]),seaLevelM:0};assert.equal(gridHeight(g,{x:.25,y:.25}),0);assert.equal(gridHeight(g,{x:.75,y:.75}),50);
});
test('near ridge occludes far ground, rotation reverses it; overheight is visual and considered by clipping',()=>{
 const records=mountain(),g=terrainGrid(records,view()),before=JSON.stringify(records);
 assert.equal(terrainVisible(g,{x:0,y:-20}),false);assert.equal(terrainVisible(g,{x:0,y:20}),true);
 const reversed=terrainGrid(records,view({rotation:180}));assert.equal(terrainVisible(reversed,{x:0,y:20}),false);assert.equal(terrainVisible(reversed,{x:0,y:-20}),true);
 assert.equal(terrainVisible(terrainGrid(records,view({tilt:0})),{x:0,y:-20}),true);
 const low=terrainGrid(records,view({exaggeration:.25}));assert.equal(terrainVisible(low,{x:0,y:-30}),true);assert.equal(terrainVisible(g,{x:0,y:-30}),false);
 assert.equal(JSON.stringify(records),before);
});
test('all sculpt modes protect hidden nodes and share exactly the same frozen camera mask',()=>{
 const records=mountain(),v=view();
 for(const mode of ['raise','lower','smooth']){
  const next=merged(records,applyTerrainBrush(records,stroke(mode,v))),old=new TerrainSampler(records),changed=new TerrainSampler(next);
  assert.equal(changed.sample({x:0,y:-20}).heightM,old.sample({x:0,y:-20}).heightM);
  if(mode!=='smooth')assert.notEqual(changed.sample({x:0,y:20}).heightM,old.sample({x:0,y:20}).heightM);
 }
});
test('colour stores a visible footprint once, not a camera-dependent paint layer',()=>{
 const records=mountain(),record={id:'paint',revision:0,kind:'patch',name:'',width:0,resolution:1,points:[{x:0,y:0}],polygons:[{outer:[{x:-20,y:-30},{x:20,y:-30},{x:20,y:30},{x:-20,y:30}],holes:[]}],values:{},paint:{version:2,operation:'paint',target:'ground',color:'#ff0000',opacity:1,flow:1,tip:'round',radius:30,seed:1,fill:false,visibility:view()}};
 const output=visibleTerrainColor(record,records);assert.equal(output.paint.visibility,undefined);assert(output.polygons.length);assert(output.polygons.every(p=>p.outer.every(v=>v.y>-20)));assert(record.paint.visibility);
});
test('spatial preview reads the same height operation as the canonical field; no new terrain is invented by zoom',()=>{
 const records=mountain(),v=view(),s=stroke('raise',v),job={source:'fixture',generation:1,records,view:v,box:v.box,width:64,height:64,heightStroke:s};
 const image=renderTerrainSpatial(job),next=merged(records,applyTerrainBrush(records,s));assert.deepEqual(image.grid.heights,terrainGrid(next,v).heights);assert.equal(image.pixels.length,64*64*4);
 assert.deepEqual(terrainGrid(records,v).heights,terrainGrid(structuredClone(records),v).heights);
});
test('unbounded meshes and invalid projections are rejected before generation',()=>{
 for(const extra of [{tilt:80},{tilt:NaN},{rotation:Infinity},{exaggeration:0},{columns:1000},{columns:33000,rows:2},{rows:1},{focusM:Infinity},{box:{x:1e13,y:0,width:100,height:100}}])assert.throws(()=>validateTerrainView(view(extra)),/ausschnitt/i);
});
test('visibility agrees with real triangle ray hits across diagonal rays and rotated ridges',()=>{
 const records=surface((x,y)=>100+12*Math.sin(x/9)+17*Math.cos(y/11));
 for(const rotation of [-175,-45,0,30,95,180]){
  const v=view({rotation,box:{x:-192,y:-192,width:384,height:384},columns:97,rows:97}),g=terrainGrid(records,v),positions=[],indices=[];
  for(let y=0;y<v.rows;y++)for(let x=0;x<v.columns;x++){const i=y*v.columns+x;positions.push(v.box.x+x*v.box.width/(v.columns-1),v.box.y+y*v.box.height/(v.rows-1),g.heights[i]);if(x<v.columns-1&&y<v.rows-1)indices.push(i,i+v.columns,i+1,i+1,i+v.columns,i+v.columns+1);}
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setIndex(indices);const mesh=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({side:THREE.BackSide}));mesh.updateMatrixWorld();
  const a=rotation*Math.PI/180,direction=new THREE.Vector3(Math.sin(a),Math.cos(a),1/Math.tan(v.tilt*Math.PI/180)/v.exaggeration).normalize();
  for(let i=0;i<35;i++){
   const p={x:-40+(i*37%80)+.13,y:-40+(i*19%80)+.27},z=gridHeight(g,p),screen=projectTerrain(v,p,z),onScreen=screen.x>=0&&screen.x<=1&&screen.y>=0&&screen.y<=1;
   const origin=new THREE.Vector3(p.x,p.y,z).addScaledVector(direction,10000),ray=new THREE.Raycaster(origin,direction.clone().negate()),hit=ray.intersectObject(mesh)[0];
   const expected=onScreen&&!!hit&&hit.point.distanceTo(new THREE.Vector3(p.x,p.y,z))<.01;
   assert.equal(terrainVisible(g,p),expected,JSON.stringify({rotation,p,hit:hit?.point}));
  }
  geo.dispose();mesh.material.dispose();
 }
});

test('wide smoothing reads neighbouring tiles beyond the displayed mesh without editing hidden nodes',()=>{
 const records=surface(x=>x>=64?400:100),v=view({box:{x:60,y:0,width:2,height:2},frame:{x:60,y:0,width:2,height:2},tilt:0}),s={mode:'smooth',radius:32,strength:10000,feather:0,visibility:v,samples:[{x:61,y:1,t:0},{x:61,y:1,t:1000}]};
 const b=terrainSourceBounds(v,s.radius/2);assert.deepEqual(heightBrushBounds(s),b);
 const read=records.filter(r=>r.height.x+64>=b.x&&r.height.x-1<=b.x+b.width&&r.height.y+64>=b.y&&r.height.y-1<=b.y+b.height),next=merged(records,applyTerrainBrush(read,s)),sampler=new TerrainSampler(next);
 assert.equal(sampler.sample({x:61,y:1}).heightM,200);assert.equal(sampler.sample({x:69,y:1}).heightM,400);
});

test('spatial contour ink is drawn at display time, not baked into background pixels',()=>{
 const records=mountain(),v=view(),job={source:'contours',generation:1,records,view:v,box:v.box,width:64,height:64};
 const plain=renderTerrainSpatial({...job,contours:0}),ink=renderTerrainSpatial({...job,contours:50});
 assert.deepEqual(plain.pixels,ink.pixels);assert.deepEqual(plain.grid.heights,ink.grid.heights);assert.equal(ink.contourInk,'#685639');
});

test('main Atlas empty terrain is opaque ocean behind ordinary map objects',()=>{
 const v=view({focusM:0,tilt:0}),r=renderTerrainSpatial({generation:1,source:'empty',view:v,records:[],box:v.box,width:16,height:16,contours:0});
 for(let i=0;i<r.pixels.length;i+=4)assert.deepEqual([...r.pixels.slice(i,i+4)],[127,168,189,255]);
});
