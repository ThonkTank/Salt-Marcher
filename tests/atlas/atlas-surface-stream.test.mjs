import { emptyMaterialChannels } from '../helpers/atlas-material-channels.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSync } from 'esbuild';
buildSync({
  entryPoints: ['src/app/atlas/atlas-surface-tile-stream.ts'],
  outfile: '.build/atlas-surface-stream-test.mjs',
  bundle: true,
  platform: 'node',
  format: 'esm',
});
const { AtlasSurfaceTileStream, atlasSurfaceTileFetcher } = await import(
  '../../.build/atlas-surface-stream-test.mjs'
);
const input = {
  box: { x: 0, y: 0, width: 256, height: 256 },
  metersPerPixel: 1,
  revision: 2,
  source: 'fence',
};
function pair(q) {
  const identity = { tile: q.tile, revision: q.revision, fence: 'fence' };
  return {
    ...identity,
    terrain: {
      ...identity,
      projection: {
        heightOnly: true,
        fence: 'fence',
        revision: q.revision,
        grid: { view: { columns: 65, rows: 65 }, heights: new Float32Array(65 * 65) },
      },
    },
    material: { ...identity, width: 256, height: 256, channels: emptyMaterialChannels(256 * 256) },
  };
}
test('prefetch follows visible completion and retained products stay within both budgets while panning', async () => {
  const stream = new AtlasSurfaceTileStream({
    maxTiles: 8,
    maxRetainedTiles: 16,
    maxBytes: 16 * 1024 * 1024,
  });
  for (let pan = 0; pan < 12; pan++) {
    const box = { x: pan * 256, y: 0, width: 512, height: 256 },
      calls = [];
    let completeAt = -1;
    await stream.load(
      { ...input, box, preload: { x: box.x - 4096, y: -4096, width: 8192, height: 8192 } },
      async (q) => {
        calls.push(q.tile);
        return pair(q);
      },
      (frame) => {
        if (frame.complete) {
          completeAt = calls.length;
          assert(frame.tiles.every((t) => t.tile.lod === 0));
        }
      },
    );
    assert(completeAt >= 0);
    assert(calls.slice(completeAt).every((t) => t.lod >= 2));
    assert(stream.statistics.tiles <= 16);
    assert(stream.statistics.bytes <= 16 * 1024 * 1024);
  }
  stream.dispose();
  assert.equal(stream.statistics.bytes, 0);
});
test('a surface publishes and caches height/material together, rejecting mixed sources', async () => {
  for (const corrupt of [
    (p) => p.terrain.revision++,
    (p) => (p.material.tile = { ...p.tile, x: 8 }),
    (p) => (p.material.fence = 'other'),
    (p) => (p.terrain.projection.heightOnly = false),
  ]) {
    const stream = new AtlasSurfaceTileStream(),
      frames = [];
    await assert.rejects(
      stream.load(
        input,
        async (q) => {
          const p = pair(q);
          corrupt(p);
          return p;
        },
        (f) => frames.push(f),
      ),
      /vollständige Kacheln/,
    );
    assert(frames.every((f) => f.tiles.length === 0));
    stream.dispose();
  }
  const stream = new AtlasSurfaceTileStream(),
    frames = [];
  let calls = 0;
  await stream.load(
    input,
    async (q) => {
      calls++;
      assert.equal(q.product, 'height');
      return pair(q);
    },
    (f) => frames.push(f),
  );
  assert.equal(calls, 2);
  assert.equal(frames.at(-1).complete, true);
  assert.equal(frames.at(-1).tiles[0].tile.lod, 0);
  await stream.load(
    input,
    async () => {
      throw Error('warm read');
    },
    () => {},
  );
  stream.dispose();
});
test('preload adapter cancels only its current read and never starts material after an aborted height', async () => {
  let release;
  const height = new Promise((r) => (release = r)),
    calls = [];
  const api = {
    atlasTerrainTile: async (token, q, control) => {
      calls.push(['height', token, q, control]);
      return height;
    },
    atlasMaterialTile: async () => {
      throw Error('Material must not start');
    },
    atlasCancelRead: async (token, control) => {
      calls.push(['cancel', token, control]);
      return { ok: true };
    },
  };
  const fetch = atlasSurfaceTileFetcher(api, 'campaign-token', 'surface-owner'),
    controller = new AbortController();
  const job = fetch({ tile: { lod: 0, x: 0, y: 0 }, revision: 2 }, controller.signal);
  controller.abort();
  release({ ok: true, value: {} });
  await assert.rejects(job, { name: 'AbortError' });
  assert.equal(calls.length, 2);
  assert.deepEqual(calls[1], ['cancel', 'campaign-token', calls[0][3]]);
  assert.equal(calls[0][2].product, 'height');
});
test('20 superseded paired loads launch only the blocked old request and final source', async () => {
  let release;
  const gate = new Promise((r) => (release = r)),
    stream = new AtlasSurfaceTileStream(),
    calls = [],
    frames = [];
  const fetch = async (q, signal) => {
    calls.push({ q, signal });
    if (calls.length === 1) await gate;
    return pair(q);
  };
  const first = stream.load(input, fetch, () => {});
  await new Promise((r) => setImmediate(r));
  const jobs = Array.from({ length: 20 }, (_, n) =>
    stream.load({ ...input, box: { ...input.box, x: (n + 1) * 256 } }, fetch, (f) =>
      frames.push(f),
    ),
  );
  assert.equal(calls.length, 1);
  assert.equal(calls[0].signal.aborted, true);
  release();
  await Promise.all([first, ...jobs]);
  assert.equal(calls.length, 3);
  assert.equal(frames.at(-1).complete, true);
  assert.equal(frames.at(-1).tiles[0].tile.x, 20);
  stream.dispose();
});

