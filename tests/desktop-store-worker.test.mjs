import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync,copyFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {buildSync} from './helpers/build.mjs';
const root=path.resolve('.build/canonical-store-worker');mkdirSync(root,{recursive:true});
for(const [name,entry]of [['store-client','desktop/store-client.ts'],['store-worker','desktop/store-worker.ts'],['backup-validation-worker','desktop/backup-validation-worker.ts'],['transport','desktop/store-transport.ts'],['tracker','desktop/commit-tracker.ts']])buildSync({entryPoints:[entry],outfile:path.join(root,name+'.cjs'),bundle:true,platform:'node',format:'cjs',external:['better-sqlite3']});
mkdirSync(path.join(root,'catalog'),{recursive:true});copyFileSync('src/features/catalog/data/srd-5.1.generated.json',path.join(root,'catalog/srd-5.1.generated.json'));
const require=createRequire(import.meta.url),{StoreClient,StoreOutcomeUnknownError}=require(root+'/store-client.cjs'),{encodeStoreValue,decodeStoreValue}=require(root+'/transport.cjs'),{CommitTracker}=require(root+'/tracker.cjs');
async function fixture(t,worker='store-worker.cjs'){
 const dir=mkdtempSync(path.join(tmpdir(),'canonical-writer-')),filename=path.join(dir,'workbench.sqlite'),client=new StoreClient(filename,'0.190.1',path.join(root,worker));
 t.after(async()=>{await client.close();rmSync(dir,{recursive:true,force:true});});await client.ready;return{client,dir,filename};
}
function slowBackupWorker(){
 const slow=path.join(root,'slow-validator.cjs');writeFileSync(slow,`setTimeout(()=>require('./backup-validation-worker.cjs'),400);`);
 const entry=path.join(root,'slow-backup.cjs');writeFileSync(entry,`const wt=require('node:worker_threads');const Native=wt.Worker;wt.Worker=class extends Native{constructor(file,options){super(String(file).endsWith('backup-validation-worker.cjs')?${JSON.stringify(slow)}:file,options);}};require('./store-worker.cjs');`);
}
const tick=()=>new Promise(r=>setImmediate(r));

test('explicit worker registry rejects private database and unregistered methods',async t=>{
 const {client}=await fixture(t);await assert.rejects(client.call('db'),/nicht freigegeben/);await assert.rejects(client.call('constructor'),/nicht freigegeben/);
 const c=await client.create('Registry');assert.equal((await client.list()).campaigns[0].id,c.id);
 const closed=await client.close();assert.deepEqual(closed,{databaseClosed:true,exitCode:0});await assert.rejects(client.list(),StoreOutcomeUnknownError);
});

test('binary transport retains Buffers, typed arrays and caller ownership, rejects functions and database-like objects',()=>{
 const source={data:Buffer.from([1,2,3]),pixels:new Uint8Array([4,5]),heights:new Float32Array([6.5])};
 const decoded=decodeStoreValue(structuredClone(encodeStoreValue(source)));
 assert(Buffer.isBuffer(decoded.data));assert.deepEqual(decoded.data,source.data);assert(decoded.pixels instanceof Uint8Array);assert(!Buffer.isBuffer(decoded.pixels));assert(decoded.heights instanceof Float32Array);
 decoded.data[0]=9;assert.equal(source.data[0],1);assert.equal(source.pixels.byteLength,2);
 assert.throws(()=>encodeStoreValue({callback(){}}),/transportierbar/);assert.throws(()=>encodeStoreValue(new(class Database{})()),/Prozessgrenze/);
});

test('binary store input/output and duplicate domain commands retain one durable result',async t=>{
 const {client}=await fixture(t),campaign=await client.create('Original'),w=await client.activate(campaign.id),bytes=Buffer.from('reference bytes');
 const asset=await client.registerReference(w.token,'image/png',bytes),read=await client.referenceAssetSource(w.token,asset);assert(Buffer.isBuffer(read.bytes));assert.deepEqual(read.bytes,bytes);
 const command={commandId:randomUUID(),token:w.token,campaignId:campaign.id,expectedRevision:campaign.revision,name:'Renamed'};
 const [a,b]=await Promise.all([client.renameCampaign(command),client.renameCampaign(command)]);assert.deepEqual(a,b);assert.equal((await client.list()).campaigns[0].name,'Renamed');
});

