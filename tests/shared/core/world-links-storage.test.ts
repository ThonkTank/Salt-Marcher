import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test from 'node:test';
import {CampaignStore} from '../../../src/app/storage/store';
import {campaignLocalId} from '../../../src/features/campaign/campaign-contracts';

const hash=(payload:string)=>createHash('sha256').update(payload).digest('hex');

test('campaign connections reject a checksum-valid note with a forged identity',()=>{
 const root=mkdtempSync(join(tmpdir(),'world-links-storage-')),store=new CampaignStore(join(root,'campaign.sqlite'),'test');
 try{
  const campaign=store.create('Zusammenhänge'),workspace=store.activate(campaign.id),id=campaignLocalId('00000000-0000-4000-8000-000000000601');
  store.changePreparation({commandId:'note',campaignId:campaign.id,token:workspace.token,change:{kind:'note',expectedRevision:null,note:{version:1,id,revision:1,kind:'npc',title:'Hafenwache',readAloud:'',gmNotes:'',relations:[],creatureId:null,deleted:false}}});
  const forged=campaignLocalId('00000000-0000-4000-8000-000000000602'),payload=JSON.stringify({version:1,id:forged,revision:1,kind:'npc',title:'Hafenwache',readAloud:'',gmNotes:'',relations:[],creatureId:null,deleted:false});
  (store as unknown as {db:any}).db.prepare('UPDATE world_note SET payload=?,checksum=? WHERE campaign_id=? AND id=?').run(payload,hash(payload),campaign.id,id);
  assert.throws(()=>store.worldLinks(workspace.token,{text:'',kind:'world',offset:0,focus:null}),/widerspricht ihrer Identität/);
 }finally{store.close();rmSync(root,{recursive:true,force:true});}
});

