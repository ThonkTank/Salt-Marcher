import assert from 'node:assert/strict';
import test from 'node:test';
import { currentProcessGroup } from '../tools/process-group.mjs';

for (const group of ['/', '/app.slice/app-chat.scope', '/app.slice/codex-owned-fixture.service']) {
  test('records group without resource or launcher constraints: ' + group, async () => {
    const reads = [];
    assert.equal(
      await currentProcessGroup(async (path) => {
        reads.push(path);
        return '0::' + group + '\n';
      }),
      group,
    );
    assert.deepEqual(reads, ['/proc/self/cgroup']);
  });
}
test('malformed process identity fails without launching work', async () => {
  for (const value of ['', '0::relative', '0::/../escape', '1:memory:/legacy'])
    await assert.rejects(() => currentProcessGroup(async () => value));
});
