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
const {
  TerrainStrokeQueue,
  TerrainDraftStroke,
  TerrainStrokeWriteError,
  TerrainStrokeDiscardedError,
} = await import(
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
    return {
      commandId: c.commandId,
      revision: c.expectedRevision + 1,
      sourceFence: c.sourceFence + 'x',
    };
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
      { id: 'first', commandId: 'first', expectedRevision: 7, sourceFence: 'a' },
      { id: 'second', commandId: 'second', expectedRevision: 8, sourceFence: 'ax' },
    ],
  );
  assert.equal(calls[1].a.stroke.samples[1].x, 1);
  assert.equal(queue.pending, 0);
});
const tick = () => new Promise(setImmediate);
const ack = (c) => ({
  commandId: c.commandId,
  revision: c.expectedRevision + 1,
  sourceFence: c.sourceFence + 'x',
});
test('unknown keeps the same closed successor and resumes it once after receipt and source resolution', async () => {
  const calls = [];
  const queue = new TerrainStrokeQueue({ expectedRevision: 0, sourceFence: 'a' }, async (a, c) => {
    calls.push({ a, c });
    if (c.id === 'first') throw new TerrainStrokeWriteError('unknown', 'unknown');
    return ack(c);
  });
  const first = queue.enqueue(action, 'first');
  const firstFailed = assert.rejects(first, /unknown/);
  let completed = false;
  const second = queue.enqueue(action, 'second').then(() => {
    completed = true;
  });
  await firstFailed;
  await assert.rejects(queue.finish(), /unknown/);
  assert.equal(completed, false);
  assert.equal(queue.pending, 2);
  assert.equal(calls.length, 1);
  assert.throws(() => queue.confirm({ commandId: 'foreign', revision: 1 }), /gehört nicht/);
  queue.confirm({ commandId: 'first', revision: 1 });
  assert.equal(queue.failureKind, 'source');
  assert.equal(queue.head.id, 'second');
  assert.throws(() => queue.resume({ expectedRevision: 1, sourceFence: '' }), /quelle fehlt/);
  await assert.rejects(queue.finish(), /quelle noch laden/i);
  assert.equal(calls.length, 1);
  queue.resume({ expectedRevision: 1, sourceFence: 'canonical-1' });
  await second;
  await queue.finish();
  assert.deepEqual(
    calls.map((x) => x.c),
    [
      { id: 'first', commandId: 'first', expectedRevision: 0, sourceFence: 'a' },
      { id: 'second', commandId: 'second', expectedRevision: 1, sourceFence: 'canonical-1' },
    ],
  );
  assert.equal(queue.pending, 0);
});
test('a further unknown keeps its own original command and every remaining successor', async () => {
  const calls = [];
  const queue = new TerrainStrokeQueue({ expectedRevision: 0, sourceFence: 'a' }, async (a, c) => {
    calls.push(c);
    if (c.id !== 'third') throw new TerrainStrokeWriteError('unknown ' + c.id, 'unknown');
    return ack(c);
  });
  const first = assert.rejects(queue.enqueue(action, 'first'), /unknown/);
  const second = assert.rejects(queue.enqueue(action, 'second'), /unknown/);
  const third = queue.enqueue(action, 'third');
  await first;
  await assert.rejects(queue.finish(), /unknown/);
  queue.confirm({ commandId: 'first', revision: 1 });
  queue.resume({ expectedRevision: 1, sourceFence: 'b' });
  await second;
  await assert.rejects(queue.finish(), /unknown second/);
  assert.equal(queue.pending, 2);
  assert.equal(queue.head.context.commandId, 'second');
  queue.confirm({ commandId: 'second', revision: 2 });
  queue.resume({ expectedRevision: 2, sourceFence: 'c' });
  await third;
  await queue.finish();
  assert.deepEqual(
    calls.map((c) => c.commandId),
    ['first', 'second', 'third'],
  );
});
test('safe rejection retains all input and requires an explicit retry instead of automatic replay', async () => {
  const calls = [];
  const queue = new TerrainStrokeQueue({ expectedRevision: 0, sourceFence: 'a' }, async (a, c) => {
    calls.push(c);
    if (calls.length === 1) throw new TerrainStrokeWriteError('conflict', 'rejected');
    return ack(c);
  });
  const first = assert.rejects(queue.enqueue(action, 'first'), /conflict/);
  const second = queue.enqueue(action, 'second');
  await first;
  await assert.rejects(queue.finish(), /conflict/);
  assert.equal(queue.failureKind, 'rejected');
  assert.equal(queue.pending, 2);
  assert.throws(() => queue.resume({ expectedRevision: 0, sourceFence: 'a' }), /Ausgang/);
  await tick();
  assert.equal(calls.length, 1);
  queue.retry({ expectedRevision: 0, sourceFence: 'fresh' });
  await second;
  await queue.finish();
  assert.deepEqual(
    calls.map((c) => c.commandId),
    ['first', 'first', 'second'],
  );
  assert.equal(calls[1].sourceFence, 'fresh');
});
test('not-applied differs from unknown; only explicit discard releases rejected input', async () => {
  const queue = new TerrainStrokeQueue({ expectedRevision: 0, sourceFence: 'a' }, async () => {
    throw new TerrainStrokeWriteError('lost', 'unknown');
  });
  const first = assert.rejects(queue.enqueue(action, 'first'), /lost/);
  const second = assert.rejects(queue.enqueue(action, 'second'), TerrainStrokeDiscardedError);
  await first;
  await assert.rejects(queue.finish(), /lost/);
  assert.throws(() => queue.discard({ expectedRevision: 0, sourceFence: 'a' }), /nicht verworfen/);
  queue.notApplied();
  assert.equal(queue.failureKind, 'rejected');
  assert.equal(queue.pending, 2);
  queue.discard({ expectedRevision: 0, sourceFence: 'a' });
  await second;
  await queue.finish();
  assert.equal(queue.pending, 0);
});
test('capacity refuses new input without dropping any already closed gesture', async () => {
  const gate = deferred(),
    calls = [];
  const queue = new TerrainStrokeQueue({ expectedRevision: 0, sourceFence: 'a' }, async (a, c) => {
    calls.push(c);
    await gate.promise;
    return ack(c);
  });
  const completions = Array.from({ length: 32 }, (_, i) => queue.enqueue(action, String(i)));
  assert.equal(queue.hasCapacity, false);
  assert.equal(queue.pending, 32);
  await assert.rejects(queue.enqueue(action, 'overflow'), /32 Pinselzüge/);
  assert.equal(queue.pending, 32);
  gate.resolve();
  await Promise.all(completions);
  await queue.finish();
  assert.deepEqual(
    calls.map((c) => c.id),
    Array.from({ length: 32 }, (_, i) => String(i)),
  );
});
test('Escape drops only an active draft and never a released pending stroke', async () => {
  const gate = deferred();
  let calls = 0;
  const released = new TerrainDraftStroke(async () => {
    calls++;
    await gate.promise;
  });
  released.update(action);
  const saved = released.finish();
  const active = new TerrainDraftStroke(async () => {
    calls++;
  });
  active.update(action);
  await active.stop();
  await active.finish();
  assert.equal(calls, 1);
  const stopped = released.stop();
  gate.resolve();
  await Promise.all([saved, stopped]);
  assert.equal(calls, 1);
  assert.equal(released.hasCommittedChanges, true);
});
for (const invalid of [{ revision: 8 }, { revision: 6, sourceFence: 'b' }])
  test(
    'invalid acknowledgements retain both gestures without inventing a new source ' +
      JSON.stringify(invalid),
    async () => {
      const queue = new TerrainStrokeQueue(
        { expectedRevision: 7, sourceFence: 'a' },
        async () => invalid,
      );
      const first = assert.rejects(queue.enqueue(action, 'first'), /unvollständig/);
      void queue.enqueue(action, 'second');
      await first;
      await assert.rejects(queue.finish(), /unvollständig/);
      assert.equal(queue.pending, 2);
      assert.equal(queue.failureKind, 'unknown');
      assert.equal(queue.head.context.sourceFence, 'a');
    },
  );

