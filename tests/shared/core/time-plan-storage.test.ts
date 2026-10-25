import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test from 'node:test';
import type {TimePreview} from '../../../src/app/runtime/time-plan-contracts';
import {newLocation} from '../../../src/features/location/location-schema';
import {CampaignStore} from '../../../src/app/storage/store';

function fixture(){
 const root=mkdtempSync(join(tmpdir(),'time-plan-storage-')),store=new CampaignStore(join(root,'campaign.sqlite'),'test'),campaign=store.create('Zeitplan'),workspace=store.activate(campaign.id),scene=store.executeLive({commandId:'initialize',campaignId:campaign.id,token:workspace.token,action:{kind:'initialize',expectedRosterRevision:0}}).scene!;
 return{root,store,campaign,workspace,scene};
}

test('time preview rejects an unknown duration unit at the storage boundary',()=>{
 const f=fixture();
 try{assert.throws(()=>f.store.previewTime(f.workspace.token,{sceneId:f.scene.id,kind:'duration',amount:'1',unit:'fortnight' as any,reason:'Ungültige Einheit'}),/Zeiteinheit ist ungültig/);}
 finally{f.store.close();rmSync(f.root,{recursive:true,force:true});}
});

test('time preview includes every repeated event occurrence crossed by the jump',()=>{
 const f=fixture();
 try{
  f.store.executeWorld({commandId:'event',campaignId:f.campaign.id,token:f.workspace.token,action:{kind:'calendar-event',expectedRevision:null,event:{id:'watch',revision:0,name:'Wachwechsel',startMs:'3600000',durationMs:'60000',repeatMs:'3600000',locationId:null,notes:'',trashed:false}}});
  const preview:TimePreview=f.store.previewTime(f.workspace.token,{sceneId:f.scene.id,kind:'duration',amount:'4',unit:'hour',reason:'Vier Stunden warten'});
  assert.deepEqual(preview.events,[1,2,3,4].map(hour=>({name:'Wachwechsel',instantMs:String(hour*3600000)})));
 }finally{f.store.close();rmSync(f.root,{recursive:true,force:true});}
});

test('a bounded time preview reports all repeated starts without expanding the full interval',()=>{
 const f=fixture();try{
 f.store.executeWorld({commandId:'event',campaignId:f.campaign.id,token:f.workspace.token,action:{kind:'calendar-event',expectedRevision:null,event:{id:'watch',revision:0,name:'Wachwechsel',startMs:'1000',durationMs:'100',repeatMs:'1000',locationId:null,notes:'',trashed:false}}});
 const preview:TimePreview=f.store.previewTime(f.workspace.token,{sceneId:f.scene.id,kind:'instant',instantMs:'999999999999999999999999999000',reason:'Großer Zeitsprung'});
 assert.equal(preview.events.length,40);assert.equal(preview.eventCount,'999999999999999999999999999');
 assert.equal(preview.events[39]?.instantMs,'40000');
 }finally{f.store.close();rmSync(f.root,{recursive:true,force:true});}
});
test('time preview counts only future starts at this scene place, including single events',()=>{
 const f=fixture();try{for(const [id,startMs,repeatMs,locationId]of [['at-now','0',null,null],['single','1000',null,null],['repeat','1000','1000',null]] as const){f.store.executeWorld({commandId:id,campaignId:f.campaign.id,token:f.workspace.token,action:{kind:'calendar-event',expectedRevision:null,event:{id,revision:0,name:id,startMs,durationMs:'100',repeatMs,locationId,notes:'',trashed:false}}});}
 const place=newLocation('elsewhere','Fernort','poi',['description','notes']);f.store.changePreparation({commandId:'place',campaignId:f.campaign.id,token:f.workspace.token,change:{kind:'location',expectedRevision:null,document:place}});f.store.executeWorld({commandId:'remote',campaignId:f.campaign.id,token:f.workspace.token,action:{kind:'calendar-event',expectedRevision:null,event:{id:'remote',revision:0,name:'Fernereignis',startMs:'1000',durationMs:'100',repeatMs:'1000',locationId:place.id,notes:'',trashed:false}}});
 const preview:TimePreview=f.store.previewTime(f.workspace.token,{sceneId:f.scene.id,kind:'duration',amount:'3',unit:'second',reason:'Drei Sekunden'});assert.equal(preview.eventCount,'4');assert.deepEqual(preview.events.map(e=>e.instantMs),['1000','1000','2000','3000']);
 }finally{f.store.close();rmSync(f.root,{recursive:true,force:true});}
});

test('a damaged event cannot hide from time preview through its unverified trash flag',()=>{
 const f=fixture();try{
 const event={id:'deadline',revision:0,name:'Frist',startMs:'1000',durationMs:'100',repeatMs:null,locationId:null,notes:'',trashed:false};f.store.executeWorld({commandId:'event',campaignId:f.campaign.id,token:f.workspace.token,action:{kind:'calendar-event',expectedRevision:null,event}});
 (f.store as unknown as {db:any}).db.prepare("UPDATE world_record SET payload=? WHERE campaign_id=? AND kind='calendar-event' AND id=?").run(JSON.stringify({...event,revision:1,trashed:true}),f.campaign.id,event.id);
 assert.throws(()=>f.store.previewTime(f.workspace.token,{sceneId:f.scene.id,kind:'duration',amount:'3',unit:'second',reason:'Warten'}),/Kalenderereignis beschädigt/);
 }finally{f.store.close();rmSync(f.root,{recursive:true,force:true});}
});

test('time preview returns the first 40 of many interleaved definitions and excludes valid archives',()=>{
 const f=fixture();try{
 for(let i=70;i>0;i--){f.store.executeWorld({commandId:'event-'+i,campaignId:f.campaign.id,token:f.workspace.token,action:{kind:'calendar-event',expectedRevision:null,event:{id:'event-'+i,revision:0,name:'Beginn '+i,startMs:String(i*1000),durationMs:'100',repeatMs:null,locationId:null,notes:'',trashed:false}}});}
 f.store.executeWorld({commandId:'archived',campaignId:f.campaign.id,token:f.workspace.token,action:{kind:'calendar-event',expectedRevision:null,event:{id:'archived',revision:0,name:'Archiviert',startMs:'500',durationMs:'100',repeatMs:'1000',locationId:null,notes:'',trashed:true}}});
 const db=(f.store as unknown as {db:any}).db,before=db.serialize();const preview:TimePreview=f.store.previewTime(f.workspace.token,{sceneId:f.scene.id,kind:'duration',amount:'70',unit:'second',reason:'Warten'});
 assert.equal(preview.eventCount,'70');assert.deepEqual(preview.events.map(e=>e.instantMs),Array.from({length:40},(_,i)=>String((i+1)*1000)));assert.ok(before.equals(db.serialize()));assert.equal(f.store.live(f.workspace.token).scene?.clock.instantMs,'0');
 }finally{f.store.close();rmSync(f.root,{recursive:true,force:true});}
});