test('reciprocal campaign relations add and remove both directions atomically with recoverable receipts',()=>{
 const root=mkdtempSync(join(tmpdir(),'world-link-pair-')),store=new CampaignStore(join(root,'campaign.sqlite'),'test');
 try{
  const campaign=store.create('Beziehungspaar'),workspace=store.activate(campaign.id),source=campaignLocalId('00000000-0000-4000-8000-000000000611'),target=campaignLocalId('00000000-0000-4000-8000-000000000612');
  for(const [id,title] of [[source,'Ada'],[target,'Bert']] as const)store.changePreparation({commandId:'note-'+id,campaignId:campaign.id,token:workspace.token,change:{kind:'note',expectedRevision:null,note:{version:1,id,revision:1,kind:'npc',title,readAloud:'',gmNotes:'',relations:[],creatureId:null,deleted:false}}});
  const addWriteId='pair-add-draft',add={commandId:'pair-add',campaignId:campaign.id,token:workspace.token,draftWriteId:addWriteId,action:{kind:'add' as const,sourceId:source,targetId:target,sourceRevision:1,targetRevision:1,forwardLabel:'beschützt',reverseLabel:'wird beschützt von'}};
  store.keepWorldRelationPairDraft(workspace.token,{version:1,writeId:addWriteId,command:add},null);
  assert.throws(()=>store.executeWorldRelationPair({...add,commandId:'pair-add-tampered',action:{...add.action,forwardLabel:'bestiehlt'}}),/stimmt nicht mit seinem Entwurf überein/);
  const added=store.executeWorldRelationPair(add);assert.deepEqual(added,{sourceRevision:2,targetRevision:2});assert.deepEqual(store.executeWorldRelationPair(add),added);assert.deepEqual(store.reconcileWorldRelationPair(add,workspace.token),{outcome:'applied',targetChanged:false});
  let notes=store.preparation(workspace.token,'').notes.map(row=>row.note);assert.deepEqual(notes.find(note=>note.id===source)?.relations,[{targetId:target,label:'beschützt'}]);assert.deepEqual(notes.find(note=>note.id===target)?.relations,[{targetId:source,label:'wird beschützt von'}]);
  const staleRemove={commandId:'pair-remove-stale',campaignId:campaign.id,token:workspace.token,action:{kind:'remove' as const,sourceId:source,targetId:target,sourceRevision:2,targetRevision:1,forwardLabel:'beschützt',reverseLabel:'wird beschützt von'}};
  assert.throws(()=>store.executeWorldRelationPair(staleRemove),/Konflikt/);notes=store.preparation(workspace.token,'').notes.map(row=>row.note);assert.equal(notes.find(note=>note.id===source)?.relations.length,1);assert.equal(notes.find(note=>note.id===target)?.relations.length,1);
  const remove={commandId:'pair-remove',campaignId:campaign.id,token:workspace.token,action:{...staleRemove.action,targetRevision:2}};const writeId='pair-draft';store.keepWorldRelationPairDraft(workspace.token,{version:1,writeId,command:{...remove,draftWriteId:writeId}},null);assert.equal(store.worldRelationPairDraft(workspace.token,source)?.writeId,writeId);
  assert.deepEqual(store.executeWorldRelationPair({...remove,draftWriteId:writeId}),{sourceRevision:3,targetRevision:3});assert.equal(store.worldRelationPairDraft(workspace.token,source),null);notes=store.preparation(workspace.token,'').notes.map(row=>row.note);assert.equal(notes.find(note=>note.id===source)?.relations.length,0);assert.equal(notes.find(note=>note.id===target)?.relations.length,0);
  assert.deepEqual(store.worldRelationPairHistory(workspace.token),{cursor:2,canUndo:true,canRedo:false,undoLabel:'Paar lösen: Ada ↔ Bert · beschützt / wird beschützt von',redoLabel:null});
  const undoRemove={commandId:'undo-remove',campaignId:campaign.id,token:workspace.token,expectedCursor:2,direction:'undo' as const};assert.equal(store.executeWorldRelationPairHistory(undoRemove).cursor,1);assert.equal(store.executeWorldRelationPairHistory(undoRemove).cursor,1);notes=store.preparation(workspace.token,'').notes.map(row=>row.note);assert.equal(notes.find(note=>note.id===source)?.relations.length,1);assert.equal(notes.find(note=>note.id===target)?.relations.length,1);
  assert.equal(store.executeWorldRelationPairHistory({commandId:'undo-add',campaignId:campaign.id,token:workspace.token,expectedCursor:1,direction:'undo'}).cursor,0);notes=store.preparation(workspace.token,'').notes.map(row=>row.note);assert.equal(notes.find(note=>note.id===source)?.relations.length,0);assert.equal(notes.find(note=>note.id===target)?.relations.length,0);
  assert.equal(store.executeWorldRelationPairHistory({commandId:'redo-add',campaignId:campaign.id,token:workspace.token,expectedCursor:0,direction:'redo'}).cursor,1);assert.equal(store.executeWorldRelationPairHistory({commandId:'redo-remove',campaignId:campaign.id,token:workspace.token,expectedCursor:1,direction:'redo'}).cursor,2);
  const current=store.preparation(workspace.token,'').notes.find(row=>row.note.id===source)!.note;store.changePreparation({commandId:'rename-after-history',campaignId:campaign.id,token:workspace.token,change:{kind:'note',expectedRevision:current.revision,note:{...current,title:'Ada verändert'}}});assert.throws(()=>store.executeWorldRelationPairHistory({commandId:'blocked-undo',campaignId:campaign.id,token:workspace.token,expectedCursor:2,direction:'undo'}),/anderweitig geändert/);notes=store.preparation(workspace.token,'').notes.map(row=>row.note);assert.equal(notes.find(note=>note.id===source)?.title,'Ada verändert');assert.equal(notes.find(note=>note.id===source)?.relations.length,0);assert.equal(notes.find(note=>note.id===target)?.relations.length,0);
 }finally{store.close();rmSync(root,{recursive:true,force:true});}
});