test('a changed source after confirmation exposes only unsent successors for explicit discard', async () => {
  const calls = [];
  const queue = new TerrainStrokeQueue({ expectedRevision: 0, sourceFence: 'a' }, async (a, c) => {
    calls.push(c);
    throw new TerrainStrokeWriteError('lost', 'unknown');
  });
  const first = assert.rejects(queue.enqueue(action, 'first'), /lost/);
  const second = assert.rejects(queue.enqueue(action, 'second'), TerrainStrokeDiscardedError);
  await first;
  await assert.rejects(queue.finish());
  assert.throws(() => queue.sourceConflict(), /ungesendete/);
  queue.confirm({ commandId: 'first', revision: 1 });
  queue.sourceConflict();
  assert.equal(queue.failureKind, 'rejected');
  assert.equal(queue.head.id, 'second');
  queue.discard({ expectedRevision: 2, sourceFence: 'foreign-2' });
  await second;
  await queue.finish();
  assert.equal(queue.pending, 0);
  assert.equal(calls.length, 1, 'confirmed first and discarded second are never replayed');
  assert.deepEqual(queue.confirmedSource, { expectedRevision: 2, sourceFence: 'foreign-2' });
});

test('a receipt for another command cannot remove or advance the original gesture', async () => {
  const queue = new TerrainStrokeQueue(
    { expectedRevision: 0, sourceFence: 'original' },
    async (_a, c) => ({ ...ack(c), commandId: 'other' }),
  );
  await assert.rejects(queue.enqueue(action, 'original'), /unvollständig/);
  assert.equal(queue.pending, 1);
  assert.equal(queue.head.id, 'original');
  assert.deepEqual(queue.confirmedSource, { expectedRevision: 0, sourceFence: 'original' });
});

test('explicit reapply after a foreign edit writes only the unconfirmed successor on the current source', async () => {
  const calls = [];
  const queue = new TerrainStrokeQueue({ expectedRevision: 0, sourceFence: 'a' }, async (a, c) => {
    calls.push(structuredClone(c));
    if (c.id === 'A') throw new TerrainStrokeWriteError('lost', 'unknown');
    return ack(c);
  });
  const first = assert.rejects(queue.enqueue(action, 'A'), /lost/);
  const second = queue.enqueue(action, 'B');
  await first;
  queue.confirm({ commandId: 'A', revision: 1, sourceFence: 'after-A' });
  queue.sourceConflict();
  assert.equal(queue.pending, 1);
  assert.equal(queue.head.id, 'B');
  queue.retry({ expectedRevision: 2, sourceFence: 'foreign' });
  await second;
  await queue.finish();
  assert.deepEqual(
    calls.map((c) => c.id),
    ['A', 'B'],
  );
  assert.equal(calls[1].expectedRevision, 2);
  assert.equal(calls[1].sourceFence, 'foreign');
});
