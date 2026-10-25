import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
const { outputFiles } = await build({
  entryPoints: ['src/app/atlas/terrain-stroke-queue.ts'],
  bundle: true,
  write: false,
  platform: 'node',
  format: 'esm',
});
const { TerrainStrokeQueue, TerrainDraftStroke } = await import(
  'data:text/javascript;base64,' + Buffer.from(outputFiles[0].text).toString('base64')
);
const action = {
  kind: 'landscape-height-stroke',
  stroke: {
    samples: [
      { x: 1, y: 2, t: 0 },
      { x: 1, y: 2, t: 100 },
    ],
  },
};
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((a, b) => {
    resolve = a;
    reject = b;
  });
  return { promise, resolve, reject };
};
test('immediate second gesture waits for first receipt, uses its source and distinct undo identity', async () => {
  const gate = deferred(),
    calls = [];
  const queue = new TerrainStrokeQueue({ expectedRevision: 7, sourceFence: 'a' }, async (a, c) => {
    calls.push({ a, c });
    if (calls.length === 1) await gate.promise;
    return { revision: c.expectedRevision + 1, sourceFence: c.sourceFence + 'x' };
  });
  const first = new TerrainDraftStroke((a) => queue.enqueue(a, 'first'));
  first.update(action);
  assert.equal(calls.length, 0);
  const p = first.finish();
  const second = new TerrainDraftStroke((a) => queue.enqueue(a, 'second'));
  second.update(action);
  const q = second.finish();
  await Promise.resolve();
  assert.equal(queue.pending, 2);
  assert.equal(calls.length, 1);
  action.stroke.samples[1].x = 99;
  gate.resolve();
  await Promise.all([p, q]);
  assert.deepEqual(
    calls.map((c) => c.c),
    [
      { id: 'first', expectedRevision: 7, sourceFence: 'a' },
      { id: 'second', expectedRevision: 8, sourceFence: 'ax' },
    ],
  );
  assert.equal(calls[1].a.stroke.samples[1].x, 1);
  assert.equal(queue.pending, 0);
});
test('unknown write freezes dependent gestures, without retries or invented acknowledgements', async () => {
  const gate = deferred();
  let calls = 0;
  const queue = new TerrainStrokeQueue({ expectedRevision: 0, sourceFence: 'a' }, async () => {
    calls++;
    await gate.promise;
    throw Error('unknown');
  });
  const first = queue.enqueue(action, 'first'),
    second = queue.enqueue(action, 'second');
  const results = Promise.allSettled([first, second]);
  gate.resolve();
  assert((await results).every((r) => r.status === 'rejected'));
  assert.equal(calls, 1);
  assert(queue.failed);
  await assert.rejects(queue.enqueue(action, 'third'), /unknown/);
  await assert.rejects(queue.finish(), /unknown/);
});
test('missing fence and regressing revision stop dependent writes', async () => {
  for (const ack of [{ revision: 8 }, { revision: 6, sourceFence: 'b' }]) {
    let calls = 0;
    const queue = new TerrainStrokeQueue({ expectedRevision: 7, sourceFence: 'a' }, async () => {
      calls++;
      return ack;
    });
    const results = await Promise.allSettled([
      queue.enqueue(action, 'a'),
      queue.enqueue(action, 'b'),
    ]);
    assert(results.every((r) => r.status === 'rejected'));
    assert.equal(calls, 1);
  }
});
