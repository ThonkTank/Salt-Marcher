import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSync } from 'esbuild';
import { createRequire } from 'node:module';
buildSync({
  entryPoints: ['src/app/atlas/terrain-presentation.ts'],
  outfile: '.build/terrain-presentation-test.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
});
const { TerrainPresentation, terrainSnapshotStillValid, interactiveTerrainFrame } = createRequire(
  import.meta.url,
)('../../.build/terrain-presentation-test.cjs');
const identity = (revision) => ({ revision, fence: 'f' + revision });
const frame = (revision) => ({
  kind: 'full',
  target: identity(revision),
  view: 'top',
  layer: {},
  invalidation: { reset: false, bounds: [] },
});
const tick = () => new Promise(setImmediate);
test('slow display keeps one read and latest successor, publishing actual snapshot identities', async () => {
  const requests = [],
    resolve = [],
    shown = [],
    errors = [];
  const display = new TerrainPresentation(
    (source) => {
      requests.push(source);
      return new Promise((r) => resolve.push(r));
    },
    (f) => shown.push(f.target),
    (e) => errors.push(e),
  );
  display.update(identity(1));
  for (let n = 2; n <= 100; n++) display.update(identity(n));
  assert.equal(requests.length, 1);
  resolve.shift()(frame(1));
  await tick();
  assert.deepEqual(
    shown,
    [identity(1)],
    'older confirmed picture remains useful, never relabelled as 100',
  );
  assert.deepEqual(requests, [identity(1), identity(100)]);
  // Main can open a newer committed snapshot than the caller knew about.
  resolve.shift()(frame(101));
  await tick();
  assert.deepEqual(shown, [identity(1), identity(101)]);
  assert.deepEqual(errors, []);
  display.update(identity(102));
  display.stop();
  resolve.shift()(frame(102));
  await tick();
  assert.equal(shown.length, 2, 'late replies cannot redraw a closed gesture');
});
test('stale queued snapshots yield to latest confirmed input; terminal failures remain visible', async () => {
  const rejects = [],
    errors = [],
    requests = [];
  const display = new TerrainPresentation(
    (source) => {
      requests.push(source);
      return new Promise((_, r) => rejects.push(r));
    },
    () => assert.fail('no picture'),
    (e) => errors.push(e.message),
  );
  display.update(identity(1));
  display.update(identity(2));
  rejects.shift()(Error('Gelände inzwischen geändert'));
  await tick();
  assert.equal(requests.length, 2);
  assert.deepEqual(errors, []);
  rejects.shift()(Error('worker exited'));
  await tick();
  assert.deepEqual(errors, ['worker exited']);
  display.update(identity(3));
  assert.equal(requests.length, 3);
  display.stop();
  rejects.shift()(Error('late failure'));
  await tick();
  assert.equal(errors.length, 1);
});
test('a reply older than requested cannot replace the shown frame', async () => {
  const shown = [],
    display = new TerrainPresentation(
      async () => frame(4),
      (f) => shown.push(f),
      (e) => {
        throw e;
      },
    );
  display.update(identity(5));
  await tick();
  assert.deepEqual(shown, []);
});

test('gesture finish presents the last confirmed successor before closing, while explicit stop still revokes it', async () => {
  for (const cancel of [false, true]) {
    const resolves = [],
      shown = [],
      display = new TerrainPresentation(
        () => new Promise((r) => resolves.push(r)),
        (f) => shown.push(f.target.revision),
        (e) => {
          throw e;
        },
      );
    display.update(identity(1));
    display.update(identity(2));
    let done = false;
    const finished = display.finish().then(() => (done = true));
    assert.equal(done, false);
    resolves.shift()(frame(1));
    await tick();
    assert.deepEqual(shown, [1]);
    assert.equal(done, false);
    if (cancel) display.stop();
    resolves.shift()(frame(2));
    await finished;
    assert.deepEqual(shown, cancel ? [1] : [1, 2]);
    display.update(identity(3));
    assert.equal(resolves.length, 0);
  }
});

