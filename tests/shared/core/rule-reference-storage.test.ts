import assert from "node:assert/strict";
import test from "node:test";
import {executeSceneRule} from "../../../src/app/storage/rule-references";
import {creatureActionRolls,creatureRollKey,criticalDamageFormula,formulaOutcome,legendaryActionCost} from '../../../src/app/shared/dice-formula';

const db={transaction:(run:()=>unknown)=>({immediate:run})};
const base={commandId:"command-1",campaignId:"campaign-1",token:"token-1",sceneId:"scene-1",expectedRevision:0};

test("scene rules reject unknown actions before reading or writing storage",()=>{
  const command={...base,action:{kind:"replace",noteId:"rule-1"}} as unknown as Parameters<typeof executeSceneRule>[1];
  assert.throws(()=>executeSceneRule(db,command,()=>{}),/Ungültiger Regelreferenz-Auftrag/);
});

test("scene rules reject malformed command identities before storage",()=>{
  const command={...base,commandId:7,action:{kind:"pin",noteId:"rule-1"}} as unknown as Parameters<typeof executeSceneRule>[1];
  assert.throws(()=>executeSceneRule(db,command,()=>{}),/Ungültiger Regelreferenz-Auftrag/);
});

test('attack outcomes honor natural rolls and critical damage doubles only dice',()=>{
  assert.equal(formulaOutcome('attack',1,12,10),'failure');
  assert.equal(formulaOutcome('attack',20,21,25),'success');
  assert.equal(formulaOutcome('attack',12,17,16),'success');
  assert.equal(criticalDamageFormula('2d6 + 3'),'4d6 + 3');
  assert.equal(legendaryActionCost({name:'Psychic Drain (Costs 2 Actions)'}),2);
  assert.equal(legendaryActionCost({name:'Tail Swipe'}),1);
});

test('statblock damage choices keep distinct alternatives and remove exact duplicates',()=>{
  const rolls=creatureActionRolls({id:'spear',name:'Spear',description:'Melee Weapon Attack: +4 to hit. Hit: 5 (1d6 + 2) piercing damage, or 6 (1d8 + 2) piercing damage. A repeated effect deals 5 (1d6 + 2) piercing damage.'});
  const damage=rolls.filter(roll=>roll.kind==='damage');
  assert.deepEqual(damage.map(roll=>roll.formula),['1d6 + 2','1d8 + 2']);
  assert.notEqual(creatureRollKey(damage[0]!),creatureRollKey(damage[1]!));
});
