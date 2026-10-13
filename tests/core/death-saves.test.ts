import assert from "node:assert/strict";
import test from "node:test";
import {
  applyDeathSave,
  checkedHealth,
  deathSaveControls,
  type CharacterHealth,
} from "../../src/app/progression";

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
  ])assert.throws(()=>checkedHealth(health));
});