test('explicit family pairs stay reciprocal through history',()=>{
 const root=mkdtempSync(join(tmpdir(),'world-family-pair-')),store=new CampaignStore(join(root,'campaign.sqlite'),'test');
 try{
  const campaign=store.create('Familienbeziehungen'),workspace=store.activate(campaign.id),parent=campaignLocalId('00000000-0000-4000-8000-000000000621'),child=campaignLocalId('00000000-0000-4000-8000-000000000622');
  for(const [id,title] of [[parent,'Alma'],[child,'Cora']] as const)store.changePreparation({commandId:'note-'+id,campaignId:campaign.id,token:workspace.token,change:{kind:'note',expectedRevision:null,note:{version:1,id,revision:1,kind:'npc',title,readAloud:'',gmNotes:'',relations:[],creatureId:null,deleted:false}}});
  const action={kind:'add' as const,sourceId:parent,targetId:child,sourceRevision:1,targetRevision:1,forwardLabel:'ist Mutter von',reverseLabel:'ist Tochter von',forwardFamilyKind:'parent' as const,reverseFamilyKind:'child' as const};
  store.executeWorldRelationPair({commandId:'family-add',campaignId:campaign.id,token:workspace.token,action});
  let notes=store.preparation(workspace.token,'').notes.map(row=>row.note);assert.deepEqual(notes.find(note=>note.id===parent)?.relations,[{targetId:child,label:'ist Mutter von',familyKind:'parent'}]);assert.deepEqual(notes.find(note=>note.id===child)?.relations,[{targetId:parent,label:'ist Tochter von',familyKind:'child'}]);
  const page=store.worldLinks(workspace.token,{text:'',kind:'world',offset:0,focus:{kind:'note',id:parent}});assert.ok(page.edges.some(edge=>edge.target.id===child&&edge.familyKind==='parent'));
  const current=notes.find(note=>note.id===parent)!;assert.throws(()=>store.changePreparation({commandId:'orphan-family',campaignId:campaign.id,token:workspace.token,change:{kind:'note',expectedRevision:current.revision,note:{...current,relations:[]}}}),/vollständiges Paar/);
  store.executeWorldRelationPairHistory({commandId:'undo-family',campaignId:campaign.id,token:workspace.token,expectedCursor:1,direction:'undo'});notes=store.preparation(workspace.token,'').notes.map(row=>row.note);assert.equal(notes.find(note=>note.id===parent)?.relations.length,0);assert.equal(notes.find(note=>note.id===child)?.relations.length,0);
  store.executeWorldRelationPairHistory({commandId:'redo-family',campaignId:campaign.id,token:workspace.token,expectedCursor:0,direction:'redo'});notes=store.preparation(workspace.token,'').notes.map(row=>row.note);assert.equal(notes.find(note=>note.id===parent)?.relations[0]?.familyKind,'parent');assert.equal(notes.find(note=>note.id===child)?.relations[0]?.familyKind,'child');
 }finally{store.close();rmSync(root,{recursive:true,force:true});}
});

test('family pair commands reject mismatched directions and non-NPC endpoints',()=>{
 const root=mkdtempSync(join(tmpdir(),'world-family-invalid-')),store=new CampaignStore(join(root,'campaign.sqlite'),'test');
 try{
  const campaign=store.create('Familienprüfung'),workspace=store.activate(campaign.id),npc=campaignLocalId('00000000-0000-4000-8000-000000000631'),faction=campaignLocalId('00000000-0000-4000-8000-000000000632');
  store.changePreparation({commandId:'npc',campaignId:campaign.id,token:workspace.token,change:{kind:'note',expectedRevision:null,note:{version:1,id:npc,revision:1,kind:'npc',title:'Ada',readAloud:'',gmNotes:'',relations:[],creatureId:null,deleted:false}}});store.changePreparation({commandId:'faction',campaignId:campaign.id,token:workspace.token,change:{kind:'note',expectedRevision:null,note:{version:1,id:faction,revision:1,kind:'faction',title:'Gilde',readAloud:'',gmNotes:'',relations:[],creatureId:null,deleted:false}}});
  const base={kind:'add' as const,sourceId:npc,targetId:faction,sourceRevision:1,targetRevision:1,forwardLabel:'Elternteil',reverseLabel:'Kind',forwardFamilyKind:'parent' as const};
  assert.throws(()=>store.executeWorldRelationPair({commandId:'mismatch',campaignId:campaign.id,token:workspace.token,action:{...base,reverseFamilyKind:'partner'}}),/Gegenrichtungen/);
  assert.throws(()=>store.executeWorldRelationPair({commandId:'wrong-kind',campaignId:campaign.id,token:workspace.token,action:{...base,reverseFamilyKind:'child'}}),/ausschließlich NPCs/);
 }finally{store.close();rmSync(root,{recursive:true,force:true});}
});

