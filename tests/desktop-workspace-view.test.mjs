import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSync } from 'esbuild';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
buildSync({
  entryPoints: ['src/app/workspace-view.ts'],
  outfile: '.build/workspace-view.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
});
const {
  WorkspacePositions,
  workspaceTabs,
  readWorkspaceView,
  rememberWorkspaceView,
} = require('../.build/workspace-view.cjs');
const memory = () => {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
};
test('navigation survives a new reader and stays separate for each campaign', () => {
  const storage = memory();
  rememberWorkspaceView(storage, 'A', { tab: 'live', scrollY: 643 });
  rememberWorkspaceView(storage, 'B', { tab: 'preparation', scrollY: 91 });
  assert.deepEqual(readWorkspaceView(storage, 'A'), { tab: 'live', scrollY: 643 });
  assert.deepEqual(readWorkspaceView(storage, 'B'), { tab: 'preparation', scrollY: 91 });
  assert.deepEqual(readWorkspaceView(storage, 'C'), { tab: 'atlas', scrollY: 0 });
  for (const tab of workspaceTabs) {
    rememberWorkspaceView(storage, 'B', { tab, scrollY: 0 });
    assert.equal(readWorkspaceView(storage, 'B').tab, tab);
  }
});
for (const value of [
  'bad',
  'null',
  '{}',
  '{"tab":"deleted","scrollY":12}',
  '{"tab":"live","scrollY":-1}',
  '{"tab":"live","scrollY":1e99}',
])
  test('unusable local preference falls back without blocking: ' + value, () => {
    assert.deepEqual(readWorkspaceView({ getItem: () => value }, 'A'), {
      tab: 'atlas',
      scrollY: 0,
    });
  });
test('unavailable preferences never prevent campaign content operations', () => {
  const storage = {
    getItem() {
      throw Error('denied');
    },
    setItem() {
      throw Error('quota');
    },
  };
  assert.deepEqual(readWorkspaceView(storage, 'A'), { tab: 'atlas', scrollY: 0 });
  assert.doesNotThrow(() => rememberWorkspaceView(storage, 'A', { tab: 'live', scrollY: 0 }));
});

test('each area returns to its own position and first visits start at the top', () => {
  const p = new WorkspacePositions();
  assert.equal(p.select('A', 'live', 420), 420);
  p.capture('A', 650);
  assert.equal(p.select('A', 'preparation'), 0);
  p.capture('A', 93);
  assert.equal(p.select('A', 'live'), 650);
  p.capture('A', 651);
  assert.equal(p.select('A', 'preparation'), 93);
});
test('activation cannot capture the old projection as a new campaign position', () => {
  const p = new WorkspacePositions();
  p.select('A', 'live', 440);
  p.capture('B', 999);
  assert.equal(p.select('B', 'live'), 0);
  p.capture('B', 17);
  assert.equal(p.select('A', 'live'), 440);
  assert.equal(p.select('B', 'live'), 17);
});
test('fresh local view overrides stale window position while a separate window starts independent', () => {
  const p = new WorkspacePositions();
  p.select('A', 'live', 400);
  p.capture('A', 800);
  assert.equal(p.select('A', 'live', 220), 220);
  assert.equal(new WorkspacePositions().select('A', 'live'), 0);
});

test('fresh live writing remembers its visible position separately from the old document layout', () => {
  const storage = memory();
  rememberWorkspaceView(storage, 'A', { tab: 'live', scrollY: 1310, liveNotesTop: 562 });
  rememberWorkspaceView(storage, 'B', { tab: 'live', scrollY: 720, liveNotesTop: 360 });
  assert.deepEqual(readWorkspaceView(storage, 'A'), {
    tab: 'live',
    scrollY: 1310,
    liveNotesTop: 562,
  });
  assert.equal(readWorkspaceView(storage, 'B').liveNotesTop, 360);
});
test('old, non-live and malformed writing positions preserve safe numeric navigation', () => {
  for (const liveNotesTop of [null, '562', -10001, 10001])
    assert.deepEqual(
      readWorkspaceView(
        { getItem: () => JSON.stringify({ tab: 'live', scrollY: 500, liveNotesTop }) },
        'A',
      ),
      { tab: 'live', scrollY: 500 },
    );
  assert.deepEqual(
    readWorkspaceView(
      { getItem: () => JSON.stringify({ tab: 'preparation', scrollY: 500, liveNotesTop: 200 }) },
      'A',
    ),
    { tab: 'preparation', scrollY: 500 },
  );
});

test('a combat restart keeps its semantic destination even when the previous inspector changed page height', () => {
  const storage = memory();
  rememberWorkspaceView(storage, 'A', { tab: 'live', scrollY: 5700, liveCombat: true });
  assert.deepEqual(readWorkspaceView(storage, 'A'), {
    tab: 'live',
    scrollY: 5700,
    liveCombat: true,
  });
  rememberWorkspaceView(storage, 'B', { tab: 'world', scrollY: 12, liveCombat: true });
  assert.deepEqual(readWorkspaceView(storage, 'B'), { tab: 'world', scrollY: 12 });
  assert.deepEqual(
    readWorkspaceView({ getItem: () => '{"tab":"live","scrollY":500,"liveCombat":"true"}' }, 'A'),
    { tab: 'live', scrollY: 500 },
  );
});
