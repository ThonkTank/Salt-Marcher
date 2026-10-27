import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildSync} from 'esbuild';
import {createRequire} from 'node:module';
import {mkdirSync,mkdtempSync,rmSync} from 'node:fs';
import {homedir} from 'node:os';
import {randomUUID} from 'node:crypto';
import path from 'node:path';
const require=createRequire(import.meta.url);
buildSync({stdin:{contents:"export * from './src/app/storage/store';export * from './src/app/terrain-height';export * from './desktop/atlas-region';export * from './src/app/terrain-author-state';export * from './src/app/terrain-author-checkpoint';export {atlasCommandFingerprint} from './src/app/storage/campaign-atlas';",resolveDir:process.cwd()},outfile:'.build/terrain-scale-worker-test.cjs',bundle:true,platform:'node',format:'cjs',external:['better-sqlite3']});
buildSync({entryPoints:['desktop/atlas-region-worker.ts'],outfile:'.build/terrain-scale-reader.cjs',bundle:true,platform:'node',format:'cjs',external:['better-sqlite3']});
const {CampaignStore,AtlasRegionService,heightRecord,decodeHeights,TerrainSampler,TerrainAuthorState,terrainAuthorWindow,decodeTerrainAuthorCheckpoint,atlasCommandFingerprint}=require('../.build/terrain-scale-worker-test.cjs');
async function fixture(t){
 const base=homedir()+'/.cache/saltmarcher/tests';mkdirSync(base,{recursive:true});const dir=mkdtempSync(base+'/scale-worker-'),store=new CampaignStore(dir+'/world.sqlite'),cam=store.create('Worker'),token=store.activateShell(cam.id).token,service=new AtlasRegionService(path.resolve('.build/terrain-scale-reader.cjs'));
 t.after(async()=>{await service.close();store.close();rmSync(dir,{recursive:true,force:true});});
 const action={kind:'landscape-height-stroke',stroke:{mode:'raise',radius:2500*1609.344,strength:100,feather:0,samples:[{x:0,y:0,t:0},{x:0,y:0,t:100}]}};
 const command=()=>({token,campaignId:cam.id,commandId:randomUUID(),action});
 return{store,service,command,token,cam};
}
test('readonly worker prepares the real large brush; the canonical Store alone writes and replays the receipt',async t=>{
 const f=await fixture(t),c=f.command(),source=f.store.terrainStrokeSource(c,f.service.cursor);
 let ticks=0;const timer=setInterval(()=>ticks++,1);
 const prepared=await f.service.prepareTerrainStroke(source,c.action.stroke);clearInterval(timer);
 assert(ticks>0);assert(prepared.records.length>0&&prepared.records.length<=16);assert(prepared.records.every(r=>r.height.version===2));
 assert.equal(f.store.db.prepare('SELECT count(*) n FROM atlas_landscape').get().n,0);
 f.store.executeAtlasCommit(c,prepared);assert.equal(f.store.atlasHeight(f.token,{x:0,y:0}).heightM,-90);
 assert.equal(f.store.terrainStrokeSource(c,f.service.cursor),undefined);
 const revision=f.store.atlasRegionSource(f.token).revision;f.store.executeAtlasCommit(c);assert.equal(f.store.atlasRegionSource(f.token).revision,revision);
 assert.equal(f.service.diagnostics.workerStarts,1);
});
test('intervening writes reject computed patches; worker survives and accepts a new source',async t=>{
 const f=await fixture(t),c=f.command(),source=f.store.terrainStrokeSource(c,f.service.cursor),prepared=await f.service.prepareTerrainStroke(source,c.action.stroke);
 f.store.executeAtlasCommit(f.command());const before=f.store.db.prepare('SELECT payload FROM atlas_landscape ORDER BY id').all();
 assert.throws(()=>f.store.executeAtlasCommit(c,prepared),/inzwischen/);assert.deepEqual(f.store.db.prepare('SELECT payload FROM atlas_landscape ORDER BY id').all(),before);
 const next=f.command(),fresh=f.store.terrainStrokeSource(next,f.service.cursor),patch=await f.service.prepareTerrainStroke(fresh,next.action.stroke);f.store.executeAtlasCommit(next,patch);assert.equal(f.store.atlasHeight(f.token,{x:0,y:0}).heightM,-80);
});
test('worker target/smoothing share the filtered legacy source across edits and undo',async t=>{
 const f=await fixture(t);
 for(let y=-1;y<=0;y++)for(let x=-1;x<=0;x++)f.store.executeAtlasCommit({...f.command(),action:{kind:'landscape-put',record:heightRecord(x*64,y*64,1,Float32Array.from({length:4096},(_,i)=>100+Math.cos(i%64)*20)),expectedRevision:null}});
 for(const mode of ['level','smooth','raise','smooth']){
  const c=f.command();c.action={...c.action,stroke:{...c.action.stroke,mode,radius:64,...(mode==='level'?{targetM:250}:{} )}};
  const s=f.store.terrainStrokeSource(c,f.service.cursor),p=await f.service.prepareTerrainStroke(s,c.action.stroke);f.store.executeAtlasCommit(c,p);
 }
 const before=f.store.atlasHeight(f.token,{x:0,y:0}).heightM;assert(Number.isFinite(before));assert(before>120);
 f.store.executeAtlasCommit({...f.command(),action:{kind:'undo'}});
 const c=f.command(),s=f.store.terrainStrokeSource(c,f.service.cursor),p=await f.service.prepareTerrainStroke(s,c.action.stroke);f.store.executeAtlasCommit(c,p);assert(Number.isFinite(f.store.atlasHeight(f.token,{x:0,y:0}).heightM));
});
test('scale preparation yields to queued selection work and cancellation never authors a partial result',async t=>{
 const f=await fixture(t),c=f.command();c.action.stroke.mode='smooth';c.action.stroke.radius=64;
 const source=f.store.terrainStrokeSource(c,f.service.cursor),order=[];
 const author=f.service.prepareTerrainStroke(source,c.action.stroke).then(v=>{order.push('author');return v;});
 const selection=f.service.focus(source,'scope','missing').then(()=>order.push('selection'),()=>order.push('selection'));
 await Promise.all([author,selection]);assert.deepEqual(order,['selection','author']);assert.equal(f.store.db.prepare('SELECT count(*) n FROM atlas_landscape').get().n,0);
 const next=f.service.prepareTerrainStroke(source,{...c.action.stroke,radius:128});const rejected=assert.rejects(next,/abgebrochen|beendet/);await f.service.cancelAndWait();await rejected;assert.equal(f.service.diagnostics.active,false);assert.equal(f.store.db.prepare('SELECT count(*) n FROM atlas_landscape').get().n,0);
});


