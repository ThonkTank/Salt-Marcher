import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildSync} from 'esbuild';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
buildSync({stdin:{contents:"export * from './src/app/terrain-spatial-view';export * from './src/app/terrain-ring';export * from './src/app/terrain-route-visibility';export {TerrainHexGrid} from './src/app/terrain-hex-grid';export {AtlasSpatialLabels} from './src/app/atlas-spatial-labels';export {ATLAS_CAMERA_FOV} from './src/app/atlas-camera';export * from './tools/atlas-preview-scene';export * as THREE from 'three';",resolveDir:process.cwd()},outfile:'.build/vegetation-picking-test.cjs',bundle:true,platform:'node',format:'cjs'});
const {AtlasSpatialLabels,TerrainSpatialView,TerrainRing,TerrainRouteVisibility,TerrainHexGrid,atlasPreviewScene,ATLAS_CAMERA_FOV,THREE}=require('../.build/vegetation-picking-test.cjs');
const instance=(id,asset,size,z=40)=>({id,areaId:'wood',asset,size,x:0,y:0,z,angle:0,normal:{x:0,y:0,z:1}});
function view(instances){
 const v=Object.create(TerrainSpatialView.prototype);
 Object.assign(v,{labels:new AtlasSpatialLabels(),hexGrid:new TerrainHexGrid(),camera:new THREE.PerspectiveCamera(ATLAS_CAMERA_FOV),scene:new THREE.Scene(),canvas:{clientWidth:1000,clientHeight:800,getBoundingClientRect:()=>({left:0,top:0,width:1000,height:800})},
   renderer:{setSize(){},getPixelRatio(){return 1;},getSize(v){return v.set(1000,800);},render(scene){scene.updateMatrixWorld(true);scene.traverse(o=>{if(o.isMesh)o.onBeforeRender(this);});}},routes:[],cursor:new TerrainRing('#a65f30'),selection:new TerrainRing('#e68a28'),routeVisibility:new TerrainRouteVisibility()});
 const scene={revision:1,box:{x:-100,y:-100,width:200,height:200},records:[],instances,buildings:[],grid:{columns:3,rows:3,heights:Array(9).fill(40),colors:Array(9).fill('#ffffff')}};
 v.scene.add(v.cursor.line,v.selection.line);v.setData(atlasPreviewScene(scene,0));v.fixture=scene;return v;
}
const screen=v=>{const s=v.project({x:0,y:0});return {x:s.x*1000,y:s.y*800};};
const pick=(v,p,filter='all')=>v.hitAt(p.x,p.y,[filter==='all'?'vegetationInstance':'vegetation-'+filter])?.data;
test('a type filter reaches rocks and undergrowth below a tree canopy',()=>{
 const v=view([instance('tree','oak',25),instance('rock','rock',5),instance('shrub','shrub',2)]);
 const p=screen(v);
 assert.equal(pick(v,p)?.vegetationInstance,'tree');
 assert.equal(pick(v,p,'trees')?.vegetationInstance,'tree');
 assert.equal(pick(v,p,'rocks')?.vegetationInstance,'rock');
 assert.equal(pick(v,p,'undergrowth')?.vegetationInstance,'shrub');
});
test('filtering never selects through the terrain or substitutes another type',()=>{
 const v=view([instance('tree','pine',25),instance('buried','rock',2,20)]);
 const p=screen(v);
 assert.equal(pick(v,p)?.vegetationInstance,'tree');
 assert.equal(pick(v,p,'rocks'),undefined);
 assert.equal(pick(v,p,'undergrowth'),undefined);
});
test('filtered selection retains canonical identities after view rotation and rebuild',()=>{
 const v=view([instance('rock','rock',5)]);
 for(const tilt of [0,45,65])for(const rotation of [-90,0,90]){
   v.setData(atlasPreviewScene(v.fixture,tilt,rotation,4));
   const p=screen(v);
   assert.equal(pick(v,p,'rocks')?.vegetationInstance,'rock');
   assert.equal(pick(v,p,'rocks')?.landscapeId,'wood');
 }
});

test('new vegetation details update the main scene while terrain and camera stay allocated',()=>{
 const v=view([instance('old','rock',5)]),terrain=v.mesh,camera=v.camera;
 v.setVegetation([{id:'wood',vegetationView:{mode:'individual',instances:[instance('new','rock',8)]}}]);
 assert.equal(v.mesh,terrain);assert.equal(v.camera,camera);assert.equal(pick(v,screen(v),'rocks')?.vegetationInstance,'new');
});
