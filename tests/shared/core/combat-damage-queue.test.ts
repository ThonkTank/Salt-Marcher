import assert from 'node:assert/strict';
import test from 'node:test';
import {deferLegendaryCost,enqueuePendingDamage,retainPendingAttack,pendingRollStillValid} from '../../../src/app/runtime/combat';
import {fighterDraftBasisMatches} from '../../../src/app/runtime/combat-draft-contracts';

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

test('automatic round state does not conflict with fighter drafts',()=>{
  const before={id:'fighter',name:'Goblin',conditions:'',legendaryActions:{remaining:3},timedEffects:[{id:'effect',remaining:2}]} as any;
  assert.equal(fighterDraftBasisMatches(before,{...before,legendaryActions:{remaining:2},timedEffects:[{id:'effect',remaining:1}]}),true);
  assert.equal(fighterDraftBasisMatches(before,{...before,conditions:'Liegend'}),false);
});