test('recreated fetch adapters never reuse a job identity addressed by an old cancellation', async () => {
  const controls = [];
  const api = {
    atlasTerrainTile: async (_token, _q, c) => {
      controls.push(c);
      return { ok: false, error: 'stopped' };
    },
    atlasMaterialTile: async () => {
      throw Error('not reached');
    },
    atlasCancelRead: async () => ({ ok: true }),
  };
  for (let i = 0; i < 2; i++)
    await assert.rejects(
      atlasSurfaceTileFetcher(
        api,
        'same-token',
        'same-owner',
      )({ tile: { lod: 0, x: 0, y: 0 }, revision: 0 }, new AbortController().signal),
      /stopped/,
    );
  assert.notEqual(controls[0].id, controls[1].id);
  assert.equal(controls[0].owner, controls[1].owner);
});

test('partial cold parents are visible but only complete coarse coverage is usable', async () => {
  const stream = new AtlasSurfaceTileStream(),
    frames = [];
  await stream.load(
    { ...input, box: { x: -128, y: -128, width: 256, height: 256 } },
    async (q) => pair(q),
    (f) => frames.push(f),
  );
  const partial = frames.find((f) => f.tiles.length > 0 && !f.overviewComplete);
  assert(partial);
  const firstUsable = frames.find((f) => f.overviewComplete);
  assert(firstUsable);
  assert.equal(firstUsable.complete, false);
  assert.equal(firstUsable.tiles.length, 4);
  assert(firstUsable.tiles.every((p) => p.tile.lod === firstUsable.tiles[0].tile.lod));
  assert(firstUsable.tiles[0].tile.lod > frames.at(-1).tiles[0].tile.lod);
  assert(frames.at(-1).complete && frames.at(-1).overviewComplete);
  stream.dispose();
});

test('optional prefetch failure preserves the fully published viewport without another read', async () => {
  const stream = new AtlasSurfaceTileStream({
      maxTiles: 32,
      maxRetainedTiles: 64,
      maxBytes: 64 * 1024 * 1024,
    }),
    frames = [];
  let complete = false,
    optionalReads = 0;
  await stream.load(
    { ...input, preload: { x: -1024, y: -1024, width: 4096, height: 4096 } },
    async (q) => {
      if (complete) {
        optionalReads++;
        throw Error('Main is closing');
      }
      return pair(q);
    },
    (frame) => {
      frames.push(frame);
      complete ||= frame.complete;
    },
  );
  assert.equal(optionalReads, 1);
  assert(frames.at(-1).complete);
  assert(frames.at(-1).tiles.length > 0);
  stream.dispose();
});

