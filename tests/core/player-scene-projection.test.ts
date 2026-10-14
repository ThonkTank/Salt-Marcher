import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test from 'node:test';
import {CampaignStore} from '../../src/app/storage/store';

test('the player display publishes only the focused scene read-aloud text',()=>{
 const root=mkdtempSync(join(tmpdir(),'player-scene-')),store=new CampaignStore(join(root,'campaign.sqlite'),'test');
 try{
  const campaign=store.create('Vorleseanzeige'),token=store.activate(campaign.id).token;
  const character=store.executeLive({commandId:'character',campaignId:campaign.id,token,action:{kind:'create-character',profile:{name:'Ada'}}}).character!;
  const scene=store.executeLive({commandId:'scene',campaignId:campaign.id,token,action:{kind:'initialize',expectedRosterRevision:1}}).scene!;
  store.executeLive({commandId:'activate',campaignId:campaign.id,token,action:{kind:'membership',characterId:character.id,expectedRevision:0,expectedRosterRevision:1,active:true,targetSceneId:scene.id,expectedFocusRevision:0}});
  const current=store.live(token).scene!;
  store.executeLive({commandId:'content',campaignId:campaign.id,token,action:{kind:'scene-content',sceneId:current.id,expectedRevision:current.revision,title:'Hinterhalt: Der freundliche Wirt ist ein Vampir',readAloud:'  Der schwarze Torbogen glüht im Abendlicht.\nEin Horn erklingt.\n',notes:'Hinterhalt der Wachen bei drei Fehltritten.',locationId:null}});
  let player=store.executePlayer({commandId:'show-scene',campaignId:campaign.id,token,expectedRevision:0,action:{kind:'settings',settings:{blank:false,mode:'scene',imageId:null,title:'',labels:false,light:'daylight',displayId:null,fullscreen:false}}});
  assert.equal(player.frame.mode,'scene');assert.equal(player.frame.title,'');assert.equal(player.frame.scene?.text,'  Der schwarze Torbogen glüht im Abendlicht.\nEin Horn erklingt.\n');assert.doesNotMatch(JSON.stringify(player.frame),/Hinterhalt|Fehltritten|Vampir/);
  const updated=store.live(token).scene!;store.executeLive({commandId:'clear-text',campaignId:campaign.id,token,action:{kind:'scene-content',sceneId:updated.id,expectedRevision:updated.revision,title:updated.title,readAloud:' \n ',notes:updated.notes,locationId:null}});
  player=store.playerView(token);assert.equal(player.frame.mode,'blank');assert.match(player.frame.reason??'',/kein Vorlesetext/);
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
  let player=store.executePlayer({commandId:'show-primary',campaignId:campaign.id,token,expectedRevision:0,action:{kind:'settings',settings:{blank:false,mode:'scene',imageId:null,title:'',labels:false,light:'daylight',displayId:null,fullscreen:false}}});
  assert.equal(player.settings.boundSceneId,primary.id);assert.equal(player.frame.mode,'scene');assert.equal(player.frame.scene?.text,'Die Vorhut sieht das offene Basalttor.');
  store.executeLive({commandId:'focus-secondary',campaignId:campaign.id,token,action:{kind:'focus',sceneId:secondaryId,expectedRevision:0}});
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
  const shown=store.executePlayer({commandId:'show',campaignId:campaign.id,token,expectedRevision:0,action:{kind:'settings',settings:{blank:false,mode:'scene',imageId:null,title:'',labels:false,light:'daylight',displayId:null,fullscreen:false}}});
  const db=(store as unknown as {db:any}).db,row=db.prepare("SELECT payload FROM player_record WHERE campaign_id=? AND kind='settings' AND id='main'").get(campaign.id),legacy=JSON.parse(row.payload);delete legacy.boundSceneId;const payload=JSON.stringify(legacy),checksum=createHash('sha256').update(payload).digest('hex');db.prepare("UPDATE player_record SET payload=?,checksum=? WHERE campaign_id=? AND kind='settings' AND id='main'").run(payload,checksum,campaign.id);
  store.close();closed=true;reopened=new CampaignStore(path,'test');const workspace=reopened.activate(campaign.id),view=reopened.playerView(workspace.token);
  assert.equal(view.settings.boundSceneId,null);assert.equal(view.frame.mode,'blank');assert.match(view.frame.reason??'',/anderen Gruppe/);
  const republished=reopened.executePlayer({commandId:'republish',campaignId:campaign.id,token:workspace.token,expectedRevision:shown.settings.revision,action:{kind:'settings',settings:{blank:false,mode:'scene',imageId:null,title:'',labels:false,light:'daylight',displayId:null,fullscreen:false}}});
  assert.equal(republished.settings.boundSceneId,scene.id);assert.equal(republished.frame.scene?.text,'Nur bewusst erneut veröffentlichen.');
 }finally{reopened?.close();if(!closed)store.close();rmSync(root,{recursive:true,force:true});}
});