const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};};
const lattice={id:0,x:-128,y:-128,dx:(96*512+256)/64,dy:4};
const gesture=i=>{const x=i<=2?0:i*512;return{mode:i===2?'lower':[17,53].includes(i)?'smooth':[18,54].includes(i)?'level':'raise',radius:i%3===0?64:32,strength:i===1?16:i===2?4:8,feather:0,...([18,54].includes(i)?{targetM:250}:{}),samples:[{x,y:0,t:0},{x,y:0,t:125}]};};
async function productAuthor(t,{unknown=false,lattices=[lattice]}={}){
 const f=await fixture(t),firstGate=deferred(),started=deferred(),unknownGate=deferred(),unknownReached=deferred(),writes=[],commands=new Map(),reads=[],checkpoints=[];
 for(const y of[-64,0])for(const x of[-64,0]){const a=new Float32Array(4096).fill(999999.5);if(x===-64&&y===-64)a[0]=NaN;f.store.executeAtlasCommit({...f.command(),action:{kind:'landscape-put',record:heightRecord(x,y,1,a,2),expectedRevision:null}});}
 // Nonempty curved sources under both held Smooth/Level pairs. Main still
 // uses its precise filtered pyramid, local author uses declared ground approximation.
 for(const i of[17,18,53,54])for(const y of[-64,0])for(const x of[-64,0])f.store.executeAtlasCommit({...f.command(),action:{kind:'landscape-put',record:heightRecord(i*512+x,y,1,Float32Array.from({length:4096},(_,k)=>100+20*Math.cos((k%64)/5))),expectedRevision:null}});
 const source=f.store.atlasRegionSource(f.token),o=new TerrainAuthorState({owner:f.cam.id,series:1,source:{token:f.token,fence:source.fence,revision:source.revision},lattices,
  read:async q=>{const s=f.store.atlasRegionSource(f.token,f.service.cursor);assert.equal(s.fence,q.fence);const packet=await f.service.authorCheckpoint(s,q);decodeTerrainAuthorCheckpoint(packet,q);reads.push({prefix:q.prefix,pages:packet.pages.length,active:o.active?.id});return packet;},
  write:async(a,c)=>{started.resolve();if(!writes.length)await firstGate.promise;const command={...f.command(),action:a,sourceFence:c.sourceFence,terrainStroke:{id:c.id,expectedRevision:c.expectedRevision}},s=f.store.terrainStrokeSource(command,f.service.cursor),prepared=await f.service.prepareTerrainStroke(s,a.stroke),n=writes.length+1;
   assert.equal(o.snapshot.prefix,n-1,'complete owner checkpoint before next actual write');const ack=f.store.executeAtlasCommit(command,prepared);commands.set(n,command);writes.push(n);if(unknown&&n===48){unknownReached.resolve();await unknownGate.promise;}return{ack,receipt:{commandId:command.commandId,fingerprint:atlasCommandFingerprint(command)}};}
 });
 const close=i=>{o.begin('gesture-'+i,gesture(i));const done=o.close('gesture-'+i);done.catch(()=>{});return done;};
 return{...f,o,close,firstGate,started,unknownGate,unknownReached,writes,commands,reads,checkpoints};
}
test('productive author owns96 exact writes/checkpoints, keeps active33 identity and restores Escape97 without a screen',async t=>{
 const f=await productAuthor(t),first=Array.from({length:32},(_,i)=>f.close(i+1));await f.started.promise;assert.equal(f.o.journal.size,32);f.o.begin('gesture-33',gesture(33));const capture=f.o.active;f.firstGate.resolve();await first[0];assert.equal(f.o.active,capture);assert.equal(f.o.snapshot.active,capture);assert.equal(f.o.snapshot.prefix,1);f.o.update('gesture-33',{...gesture(33),samples:[{x:33*512,y:0,t:0},{x:33*512,y:0,t:250}]});const third=f.o.close('gesture-33');await Promise.all([...first,third]);
 await f.close(34);for(let i=35;i<=96;i+=2)await Promise.all([f.close(i),f.close(i+1)]);await f.o.queue.finish();assert.equal(f.writes.length,96);assert.equal(f.o.journal.prefix,96);assert.equal(f.o.journal.size,0);assert.equal(f.o.snapshot.prefix,96);assert.equal(f.o.snapshot.bands.length,0);assert.equal(f.o.snapshot.suffix.length,0);assert.equal(f.o.snapshot.active,null);assert.equal(f.service.diagnostics.workerStarts,1);
 const before=f.o.snapshot.ground.map(g=>g.values.slice()),basisBefore=structuredClone(f.o.snapshot.basis);f.o.begin('gesture-97',gesture(97));await f.o.refresh();assert.equal(f.o.snapshot.active.id,'gesture-97');assert(f.o.snapshot.bands.some(p=>p.values.some(v=>Number.isFinite(v)&&v!==0)));await f.o.escape('gesture-97');assert.equal(f.o.active,null);assert.equal(f.o.snapshot.active,null);assert.deepEqual(f.o.snapshot.ground.map(g=>g.values),before);assert.deepEqual(f.o.snapshot.basis,basisBefore,'Escape restores prior bandbasis as well as ground');assert.equal(f.writes.length,96);
 for(const i of[17,18,53,54])assert(f.commands.get(i).action.stroke.mode==='smooth'||f.commands.get(i).action.stroke.mode==='level');
});
test('productive Unknown48 retains accepted49 across queue replacement; exact receipt read never repeats the write',async t=>{
 const f=await productAuthor(t,{unknown:true});const p=f.close(1);f.firstGate.resolve();await p;for(let i=2;i<=47;i++)await f.close(i);const a=f.close(48);await f.unknownReached.promise;const b=f.close(49),saved=f.o.journal.entries[1],all=Promise.allSettled([a,b]);f.unknownGate.reject(Error('lost actual48 receipt response'));assert((await all).every(x=>x.status==='rejected'));assert.equal(f.writes.length,48);assert.equal(f.o.journal.prefix,47);assert.equal(f.o.journal.entries[1],saved);assert.equal(saved.id,'gesture-49');
 const {TerrainStrokeQueue}=await import('data:text/javascript;base64,'+Buffer.from(buildSync({entryPoints:['src/app/terrain-stroke-queue.ts'],bundle:true,write:false,platform:'node',format:'esm'}).outputFiles[0].text).toString('base64'));
 const replacement=new TerrainStrokeQueue(f.o.queue.confirmedSource,()=>{throw Error('no retry');},()=>{},f.o.journal);await assert.rejects(replacement.enqueue(saved.action,'new'),/lost/);const before=f.store.db.prepare('SELECT count(*) n FROM atlas_receipt').get().n,outcome=f.store.reconcileAtlasCommit(f.commands.get(48));assert.equal(outcome.outcome,'applied');assert.equal(outcome.ack.sourceFence,undefined);assert.equal(f.store.db.prepare('SELECT count(*) n FROM atlas_receipt').get().n,before);assert.equal(f.o.journal.entries[1],saved);assert.equal(f.o.snapshot.prefix,47);
});
test('projected checkpoint matches canonical height sources without materializing record metadata',async t=>{
 const f=await fixture(t),records=[];for(const y of[-64,0])for(const x of[-64,0]){const r=heightRecord(x,y,1,Float32Array.from({length:4096},(_,i)=>i===0?NaN:100+Math.cos(i/7)),2);records.push(r);f.store.executeAtlasCommit({...f.command(),action:{kind:'landscape-put',record:r,expectedRevision:null}});}
 f.store.db.prepare("UPDATE atlas_landscape SET payload=json_set(payload,'$.name',?)").run('unneeded metadata'.repeat(50000));const source=f.store.atlasRegionSource(f.token,f.service.cursor),q={owner:'projection',series:1,request:1,prefix:0,token:f.token,fence:source.fence,revision:source.revision,pixel:1,box:{x:-10,y:-10,width:20,height:20},lattices:[{id:0,x:-16,y:-16,dx:.5,dy:.5}]};
 const packet=decodeTerrainAuthorCheckpoint(await f.service.authorCheckpoint(source,q),q),sampler=new TerrainSampler(records,false);for(let y=0;y<65;y++)for(let x=0;x<65;x++)assert.equal(packet.ground[0].values[y*65+x],sampler.sample({x:-16+x*.5,y:-16+y*.5}).heightM);assert(!JSON.stringify(packet).includes('unneeded metadata'));assert(packet.pages.some(p=>p.values.some(Number.isNaN)));
});
test('checkpoint rejects invalid numerical fields,33 lattices and a257-page box before worker/allocation',async t=>{
 const f=await fixture(t),source=f.store.atlasRegionSource(f.token),q={owner:'gate',series:1,request:0,prefix:0,token:f.token,fence:source.fence,revision:source.revision,pixel:1,box:{x:0,y:0,width:1,height:1},lattices:[{id:0,x:0,y:0,dx:1,dy:1}]};
 for(const bad of[{...q,pixel:NaN},{...q,lattices:Array.from({length:33},(_,id)=>({id,x:0,y:0,dx:1,dy:1}))},{...q,box:{x:0,y:0,width:256*64,height:0}},{...q,lattices:[{id:0,x:0,y:0,dx:Infinity,dy:1}]}])assert.throws(()=>f.service.authorCheckpoint(source,bad),/prüfen/);assert.equal(f.service.diagnostics.workerStarts,0);
 const thirtyTwo={...q,lattices:Array.from({length:32},(_,id)=>({id,x:0,y:0,dx:1,dy:1}))};assert(terrainAuthorWindow(thirtyTwo).bytes<40*1024*1024);assert.equal((await f.service.authorCheckpoint(source,thirtyTwo)).ground.length,32);
});

