import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test from 'node:test';
import {CampaignStore} from '../../src/app/storage/store';
import {newLocation} from '../../src/features/location/location-schema';
const focus=(store:CampaignStore,token:string)=>{const view=store.playerView(token);return{expectedFocusId:view.focusId,expectedFocusRevision:view.focusRevision,expectedFocusMembershipRevision:view.focusMembershipRevision,expectedFocusLocationId:view.focusLocationId};};

test('the player display publishes only the focused scene read-aloud text',()=>{
 const root=mkdtempSync(join(tmpdir(),'player-scene-')),store=new CampaignStore(join(root,'campaign.sqlite'),'test');
 try{
  const campaign=store.create('Vorleseanzeige'),token=store.activate(campaign.id).token;
  const character=store.executeLive({commandId:'character',campaignId:campaign.id,token,action:{kind:'create-character',profile:{name:'Ada'}}}).character!;
  const scene=store.executeLive({commandId:'scene',campaignId:campaign.id,token,action:{kind:'initialize',expectedRosterRevision:1}}).scene!;
  store.executeLive({commandId:'activate',campaignId:campaign.id,token,action:{kind:'membership',characterId:character.id,expectedRevision:0,expectedRosterRevision:1,active:true,targetSceneId:scene.id,expectedFocusRevision:0}});
  const current=store.live(token).scene!;
  store.executeLive({commandId:'content',campaignId:campaign.id,token,action:{kind:'scene-content',sceneId:current.id,expectedRevision:current.revision,title:'Hinterhalt: Der freundliche Wirt ist ein Vampir',readAloud:'  Der schwarze Torbogen glüht im Abendlicht.\nEin Horn erklingt.\n',notes:'Hinterhalt der Wachen bei drei Fehltritten.',locationId:null}});
  let player=store.executePlayer({...focus(store,token),commandId:'show-scene',campaignId:campaign.id,token,expectedRevision:0,action:{kind:'settings',settings:{blank:false,mode:'scene',imageId:null,title:'',labels:false,light:'daylight',displayId:null,fullscreen:false}}});
  assert.equal(player.frame.mode,'scene');assert.equal(player.frame.title,'');assert.equal(player.frame.scene?.text,'  Der schwarze Torbogen glüht im Abendlicht.\nEin Horn erklingt.\n');assert.doesNotMatch(JSON.stringify(player.frame),/Hinterhalt|Fehltritten|Vampir/);
  const updated=store.live(token).scene!;store.executeLive({commandId:'clear-text',campaignId:campaign.id,token,action:{kind:'scene-content',sceneId:updated.id,expectedRevision:updated.revision,title:updated.title,readAloud:' \n ',notes:updated.notes,locationId:null}});
  player=store.playerView(token);assert.equal(player.frame.mode,'blank');assert.match(player.frame.reason??'',/kein Vorlesetext/);
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

test('a trashed npc cannot be newly released from retained portrait history',()=>{
 const root=mkdtempSync(join(tmpdir(),'player-npc-active-')),store=new CampaignStore(join(root,'campaign.sqlite'),'test');
 try{
  const campaign=store.create('Aktives NSC-Bild'),token=store.activate(campaign.id).token,npc={version:1 as const,id:'npc',revision:1,kind:'npc' as const,title:'Hafenwache',readAloud:'',gmNotes:'',relations:[],creatureId:null,deleted:false};
  store.changePreparation({commandId:'npc',campaignId:campaign.id,token,change:{kind:'note',expectedRevision:null,note:npc}});
  const character=store.executeLive({commandId:'character',campaignId:campaign.id,token,action:{kind:'create-character',profile:{name:'Ada'}}}).character!;
  const scene=store.executeLive({commandId:'scene',campaignId:campaign.id,token,action:{kind:'initialize',expectedRosterRevision:1}}).scene!;
  store.executeLive({commandId:'activate',campaignId:campaign.id,token,action:{kind:'membership',characterId:character.id,expectedRevision:0,expectedRosterRevision:1,active:true,targetSceneId:scene.id,expectedFocusRevision:0}});
  store.registerPlayerAsset(token,{id:'npc-art',kind:'npc',subjectId:npc.id,title:npc.title,sha256:'b'.repeat(64),extension:'.png',bytes:1});
  const release={...focus(store,token),commandId:'show-npc',campaignId:campaign.id,token,expectedRevision:0,action:{kind:'settings' as const,settings:{blank:false,mode:'image' as const,imageId:'npc-art',title:'',labels:false,light:'daylight' as const,displayId:null,fullscreen:false}}};
  store.changePreparation({commandId:'trash-npc',campaignId:campaign.id,token,change:{kind:'note-trash',id:npc.id,expectedRevision:1,trashed:true}});
  assert.throws(()=>store.executePlayer(release),/Bildziel fehlt/);
  assert.equal(store.playerView(token).settings.blank,true);
 }finally{store.close();rmSync(root,{recursive:true,force:true});}
});

test('published scene read-aloud stays bound to the group the GM showed',()=>{
 const root=mkdtempSync(join(tmpdir(),'player-scene-bound-')),store=new CampaignStore(join(root,'campaign.sqlite'),'test');
 try{
  const campaign=store.create('Gebundene Vorleseanzeige'),token=store.activate(campaign.id).token;
  const one=store.executeLive({commandId:'character-one',campaignId:campaign.id,token,action:{kind:'create-character',profile:{name:'Ada'}}}).character!;
  const two=store.executeLive({commandId:'character-two',campaignId:campaign.id,token,action:{kind:'create-character',profile:{name:'Borin'}}}).character!;
  const primary=store.executeLive({commandId:'initialize',campaignId:campaign.id,token,action:{kind:'initialize',expectedRosterRevision:2}}).scene!;
  store.executeLive({commandId:'activate-one',campaignId:campaign.id,token,action:{kind:'membership',characterId:one.id,expectedRevision:0,expectedRosterRevision:2,active:true,targetSceneId:primary.id,expectedFocusRevision:0}});
  store.executeLive({commandId:'activate-two',campaignId:campaign.id,token,action:{kind:'membership',characterId:two.id,expectedRevision:0,expectedRosterRevision:3,active:true,targetSceneId:primary.id,expectedFocusRevision:0}});
  const split=store.executeLive({commandId:'split',campaignId:campaign.id,token,action:{kind:'move',sceneId:primary.id,expectedRosterRevision:4,expectedFocusRevision:0,expectedClockRevision:0,expectedSceneMembershipRevision:2,memberIds:[two.id],target:{kind:'new',title:'Nachhut',expectedContentRevision:0}}});
  const secondaryId=split.session!.createdScene!.id;
  store.executeLive({commandId:'primary-content',campaignId:campaign.id,token,action:{kind:'scene-content',sceneId:primary.id,expectedRevision:0,title:'Vorhut',readAloud:'Die Vorhut sieht das offene Basalttor.',notes:'',locationId:null}});
  store.executeLive({commandId:'secondary-content',campaignId:campaign.id,token,action:{kind:'scene-content',sceneId:secondaryId,expectedRevision:0,title:'Nachhut',readAloud:'Die Nachhut entdeckt den geheimen Hinterhalt.',notes:'',locationId:null}});
  let player=store.executePlayer({...focus(store,token),commandId:'show-primary',campaignId:campaign.id,token,expectedRevision:0,action:{kind:'settings',settings:{blank:false,mode:'scene',imageId:null,title:'',labels:false,light:'daylight',displayId:null,fullscreen:false}}});
  assert.equal(player.settings.boundSceneId,primary.id);assert.equal(player.frame.mode,'scene');assert.equal(player.frame.scene?.text,'Die Vorhut sieht das offene Basalttor.');
  const stale={...focus(store,token),commandId:'stale-republish',campaignId:campaign.id,token,expectedRevision:player.settings.revision,action:{kind:'settings',settings:{blank:false,mode:'scene',imageId:null,title:'',labels:false,light:'daylight',displayId:null,fullscreen:false}}} as const;
  store.executeLive({commandId:'focus-secondary',campaignId:campaign.id,token,action:{kind:'focus',sceneId:secondaryId,expectedRevision:0}});
  assert.throws(()=>store.executePlayer(stale),/Fokussierte Gruppe geändert/);
  player=store.playerView(token);assert.equal(player.frame.mode,'blank');assert.match(player.frame.reason??'',/anderen Gruppe/);assert.doesNotMatch(JSON.stringify(player.frame),/geheimen Hinterhalt/);
  store.executeLive({commandId:'focus-primary',campaignId:campaign.id,token,action:{kind:'focus',sceneId:primary.id,expectedRevision:1}});
  player=store.playerView(token);assert.equal(player.frame.mode,'scene');assert.equal(player.frame.scene?.text,'Die Vorhut sieht das offene Basalttor.');
 }finally{store.close();rmSync(root,{recursive:true,force:true});}
});

test('player settings saved before scene binding remain readable and fail closed',()=>{
 const root=mkdtempSync(join(tmpdir(),'player-settings-upgrade-')),path=join(root,'campaign.sqlite');let store=new CampaignStore(path,'test'),reopened:CampaignStore|undefined,closed=false;
 try{
  const campaign=store.create('Bestehende Spieleranzeige'),token=store.activate(campaign.id).token;
  const character=store.executeLive({commandId:'character',campaignId:campaign.id,token,action:{kind:'create-character',profile:{name:'Ada'}}}).character!;
  const scene=store.executeLive({commandId:'scene',campaignId:campaign.id,token,action:{kind:'initialize',expectedRosterRevision:1}}).scene!;
  store.executeLive({commandId:'activate',campaignId:campaign.id,token,action:{kind:'membership',characterId:character.id,expectedRevision:0,expectedRosterRevision:1,active:true,targetSceneId:scene.id,expectedFocusRevision:0}});
  store.executeLive({commandId:'content',campaignId:campaign.id,token,action:{kind:'scene-content',sceneId:scene.id,expectedRevision:0,title:'Alte Scene',readAloud:'Nur bewusst erneut veröffentlichen.',notes:'',locationId:null}});
  const shown=store.executePlayer({...focus(store,token),commandId:'show',campaignId:campaign.id,token,expectedRevision:0,action:{kind:'settings',settings:{blank:false,mode:'scene',imageId:null,title:'',labels:false,light:'daylight',displayId:null,fullscreen:false}}});
  const db=(store as unknown as {db:any}).db,row=db.prepare("SELECT payload FROM player_record WHERE campaign_id=? AND kind='settings' AND id='main'").get(campaign.id),legacy=JSON.parse(row.payload);delete legacy.boundSceneId;const payload=JSON.stringify(legacy),checksum=createHash('sha256').update(payload).digest('hex');db.prepare("UPDATE player_record SET payload=?,checksum=? WHERE campaign_id=? AND kind='settings' AND id='main'").run(payload,checksum,campaign.id);
  store.close();closed=true;reopened=new CampaignStore(path,'test');const workspace=reopened.activate(campaign.id),view=reopened.playerView(workspace.token);
  assert.equal(view.settings.boundSceneId,null);assert.equal(view.frame.mode,'blank');assert.match(view.frame.reason??'',/anderen Gruppe/);
  const republished=reopened.executePlayer({...focus(reopened,workspace.token),commandId:'republish',campaignId:campaign.id,token:workspace.token,expectedRevision:shown.settings.revision,action:{kind:'settings',settings:{blank:false,mode:'scene',imageId:null,title:'',labels:false,light:'daylight',displayId:null,fullscreen:false}}});
  assert.equal(republished.settings.boundSceneId,scene.id);assert.equal(republished.frame.scene?.text,'Nur bewusst erneut veröffentlichen.');
 }finally{reopened?.close();if(!closed)store.close();rmSync(root,{recursive:true,force:true});}
});
