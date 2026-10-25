import {playerFocus as focus} from '../../support/player-focus';
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test from 'node:test';
import {CampaignStore} from '../../../src/app/storage/store';
import {campaignLocalId} from '../../../src/features/campaign/campaign-contracts';
import {newLocation} from '../../../src/features/location/location-schema';

for(const bound of [false,true])test('legacy scene text settings remain valid but neutral, binding='+bound,async()=>{
 const root=mkdtempSync(join(tmpdir(),'player-scene-legacy-')),store=new CampaignStore(join(root,'campaign.sqlite'),'test');
 try{
  const db=(store as unknown as {db:any}).db;
  const campaign=store.create('Alter Vorlesemodus'),token=store.activate(campaign.id).token;
  const character=store.executeLive({commandId:'character',campaignId:campaign.id,token,action:{kind:'create-character',profile:{name:'Ada'}}}).character!;
  const scene=store.executeLive({commandId:'scene',campaignId:campaign.id,token,action:{kind:'initialize',expectedRosterRevision:1}}).scene!;
  store.executeLive({commandId:'activate',campaignId:campaign.id,token,action:{kind:'membership',characterId:character.id,expectedRevision:0,expectedRosterRevision:1,active:true,targetSceneId:scene.id,expectedFocusRevision:0}});
  const authored='  Der Torbogen glüht.\n\nEin Horn erklingt.  ';store.executeLive({commandId:'authored',campaignId:campaign.id,token,action:{kind:'scene-content',sceneId:scene.id,expectedRevision:0,title:'Interner Titel',notes:'Private Notiz',readAloud:authored,locationId:null}});
  store.executePlayer({commandId:'follow',campaignId:campaign.id,token,expectedRevision:0,...focus(store,token),action:{kind:'settings',settings:{blank:false,mode:'follow',imageId:null,title:'',labels:false,light:'daylight',displayId:null,fullscreen:false}}});
  const row=db.prepare("SELECT * FROM player_record WHERE campaign_id=? AND kind='settings'").get(campaign.id),legacy={...JSON.parse(row.payload),mode:'scene'};
  if(bound)legacy.boundSceneId=scene.id;else delete legacy.boundSceneId;
  const payload=JSON.stringify(legacy);db.prepare("UPDATE player_record SET payload=?,checksum=? WHERE campaign_id=? AND kind='settings'").run(payload,createHash('sha256').update(payload).digest('hex'),campaign.id);
  const before=db.serialize();assert.equal(store.playerView(token).frame.mode,'blank');assert.equal(store.playerView(token).settings.mode,'scene');assert.ok(db.serialize().equals(before));await store.backup(join(root,'valid-legacy.sqlite'));
  assert.throws(()=>store.executePlayer({commandId:'text-request',campaignId:campaign.id,token,expectedRevision:1,...focus(store,token),action:{kind:'settings',settings:legacy}} as any),/Karten.*Art/);assert.ok(db.serialize().equals(before));
  const current=store.executePlayer({commandId:'visual-request',campaignId:campaign.id,token,expectedRevision:1,...focus(store,token),action:{kind:'settings',settings:{blank:false,mode:'follow',imageId:null,title:'',labels:false,light:'daylight',displayId:null,fullscreen:false}}});assert.equal(current.settings.mode,'follow');assert.equal(current.settings.boundSceneId,null);assert.equal(store.live(token).scene!.readAloud,authored);
 }finally{store.close();rmSync(root,{recursive:true,force:true});}
});
test('a reviewed location image cannot be released after the focused scene moves',()=>{
 const root=mkdtempSync(join(tmpdir(),'player-location-bound-')),store=new CampaignStore(join(root,'campaign.sqlite'),'test');
 try{
  const campaign=store.create('Gebundenes Ortsbild'),token=store.activate(campaign.id).token;
  for(const [id,name] of [['place-a','Vorhut'],['place-b','Hinterland']] as const)store.changePreparation({commandId:'location-'+id,campaignId:campaign.id,token,change:{kind:'location',expectedRevision:null,document:newLocation(id,name,'poi',[id+'-description',id+'-notes'])}});
  const character=store.executeLive({commandId:'character',campaignId:campaign.id,token,action:{kind:'create-character',profile:{name:'Ada'}}}).character!;
  const scene=store.executeLive({commandId:'scene',campaignId:campaign.id,token,action:{kind:'initialize',expectedRosterRevision:1}}).scene!;
  store.executeLive({commandId:'activate',campaignId:campaign.id,token,action:{kind:'membership',characterId:character.id,expectedRevision:0,expectedRosterRevision:1,active:true,targetSceneId:scene.id,expectedFocusRevision:0}});
  store.executeLive({commandId:'place-a',campaignId:campaign.id,token,action:{kind:'scene-content',sceneId:scene.id,expectedRevision:0,title:'Vorhut',readAloud:'',notes:'',locationId:'place-a'}});
  store.registerPlayerAsset(token,{id:'art-a',kind:'location',subjectId:'place-a',title:'Vorhut',sha256:'a'.repeat(64),extension:'.png',bytes:1});
  const stale={...focus(store,token),commandId:'show-place-a',campaignId:campaign.id,token,expectedRevision:0,action:{kind:'settings' as const,settings:{blank:false,mode:'image' as const,imageId:'art-a',title:'',labels:false,light:'daylight' as const,displayId:null,fullscreen:false}}};
  store.executeLive({commandId:'place-b',campaignId:campaign.id,token,action:{kind:'scene-content',sceneId:scene.id,expectedRevision:1,title:'Hinterland',readAloud:'',notes:'',locationId:'place-b'}});
  assert.equal(store.playerView(token).focusLocationId,'place-b');
  assert.throws(()=>store.executePlayer(stale),/Fokussierte Gruppe geändert/);
  assert.equal(store.playerView(token).settings.blank,true);
 }finally{store.close();rmSync(root,{recursive:true,force:true});}
});

