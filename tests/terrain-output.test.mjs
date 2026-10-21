import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildSync} from 'esbuild';
import {createRequire} from 'node:module';
import {mkdtempSync,mkdirSync,rmSync} from 'node:fs';
import {homedir} from 'node:os';
import {randomUUID,createHash} from 'node:crypto';
import * as THREE from 'three';
const require=createRequire(import.meta.url);
buildSync({stdin:{contents:"export * from './src/app/terrain-image';export * from './src/app/terrain-spatial-view';export * from './src/app/terrain-spatial-model';export * from './src/app/terrain-height';export * from './src/app/storage/store';",resolveDir:process.cwd()},outfile:'.build/terrain-output-test.cjs',bundle:true,platform:'node',format:'cjs',external:['better-sqlite3']});
const {prepareTerrainImage,publicTerrainGrid,TerrainSpatialView,projectTerrain,heightRecord,CampaignStore}=require('../.build/terrain-output-test.cjs');
const view={box:{x:0,y:0,width:15000,height:10000},frame:{x:0,y:0,width:15000,height:10000},columns:31,rows:21,focusM:0,tilt:45,rotation:0,exaggeration:2};
test('player height exports retain approved memories and never fill unknown or legacy cells from current GM terrain',t=>{
 const base=homedir()+'/.cache/saltmarcher/tests';mkdirSync(base,{recursive:true});const dir=mkdtempSync(base+'/r7-public-'),store=new CampaignStore(dir+'/world.sqlite'),cam=store.create('Public'),token=store.activate(cam.id).token;
 t.after(()=>{store.close();rmSync(dir,{recursive:true,force:true});});
 const command=action=>({commandId:randomUUID(),campaignId:cam.id,token,action});
 const character=store.executeLive(command({kind:'create-character',profile:{name:'Ada'}})).character,scene=store.executeLive(command({kind:'initialize',expectedRosterRevision:1})).scene;
 store.executeLive(command({kind:'membership',characterId:character.id,expectedRevision:0,expectedRosterRevision:1,active:true,targetSceneId:scene.id,expectedFocusRevision:0}));
 const map=store.world(token).maps[0];
 const height=n=>heightRecord(0,0,1024,new Float32Array(4096).fill(n));
 store.executeAtlasCommit(command({kind:'landscape-put',record:height(100),expectedRevision:null}));
 store.executeWorld(command({kind:'place-scene',sceneId:scene.id,position:{mapId:map.id,q:0,r:0,locationId:null,dungeon:null},expectedSceneRevision:0,expectedPositionRevision:0}));
 const player=action=>{const v=store.playerView(token);return store.executePlayer({...command(action),expectedRevision:v.settings.revision,expectedFocusId:v.focusId,expectedFocusRevision:v.focusRevision,expectedFocusMembershipRevision:v.focusMembershipRevision,expectedFocusLocationId:v.focusLocationId});};
 player({kind:'settings',settings:{blank:false,mode:'follow',imageId:null,title:'',labels:false,light:'daylight',displayId:null,fullscreen:false}});
 player({kind:'observer',observer:{characterId:character.id,enabled:false,rangeMeters:100,darkvisionMeters:0,eyeHeightMeters:1.7}});
 player({kind:'discover',characterIds:[character.id],mapId:map.id,q:1,r:0,locationId:null,publicLabel:'Pass'});
 const before=store.playerView(token).frame;assert.equal(before.map.cells.find(c=>c.q===1&&c.r===0).elevationM,100);
 store.executeAtlasCommit(command({kind:'landscape-put',record:height(8888),expectedRevision:1}));
 const after=store.playerView(token).frame;assert.deepEqual(after,before);assert.deepEqual(publicTerrainGrid(after,view),publicTerrainGrid(before,view));assert.equal(Math.max(...publicTerrainGrid(after,view).heights),100);
 // Old knowledge has no elevation. Reading/exporting it must not upgrade its information.
 const row=store.db.prepare('SELECT * FROM player_hex_memory WHERE campaign_id=? AND q=1 AND r=0').get(cam.id),memory=JSON.parse(row.payload);delete memory.elevationM;const payload=JSON.stringify(memory);store.db.prepare('UPDATE player_hex_memory SET payload=?,checksum=? WHERE campaign_id=? AND q=1 AND r=0').run(payload,createHash('sha256').update(payload).digest('hex'),cam.id);
 const bytes=store.db.serialize(),legacy=store.playerView(token).frame;assert.equal(legacy.map.cells.find(c=>c.q===1&&c.r===0).elevationM,undefined);assert(publicTerrainGrid({...legacy,map:{...legacy.map,cells:legacy.map.cells.filter(c=>c.q===1&&c.r===0)}},view).heights.every(z=>z===0));assert(store.db.serialize().equals(bytes));
 player({kind:'mask',mapId:map.id,q:1,r:0,hidden:true,blocksSight:false,publicLabel:''});assert(!store.playerView(token).frame.map.cells.some(c=>c.q===1&&c.r===0));
});
// Perspective retained-camera and output-tile invariants live in terrain-spatial-picking.test.mjs.

test('cancelled, obsolete and failed output jobs release their worker without publishing pixels',async t=>{
 const previousWorker=globalThis.Worker,previousDocument=globalThis.document,workers=[];
 globalThis.document={baseURI:'https://fixture.invalid/'};
 globalThis.Worker=class {constructor(){workers.push(this);}postMessage(job){this.job=job;}terminate(){this.terminated=true;}};
 t.after(()=>{if(previousWorker===undefined)delete globalThis.Worker;else globalThis.Worker=previousWorker;if(previousDocument===undefined)delete globalThis.document;else globalThis.document=previousDocument;});
 await assert.rejects(prepareTerrainImage({},()=>false),/abgebrochen/);assert.equal(workers.length,0);
 let current=true;const pending=prepareTerrainImage({},()=>current);current=false;workers[0].onmessage({data:{pixels:new Uint8Array([1])}});
 await assert.rejects(pending,/abgebrochen/);assert.equal(workers[0].terminated,true);
 const failed=prepareTerrainImage({},()=>true);workers[1].onerror();await assert.rejects(failed,/vorbereitet/);assert.equal(workers[1].terminated,true);
 current=true;const interrupted=prepareTerrainImage({},()=>current);current=false;await assert.rejects(interrupted,/abgebrochen/);assert.equal(workers[2].terminated,true);
});