test('snapshot delivery tolerates later commits and receipt-only writes but rejects unversioned or foreign changes', () => {
  const source = {
    filename: 'db',
    token: 't',
    campaignId: 'c',
    epoch: 'e',
    sequence: 3,
    revision: 7,
    fence: 'a',
  };
  assert(terrainSnapshotStillValid(source, { ...source, fence: 'receipt' }));
  assert(terrainSnapshotStillValid(source, { ...source, revision: 8, sequence: 4, fence: 'b' }));
  for (const changed of [
    { revision: 6 },
    { sequence: 4 },
    { epoch: 'other' },
    { token: 'other' },
    { filename: 'other' },
    { campaignId: 'other' },
    { shadow: { epoch: 'preview' } },
  ])
    assert.equal(terrainSnapshotStillValid(source, { ...source, ...changed }), false);
});

test('interactive colour preserves full geometry, view, objects and the original detail request', () => {
  const original = {
    kind: 'tilted',
    query: {
      width: 128,
      height: 96,
      detailResolution: 256,
      detail: { x: 0, y: 0, width: 10, height: 10 },
      view: { columns: 257, rows: 257 },
      objects: { roads: [] },
    },
  };
  const snapshot = structuredClone(original),
    fast = interactiveTerrainFrame(original);
  assert.equal(fast.query.width, 64);
  assert.equal(fast.query.height, 64);
  assert.equal(fast.query.detailResolution, 64);
  assert.equal(fast.query.view, original.query.view);
  assert.equal(fast.query.objects, original.query.objects);
  assert.deepEqual(original, snapshot);
  assert.equal(interactiveTerrainFrame({ kind: 'top', query: {} }).kind, 'top');
});
test('progressive display publishes coherent fast then fine frames while the gesture remains open', async () => {
  const requests = [],
    pending = [],
    shown = [];
  const display = new TerrainPresentation(
    (source, base, refinement) => {
      requests.push({ source, base, refinement });
      return new Promise((resolve) => pending.push(resolve));
    },
    (f, fine) => shown.push([f.target.revision, fine]),
    (e) => {
      throw e;
    },
    true,
  );
  display.update(identity(1));
  pending.shift()(frame(1));
  await tick();
  assert.deepEqual(shown, [[1, false]]);
  assert.equal(requests[1].refinement, true);
  assert.equal(requests[1].base, undefined);
  pending.shift()(frame(1));
  await tick();
  assert.deepEqual(shown, [
    [1, false],
    [1, true],
  ]);
  await display.finish();
});
test('finish waits for final full heights but neither starts nor waits for disposable fine colour', async () => {
  for (const fineStarted of [false, true])
    for (const lateFailure of [false, true]) {
      const requests = [],
        pending = [],
        shown = [],
        errors = [];
      const display = new TerrainPresentation(
        (source, base, fine) => {
          requests.push([source.revision, !!fine]);
          return new Promise((resolve, reject) => pending.push({ resolve, reject }));
        },
        (f, fine) => shown.push([f.target.revision, fine]),
        (e) => errors.push(String(e)),
        true,
      );
      display.update(identity(1));
      if (fineStarted) {
        pending.shift().resolve(frame(1));
        await tick();
        assert.equal(requests.length, 2);
      }
      let done = false;
      const finished = display.finish().then(() => (done = true));
      if (!fineStarted) {
        await tick();
        assert.equal(done, false);
        pending.shift().resolve(frame(1));
      }
      await finished;
      assert(done);
      assert.deepEqual(shown, [[1, false]]);
      assert.deepEqual(
        requests,
        fineStarted
          ? [
              [1, false],
              [1, true],
            ]
          : [[1, false]],
      );
      if (fineStarted) {
        const late = pending.shift();
        lateFailure ? late.reject(Error('late worker error')) : late.resolve(frame(1));
        await tick();
      }
      assert.deepEqual(errors, []);
      assert.deepEqual(shown, [[1, false]]);
    }
});
test('a final confirmed frame overtakes unresolved older refinement and late fine output cannot overwrite it', async () => {
  const requests = [],
    pending = [],
    shown = [],
    errors = [];
  const display = new TerrainPresentation(
    (source, base, fine) => {
      requests.push([source.revision, !!fine]);
      return new Promise((resolve, reject) => pending.push({ resolve, reject }));
    },
    (f, fine) => shown.push([f.target.revision, fine]),
    (e) => errors.push(String(e)),
    true,
  );
  display.update(identity(1));
  pending.shift().resolve(frame(1));
  await tick();
  const oldFine = pending.shift();
  display.update(identity(2));
  assert.deepEqual(
    requests,
    [
      [1, false],
      [1, true],
      [2, false],
    ],
    'fresh full heights must start without awaiting old fine colour',
  );
  const finished = display.finish();
  pending.shift().resolve(frame(2));
  await finished;
  assert.deepEqual(shown, [
    [1, false],
    [2, false],
  ]);
  oldFine.resolve(frame(1));
  await tick();
  assert.deepEqual(shown, [
    [1, false],
    [2, false],
  ]);
  assert.deepEqual(errors, []);
});
test('a newer confirmed revision supersedes fine output, while refinement failures do not swallow worker errors', async () => {
  const requests = [],
    pending = [],
    shown = [],
    errors = [];
  const display = new TerrainPresentation(
    (source, base, fine) => {
      requests.push([source.revision, !!fine]);
      return new Promise((resolve, reject) => pending.push({ resolve, reject }));
    },
    (f, fine) => shown.push([f.target.revision, fine]),
    (e) => errors.push(String(e)),
    true,
  );
  display.update(identity(1));
  pending.shift().resolve(frame(1));
  await tick();
  display.update(identity(2));
  pending.shift().resolve(frame(1));
  await tick();
  assert.deepEqual(shown, [[1, false]], 'old detail cannot overwrite newer pending input');
  pending.shift().resolve(frame(2));
  await tick();
  pending.shift().reject(Error('Geländeberechnung durch neuere Anfrage ersetzt.'));
  await tick();
  assert.deepEqual(errors, []);
  display.update(identity(3));
  pending.shift().resolve(frame(3));
  await tick();
  pending.shift().reject(Error('worker exited'));
  await tick();
  assert.match(errors[0], /worker exited/);
  assert.deepEqual(requests, [
    [1, false],
    [1, true],
    [2, false],
    [2, true],
    [3, false],
    [3, true],
  ]);
  display.stop();
});
test('an outdated fast reply does not refine a previously shown source', async () => {
  const requests = [],
    shown = [];
  const display = new TerrainPresentation(
    async (source, base, fine) => {
      requests.push([source.revision, !!fine]);
      return frame(1);
    },
    (f, fine) => shown.push([f.target.revision, fine]),
    (e) => {
      throw e;
    },
    true,
  );
  display.update(identity(1));
  await tick();
  display.update(identity(2));
  await tick();
  assert.deepEqual(requests, [
    [1, false],
    [1, true],
    [2, false],
  ]);
  assert.deepEqual(shown, [
    [1, false],
    [1, true],
  ]);
  display.stop();
});

