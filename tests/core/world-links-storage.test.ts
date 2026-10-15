import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test from 'node:test';
import {CampaignStore} from '../../src/app/storage/store';
import {campaignLocalId} from '../../src/features/campaign/campaign-contracts';

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

test('explicit family pairs stay reciprocal through history and an independent campaign copy',async()=>{
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
  const snapshot=join(root,'family.sqlite');await store.campaignSnapshot(workspace.token,snapshot);const copyStore=new CampaignStore(join(root,'copy.sqlite'),'test');
  try{const copy=copyStore.acceptCampaignSnapshot(snapshot,'Familienkopie',{}),copyWorkspace=copyStore.activate(copy.id),copied=copyStore.preparation(copyWorkspace.token,'').notes.map(row=>row.note),copiedParent=copied.find(note=>note.title==='Alma')!,copiedChild=copied.find(note=>note.title==='Cora')!;assert.notEqual(copiedParent.id,parent);assert.deepEqual(copiedParent.relations,[{targetId:copiedChild.id,label:'ist Mutter von',familyKind:'parent'}]);assert.deepEqual(copiedChild.relations,[{targetId:copiedParent.id,label:'ist Tochter von',familyKind:'child'}]);}
  finally{copyStore.close();}
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
