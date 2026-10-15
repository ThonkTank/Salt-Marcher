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
  const add={commandId:'pair-add',campaignId:campaign.id,token:workspace.token,action:{kind:'add' as const,sourceId:source,targetId:target,sourceRevision:1,targetRevision:1,forwardLabel:'beschützt',reverseLabel:'wird beschützt von'}};
  const added=store.executeWorldRelationPair(add);assert.deepEqual(added,{sourceRevision:2,targetRevision:2});assert.deepEqual(store.executeWorldRelationPair(add),added);assert.deepEqual(store.reconcileWorldRelationPair(add,workspace.token),{outcome:'applied',targetChanged:false});
  let notes=store.preparation(workspace.token,'').notes.map(row=>row.note);assert.deepEqual(notes.find(note=>note.id===source)?.relations,[{targetId:target,label:'beschützt'}]);assert.deepEqual(notes.find(note=>note.id===target)?.relations,[{targetId:source,label:'wird beschützt von'}]);
  const staleRemove={commandId:'pair-remove-stale',campaignId:campaign.id,token:workspace.token,action:{kind:'remove' as const,sourceId:source,targetId:target,sourceRevision:2,targetRevision:1,forwardLabel:'beschützt',reverseLabel:'wird beschützt von'}};
  assert.throws(()=>store.executeWorldRelationPair(staleRemove),/Konflikt/);notes=store.preparation(workspace.token,'').notes.map(row=>row.note);assert.equal(notes.find(note=>note.id===source)?.relations.length,1);assert.equal(notes.find(note=>note.id===target)?.relations.length,1);
  const remove={commandId:'pair-remove',campaignId:campaign.id,token:workspace.token,action:{...staleRemove.action,targetRevision:2}};const writeId='pair-draft';store.keepWorldRelationPairDraft(workspace.token,{version:1,writeId,command:{...remove,draftWriteId:writeId}},null);assert.equal(store.worldRelationPairDraft(workspace.token,source)?.writeId,writeId);
  assert.deepEqual(store.executeWorldRelationPair({...remove,draftWriteId:writeId}),{sourceRevision:3,targetRevision:3});assert.equal(store.worldRelationPairDraft(workspace.token,source),null);notes=store.preparation(workspace.token,'').notes.map(row=>row.note);assert.equal(notes.find(note=>note.id===source)?.relations.length,0);assert.equal(notes.find(note=>note.id===target)?.relations.length,0);
 }finally{store.close();rmSync(root,{recursive:true,force:true});}
});
