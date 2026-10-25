import assert from "node:assert/strict";
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test from "node:test";
import {
  applyDeathSave,
  checkedHealth,
  deathSaveControls,
  type CharacterHealth,
} from "../../../src/app/runtime/progression";
import {CampaignStore} from '../../../src/app/storage/store';

const zero=():CharacterHealth=>({hp:0,maxHp:12,tempHp:0,conditions:"",concentrating:false});

test("death saves reach stable and dead terminal states without contradictory flags",()=>{
  let stable=zero();
  for(let i=0;i<3;i++)stable=applyDeathSave(stable,"success");
  assert.deepEqual(stable.death,{successes:3,failures:0,stable:true,dead:false});
  assert.throws(()=>applyDeathSave(stable,"failure"),/stabilisiert/);

  let dead=applyDeathSave(zero(),"failure");
  dead=applyDeathSave(dead,"natural-1");
  assert.deepEqual(dead.death,{successes:0,failures:3,stable:false,dead:true});
  assert.throws(()=>applyDeathSave(dead,"success"),/tot markiert/);
});

test("reset explicitly reopens saves and a natural 20 restores one HP",()=>{
  const stable=applyDeathSave(zero(),"stabilize"),reset=applyDeathSave(stable,"reset"),revived=applyDeathSave(reset,"natural-20");
  assert.deepEqual(reset.death,{successes:0,failures:0,stable:false,dead:false});
  assert.equal(revived.hp,1);
  assert.equal(revived.death,undefined);
});

test("death saves reject unknown command input",()=>{
  assert.throws(()=>applyDeathSave(zero(),"unknown" as never),/Unbekanntes/);
});

test("death-save controls offer reset only after a meaningful entry",()=>{
  assert.deepEqual(deathSaveControls(undefined),{terminal:false,reset:false});
  assert.deepEqual(deathSaveControls({successes:0,failures:0,stable:false,dead:false}),{terminal:false,reset:false});
  assert.deepEqual(deathSaveControls({successes:1,failures:0,stable:false,dead:false}),{terminal:false,reset:true});
  assert.deepEqual(deathSaveControls({successes:3,failures:0,stable:true,dead:false}),{terminal:true,reset:true});
});

test("health validation rejects death-save flags that contradict HP or counters",()=>{
  for(const health of [
    {...zero(),hp:1,death:{successes:0,failures:0,stable:false,dead:false}},
    {...zero(),death:{successes:3,failures:0,stable:false,dead:false}},
    {...zero(),death:{successes:3,failures:3,stable:false,dead:true}},
    {...zero(),death:{successes:3,failures:3,stable:true,dead:true}},
    {...zero(),death:null},
  ])assert.throws(()=>checkedHealth(health as unknown as CharacterHealth));
});

test('the combat tracker rolls death saves and carries the result into character health',()=>{
  const root=mkdtempSync(join(tmpdir(),'combat-death-save-')),store=new CampaignStore(join(root,'campaign.sqlite'),'test');
  try{
    const campaign=store.create('Todesrettung'),workspace=store.activate(campaign.id),token=workspace.token;
    const character=store.executeLive({commandId:'character',campaignId:campaign.id,token,action:{kind:'create-character',profile:{name:'Ada'}}}).character!;
    const progress=store.progress(token).characters.find(p=>p.characterId===character.id)!;
    store.executeProgress({commandId:'health',campaignId:campaign.id,token,action:{kind:'health',characterId:character.id,expectedRevision:progress.revision,operation:'set',health:zero(),reason:'Test'}});
    const scene=store.executeLive({commandId:'scene',campaignId:campaign.id,token,action:{kind:'initialize',expectedRosterRevision:1}}).scene!;
    store.executeLive({commandId:'membership',campaignId:campaign.id,token,action:{kind:'membership',characterId:character.id,expectedRevision:0,expectedRosterRevision:1,active:true,targetSceneId:scene.id,expectedFocusRevision:0}});
    let combat=store.executeCombat({commandId:'combat',campaignId:campaign.id,token,combatId:null,expectedRevision:null,action:{kind:'create',sceneId:scene.id,title:'Brücke',includeParty:true,expectedMembershipRevision:1}}).combat!;
    const command={commandId:'death-roll',campaignId:campaign.id,token,combatId:combat.id,expectedRevision:combat.revision,action:{kind:'death-roll' as const,participantId:combat.participants[0]!.id}};
    const first=store.executeCombat(command);assert.deepEqual(store.executeCombat(command),first);combat=first.combat!;
    const actor=combat.participants[0]!,roll=actor.deathLast!.roll!;assert.ok(roll>=1&&roll<=20);
    if(roll===20){assert.equal(actor.hp,1);assert.equal(actor.death,undefined);}else{assert.equal(actor.hp,0);assert.equal(actor.death?.successes,roll>=10?1:0);assert.equal(actor.death?.failures,roll===1?2:roll<10?1:0);}
    const liveHealth=store.progress(token).characters.find(p=>p.characterId===character.id)!;assert.deepEqual(liveHealth.health?.death,actor.death);assert.ok(liveHealth.healthCombat);
    store.executeCombat({commandId:'finish',campaignId:campaign.id,token,combatId:combat.id,expectedRevision:combat.revision,action:{kind:'finish',outcome:'Geborgen'}});
    const saved=store.progress(token).characters.find(p=>p.characterId===character.id)!;assert.equal(saved.healthCombat,undefined);assert.equal(saved.health?.hp,actor.hp);assert.deepEqual(saved.health?.death,actor.death);
  }finally{store.close();rmSync(root,{recursive:true,force:true});}
});

