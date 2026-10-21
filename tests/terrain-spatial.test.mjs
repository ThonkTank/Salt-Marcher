import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildSync} from 'esbuild';
import {createRequire} from 'node:module';
import {mkdirSync,mkdtempSync,rmSync} from 'node:fs';
import {homedir} from 'node:os';
import {randomUUID} from 'node:crypto';
const require=createRequire(import.meta.url),cache=homedir()+'/.cache/saltmarcher';mkdirSync(cache,{recursive:true});
buildSync({stdin:{contents:"export * from './src/app/spatial-terrain';export * from './src/app/terrain-spatial-view';export {ATLAS_CAMERA_FOV} from './src/app/atlas-camera';export * from './tools/atlas-preview-scene';export * from './src/app/terrain-height';export * from './src/app/atlas-landscape';export * from './src/app/storage/store';export * as THREE from 'three';",resolveDir:process.cwd()},outfile:'.build/terrain-spatial-test.cjs',bundle:true,platform:'node',format:'cjs',external:['better-sqlite3']});
const {CampaignStore,heightRecord,emptyRecord,spatialTerrainSurface,TerrainSpatialView,atlasPreviewScene,ATLAS_CAMERA_FOV,THREE}=require('../.build/terrain-spatial-test.cjs');
const box={x:-128,y:-128,width:256,height:256};
function setup(t){const dir=mkdtempSync(cache+'/r5-data-'),store=new CampaignStore(dir+'/world.sqlite'),cam=store.create('R5'),w=store.activate(cam.id);t.after(()=>{store.close();rmSync(dir,{recursive:true,force:true});});
 const write=action=>store.executeAtlasCommit({commandId:randomUUID(),campaignId:cam.id,token:w.token,action});
 for(let y=-1;y<=0;y++)for(let x=-1;x<=0;x++)write({kind:'landscape-put',expectedRevision:null,record:heightRecord(x*256,y*256,4,new Float32Array(4096).fill(60))});
 return{store,token:w.token,write,scene:draft=>store.atlasSpatialScene(w.token,box,1,draft)};
}
const brush=mode=>({kind:'landscape-height-stroke',stroke:{mode,radius:48,strength:160,feather:.8,roughness:0,seed:88,samples:[{x:0,y:0,t:0},{x:0,y:0,t:1000}]}});
test('spatial height preview is readonly and matches canonical save, coast, undo and redo',t=>{
 const f=setup(t),initial=f.scene(),fence=initial.fence,draft=brush('lower'),preview=f.scene(draft);
 assert.equal(f.store.atlasHeight(f.token,{x:0,y:0}).heightM,60);assert.equal(f.scene().fence,fence);assert.notDeepEqual(preview.texture.pixels,initial.texture.pixels);
 f.write(draft);const saved=f.scene();assert.deepEqual(saved.grid,preview.grid);assert.deepEqual(saved.texture,preview.texture);assert(f.store.atlasHeight(f.token,{x:0,y:0}).water);
 f.write({kind:'undo'});assert.deepEqual(f.scene().grid,initial.grid);f.write({kind:'redo'});assert.deepEqual(f.scene().grid,saved.grid);
 assert.throws(()=>f.store.atlasSpatialScene(f.token,box,1,draft,fence),/inzwischen/);
});
test('same smoothing and color commands serve both views without rewriting heights',t=>{
 const f=setup(t);f.write(brush('raise'));const draft=brush('smooth'),preview=f.scene(draft);f.write(draft);assert.deepEqual(f.scene().grid,preview.grid);
 const r=emptyRecord('patch');r.points=[{x:0,y:0}];r.polygons=[{outer:[{x:-40,y:-40},{x:40,y:-40},{x:40,y:40},{x:-40,y:40}],holes:[]}];r.resolution=1;r.paint={version:2,target:'ground',operation:'paint',color:'#be573c',opacity:1,flow:1,tip:'round',radius:40,seed:7,fill:false};
 const before=f.scene(),color={kind:'landscape-color-stroke',record:r},painted=f.scene(color);f.write(color);assert.deepEqual(f.scene().texture,painted.texture);assert.deepEqual(f.scene().grid,before.grid);assert.notDeepEqual(painted.texture,before.texture);
 const erase=structuredClone(color);erase.record.id=randomUUID();erase.record.paint.operation='erase';const erased=f.scene(erase);f.write(erase);assert.deepEqual(f.scene().texture,erased.texture);
});
test('rejected writes keep the same replayable draft and no partial height changes',t=>{
 const f=setup(t),draft=brush('lower'),before=f.scene();f.store.db.exec("CREATE TEMP TRIGGER fail_spatial BEFORE INSERT ON atlas_landscape BEGIN SELECT RAISE(ABORT,'R5 write failure'); END");
 assert.throws(()=>f.write(draft),/R5 write failure/);assert.deepEqual(f.scene().grid,before.grid);f.store.db.exec('DROP TRIGGER fail_spatial');const preview=f.scene(draft);f.write(draft);assert.deepEqual(f.scene().grid,preview.grid);
});
test('display tessellation follows source resolution and camera scale with a strict cap',()=>{
 const fine=[heightRecord(0,0,.25,new Float32Array(4096).fill(60))],coarse=[heightRecord(0,0,128,new Float32Array(4096).fill(60))];
 const small={x:0,y:0,width:16,height:16};assert(spatialTerrainSurface(fine,small,.01).grid.columns>spatialTerrainSurface(coarse,small,1).grid.columns);
 assert(spatialTerrainSurface(fine,{x:0,y:0,width:1000,height:1000},.01).grid.columns<=257);
});
function mockView(scene){const view=Object.create(TerrainSpatialView.prototype);Object.assign(view,{camera:new THREE.PerspectiveCamera(ATLAS_CAMERA_FOV),scene:new THREE.Scene(),canvas:{clientWidth:1000,clientHeight:800,getBoundingClientRect:()=>({left:0,top:0,width:1000,height:800})},renderer:{getPixelRatio(){return 1;},setSize(){},render(scene){scene.updateMatrixWorld(true);}},routes:[]});view.setData(atlasPreviewScene(scene));return view;}
const screen=(view,p)=>{const s=view.project(p);return {x:s.x*1000,y:s.y*800};};
function flatScene(x=0,y=0){return{revision:1,box:{x:x-200,y:y-200,width:400,height:400},records:[],instances:[],buildings:[],grid:{columns:5,rows:5,heights:Array(25).fill(60),colors:Array(25).fill('#ffffff')}};}
test('projected world hits survive tilt, rotation, exaggeration and very distant coordinates',()=>{
 for(const offset of [0,1e10]){const view=mockView(flatScene(offset,-offset));for(const tilt of [0,45,65])for(const rotation of [-120,0,90])for(const exaggeration of [.25,1,8]){view.setData(atlasPreviewScene(flatScene(offset,-offset),tilt,rotation,exaggeration));const p={x:offset+30,y:-offset+20},at=screen(view,p),hit=view.hit(at.x,at.y);assert(hit);assert(Math.hypot(p.x-hit.x,p.y-hit.y)<.001);}}
});
test('terrain raycast returns the front surface instead of a hidden far slope',()=>{
 const scene=flatScene();for(let x=0;x<5;x++)scene.grid.heights[3*5+x]=220;const view=mockView(scene);view.reframe(scene.box,65,0);const p={x:0,y:-100},at=screen(view,p),hit=view.hit(at.x,at.y);assert(hit);assert(hit.y>p.y+50,'the foreground ridge occludes the far point');
});

test('displayed road selection resolves the same canonical atlas record',()=>{
 const scene=flatScene();scene.records=[{...emptyRecord('road'),id:'road',points:[{x:-150,y:0},{x:150,y:0}],width:12}];const view=mockView(scene);const point=screen(view,{x:0,y:0});assert.equal(view.hitAt(point.x,point.y,['landscapeId'])?.data.landscapeId,'road');
});
