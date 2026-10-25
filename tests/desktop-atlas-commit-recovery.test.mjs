import {attachAtlasAuthorRecovery} from './helpers/atlas-author-recovery.mjs';
import {desktopMainHost,storeFaultWorker} from './helpers/desktop-main-host.mjs';
import {buildSync as directBuild} from 'esbuild';
import {mkdtempSync,rmSync,writeFileSync,readdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
import {buildSync} from './helpers/build.mjs';
import {parseHTML} from './helpers/dom.mjs';
directBuild({entryPoints:['src/app/storage/store.ts'],outfile:'.build/atlas-commit-recovery-store.cjs',bundle:true,platform:'node',format:'cjs',external:['better-sqlite3']});
buildSync({stdin:{contents:"export {AtlasWriteActivity} from './desktop/atlas-write-activity';export * from './src/app/campaign-atlas-author';",resolveDir:process.cwd()},outfile:'.build/atlas-commit-recovery-client.cjs',bundle:true,platform:'node',format:'cjs'});
const require=createRequire(import.meta.url),{CampaignStore}=require('../.build/atlas-commit-recovery-store.cjs'),{AtlasWriteActivity,...author}=require('../.build/atlas-commit-recovery-client.cjs');
function fixture(t){
 const dir=mkdtempSync(path.join(tmpdir(),'A007-owner-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
 const store=new CampaignStore(':memory:'),cam=store.create('Recovery'),w=store.activate(cam.id),activity=new AtlasWriteActivity(),dom=parseHTML('<html><body><textarea id="draft">Unveröffentlichter Entwurf</textarea></body></html>');
 const before={window:globalThis.window,document:globalThis.document,Event:globalThis.Event,CustomEvent:globalThis.CustomEvent};Object.assign(globalThis,{window:dom.window,document:dom.document,Event:dom.window.Event,CustomEvent:dom.window.CustomEvent});t.after(()=>{Object.assign(globalThis,before);store.close();});
 const command=()=>({commandId:randomUUID(),campaignId:cam.id,token:w.token,action:{kind:'city-create',name:'Neu',x:0,y:0,width:200,height:200}}),calls={writes:0,checks:0};
 window.campaign={executeAtlasCommit:async c=>activity.run(c.commandId,()=>{calls.writes++;try{return{ok:true,value:store.executeAtlasCommit(c)};}catch(e){return{ok:false,error:e.message};}}),reconcileAtlasCommit:async c=>{calls.checks++;try{return{ok:true,value:store.reconcileAtlasCommit(c,activity.has(c.commandId))};}catch(e){return{ok:false,error:e.message};}}};
 attachAtlasAuthorRecovery(window.campaign,store,dir);
 window.campaign.atlasWriteStatus=async(ref,token)=>{try{return{ok:true,value:store.atlasWriteStatus(ref,token,activity.has(ref.commandId))};}catch(e){return{ok:false,error:e.message};}};
 return{store,cam,w,activity,command,calls,api:window.campaign,draft:()=>document.getElementById('draft').value};
}
test('unknown write followed by confirmed rejection unlocks without replay and retains input',async t=>{
 const x=fixture(t),c=x.command(),write=x.api.executeAtlasCommit;x.api.executeAtlasCommit=async()=>{throw Error('Antwortverlust vor Anwendung');};
 assert.equal((await author.writeAtlasCommit(c)).ok,false);assert.deepEqual(author.pendingAtlasWrite(c.token),c);
 // A retry would be rejected; status inspection must not execute even a rejected command.
 x.api.executeAtlasCommit=async()=>{x.calls.writes++;return{ok:false,error:'Konflikt: Ausgangsstand veraltet'};};const bytes=x.store.db.serialize();
 const recovered=await author.recoverAtlasCommit(c.token);assert.equal(recovered.ok,true);assert.equal(recovered.value.outcome,'not-applied');assert.equal(author.pendingAtlasWrite(c.token),null);assert.equal(x.calls.writes,0);assert.deepEqual(x.store.db.serialize(),bytes);assert.equal(x.draft(),'Unveröffentlichter Entwurf');
 x.api.executeAtlasCommit=write;assert.equal((await author.writeAtlasCommit(x.command())).ok,true);
});
test('lost post-commit acknowledgement resolves by receipt without rerunning the command',async t=>{
 const x=fixture(t),c=x.command(),write=x.api.executeAtlasCommit;x.api.executeAtlasCommit=async command=>{await write(command);throw Error('Antwortverlust nach Commit');};
 assert.equal((await author.writeAtlasCommit(c)).ok,false);const bytes=x.store.db.serialize(),recovered=await author.recoverAtlasCommit(c.token);assert.equal(recovered.ok,true);assert.equal(recovered.value.outcome,'applied');assert.equal(author.pendingAtlasWrite(c.token),null);assert.equal(x.calls.writes,1);assert.deepEqual(x.store.db.serialize(),bytes);
});
test('recovery keeps unknown state during asynchronous preparation, then resolves its receipt',async t=>{
 const x=fixture(t),c=x.command();let release,task;const gate=new Promise(resolve=>release=resolve);
 x.api.executeAtlasCommit=async command=>{task=x.activity.run(command.commandId,async()=>{await gate;x.store.executeAtlasCommit(command);});throw Error('Transport beendet, Main arbeitet weiter');};
 await author.writeAtlasCommit(c);assert.equal(x.activity.has(c.commandId),true);const response=await author.recoverAtlasCommit(c.token);assert.equal(response.ok,false);assert.match(response.error,/läuft noch/);assert.deepEqual(author.pendingAtlasWrite(c.token),c);
 release();await task;assert.equal(x.activity.has(c.commandId),false);assert.equal((await author.recoverAtlasCommit(c.token)).ok,true);assert.equal(author.pendingAtlasWrite(c.token),null);
});
test('failed, unavailable, mismatched and transport-lost status never clear the pending command',async t=>{
 const x=fixture(t),c=x.command();x.api.executeAtlasCommit=async()=>{throw Error('Antwortverlust');};await author.writeAtlasCommit(c);
 const read=x.api.atlasWriteStatus;
 for(const check of [async()=>({ok:false,error:'Lesefehler'}),async()=>{throw Error('Statusantwort verloren');}]){x.api.atlasWriteStatus=check;assert.equal((await author.recoverAtlasCommit(c.token)).ok,false);assert.deepEqual(author.pendingAtlasWrite(c.token),c);}
 x.store.executeAtlasCommit({...c,action:{...c.action,name:'Andere Verwendung'}});x.api.atlasWriteStatus=read;const response=await author.recoverAtlasCommit(c.token);assert.equal(response.ok,false);assert.match(response.error,/unbekannt/);assert.deepEqual(author.pendingAtlasWrite(c.token),c);
});
test('activity keeps concurrent invocations pending until every invocation settles, including rejection',async()=>{
 const activity=new AtlasWriteActivity();let releaseA,releaseB;const a=activity.run('same',()=>new Promise(resolve=>releaseA=resolve)),b=activity.run('same',()=>new Promise((_,reject)=>releaseB=reject));assert(activity.has('same'));releaseA();await a;assert(activity.has('same'));releaseB(Error('Nicht gespeichert'));await assert.rejects(b);assert.equal(activity.has('same'),false);await assert.rejects(activity.run('sync',()=>{throw Error('Synchron abgelehnt');}));assert.equal(activity.has('sync'),false);
});
test('receipt inspection binds exact identity and payload and does not run post-commit presentation reads',t=>{
 const x=fixture(t),c=x.command();assert.deepEqual(x.store.reconcileAtlasCommit(c),{outcome:'not-applied'});x.store.executeAtlasCommit(c);const bytes=x.store.db.serialize();x.store.atlasRegionSource=()=>{throw Error('Darstellung nicht verfügbar');};assert.equal(x.store.reconcileAtlasCommit(c).outcome,'applied');assert.deepEqual(x.store.db.serialize(),bytes);assert.throws(()=>x.store.reconcileAtlasCommit({...c,action:{...c.action,name:'Geändert'}}),/anders verwendet/);assert.throws(()=>x.store.reconcileAtlasCommit({...c,token:'stale'}));assert.deepEqual(x.store.reconcileAtlasCommit({...c,commandId:randomUUID()},true),{outcome:'unknown'});
});

function freshAuthor(){const file=require.resolve('../.build/atlas-commit-recovery-client.cjs');delete require.cache[file];return require(file);}
function ownerDOM(t,api){const dom=parseHTML('<html><body><textarea id="draft">Geheime GM-Spur, noch offen</textarea></body></html>'),prior={window:globalThis.window,document:globalThis.document,Event:globalThis.Event,CustomEvent:globalThis.CustomEvent};Object.assign(globalThis,{window:dom.window,document:dom.document,Event:dom.window.Event,CustomEvent:dom.window.CustomEvent});window.campaign=api;t.after(()=>Object.assign(globalThis,prior));}
const unwrap=r=>{assert.equal(r.ok,true,r.error);return r.value;};
const makeCommand=(w,kind='atlas')=>({campaignId:w.campaign.id,token:w.token,commandId:randomUUID(),...(kind==='graph'?{scopeId:'local',action:{kind:'raster'}}:{action:{kind:'dungeon-create',name:'Original',x:0,y:0}})});
for(const kind of ['atlas','graph'])for(const mode of ['before-execution','lost-response'])for(const thrown of [false,true])test(`real Main → ${kind} owner, ${mode}, ${thrown?'thrown transport':'typed unknown'}: fresh renderer restores only disk reference`,async t=>{
 const method=kind==='graph'?'executeGraph':'executeAtlasCommit',host=await desktopMainHost(t,{workerFile:storeFaultWorker(method,mode)}),cam=unwrap(await host.api.create('Author restart')),w=unwrap(await host.api.activateShell(cam.id));ownerDOM(t,host.api);const first=freshAuthor(),c=makeCommand(w,kind),original=structuredClone(c);
 if(thrown){const dispatch=host.api[method];window.campaign={...host.api,[method]:async value=>{const result=await dispatch(value);assert.equal(result.errorKind,'store-outcome-unknown');throw Error('Antwort verloren');}};}
 const result=await(kind==='graph'?first.atlasGraphWrite(c):first.writeAtlasCommit(c));assert.equal(result.ok,false);assert.equal(result.errorKind,'store-outcome-unknown');assert.deepEqual(c,original);assert.equal(first.atlasWriteOwnerState(w.token).durableConfirmed,true);
 assert.equal((await first.writeAtlasCommit(makeCommand(w))).ok,false);assert.equal(host.dispatches.filter(d=>d.method===method).length,1);
 const fresh=await host.restart(),active=unwrap(await fresh.api.activateShell(cam.id));window.campaign=fresh.api;const second=freshAuthor();
 // The new module receives campaign/token only. Neither original ID nor payload
 // is supplied to activation or recovery; the exact identity comes from disk.
 unwrap(await second.restoreAtlasWrites(cam.id,active.token));assert.notEqual(active.token,w.token);assert.ok(second.pendingAtlasWrite(active.token));assert.equal(second.pendingAtlasWrite(active.token).action,undefined);
 const before=fresh.dispatches.length,expected=mode==='lost-response'?'applied':kind==='graph'?'unknown':'not-applied';
 for(let i=0;i<3;i++){
  const resolved=await second.recoverAtlasCommit(active.token);
  if(expected==='unknown'){assert.equal(resolved.ok,false);assert.ok(second.pendingAtlasWrite(active.token));}
  else if(i===0){assert.equal(resolved.ok,true);assert.equal(resolved.value.outcome,expected);assert.equal(second.pendingAtlasWrite(active.token),null);}
  else assert.equal(resolved,null);
 }
 assert.equal(fresh.dispatches.slice(before).filter(d=>['executeAtlasCommit','executeGraph','executeAtlas','atlasRoomCommit','atlasDrawingCommit'].includes(d.method)).length,0);
 assert.equal(document.getElementById('draft').value,'Geheime GM-Spur, noch offen');
});

test('owner reserves before asynchronous keep, rejects competing writes and never dispatches after persistence failure',async t=>{
 const x=fixture(t),client=freshAuthor(),c=x.command();let release,keeps=0;const gate=new Promise(r=>release=r);x.api.keepAtlasWriteReference=async()=>{keeps++;await gate;return{ok:false,error:'fsync failed'};};
 const task=client.writeAtlasCommit(c);const rival=await client.writeAtlasCommit(x.command());assert.equal(rival.ok,false);assert.deepEqual(client.pendingAtlasWrite(c.token),c);release();assert.equal((await task).ok,false);assert.equal(keeps,1);assert.equal(x.calls.writes,0);assert.equal(client.atlasWriteOwnerState(c.token).durableConfirmed,false);assert.deepEqual(client.pendingAtlasWrite(c.token),c);
});

test('real Main reference read/clear errors stay blocked and successful status never invents an acknowledgement',async t=>{
 const host=await desktopMainHost(t),cam=unwrap(await host.api.create('Clearing')),w=unwrap(await host.api.activateShell(cam.id));ownerDOM(t,host.api);const client=freshAuthor(),c=makeCommand(w),write=host.api.executeAtlasCommit;
 window.campaign={...host.api,executeAtlasCommit:async value=>{unwrap(await write(value));throw Error('lost');}};assert.equal((await client.writeAtlasCommit(c)).ok,false);
 const clear=host.api.clearAtlasWriteReference;window.campaign.clearAtlasWriteReference=async()=>({ok:false,error:'unlink failed'});
 const blocked=await client.recoverAtlasCommit(w.token);assert.equal(blocked.ok,false);assert.ok(client.pendingAtlasWrite(w.token));assert.equal((await client.writeAtlasCommit(makeCommand(w))).ok,false);
 window.campaign.clearAtlasWriteReference=clear;const done=unwrap(await client.recoverAtlasCommit(w.token));assert.deepEqual(done,{outcome:'applied'});assert.equal(host.dispatches.filter(d=>d.method==='executeAtlasCommit').length,1);
 const next=freshAuthor();window.campaign.atlasWriteReferences=async()=>({ok:false,error:'damaged reference'});assert.equal((await next.restoreAtlasWrites(cam.id,w.token)).ok,false);assert.ok(next.pendingAtlasWrite(w.token));assert.equal((await next.writeAtlasCommit(makeCommand(w))).ok,false);
 window.campaign.atlasWriteReferences=host.api.atlasWriteReferences;unwrap(await next.recoverAtlasCommit(w.token));assert.equal(next.pendingAtlasWrite(w.token),null);
});

test('activation waits late persistence and ignores a former owner result without clearing its reference',async t=>{
 const x=fixture(t),client=freshAuthor(),c=x.command(),keep=x.api.keepAtlasWriteReference;let release,entered;const gate=new Promise(r=>release=r),started=new Promise(r=>entered=r);
 x.api.keepAtlasWriteReference=async(...args)=>{const result=await keep(...args);entered();await gate;return result;};const writing=client.writeAtlasCommit(c);await started;
 const newer=x.store.activate(x.cam.id),activation=client.restoreAtlasWrites(x.cam.id,newer.token);assert.ok(client.pendingAtlasWrite(newer.token));assert.equal((await client.writeAtlasCommit({...x.command(),token:newer.token})).ok,false);release();assert.equal((await writing).ok,false);unwrap(await activation);
 assert.equal(x.calls.writes,0);assert.equal(client.pendingAtlasWrite(c.token),null);assert.equal(client.pendingAtlasWrite(newer.token).commandId,c.commandId);assert.equal(unwrap(await client.recoverAtlasCommit(newer.token)).outcome,'not-applied');
});

for(const restart of [false,true])test(`definitive first Graph rejection with failed clear: ${restart?'host loss stays unknown':'same Main witness permits exact clear retry'}`,async t=>{
 const host=await desktopMainHost(t),cam=unwrap(await host.api.create('Rejected first')),w=unwrap(await host.api.activateShell(cam.id));ownerDOM(t,host.api);let client=freshAuthor();
 const c={...makeCommand(w,'graph'),target:{kind:'graph-preview',previewId:randomUUID(),scopeId:'local',revision:99}},clear=host.api.clearAtlasWriteReference;
 window.campaign={...host.api,clearAtlasWriteReference:async()=>({ok:false,error:'unlink failed once'})};assert.equal((await client.atlasGraphWrite(c)).ok,false);assert.ok(client.pendingAtlasWrite(w.token));assert.equal(host.dispatches.filter(d=>d.method==='executeGraph').length,1);
 let token=w.token;
 if(restart){const fresh=await host.restart();token=unwrap(await fresh.api.activateShell(cam.id)).token;window.campaign=fresh.api;client=freshAuthor();unwrap(await client.restoreAtlasWrites(cam.id,token));}
 else window.campaign.clearAtlasWriteReference=clear;
 const recovered=await client.recoverAtlasCommit(token);
 if(restart){assert.equal(recovered.ok,false);assert.ok(client.pendingAtlasWrite(token));}
 else {assert.equal(recovered.ok,true);assert.equal(recovered.value.outcome,'not-applied');assert.equal(client.pendingAtlasWrite(token),null);assert.equal((await client.atlasGraphWrite(makeCommand(w,'graph'))).ok,true);}
});

for(const family of ['room','drawing','city','world','history'])for(const mode of ['before-execution','lost-response'])test(`real Main ${family} writer retains its original identity on ${mode} and fresh activation resolves without replay`,async t=>{
 const method=family==='room'?'atlasRoomCommit':family==='drawing'?'atlasDrawingCommit':family==='history'?'executeAtlas':'executeAtlas',host=await desktopMainHost(t,{workerFile:storeFaultWorker(method,mode)}),cam=unwrap(await host.api.create('Writer families')),w=unwrap(await host.api.activateShell(cam.id));
 const base=()=>({campaignId:cam.id,token:w.token,commandId:randomUUID()});unwrap(await host.api.executeAtlasCommit({...base(),action:{kind:'room-default'}}));
 let command,invoke;
 if(family==='room'||family==='drawing'){
  const r=unwrap(await host.api.campaignAtlas(w.token)).workspace.rooms[0];command=family==='room'?{...base(),roomId:r.id,expectedRevision:r.revision,name:'Saved room',polygons:r.polygons,sections:r.sections}:{...base(),action:{kind:'room-hide',roomId:r.id,hidden:true}};invoke=family==='room'?'atlasRoomWrite':'atlasDrawingWrite';
 } else if(family==='world') {
  const map=unwrap(await host.api.world(w.token)).maps[0];command={...base(),action:{kind:'map',map:{...map,name:'Saved world map'},expectedRevision:map.revision}};invoke='atlasWorldWrite';
 } else if(family==='city') {
  const ack=unwrap(await host.api.executeAtlasCommit({...base(),action:{kind:'city-create',name:'First',x:0,y:0,width:100,height:100}})),city=unwrap(await host.api.city(w.token,ack.result.id));
  command={...base(),cityId:city.header.id,expectedRevision:city.header.revision,action:{kind:'change',upsert:[],remove:[],header:{...city.header,name:'Saved city'},label:'Name'}};invoke='atlasCityWrite';
 }
 ownerDOM(t,host.api);const first=freshAuthor(),original=structuredClone(command);
 if(family==='history')assert.equal((await first.atlasHistoryWrite(w.token,cam.id,'undo')).ok,false);
 else {const response=await first[invoke](command).catch(error=>({ok:false,error:error.message}));assert.equal(response.ok,false);assert.deepEqual(command,original);}
 const retained=first.pendingAtlasWrite(w.token);assert.ok(retained);const id=retained.commandId;assert.equal(first.atlasWriteOwnerState(w.token).durableConfirmed,true);
 const fresh=await host.restart(),active=unwrap(await fresh.api.activateShell(cam.id));window.campaign=fresh.api;const second=freshAuthor();unwrap(await second.restoreAtlasWrites(cam.id,active.token));assert.equal(second.pendingAtlasWrite(active.token).commandId,id);
 const before=fresh.dispatches.length,reply=unwrap(await second.recoverAtlasCommit(active.token));assert.equal(reply.outcome,mode==='lost-response'?'applied':'not-applied');assert.equal(second.pendingAtlasWrite(active.token),null);assert.equal(fresh.dispatches.slice(before).some(d=>d.method===method),false);
});

test('a failed keep of a competing command retains the original durable owner rather than the new payload',async t=>{
 const x=fixture(t),client=freshAuthor(),first=x.command();x.api.executeAtlasCommit=async()=>{throw Error('not delivered');};await client.writeAtlasCommit(first);
 const fresh=freshAuthor(),rival=x.command();assert.equal((await fresh.writeAtlasCommit(rival)).ok,false);assert.equal(x.calls.writes,0);assert.equal(fresh.pendingAtlasWrite(first.token).commandId,first.commandId);assert.equal(fresh.pendingAtlasWrite(first.token).action,undefined);assert.equal(unwrap(await fresh.recoverAtlasCommit(first.token)).outcome,'not-applied');
});
