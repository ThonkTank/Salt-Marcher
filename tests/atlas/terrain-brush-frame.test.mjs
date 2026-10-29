import { landscapeFixture } from '../helpers/atlas-workbench.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSync } from 'esbuild';
import { createRequire } from 'node:module';
buildSync({
  entryPoints: ['src/app/atlas/atlas-landscape-ui.ts'],
  outfile: '.build/terrain-brush-frame-test.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
});
const { LandscapeWorkbench } = createRequire(import.meta.url)(
  '../../.build/terrain-brush-frame-test.cjs',
);
const settle = () => new Promise(setImmediate);
function fixture(t, { color = false } = {}) {
  const old = {
    requestAnimationFrame: global.requestAnimationFrame,
    cancelAnimationFrame: global.cancelAnimationFrame,
    performance: global.performance,
  };
  const frames = new Map(),
    writes = [],
    gates = [],
    previews = [],
    errors = [];
  let now = 0,
    serial = 0;
  global.requestAnimationFrame = (fn) => {
    frames.set(++serial, fn);
    return serial;
  };
  global.cancelAnimationFrame = (id) => frames.delete(id);
  global.performance = { now: () => now };
  t.after(() => Object.assign(global, old));
  const ui = Object.assign(landscapeFixture(LandscapeWorkbench), {
    pointer: 1,
    maskStart: 0,
    lastPoint: { x: 0, y: 0 },
    points: [{ x: 0, y: 0 }],
    maskStroke: color
      ? null
      : { mode: 'raise', radius: 100, strength: 10, feather: 0, samples: [{ x: 0, y: 0, t: 0 }] },
    host: {
      data: () => ({ revision: 1, region: { fence: 'base' } }),
      terrainGesture() {},
      previewHeight: (stroke) => previews.push(structuredClone(stroke)),
      writeTerrain: (action, context) => {
        writes.push({ action: structuredClone(action), context });
        return new Promise((resolve, reject) => gates.push({ resolve, reject }));
      },
      error: (error) => errors.push(error),
      redraw() {},
    },
    disable() {},
    say() {},
    colorRecord() {
      return { id: 'color', points: structuredClone(this.points) };
    },
  });
  const advance = (time) => {
    now = time;
    const ready = [...frames.values()];
    frames.clear();
    for (const fn of ready) fn(time);
  };
  const ack = async () => {
    assert(gates.length, 'write awaiting ACK');
    gates.shift().resolve({ revision: writes.length + 1, sourceFence: 'f' + writes.length });
    await settle();
  };
  return {
    ui,
    frames,
    writes,
    previews,
    errors,
    advance,
    ack,
    async reject(error) {
      gates.shift().reject(error);
      await settle();
    },
    setTime: (time) => (now = time),
  };
}
test('stationary preview draws once per frame while storage is blocked; ACK joins the next preview', async (t) => {
  const f = fixture(t);
  f.ui.startLive();
  f.advance(16);
  assert.equal(f.previews.length, 1, 'the first elapsed frame must not draw twice');
  assert.equal(f.writes.length, 1);
  f.advance(32);
  f.advance(48);
  assert.equal(f.previews.length, 3);
  assert.equal(f.writes.length, 1, 'blocked storage does not queue stationary writes each frame');
  await f.ack();
  f.advance(64);
  assert.equal(f.previews.length, 4, 'capacity return shares the scheduled preview frame');
  assert.equal(f.writes.length, 2);
  assert.equal(
    f.writes[1].action.stroke.samples.at(-1).t,
    48,
    'canonical continuation includes all elapsed stationary input exactly once',
  );
  f.ui.endLiveInput();
  await f.ack();
  await f.ui.live.finish();
  assert.equal(f.frames.size, 0);
});
test('coalesced movement and release preserve the final point and elapsed dose without a late preview', async (t) => {
  const f = fixture(t);
  f.ui.startLive();
  f.advance(16);
  f.ui.lastPoint = { x: 10, y: 0 };
  f.ui.maskStroke.samples.push({ x: 10, y: 0, t: 20 });
  f.ui.scheduleLive();
  f.ui.scheduleLive();
  f.advance(32);
  assert.equal(f.previews.length, 2);
  assert.equal(f.writes.length, 1);
  f.ui.lastPoint = { x: 20, y: 0 };
  f.setTime(40);
  f.ui.endLiveInput();
  f.ui.sampleLive();
  assert.equal(f.previews.at(-1).samples.at(-1).t, 40);
  assert.equal(f.previews.at(-1).samples.at(-1).x, 20);
  assert.equal(f.frames.size, 0);
  await f.ack();
  assert.equal(f.writes.length, 2);
  assert.equal(f.writes[1].action.stroke.samples.at(-1).x, 20);
  assert.equal(
    f.writes.reduce((sum, w) => sum + w.action.stroke.samples.at(-1).t, 0),
    40,
  );
  await f.ack();
  await f.ui.live.finish();
  const count = f.previews.length;
  f.advance(64);
  assert.equal(f.previews.length, count);
});
test('release before the first frame flushes the actual elapsed stroke', async (t) => {
  const f = fixture(t);
  f.ui.startLive();
  f.setTime(5);
  f.ui.endLiveInput();
  f.ui.sampleLive();
  assert.equal(f.previews.length, 1);
  assert.equal(f.writes.length, 1);
  assert.equal(f.writes[0].action.stroke.samples.at(-1).t, 5);
  assert.equal(f.frames.size, 0);
  await f.ack();
  await f.ui.live.finish();
  f.advance(16);
  assert.equal(f.previews.length, 1);
});
test('colour brush remains event driven and commits its final cumulative points', async (t) => {
  const f = fixture(t, { color: true });
  f.ui.startLive();
  f.advance(16);
  assert.equal(f.previews.length, 0);
  assert.equal(f.writes.length, 1);
  assert.equal(f.frames.size, 0);
  await f.ack();
  f.advance(32);
  assert.equal(f.writes.length, 1);
  assert.equal(f.frames.size, 0);
  f.ui.points.push({ x: 10, y: 20 });
  f.ui.scheduleLive();
  f.ui.scheduleLive();
  f.advance(48);
  assert.equal(f.writes.length, 2);
  assert.equal(f.writes[1].action.record.points.length, 2);
  f.ui.endLiveInput();
  await f.ack();
  await f.ui.live.finish();
  assert.equal(f.frames.size, 0);
});
test('a failed write cancels future height frames without retrying an uncertain operation', async (t) => {
  const f = fixture(t);
  f.ui.startLive();
  f.advance(16);
  f.advance(32);
  const failure = Error('answer lost');
  await f.reject(failure);
  assert.deepEqual(f.errors, [failure]);
  assert.equal(f.ui.live, null);
  assert.equal(f.frames.size, 0);
  const shown = f.previews.length;
  f.advance(64);
  assert.equal(f.previews.length, shown);
  assert.equal(f.writes.length, 1);
});

