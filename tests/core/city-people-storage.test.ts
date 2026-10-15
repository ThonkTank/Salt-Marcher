import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test from 'node:test';
import type {CityHeader,CityUnit} from '../../src/app/city-contracts';
import {CampaignStore} from '../../src/app/storage/store';
import {campaignLocalId} from '../../src/features/campaign/campaign-contracts';
import {newLocation} from '../../src/features/location/location-schema';

const npcId=(tail:string)=>campaignLocalId(`00000000-0000-4000-8000-${tail.padStart(12,'0')}`);
const building=(id:string,name:string):CityUnit=>({id,kind:'building',name,protected:true,position:{x:20,y:20},angle:0,outline:[{x:-5,y:-5},{x:5,y:-5},{x:5,y:5},{x:-5,y:5}],use:'Wohnhaus',notes:'',residentIds:[],workerIds:[],households:[],jobs:[],rooms:[],interior:false});
function fixture(label:string){
 const root=mkdtempSync(join(tmpdir(),label)),store=new CampaignStore(join(root,'campaign.sqlite'),'test'),campaign=store.create('Stadtleben'),workspace=store.activate(campaign.id),location=newLocation('city-place','Hafenstadt','city',['description','notes']),ada=npcId('701'),bert=npcId('702');
 store.changePreparation({commandId:'location',campaignId:campaign.id,token:workspace.token,change:{kind:'location',expectedRevision:null,document:location}});
 for(const [id,title] of [[ada,'Ada'],[bert,'Bert']] as const)store.changePreparation({commandId:'npc-'+id,campaignId:campaign.id,token:workspace.token,change:{kind:'note',expectedRevision:null,note:{version:1,id,revision:1,kind:'npc',title,readAloud:'',gmNotes:'',relations:[],creatureId:null,deleted:false}}});
 const header:CityHeader={id:'city',revision:1,name:'Hafenstadt',locationId:location.id,width:600,height:400,paper:'#e9dfc8',roof:'#9c604c'};
 store.executeCity({commandId:'city-create',campaignId:campaign.id,token:workspace.token,cityId:'city',expectedRevision:0,action:{kind:'create',header}});
 const home=building('home','Wohnhaus'),shop=building('shop','Werkstatt');
 const created=store.executeCity({commandId:'buildings',campaignId:campaign.id,token:workspace.token,cityId:'city',expectedRevision:1,action:{kind:'change',upsert:[home,shop],remove:[],label:'Häuser'}});
 return{root,store,campaign,workspace,ada,bert,home,shop,revision:created.header.revision};
}

