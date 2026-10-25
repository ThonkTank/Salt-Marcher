import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
import path from 'node:path';
import {buildSync} from './helpers/build.mjs';
import {desktopMainHost,storeFaultWorker,mainHostBuildRoot} from './helpers/desktop-main-host.mjs';

function ok(reply){assert.equal(reply.ok,true,reply.error);return reply.value;}
function unknown(reply){assert.equal(reply.ok,false);assert.equal(reply.errorKind,'store-outcome-unknown',reply.error);assert.equal(typeof reply.error,'string');}
async function campaign(host){const c=ok(await host.api.create('Unknown outcome'));const shell=ok(await host.api.activateShell(c.id));return{campaignId:c.id,token:shell.token};}
function command(owner,name='One stored scope'){return{...owner,commandId:randomUUID(),action:{kind:'dungeon-create',name,x:0,y:0}};}
const writes=host=>host.dispatches.filter(m=>m.method==='executeAtlasCommit');

for(const fault of ['before-execution','lost-response','uncloneable-response'])test(`real ${fault} reaches Main/preload as typed unknown and receipts never replay the write`,async t=>{
 const host=await desktopMainHost(t,{workerFile:storeFaultWorker('executeAtlasCommit',fault)}),owner=await campaign(host),c=command(owner);
 const saved=structuredClone(c),before=ok(await host.api.atlasRenderView(owner.token)).revision;
 unknown(await host.api.executeAtlasCommit(c));assert.equal(writes(host).length,1,'one initial dispatch');
 let reader=host,receiptCommand=c;
 if(fault!=='uncloneable-response'){
  unknown(await host.api.reconcileAtlasCommit(c));assert.equal(writes(host).length,1);
  reader=await host.restart();const shell=ok(await reader.api.activateShell(owner.campaignId));receiptCommand={...c,token:shell.token};
 }
 const first=ok(await reader.api.reconcileAtlasCommit(receiptCommand)),second=ok(await reader.api.reconcileAtlasCommit(receiptCommand));
 assert.deepEqual(second,first);assert.equal(first.outcome,fault==='before-execution'?'not-applied':'applied');
 const view=ok(await reader.api.atlasRenderView(receiptCommand.token));assert.equal(view.revision,before+(fault==='before-execution'?0:1));
 assert.equal(writes(host).length,1);if(reader!==host)assert.equal(writes(reader).length,0,'fresh writer performs receipt reads only');
 assert.deepEqual(c,saved,'transport never changes the retained command');
});

test('definitive store validation remains an ordinary failed Result with no receipt or revision change',async t=>{
 const host=await desktopMainHost(t),owner=await campaign(host),c=command(owner,'');
 const before=ok(await host.api.atlasRenderView(owner.token)).revision,result=await host.api.executeAtlasCommit(c);
 assert.equal(result.ok,false);assert.equal(result.errorKind,undefined);assert.match(result.error,/Name|prüfen/);
 assert.equal(ok(await host.api.reconcileAtlasCommit(c)).outcome,'not-applied');assert.equal(ok(await host.api.atlasRenderView(owner.token)).revision,before);
 assert.equal(writes(host).length,1);
});

test('ordinary worker error text cannot impersonate StoreOutcomeUnknownError',async t=>{
 const host=await desktopMainHost(t,{workerFile:storeFaultWorker('executeAtlasCommit','misleading-error')}),owner=await campaign(host),c=command(owner,'');
 const result=await host.api.executeAtlasCommit(c);assert.equal(result.ok,false);assert.match(result.error,/Speicherbestätigung ungeklärt.*StoreOutcomeUnknownError/);
 assert.equal(result.errorKind,undefined,'classification uses the actual Main error class, not its text');
 assert.equal(ok(await host.api.reconcileAtlasCommit(c)).outcome,'not-applied');assert.equal(writes(host).length,1);
});

test('successful worker result is unchanged and repeat receipt reads do not add a history step',async t=>{
 const host=await desktopMainHost(t),owner=await campaign(host),c=command(owner),before=ok(await host.api.atlasRenderView(owner.token)).revision;
 const result=await host.api.executeAtlasCommit(c),ack=ok(result);assert.equal('errorKind' in result,false);assert.equal(ack.commandId,c.commandId);assert.equal(ack.revision,before+1);
 for(let i=0;i<2;i++){const receipt=ok(await host.api.reconcileAtlasCommit(c));assert.equal(receipt.outcome,'applied');assert.equal(receipt.ack.revision,ack.revision);}
 assert.equal(writes(host).length,1);assert.equal(ok(await host.api.atlasRenderView(owner.token)).revision,ack.revision);
});


test('existing writeConfirmed keeps a real lost-response receipt and resolves it after explicit restart without another write',async t=>{
 const output=path.join(mainHostBuildRoot,'commit-confirmation.cjs');
 buildSync({entryPoints:['src/app/commit-confirmation.ts'],outfile:output,bundle:true,platform:'node',format:'cjs'});
 const confirmation=createRequire(import.meta.url)(output);
 const host=await desktopMainHost(t,{workerFile:storeFaultWorker('executeItemShop','lost-response')}),owner=await campaign(host);
 const savedWindow=globalThis.window,savedDocument=globalThis.document,storage=new Map();
 globalThis.window={campaign:host.api,localStorage:{getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,value),removeItem:key=>storage.delete(key)}};
 globalThis.document={getElementById:()=>null};
 t.after(()=>{if(savedWindow===undefined)delete globalThis.window;else globalThis.window=savedWindow;if(savedDocument===undefined)delete globalThis.document;else globalThis.document=savedDocument;});
 let context={campaign:{id:owner.campaignId},token:owner.token};
 confirmation.initCommitControls(()=>context,()=>{});
 const c={...owner,commandId:randomUUID(),action:{kind:'definition',expectedRevision:null,definition:{id:randomUUID(),revision:0,name:'Seil',category:'equipment',magic:false,rarity:'',attunement:'no',unitCopper:'200',weightText:'',properties:[],description:'Original',source:{kind:'authored',label:'GM',license:null,url:null},trashed:false}}};
 await assert.rejects(confirmation.writeConfirmed('items',c,async()=>{const reply=await host.api.executeItemShop(c);unknown(reply);return reply;},()=>true,{token:owner.token}),/Buchungsantwort fehlt/);
 assert.equal(confirmation.hasPendingCommit(owner.campaignId),true);
 const ref=JSON.parse(storage.get('pending-booking:'+owner.campaignId));assert.equal(ref.commandId,c.commandId);
 const restarted=await host.restart(),shell=ok(await restarted.api.activateShell(owner.campaignId));
 window.campaign=restarted.api;context={campaign:{id:owner.campaignId},token:shell.token};
 const applied=ok(await restarted.api.commitStatus(ref,shell.token));assert.equal(applied.outcome,'applied');assert.equal(applied.value.definition.id,c.action.definition.id);
 await confirmation.checkPendingCommit();assert.equal(confirmation.hasPendingCommit(owner.campaignId),false);
 await confirmation.checkPendingCommit();assert.deepEqual(ok(await restarted.api.commitStatus(ref,shell.token)),applied);
 assert.equal(host.dispatches.filter(m=>m.method==='executeItemShop').length,1);
 assert.equal(restarted.dispatches.filter(m=>m.method==='executeItemShop').length,0);
});
