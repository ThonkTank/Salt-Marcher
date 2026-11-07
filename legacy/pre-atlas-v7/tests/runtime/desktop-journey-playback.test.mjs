import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSync } from 'esbuild';
import { createRequire } from 'node:module';
buildSync({
  entryPoints: ['src/app/runtime/journey-playback.ts'],
  outfile: '.build/journey-playback.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
});
const { journeyPlayback } = createRequire(import.meta.url)('../../.build/journey-playback.cjs');
test('playback preserves elapsed fraction across speed changes and serializes confirmed checkpoints', async () => {
  let now = 0,
    scheduled = null,
    delay = null,
    release,
    steps = 0,
    view = { key: 'scene:map:journey', revision: 1, nextIndex: 1, seconds: 3600 };
  const player = journeyPlayback({
    read: () => view,
    now: () => now,
    later: (fn, ms) => {
      scheduled = () => {
        scheduled = null;
        fn();
      };
      delay = ms;
      return 1;
    },
    cancel: () => {
      scheduled = null;
    },
    changed: () => {},
    step: async () => {
      steps++;
      await new Promise((r) => (release = r));
      view = { ...view, revision: view.revision + 1, nextIndex: view.nextIndex + 1 };
      return true;
    },
  });
  player.play();
  assert.equal(delay, 1000);
  now = 500;
  player.setSpeed(2);
  assert.equal(delay, 250);
  now = 750;
  scheduled();
  await Promise.resolve();
  assert.equal(steps, 1);
  assert.equal(player.busy, true);
  assert.equal(player.play(), false);
  assert.equal(scheduled, null);
  player.stop();
  release();
  await player.settled();
  assert.equal(scheduled, null);
  assert.equal(view.nextIndex, 2);
  assert.equal(steps, 1);
  player.play();
  now = 10000;
  scheduled();
  await Promise.resolve();
  assert.equal(steps, 2);
  release();
  await player.settled();
  assert.equal(view.nextIndex, 3);
  assert.equal(delay, 500, 'no catch-up batch after a delayed browser timer');
  view = { ...view, key: 'another scene' };
  player.sync();
  assert.equal(player.running, false);
  assert.equal(scheduled, null);
});
