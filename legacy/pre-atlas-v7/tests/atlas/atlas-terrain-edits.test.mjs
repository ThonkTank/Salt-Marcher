import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
const { outputFiles } = await build({
  entryPoints: ['src/app/atlas/atlas-terrain-edits.ts'],
  bundle: true,
  write: false,
  platform: 'node',
  format: 'esm',
});
const { AtlasTerrainEdits } = await import(
  'data:text/javascript;base64,' + Buffer.from(outputFiles[0].text).toString('base64')
);
const deferred = () => {
  let resolve;
  const promise = new Promise((r) => (resolve = r));
  return { promise, resolve };
};
const tick = async () => {
  for (let i = 0; i < 30; i++) await Promise.resolve();
};
const action = {
  kind: 'landscape-height-stroke',
  stroke: {
    samples: [
      { x: 0, y: 0, t: 0 },
      { x: 1, y: 0, t: 100 },
    ],
  },
};
function fixture(t, overrides = {}) {
  let source = { expectedRevision: 10, sourceFence: 'base' };
  const writes = [],
    receipts = [],
    statuses = [],
    projections = [],
    accepted = [];
  let released = 0,
    refreshes = 0,
    redraws = 0;
  const ack = (context, revision = context.expectedRevision + 1) => ({
    campaignId: 'campaign-a',
    commandId: context.commandId,
    revision,
    sourceFence: 'canonical-' + revision,
    canUndo: true,
    canRedo: false,
  });
  const ports = {
    source: () => source,
    blocked: () => false,
    painting: () => false,
    write: async (owner, a, context) => {
      writes.push({ owner, action: a, context });
      return ack(context);
    },
    receipt: async (owner, a, context) => {
      receipts.push({ owner, action: a, context });
      return { outcome: 'applied', ack: ack(context) };
    },
    readSource: async () => ({ expectedRevision: 11, sourceFence: 'canonical-11' }),
    acceptReceipt: (receipt) => accepted.push(receipt),
    reconcile: (source) => projections.push(source),
    releaseHeld: () => released++,
    refresh: async () => {
      refreshes++;
    },
    status: (status) => statuses.push(status),
    redraw: () => redraws++,
    ...overrides,
  };
  const terrain = new AtlasTerrainEdits(ports);
  terrain.activate({ token: 'a', campaignId: 'campaign-a' });
  terrain.open();
  t.after(() => terrain.hide());
  return {
    terrain,
    ports,
    writes,
    receipts,
    statuses,
    projections,
    accepted,
    ack,
    counts: () => ({ released, refreshes, redraws }),
    setSource: (next) => (source = next),
  };
}
async function lostPair(f) {
  const write = f.ports.write;
  let first = true;
  f.ports.write = async (...args) => {
    if (!first) return write(...args);
    first = false;
    f.writes.push({ owner: args[0], action: args[1], context: args[2] });
    throw Error('Lost first response');
  };
  const failed = assert.rejects(f.terrain.enqueue(action, 'first'), /Lost first/);
  const second = f.terrain.enqueue(action, 'second');
  second.catch(() => {});
  await failed;
  return { second };
}
test('two released gestures retain order across a lost response and continue exactly once', async (t) => {
  const f = fixture(t),
    { second } = await lostPair(f);
  assert.equal(await f.terrain.drain(), false);
  assert.throws(() => f.terrain.activate({ token: 'b', campaignId: 'b' }), /Kampagnenwechsel/);
  await Promise.all([f.terrain.resolve(), f.terrain.resolve()]);
  await second;
  assert.deepEqual(
    f.writes.map((w) => w.context.commandId),
    ['first', 'second'],
  );
  assert.equal(f.receipts.length, 1);
  assert.equal(f.writes[1].context.expectedRevision, 11);
  assert.equal(f.writes[1].context.sourceFence, 'canonical-11');
  assert.equal(await f.terrain.drain(), true);
  assert.equal(f.counts().released, 1);
  assert.deepEqual(f.projections, [{ expectedRevision: 12, sourceFence: 'canonical-12' }]);
  assert.equal(f.statuses.at(-1), 'saved');
  f.terrain.releaseSettled();
  f.terrain.activate({ token: 'b', campaignId: 'b' });
});
for (const decision of ['retry', 'discard'])
  test(`confirmed prefix survives read failure and changed source requires explicit ${decision}`, async (t) => {
    let reads = 0;
    const f = fixture(t, {
        readSource: async () => {
          if (++reads === 1) throw Error('Source unavailable');
          return { expectedRevision: 12, sourceFence: 'canonical-12' };
        },
      }),
      { second } = await lostPair(f);
    await f.terrain.resolve();
    assert.equal(f.terrain.view.failureKind, 'source');
    assert.equal(f.terrain.view.pending, 1);
    await f.terrain.resolve();
    assert.equal(f.terrain.view.failureKind, 'rejected');
    assert.equal(f.writes.length, 1);
    await f.terrain.resolve();
    assert.equal(f.writes.length, 1, 'read controls cannot decide to replay');
    const outcome = decision === 'discard' ? assert.rejects(second, /verworfen/) : second;
    await f.terrain[decision]();
    await outcome;
    assert.equal(f.terrain.view.pending, 0);
    assert.equal(f.receipts.length, 1, 'the applied prefix is never read or written again');
    assert.equal(f.writes.length, decision === 'retry' ? 2 : 1);
    if (decision === 'retry') assert.equal(f.writes[1].context.expectedRevision, 12);
    assert.equal(f.counts().released, 1);
    assert.equal(f.statuses.at(-1), decision === 'retry' ? 'saved' : 'discarded');
  });
