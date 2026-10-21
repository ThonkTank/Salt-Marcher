import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {buildSync} from 'esbuild';
const require=createRequire(import.meta.url);
buildSync({stdin:{contents:"export * from './src/app/terrain-spatial-view';export {TerrainHexGrid} from './src/app/terrain-hex-grid';export * from './src/app/atlas-workplane';export {atlasProject} from './src/app/atlas-camera';export {AtlasSpatialLabels} from './src/app/atlas-spatial-labels';export {ATLAS_CAMERA_FOV} from './src/app/atlas-camera';export * as THREE from 'three';",resolveDir:process.cwd()},outfile:'.build/terrain-spatial-picking-test.cjs',bundle:true,platform:'node',format:'cjs'});
const {TerrainSpatialView,TerrainHexGrid,AtlasSpatialLabels,THREE,ATLAS_CAMERA_FOV,atlasProject,atlasWorkplaneHeight}=require('../.build/terrain-spatial-picking-test.cjs');
function fixture(){
 const box={x:101100,y:458304,width:1894950,height:1180544},frame={x:732751,y:851819,width:631650,height:393515};
 const v={box,frame,columns:33,rows:33,focusM:120,tilt:45,rotation:0,exaggeration:2};
 const data={grid:{view:v,heights:new Float32Array(33*33).fill(120),seaLevelM:0},width:16,height:16,pixels:new Uint8Array(1024),draft:false};
 const state=Object.create(TerrainSpatialView.prototype);Object.assign(state,{labels:new AtlasSpatialLabels(),hexGrid:new TerrainHexGrid(),canvas:{clientWidth:1496,clientHeight:932,getBoundingClientRect:()=>({left:424,top:48,width:1496,height:932})},renderer:{copies:[],copyTextureToTexture(source,target,box,position){this.copies.push({source,target,box,position});},getPixelRatio(){return 1;},setSize(){},dispose(){},forceContextLoss(){},render(scene){scene.updateMatrixWorld(true);}},camera:new THREE.PerspectiveCamera(ATLAS_CAMERA_FOV),scene:new THREE.Scene(),routes:[]});state.setData(data);return{state,data};
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
 assert.equal(positions.array[(16*33+16)*3+2],200);assert.equal(positions.array[2],before[2]);assert.deepEqual(positions.updateRanges,[{start:(16*33+16)*3,count:3}]);assert.deepEqual(texture.updateRanges,[]);
 const [copy]=state.renderer.copies;assert.equal(state.renderer.copies.length,1);assert.equal(copy.target,texture);assert.equal(copy.source.image.data,pixels);assert.deepEqual(copy.box.min.toArray(),[0,0]);assert.deepEqual(copy.box.max.toArray(),[1,1]);
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
 assert.equal(state.detail.detailTexture,texture);assert.equal(state.picker,picker);assert.equal(state.mesh.geometry,geometry);assert.deepEqual(texture.updateRanges,[]);
 const [copy]=state.renderer.copies;assert.equal(state.renderer.copies.length,1);assert.equal(copy.target,texture);assert.equal(copy.source.image.data,pixels);assert.deepEqual(copy.box.min.toArray(),[10,0]);assert.deepEqual(copy.box.max.toArray(),[11,1]);assert.deepEqual(copy.position.toArray(),[10,0]);
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

for(const offset of [0,-1e9,1e9])test(`floor projection and pointer ray agree above uneven terrain at ${offset}`,()=>{
 const {state,data}=fixture();
 const frame={x:offset-60,y:offset-40,width:120,height:80},box={x:offset-180,y:offset-120,width:360,height:240};
 const view={...data.grid.view,frame,box,focusM:7,projection:'perspective',exaggeration:1.75};
 const heights=Float32Array.from({length:33*33},(_,i)=>7+(i%33)/32);
 state.setData({...data,grid:{...data.grid,view,heights}});
 const plane={scopeId:'house',elevationM:6,anchor:{x:offset,y:offset}},point={x:offset+8,y:offset+4};
 state.objectLayer.scopeBases.set('house',15);
 assert.equal(atlasWorkplaneHeight(plane,{scopeBases:state.objectLayer.scopeBases,height:()=>100}),21,'building base wins over terrain');
 for(const [tilt,rotation]of [[0,0],[45,25],[75,-130]]){
  state.reframe(frame,tilt,rotation);
  const expected=atlasProject(state.grid.view,point,21),screen=state.project(point,plane);
  assert(Math.abs(screen.x-expected.x)<1e-12&&Math.abs(screen.y-expected.y)<1e-12);
  const x=424+1496*screen.x,y=48+932*screen.y,hit=state.workplanePoint(x,y,plane);
  assert(hit);assert(Math.hypot(hit.x-point.x,hit.y-point.y)<1e-6,JSON.stringify({hit,point}));
  const nav=state.planePoint(x,y,plane);assert(nav);assert(Math.hypot(nav.x-hit.x,nav.y-hit.y)<1e-6,'navigation anchors use the same floor without terrain occlusion');
  const ground=state.hit(x,y);if(tilt<=45)assert(ground);if(ground)assert(Math.hypot(ground.x-point.x,ground.y-point.y)>1,'terrain tools retain their separate ground intersection');
 }
 state.reframe(frame,45,25);
 const buried={...plane,elevationM:-20},screen=state.project(point,buried);
 assert.equal(state.workplanePoint(424+1496*screen.x,48+932*screen.y,buried),null,'foreground terrain blocks a hidden floor');
 assert.equal(state.workplanePoint(1172,514,{...plane,elevationM:1000}),null,'a floor behind the camera is not actionable');
 state.dispose();
});
test('unbound room groups use one terrain anchor plus the floor elevation',()=>{
 const plane={scopeId:'free',elevationM:4,anchor:{x:20,y:30}};
 assert.equal(atlasWorkplaneHeight(plane,{height:p=>p.x+2*p.y}),84);
 assert.equal(atlasWorkplaneHeight(plane,{scopeBases:new Map([['free',0]]),height:()=>200}),4,'a fixed zero base remains fixed');
});

test('semantic room names use the same floor anchor as geometry',()=>{
 const labels=new AtlasSpatialLabels();labels.surface={origin:{x:10,y:20},focusM:5,exaggeration:2,height:()=>100,scopeBases:new Map([['house',15]])};
 const name={point:{x:13,y:24},workplane:{scopeId:'house',elevationM:6,anchor:{x:0,y:0}}};
 assert.deepEqual(labels.anchor(name).toArray(),[3,-4,32]);
 assert.deepEqual(labels.anchor({...name,workplane:undefined}).toArray(),[3,-4,190],'ordinary map names stay attached to terrain');labels.dispose();
});
