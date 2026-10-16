import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

// Identity evidence for owned UI children, independent of resource policy.
export async function currentProcessGroup(read = readFile) {
  const lines=(await read('/proc/self/cgroup','utf8')).trim().split('\n');
  const group=lines.find(line=>line.startsWith('0::'))?.slice(3);
  assert(group?.startsWith('/')&&!group.includes('..'),'Missing unified process group');
  return group;
}
