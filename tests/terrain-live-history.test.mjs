import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildSync} from 'esbuild';
import {createRequire} from 'node:module';
import {mkdirSync,mkdtempSync,rmSync} from 'node:fs';
import {homedir} from 'node:os';
import {randomUUID} from 'node:crypto';
const require=createRequire(import.meta.url);
buildSync({stdin:{contents:"export * from './src/app/terrain-live-stroke';export * from './src/app/storage/store';export * from './src/app/landscape-brush';",resolveDir:process.cwd()},outfile:'.build/terrain-live-history-test.cjs',bundle:true,platform:'node',format:'cjs',external:['better-sqlite3']});
const {TerrainLiveStroke,CampaignStore,brushFootprint}=require('../.build/terrain-live-history-test.cjs');
function setup(t){
 const base=homedir()+'/.cache/saltmarcher/tests';mkdirSync(base,{recursive:true});const dir=mkdtempSync(base+'/live-terrain-');let store=new CampaignStore(dir+'/world.sqlite');const cam=store.create('Live terrain');let token=store.activate(cam.id).token;
 t.after(()=>{store.close();rmSync(dir,{recursive:true,force:true});});
 const write=(action,group)=>{const source=store.atlasRegionSource(token);const command={commandId:randomUUID(),campaignId:cam.id,token,sourceFence:source.fence,action,...(group?{terrainStroke:{id:group,expectedRevision:source.revision}}:{})};return{command,ack:store.executeAtlasCommit(command)};};
 return{get store(){return store;},get token(){return token;},cam,write,height:(x=0)=>store.atlasHeight(token,{x,y:0}).heightM,cursor:()=>store.db.prepare('SELECT cursor FROM campaign_atlas WHERE campaign_id=?').get(cam.id).cursor,
  reopen(){store.close();store=new CampaignStore(dir+'/world.sqlite');token=store.activate(cam.id).token;}};
}
const height=(mode='raise',x=0)=>({kind:'landscape-height-stroke',stroke:{mode,radius:16,strength:100,feather:0,samples:[{x,y:0,t:0},{x,y:0,t:500}]}});
test('each live increment is persisted immediately; one undo/redo covers the complete gesture after restart',t=>{
 const f=setup(t),group=randomUUID(),start=f.height(),cursor=f.cursor();
 for(let i=1;i<=4;i++){const {ack}=f.write(height(),group);assert(Math.abs(f.height()-(start+50*i))<1e-6);assert.equal(ack.sourceFence,f.store.atlasRegionSource(f.token).fence);assert.equal(f.cursor(),cursor+1);}
 f.reopen();assert.equal(f.height(),start+200);f.write({kind:'undo'});assert.equal(f.height(),start);f.write({kind:'redo'});assert.equal(f.height(),start+200);
 const second=randomUUID();f.write(height(),second);assert.equal(f.cursor(),cursor+2);f.write({kind:'undo'});assert.equal(f.height(),start+200);
});
test('a failed later increment rolls back only that increment and retains a single undo for the saved prefix',t=>{
 const f=setup(t),group=randomUUID(),start=f.height();f.write(height(),group);const count=f.cursor();
 f.store.db.exec("CREATE TEMP TRIGGER fail_live BEFORE UPDATE ON atlas_landscape BEGIN SELECT RAISE(ABORT,'live failure'); END");
 assert.throws(()=>f.write(height(),group),/live failure/);assert.equal(f.height(),start+50);assert.equal(f.cursor(),count);
 f.store.db.exec('DROP TRIGGER fail_live');f.write({kind:'undo'});assert.equal(f.height(),start);f.write({kind:'redo'});assert.equal(f.height(),start+50);
});
test('idempotent receipts never repeat a delta and include the terrain grouping identity',t=>{
 const f=setup(t),group=randomUUID(),first=f.write(height(),group),after=f.height();f.store.executeAtlasCommit(first.command);assert.equal(f.height(),after);
 assert.throws(()=>f.store.executeAtlasCommit({...first.command,terrainStroke:{...first.command.terrainStroke,id:randomUUID()}}),/Kennung|kennung/);assert.equal(f.height(),after);
 f.write(height(),group);f.store.executeAtlasCommit(first.command);assert(Math.abs(f.height()-(after+50))<1e-6);f.write({kind:'undo'});assert.equal(f.height(),-100);
});
test('an intervening edit, undo branch, stale revision and tool-family change cannot be folded into an old gesture',t=>{
 const f=setup(t),group=randomUUID();const first=f.write(height(),group);f.write(height('lower',64));
 assert.throws(()=>f.write(height(),group),/abgeschlossen/);f.write({kind:'undo'});assert.throws(()=>f.write(height(),group),/abgeschlossen/);
 const source=f.store.atlasRegionSource(f.token);assert.throws(()=>f.store.executeAtlasCommit({...first.command,commandId:randomUUID(),sourceFence:source.fence}),/inzwischen/);
 assert.throws(()=>f.write({kind:'landscape-sea-level',seaLevelM:5},randomUUID()),/Geländezug/);
});
test('no-op first increments do not consume an undo slot; later effects still form one gesture',t=>{
 const f=setup(t),group=randomUUID(),a=height();a.stroke.samples=[a.stroke.samples[0]];const count=f.cursor();f.write(a,group);assert.equal(f.cursor(),count);f.write(height(),group);f.write(height(),group);assert.equal(f.cursor(),count+1);f.write({kind:'undo'});assert.equal(f.height(),-100);
});
test('direct colour increments are canonical writes and undo as one gesture without changing heights',t=>{
 const f=setup(t);f.write({...height(),stroke:{...height().stroke,strength:400}});const group=randomUUID(),start=f.height(),count=f.cursor();
 for(const x of [0,10]){const record={id:group,revision:0,kind:'patch',name:'',width:0,resolution:1,points:[{x:0,y:0},{x,y:0}],polygons:brushFootprint([{x:0,y:0},{x,y:0}],3),values:{},paint:{version:2,target:'ground',operation:'paint',color:'#cc3300',opacity:.5,flow:1,tip:'round',radius:3,seed:1,fill:false}};f.write({kind:'landscape-color-stroke',record},group);}
 assert.equal(f.height(),start);assert.equal(f.cursor(),count+1);const persisted=JSON.parse(f.store.db.prepare('SELECT payload FROM atlas_landscape WHERE id=?').get(group).payload);assert.equal(persisted.paint.opacity,.5);assert.equal(persisted.points.at(-1).x,10);const colors=()=>f.store.db.prepare("SELECT count(*) n FROM atlas_landscape WHERE json_extract(payload,'$.paint') IS NOT NULL").get().n;assert.equal(colors(),1);f.write({kind:'undo'});assert.equal(colors(),0);assert.equal(f.height(),start);f.write({kind:'redo'});assert.equal(colors(),1);
});
test('smoothing uses one persisted history entry across increments and undo restores the original height',t=>{
 const f=setup(t);f.write(height());const start=f.height(),count=f.cursor(),group=randomUUID();for(let i=0;i<3;i++)f.write(height('smooth'),group);assert(f.height()<=start);assert.equal(f.cursor(),count+1);f.write({kind:'undo'});assert.equal(f.height(),start);
});
test('the live writer feeds zero-based incremental durations into the real storage boundary',async t=>{
 const f=setup(t),initial=f.height(),source=f.store.atlasRegionSource(f.token),group=randomUUID(),errors=[];
 const live=new TerrainLiveStroke({id:group,expectedRevision:source.revision,sourceFence:source.fence},async(action,context)=>f.store.executeAtlasCommit({commandId:randomUUID(),campaignId:f.cam.id,token:f.token,sourceFence:context.sourceFence,terrainStroke:{id:context.id,expectedRevision:context.expectedRevision},action}),e=>errors.push(e));
 for(let n=2;n<=4;n++){const a=height();a.stroke.samples=Array.from({length:n},(_,i)=>({x:0,y:0,t:i*100}));live.update(a);await new Promise(setImmediate);}
 await live.finish();assert.deepEqual(errors,[]);assert(Math.abs(f.height()-(initial+30))<1e-5);f.write({kind:'undo'});assert.equal(f.height(),initial);
});