test('lost worker answer and abrupt exit remain unknown; fresh writer reconciles the existing receipt without replay',async t=>{
 const fault=path.join(root,'lost-answer.cjs');writeFileSync(fault,`const {parentPort}=require('node:worker_threads');let target;parentPort.on('message',m=>{if(m.method==='campaignCatalog')target=m.id;});const send=parentPort.postMessage.bind(parentPort);parentPort.postMessage=m=>{if(m.kind==='result'&&m.id===target){process.exit(7);}send(m);};require('./store-worker.cjs');`);
 const {client,filename}=await fixture(t,'lost-answer.cjs'),campaign=await client.create('Original'),w=await client.activate(campaign.id),command={commandId:randomUUID(),kind:'rename',id:campaign.id,expectedRevision:campaign.revision,name:'Committed before lost reply'};
 await assert.rejects(client.campaignCatalog(command),StoreOutcomeUnknownError);await assert.rejects(client.list(),StoreOutcomeUnknownError);assert.equal((await client.close()).databaseClosed,false);
 const fresh=new StoreClient(filename,'0.190.1',root+'/store-worker.cjs');await fresh.ready;
 try{const result=await fresh.campaignCatalogOutcome(command);assert.equal(result.name,command.name);assert.equal((await fresh.list()).campaigns[0].revision,campaign.revision+1);}finally{assert.equal((await fresh.close()).databaseClosed,true);}
});

test('close drains admitted writes, rejects new work and waits for actual worker exit',async t=>{
 const {client}=await fixture(t),jobs=Array.from({length:8},(_,i)=>client.create('Drain '+i)),closed=client.close();await assert.rejects(client.create('Too late'),StoreOutcomeUnknownError);
 assert.equal((await Promise.all(jobs)).length,8);assert.deepEqual(await closed,{databaseClosed:true,exitCode:0});assert.equal(client.worker.threadId,-1);assert.strictEqual(client.close(),closed);
});

test('backup validation stays independent and admits work; shutdown cancels its candidate',async t=>{
 slowBackupWorker();
 const {client,dir}=await fixture(t,'slow-backup.cjs');await client.create('Backup');let settled=false;const backup=client.backup(path.join(dir,'recovery.sqlite')).finally(()=>{settled=true;});await new Promise(r=>setTimeout(r,50));
 const other=await client.create('Admitted during validation');assert(other.id);assert.equal(settled,false);await backup;
 const again=client.backup(path.join(dir,'recovery.sqlite'));await tick();const closed=client.close();await assert.rejects(again,/Sicherungsprüfung/);assert.equal((await closed).databaseClosed,true);
});

test('long store work yields the caller event loop and is not mistaken for visible brush latency',async t=>{
 const {client}=await fixture(t),room={scopeId:'local',floorId:'ground',number:'1',name:'Room',revision:0,polygons:[{outer:[{x:0,y:0},{x:10,y:0},{x:10,y:10},{x:0,y:10}],holes:[]}],sections:[]};
 let ticks=0,last=performance.now(),maxDelay=0;const timer=setInterval(()=>{const now=performance.now();maxDelay=Math.max(maxDelay,now-last);last=now;ticks++;},5);
 const start=performance.now();try{await client.create('Large',Array.from({length:2000},(_,i)=>({...room,id:'room-'+i,number:String(i)})));}finally{clearInterval(timer);}
 assert(ticks>5,'caller must keep accepting timer/input work');assert(maxDelay<Math.max(150,(performance.now()-start)/2),`max caller delay ${maxDelay}`);
});

test('pending commit is registered before asynchronous receipt lookup; concurrent duplicates share one apply',async()=>{
 let release,reads=0,applies=0;const tracker=new CommitTracker(async()=>{reads++;await new Promise(r=>release=r);return{outcome:'not-applied'};});
 const command={commandId:'command',campaignId:'campaign',token:'token',action:{kind:'x'}},first=tracker.execute('items',command,()=>{applies++;return 42;}),second=tracker.execute('items',command,()=>{applies++;return 99;});
 assert.strictEqual(first,second);await tick();assert.equal(reads,1);release();assert.equal(await first,42);assert.equal(applies,1);
});

test('duplicate transport envelopes never dispatch a second write',async t=>{
 const {client}=await fixture(t),send=client.worker.postMessage.bind(client.worker);client.worker.postMessage=message=>{send(message);if(message.kind==='call')send(message);};
 await client.create('Only once');assert.equal((await client.list()).campaigns.length,1);
});

