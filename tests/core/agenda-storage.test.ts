import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test from 'node:test';
import {CampaignStore} from '../../src/app/storage/store';
import {newLocation} from '../../src/features/location/location-schema';

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

test('local agenda rejects a checksum-valid location belonging to another identity',()=>{
 const root=mkdtempSync(join(tmpdir(),'agenda-identity-')),store=new CampaignStore(join(root,'campaign.sqlite'),'test');
 try{const campaign=store.create('Identität'),w=store.activate(campaign.id),place=newLocation('place','Nordtor','poi',['description','notes']);
 store.changePreparation({commandId:'place',campaignId:campaign.id,token:w.token,change:{kind:'location',expectedRevision:null,document:place}});
 const payload=JSON.stringify({...place,id:'elsewhere',name:'Fremder Ort'});(store as unknown as {db:any}).db.prepare('UPDATE location SET payload=?,checksum=? WHERE campaign_id=? AND id=?').run(payload,createHash('sha256').update(payload).digest('hex'),campaign.id,place.id);
 assert.throws(()=>store.agenda(w.token,{sceneId:null,search:'',locationId:place.id,location:'all',horizonDays:null,includePast:true,after:null}),/Agenda-Ort.*(?:Identität|widersprüchlich)/);
 }finally{store.close();rmSync(root,{recursive:true,force:true});}
});
test('a damaged event cannot disappear from a local agenda through its unverified location field',()=>{
 const root=mkdtempSync(join(tmpdir(),'agenda-filter-')),store=new CampaignStore(join(root,'campaign.sqlite'),'test');
 try{const campaign=store.create('Ortsfrist'),w=store.activate(campaign.id),place=newLocation('place','Nordtor','poi',['description','notes']);
 store.changePreparation({commandId:'place',campaignId:campaign.id,token:w.token,change:{kind:'location',expectedRevision:null,document:place}});
 const event={id:'deadline',revision:0,name:'Frist',startMs:'3600000',durationMs:'60000',repeatMs:null,locationId:place.id,notes:'',trashed:false};store.executeWorld({commandId:'deadline',campaignId:campaign.id,token:w.token,action:{kind:'calendar-event',expectedRevision:null,event}});
 (store as unknown as {db:any}).db.prepare("UPDATE world_record SET payload=? WHERE campaign_id=? AND kind='calendar-event' AND id=?").run(JSON.stringify({...event,revision:1,locationId:'unverified-other-place'}),campaign.id,event.id);
 assert.throws(()=>store.agenda(w.token,{sceneId:null,search:'',locationId:place.id,location:'all',horizonDays:null,includePast:true,after:null}),/Kalenderereignis beschädigt/);
 }finally{store.close();rmSync(root,{recursive:true,force:true});}
});