test('combat damage at zero HP records a failure and massive damage records death',()=>{
  const root=mkdtempSync(join(tmpdir(),'combat-zero-damage-')),store=new CampaignStore(join(root,'campaign.sqlite'),'test');
  try{
    const campaign=store.create('Schadensfolgen'),workspace=store.activate(campaign.id),token=workspace.token;
    const character=store.executeLive({commandId:'character',campaignId:campaign.id,token,action:{kind:'create-character',profile:{name:'Ada'}}}).character!,progress=store.progress(token).characters.find(p=>p.characterId===character.id)!;
    store.executeProgress({commandId:'health',campaignId:campaign.id,token,action:{kind:'health',characterId:character.id,expectedRevision:progress.revision,operation:'set',health:zero(),reason:'Test'}});
    const scene=store.executeLive({commandId:'scene',campaignId:campaign.id,token,action:{kind:'initialize',expectedRosterRevision:1}}).scene!;
    store.executeLive({commandId:'membership',campaignId:campaign.id,token,action:{kind:'membership',characterId:character.id,expectedRevision:0,expectedRosterRevision:1,active:true,targetSceneId:scene.id,expectedFocusRevision:0}});
    let combat=store.executeCombat({commandId:'combat',campaignId:campaign.id,token,combatId:null,expectedRevision:null,action:{kind:'create',sceneId:scene.id,title:'Brücke',includeParty:true,expectedMembershipRevision:1}}).combat!,actor=combat.participants[0]!;
    combat=store.executeCombat({commandId:'revive',campaignId:campaign.id,token,combatId:combat.id,expectedRevision:combat.revision,action:{kind:'death',participantId:actor.id,result:'natural-20'}}).combat!;actor=combat.participants[0]!;
    assert.equal(actor.hp,1);assert.deepEqual(actor.deathLast,{result:'natural-20',roll:null});
    combat=store.executeCombat({commandId:'knockdown',campaignId:campaign.id,token,combatId:combat.id,expectedRevision:combat.revision,action:{kind:'damage',participantId:actor.id,amount:1}}).combat!;actor=combat.participants[0]!;
    assert.equal(actor.hp,0);assert.equal(actor.death,undefined);assert.equal(actor.deathLast,undefined);
    combat=store.executeCombat({commandId:'damage',campaignId:campaign.id,token,combatId:combat.id,expectedRevision:combat.revision,action:{kind:'damage',participantId:actor.id,amount:5}}).combat!;actor=combat.participants[0]!;
    assert.deepEqual(actor.death,{successes:0,failures:1,stable:false,dead:false});assert.deepEqual(actor.deathLast,{result:'failure',roll:null});
    combat=store.executeCombat({commandId:'massive',campaignId:campaign.id,token,combatId:combat.id,expectedRevision:combat.revision,action:{kind:'damage',participantId:actor.id,amount:12}}).combat!;actor=combat.participants[0]!;
    assert.deepEqual(actor.death,{successes:0,failures:3,stable:false,dead:true});assert.deepEqual(actor.deathLast,{result:'dead',roll:null});
    const live=store.progress(token).characters.find(p=>p.characterId===character.id)!;assert.deepEqual(live.health?.death,actor.death);assert.ok(live.healthCombat);
  }finally{store.close();rmSync(root,{recursive:true,force:true});}
});