for(const state of ['history','pending','applied-pending'] as const)test(`an independent copy preserves ${state==='history'?'the pair history owner':state==='pending'?'a pending pair owner':'a pending pair with its applied receipt'} without changing source prose`,async()=>{
 const pending=state!=='history';
 const root=mkdtempSync(join(tmpdir(),'pair-transfer-owner-')),store=new CampaignStore(join(root,'source.sqlite'),'test');let copyStore:CampaignStore|null=null;
 try{
  const campaign=store.create('Original'),w=store.activate(campaign.id),source=campaignLocalId('00000000-0000-4000-8000-000000000641'),target=campaignLocalId('00000000-0000-4000-8000-000000000642'),raw='  Unveränderte Quelle '+source+'\r\n[[Extern#Original]]  ';
  for(const [id,title] of [[source,'Orla'],[target,'Pia']] as const)store.changePreparation({commandId:'note-'+id,campaignId:campaign.id,token:w.token,change:{kind:'note',expectedRevision:null,note:{version:1,id,revision:1,kind:'npc',title,readAloud:'',gmNotes:raw,relations:[],creatureId:null,deleted:false}}});
  const command={commandId:'original-pair',campaignId:campaign.id,token:w.token,draftWriteId:'original-pair-draft',action:{kind:'add' as const,sourceId:source,targetId:target,sourceRevision:1,targetRevision:1,forwardLabel:'ist Elternteil',reverseLabel:'ist Kind',forwardFamilyKind:'parent' as const,reverseFamilyKind:'child' as const}};
  store.keepWorldRelationPairDraft(w.token,{version:1,writeId:command.draftWriteId,command},null);if(state!=='pending')store.executeWorldRelationPair(command);if(state==='applied-pending')store.keepWorldRelationPairDraft(w.token,{version:1,writeId:command.draftWriteId,command},null);
  // Retain the copied family state after an Undo/Redo cycle as well as its history owner.
  if(state==='history'){
   store.executeWorldRelationPairHistory({commandId:'source-undo',campaignId:campaign.id,token:w.token,expectedCursor:1,direction:'undo'});
   store.executeWorldRelationPairHistory({commandId:'source-redo',campaignId:campaign.id,token:w.token,expectedCursor:0,direction:'redo'});
  }
  const before=store.preparation(w.token,'').notes,history=store.worldRelationPairHistory(w.token),snapshot=join(root,'snapshot.sqlite');await store.campaignSnapshot(w.token,snapshot);const bytes=readFileSync(snapshot);copyStore=new CampaignStore(join(root,'copy.sqlite'),'test');const copied=copyStore.acceptCampaignSnapshot(snapshot,'Kopie',{});copyStore.close();copyStore=new CampaignStore(join(root,'copy.sqlite'),'test');const cw=copyStore.activate(copied.id),notes=copyStore.preparation(cw.token,'').notes,cs=notes.find(row=>row.note.title==='Orla')!.note,ct=notes.find(row=>row.note.title==='Pia')!.note;
  assert.notEqual(cs.id,source);assert.notEqual(ct.id,target);assert.equal(cs.gmNotes,raw);assert.equal(ct.gmNotes,raw);
  if(!pending){
   assert.deepEqual(cs.relations,[{targetId:ct.id,label:command.action.forwardLabel,familyKind:'parent'}]);
   assert.deepEqual(ct.relations,[{targetId:cs.id,label:command.action.reverseLabel,familyKind:'child'}]);
  }
  if(pending){const draft=copyStore.worldRelationPairDraft(cw.token,cs.id)!;assert.ok(draft);assert.equal(draft.command.campaignId,copied.id);assert.equal(draft.command.action.sourceId,cs.id);assert.equal(draft.command.action.targetId,ct.id);assert.notEqual(draft.writeId,command.draftWriteId);assert.notEqual(draft.command.commandId,command.commandId);assert.deepEqual(copyStore.reconcileWorldRelationPair(draft.command,cw.token),{outcome:state==='applied-pending'?'applied':'not-applied',targetChanged:false});assert.throws(()=>copyStore!.executeWorldRelationPair(draft.command));assert.equal(copyStore.worldRelationPairHistory(cw.token).cursor,state==='applied-pending'?1:0);copyStore.executeWorldRelationPair({...draft.command,token:cw.token});assert.equal(copyStore.worldRelationPairHistory(cw.token).cursor,1);assert.equal(copyStore.preparation(cw.token,'').notes.find(row=>row.note.id===cs.id)!.note.relations[0]?.targetId,ct.id);}
  else{copyStore.executeWorldRelationPairHistory({commandId:'copied-undo',campaignId:copied.id,token:cw.token,expectedCursor:1,direction:'undo'});assert.equal(copyStore.preparation(cw.token,'').notes.find(row=>row.note.id===cs.id)!.note.relations.length,0);copyStore.executeWorldRelationPairHistory({commandId:'copied-redo',campaignId:copied.id,token:cw.token,expectedCursor:0,direction:'redo'});assert.equal(copyStore.preparation(cw.token,'').notes.find(row=>row.note.id===ct.id)!.note.relations[0]?.targetId,cs.id);}
  assert.deepEqual(store.preparation(w.token,'').notes,before);assert.deepEqual(store.worldRelationPairHistory(w.token),history);assert.ok(readFileSync(snapshot).equals(bytes));
 }finally{copyStore?.close();store.close();rmSync(root,{recursive:true,force:true});}
});