test('read-aloud keeps authored whitespace and only the explicitly public heading after reopening',()=>{
 const root=mkdtempSync(join(tmpdir(),'player-public-heading-')),file=join(root,'campaign.sqlite');let store=new CampaignStore(file,'test');
 try{
  const campaign=store.create('Öffentliche Überschrift'),token=store.activate(campaign.id).token;
  const character=store.executeLive({commandId:'character',campaignId:campaign.id,token,action:{kind:'create-character',profile:{name:'Ada'}}}).character!;
  const scene=store.executeLive({commandId:'scene',campaignId:campaign.id,token,action:{kind:'initialize',expectedRosterRevision:1}}).scene!;
  store.executeLive({commandId:'activate',campaignId:campaign.id,token,action:{kind:'membership',characterId:character.id,expectedRevision:0,expectedRosterRevision:1,active:true,targetSceneId:scene.id,expectedFocusRevision:0}});
  const text='  Der Wirt winkt.\r\n\r\n  <Einladung>  ',internal='Vampir-Hinterhalt',notes='Schlüssel in der Falltür';
  store.executeLive({commandId:'content',campaignId:campaign.id,token,action:{kind:'scene-content',sceneId:scene.id,expectedRevision:0,title:internal,readAloud:text,notes,locationId:null}});
  const settings={blank:false,mode:'scene' as const,imageId:null,title:'Am Stadttor',labels:false,light:'daylight' as const,displayId:null,fullscreen:false};
  let player=store.executePlayer({commandId:'show',campaignId:campaign.id,token,expectedRevision:0,action:{kind:'settings',settings}});
  assert.deepEqual(player.frame,{mode:'scene',title:'Am Stadttor',scene:{text}});assert.doesNotMatch(JSON.stringify(player.frame),/Vampir|Falltür/);
  store.close();store=new CampaignStore(file,'test');const next=store.activate(campaign.id).token;player=store.playerView(next);
  assert.deepEqual(player.frame,{mode:'scene',title:'Am Stadttor',scene:{text}});
  player=store.executePlayer({commandId:'without-heading',campaignId:campaign.id,token:next,expectedRevision:player.settings.revision,action:{kind:'settings',settings:{...settings,title:''}}});
  assert.deepEqual(player.frame,{mode:'scene',title:'',scene:{text}});
  const original=store.live(next).scene!;assert.equal(original.title,internal);assert.equal(original.notes,notes);assert.equal(original.readAloud,text);
  store.executeLive({commandId:'empty',campaignId:campaign.id,token:next,action:{kind:'scene-content',sceneId:scene.id,expectedRevision:original.revision,title:internal,readAloud:' \r\n \t',notes,locationId:null}});
  player=store.playerView(next);assert.equal(player.frame.mode,'blank');assert.doesNotMatch(JSON.stringify(player.frame),/Vampir|Falltür|Der Wirt/);
 }finally{store.close();rmSync(root,{recursive:true,force:true});}
});