test('real author Smooth and Level change nonempty checkpoint ground and keep the canonical write exact',async t=>{
 const lattices=[17,18].map((n,id)=>({id,x:n*512-64,y:-64,dx:2,dy:2})),f=await productAuthor(t,{lattices});
 for(const i of[17,18]){
  f.o.begin('nonempty-'+i,gesture(i));await f.o.refresh();assert(f.o.snapshot.ground.some(g=>g.values.some(v=>v>50)),'nonempty sampled source');assert(f.o.snapshot.bands.some(p=>p.values.some(v=>Number.isFinite(v)&&Math.abs(v)>0)),'nonzero local Smooth/Level effect');assert(f.o.snapshot.ground.every(g=>g.values.every(v=>Number.isFinite(v)&&Math.abs(v)<=116e6)));
  const done=f.o.close('nonempty-'+i);f.firstGate.resolve();await done;assert.equal(f.o.snapshot.bands.length,0);assert.equal(f.o.snapshot.prefix,i===17?1:2);
 }
 assert.equal(f.writes.length,2);
});

test('height-only checkpoint preserves general cursor: write then checkpoint then regular read observes the edit',async t=>{
 const f=await fixture(t),command=f.command(),initial=f.store.terrainStrokeSource(command,f.service.cursor),prepared=await f.service.prepareTerrainStroke(initial,command.action.stroke);f.store.executeAtlasCommit(command,prepared);const cursor=structuredClone(f.service.cursor),source=f.store.atlasRegionSource(f.token,f.service.cursor),q={owner:'cursor',series:1,request:0,prefix:0,token:f.token,fence:source.fence,revision:source.revision,pixel:heightRecord(0,0,1,new Float32Array(4096),2).height.pixel,box:{x:0,y:0,width:1,height:1},lattices:[{id:0,x:-16,y:-16,dx:.5,dy:.5}]};
 await f.service.authorCheckpoint(source,q);assert.deepEqual(f.service.cursor,cursor,'height read must not consume projection changes');const next=f.store.atlasRegionSource(f.token,f.service.cursor);assert(next.reset||next.changes.some(c=>c.table==='atlas_landscape'));
 const regular=await f.service.read(next,{box:{x:-64,y:-64,width:128,height:128},width:128,height:128,scopeId:null,floorId:'ground',slice:null,roofs:true});assert.equal(regular.fence,source.fence);assert.equal(f.service.cursor.sequence,next.sequence);assert(regular.landscape);assert.equal(regular.landscape.state,'ready');assert(regular.landscape.records.some(r=>r.height)||regular.landscape.tiles.length>0);
});
