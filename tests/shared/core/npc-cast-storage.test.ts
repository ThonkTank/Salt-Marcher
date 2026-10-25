import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test from 'node:test';
import {saveGroup} from '../../../src/app/storage/session';
import {CampaignStore} from '../../../src/app/storage/store';
import {campaignLocalId} from '../../../src/features/campaign/campaign-contracts';
import {newLocation} from '../../../src/features/location/location-schema';
import {dailyPlanAt} from '../../../src/app/campaign/npc-daily-plan';

const hash=(payload:string)=>createHash('sha256').update(payload).digest('hex');
function fixture(){
 const root=mkdtempSync(join(tmpdir(),'npc-cast-storage-')),store=new CampaignStore(join(root,'campaign.sqlite'),'test'),campaign=store.create('NSC-Dossier'),workspace=store.activate(campaign.id),scene=store.executeLive({commandId:'initialize',campaignId:campaign.id,token:workspace.token,action:{kind:'initialize',expectedRosterRevision:0}}).scene!,npcId=campaignLocalId('00000000-0000-4000-8000-000000000401');
 store.changePreparation({commandId:'npc',campaignId:campaign.id,token:workspace.token,change:{kind:'note',expectedRevision:null,note:{version:1,id:npcId,revision:1,kind:'npc',title:'Hafenwache',readAloud:'',gmNotes:'',relations:[],creatureId:null,deleted:false}}});
 return{root,db:(store as unknown as {db:any}).db,store,campaign,workspace,scene,npcId};
}

test('npc dossier rejects a checksum-valid malformed location source',()=>{
 const f=fixture();
 try{
  const location=newLocation('place','Nordtor','poi',['description','notes']);
  f.store.changePreparation({commandId:'location',campaignId:f.campaign.id,token:f.workspace.token,change:{kind:'location',expectedRevision:null,document:location}});
  f.db.prepare('INSERT INTO npc_position VALUES(?,?,?,1)').run(f.campaign.id,f.npcId,location.id);
  const payload=JSON.stringify({name:7});f.db.prepare('UPDATE location SET payload=?,checksum=? WHERE campaign_id=? AND id=?').run(payload,hash(payload),f.campaign.id,location.id);
  assert.throws(()=>f.store.npcDossier(f.workspace.token,f.scene.id,f.npcId),/native Daten|Ortsdatei|Dossierquelle/);
 }finally{f.store.close();rmSync(f.root,{recursive:true,force:true});}
});

test('npc dossier limits the combined outgoing and incoming relation excerpt',()=>{
 const f=fixture();
 try{
  const insert=f.db.prepare('INSERT INTO world_note VALUES(?,?,1,0,?,?)');
  for(let i=0;i<41;i++){
   const id=campaignLocalId(`00000000-0000-4000-8000-${String(500+i).padStart(12,'0')}`),payload=JSON.stringify({version:1,id,revision:1,kind:'npc',title:`Kontakt ${String(i).padStart(2,'0')}`,readAloud:'',gmNotes:'',relations:[{targetId:f.npcId,label:'kennt'}],creatureId:null,deleted:false});
   insert.run(f.campaign.id,id,payload,hash(payload));
  }
  const dossier=f.store.npcDossier(f.workspace.token,f.scene.id,f.npcId);
  assert.equal(dossier.relationCount,41);assert.equal(dossier.relations.length,40);assert.ok(dossier.relations.every((relation:{incoming:boolean})=>relation.incoming));
 }finally{f.store.close();rmSync(f.root,{recursive:true,force:true});}
});

