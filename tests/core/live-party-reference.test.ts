import assert from 'node:assert/strict';
import test from 'node:test';
import {partyHealthFacts} from '../../src/app/live-party-reference';

test('party quick reference uses current combat health and conditions',()=>{
  assert.equal(partyHealthFacts({
    health:{hp:6,maxHp:12,tempHp:3,conditions:'Vergiftet',concentrating:true},
    healthCombat:{title:'Hafentor'},
    lastCombatStatus:{tempHp:3,conditions:'Vergiftet',concentrating:true},
  }),'6 / 12 HP · 3 temp. HP · Vergiftet · Konzentration');
});

test('party quick reference identifies combat ownership when exact health is unknown',()=>{
  assert.equal(partyHealthFacts({
    health:null,
    healthCombat:{title:'Hafentor'},
    lastCombatStatus:{tempHp:0,conditions:'Geblendet',concentrating:false},
  }),'HP im Kampf „Hafentor“ · Geblendet');
});

test('party quick reference shows terminal death-save state',()=>{
  assert.equal(partyHealthFacts({
    health:{hp:0,maxHp:12,tempHp:0,conditions:'',concentrating:false,death:{successes:1,failures:3,stable:false,dead:true}},
  }),'0 / 12 HP · Tot');
});
