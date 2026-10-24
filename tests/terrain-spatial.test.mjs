import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildSync} from 'esbuild';
import {createRequire} from 'node:module';
import {mkdirSync,mkdtempSync,rmSync} from 'node:fs';
import {homedir} from 'node:os';
import {randomUUID} from 'node:crypto';
const require=createRequire(import.meta.url),cache=homedir()+'/.cache/saltmarcher';mkdirSync(cache,{recursive:true});
buildSync({stdin:{contents:"export * from './src/app/spatial-terrain';export * from './src/app/terrain-height';export * from './src/app/atlas-landscape';export * from './src/app/storage/store';",resolveDir:process.cwd()},outfile:'.build/terrain-spatial-test.cjs',bundle:true,platform:'node',format:'cjs',external:['better-sqlite3']});
const {CampaignStore,heightRecord,emptyRecord,spatialTerrainSurface}=require('../.build/terrain-spatial-test.cjs');
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
