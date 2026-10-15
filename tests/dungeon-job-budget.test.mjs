import assert from 'node:assert/strict';
import test from 'node:test';
import {assertDungeonJobBudget} from '../tools/dungeon-job-budget.mjs';

const group=role=>'/user.slice/user-1000.slice/codex-dungeon-jobs.slice/codex-dungeon-'+role+'-fixture.service';
function fixture(path, memory='4294967296', swap='0') {
  const values=new Map([
    ['/proc/self/cgroup','0::'+path+'\n'],
    ['/sys/fs/cgroup'+path+'/memory.max',memory+'\n'],
    ['/sys/fs/cgroup'+path+'/memory.swap.max',swap+'\n']
  ]);
  const reads=[];
  return {reads,read:async file=>{reads.push(file);assert(values.has(file),'unexpected filesystem access');return values.get(file);}};
}

for(const role of ['qa','realist','planner','implementer']) {
  test('accepts a protected '+role+' job and returns its exact process group',async()=>{
    const f=fixture(group(role));
    assert.equal(await assertDungeonJobBudget(f.read),group(role));
    assert.deepEqual(f.reads,['/proc/self/cgroup',...['memory.max','memory.swap.max'].map(n=>'/sys/fs/cgroup'+group(role)+'/'+n)]);
  });
}

for(const path of ['',group('unknown'),group('qa').replace('codex-dungeon-jobs.slice','outside.slice'),group('qa').replace(/\.service$/,'.scope')]) {
  test('rejects an unprotected process group before accessing its limits: '+path,async()=>{
    const f=fixture(path);await assert.rejects(()=>assertDungeonJobBudget(f.read),/Run through codex-dungeon-job/);
    assert.deepEqual(f.reads,['/proc/self/cgroup']);
  });
}

for(const [memory,swap] of [['max','0'],['8589934592','0'],['4294967296','max'],['4294967296','1']]) {
  test('rejects changed memory/swap limits: '+memory+'/'+swap,async()=>{
    const f=fixture(group('qa'),memory,swap);await assert.rejects(()=>assertDungeonJobBudget(f.read));
  });
}

test('unreadable resource metadata fails closed',async()=>{
  const failure=new Error('unavailable cgroup');
  await assert.rejects(()=>assertDungeonJobBudget(async()=>{throw failure;}),e=>e===failure);
});