test('a pending pair cannot acquire a forged receipt binding during a campaign copy',async()=>{
 const root=mkdtempSync(join(tmpdir(),'pair-receipt-binding-')),store=new CampaignStore(join(root,'source.sqlite'),'test');
 try{
  const campaign=store.create('Original'),w=store.activate(campaign.id),ids=['00000000-0000-4000-8000-000000000651','00000000-0000-4000-8000-000000000652'];
  for(const id of ids)store.changePreparation({commandId:'note-'+id,campaignId:campaign.id,token:w.token,change:{kind:'note',expectedRevision:null,note:{version:1,id:campaignLocalId(id),revision:1,kind:'npc',title:id,readAloud:'',gmNotes:'Original',relations:[],creatureId:null,deleted:false}}});
  const command={commandId:'pair',campaignId:campaign.id,token:w.token,draftWriteId:'draft',action:{kind:'add' as const,sourceId:ids[0]!,targetId:ids[1]!,sourceRevision:1,targetRevision:1,forwardLabel:'kennt',reverseLabel:'kennt'}};
  store.keepWorldRelationPairDraft(w.token,{version:1,writeId:'draft',command},null);store.executeWorldRelationPair(command);store.keepWorldRelationPairDraft(w.token,{version:1,writeId:'draft',command},null);
  const db=(store as unknown as {db:any}).db;db.prepare('UPDATE world_relation_pair_receipt SET fingerprint=? WHERE command_id=?').run('0'.repeat(64),'pair');const before=db.serialize();
  assert.throws(()=>store.keepWorldRelationPairDraft(w.token,{version:1,writeId:'draft',command},'draft'),/Beleg/);assert.ok(db.serialize().equals(before));
  await assert.rejects(store.campaignSnapshot(w.token,join(root,'snapshot.sqlite')),/Beleg/);assert.ok(db.serialize().equals(before));
 }finally{store.close();rmSync(root,{recursive:true,force:true});}
});