test('world-to-room navigation carries paired display data without author snapshots through slow refinement', async () => {
  const stream = new AtlasSurfaceTileStream({
    maxTiles: 32,
    maxRetainedTiles: 64,
    maxBytes: 64 * 1024 * 1024,
  });
  for (const width of [1000000, 100000, 10000, 1000, 100, 10, 100, 1000, 10000, 100000, 1000000]) {
    const box = {
      x: 1048576.25 - width * 0.61,
      y: -0.25 - (width * 0.43 * 9) / 16,
      width,
      height: (width * 9) / 16,
    };
    let complete = false,
      requests = 0;
    await stream.load(
      { ...input, box, metersPerPixel: width / 1920 },
      async (q) => {
        assert.equal(q.editingRadius, undefined);
        requests++;
        await new Promise((resolve) => setImmediate(resolve));
        return pair(q);
      },
      (frame) => {
        assert(frame.tiles.every((t) => t.terrain.revision === 2 && t.material.revision === 2));
        if (!frame.overviewComplete) return;
        for (const dx of [0.01, 0.5, 0.99])
          for (const dy of [0.01, 0.5, 0.99]) {
            const x = box.x + box.width * dx,
              y = box.y + box.height * dy;
            assert(
              frame.tiles.some((t) => {
                const s = 256 * 2 ** t.tile.lod;
                return (
                  x >= t.tile.x * s &&
                  x < (t.tile.x + 1) * s &&
                  y >= t.tile.y * s &&
                  y < (t.tile.y + 1) * s
                );
              }),
              'complete published coverage',
            );
          }
        complete ||= frame.complete;
      },
    );
    assert(complete);
    assert(requests <= 64);
    assert(stream.statistics.bytes <= 64 * 1024 * 1024);
    assert(stream.statistics.tiles <= 64);
  }
  stream.dispose();
});

const revisedPair = (q, fence) => {
  const p = pair(q);
  p.fence = p.terrain.fence = p.material.fence = p.terrain.projection.fence = fence;
  p.terrain.projection.source = fence;
  return p;
};
const interval = (bounds, extra = {}) => ({
  base: { revision: 2, fence: 'fence' },
  target: { revision: 3, fence: 'next' },
  invalidation: { reset: false, bounds },
  ...extra,
});
test('authoritative local interval reuses disjoint arrays, rebuilds the halo and leaves old metadata immutable', async () => {
  const stream = new AtlasSurfaceTileStream({ maxBytes: 16 * 1024 * 1024 }),
    view = { ...input, box: { x: 0, y: 0, width: 512, height: 256 } };
  let before, after;
  await stream.load(
    view,
    async (q) => pair(q),
    (f) => {
      if (f.complete) before = f;
    },
  );
  const prior = before.tiles.find((t) => t.tile.x === 0),
    calls = [];
  await stream.load(
    {
      ...view,
      revision: 3,
      source: 'next',
      change: interval([{ x: 350, y: 100, width: 1, height: 1 }]),
    },
    async (q) => {
      calls.push(q.tile);
      return revisedPair(q, 'next');
    },
    (f) => {
      if (f.complete) after = f;
    },
  );
  assert.equal(calls.length, 2, 'only the intersecting detail and its parent need reads');
  assert.equal(stream.statistics.reused, 1);
  const adopted = after.tiles.find((t) => t.tile.x === 0);
  assert.notEqual(adopted, prior);
  assert.equal(adopted.terrain.projection.grid, prior.terrain.projection.grid);
  assert.equal(adopted.material.channels, prior.material.channels);
  assert.equal(prior.revision, 2);
  assert.equal(prior.terrain.projection.fence, 'fence');
  assert.equal(adopted.terrain.projection.source, 'next');
  assert(after.tiles.every((t) => t.revision === 3 && t.material.fence === 'next'));
  assert(stream.statistics.bytes < 8 * 1024 * 1024, 'transferred arrays count once');
  stream.dispose();
});
test('halo, missing/reset/wrong endpoint evidence and product changes require canonical reads', async () => {
  const cases = [
    interval([{ x: 257, y: 128, width: 1, height: 1 }]),
    undefined,
    interval([], { invalidation: { reset: true, bounds: [] } }),
    interval([], { base: { revision: 1, fence: 'fence' } }),
    interval([], { target: { revision: 3, fence: 'other' } }),
    interval([{ x: NaN, y: 0, width: 1, height: 1 }]),
    interval([]),
  ];
  for (let i = 0; i < cases.length; i++) {
    const stream = new AtlasSurfaceTileStream();
    await stream.load(
      input,
      async (q) => pair(q),
      () => {},
    );
    let calls = 0;
    await stream.load(
      {
        ...input,
        revision: 3,
        source: 'next',
        change: cases[i],
        ...(i === cases.length - 1 ? { contours: 4 } : {}),
      },
      async (q) => {
        calls++;
        return revisedPair(q, 'next');
      },
      () => {},
    );
    assert.equal(calls, 2, 'case ' + i);
    assert.equal(stream.statistics.reused, 0);
    stream.dispose();
  }
});
test('a wholly disjoint interval transfers the complete cache without a second allocation or physical read', async () => {
  const stream = new AtlasSurfaceTileStream();
  await stream.load(
    input,
    async (q) => pair(q),
    () => {},
  );
  const bytes = stream.statistics.bytes;
  await stream.load(
    {
      ...input,
      revision: 3,
      source: 'next',
      change: interval([{ x: 100000, y: 100000, width: 2, height: 2 }]),
    },
    async () => {
      throw Error('unexpected physical read');
    },
    (f) => {
      assert(f.tiles.every((t) => t.revision === 3));
    },
  );
  assert.equal(stream.statistics.reused, 2);
  assert.equal(stream.statistics.tiles, 2);
  assert(Math.abs(stream.statistics.bytes - bytes) < 1024);
  stream.dispose();
});

