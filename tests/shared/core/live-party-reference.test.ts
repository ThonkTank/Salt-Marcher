import assert from 'node:assert/strict';
import test from 'node:test';
import {partyHealthFacts,partyProgressFacts,passivePerceptionResult} from '../../../src/app/runtime/live-party-reference';

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

test('party quick reference shows unresolved death-save counts',()=>{
  assert.equal(partyHealthFacts({
    health:{hp:0,maxHp:12,tempHp:0,conditions:'',concentrating:false,death:{successes:1,failures:2,stable:false,dead:false}},
  }),'0 / 12 HP · Todesrettung 1✓ / 2✗');
});

test('party quick reference summarizes level and overdue rest',()=>{
  assert.equal(partyProgressFacts({xp:300,rest:{known:true,longXp:600,shortXp:0,baseline:0,sections:0}}),'Level 2 · Lange Rast fällig');
  assert.equal(partyProgressFacts({xp:null,rest:{known:false,longXp:0,shortXp:0,baseline:0,sections:0}}),'Level offen · Rastbudget offen');
});

test('passive perception check names successes and missing values',()=>{
  assert.equal(passivePerceptionResult([
    {name:'Ada',passivePerception:16},
    {name:'Borin',passivePerception:12},
    {name:'Cora'},
  ],15),'SG 15 · Bemerken: Ada. Ohne Wert: Cora.');
  assert.equal(passivePerceptionResult([{name:'Borin',passivePerception:12}],15),'SG 15 · Bemerkt niemand.');
  assert.equal(passivePerceptionResult([{name:'Borin',passivePerception:12},{name:'Cora'}],15),'SG 15 · Mit bekanntem Wert bemerkt niemand. Ohne Wert: Cora.');
  assert.equal(passivePerceptionResult([{name:'Cora'}],15),'SG 15 · Keine passive Wahrnehmung eingetragen. Ohne Wert: Cora.');
});