test('daily plans follow group time, reject overlaps and search only authored plan text',()=>{
 const f=fixture();
 try{
  const old=f.store.npc(f.workspace.token,f.npcId),dailyPlan=[
   {id:'night',startMinute:1380,endMinute:120,activity:'Nachtwache',place:'home' as const,notes:'Am Nordtor lauschen'},
   {id:'day',startMinute:480,endMinute:1020,activity:'Torwache',place:'work' as const,notes:'Besucherbuch führen'},
  ];
  const dailyOverrides=[{day:'2',label:'Ruhetag am Markt',slots:[]}],saved=f.store.executeNpc({commandId:'daily-plan',campaignId:f.campaign.id,token:f.workspace.token,expectedNoteRevision:old.noteRevision,expectedRecordRevision:old.record.revision,expectedActorRevision:old.actorRevision,expectedPositionRevision:old.positionRevision,npc:{id:old.id,name:old.name,creatureId:old.creatureId,readAloud:old.readAloud,gmNotes:old.gmNotes,record:{...old.record,dailyPlan,dailyOverrides},locationId:old.locationId,health:old.health}});
  const dossier=f.store.npcDossier(f.workspace.token,f.scene.id,f.npcId);
  assert.deepEqual(dossier.dailyPlan?.current,dailyPlan[0]);assert.deepEqual(dossier.dailyPlan?.next,dailyPlan[1]);assert.equal(dossier.dailyPlan?.secondsUntilNext,28800);assert.equal(dossier.dailyPlan?.problem,null);assert.deepEqual(dossier.dailyPlan?.weekdayTitles,['Erster Tag','Zweiter Tag','Dritter Tag','Vierter Tag','Fünfter Tag','Sechster Tag','Siebter Tag']);
  const query=(text:string)=>f.store.npcs(f.workspace.token,{text,lifecycle:'all',factionId:null,locationId:null,offset:0});
  assert.equal(query('Besucherbuch').total,1);assert.equal(query('Ruhetag am Markt').total,1);assert.equal(query('home').total,0);assert.equal(query('night').total,0);
  assert.throws(()=>f.store.executeNpc({commandId:'overlapping-plan',campaignId:f.campaign.id,token:f.workspace.token,expectedNoteRevision:saved.noteRevision,expectedRecordRevision:saved.record.revision,expectedActorRevision:saved.actorRevision,expectedPositionRevision:saved.positionRevision,npc:{id:saved.id,name:saved.name,creatureId:saved.creatureId,readAloud:saved.readAloud,gmNotes:saved.gmNotes,record:{...saved.record,dailyPlan:[...dailyPlan,{id:'overlap',startMinute:60,endMinute:180,activity:'Rundgang',place:'other',notes:''}]},locationId:saved.locationId,health:saved.health}}),/überschneiden/);
  assert.equal(f.store.npc(f.workspace.token,f.npcId).record.revision,saved.record.revision);
  const world=f.store.world(f.workspace.token);f.store.executeWorld({commandId:'short-day',campaignId:f.campaign.id,token:f.workspace.token,action:{kind:'calendar',calendar:{...world.calendar,daySeconds:72000},expectedRevision:world.calendar.revision}});
  const invalid=f.store.npcDossier(f.workspace.token,f.scene.id,f.npcId).dailyPlan!;assert.match(invalid.problem??'',/Tageslänge/);assert.equal(invalid.current,null);assert.equal(invalid.next,null);
 }finally{f.store.close();rmSync(f.root,{recursive:true,force:true});}
});

test('weekday plans and full-day exceptions suppress overnight spill and find the next recurrence',()=>{
 const night={id:'night',startMinute:1380,endMinute:120,activity:'Nachtwache',place:'home' as const,notes:'',weekdays:[0]};
 const ordinary=dailyPlanAt([night],String(86400_000+30*60_000),86400,7,[]);assert.deepEqual(ordinary.current,night);assert.equal(ordinary.startsOnPreviousDay,true);
 const rest=dailyPlanAt([night],String(86400_000+30*60_000),86400,7,[{day:'2',label:'Marktruhe',slots:[]}]);assert.equal(rest.current,null);assert.equal(rest.overrideLabel,'Marktruhe');assert.equal(rest.nextDay,'8');assert.deepEqual(rest.next,night);
});