test('city buildings bind existing World NPC homes and workplaces through exact undo and atomic moves',()=>{
 const f=fixture('city-people-');
 try{
  const assigned=f.store.executeCity({commandId:'assign',campaignId:f.campaign.id,token:f.workspace.token,cityId:'city',expectedRevision:f.revision,action:{kind:'change',upsert:[{...f.home,residentIds:[f.ada],workerIds:[f.bert]}],remove:[],label:'Personen binden'}});
  assert.deepEqual(assigned.units.find(u=>u.id==='home')?.residentIds,[f.ada]);
  assert.deepEqual(f.store.cities(f.workspace.token).assignedPeople.map(p=>p.name),['Ada','Bert']);
  const beforeFailure=assigned.header.revision;
  assert.throws(()=>f.store.executeCity({commandId:'duplicate',campaignId:f.campaign.id,token:f.workspace.token,cityId:'city',expectedRevision:beforeFailure,action:{kind:'change',upsert:[{...f.shop,residentIds:[f.ada]}],remove:[],label:'Doppelt'}}),/nur einen bestätigten wohnort/i);
  assert.equal(f.store.city(f.workspace.token,'city').header.revision,beforeFailure);
  const moved=f.store.executeCity({commandId:'move',campaignId:f.campaign.id,token:f.workspace.token,cityId:'city',expectedRevision:beforeFailure,action:{kind:'change',upsert:[{...f.home,residentIds:[],workerIds:[f.bert]},{...f.shop,residentIds:[f.ada],workerIds:[]}],remove:[],label:'Wohnort verschieben'}});
  assert.deepEqual(moved.units.find(u=>u.id==='shop')?.residentIds,[f.ada]);
  const undone=f.store.executeCity({commandId:'undo-move',campaignId:f.campaign.id,token:f.workspace.token,cityId:'city',expectedRevision:moved.header.revision,action:{kind:'undo'}});
  assert.deepEqual(undone.units.find(u=>u.id==='home')?.residentIds,[f.ada]);
  const redone=f.store.executeCity({commandId:'redo-move',campaignId:f.campaign.id,token:f.workspace.token,cityId:'city',expectedRevision:undone.header.revision,action:{kind:'redo'}});
  assert.deepEqual(redone.units.find(u=>u.id==='shop')?.residentIds,[f.ada]);
  assert.throws(()=>f.store.changePreparation({commandId:'trash-bound-npc',campaignId:f.campaign.id,token:f.workspace.token,change:{kind:'note-trash',id:f.ada,expectedRevision:1,trashed:true}}),/Bindung zuerst am Haus lösen/);
  assert.throws(()=>f.store.executeCity({commandId:'missing',campaignId:f.campaign.id,token:f.workspace.token,cityId:'city',expectedRevision:redone.header.revision,action:{kind:'change',upsert:[{...f.home,workerIds:['missing-npc']}],remove:[],label:'Fehlend'}}),/fehlenden oder gelöschten World-NPC/);
  assert.equal(f.store.city(f.workspace.token,'city').header.revision,redone.header.revision);
 }finally{f.store.close();rmSync(f.root,{recursive:true,force:true});}
});

test('city households own stable identity and move or dissolve without duplicating World NPCs',()=>{
 const f=fixture('city-households-');
 try{
  const household={id:'household-a',name:'Familie Abendrot',memberIds:[f.ada,f.bert]},assigned=f.store.executeCity({commandId:'household',campaignId:f.campaign.id,token:f.workspace.token,cityId:'city',expectedRevision:f.revision,action:{kind:'change',upsert:[{...f.home,residentIds:[f.ada,f.bert],households:[household]}],remove:[],label:'Haushalt anlegen'}});
  assert.deepEqual(assigned.units.find(u=>u.id==='home')?.households,[household]);
  assert.throws(()=>f.store.executeCity({commandId:'unprotect-household',campaignId:f.campaign.id,token:f.workspace.token,cityId:'city',expectedRevision:assigned.header.revision,action:{kind:'change',upsert:[{...assigned.units.find(u=>u.id==='home')!,protected:false}],remove:[],label:'Schutz lösen'}}),/vor Regeneration geschützt/);
  assert.throws(()=>f.store.executeCity({commandId:'household-member-duplicate',campaignId:f.campaign.id,token:f.workspace.token,cityId:'city',expectedRevision:assigned.header.revision,action:{kind:'change',upsert:[{...assigned.units.find(u=>u.id==='home')!,households:[household,{id:'household-b',name:'Doppelter Haushalt',memberIds:[f.ada]}]}],remove:[],label:'Doppelte Mitgliedschaft'}}),/nur einem Haushalt/);
  assert.throws(()=>f.store.executeCity({commandId:'delete-household-home',campaignId:f.campaign.id,token:f.workspace.token,cityId:'city',expectedRevision:assigned.header.revision,action:{kind:'change',upsert:[],remove:['home'],label:'Haus löschen'}}),/Haushalte.*zuerst verschieben oder auflösen/);
  const moved=f.store.executeCity({commandId:'move-household',campaignId:f.campaign.id,token:f.workspace.token,cityId:'city',expectedRevision:assigned.header.revision,action:{kind:'change',upsert:[{...assigned.units.find(u=>u.id==='home')!,residentIds:[],households:[]},{...f.shop,residentIds:[f.ada,f.bert],households:[household]}],remove:[],label:'Haushalt umziehen'}});
  assert.deepEqual(moved.units.find(u=>u.id==='shop')?.households,[household]);
  assert.deepEqual(moved.units.find(u=>u.id==='home')?.residentIds,[]);
  const undone=f.store.executeCity({commandId:'undo-household',campaignId:f.campaign.id,token:f.workspace.token,cityId:'city',expectedRevision:moved.header.revision,action:{kind:'undo'}});
  assert.deepEqual(undone.units.find(u=>u.id==='home')?.households,[household]);
  const redone=f.store.executeCity({commandId:'redo-household',campaignId:f.campaign.id,token:f.workspace.token,cityId:'city',expectedRevision:undone.header.revision,action:{kind:'redo'}});
  const dissolved=f.store.executeCity({commandId:'dissolve-household',campaignId:f.campaign.id,token:f.workspace.token,cityId:'city',expectedRevision:redone.header.revision,action:{kind:'change',upsert:[{...redone.units.find(u=>u.id==='shop')!,households:[]}],remove:[],label:'Haushalt auflösen'}});
  assert.deepEqual(dissolved.units.find(u=>u.id==='shop')?.households,[]);
  assert.deepEqual(dissolved.units.find(u=>u.id==='shop')?.residentIds,[f.ada,f.bert]);
 }finally{f.store.close();rmSync(f.root,{recursive:true,force:true});}
});

