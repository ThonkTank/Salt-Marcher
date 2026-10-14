import assert from 'node:assert/strict';
import test from 'node:test';
import {enqueuePendingDamage} from '../../src/app/combat';

test('unresolved combat damage rolls remain queued in roll order',()=>{
  const damage=(id:string)=>({check:{id} as any,combatId:'combat',attackerId:'attacker'});
  let queue=enqueuePendingDamage([],damage('first'));
  queue=enqueuePendingDamage(queue,damage('second'));
  queue=enqueuePendingDamage(queue,damage('first'));
  assert.deepEqual(queue.map(entry=>entry.check.id),['first','second']);
  assert.deepEqual(queue.slice(1).map(entry=>entry.check.id),['second']);
});