function legacyGroup(f:ReturnType<typeof fixture>){
 const place=newLocation('north','Nordtor','poi',['description','notes']);f.store.changePreparation({commandId:'place',campaignId:f.campaign.id,token:f.workspace.token,change:{kind:'location',expectedRevision:null,document:place}});
 saveGroup(f.db,f.campaign.id,{id:'guard',revision:1,title:'Wache',notes:'',sourceEncounterId:'source',sourceRevision:1,locationId:place.id,actors:[{id:f.npcId,entryId:'entry'}],plan:{entries:[],sources:[]}} as any,null,null);return place;
}
for(const field of ['actors','notes','locationId'] as const)test(`a damaged legacy group ${field} cannot determine an NPC location`,()=>{
 const f=fixture();try{
  const place=legacyGroup(f);assert.equal(f.store.npc(f.workspace.token,f.npcId).locationId,place.id);
  const row=f.db.prepare('SELECT payload FROM prepared_group WHERE campaign_id=? AND id=?').get(f.campaign.id,'guard'),body=JSON.stringify({...JSON.parse(row.payload),[field]:field==='actors'?[]:field==='notes'?'Geänderter Text':'elsewhere'});
  f.db.prepare('UPDATE prepared_group SET payload=? WHERE campaign_id=? AND id=?').run(body,f.campaign.id,'guard');const before=f.db.serialize();
  assert.throws(()=>f.store.npc(f.workspace.token,f.npcId),/beschädigt|widersprüchlich/);assert.ok(f.db.serialize().equals(before));
 }finally{f.store.close();rmSync(f.root,{recursive:true,force:true});}
});

test('moving an explicitly placed NPC cannot bless damaged group bytes with a new checksum',()=>{
 const f=fixture();try{
  const place=legacyGroup(f);f.db.prepare('INSERT INTO npc_position VALUES(?,?,?,1)').run(f.campaign.id,f.npcId,place.id);
  const old=f.store.npc(f.workspace.token,f.npcId),row=f.db.prepare('SELECT payload FROM prepared_group WHERE campaign_id=? AND id=?').get(f.campaign.id,'guard');
  f.db.prepare('UPDATE prepared_group SET payload=? WHERE campaign_id=? AND id=?').run(JSON.stringify({...JSON.parse(row.payload),notes:'Beschädigter Text'}),f.campaign.id,'guard');const before=f.db.serialize();
  assert.throws(()=>f.store.executeNpc({commandId:'move',campaignId:f.campaign.id,token:f.workspace.token,expectedNoteRevision:old.noteRevision,expectedRecordRevision:old.record.revision,expectedActorRevision:old.actorRevision,expectedPositionRevision:old.positionRevision,npc:{id:old.id,name:old.name,creatureId:old.creatureId,readAloud:old.readAloud,gmNotes:old.gmNotes,record:old.record,locationId:null,health:old.health}}),/beschädigt|widersprüchlich/);
  assert.ok(f.db.serialize().equals(before));
 }finally{f.store.close();rmSync(f.root,{recursive:true,force:true});}
});

test('legacy group fallback and an explicit unplaced position keep their existing precedence',()=>{
 const f=fixture();try{
  const place=legacyGroup(f),before=f.db.serialize();
  assert.equal(f.store.npc(f.workspace.token,f.npcId).locationId,place.id);
  assert.equal(f.store.locationMaterials(f.workspace.token,{kind:'npc',locationId:place.id,text:'',offset:0}).items[0]?.id,f.npcId);assert.ok(f.db.serialize().equals(before));
  f.db.prepare('INSERT INTO npc_position VALUES(?,?,NULL,1)').run(f.campaign.id,f.npcId);const explicit=f.db.serialize();
  assert.equal(f.store.npc(f.workspace.token,f.npcId).locationId,null);
  assert.equal(f.store.locationMaterials(f.workspace.token,{kind:'npc',locationId:place.id,text:'',offset:0}).items.length,0);assert.ok(f.db.serialize().equals(explicit));
 }finally{f.store.close();rmSync(f.root,{recursive:true,force:true});}
});

test('a location-owned shop does not depend on an unrelated prepared group at that place',()=>{
 const f=fixture();try{
  const place=legacyGroup(f);f.store.executeItemShop({commandId:'shop',campaignId:f.campaign.id,token:f.workspace.token,action:{kind:'shop',expectedRevision:null,shop:{id:'shop',revision:0,name:'Wachhaus',owner:{kind:'location',id:place.id},notes:'',trashed:false,stock:[]}}});
  f.db.prepare('UPDATE prepared_group SET checksum=? WHERE campaign_id=? AND id=?').run('broken',f.campaign.id,'guard');const before=f.db.serialize();
  assert.equal(f.store.locationMaterials(f.workspace.token,{kind:'shop',locationId:place.id,text:'Wach',offset:0}).items[0]?.id,'shop');assert.ok(f.db.serialize().equals(before));
 }finally{f.store.close();rmSync(f.root,{recursive:true,force:true});}
});