test('city jobs own stable identity and move with their workplace bindings',()=>{
 const f=fixture('city-jobs-');
 try{
  const job={id:'job-a',name:'Bäckerei',workerIds:[f.ada,f.bert]},assigned=f.store.executeCity({commandId:'job',campaignId:f.campaign.id,token:f.workspace.token,cityId:'city',expectedRevision:f.revision,action:{kind:'change',upsert:[{...f.home,workerIds:[f.ada,f.bert],jobs:[job]}],remove:[],label:'Beruf anlegen'}});
  assert.deepEqual(assigned.units.find(u=>u.id==='home')?.jobs,[job]);
  assert.throws(()=>f.store.executeCity({commandId:'unprotect-job',campaignId:f.campaign.id,token:f.workspace.token,cityId:'city',expectedRevision:assigned.header.revision,action:{kind:'change',upsert:[{...assigned.units.find(u=>u.id==='home')!,protected:false}],remove:[],label:'Schutz lösen'}}),/vor Regeneration geschützt/);
  assert.throws(()=>f.store.executeCity({commandId:'shared-life-id',campaignId:f.campaign.id,token:f.workspace.token,cityId:'city',expectedRevision:assigned.header.revision,action:{kind:'change',upsert:[{...assigned.units.find(u=>u.id==='home')!,residentIds:[f.ada],households:[{id:job.id,name:'Kollision',memberIds:[f.ada]}]}],remove:[],label:'Kennung doppelt'}}),/Lebensdatenkennung/);
  assert.throws(()=>f.store.executeCity({commandId:'job-worker-duplicate',campaignId:f.campaign.id,token:f.workspace.token,cityId:'city',expectedRevision:assigned.header.revision,action:{kind:'change',upsert:[{...assigned.units.find(u=>u.id==='home')!,jobs:[job,{id:'job-b',name:'Doppelter Beruf',workerIds:[f.ada]}]}],remove:[],label:'Doppelter Beruf'}}),/nur einem Stadtberuf/);
  assert.throws(()=>f.store.executeCity({commandId:'delete-job-home',campaignId:f.campaign.id,token:f.workspace.token,cityId:'city',expectedRevision:assigned.header.revision,action:{kind:'change',upsert:[],remove:['home'],label:'Haus löschen'}}),/Berufe.*zuerst verschieben oder auflösen/);
  const moved=f.store.executeCity({commandId:'move-job',campaignId:f.campaign.id,token:f.workspace.token,cityId:'city',expectedRevision:assigned.header.revision,action:{kind:'change',upsert:[{...assigned.units.find(u=>u.id==='home')!,workerIds:[],jobs:[]},{...f.shop,workerIds:[f.ada,f.bert],jobs:[job]}],remove:[],label:'Beruf umziehen'}});
  assert.deepEqual(moved.units.find(u=>u.id==='shop')?.jobs,[job]);
  assert.deepEqual(moved.units.find(u=>u.id==='home')?.workerIds,[]);
  const undone=f.store.executeCity({commandId:'undo-job',campaignId:f.campaign.id,token:f.workspace.token,cityId:'city',expectedRevision:moved.header.revision,action:{kind:'undo'}});
  assert.deepEqual(undone.units.find(u=>u.id==='home')?.jobs,[job]);
  const redone=f.store.executeCity({commandId:'redo-job',campaignId:f.campaign.id,token:f.workspace.token,cityId:'city',expectedRevision:undone.header.revision,action:{kind:'redo'}});
  const dissolved=f.store.executeCity({commandId:'dissolve-job',campaignId:f.campaign.id,token:f.workspace.token,cityId:'city',expectedRevision:redone.header.revision,action:{kind:'change',upsert:[{...redone.units.find(u=>u.id==='shop')!,jobs:[]}],remove:[],label:'Beruf auflösen'}});
  assert.deepEqual(dissolved.units.find(u=>u.id==='shop')?.jobs,[]);
  assert.deepEqual(dissolved.units.find(u=>u.id==='shop')?.workerIds,[f.ada,f.bert]);
 }finally{f.store.close();rmSync(f.root,{recursive:true,force:true});}
});

