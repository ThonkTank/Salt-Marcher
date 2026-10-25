import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test from 'node:test';
import {saveGroup} from '../../../src/app/storage/session';
import {CampaignStore} from '../../../src/app/storage/store';
import {newLocation} from '../../../src/features/location/location-schema';

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

for(const kind of ['directory','npc','narrative','group','shop','faction'] as const)test(`local ${kind} filtering cannot hide damaged source bytes`,()=>{
 const root=mkdtempSync(join(tmpdir(),'material-filter-')),store=new CampaignStore(join(root,'campaign.sqlite'),'test');
 try{
  const campaign=store.create('Material'),w=store.activate(campaign.id),location=newLocation(randomUUID(),'Wache','poi',['description','notes']),command=(action:any)=>({commandId:kind,campaignId:campaign.id,token:w.token,action}),db=(store as unknown as {db:any}).db;
  store.changePreparation({commandId:'location',campaignId:campaign.id,token:w.token,change:{kind:'location',expectedRevision:null,document:location}});
  let table='location',key='id',id=location.id,field='name',value:unknown='Anderer Titel';
  if(kind==='npc'){
   id=randomUUID();store.executeNpc({...command(null),expectedNoteRevision:null,expectedRecordRevision:0,expectedActorRevision:null,expectedPositionRevision:null,npc:{id,name:'Wache',creatureId:null,readAloud:'',gmNotes:'',record:{id,revision:0,factionId:null,modifier:0,lifecycle:'active',appearance:'',behavior:'',history:''},locationId:location.id,health:null}});
   table='world_note';field='kind';value='rule';
  }else if(kind==='narrative'||kind==='faction'){
   id=randomUUID();store.changePreparation({commandId:'note',campaignId:campaign.id,token:w.token,change:{kind:'note',expectedRevision:null,note:{version:1,id:id as any,revision:1,kind:kind==='narrative'?'quest':'faction',title:'Wache',readAloud:'',gmNotes:'',relations:[],creatureId:null,deleted:false}}});
   if(kind==='narrative'){const view=store.narrative(w.token,id);store.executeProgress(command({kind:'narrative-state',expectedRevision:view.state.revision,expectedNoteRevision:view.noteRevision,state:{...view.state,locationId:location.id}}));table='narrative_state';key='note_id';field='locationId';value='elsewhere';}
   else{store.executeGeneration(command({kind:'source-save',expectedRevision:null,source:{kind:'location',id:location.id,revision:0,tableIds:[],factionIds:[id],stock:[]}}));table='world_note';field='title';}
  }else if(kind==='group'){
   id='group';saveGroup(db,campaign.id,{id,revision:1,title:'Wache',notes:'',sourceEncounterId:'source',sourceRevision:1,locationId:location.id,actors:[],plan:{entries:[],sources:[]}} as any,null,null);table='prepared_group';field='title';
  }else if(kind==='shop'){
   id='shop';store.executeItemShop(command({kind:'shop',expectedRevision:null,shop:{id,revision:0,name:'Wache',owner:{kind:'location',id:location.id},notes:'',trashed:false,stock:[]}}));table='shop';field='owner';value={kind:'location',id:'elsewhere'};
  }
  const q={kind,locationId:kind==='directory'?null:location.id,text:'Wache',offset:0};assert.equal(store.locationMaterials(w.token,q).items.length,1);
  const row=db.prepare(`SELECT payload FROM ${table} WHERE campaign_id=? AND ${key}=?`).get(campaign.id,id),damaged={...JSON.parse(row.payload),[field]:value};db.prepare(`UPDATE ${table} SET payload=? WHERE campaign_id=? AND ${key}=?`).run(JSON.stringify(damaged),campaign.id,id);const before=db.serialize();
  assert.throws(()=>store.locationMaterials(w.token,q));assert.ok(db.serialize().equals(before));
 }finally{store.close();rmSync(root,{recursive:true,force:true});}
});

test('individual NPC placement controls both the local cast and NPC-owned shops without writes',()=>{
 const root=mkdtempSync(join(tmpdir(),'material-position-')),store=new CampaignStore(join(root,'campaign.sqlite'),'test');
 try{
  const campaign=store.create('Orte'),w=store.activate(campaign.id),command=(action:any)=>({commandId:randomUUID(),campaignId:campaign.id,token:w.token,action}),places=['Nordtor','Hafen'].map(name=>newLocation(randomUUID(),name,'poi',['description','notes']));
  for(const document of places)store.changePreparation({commandId:randomUUID(),campaignId:campaign.id,token:w.token,change:{kind:'location',expectedRevision:null,document}});
  const id=randomUUID(),npc={id,name:'Händlerin',creatureId:null,readAloud:'',gmNotes:'',record:{id,revision:0,factionId:null,modifier:0,lifecycle:'active' as const,appearance:'',behavior:'',history:''},locationId:places[0]!.id,health:null};
  let saved=store.executeNpc({...command(null),expectedNoteRevision:null,expectedRecordRevision:0,expectedActorRevision:null,expectedPositionRevision:null,npc});
  store.executeItemShop(command({kind:'shop',expectedRevision:null,shop:{id:'shop',revision:0,name:'Handel',owner:{kind:'npc',id},notes:'',trashed:false,stock:[]}}));
  const read=(place:number,kind:'npc'|'shop')=>store.locationMaterials(w.token,{kind,locationId:places[place]!.id,text:'',offset:0});
  assert.equal(read(0,'npc').items[0]?.id,id);assert.equal(read(0,'shop').items[0]?.id,'shop');assert.equal(read(1,'shop').items.length,0);
  saved=store.executeNpc({...command(null),expectedNoteRevision:saved.noteRevision,expectedRecordRevision:saved.record.revision,expectedActorRevision:saved.actorRevision,expectedPositionRevision:saved.positionRevision,npc:{...npc,record:saved.record,locationId:places[1]!.id}});
  const db=(store as unknown as {db:any}).db,before=db.serialize();assert.equal(read(0,'npc').items.length,0);assert.equal(read(0,'shop').items.length,0);assert.equal(read(1,'npc').items[0]?.id,id);assert.equal(read(1,'shop').items[0]?.id,'shop');assert.ok(db.serialize().equals(before));
 }finally{store.close();rmSync(root,{recursive:true,force:true});}
});

