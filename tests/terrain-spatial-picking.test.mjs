import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {buildSync} from 'esbuild';
const require=createRequire(import.meta.url);
buildSync({stdin:{contents:"export * from './src/app/terrain-spatial-view';export {ATLAS_CAMERA_FOV} from './src/app/atlas-camera';export * as THREE from 'three';",resolveDir:process.cwd()},outfile:'.build/terrain-spatial-picking-test.cjs',bundle:true,platform:'node',format:'cjs'});
const {TerrainSpatialView,THREE,ATLAS_CAMERA_FOV}=require('../.build/terrain-spatial-picking-test.cjs');
function fixture(){
 const box={x:101100,y:458304,width:1894950,height:1180544},frame={x:732751,y:851819,width:631650,height:393515};
 const v={box,frame,columns:33,rows:33,focusM:120,tilt:45,rotation:0,exaggeration:2};
 const data={grid:{view:v,heights:new Float32Array(33*33).fill(120),seaLevelM:0},width:16,height:16,pixels:new Uint8Array(1024),draft:false};
 const state=Object.create(TerrainSpatialView.prototype);Object.assign(state,{canvas:{clientWidth:1496,clientHeight:932,getBoundingClientRect:()=>({left:424,top:48,width:1496,height:932})},renderer:{setSize(){},dispose(){},forceContextLoss(){},render(scene){scene.updateMatrixWorld(true);}},camera:new THREE.PerspectiveCamera(ATLAS_CAMERA_FOV),scene:new THREE.Scene(),routes:[]});state.setData(data);return{state,data};
}
for(const pan of [0,100000])test(`preview retains the frozen world hit after camera translation ${pan}`,()=>{
 const {state,data}=fixture();const frame={...data.grid.view.frame,x:data.grid.view.frame.x+pan};state.reframe(frame,45,0);
 const before=state.hit(1172,514);assert(before);
 const preview={...data,draft:true,grid:{...data.grid,view:{...data.grid.view,frame},heights:new Float32Array(data.grid.heights).fill(10000)}};state.setData(preview);
 const after=state.hit(1172,514);assert(after);assert(Math.hypot(after.x-before.x,after.y-before.y)<.05,JSON.stringify({before,after}));
});
for(const pan of [0,100000])test(`live committed surface preserves frozen hit and camera after pan ${pan}`,()=>{
 const {state,data}=fixture();const frame={...data.grid.view.frame,x:data.grid.view.frame.x+pan};state.reframe(frame,45,25);
 const before=state.hit(1172,514);assert(before);state.freezePicking(true);
 for(const height of [500,10000])state.setData({...data,draft:false,grid:{...data.grid,view:{...data.grid.view,frame,tilt:45,rotation:25,exaggeration:3,focusM:height},heights:new Float32Array(data.grid.heights).fill(height)}});
 const after=state.hit(1172,514);assert(after);assert(Math.hypot(after.x-before.x,after.y-before.y)<.05,JSON.stringify({before,after}));state.freezePicking(false);
});
test('matching deltas retain GPU geometry, texture and frozen picker while uploading only changed spans',()=>{
 const {state,data}=fixture(),identity={revision:1,fence:'one',key:'view'};
 state.setData({...data,identity});state.freezePicking(true);
 const mesh=state.mesh,geometry=mesh.geometry,texture=mesh.material.map,picker=state.picker,positions=geometry.getAttribute('position'),before=positions.array.slice();
 const heights=data.grid.heights.slice(),pixels=data.pixels.slice();heights[16*33+16]=220;pixels[0]=255;
 state.setData({...data,identity:{...identity,revision:2,fence:'two'},grid:{...data.grid,heights},pixels,update:{base:identity,heights:[{x:16,y:16,width:1,height:1}],pixels:[{x:0,y:0,width:1,height:1}]}});
 assert.equal(state.mesh,mesh);assert.equal(mesh.geometry,geometry);assert.equal(mesh.material.map,texture);assert.equal(state.picker,picker);
 assert.equal(positions.array[(16*33+16)*3+2],200);assert.equal(positions.array[2],before[2]);assert.deepEqual(positions.updateRanges,[{start:(16*33+16)*3,count:3}]);assert.deepEqual(texture.updateRanges,[{start:0,count:4}]);
 assert.equal(state.base.heights[16*33+16],120,'visibility uses the immutable pre-gesture heights');
});
test('fine brush texture is reused independently and shader blending leaves distant terrain intact',()=>{
 const {state,data}=fixture(),identity={revision:1,fence:'one',key:'view'},box={x:800000,y:900000,width:50000,height:50000};
 const detail={box,width:256,height:256,pixels:new Uint8Array(256*256*4)};
 state.setData({...data,identity,detail});state.freezePicking(true);
 const texture=state.detail.detailTexture,picker=state.picker,geometry=state.mesh.geometry,shader={uniforms:{},vertexShader:'#include <begin_vertex>',fragmentShader:'#include <map_fragment>'};
 state.mesh.material.onBeforeCompile(shader);assert.match(shader.fragmentShader,/fineUV/);assert.match(shader.fragmentShader,/smoothstep/);
 const pixels=detail.pixels.slice();pixels[40]=255;
 state.setData({...data,identity:{...identity,revision:2,fence:'two'},detail:{...detail,pixels},update:{base:identity,heights:[],pixels:[],detail:[{x:10,y:0,width:1,height:1}]}});
 assert.equal(state.detail.detailTexture,texture);assert.equal(state.picker,picker);assert.equal(state.mesh.geometry,geometry);assert.deepEqual(texture.updateRanges,[{start:40,count:4}]);
 assert.equal(shader.uniforms.detailEnabled.value,true);assert.equal(detail.pixels[40],0);
});

