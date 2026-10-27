import test from 'node:test';
import assert from 'node:assert/strict';
import { DevelopmentQueue } from '../../tools/development-queue.mjs';
const deferred = () => {
  let resolve;
  return {
    promise: new Promise((r) => {
      resolve = r;
    }),
    resolve: () => resolve(),
  };
};

test('save bursts coalesce, superseded generations retain their changed dependencies, builds never overlap', async () => {
  const entered = deferred(),
    release = deferred(),
    calls = [];
  let running = 0,
    max = 0;
  const queue = new DevelopmentQueue(
    async (files, isCurrent) => {
      running++;
      max = Math.max(max, running);
      calls.push(files);
      if (calls.length === 1) {
        entered.resolve();
        await release.promise;
      }
      running--;
      return isCurrent();
    },
    { delay: 10000 },
  );
  queue.add('shared.ts');
  queue.add('shared.ts');
  const drain = queue.drain();
  await entered.promise;
  queue.add('new-import.ts');
  queue.add('renderer.ts');
  release.resolve();
  await drain;
  assert.equal(max, 1);
  assert.deepEqual(calls, [['shared.ts'], ['new-import.ts', 'renderer.ts', 'shared.ts']]);
  await queue.stop();
});

test('a failed build reports once and a later edit can recover without restarting the watcher', async () => {
  const errors = [],
    calls = [];
  const queue = new DevelopmentQueue(
    async (files) => {
      calls.push(files);
      if (calls.length === 1) throw Error('invalid syntax');
      return true;
    },
    { delay: 10000, onError: (error) => errors.push(error.message) },
  );
  queue.add('broken.ts');
  await queue.drain();
  queue.add('fixed.ts');
  await queue.drain();
  assert.deepEqual(errors, ['invalid syntax']);
  assert.deepEqual(calls, [['broken.ts'], ['fixed.ts']]);
  await queue.stop();
});

test('stop waits for the active operation and prevents queued/repeated work', async () => {
  const entered = deferred(),
    release = deferred();
  let calls = 0,
    stopped = false;
  const queue = new DevelopmentQueue(
    async () => {
      calls++;
      entered.resolve();
      await release.promise;
      return false;
    },
    { delay: 10000 },
  );
  queue.add('one');
  const drain = queue.drain();
  await entered.promise;
  queue.add('two');
  const stop = queue.stop().then(() => {
    stopped = true;
  });
  await Promise.resolve();
  assert.equal(stopped, false);
  release.resolve();
  await stop;
  await drain;
  queue.add('three');
  await queue.drain();
  assert.equal(calls, 1);
});