test('worker abort before execution is unknown until a fresh store confirms absence',async t=>{
 writeFileSync(root+'/before-write.cjs',`const {parentPort}=require('node:worker_threads');parentPort.on('message',m=>{if(m.method==='renameCampaign')process.exit(8);});require('./store-worker.cjs');`);
 const {client,filename}=await fixture(t,'before-write.cjs'),campaign=await client.create('Unchanged'),w=await client.activate(campaign.id);
 await assert.rejects(client.renameCampaign({commandId:randomUUID(),token:w.token,campaignId:campaign.id,expectedRevision:0,name:'Must not appear'}),StoreOutcomeUnknownError);await client.close();
 const fresh=new StoreClient(filename,'0.190.1',root+'/store-worker.cjs');await fresh.ready;try{const value=(await fresh.list()).campaigns[0];assert.equal(value.name,'Unchanged');assert.equal(value.revision,0);}finally{await fresh.close();}
});

test('shutdown during startup settles readiness and confirms database close and actual exit',async()=>{
 const dir=mkdtempSync(path.join(tmpdir(),'writer-startup-')),client=new StoreClient(dir+'/workbench.sqlite','0.190.1',root+'/store-worker.cjs');
 try{const closed=client.close();await assert.rejects(client.ready,/Speicherstart/);assert.deepEqual(await closed,{databaseClosed:true,exitCode:0});assert.equal(client.worker.threadId,-1);}finally{await client.close();rmSync(dir,{recursive:true,force:true});}
});

test('deletion during independent backup validation prevents publication of the old epoch',async t=>{
 slowBackupWorker();const {client,dir}=await fixture(t,'slow-backup.cjs'),campaign=await client.create('Deleted'),target=path.join(dir,'recovery.sqlite');
 await client.backup(target);const prior=readFileSync(target),backup=client.backup(target),rejected=assert.rejects(backup,/Löschung überholt/);
 await new Promise(r=>setTimeout(r,80));await client.campaignCatalog({commandId:randomUUID(),kind:'trash',id:campaign.id,expectedRevision:0,trashed:true});await rejected;assert.deepEqual(readFileSync(target),prior);
});

test('status retains pending when a pre-commit receipt read returns after apply finished',async()=>{
 let complete,readStatus,calls=0;const tracker=new CommitTracker(()=>++calls===1?{outcome:'not-applied'}:new Promise(r=>readStatus=r));
 const command={commandId:'race',campaignId:'campaign',token:'token',action:{kind:'x'}},job=tracker.execute('items',command,()=>new Promise(r=>complete=r));await tick();
 const state=tracker.pending.get('items:race'),status=tracker.status(state.ref,'token');complete(42);await job;readStatus({outcome:'not-applied'});assert.deepEqual(await status,{outcome:'pending'});
});

test('main bundle has no CampaignStore implementation and the renderer bridge has no general store dispatch',()=>{
 const result=buildSync({entryPoints:['desktop/main.ts'],bundle:true,platform:'node',format:'cjs',write:false,metafile:true,external:['electron','better-sqlite3'],define:{__APP_VERSION__:'"test"'}});
 assert(!Object.keys(result.metafile.inputs).includes('src/app/storage/store.ts'));
 const preload=readFileSync('desktop/preload.ts','utf8');assert.doesNotMatch(preload,/store-client|store-worker|store:call|store:execute/);
});

test('lost reply without a crash remains pending until ordered exit, then receipt-only recovery confirms it',async t=>{
 writeFileSync(root+'/silent-answer.cjs',`const {parentPort}=require('node:worker_threads');let target;parentPort.on('message',m=>{if(m.method==='campaignCatalog')target=m.id;});const send=parentPort.postMessage.bind(parentPort);parentPort.postMessage=m=>{if(m.kind!=='result'||m.id!==target)send(m);};require('./store-worker.cjs');`);
 const {client,filename}=await fixture(t,'silent-answer.cjs'),campaign=await client.create('Lost'),command={commandId:randomUUID(),kind:'rename',id:campaign.id,expectedRevision:0,name:'Saved'};
 const write=client.campaignCatalog(command),unknown=assert.rejects(write,StoreOutcomeUnknownError);
 assert.equal((await client.list()).campaigns[0].name,'Saved');assert.equal(client.pending.size,1);assert.equal((await client.close()).databaseClosed,true);await unknown;
 const fresh=new StoreClient(filename,'0.190.1',root+'/store-worker.cjs');await fresh.ready;try{assert.equal((await fresh.campaignCatalogOutcome(command)).name,'Saved');assert.equal((await fresh.list()).campaigns[0].revision,1);}finally{await fresh.close();}
});
