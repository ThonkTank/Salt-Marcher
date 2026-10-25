import assert from 'node:assert/strict';
import test from 'node:test';
import {hasCombatCondition,setCombatCondition} from '../../../src/app/runtime/combat-contracts';

test('condition shortcuts preserve free notes and recognize catalog language',()=>{
  const added=setCombatCondition('Fluch des Sehers; Poisoned','Liegend','Prone',true);
  assert.equal(added,'Fluch des Sehers, Poisoned, Liegend');
  assert.equal(hasCombatCondition(added,'Vergiftet','Poisoned'),true);
  assert.equal(setCombatCondition(added,'Vergiftet','Poisoned',false),'Fluch des Sehers, Liegend');
  assert.equal(setCombatCondition(added,'Liegend','Prone',true),added);
});

