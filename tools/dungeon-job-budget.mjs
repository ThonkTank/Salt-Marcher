import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

// Fail before bundling or launching outside the shared job budget.
export async function assertDungeonJobBudget(read = readFile) {
  const group=(await read('/proc/self/cgroup','utf8')).trim().split('::')[1];
  assert(group?.match(/\/codex-dungeon-jobs\.slice\/codex-dungeon-(qa|realist|planner|implementer)-/)&&group.endsWith('.service'),'Run through codex-dungeon-job');
  assert.equal((await read('/sys/fs/cgroup'+group+'/memory.max','utf8')).trim(),'4294967296');
  assert.equal((await read('/sys/fs/cgroup'+group+'/memory.swap.max','utf8')).trim(),'0');
  return group;
}
