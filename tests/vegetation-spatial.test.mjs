import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildSync} from 'esbuild';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
buildSync({stdin:{contents:"export * from './src/app/vegetation-spatial';export * as THREE from 'three';",resolveDir:process.cwd()},outfile:'.build/vegetation-picking-test.cjs',bundle:true,platform:'node',format:'cjs'});
const {VegetationSpatialView,THREE}=require('../.build/vegetation-picking-test.cjs');
const instance=(id,asset,size,z=40)=>({id,areaId:'wood',asset,size,x:0,y:0,z,angle:0,normal:{x:0,y:0,z:1}});
function view(instances){
 const v=Object.create(VegetationSpatialView.prototype);
 Object.assign(v,{camera:new THREE.OrthographicCamera(),scene:new THREE.Scene(),canvas:{getBoundingClientRect:()=>({width:1000,height:800})},
   renderer:{setSize(){},render(scene){scene.updateMatrixWorld(true);}},groups:[],pickers:[],tilt:0,rotation:0,exaggeration:1});
 v.setData({revision:1,box:{x:-100,y:-100,width:200,height:200},records:[],instances,buildings:[],
   grid:{columns:3,rows:3,heights:Array(9).fill(40),colors:Array(9).fill('#ffffff')}});
 return v;
}
test('a type filter reaches rocks and undergrowth below a tree canopy',()=>{
 const v=view([instance('tree','oak',25),instance('rock','rock',5),instance('shrub','shrub',2)]);
 const p=v.project({x:0,y:0});
 assert.equal(v.pick(p.x,p.y)?.id,'tree');
 assert.equal(v.pick(p.x,p.y,'trees')?.id,'tree');
 assert.equal(v.pick(p.x,p.y,'rocks')?.id,'rock');
 assert.equal(v.pick(p.x,p.y,'undergrowth')?.id,'shrub');
});
test('filtering never selects through the terrain or substitutes another type',()=>{
 const v=view([instance('tree','pine',25),instance('buried','rock',2,20)]);
 const p=v.project({x:0,y:0});
 assert.equal(v.pick(p.x,p.y)?.id,'tree');
 assert.equal(v.pick(p.x,p.y,'rocks'),undefined);
 assert.equal(v.pick(p.x,p.y,'undergrowth'),undefined);
});
test('filtered selection retains canonical identities after view rotation and rebuild',()=>{
 const v=view([instance('rock','rock',5)]);
 for(const tilt of [0,45,65])for(const rotation of [-90,0,90]){
   v.tilt=tilt;v.rotation=rotation;v.setExaggeration(4);
   const p=v.project({x:0,y:0});
   assert.equal(v.pick(p.x,p.y,'rocks')?.id,'rock');
   assert.equal(v.pick(p.x,p.y,'rocks')?.areaId,'wood');
 }
});