test('a newer fast delta keeps its requested base when fine colour completes during a receipt-only reread', async () => {
  const pending = [],
    shown = [],
    errors = [],
    requests = [];
  const display = new TerrainPresentation(
    (source, base, fine) => {
      requests.push({ source, base, fine });
      return new Promise((resolve) => pending.push(resolve));
    },
    (f, fine) => shown.push([f.target.revision, f.target.key, fine]),
    (e) => errors.push(e.message),
    true,
  );
  const coarse = { ...frame(1), target: { ...identity(1), key: 'fast' }, layer: { tiles: [] } },
    fine = { ...coarse, target: { ...identity(1), key: 'fine' } };
  display.update(identity(1));
  pending.shift()(coarse);
  await tick();
  const finishFine = pending.shift();
  display.update(identity(1));
  assert.deepEqual(requests.at(-1).base, coarse.target);
  finishFine(fine);
  await tick();
  assert.deepEqual(shown.at(-1), [1, 'fine', true]);
  // Main is allowed to return a later committed source. Its delta still names
  // the fast base from the request, although the screen now shows fine colour.
  pending.shift()({
    kind: 'delta',
    view: 'top',
    base: coarse.target,
    target: { ...identity(2), key: 'fast' },
    invalidation: { reset: false, bounds: [] },
    layer: {},
    tiles: [],
    removed: [],
  });
  await tick();
  assert.deepEqual(errors, []);
  assert.deepEqual(shown.at(-1), [2, 'fast', false]);
  display.stop();
  pending.shift()?.({ ...fine, target: { ...identity(2), key: 'fine' } });
  await tick();
});
