import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test from 'node:test';
import type {CombatState} from '../../src/app/combat-contracts';
import {CampaignStore} from '../../src/app/storage/store';
const focus=(store:CampaignStore,token:string)=>{const view=store.playerView(token);return{expectedFocusId:view.focusId,expectedFocusRevision:view.focusRevision,expectedFocusMembershipRevision:view.focusMembershipRevision,expectedFocusLocationId:view.focusLocationId};};

test('the follow display shows a reduced combat initiative and respects hidden opponents',()=>{
 const root=mkdtempSync(join(tmpdir(),'player-combat-')),store=new CampaignStore(join(root,'campaign.sqlite'),'test');
 try{
  const campaign=store.create('Öffentliche Initiative'),token=store.activate(campaign.id).token;
  const character=store.executeLive({commandId:'character',campaignId:campaign.id,token,action:{kind:'create-character',profile:{name:'Ada'}}}).character!;
  const scene=store.executeLive({commandId:'scene',campaignId:campaign.id,token,action:{kind:'initialize',expectedRosterRevision:1}}).scene!;
  store.executeLive({commandId:'activate',campaignId:campaign.id,token,action:{kind:'membership',characterId:character.id,expectedRevision:0,expectedRosterRevision:1,active:true,targetSceneId:scene.id,expectedFocusRevision:0}});
  const currentScene=store.live(token).scene!;
  let combat:CombatState=store.executeCombat({commandId:'combat',campaignId:campaign.id,token,combatId:null,expectedRevision:null,action:{kind:'create',sceneId:scene.id,title:'Basalttor',includeParty:true,expectedMembershipRevision:currentScene.membershipRevision}}).combat!;
  const hero=combat.participants[0]!;
  combat=store.executeCombat({commandId:'enemy',campaignId:campaign.id,token,combatId:combat.id,expectedRevision:combat.revision,action:{kind:'add',name:'Schatten',count:1,grouped:false,maxHp:10,armorClass:14,initiativeBonus:2}}).combat!;
  const enemy=combat.participants.find(p=>!p.characterId)!;
  combat=store.executeCombat({commandId:'hero-init',campaignId:campaign.id,token,combatId:combat.id,expectedRevision:combat.revision,action:{kind:'edit',participantId:hero.id,changes:{initiative:15,hp:12,maxHp:20}}}).combat!;
  combat=store.executeCombat({commandId:'enemy-init',campaignId:campaign.id,token,combatId:combat.id,expectedRevision:combat.revision,action:{kind:'edit',participantId:enemy.id,changes:{initiative:10,hp:4,conditions:'Liegend, Fluch des Sehers, Poisoned'}}}).combat!;
  combat=store.executeCombat({commandId:'start',campaignId:campaign.id,token,combatId:combat.id,expectedRevision:combat.revision,action:{kind:'start'}}).combat!;
  let player=store.executePlayer({...focus(store,token),commandId:'show',campaignId:campaign.id,token,expectedRevision:0,action:{kind:'settings',settings:{blank:false,mode:'follow',imageId:null,title:'',labels:false,light:'daylight',displayId:null,fullscreen:false}}});
  assert.equal(player.frame.mode,'combat');assert.equal(player.frame.title,'Basalttor');assert.equal(player.frame.combat?.currentName,'Ada');
  assert.deepEqual(player.frame.combat?.participants.map((p:{name:string;health:string;status:string})=>[p.name,p.health,p.status]),[['Ada','12 / 20 HP','—'],['Schatten','Angeschlagen','Liegend, Vergiftet']]);
  combat=store.executeCombat({commandId:'down-hero',campaignId:campaign.id,token,combatId:combat.id,expectedRevision:combat.revision,action:{kind:'damage',participantId:hero.id,amount:12}}).combat!;
  combat=store.executeCombat({commandId:'death-success',campaignId:campaign.id,token,combatId:combat.id,expectedRevision:combat.revision,action:{kind:'death',participantId:hero.id,result:'success'}}).combat!;
  player=store.playerView(token);assert.equal(player.frame.combat?.participants[0]?.health,'0 / 20 HP');assert.equal(player.frame.combat?.participants[0]?.status,'Todesrettung 1✓ / 0✗');
  combat=store.executeCombat({commandId:'stabilize-hero',campaignId:campaign.id,token,combatId:combat.id,expectedRevision:combat.revision,action:{kind:'death',participantId:hero.id,result:'stabilize'}}).combat!;
  assert.equal(store.currentPlayerFrame().combat?.participants[0]?.status,'Stabilisiert');
  combat=store.executeCombat({commandId:'reset-hero',campaignId:campaign.id,token,combatId:combat.id,expectedRevision:combat.revision,action:{kind:'death',participantId:hero.id,result:'reset'}}).combat!;
  combat=store.executeCombat({commandId:'dead-hero',campaignId:campaign.id,token,combatId:combat.id,expectedRevision:combat.revision,action:{kind:'death',participantId:hero.id,result:'dead'}}).combat!;
  assert.equal(store.currentPlayerFrame().combat?.participants[0]?.status,'Tot');
  combat=store.executeCombat({commandId:'hide',campaignId:campaign.id,token,combatId:combat.id,expectedRevision:combat.revision,action:{kind:'visibility',participantId:enemy.id,hidden:true}}).combat!;
  assert.deepEqual(store.currentPlayerFrame().combat?.participants.map(p=>p.name),['Ada']);
  combat=store.executeCombat({commandId:'next',campaignId:campaign.id,token,combatId:combat.id,expectedRevision:combat.revision,action:{kind:'next'}}).combat!;
  assert.equal(store.currentPlayerFrame().combat?.currentName,'Verborgener Zug');
  combat=store.executeCombat({commandId:'reveal',campaignId:campaign.id,token,combatId:combat.id,expectedRevision:combat.revision,action:{kind:'visibility',participantId:enemy.id,hidden:false}}).combat!;
  player=store.playerView(token);assert.equal(player.frame.combat?.currentName,'Schatten');assert.equal(player.frame.combat?.participants.at(-1)?.current,true);
  assert.throws(()=>store.executeCombat({commandId:'hide-party',campaignId:campaign.id,token,combatId:combat.id,expectedRevision:combat.revision,action:{kind:'visibility',participantId:hero.id,hidden:true}}),/Partyfiguren/);
 }finally{store.close();rmSync(root,{recursive:true,force:true});}
});
