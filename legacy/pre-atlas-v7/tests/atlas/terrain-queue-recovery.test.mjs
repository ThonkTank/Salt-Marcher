import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
const { outputFiles } = await build({
  entryPoints: ['src/app/atlas/terrain-queue-recovery.ts'],
  bundle: true,
  write: false,
  platform: 'node',
  format: 'esm',
});
const { TerrainQueueRecovery } = await import(
  'data:text/javascript;base64,' + Buffer.from(outputFiles[0].text).toString('base64')
);
const flush = async () => {
  for (let i = 0; i < 8; i++) await Promise.resolve();
};
test('uncertainty retries automatically, shares a running read and stops once resolved', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let needed = true,
    calls = 0,
    release;
  const recovery = new TerrainQueueRecovery(
    () => needed,
    async () => {
      calls++;
      if (calls === 1) await new Promise((r) => (release = r));
      else needed = false;
    },
  );
  recovery.schedule();
  recovery.schedule();
  t.mock.timers.tick(200);
  await flush();
  assert.equal(calls, 1);
  recovery.schedule();
  t.mock.timers.tick(5000);
  assert.equal(calls, 1);
  release();
  await flush();
  t.mock.timers.tick(400);
  await flush();
  assert.equal(calls, 2);
  t.mock.timers.tick(20000);
  await flush();
  assert.equal(calls, 2);
});
test('temporary read failures retry; conflict and hidden owner stop automatic work', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let needed = true,
    calls = 0;
  const recovery = new TerrainQueueRecovery(
    () => needed,
    async () => {
      calls++;
      if (calls === 1) throw Error('read unavailable');
      needed = false;
    },
  );
  recovery.schedule();
  t.mock.timers.tick(200);
  await flush();
  t.mock.timers.tick(400);
  await flush();
  assert.equal(calls, 2);
  needed = true;
  recovery.schedule();
  recovery.stop();
  t.mock.timers.tick(20000);
  await flush();
  assert.equal(calls, 2);
});
