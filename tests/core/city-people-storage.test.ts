import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
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

test('cross-city NPC moves share one guarded undo and redo step',()=>{
 const f=fixture('city-cross-move-');
 try{
  const remoteLocation=newLocation('remote-place','Bergstadt','city',['description','notes']);
  f.store.changePreparation({commandId:'remote-location',campaignId:f.campaign.id,token:f.workspace.token,change:{kind:'location',expectedRevision:null,document:remoteLocation}});
  const remoteHeader:CityHeader={id:'remote-city',revision:1,name:'Bergstadt',locationId:remoteLocation.id,width:600,height:400,paper:'#e9dfc8',roof:'#9c604c'},remoteHome=building('remote-home','Haus am Hang');
  f.store.executeCity({commandId:'remote-create',campaignId:f.campaign.id,token:f.workspace.token,cityId:remoteHeader.id,expectedRevision:0,action:{kind:'create',header:remoteHeader}});
  const remote=f.store.executeCity({commandId:'remote-building',campaignId:f.campaign.id,token:f.workspace.token,cityId:remoteHeader.id,expectedRevision:1,action:{kind:'change',upsert:[remoteHome],remove:[],label:'Haus'}});
  const source=f.store.executeCity({commandId:'source-home',campaignId:f.campaign.id,token:f.workspace.token,cityId:'city',expectedRevision:f.revision,action:{kind:'change',upsert:[{...f.home,residentIds:[f.ada],households:[{id:'old-family',name:'Alte Familie',memberIds:[f.ada]}]}],remove:[],label:'Wohnort'}});
  const moved=f.store.executeCity({commandId:'cross-move',campaignId:f.campaign.id,token:f.workspace.token,cityId:remoteHeader.id,expectedRevision:remote.header.revision,action:{kind:'change',upsert:[{...remoteHome,residentIds:[f.ada],households:[{id:'new-family',name:'Neue Familie',memberIds:[f.ada]}]}],remove:[],label:'Stadtwechsel',bindingMoves:[{npcId:f.ada,role:'home',fromCityId:'city',fromUnitId:f.home.id,expectedRevision:source.header.revision}]}});
  assert.deepEqual(f.store.city(f.workspace.token,'city').units.find(u=>u.id===f.home.id)?.residentIds,[]);
  assert.deepEqual(moved.units.find(u=>u.id===remoteHome.id)?.residentIds,[f.ada]);
  const undone=f.store.executeCity({commandId:'undo-cross',campaignId:f.campaign.id,token:f.workspace.token,cityId:'city',expectedRevision:f.store.city(f.workspace.token,'city').header.revision,action:{kind:'undo'}});
  assert.deepEqual(undone.units.find(u=>u.id===f.home.id)?.residentIds,[f.ada]);
  assert.deepEqual(f.store.city(f.workspace.token,remoteHeader.id).units.find(u=>u.id===remoteHome.id)?.residentIds,[]);
  const redone=f.store.executeCity({commandId:'redo-cross',campaignId:f.campaign.id,token:f.workspace.token,cityId:remoteHeader.id,expectedRevision:f.store.city(f.workspace.token,remoteHeader.id).header.revision,action:{kind:'redo'}});
  assert.deepEqual(redone.units.find(u=>u.id===remoteHome.id)?.residentIds,[f.ada]);
  assert.deepEqual(f.store.city(f.workspace.token,'city').units.find(u=>u.id===f.home.id)?.residentIds,[]);
 }finally{f.store.close();rmSync(f.root,{recursive:true,force:true});}
});