test('unchanged distant roads retain meshes; local height edits rebuild only the intersecting road',()=>{
 const {state,data}=fixture(),v=data.grid.view,b=v.box,at=(x,y)=>({x:b.x+x*b.width/32,y:b.y+y*b.height/32});
 const road=(id,y)=>({id,revision:1,kind:'road',name:id,points:[at(14,y),at(18,y)],polygons:[],width:100,resolution:1,values:{}});

 const identity={revision:1,fence:'one',key:'view'},routes=[road('near',16),road('far',3)];
 state.setData({...data,identity,routes});state.freezePicking(true);
 const near=state.routeState.get('near').meshes,far=state.routeState.get('far').meshes;
 const heights=data.grid.heights.slice();heights[16*33+16]=220;
 state.setData({...data,identity:{...identity,revision:2,fence:'two'},routes,grid:{...data.grid,heights},update:{base:identity,heights:[{x:16,y:16,width:1,height:1}],pixels:[]}});
 assert.notEqual(state.routeState.get('near').meshes,near);assert.equal(state.routeState.get('far').meshes,far);
});

test('perspective output tiles match the full main-camera projection at their shared edge',()=>{
 const {state,data}=fixture();state.reframe(data.grid.view.frame,55,25);
 const point=new THREE.Vector3(1000,2000,30),full=point.clone().project(state.camera),captures=[];
 state.renderer.render=()=>captures.push(point.clone().project(state.camera));
 state.renderTile(1800,1200,0,0,900,1200);
 state.renderTile(1800,1200,900,0,900,1200);
 // setViewOffset uses the output aspect; compare against a full output of the same size.
 state.renderTile(1800,1200,0,0,1800,1200);const expected=captures[2];
 assert(Math.abs((captures[0].x-1)/2-expected.x)<1e-9);
 assert(Math.abs((captures[1].x+1)/2-expected.x)<1e-9);
 assert(Math.abs(captures[0].y-expected.y)<1e-9);assert.equal(state.camera.view.enabled,false);
 state.render();assert(Math.abs(point.clone().project(state.camera).x-full.x)<1e-9,'editor pose is unchanged by image output');
});

test('retained detail stays on the same world point when the new surface clips its bounds',()=>{
 const {state,data}=fixture(),detail={box:{x:800000,y:900000,width:50000,height:50000},width:16,height:16,pixels:new Uint8Array(1024)};
 state.setData({...data,detail});const texture=state.detail.detailTexture;
 // Zoom inside the old detail, whose bounds now extend beyond every surface edge.
 const box={x:810000,y:910000,width:20000,height:20000},view={...data.grid.view,box,frame:box};
 state.setData({...data,grid:{...data.grid,view},detail});assert.equal(state.detail.detailTexture,texture);
 const uniforms=state.mesh.material.userData.terrainDetail,b=uniforms.detailBox.value;
 const mapUV=new THREE.Vector2(.75,.75); // World point 825000,925000: centre of the retained colour.
 mapUV.sub(new THREE.Vector2(b.x,b.y)).divide(new THREE.Vector2(b.z,b.w));
 assert(mapUV.distanceTo(new THREE.Vector2(.5,.5))<1e-12);assert.equal(uniforms.detailEnabled.value,true);
 state.dispose();
});
