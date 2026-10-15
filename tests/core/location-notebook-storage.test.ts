import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test from 'node:test';
import {CampaignStore} from '../../src/app/storage/store';
import {newLocation} from '../../src/features/location/location-schema';

test('location notebook rejects a checksum-valid location with a mismatched identity',()=>{
 const root=mkdtempSync(join(tmpdir(),'location-notebook-storage-')),store=new CampaignStore(join(root,'campaign.sqlite'),'test');
 try{
  const campaign=store.create('Ortsnotizbuch'),workspace=store.activate(campaign.id),location=newLocation('place','Nordtor','poi',['description','notes']);
  store.changePreparation({commandId:'location',campaignId:campaign.id,token:workspace.token,change:{kind:'location',expectedRevision:null,document:location}});
  const forged=JSON.stringify({...location,id:'other-place',name:'Verdeckter Titel'}),checksum=createHash('sha256').update(forged).digest('hex');
  (store as unknown as {db:any}).db.prepare('UPDATE location SET payload=?,checksum=? WHERE campaign_id=? AND id=?').run(forged,checksum,campaign.id,location.id);
  assert.throws(()=>store.locationMaterials(workspace.token,{locationId:null,kind:'directory',text:'',offset:0}),/widersprüchlich|beschädigt/);
 }finally{store.close();rmSync(root,{recursive:true,force:true});}
});

test('checked local events retain text search, stable pages and the original clock',()=>{
 const root=mkdtempSync(join(tmpdir(),'location-event-pages-')),store=new CampaignStore(join(root,'campaign.sqlite'),'test');
 try{
  const campaign=store.create('Ortsmappe'),workspace=store.activate(campaign.id),location=newLocation('place','Nordtor','poi',['description','notes']);
  store.changePreparation({commandId:'location',campaignId:campaign.id,token:workspace.token,change:{kind:'location',expectedRevision:null,document:location}});
  const scene=store.executeLive({commandId:'initialize',campaignId:campaign.id,token:workspace.token,action:{kind:'initialize',expectedRosterRevision:0}}).scene!;
  for(let i=44;i>=0;i--){const id='deadline-'+i;store.executeWorld({commandId:id,campaignId:campaign.id,token:workspace.token,action:{kind:'calendar-event',expectedRevision:null,event:{id,revision:0,name:'Frist '+String(i).padStart(2,'0'),startMs:String(i*60000),durationMs:'1000',repeatMs:null,locationId:location.id,notes:'',trashed:false}}});}
  const db=(store as unknown as {db:any}).db,before=db.serialize(),q={kind:'event' as const,locationId:location.id,text:'FRIST',offset:0},first=store.locationMaterials(workspace.token,q),last=store.locationMaterials(workspace.token,{...q,offset:first.next!});
  assert.equal(first.items.length,40);assert.equal(first.next,40);assert.equal(last.items.length,5);assert.equal(last.next,null);assert.deepEqual([...first.items,...last.items].map(row=>row.title),Array.from({length:45},(_,i)=>'Frist '+String(i).padStart(2,'0')));
  assert.equal(store.locationMaterials(workspace.token,{...q,text:'Frist 43'}).items[0]?.id,'deadline-43');assert.ok(db.serialize().equals(before));assert.deepEqual(store.live(workspace.token).scene!.clock,scene.clock);
 }finally{store.close();rmSync(root,{recursive:true,force:true});}
});

test('location notebook rejects a checksum-valid malformed calendar event',()=>{
 const root=mkdtempSync(join(tmpdir(),'location-notebook-event-')),store=new CampaignStore(join(root,'campaign.sqlite'),'test');
 try{
  const campaign=store.create('Ortsnotizbuch'),workspace=store.activate(campaign.id),location=newLocation('place','Nordtor','poi',['description','notes']);
  store.changePreparation({commandId:'location',campaignId:campaign.id,token:workspace.token,change:{kind:'location',expectedRevision:null,document:location}});
  store.executeWorld({commandId:'event',campaignId:campaign.id,token:workspace.token,action:{kind:'calendar-event',expectedRevision:null,event:{id:'market-day',revision:0,name:'Markttag',startMs:'3600000',durationMs:'60000',repeatMs:null,locationId:location.id,notes:'',trashed:false}}});
  const event={id:'market-day',revision:1,name:'Markttag',startMs:'3600000',durationMs:'60000',repeatMs:7,locationId:location.id,notes:'',trashed:false},payload=JSON.stringify(event),checksum=createHash('sha256').update(payload).digest('hex');
  (store as unknown as {db:any}).db.prepare("UPDATE world_record SET payload=?,checksum=? WHERE campaign_id=? AND kind='calendar-event' AND id=?").run(payload,checksum,campaign.id,event.id);
  assert.throws(()=>store.locationMaterials(workspace.token,{locationId:location.id,kind:'event',text:'',offset:0}),/Kalenderereignis.*beschädigt/);
 }finally{store.close();rmSync(root,{recursive:true,force:true});}
});
