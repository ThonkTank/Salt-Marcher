import assert from 'node:assert/strict';
import test from 'node:test';
import {deferLegendaryCost,enqueuePendingDamage,retainPendingAttack,hasCombatCondition,pendingRollStillValid,rebaseFighterDraft,setCombatCondition} from '../../src/app/combat';

test('unresolved combat damage rolls remain queued in roll order',()=>{
  const damage=(id:string)=>({check:{id} as any,combatId:'combat',attackerId:'attacker'});
  let queue=enqueuePendingDamage([],damage('first'),'combat');
  queue=enqueuePendingDamage(queue,damage('second'),'combat');
  queue=enqueuePendingDamage(queue,damage('first'),'combat');
  assert.deepEqual(queue.map(entry=>entry.check.id),['first','second']);
  assert.deepEqual(queue.slice(1).map(entry=>entry.check.id),['second']);
  assert.deepEqual(enqueuePendingDamage(queue,{...damage('stale'),combatId:'previous'},'combat'),queue);
});

test('a second statblock attack cannot replace an unresolved attack',()=>{
  const first={actionId:'scimitar'},second={actionId:'shortbow'};
  assert.equal(retainPendingAttack(null,first),first);
  assert.equal(retainPendingAttack(first,second),first);
});

test('pending statblock rolls expire when their attacker or editable combat disappears',()=>{
  const pending={combatId:'combat',attackerId:'attacker'};
  const combat={id:'combat',phase:'running',participants:[{id:'attacker'}]} as any;
  assert.equal(pendingRollStillValid(pending,combat),true);
  assert.equal(pendingRollStillValid(pending,{...combat,participants:[]}),false);
  assert.equal(pendingRollStillValid(pending,{...combat,phase:'finished'}),false);
  assert.equal(pendingRollStillValid(pending,{...combat,id:'other'}),false);
  assert.equal(pendingRollStillValid(null,combat),false);
});

test('legendary cost waits for a targeted roll but not an immediate damage roll',()=>{
  assert.equal(deferLegendaryCost('attack'),true);
  assert.equal(deferLegendaryCost('save'),true);
  assert.equal(deferLegendaryCost('check'),true);
  assert.equal(deferLegendaryCost('damage'),false);
});

test('condition shortcuts preserve free notes and recognize catalog language',()=>{
  const added=setCombatCondition('Fluch des Sehers; Poisoned','Liegend','Prone',true);
  assert.equal(added,'Fluch des Sehers, Poisoned, Liegend');
  assert.equal(hasCombatCondition(added,'Vergiftet','Poisoned'),true);
  assert.equal(setCombatCondition(added,'Vergiftet','Poisoned',false),'Fluch des Sehers, Liegend');
  assert.equal(setCombatCondition(added,'Liegend','Prone',true),added);
});

test('round effect changes rebase an open fighter draft without losing its inputs',()=>{
  const originalBasis={id:'fighter',name:'Goblin',timedEffects:[]} as any;
  const draft={version:1,kind:'fighter',writeId:'old-write',combatId:'combat',sceneId:'scene',targetId:'fighter',basis:originalBasis,revision:4,values:{'fighter-name':'Goblin Entwurf'},concentrating:false,counted:true} as any;
  const updatedBasis={...originalBasis,timedEffects:[{id:'effect',name:'Brennend',remaining:2,tick:'end'}]};
  const rebased=rebaseFighterDraft(draft,updatedBasis,5,'new-write');
  assert.equal(rebased.writeId,'new-write');
  assert.equal(rebased.revision,5);
  assert.deepEqual(rebased.basis,updatedBasis);
  assert.equal(rebased.values['fighter-name'],'Goblin Entwurf');
  assert.equal(draft.writeId,'old-write');
  assert.deepEqual(draft.basis,originalBasis);
});
