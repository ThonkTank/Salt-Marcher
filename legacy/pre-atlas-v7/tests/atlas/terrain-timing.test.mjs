import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSync } from 'esbuild';
import { createRequire } from 'node:module';
buildSync({
  entryPoints: ['src/app/atlas/terrain-timing.ts'],
  outfile: '.build/terrain-timing-test.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
});
const { terrainTraceMeasure, terrainTraceStart, takeTerrainTrace } = createRequire(import.meta.url)(
  '../../.build/terrain-timing-test.cjs',
);
test('disabled timing retains nothing; enabled timing is bounded and cannot swallow author failures', () => {
  delete globalThis.__saltTerrainTrace;
  assert.equal(
    terrainTraceMeasure('disabled', () => 17),
    17,
  );
  assert.equal(takeTerrainTrace(), undefined);
  globalThis.__saltTerrainTrace = { events: [], dropped: 0 };
  const failure = Error('author failed');
  assert.throws(
    () =>
      terrainTraceMeasure(
        'author',
        () => {
          throw failure;
        },
        4,
      ),
    (e) => e === failure,
  );
  const end = terrainTraceStart('once');
  end();
  end();
  for (let i = 0; i < 5000; i++) terrainTraceMeasure('bounded', () => i);
  const trace = takeTerrainTrace();
  assert.equal(trace.events.length, 4096);
  assert.equal(trace.dropped, 906);
  assert.equal(trace.events[0].revision, 4);
  assert.equal(trace.events[0].stage, 'author');
  assert(trace.events.every((e) => e.duration >= 0));
  assert.deepEqual(takeTerrainTrace(), { events: [], dropped: 0 });
  delete globalThis.__saltTerrainTrace;
});