test('campaign transfer remaps city resident and workplace references with their World NPC identities',async()=>{
 const f=fixture('city-people-transfer-source-'),targetRoot=mkdtempSync(join(tmpdir(),'city-people-transfer-target-')),target=new CampaignStore(join(targetRoot,'campaign.sqlite'),'test');
 try{
  f.store.executeCity({commandId:'assign-transfer',campaignId:f.campaign.id,token:f.workspace.token,cityId:'city',expectedRevision:f.revision,action:{kind:'change',upsert:[{...f.home,residentIds:[f.ada,f.bert],workerIds:[f.bert],households:[{id:'household-transfer',name:'Familie Fernweg',memberIds:[f.ada,f.bert]}],jobs:[{id:'job-transfer',name:'Bäcker',workerIds:[f.bert]}]}],remove:[],label:'Personen binden'}});
  const snapshot=join(f.root,'campaign.snapshot.sqlite');await f.store.campaignSnapshot(f.workspace.token,snapshot);
  const imported=target.acceptCampaignSnapshot(snapshot,'Übernommene Stadt',{},'city-people-transfer'),opened=target.activate(imported.id),city=target.cities(opened.token).cities[0]!,view=target.city(opened.token,city.id),people=target.cities(opened.token).assignedPeople;
  const home=view.units.find(u=>u.name==='Wohnhaus')!;
  assert.equal(home.residentIds?.length,2);assert.equal(home.workerIds?.length,1);
  assert.notEqual(home.residentIds?.[0],f.ada);assert.notEqual(home.workerIds?.[0],f.bert);
  assert.deepEqual(new Set(people.map(p=>p.id)),new Set([home.residentIds![0]!,home.workerIds![0]!]));
  assert.deepEqual(people.map(p=>p.name).sort(),['Ada','Bert']);
  assert.notEqual(home.households?.[0]?.id,'household-transfer');
  assert.deepEqual(new Set(home.households?.[0]?.memberIds),new Set(home.residentIds));
  assert.notEqual(home.jobs?.[0]?.id,'job-transfer');
  assert.deepEqual(home.jobs?.[0]?.workerIds,home.workerIds);
 }finally{target.close();f.store.close();rmSync(targetRoot,{recursive:true,force:true});rmSync(f.root,{recursive:true,force:true});}
});
