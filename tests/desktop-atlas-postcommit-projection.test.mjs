import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import Database from 'better-sqlite3';
import {desktopMainHost} from './helpers/desktop-main-host.mjs';
import {atlasProjectionFault} from './helpers/atlas-projection-fault.mjs';

function ok(reply){assert.equal(reply.ok,true,reply.error);return reply.value;}
function unknown(reply){assert.equal(reply.ok,false);assert.equal(reply.errorKind,'store-outcome-unknown');assert.match(reply.error,/projection read failure/);}
const events=f=>readFileSync(f.trace,'utf8').trim().split('\n').map(line=>JSON.parse(line));
async function fixture(t,options){
 const fault=atlasProjectionFault(options),host=await desktopMainHost(t,{workerFile:fault.file});
 const campaign=ok(await host.api.create('Projection boundary')),shell=ok(await host.api.activateShell(campaign.id));
 return{host,fault,owner:{campaignId:campaign.id,token:shell.token}};
}
function command(owner,action={kind:'dungeon-create',name:'Saved exactly once',x:0,y:0}){return{...owner,commandId:randomUUID(),action};}
function state(host,owner){
 const db=new Database(host.store.filename,{readonly:true});
 try{return{
  atlas:db.prepare('SELECT revision,cursor FROM campaign_atlas WHERE campaign_id=?').get(owner.campaignId),
  receipts:db.prepare('SELECT command_id,fingerprint FROM atlas_receipt WHERE campaign_id=? ORDER BY command_id').all(owner.campaignId),
  history:db.prepare('SELECT command_id,payload FROM atlas_command WHERE campaign_id=? ORDER BY ordinal').all(owner.campaignId),
  roomHistory:db.prepare('SELECT ordinal FROM history WHERE campaign_id=? ORDER BY ordinal').all(owner.campaignId),
  terrain:db.prepare('SELECT id,payload FROM atlas_landscape WHERE campaign_id=? ORDER BY id').all(owner.campaignId),
 };}finally{db.close();}
}
function exactlyOne(before,after,c){
 assert.equal(after.atlas.revision,before.atlas.revision+1);
 assert.equal(after.atlas.cursor,before.atlas.cursor+1);
 assert.equal(after.history.length,before.history.length+1);
 assert.equal(after.receipts.length,before.receipts.length+1);
 assert.equal(after.receipts.filter(r=>r.command_id===c.commandId).length,1);
 assert.equal(after.history.at(-1).command_id,c.commandId);
}
async function recovered(host,c,before){
 const saved=state(host,c);exactlyOne(before,saved,c);
 for(let i=0;i<2;i++){
  const receipt=ok(await host.api.reconcileAtlasCommit(c));
  assert.equal(receipt.outcome,'applied');assert.equal(receipt.ack.commandId,c.commandId);assert.equal(receipt.ack.revision,saved.atlas.revision);
 }
 assert.deepEqual(state(host,c),saved,'receipt lookup must not write or create history');
 return saved;
}
function oneDispatch(host,method,c){
 const sent=host.dispatches.filter(m=>m.method===method&&m.value.value[0]?.commandId===c.commandId);
 assert.equal(sent.length,1,'one writer dispatch, never replayed for recovery');assert.deepEqual(sent[0].value.value[0],c);
}

for(const [target,reader] of [['executeAtlas','campaignAtlas'],['executeAtlasCommit','ack']])test(`${target}: real committed projection failure uses unknown transport and receipt-only recovery`,async t=>{
 const {host,fault,owner}=await fixture(t,{target,reader}),c=command(owner),original=structuredClone(c),before=state(host,owner);
 unknown(await host.api[target](c));
 const saved=await recovered(host,c,before),view=ok(await host.api.campaignAtlas(owner.token));
 assert(view.scopes.some(s=>s.name==='Saved exactly once'));
 assert.deepEqual(state(host,c),saved);assert.deepEqual(c,original);oneDispatch(host,target,c);
 assert.deepEqual(events(fault),[{reader,commandId:c.commandId,receipt:true,inTransaction:false}]);
});

