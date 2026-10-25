import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test from 'node:test';
import {CampaignStore} from '../../../src/app/storage/store';
import {newLocation} from '../../../src/features/location/location-schema';

test('agenda rejects malformed pagination authority at its storage boundary',()=>{
 const root=mkdtempSync(join(tmpdir(),'agenda-storage-')),store=new CampaignStore(join(root,'campaign.sqlite'),'test');
 try{
  const campaign=store.create('Agenda'),workspace=store.activate(campaign.id),query={sceneId:null,search:'',location:'all' as const,horizonDays:null,includePast:false,after:null};
  const page=store.agenda(workspace.token,query);
  assert.throws(()=>store.agenda(workspace.token,{...query,after:{sortMs:'not-an-instant',id:'event',instantMs:'0',calendarRevision:page.calendar.revision}}),/Cursor/);
 }finally{store.close();rmSync(root,{recursive:true,force:true});}
});

test('agenda does not display a location label from damaged source bytes',()=>{
 const root=mkdtempSync(join(tmpdir(),'agenda-location-')),store=new CampaignStore(join(root,'campaign.sqlite'),'test');
 try{
  const campaign=store.create('Agenda'),workspace=store.activate(campaign.id),location=newLocation('place','Nordtor','poi',['description','notes']);
  store.changePreparation({commandId:'location',campaignId:campaign.id,token:workspace.token,change:{kind:'location',expectedRevision:null,document:location}});
  store.executeWorld({commandId:'event',campaignId:campaign.id,token:workspace.token,action:{kind:'calendar-event',expectedRevision:null,event:{id:'event',revision:0,name:'Wache wechselt',startMs:'3600000',durationMs:'60000',repeatMs:null,locationId:location.id,notes:'',trashed:false}}});
  (store as unknown as {db:any}).db.prepare('UPDATE location SET checksum=? WHERE campaign_id=? AND id=?').run('broken',campaign.id,location.id);
  assert.throws(()=>store.agenda(workspace.token,{sceneId:null,search:'',location:'all',horizonDays:null,includePast:false,after:null}),/Agenda-Ort ist beschädigt/);
 }finally{store.close();rmSync(root,{recursive:true,force:true});}
});

for(const surface of ['agenda','notebook'] as const)for(const field of ['locationId','trashed','name'] as const)test(`${surface} does not hide an event whose damaged ${field} would exclude it`,()=>{
 const root=mkdtempSync(join(tmpdir(),'agenda-filter-')),store=new CampaignStore(join(root,'campaign.sqlite'),'test');
 try{
  const campaign=store.create('Agenda'),workspace=store.activate(campaign.id),location=newLocation('place','Nordtor','poi',['description','notes']);
  store.changePreparation({commandId:'location',campaignId:campaign.id,token:workspace.token,change:{kind:'location',expectedRevision:null,document:location}});
  const event={id:'event',revision:0,name:'Wache wechselt',startMs:'3600000',durationMs:'60000',repeatMs:null,locationId:location.id,notes:'',trashed:false};
  store.executeWorld({commandId:'event',campaignId:campaign.id,token:workspace.token,action:{kind:'calendar-event',expectedRevision:null,event}});
  const db=(store as unknown as {db:any}).db,row=db.prepare("SELECT payload FROM world_record WHERE campaign_id=? AND kind='calendar-event' AND id=?").get(campaign.id,event.id);
  const damaged={...JSON.parse(row.payload),[field]:field==='locationId'?'somewhere-else':field==='trashed'?true:'Changed title'};
  db.prepare("UPDATE world_record SET payload=? WHERE campaign_id=? AND kind='calendar-event' AND id=?").run(JSON.stringify(damaged),campaign.id,event.id);
  const before=db.serialize();
  assert.throws(()=>surface==='agenda'?store.agenda(workspace.token,{sceneId:null,location:'all',locationId:location.id,search:'Wache',horizonDays:null,includePast:true,after:null}):store.locationMaterials(workspace.token,{kind:'event',locationId:location.id,text:'Wache',offset:0}),/beschädigt/);
  assert.ok(db.serialize().equals(before));
 }finally{store.close();rmSync(root,{recursive:true,force:true});}
});

test('local agenda rejects a checksum-valid location belonging to another identity',()=>{
 const root=mkdtempSync(join(tmpdir(),'agenda-identity-')),store=new CampaignStore(join(root,'campaign.sqlite'),'test');
 try{const campaign=store.create('Identität'),w=store.activate(campaign.id),place=newLocation('place','Nordtor','poi',['description','notes']);
 store.changePreparation({commandId:'place',campaignId:campaign.id,token:w.token,change:{kind:'location',expectedRevision:null,document:place}});
 const payload=JSON.stringify({...place,id:'elsewhere',name:'Fremder Ort'});(store as unknown as {db:any}).db.prepare('UPDATE location SET payload=?,checksum=? WHERE campaign_id=? AND id=?').run(payload,createHash('sha256').update(payload).digest('hex'),campaign.id,place.id);
 assert.throws(()=>store.agenda(w.token,{sceneId:null,search:'',locationId:place.id,location:'all',horizonDays:null,includePast:true,after:null}),/Agenda-Ort.*(?:Identität|widersprüchlich)/);
 }finally{store.close();rmSync(root,{recursive:true,force:true});}
});

test('previously valid long calendar titles and notes remain readable and snapshot-compatible',async()=>{
 const root=mkdtempSync(join(tmpdir(),'agenda-compatible-')),store=new CampaignStore(join(root,'campaign.sqlite'),'test');
 try{const campaign=store.create('Bestandsdaten'),w=store.activate(campaign.id),event={id:'event',revision:0,name:'Original',startMs:'1000',durationMs:'1000',repeatMs:null,locationId:null,notes:'',trashed:false};
 store.executeWorld({commandId:'event',campaignId:campaign.id,token:w.token,action:{kind:'calendar-event',expectedRevision:null,event}});
 const original={...event,revision:1,name:'Titel '.repeat(201),notes:'Notiz'.repeat(400001)},payload=JSON.stringify(original),checksum=createHash('sha256').update(payload).digest('hex');
 (store as unknown as {db:any}).db.prepare("UPDATE world_record SET payload=?,checksum=? WHERE campaign_id=? AND kind='calendar-event' AND id=?").run(payload,checksum,campaign.id,event.id);
 assert.equal(store.world(w.token).events[0]?.notes,original.notes);
 const page=store.agenda(w.token,{sceneId:null,search:'',location:'all',horizonDays:null,includePast:true,after:null});assert.equal(page.items[0]?.event.name,original.name);assert.equal(page.items[0]?.event.notes,original.notes);
 await store.campaignSnapshot(w.token,join(root,'preserved.sqlite'));
 assert.equal((store as unknown as {db:any}).db.prepare("SELECT payload FROM world_record WHERE campaign_id=? AND kind='calendar-event' AND id=?").get(campaign.id,event.id).payload,payload);
 }finally{store.close();rmSync(root,{recursive:true,force:true});}
});