test('synchronous preview failure stops RAF and pointer capture without committing the failing snapshot', async (t) => {
  const f = fixture(t),
    failure = Error('preview work guard');
  let captured = true;
  f.ui.canvas = {
    hasPointerCapture: () => captured,
    releasePointerCapture: () => {
      captured = false;
    },
  };
  f.ui.host.previewHeight = () => {
    throw failure;
  };
  f.ui.startLive();
  assert.doesNotThrow(() => f.advance(16));
  await settle();
  assert.equal(f.ui.pointer, null);
  assert.equal(captured, false);
  assert.equal(f.ui.live, null);
  assert.equal(f.frames.size, 0);
  assert.equal(f.writes.length, 0);
  assert.deepEqual(f.errors, [failure]);
  f.advance(32);
  assert.equal(f.writes.length, 0);
  // Fresh ownership remains available after the aborted gesture.
  f.ui.host.previewHeight = () => {};
  f.ui.pointer = 2;
  f.ui.maskStroke = {
    mode: 'raise',
    radius: 100,
    strength: 10,
    feather: 0,
    samples: [{ x: 0, y: 0, t: 0 }],
  };
  f.ui.startLive();
  f.advance(48);
  assert.equal(f.writes.length, 1);
  f.ui.endLiveInput();
  await f.ack();
  await f.ui.live.finish();
});

test('preview failure while a write is pending does not retry or undo its outcome', async (t) => {
  const f = fixture(t),
    failure = Error('later preview failure');
  f.ui.startLive();
  f.advance(16);
  f.ui.host.previewHeight = () => {
    throw failure;
  };
  assert.doesNotThrow(() => f.advance(32));
  assert.equal(f.ui.pointer, null);
  assert.equal(f.frames.size, 0);
  assert.equal(f.writes.length, 1);
  await f.ack();
  await settle();
  assert.equal(f.ui.live, null);
  assert.equal(f.writes.length, 1);
  assert.deepEqual(f.errors, [failure]);
});

test('local draft preview failure cancels only the active draft and leaves a fresh gesture usable', async (t) => {
  const f = fixture(t),
    failure = Error('local preview failed');
  let cancels = 0,
    queued = 0,
    disabled = false;
  f.ui.host.localTerrain = () => ({
    cancel: () => cancels++,
    enqueue: async () => {
      queued++;
    },
    previewColor() {},
  });
  f.ui.disable = (value) => {
    disabled = value;
  };
  f.ui.host.previewHeight = () => {
    throw failure;
  };
  f.ui.startLive();
  f.advance(16);
  await settle();
  assert.equal(cancels, 1);
  assert.equal(queued, 0);
  assert.equal(f.ui.live, null);
  assert.equal(f.ui.pointer, null);
  assert.equal(f.frames.size, 0);
  assert.equal(disabled, false);
  assert.deepEqual(f.errors, [failure]);
  f.ui.host.previewHeight = () => {};
  f.ui.pointer = 2;
  f.ui.maskStroke = {
    mode: 'raise',
    radius: 100,
    strength: 10,
    feather: 0,
    samples: [{ x: 0, y: 0, t: 0 }],
  };
  f.ui.startLive();
  f.advance(32);
  await f.ui.finishLive();
  assert.equal(queued, 1);
  assert.equal(cancels, 1);
});

test('versioned screen input cannot fall into incremental world-sample writes without a local terrain queue', async (t) => {
  const f = fixture(t);
  f.ui.maskStroke.screenInput = { version: 1, events: [{ u: 0.4, v: 0.5, t: 0 }] };
  f.ui.startLive();
  f.advance(16);
  f.advance(32);
  assert.equal(f.writes.length, 0, 'screen gesture remains atomic while held');
  f.ui.brush.receiveHeightInput({ x: 1, y: 0 }, 40, { u: 0.6, v: 0.5 });
  f.setTime(40);
  f.ui.endLiveInput();
  f.ui.sampleLive();
  const done = f.ui.live.finish();
  assert.equal(f.writes.length, 1);
  const sent = f.writes[0].action.stroke;
  assert.equal(sent.screenInput.version, 1);
  assert.equal(sent.screenInput.events[0].t, 0);
  assert.equal(sent.screenInput.events.at(-1).t, 40);
  assert.equal(sent.samples[0].t, 0);
  assert.equal(sent.samples.at(-1).t, 40);
  await f.ack();
  await done;
  assert.equal(f.writes.length, 1);
});
