import {test} from 'node:test';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {readdirSync,readFileSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import {buildSync} from 'esbuild';
import {desktopMainHost,storeFaultWorker,mainHostBuildRoot,StoreOutcomeUnknownError} from './helpers/desktop-main-host.mjs';
const output=path.join(mainHostBuildRoot,'atlas-write-recovery.cjs');
buildSync({entryPoints:['src/app/atlas-write-recovery.ts'],outfile:output,bundle:true,platform:'node',format:'cjs'});
const {atlasWriteReference,dispatchRecoverableAtlasWrite,newGraphPreviewTarget}=createRequire(import.meta.url)(output);
const ok=r=>{assert.equal(r.ok,true,r.error);return r.value;};
const unknown=r=>{assert.equal(r.ok,false);assert.equal(r.errorKind,'store-outcome-unknown');};
async function owner(host){const c=ok(await host.api.create('Receipt')),shell=ok(await host.api.activateShell(c.id));return{campaignId:c.id,token:shell.token};}
const atlas=o=>({...o,commandId:randomUUID(),action:{kind:'dungeon-create',name:'Original',x:0,y:0}});
const graph=o=>({...o,commandId:randomUUID(),scopeId:'local',target:newGraphPreviewTarget('local'),action:{kind:'raster'}});
const writes=host=>host.dispatches.filter(d=>['executeAtlasCommit','executeGraph','executeAtlasTravelCommit','atlasDrawingCommit','atlasRoomCommit'].includes(d.method));
function digest(host){const db=new Database(host.store.filename,{readonly:true,fileMustExist:true});try{return createHash('sha256').update(db.serialize()).digest('hex');}finally{db.close();}}
function previewDigest(host){const root=host.store.filename+'.graph-previews',active=JSON.parse(readFileSync(path.join(root,'active.json'))),dir=path.join(root,active.previewId),file=readdirSync(dir).find(n=>n.endsWith('.sqlite'));const db=new Database(path.join(dir,file),{readonly:true});try{return createHash('sha256').update(db.serialize()).digest('hex');}finally{db.close();}}
function travelFacts(host){const db=new Database(host.store.filename,{readonly:true});try{return Object.fromEntries(['scene_clock','scene_position','atlas_local_journey','atlas_travel_receipt','scene_time_step','atlas_command','campaign_atlas'].map(table=>[table,db.prepare('SELECT * FROM '+table).all()]));}finally{db.close();}}
async function recover(host,campaignId){const fresh=await host.restart(),shell=ok(await fresh.api.activateShell(campaignId));return{fresh,token:shell.token,refs:ok(await fresh.api.atlasWriteReferences(campaignId,shell.token))};}
function worker(contents,name){const file=path.join(mainHostBuildRoot,name+'.cjs');buildSync({stdin:{resolveDir:process.cwd(),contents},outfile:file,bundle:true,platform:'node',format:'cjs',external:['better-sqlite3']});return file;}
const previewBefore=worker(`import {GraphPreviewCommands} from './src/app/storage/graph-preview-commands';GraphPreviewCommands.prototype.execute=function(){process.exit(61);};require('./desktop/store-worker');`,'A013-preview-before');

for(const [kind,method,make] of [['atlas','executeAtlasCommit',atlas],['graph','executeGraph',graph]])for(const mode of ['before-execution','lost-response'])test(`${kind}: ${mode}, fresh host restores only persisted reference and reads without replay`,async t=>{
 const host=await desktopMainHost(t,{workerFile:storeFaultWorker(method,mode)}),o=await owner(host),c=make(o),original=structuredClone(c);
 unknown(await dispatchRecoverableAtlasWrite(host.api,{kind,command:c},value=>host.api[method](value)));
 assert.deepEqual(c,original);assert.equal(writes(host).length,1);
 const {fresh,token,refs}=await recover(host,o.campaignId);assert.equal(refs.length,1);assert.notEqual(token,o.token);
 // No command/preview ID is supplied to this new renderer's reader.
 const ref=refs[0],before=digest(fresh),shadow=kind==='graph'&&mode==='lost-response'?previewDigest(fresh):null;
 const expected=mode==='lost-response'?'applied':kind==='graph'?'unknown':'not-applied';
 for(let i=0;i<3;i++)assert.equal(ok(await fresh.api.atlasWriteStatus(ref,token)).outcome,expected);
 assert.equal(digest(fresh),before);if(shadow)assert.equal(previewDigest(fresh),shadow);assert.equal(writes(fresh).length,0);
 assert.equal(ok(await fresh.api.atlasWriteStatus({...ref,fingerprint:'0'.repeat(64)},token)).outcome,mode==='lost-response'?'unknown':expected);
 if(expected==='unknown'){assert.equal((await fresh.api.clearAtlasWriteReference(ref,token)).ok,false);assert.equal(ok(await fresh.api.atlasWriteReferences(o.campaignId,token)).length,1);}
 else{ok(await fresh.api.clearAtlasWriteReference(ref,token));assert.deepEqual(ok(await fresh.api.atlasWriteReferences(o.campaignId,token)),[]);}
});

test('first preview exists but local commit did not happen: restart reads not-applied from that exact preview',async t=>{
 const host=await desktopMainHost(t,{workerFile:previewBefore}),o=await owner(host);
 unknown(await dispatchRecoverableAtlasWrite(host.api,{kind:'graph',command:graph(o)},c=>host.api.executeGraph(c)));
 const {fresh,token,refs}=await recover(host,o.campaignId),before=previewDigest(fresh);
 assert.equal(ok(await fresh.api.atlasWriteStatus(refs[0],token)).outcome,'not-applied');assert.equal(previewDigest(fresh),before);assert.equal(writes(fresh).length,0);
});

test('canonical nested original tokens survive restart; fresh activation and wrong campaign are separate',async t=>{
 const host=await desktopMainHost(t),o=await owner(host);ok(await host.api.executeAtlasCommit({...o,commandId:randomUUID(),action:{kind:'room-default'}}));
 const room=ok(await host.api.campaignAtlas(o.token)).workspace.rooms[0],edit={...o,commandId:randomUUID(),roomId:room.id,expectedRevision:room.revision,name:'Nested saved',polygons:room.polygons,sections:room.sections};
 const c={...o,commandId:edit.commandId,action:{kind:'room-edit',edit}},ref=await atlasWriteReference({kind:'atlas',command:c});
 ok(await dispatchRecoverableAtlasWrite(host.api,{kind:'atlas',command:c},value=>host.api.executeAtlasCommit(value)));
 const {fresh,token,refs}=await recover(host,o.campaignId);assert.deepEqual(refs,[ref]);assert.equal(ok(await fresh.api.atlasWriteStatus(refs[0],token)).outcome,'applied');
 const old=await fresh.api.atlasWriteStatus(ref,o.token);assert.equal(old.ok,false);
 const foreign=await owner(fresh);assert.equal((await fresh.api.atlasWriteStatus(ref,foreign.token)).ok,false);assert.equal((await fresh.api.atlasWriteReferences(o.campaignId,foreign.token)).ok,false);
 const before=digest(fresh);assert.equal(ok(await fresh.api.atlasWriteStatus({...ref,campaignId:foreign.campaignId},foreign.token)).outcome,'unknown');assert.equal(digest(fresh),before);
});

test('a missing or different preview never resolves against the canonical receipt or the current preview',async t=>{
 const host=await desktopMainHost(t),o=await owner(host),c=graph(o),ref=await atlasWriteReference({kind:'graph',command:c});
 assert.equal(ok(await host.api.atlasWriteStatus(ref,o.token)).outcome,'unknown');ok(await host.api.executeGraph(c));
 const before=previewDigest(host);assert.equal(ok(await host.api.atlasWriteStatus({...ref,target:{...ref.target,previewId:randomUUID()}},o.token)).outcome,'unknown');assert.equal(ok(await host.api.atlasWriteStatus({...ref,target:{...ref.target,scopeId:'foreign'}},o.token)).outcome,'unknown');assert.equal(previewDigest(host),before);
 const restore={...graph(o),target:{...c.target,revision:1},action:{kind:'restore'}};ok(await host.api.executeGraph(restore));
 ok(await host.api.executeGraph(graph(o)));assert.equal(ok(await host.api.atlasWriteStatus(ref,o.token)).outcome,'unknown');
 assert.equal(ok(await host.api.atlasWriteStatus(await atlasWriteReference({kind:'graph',command:restore}),o.token)).outcome,'applied');
});

for(const broken of ['directory','reference','candidate','foreign-campaign'])test(`persistent ${broken} failure blocks fresh dispatch and never hides pending state`,async t=>{
 const host=await desktopMainHost(t),o=await owner(host),c=atlas(o),root=path.join(host.dir,'atlas-write-references');
 if(broken==='directory')writeFileSync(root,'not a directory');
 else{ok(await host.api.keepAtlasWriteReference(await atlasWriteReference({kind:'atlas',command:c}),o.token));const file=path.join(root,readdirSync(root)[0]);
  if(broken==='reference')writeFileSync(file,'{broken');
  if(broken==='candidate')writeFileSync(file+'.candidate','interrupted');
  if(broken==='foreign-campaign'){const ref=JSON.parse(readFileSync(file));ref.campaignId='other';writeFileSync(file,JSON.stringify(ref));}}
 const fresh=await host.restart(),shell=ok(await fresh.api.activateShell(o.campaignId));
 assert.equal((await fresh.api.atlasWriteReferences(o.campaignId,shell.token)).ok,false);
 await assert.rejects(dispatchRecoverableAtlasWrite(fresh.api,{kind:'atlas',command:atlas({...o,token:shell.token})},value=>fresh.api.executeAtlasCommit(value)));
 assert.equal(writes(fresh).length,0);
});

test('slots block overwrites and duplicates; clear cannot remove another identity',async t=>{
 const host=await desktopMainHost(t),o=await owner(host),c=atlas(o),ref=await atlasWriteReference({kind:'atlas',command:c});ok(await host.api.keepAtlasWriteReference(ref,o.token));
 for(const next of [c,atlas(o)])await assert.rejects(dispatchRecoverableAtlasWrite(host.api,{kind:'atlas',command:next},v=>host.api.executeAtlasCommit(v)),/zuerst klären/);
 assert.equal(writes(host).length,0);assert.equal((await host.api.clearAtlasWriteReference({...ref,commandId:'other'},o.token)).ok,false);
 assert.deepEqual(ok(await host.api.atlasWriteReferences(o.campaignId,o.token)),[ref]);
 ok(await host.api.clearAtlasWriteReference(ref,o.token));assert.deepEqual(ok(await host.api.atlasWriteReferences(o.campaignId,o.token)),[]);
});

async function travel(host,o){
 const command=action=>({...o,commandId:randomUUID(),action});
 ok(await host.api.executeAtlasCommit(command({kind:'landscape-put',record:{id:randomUUID(),revision:0,kind:'patch',name:'Land',points:[],polygons:[{outer:[{x:-100,y:-100},{x:100,y:-100},{x:100,y:100},{x:-100,y:100}],holes:[]}],resolution:1,width:0,values:{terrain:'plains'}},expectedRevision:null})));
 const initial=ok(await host.api.live(o.token)),scene=ok(await host.api.executeLive(command({kind:'initialize',expectedRosterRevision:initial.rosterRevision}))).scene;
 const character=ok(await host.api.executeLive(command({kind:'create-character',profile:{name:'Ada',speedFeet:30}}))).character,live=ok(await host.api.live(o.token));
 ok(await host.api.executeLive(command({kind:'membership',characterId:character.id,expectedRevision:character.membershipRevision,expectedRosterRevision:live.rosterRevision,active:true,targetSceneId:scene.id,expectedFocusRevision:live.focusRevision})));
 const preview=ok(await host.api.previewAtlasTravel(o.token,{x:20,y:0}));
 const started=ok(await host.api.executeAtlasTravel({...command({kind:'start',preview}),sceneId:scene.id}));
 return{...command({kind:'step',id:started.localJourney.id,expectedRevision:started.localJourney.revision}),sceneId:scene.id};
}
for(const mode of ['before-execution','lost-response'])test(`travel ${mode}: recovered status needs no focus projection and changes no time, position or history`,async t=>{
 const host=await desktopMainHost(t,{workerFile:storeFaultWorker('executeAtlasTravelCommit',mode)}),o=await owner(host),c=await travel(host,o),before=travelFacts(host);
 unknown(await dispatchRecoverableAtlasWrite(host.api,{kind:'travel',command:c},value=>host.api.executeAtlasTravelCommit(value)));
 const {fresh,token,refs}=await recover(host,o.campaignId),after=travelFacts(fresh);assert.equal(refs.length,1);
 if(mode==='before-execution')assert.deepEqual(after,before);else{assert.notDeepEqual(after.scene_clock,before.scene_clock);assert.notDeepEqual(after.scene_position,before.scene_position);assert.equal(after.scene_time_step.length,before.scene_time_step.length+1);}
 // Remove the focus. The old writer cannot pass its focus precondition now.
 const db=new Database(fresh.store.filename);assert.equal(db.prepare('DELETE FROM live_state WHERE campaign_id=?').run(o.campaignId).changes,1);db.close();
 const projection=await fresh.api.campaignAtlas(token);assert.equal(projection.ok,false);assert.match(projection.error,/Primary\/Focus|Recovery/);
 const unchanged=digest(fresh);
 for(let i=0;i<3;i++)assert.equal(ok(await fresh.api.atlasWriteStatus(refs[0],token)).outcome,mode==='lost-response'?'applied':'not-applied');
 assert.equal(digest(fresh),unchanged);assert.equal(writes(fresh).length,0);assert.equal(host.dispatches.filter(d=>d.method==='executeAtlasTravelCommit').length,1);
});

for(const family of ['atlas','graph','travel'])test(`${family}: unreadable receipt is unknown through real worker/main/preload`,async t=>{
 const file=worker(`import {CampaignStore} from './src/app/storage/store';
const read=CampaignStore.prototype.atlasWriteStatus;
CampaignStore.prototype.atlasWriteStatus=function(...args){const db=args[0].family==='preview'?this.graphShadow?.db:this.db;if(!db)return read.apply(this,args);const prepare=db.prepare;db.prepare=function(sql){if(sql.includes('FROM atlas_receipt')||sql.includes('FROM atlas_travel_receipt')||sql.includes('FROM preview_receipt'))throw Error('unreadable');return prepare.call(this,sql);};try{return read.apply(this,args);}finally{db.prepare=prepare;}};
require('./desktop/store-worker');`,'A013-unreadable-'+family);
 const host=await desktopMainHost(t,{workerFile:file}),o=await owner(host),c=family==='graph'?graph(o):family==='travel'?await travel(host,o):atlas(o),kind=family;
 if(family==='graph')ok(await host.api.executeGraph(c));else if(family==='atlas')ok(await host.api.executeAtlasCommit(c));else ok(await host.api.executeAtlasTravelCommit(c));
 const ref=await atlasWriteReference({kind,command:c}),before=digest(host),count=writes(host).length;
 for(let i=0;i<2;i++)assert.equal(ok(await host.api.atlasWriteStatus(ref,o.token)).outcome,'unknown');
 assert.equal(digest(host),before);assert.equal(writes(host).length,count);
});

for(const method of ['executeAtlasCommit','executeGraph','executeAtlasTravelCommit','executeAtlasTravel'])test(`${method}: active dispatch never reports a missing receipt as not-applied`,async t=>{
 const host=await desktopMainHost(t),o=await owner(host),kind=method.includes('Travel')?'travel':method==='executeGraph'?'graph':'atlas',c=kind==='travel'?await travel(host,o):kind==='graph'?graph(o):atlas(o),ref=await atlasWriteReference({kind,command:c});
 const call=host.store.call.bind(host.store);let release,entered;const started=new Promise(r=>entered=r),gate=new Promise(r=>release=r);
 host.store.call=async(name,...args)=>{if(name===method){entered();await gate;}return call(name,...args);};
 const job=host.api[method](c);await started;
 assert.equal(ok(await host.api.atlasWriteStatus(ref,o.token)).outcome,'unknown');assert.equal((await host.api.clearAtlasWriteReference(ref,o.token)).ok,false);
 release();ok(await job);assert.equal(ok(await host.api.atlasWriteStatus(ref,o.token)).outcome,'applied');
});

test('Main covers asynchronous terrain preparation before the writer is dispatched',async t=>{
 const host=await desktopMainHost(t),o=await owner(host),c={...atlas(o),action:{kind:'landscape-height-stroke',stroke:{}}},ref=await atlasWriteReference({kind:'atlas',command:c});
 const call=host.store.call.bind(host.store);let release,entered;const started=new Promise(r=>entered=r),gate=new Promise(r=>release=r);
 host.store.call=async(name,...args)=>{if(name==='terrainStrokeSource'){entered();await gate;throw Error('Preparation rejected');}return call(name,...args);};
 const job=host.api.executeAtlasCommit(c);await started;
 assert.equal(ok(await host.api.atlasWriteStatus(ref,o.token)).outcome,'unknown');assert.equal(writes(host).length,0);
 release();assert.equal((await job).ok,false);assert.equal(ok(await host.api.atlasWriteStatus(ref,o.token)).outcome,'not-applied');assert.equal(writes(host).length,0);
});

test('a delayed absent status cannot overtake a writer entering and settling in Main',async t=>{
 const host=await desktopMainHost(t),o=await owner(host),c=atlas(o),ref=await atlasWriteReference({kind:'atlas',command:c});
 const call=host.store.call.bind(host.store);let release,entered;const started=new Promise(r=>entered=r),gate=new Promise(r=>release=r);
 host.store.call=async(name,...args)=>{const result=await call(name,...args);if(name==='atlasWriteStatus'){entered();await gate;}return result;};
 const pending=host.api.atlasWriteStatus(ref,o.token);await started;ok(await host.api.executeAtlasCommit(c));release();assert.equal(ok(await pending).outcome,'unknown');
 assert.equal(ok(await host.api.atlasWriteStatus(ref,o.token)).outcome,'applied');
});

for(const mode of ['scope','revision'])test(`definitive first-graph ${mode} rejection releases only its saved identity, while status stays unknown`,async t=>{
 const host=await desktopMainHost(t),o=await owner(host),c=graph(o);
 if(mode==='scope'){c.scopeId='missing';c.target.scopeId='missing';}else c.target.revision=99;
 const ref=await atlasWriteReference({kind:'graph',command:c});
 const result=await dispatchRecoverableAtlasWrite(host.api,{kind:'graph',command:c},v=>host.api.executeGraph(v));
 assert.equal(result.ok,false);assert.equal(result.errorKind,undefined);assert.match(result.error,/Dungeonzeichnung fehlt|Startauftrag/);
 assert.equal(ok(await host.api.atlasWriteStatus(ref,o.token)).outcome,'unknown');
 assert.equal((await host.api.clearAtlasWriteReference({...ref,fingerprint:'0'.repeat(64)},o.token)).ok,false);
 assert.equal((await host.api.clearAtlasWriteReference({...ref,commandId:'other'},o.token)).ok,false);
 ok(await host.api.clearAtlasWriteReference(ref,o.token));assert.deepEqual(ok(await host.api.atlasWriteReferences(o.campaignId,o.token)),[]);
 const good=graph(o);ok(await dispatchRecoverableAtlasWrite(host.api,{kind:'graph',command:good},v=>host.api.executeGraph(v)));
});

test('session-local rejected proof is not manufactured after a host restart',async t=>{
 const host=await desktopMainHost(t),o=await owner(host),c=graph(o);c.target.revision=99;
 assert.equal((await dispatchRecoverableAtlasWrite(host.api,{kind:'graph',command:c},v=>host.api.executeGraph(v))).ok,false);
 const {fresh,token,refs}=await recover(host,o.campaignId);assert.equal(refs.length,1);
 assert.equal(ok(await fresh.api.atlasWriteStatus(refs[0],token)).outcome,'unknown');assert.equal((await fresh.api.clearAtlasWriteReference(refs[0],token)).ok,false);
});

test('a new unknown dispatch invalidates the previous definitive rejection proof',async t=>{
 const file=worker(`import {parentPort} from 'node:worker_threads';let count=0,target;parentPort.on('message',m=>{if(m.method==='executeGraph'){count++;if(count===2)target=m.id;}});const send=parentPort.postMessage.bind(parentPort);parentPort.postMessage=m=>{if(m.id===target&&m.kind==='error')m.kind='unknown';return send(m);};require('./desktop/store-worker');`,'A013-second-unknown');
 const host=await desktopMainHost(t,{workerFile:file}),o=await owner(host),c=graph(o);c.target.revision=99;
 const ref=await atlasWriteReference({kind:'graph',command:c});assert.equal((await dispatchRecoverableAtlasWrite(host.api,{kind:'graph',command:c},v=>host.api.executeGraph(v))).ok,false);
 unknown(await host.api.executeGraph(c));assert.equal(ok(await host.api.atlasWriteStatus(ref,o.token)).outcome,'unknown');assert.equal((await host.api.clearAtlasWriteReference(ref,o.token)).ok,false);assert.deepEqual(ok(await host.api.atlasWriteReferences(o.campaignId,o.token)),[ref]);
});

test('durability failure after rename prevents dispatch and preserves the reference across restart',async t=>{
 const host=await desktopMainHost(t),o=await owner(host);fs.mkdirSync(path.join(host.dir,'atlas-write-references'));
 const original=fs.fsyncSync;fs.fsyncSync=fd=>{if(fs.fstatSync(fd).isDirectory())throw Error('Injected directory fsync failure');return original(fd);};
 try{await assert.rejects(dispatchRecoverableAtlasWrite(host.api,{kind:'atlas',command:atlas(o)},v=>host.api.executeAtlasCommit(v)),/fsync/);}finally{fs.fsyncSync=original;}
 assert.equal(writes(host).length,0);const {fresh,token,refs}=await recover(host,o.campaignId);assert.equal(refs.length,1);assert.equal(ok(await fresh.api.atlasWriteStatus(refs[0],token)).outcome,'not-applied');assert.equal(writes(fresh).length,0);
});

test('failed clear retains the exact reference even after a definitive status',async t=>{
 const host=await desktopMainHost(t),o=await owner(host),ref=await atlasWriteReference({kind:'atlas',command:atlas(o)});ok(await host.api.keepAtlasWriteReference(ref,o.token));
 const original=fs.unlinkSync;fs.unlinkSync=()=>{throw Error('Injected unlink failure');};
 try{const reply=await host.api.clearAtlasWriteReference(ref,o.token);assert.equal(reply.ok,false);assert.match(reply.error,/unlink/);}finally{fs.unlinkSync=original;}
 assert.deepEqual(ok(await host.api.atlasWriteReferences(o.campaignId,o.token)),[ref]);assert.equal(writes(host).length,0);
});

test('a dispatch through another Atlas port also revokes the same-command rejection witness',async t=>{
 const host=await desktopMainHost(t),o=await owner(host),c=graph(o);c.target.revision=99;const ref=await atlasWriteReference({kind:'graph',command:c});
 assert.equal((await dispatchRecoverableAtlasWrite(host.api,{kind:'graph',command:c},v=>host.api.executeGraph(v))).ok,false);
 const call=host.store.call.bind(host.store);host.store.call=(name,...args)=>name==='executeAtlasCommit'?Promise.reject(new StoreOutcomeUnknownError('Injected uncertain dispatch')):call(name,...args);
 unknown(await host.api.executeAtlasCommit({...c,action:{kind:'graph-preview',command:c}}));
 assert.equal((await host.api.clearAtlasWriteReference(ref,o.token)).ok,false);assert.deepEqual(ok(await host.api.atlasWriteReferences(o.campaignId,o.token)),[ref]);
});
