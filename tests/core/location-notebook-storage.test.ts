import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
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
  assert.throws(()=>store.locationMaterials(workspace.token,{locationId:null,kind:'directory',text:'',offset:0}),/Ortszuordnung widersprüchlich/);
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

test('location group reads reject checksum-valid actor and profile identity substitutions',()=>{
 const root=mkdtempSync(join(tmpdir(),'location-notebook-group-')),store=new CampaignStore(join(root,'campaign.sqlite'),'test');
 try{
  const campaign=store.create('Ortsnotizbuch'),workspace=store.activate(campaign.id),command=(action:any)=>({commandId:randomUUID(),campaignId:campaign.id,token:workspace.token,action});
  const created=store.executeProgress(command({kind:'group-create',title:'Torwache',encounterId:null,expectedEncounterRevision:null})),group=store.groupView(workspace.token,created.groupId),draft={writeId:randomUUID(),groupId:group.id,revision:group.revision,title:group.title,notes:'',locationId:null,actors:[{id:null,creatureId:'goblin',revision:0,profileRevision:0,name:'Mira',hp:'7',maxHp:'7',tempHp:'0',conditions:'',concentrating:false,gmNotes:'',readAloud:''}]};
  store.keepGroupDraft(workspace.token,draft,null);store.executeProgress(command({kind:'group-edit',groupId:group.id,expectedRevision:group.revision,draft}));
  const actorId=store.groupView(workspace.token,group.id).actors[0]!.id,actorRow=(store as unknown as {db:any}).db.prepare('SELECT * FROM world_actor WHERE campaign_id=? AND id=?').get(campaign.id,actorId),actor=JSON.parse(actorRow.payload),forgedActor=JSON.stringify({...actor,id:randomUUID()});
  (store as unknown as {db:any}).db.prepare('UPDATE world_actor SET payload=?,checksum=? WHERE campaign_id=? AND id=?').run(forgedActor,createHash('sha256').update(forgedActor).digest('hex'),campaign.id,actorId);
  assert.throws(()=>store.groupView(workspace.token,group.id),/World-NPC ist falsch zugeordnet/);
  (store as unknown as {db:any}).db.prepare('UPDATE world_actor SET payload=?,checksum=? WHERE campaign_id=? AND id=?').run(actorRow.payload,actorRow.checksum,campaign.id,actorId);
  const noteRow=(store as unknown as {db:any}).db.prepare('SELECT * FROM world_note WHERE campaign_id=? AND id=?').get(campaign.id,actorId),note=JSON.parse(noteRow.payload),forgedNote=JSON.stringify({...note,id:randomUUID()});
  (store as unknown as {db:any}).db.prepare('UPDATE world_note SET payload=?,checksum=? WHERE campaign_id=? AND id=?').run(forgedNote,createHash('sha256').update(forgedNote).digest('hex'),campaign.id,actorId);
  assert.throws(()=>store.groupView(workspace.token,group.id),/NPC-Profil ist falsch zugeordnet/);
 }finally{store.close();rmSync(root,{recursive:true,force:true});}
});
