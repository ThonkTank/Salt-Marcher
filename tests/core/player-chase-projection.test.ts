import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test from 'node:test';
import type {PlayerView} from '../../src/app/player-contracts';
import {CampaignStore} from '../../src/app/storage/store';
const focus=(store:CampaignStore,token:string)=>{const view=store.playerView(token);return{expectedFocusId:view.focusId,expectedFocusRevision:view.focusRevision};};

test('the follow display projects a reduced live chase and keeps hidden participants private',()=>{
 const root=mkdtempSync(join(tmpdir(),'player-chase-')),store=new CampaignStore(join(root,'campaign.sqlite'),'test');
 try{
  const campaign=store.create('Verfolgungsanzeige'),token=store.activate(campaign.id).token;
  const character=store.executeLive({commandId:'character',campaignId:campaign.id,token,action:{kind:'create-character',profile:{name:'Ada'}}}).character!;
  const scene=store.executeLive({commandId:'scene',campaignId:campaign.id,token,action:{kind:'initialize',expectedRosterRevision:1}}).scene!;
  store.executeLive({commandId:'activate',campaignId:campaign.id,token,action:{kind:'membership',characterId:character.id,expectedRevision:0,expectedRosterRevision:1,active:true,targetSceneId:scene.id,expectedFocusRevision:0}});
  let chase=store.executeChase({commandId:'chase',campaignId:campaign.id,token,sceneId:scene.id,chaseId:null,expectedRevision:null,action:{kind:'create',title:'Hinterhalt: Der Wirt ist ein Vampir',goal:'Geheimes Ziel'}}).chase!;
  chase=store.executeChase({commandId:'people',campaignId:campaign.id,token,sceneId:scene.id,chaseId:chase.id,expectedRevision:chase.revision,action:{kind:'participants',participants:[{id:'ada',characterId:character.id,name:'Ada',side:'quarry',distance:18,speed:9,exhaustion:0,notes:'Privater Plan'},{id:'guard',characterId:null,name:'Stadtwache',side:'pursuer',distance:6,speed:9,exhaustion:1,notes:'Geheime Verstärkung'}]}}).chase!;
  chase=store.executeChase({commandId:'hide',campaignId:campaign.id,token,sceneId:scene.id,chaseId:chase.id,expectedRevision:chase.revision,action:{kind:'visibility',participantId:'guard',hidden:true}}).chase!;
  let player:PlayerView=store.executePlayer({...focus(store,token),commandId:'show',campaignId:campaign.id,token,expectedRevision:0,action:{kind:'settings',settings:{blank:false,mode:'follow',imageId:null,title:'',labels:false,light:'daylight',displayId:null,fullscreen:false}}});
  assert.equal(player.frame.mode,'chase');assert.equal(player.frame.title,'');assert.doesNotMatch(JSON.stringify(player.frame),/Hinterhalt|Vampir/);assert.deepEqual(player.frame.chase?.participants.map((p:{name:string})=>p.name),['Ada']);assert.doesNotMatch(JSON.stringify(player.frame),/Geheimes Ziel|Privater Plan|Geheime Verstärkung/);
  chase=store.executeChase({commandId:'reveal',campaignId:campaign.id,token,sceneId:scene.id,chaseId:chase.id,expectedRevision:chase.revision,action:{kind:'visibility',participantId:'guard',hidden:false}}).chase!;
  chase=store.executeChase({commandId:'round',campaignId:campaign.id,token,sceneId:scene.id,chaseId:chase.id,expectedRevision:chase.revision,action:{kind:'round',changes:[{participantId:'ada',distance:27,exhaustion:0},{participantId:'guard',distance:15,exhaustion:1}],complication:'Verdeckte Abkürzung'}}).chase!;
  player=store.playerView(token);assert.equal(player.frame.chase?.round,1);assert.deepEqual(player.frame.chase?.participants.map((p:{name:string;distance:number;exhaustion:number})=>[p.name,p.distance,p.exhaustion]),[['Ada',27,0],['Stadtwache',15,1]]);assert.doesNotMatch(JSON.stringify(player.frame),/Verdeckte Abkürzung/);

  player=store.executePlayer({...focus(store,token),commandId:'public-heading',campaignId:campaign.id,token,expectedRevision:player.settings.revision,action:{kind:'settings',settings:{blank:false,mode:'follow',imageId:null,title:'Am Stadttor',labels:false,light:'daylight',displayId:null,fullscreen:false}}});
  assert.equal(player.frame.title,'Am Stadttor');assert.doesNotMatch(JSON.stringify(player.frame),/Hinterhalt|Vampir/);
 }finally{store.close();rmSync(root,{recursive:true,force:true});}
});

function focus(store:CampaignStore,token:string){const view=store.playerView(token);return{expectedFocusId:view.focusId,expectedFocusRevision:view.focusRevision};}
