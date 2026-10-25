import {playerFocus as focus} from '../../support/player-focus';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test from 'node:test';
import type {CombatState} from '../../../src/app/runtime/combat-contracts';
import {CampaignStore} from '../../../src/app/storage/store';

test('combat mechanics stay GM-owned while the passive display keeps its visual context',()=>{
 const root=mkdtempSync(join(tmpdir(),'player-combat-')),store=new CampaignStore(join(root,'campaign.sqlite'),'test');
 try{
  const campaign=store.create('Öffentliche Initiative'),token=store.activate(campaign.id).token;
  const character=store.executeLive({commandId:'character',campaignId:campaign.id,token,action:{kind:'create-character',profile:{name:'Ada'}}}).character!;
  const scene=store.executeLive({commandId:'scene',campaignId:campaign.id,token,action:{kind:'initialize',expectedRosterRevision:1}}).scene!;
  store.executeLive({commandId:'activate',campaignId:campaign.id,token,action:{kind:'membership',characterId:character.id,expectedRevision:0,expectedRosterRevision:1,active:true,targetSceneId:scene.id,expectedFocusRevision:0}});
  const currentScene=store.live(token).scene!;
  let combat:CombatState=store.executeCombat({commandId:'combat',campaignId:campaign.id,token,combatId:null,expectedRevision:null,action:{kind:'create',sceneId:scene.id,title:'Hinterhalt: Der Wirt ist ein Vampir',includeParty:true,expectedMembershipRevision:currentScene.membershipRevision}}).combat!;
  const hero=combat.participants[0]!;
  combat=store.executeCombat({commandId:'enemy',campaignId:campaign.id,token,combatId:combat.id,expectedRevision:combat.revision,action:{kind:'add',name:'Schatten',count:1,grouped:false,maxHp:10,armorClass:14,initiativeBonus:2}}).combat!;
  const enemy=combat.participants.find(p=>!p.characterId)!;
  combat=store.executeCombat({commandId:'hero-init',campaignId:campaign.id,token,combatId:combat.id,expectedRevision:combat.revision,action:{kind:'edit',participantId:hero.id,changes:{initiative:15,hp:12,maxHp:20}}}).combat!;
  combat=store.executeCombat({commandId:'enemy-init',campaignId:campaign.id,token,combatId:combat.id,expectedRevision:combat.revision,action:{kind:'edit',participantId:enemy.id,changes:{initiative:10,hp:4,conditions:'Liegend, Fluch des Sehers, Poisoned'}}}).combat!;
  combat=store.executeCombat({commandId:'start',campaignId:campaign.id,token,combatId:combat.id,expectedRevision:combat.revision,action:{kind:'start'}}).combat!;
  let player=store.executePlayer({commandId:'show',campaignId:campaign.id,token,expectedRevision:0,...focus(store,token),action:{kind:'settings',settings:{blank:false,mode:'follow',imageId:null,title:'',labels:false,light:'daylight',displayId:null,fullscreen:false}}});
  assert.equal(player.frame.mode,'blank');assert.doesNotMatch(JSON.stringify(player.frame),/combat|Hinterhalt|Vampir|initiative|health/);
  combat=store.executeCombat({commandId:'down-hero',campaignId:campaign.id,token,combatId:combat.id,expectedRevision:combat.revision,action:{kind:'damage',participantId:hero.id,amount:12}}).combat!;
  combat=store.executeCombat({commandId:'death-success',campaignId:campaign.id,token,combatId:combat.id,expectedRevision:combat.revision,action:{kind:'death',participantId:hero.id,result:'success'}}).combat!;
  player=store.playerView(token);assert.equal(player.frame.mode,'blank');assert.equal(combat.participants[0]!.hp,0);assert.equal(combat.participants[0]!.death!.successes,1);
  combat=store.executeCombat({commandId:'stabilize-hero',campaignId:campaign.id,token,combatId:combat.id,expectedRevision:combat.revision,action:{kind:'death',participantId:hero.id,result:'stabilize'}}).combat!;
  assert.equal(combat.participants[0]!.death!.stable,true);assert.equal(store.currentPlayerFrame().mode,'blank');
  combat=store.executeCombat({commandId:'reset-hero',campaignId:campaign.id,token,combatId:combat.id,expectedRevision:combat.revision,action:{kind:'death',participantId:hero.id,result:'reset'}}).combat!;
  combat=store.executeCombat({commandId:'dead-hero',campaignId:campaign.id,token,combatId:combat.id,expectedRevision:combat.revision,action:{kind:'death',participantId:hero.id,result:'dead'}}).combat!;
  assert.equal(combat.participants[0]!.death!.dead,true);assert.equal(store.currentPlayerFrame().mode,'blank');
  combat=store.executeCombat({commandId:'hide',campaignId:campaign.id,token,combatId:combat.id,expectedRevision:combat.revision,action:{kind:'visibility',participantId:enemy.id,hidden:true}}).combat!;
  assert.equal(combat.participants.find(p=>p.id===enemy.id)!.hiddenFromPlayers,true);assert.equal(store.currentPlayerFrame().mode,'blank');
  combat=store.executeCombat({commandId:'next',campaignId:campaign.id,token,combatId:combat.id,expectedRevision:combat.revision,action:{kind:'next'}}).combat!;
  assert.equal(store.currentPlayerFrame().mode,'blank');
  combat=store.executeCombat({commandId:'reveal',campaignId:campaign.id,token,combatId:combat.id,expectedRevision:combat.revision,action:{kind:'visibility',participantId:enemy.id,hidden:false}}).combat!;
  player=store.playerView(token);assert.equal(player.frame.mode,'blank');assert.equal(!!combat.participants.find(p=>p.id===enemy.id)!.hiddenFromPlayers,false);
  assert.throws(()=>store.executeCombat({commandId:'hide-party',campaignId:campaign.id,token,combatId:combat.id,expectedRevision:combat.revision,action:{kind:'visibility',participantId:hero.id,hidden:true}}),/Partyfiguren/);

  player=store.executePlayer({commandId:'public-heading',campaignId:campaign.id,token,expectedRevision:player.settings.revision,...focus(store,token),action:{kind:'settings',settings:{blank:false,mode:'follow',imageId:null,title:'Am Stadttor',labels:false,light:'daylight',displayId:null,fullscreen:false}}});
  assert.equal(player.settings.title,'Am Stadttor');assert.equal(player.frame.title,'');assert.doesNotMatch(JSON.stringify(player.frame),/Hinterhalt|Vampir/);
 }finally{store.close();rmSync(root,{recursive:true,force:true});}
});