for(const transition of ['blank','group','settings'] as const)test('retired NPC portrait cannot be released after '+transition,()=>{
 const root=mkdtempSync(join(tmpdir(),'player-npc-active-')),store=new CampaignStore(join(root,'campaign.sqlite'),'test');
 try{
  const campaign=store.create('NSC-Porträt'),token=store.activate(campaign.id).token,npcId=campaignLocalId(randomUUID()),artId=randomUUID();
  const npc={version:1 as const,id:npcId,revision:1,kind:'npc' as const,title:'Hafenwache',readAloud:'',gmNotes:'Privater Plan',relations:[],creatureId:null,deleted:false};
  store.changePreparation({commandId:'npc',campaignId:campaign.id,token,change:{kind:'note',expectedRevision:null,note:npc}});
  const hero=store.executeLive({commandId:'hero',campaignId:campaign.id,token,action:{kind:'create-character',profile:{name:'Ada'}}}).character!;
  const scene=store.executeLive({commandId:'scene',campaignId:campaign.id,token,action:{kind:'initialize',expectedRosterRevision:1}}).scene!;
  store.executeLive({commandId:'active',campaignId:campaign.id,token,action:{kind:'membership',characterId:hero.id,expectedRevision:0,expectedRosterRevision:1,active:true,targetSceneId:scene.id,expectedFocusRevision:0}});
  store.registerPlayerAsset(token,{id:artId,kind:'npc',subjectId:npcId,title:'Wache',sha256:'b'.repeat(64),extension:'.png',bytes:1});
  const settings={blank:false,mode:'image' as const,imageId:artId,title:'',labels:false,light:'daylight' as const,displayId:null,fullscreen:false};
  store.executePlayer({...focus(store,token),commandId:'show',campaignId:campaign.id,token,expectedRevision:0,action:{kind:'settings',settings}});
  store.changePreparation({commandId:'trash',campaignId:campaign.id,token,change:{kind:'note-trash',id:npcId,expectedRevision:1,trashed:true}});
  if(transition==='blank')store.executePlayer({...focus(store,token),commandId:'blank',campaignId:campaign.id,token,expectedRevision:1,action:{kind:'blank'}});
  else if(transition==='group'){
   const live=store.live(token),split=store.executeLive({commandId:'split',campaignId:campaign.id,token,action:{kind:'move',sceneId:scene.id,expectedRosterRevision:live.rosterRevision,expectedFocusRevision:live.focusRevision!,expectedClockRevision:live.scene!.clock.revision,expectedSceneMembershipRevision:live.scene!.membershipRevision,memberIds:[hero.id],target:{kind:'new',title:'Nachhut',expectedContentRevision:live.scene!.revision}}});
   const current=store.live(token);store.executeLive({commandId:'focus-next',campaignId:campaign.id,token,action:{kind:'focus',sceneId:split.session!.createdScene!.id,expectedRevision:current.focusRevision!}});
  }
  const view=store.playerView(token),db=(store as unknown as {db:any}).db,before=db.serialize();
  assert.throws(()=>store.executePlayer({...focus(store,token),commandId:'redisplay',campaignId:campaign.id,token,expectedRevision:view.settings.revision,action:{kind:'settings',settings}}),/Bildziel fehlt/);
  assert.ok(db.serialize().equals(before));assert.ok(store.playerView(token).assets.some(a=>a.id===artId));
 }finally{store.close();rmSync(root,{recursive:true,force:true});}
});