test('campaign material search includes other places and unbound narratives without rebinding them',()=>{
 const root=mkdtempSync(join(tmpdir(),'material-campaign-')),store=new CampaignStore(join(root,'campaign.sqlite'),'test');
 try{
  const campaign=store.create('Kampagnenmaterial'),w=store.activate(campaign.id),command=(action:any)=>({commandId:randomUUID(),campaignId:campaign.id,token:w.token,action}),places=['Tor','Hafen'].map(name=>newLocation(randomUUID(),name,'poi',['description','notes']));
  for(const document of places)store.changePreparation({commandId:randomUUID(),campaignId:campaign.id,token:w.token,change:{kind:'location',expectedRevision:null,document}});
  const id=randomUUID(),quest=randomUUID();store.executeNpc({...command(null),expectedNoteRevision:null,expectedRecordRevision:0,expectedActorRevision:null,expectedPositionRevision:null,npc:{id,name:'Wache',creatureId:null,readAloud:'',gmNotes:'',record:{id,revision:0,factionId:null,modifier:0,lifecycle:'active',appearance:'',behavior:'',history:''},locationId:places[1]!.id,health:null}});
  store.changePreparation({commandId:randomUUID(),campaignId:campaign.id,token:w.token,change:{kind:'note',expectedRevision:null,note:{version:1,id:quest as any,revision:1,kind:'quest',title:'Wache suchen',readAloud:'',gmNotes:'',relations:[],creatureId:null,deleted:false}}});
  store.executeItemShop(command({kind:'shop',expectedRevision:null,shop:{id:'shop',revision:0,name:'Wachbedarf',owner:{kind:'location',id:places[1]!.id},notes:'',trashed:false,stock:[]}}));
  const db=(store as unknown as {db:any}).db;
  saveGroup(db,campaign.id,{id:'watch-group',revision:1,title:'Wachgruppe',notes:'',sourceEncounterId:'',sourceRevision:0,locationId:places[1]!.id,actors:[],plan:{entries:[],sources:[]}} as any,null,null);
  const before=db.serialize();
  for(const kind of ['npc','narrative','shop','group'] as const){const q={kind,locationId:places[0]!.id,text:'Wach',offset:0};assert.equal(store.locationMaterials(w.token,q).items.length,0);const page=store.locationMaterials(w.token,{...q,scope:'campaign'});assert.equal(page.items.length,1);assert.equal(page.items[0]?.locationId,kind==='narrative'?null:places[1]!.id);}
  assert.equal(store.npc(w.token,id).locationId,places[1]!.id);assert.equal(store.narrative(w.token,quest).state.locationId,null);assert.ok(db.serialize().equals(before));
  assert.throws(()=>store.locationMaterials(w.token,{kind:'faction',locationId:places[0]!.id,text:'',offset:0,scope:'campaign'}),/Suche|suche/);
  const archived=store.preparation(w.token).locations.find(row=>row.document.id===places[1]!.id)!;store.changePreparation({commandId:randomUUID(),campaignId:campaign.id,token:w.token,change:{kind:'location-trash',id:places[1]!.id,expectedRevision:archived.revision,trashed:true}});
  const archivedBytes=db.serialize(),found=store.locationMaterials(w.token,{kind:'npc',locationId:places[0]!.id,text:'Wache',offset:0,scope:'campaign'});
  assert.equal(found.items[0]?.id,id);assert.equal(found.items[0]?.locationId,places[1]!.id);assert.match(found.items[0]!.detail,/Hafen/);assert.ok(db.serialize().equals(archivedBytes));
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
  assert.throws(()=>store.groupView(workspace.token,group.id),/NPC-Zuordnung|zugeordnet/);
  (store as unknown as {db:any}).db.prepare('UPDATE world_actor SET payload=?,checksum=? WHERE campaign_id=? AND id=?').run(actorRow.payload,actorRow.checksum,campaign.id,actorId);
  const noteRow=(store as unknown as {db:any}).db.prepare('SELECT * FROM world_note WHERE campaign_id=? AND id=?').get(campaign.id,actorId),note=JSON.parse(noteRow.payload),forgedNote=JSON.stringify({...note,id:randomUUID()});
  (store as unknown as {db:any}).db.prepare('UPDATE world_note SET payload=?,checksum=? WHERE campaign_id=? AND id=?').run(forgedNote,createHash('sha256').update(forgedNote).digest('hex'),campaign.id,actorId);
  assert.throws(()=>store.groupView(workspace.token,group.id),/NPC-Profilzuordnung|zugeordnet/);
 }finally{store.close();rmSync(root,{recursive:true,force:true});}
});