test('cross-city household moves preserve the whole record in one guarded history step',()=>{
 const f=fixture('city-cross-household-');
 try{
  const remoteLocation=newLocation('remote-household-place','Bergstadt','city',['description','notes']);
  f.store.changePreparation({commandId:'remote-household-location',campaignId:f.campaign.id,token:f.workspace.token,change:{kind:'location',expectedRevision:null,document:remoteLocation}});
  const remoteHeader:CityHeader={id:'remote-household-city',revision:1,name:'Bergstadt',locationId:remoteLocation.id,width:600,height:400,paper:'#e9dfc8',roof:'#9c604c'},remoteHome=building('remote-household-home','Haus am Hang');
  f.store.executeCity({commandId:'remote-household-create',campaignId:f.campaign.id,token:f.workspace.token,cityId:remoteHeader.id,expectedRevision:0,action:{kind:'create',header:remoteHeader}});
  const remote=f.store.executeCity({commandId:'remote-household-building',campaignId:f.campaign.id,token:f.workspace.token,cityId:remoteHeader.id,expectedRevision:1,action:{kind:'change',upsert:[remoteHome],remove:[],label:'Haus'}});
  const household={id:'family',name:'Familie Abendrot',memberIds:[f.ada,f.bert]},job={id:'bakery',name:'Bäckerei',workerIds:[f.ada]};
  const source=f.store.executeCity({commandId:'source-household',campaignId:f.campaign.id,token:f.workspace.token,cityId:'city',expectedRevision:f.revision,action:{kind:'change',upsert:[{...f.home,residentIds:[f.ada,f.bert],workerIds:[f.ada],households:[household],jobs:[job]}],remove:[],label:'Familie und Beruf'}});
  assert.deepEqual(f.store.cityBuildings(f.workspace.token,{text:'Berg',offset:0,excludeUnitId:f.home.id}),{items:[{cityId:remoteHeader.id,unitId:remoteHome.id,title:remoteHome.name,cityTitle:remoteHeader.name}],next:null});
  assert.throws(()=>f.store.executeCity({commandId:'incomplete-household-move',campaignId:f.campaign.id,token:f.workspace.token,cityId:remoteHeader.id,expectedRevision:remote.header.revision,action:{kind:'change',upsert:[{...remoteHome,residentIds:[f.ada],households:[household]}],remove:[],label:'Unvollständiger Umzug',lifeMoves:[{role:'home',recordId:household.id,fromCityId:'city',fromUnitId:f.home.id,expectedRevision:source.header.revision,toUnitId:remoteHome.id}]}}),/Mitglieder fehlen/);
  const moved=f.store.executeCity({commandId:'household-cross-move',campaignId:f.campaign.id,token:f.workspace.token,cityId:remoteHeader.id,expectedRevision:remote.header.revision,action:{kind:'change',upsert:[{...remoteHome,residentIds:[f.ada,f.bert],households:[household]}],remove:[],label:'Haushalt umziehen',lifeMoves:[{role:'home',recordId:household.id,fromCityId:'city',fromUnitId:f.home.id,expectedRevision:source.header.revision,toUnitId:remoteHome.id}]}});
  const sourceAfter=f.store.city(f.workspace.token,'city').units.find(u=>u.id===f.home.id)!;
  assert.deepEqual({residents:sourceAfter.residentIds,households:sourceAfter.households,workers:sourceAfter.workerIds,jobs:sourceAfter.jobs},{residents:[],households:[],workers:[f.ada],jobs:[job]});
  assert.deepEqual(moved.units.find(u=>u.id===remoteHome.id)?.households,[household]);
  const undone=f.store.executeCity({commandId:'undo-household-cross',campaignId:f.campaign.id,token:f.workspace.token,cityId:'city',expectedRevision:f.store.city(f.workspace.token,'city').header.revision,action:{kind:'undo'}});
  assert.deepEqual(undone.units.find(u=>u.id===f.home.id)?.households,[household]);
  assert.deepEqual(f.store.city(f.workspace.token,remoteHeader.id).units.find(u=>u.id===remoteHome.id)?.households,[]);
  const redone=f.store.executeCity({commandId:'redo-household-cross',campaignId:f.campaign.id,token:f.workspace.token,cityId:remoteHeader.id,expectedRevision:f.store.city(f.workspace.token,remoteHeader.id).header.revision,action:{kind:'redo'}});
  assert.deepEqual(redone.units.find(u=>u.id===remoteHome.id)?.households,[household]);
  assert.deepEqual(f.store.city(f.workspace.token,'city').units.find(u=>u.id===f.home.id)?.households,[]);
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

test('NPC places expose canonical city roles and disable hidden dungeon rooms',()=>{
 const f=fixture('npc-places-');
 try{
  f.store.executeCity({commandId:'places',campaignId:f.campaign.id,token:f.workspace.token,cityId:'city',expectedRevision:f.revision,action:{kind:'change',upsert:[{...f.home,residentIds:[f.ada],workerIds:[f.ada],households:[{id:'household',name:'Familie Abendrot',memberIds:[f.ada]}],jobs:[{id:'job',name:'Bäcker',workerIds:[f.ada]}]}],remove:[],label:'Schauplätze binden'}});
  const room=f.store.addRoom(f.workspace.token).rooms[0]!,pose={scopeId:room.scopeId,floorId:room.floorId,roomId:room.id,x:1,y:1,z:0},payload=JSON.stringify(pose),checksum=createHash('sha256').update(payload).digest('hex');
  (f.store as unknown as {db:any}).db.prepare('INSERT INTO npc_position VALUES(?,?,?,?)').run(f.campaign.id,f.ada,null,1);
  (f.store as unknown as {db:any}).db.prepare('INSERT INTO npc_dungeon_position VALUES(?,?,?,?)').run(f.campaign.id,f.ada,payload,checksum);
  const page=f.store.npcPlaces(f.workspace.token,f.ada,0);
  assert.deepEqual(page.sites.map(site=>site.kind),['dungeon','home','work']);
  assert.match(page.sites.find(site=>site.kind==='home')!.detail,/Familie Abendrot/);
  assert.match(page.sites.find(site=>site.kind==='work')!.detail,/Bäcker/);
  assert.equal(page.sites.find(site=>site.kind==='dungeon')!.available,true);
  (f.store as unknown as {db:any}).db.prepare("INSERT INTO drawing_hidden VALUES(?,?,?,'room',0,1)").run(f.campaign.id,room.id,room.scopeId);
  assert.equal(f.store.npcPlaces(f.workspace.token,f.ada,0).sites.find(site=>site.kind==='dungeon')!.available,false);
  const note=(f.store as unknown as {db:any}).db.prepare('SELECT * FROM world_note WHERE campaign_id=? AND id=?').get(f.campaign.id,f.ada),body=JSON.parse(note.payload),forged=JSON.stringify({...body,id:randomUUID()});
  (f.store as unknown as {db:any}).db.prepare('UPDATE world_note SET payload=?,checksum=? WHERE campaign_id=? AND id=?').run(forged,createHash('sha256').update(forged).digest('hex'),f.campaign.id,f.ada);
  assert.throws(()=>f.store.npcPlaces(f.workspace.token,f.ada,0),/NPC-Profil ist falsch zugeordnet/);
 }finally{f.store.close();rmSync(f.root,{recursive:true,force:true});}
});

test('campaign transfer remaps city resident and workplace references with their World NPC identities',async()=>{
 const f=fixture('city-people-transfer-source-'),targetRoot=mkdtempSync(join(tmpdir(),'city-people-transfer-target-')),target=new CampaignStore(join(targetRoot,'campaign.sqlite'),'test');
 try{
  f.store.executeCity({commandId:'assign-transfer',campaignId:f.campaign.id,token:f.workspace.token,cityId:'city',expectedRevision:f.revision,action:{kind:'change',upsert:[{...f.home,residentIds:[f.ada,f.bert],workerIds:[f.bert],households:[{id:'household-transfer',name:'Familie Fernweg',memberIds:[f.ada,f.bert]}],jobs:[{id:'job-transfer',name:'Bäcker',workerIds:[f.bert]}]}],remove:[],label:'Personen binden'}});
  f.store.executeWorldRelationPair({commandId:'pair-transfer',campaignId:f.campaign.id,token:f.workspace.token,action:{kind:'add',sourceId:f.ada,targetId:f.bert,sourceRevision:1,targetRevision:1,forwardLabel:'beschützt',reverseLabel:'wird beschützt von'}});
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
  const notes=target.preparation(opened.token,'').notes.map(row=>row.note),ada=notes.find(note=>note.title==='Ada')!,bert=notes.find(note=>note.title==='Bert')!;assert.deepEqual(ada.relations,[{targetId:bert.id,label:'beschützt'}]);assert.deepEqual(bert.relations,[{targetId:ada.id,label:'wird beschützt von'}]);
 }finally{target.close();f.store.close();rmSync(targetRoot,{recursive:true,force:true});rmSync(f.root,{recursive:true,force:true});}
});

test('NPC place reads use the canonical city household and job without moving the World actor',()=>{
 const f=fixture('city-npc-places-');
 try{
  f.store.executeCity({commandId:'bind-places',campaignId:f.campaign.id,token:f.workspace.token,cityId:'city',expectedRevision:f.revision,action:{kind:'change',upsert:[{...f.home,residentIds:[f.ada],households:[{id:'family',name:'Familie am Tor',memberIds:[f.ada]}]},{...f.shop,workerIds:[f.ada],jobs:[{id:'job',name:'Schmiedin',workerIds:[f.ada]}]}],remove:[],label:'Wohnort und Beruf'}});
  const before=f.store.npc(f.workspace.token,f.ada),db=(f.store as unknown as {db:any}).db,bytes=db.serialize(),places=f.store.npcPlaces(f.workspace.token,f.ada,0);
  assert.deepEqual(places.sites.map(site=>site.kind),['work','home']);assert.ok(places.sites.every(site=>site.available));assert.match(places.sites.find(site=>site.kind==='home')!.detail,/Familie am Tor/);assert.match(places.sites.find(site=>site.kind==='work')!.detail,/Schmiedin/);assert.equal(places.next,null);
  assert.deepEqual(db.serialize(),bytes);assert.deepEqual(f.store.npc(f.workspace.token,f.ada),before);assert.deepEqual(f.store.npcPlaces(f.workspace.token,f.bert,0).sites,[]);
 }finally{f.store.close();rmSync(f.root,{recursive:true,force:true});}
});