test('hidden receipt replies do not publish; reopening resumes the retained command', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const read = deferred();
  let calls = 0;
  const f = fixture(t, {
      receipt: async (...args) => {
        calls++;
        if (calls === 1) return read.promise;
        return { outcome: 'applied', ack: f.ack(args[2]) };
      },
    }),
    { second } = await lostPair(f);
  t.mock.timers.tick(200);
  await tick();
  assert.equal(calls, 1);
  f.terrain.hide();
  f.terrain.open();
  const statuses = [...f.statuses];
  read.resolve({ outcome: 'applied', ack: f.ack(f.writes[0].context) });
  await tick();
  assert.deepEqual(f.statuses, statuses);
  assert.equal(f.terrain.view.pending, 2, 'retired read cannot mutate retained queue');
  t.mock.timers.tick(200);
  await tick();
  await second;
  assert.equal(calls, 2);
  assert.equal(f.writes.length, 2);
  assert.equal(f.terrain.view.pending, 0);
});
test('one safe automatic replay preserves the original command', async (t) => {
  const f = fixture(t, {
      receipt: async () => ({ outcome: 'not-applied' }),
      readSource: async () => ({ expectedRevision: 10, sourceFence: 'base' }),
    }),
    { second } = await lostPair(f);
  await f.terrain.resolve();
  await second;
  assert.deepEqual(
    f.writes.map((w) => w.context.commandId),
    ['first', 'first', 'second'],
  );
  assert.deepEqual(f.writes[0].context, f.writes[1].context);
  assert.equal(f.terrain.view.pending, 0);
  assert.equal(f.counts().released, 1);
});

for (const outcome of ['reply', 'failure'])
  test(`a retired source ${outcome} cannot reconcile or release held terrain after reopening`, async (t) => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    let resolveSource,
      rejectSource,
      reads = 0;
    const source = new Promise((resolve, reject) => {
      resolveSource = resolve;
      rejectSource = reject;
    });
    const f = fixture(t, {
        readSource: () =>
          ++reads === 1
            ? source
            : Promise.resolve({ expectedRevision: 11, sourceFence: 'canonical-11' }),
      }),
      { second } = await lostPair(f);
    const recovering = f.terrain.resolve();
    await tick();
    assert.equal(reads, 1);
    assert.equal(f.terrain.view.pending, 1, 'the applied prefix is already confirmed');
    f.terrain.hide();
    f.terrain.open();
    const statuses = [...f.statuses],
      accepted = [...f.accepted];
    if (outcome === 'reply') resolveSource({ expectedRevision: 999, sourceFence: 'retired' });
    else rejectSource(Error('Retired source failed'));
    await recovering;
    assert.deepEqual(f.statuses, statuses);
    assert.deepEqual(f.accepted, accepted);
    assert.deepEqual(f.projections, []);
    assert.equal(f.writes.length, 1, 'retired source cannot dispatch the held successor');
    assert.equal(f.counts().released, 0);
    assert.equal(f.terrain.view.pending, 1);
    await f.terrain.resolve();
    await second;
    assert.equal(reads, 2);
    assert.deepEqual(
      f.writes.map((w) => w.context.commandId),
      ['first', 'second'],
    );
    assert.equal(f.writes[1].context.expectedRevision, 11);
    assert.equal(f.writes[1].context.sourceFence, 'canonical-11');
    assert.equal(f.receipts.length, 1, 'confirmed prefix is never replayed or rechecked');
    assert.equal(f.terrain.view.pending, 0);
    assert.equal(f.counts().released, 1);
    assert.equal(f.statuses.at(-1), 'saved');
  });