async function room(host,owner){
 ok(await host.api.executeAtlasCommit(command(owner,{kind:'room-default'})));
 return ok(await host.api.campaignAtlas(owner.token)).workspace.rooms[0];
}
for(const reader of ['workspace','dungeonAuthoring'])test(`drawing commit: failed ${reader} retains one durable key edit and reloads separately`,async t=>{
 const target='atlasDrawingCommit',{host,fault,owner}=await fixture(t,{target,reader}),r=await room(host,owner);
 const c={...owner,commandId:randomUUID(),action:{kind:'key-batch',rooms:[{id:r.id,expectedRevision:r.revision,keyRevision:null}],patch:{gmNotes:{mode:'replace',text:'Only one stored note'}}}};
 const atlas={...c,action:{kind:'drawing',command:c}},before=state(host,owner);
 unknown(await host.api.atlasDrawingCommit(c));const saved=await recovered(host,atlas,before);
 const view=ok(await host.api.dungeonAuthoring(owner.token));assert(view.drawing.keyContent.find(k=>k.id===r.id).blocks.some(b=>b.text==='Only one stored note'));
 assert.deepEqual(state(host,owner),saved);oneDispatch(host,target,c);assert(events(fault).some(e=>e.reader===reader&&e.receipt&&!e.inTransaction));
});

test('room commit reads RoomCommit directly after one edit; failed response remains reconcilable',async t=>{
 const target='atlasRoomCommit',reader='readRoomCommit',{host,fault,owner}=await fixture(t,{target,reader}),r=await room(host,owner);
 const edit={...owner,commandId:randomUUID(),roomId:r.id,expectedRevision:r.revision,name:'Saved room title',polygons:r.polygons,sections:r.sections};
 const atlas={...owner,commandId:edit.commandId,action:{kind:'room-edit',edit}},before=state(host,owner);
 unknown(await host.api.atlasRoomCommit(edit));const saved=await recovered(host,atlas,before);
 assert.equal(saved.roomHistory.length,before.roomHistory.length+1);
 assert.equal(ok(await host.api.atlasRoom(owner.token,r.id)).name,edit.name);
 assert.deepEqual(state(host,owner),saved);oneDispatch(host,target,edit);
 assert.equal(events(fault).filter(e=>e.edit&&e.commandId===edit.commandId).length,1,'the response must not call edit again');
 assert(events(fault).some(e=>e.reader===reader&&e.receipt&&!e.inTransaction));
});

test('executeCity special worker path preserves a committed city change when its follow-up city read fails',async t=>{
 const target='executeCity',reader='city',{host,fault,owner}=await fixture(t,{target,reader});
 const created=ok(await host.api.executeAtlasCommit(command(owner,{kind:'city-create',name:'Original city',x:0,y:0,width:600,height:400}))),id=created.result.id;
 const city=ok(await host.api.city(owner.token,id)),c={...owner,commandId:randomUUID(),cityId:id,expectedRevision:city.header.revision,action:{kind:'change',upsert:[],remove:[],label:'City title',header:{...city.header,name:'Saved city'}}};
 const atlas={...owner,commandId:c.commandId,action:{kind:'city',command:c}},before=state(host,owner);
 unknown(await host.api.executeCity(c));const saved=await recovered(host,atlas,before);
 assert.equal(ok(await host.api.city(owner.token,id)).header.name,'Saved city');
 assert.deepEqual(state(host,owner),saved);oneDispatch(host,target,c);assert(events(fault).some(e=>e.reader===reader&&e.receipt&&!e.inTransaction));
});

test('the extracted RoomCommit reader retains the active graph preview source',async t=>{
 const host=await desktopMainHost(t),campaign=ok(await host.api.create('Graph source')),shell=ok(await host.api.activateShell(campaign.id)),owner={campaignId:campaign.id,token:shell.token};
 const r=await room(host,owner);
 ok(await host.api.executeGraph({...command(owner),scopeId:r.scopeId,action:{kind:'graph-move',roomIds:[r.id],dxSteps:2,dySteps:0}}));
 const preview=ok(await host.api.atlasRoom(owner.token,r.id));assert.notDeepEqual(preview.polygons,r.polygons);
 const edit={...owner,commandId:randomUUID(),roomId:r.id,expectedRevision:preview.revision,name:'Preview title',polygons:preview.polygons,sections:preview.sections};
 const reply=ok(await host.api.atlasRoomCommit(edit));assert.equal(reply.room.name,edit.name);assert.deepEqual(reply.room.polygons,preview.polygons);
 assert.deepEqual(ok(await host.api.atlasRoom(owner.token,r.id)),reply.room);oneDispatch(host,'atlasRoomCommit',edit);
});