test('a second authoritative interval cancels an unfinished predecessor before it can publish', async () => {
  const stream = new AtlasSurfaceTileStream();
  await stream.load(
    input,
    async (q) => pair(q),
    () => {},
  );
  let release;
  const gate = new Promise((resolve) => {
      release = resolve;
    }),
    calls = [],
    finalFrames = [];
  const fetch = async (q) => {
    calls.push(q.revision);
    if (q.revision === 3) await gate;
    return revisedPair(q, q.revision === 3 ? 'next' : 'four');
  };
  const first = stream.load(
    {
      ...input,
      revision: 3,
      source: 'next',
      change: interval([{ x: 0, y: 0, width: 256, height: 256 }]),
    },
    fetch,
    () => {},
  );
  await new Promise((resolve) => setImmediate(resolve));
  const last = stream.load(
    {
      ...input,
      revision: 4,
      source: 'four',
      change: interval([], {
        base: { revision: 3, fence: 'next' },
        target: { revision: 4, fence: 'four' },
      }),
    },
    fetch,
    (f) => finalFrames.push(f),
  );
  release();
  await Promise.all([first, last]);
  assert.deepEqual(calls, [3, 4, 4]);
  assert(finalFrames.every((f) => f.tiles.every((t) => t.revision === 4 && t.fence === 'four')));
  assert.equal(finalFrames.at(-1).complete, true);
  stream.dispose();
});

test('whole author packets remain canonical reads even when the narrowed node interval is disjoint', async () => {
  const stream = new AtlasSurfaceTileStream(),
    view = { ...input, editingRadius: 4 },
    authorPair = (q, fence) => {
      const p = revisedPair(q, fence);
      p.terrain.projection.grid.editing = {
        ground: new Float32Array(65 * 65),
        water: new Float32Array(65 * 65),
        author: { radius: q.editingRadius, revision: q.revision, fence, records: [] },
      };
      return p;
    };
  await stream.load(
    view,
    async (q) => authorPair(q, 'fence'),
    () => {},
  );
  let calls = 0;
  await stream.load(
    {
      ...view,
      revision: 3,
      source: 'next',
      change: interval([{ x: 100000, y: 0, width: 1, height: 1 }]),
    },
    async (q) => {
      calls++;
      return authorPair(q, 'next');
    },
    () => {},
  );
  assert.equal(calls, 2);
  assert.equal(stream.statistics.reused, 0);
  stream.dispose();
});