const heightAction=()=>({kind:'landscape-height-stroke',stroke:{mode:'raise',radius:32,strength:100,feather:0,samples:[{x:0,y:0,t:0},{x:0,y:0,t:100}]}});
test('unprepared terrain cache follow-up fails after commit and remains unknown with the exact receipt',async t=>{
 const target='executeAtlas',reader='atlasRegionSource',{host,fault,owner}=await fixture(t,{target,reader}),c=command(owner,heightAction()),before=state(host,owner);
 unknown(await host.api.executeAtlas(c));const saved=await recovered(host,c,before);
 assert(saved.terrain.length>before.terrain.length);ok(await host.api.atlasRenderView(owner.token));assert.deepEqual(state(host,owner),saved);
 oneDispatch(host,target,c);assert(events(fault).some(e=>e.reader===reader&&e.receipt&&!e.inTransaction));
});

test('the same terrain cache failure inside the outer prepared transaction rolls back and stays definitive',async t=>{
 const target='executeAtlasCommit',reader='atlasRegionSource',{host,fault,owner}=await fixture(t,{target,reader}),c=command(owner,heightAction()),before=state(host,owner);
 const result=await host.api.executeAtlasCommit(c);assert.equal(result.ok,false);assert.equal(result.errorKind,undefined);assert.match(result.error,/atlasRegionSource projection read failure/);
 assert.equal(ok(await host.api.reconcileAtlasCommit(c)).outcome,'not-applied');assert.deepEqual(state(host,owner),before);
 oneDispatch(host,target,c);assert(host.dispatches.some(m=>m.method==='executeAtlasCommit'&&m.value.value[1]?.records.length>0),'Main used a real prepared terrain stroke');
 assert(events(fault).some(e=>e.reader===reader&&e.receipt&&e.inTransaction),'failure occurred after inner receipt insertion but before outer commit');
});

test('validation before commit stays definitive and leaves no receipt or history',async t=>{
 const {host,owner}=await fixture(t,{target:'executeAtlasCommit',reader:'ack'}),c=command(owner,{kind:'dungeon-create',name:'',x:0,y:0}),before=state(host,owner);
 const result=await host.api.executeAtlasCommit(c);assert.equal(result.ok,false);assert.equal(result.errorKind,undefined);
 assert.equal(ok(await host.api.reconcileAtlasCommit(c)).outcome,'not-applied');assert.deepEqual(state(host,owner),before);oneDispatch(host,'executeAtlasCommit',c);
});

test('failed receipt read does not fabricate non-application; explicit restart can resolve the original command without replay',async t=>{
 const target='executeAtlasCommit',{host,owner}=await fixture(t,{target,reader:'ack',blockReceipt:true}),c=command(owner),before=state(host,owner);
 unknown(await host.api.executeAtlasCommit(c));const saved=state(host,owner);exactlyOne(before,saved,c);
 const unclear=await host.api.reconcileAtlasCommit(c);assert.equal(unclear.ok,false);assert.match(unclear.error,/receipt projection read failure/);assert.equal('value' in unclear,false);
 assert.deepEqual(state(host,owner),saved);oneDispatch(host,target,c);
 const fresh=await host.restart(),shell=ok(await fresh.api.activateShell(owner.campaignId)),retained={...c,token:shell.token};
 const receipt=ok(await fresh.api.reconcileAtlasCommit(retained));assert.equal(receipt.outcome,'applied');assert.equal(receipt.ack.commandId,c.commandId);
 assert.deepEqual(state(fresh,owner),saved);assert.equal(fresh.dispatches.filter(m=>m.method===target).length,0);
});
