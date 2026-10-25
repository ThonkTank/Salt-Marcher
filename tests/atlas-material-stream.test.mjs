import { emptyMaterialChannels } from './helpers/atlas-material-channels.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSync } from 'esbuild';

buildSync({
  entryPoints: ['src/app/atlas-material-tile-stream.ts'],
  outfile: '.build/atlas-material-tile-stream-test.mjs',
  bundle: true,
  platform: 'node',
  format: 'esm',
});
const { AtlasMaterialTileStream } = await import('../.build/atlas-material-tile-stream-test.mjs');

const input = (box = { x: 0, y: 0, width: 512, height: 256 }) => ({
  box,
  metersPerPixel: 1,
  revision: 19,
  source: 'terrain-materials',
});
const address = (tile) => `${tile.lod}/${tile.x}/${tile.y}`;
const turn = () => new Promise((resolve) => setImmediate(resolve));
const deferred = () => {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
};

function materialReply(request, tag = 1, fence = 'terrain-materials') {
  const { tile, revision } = request;
  const seed = (tile.lod * 37 + tile.x * 11 + tile.y * 5 + tag * 17) & 255;
  const baseColor = new Uint8Array(256 * 256 * 4);
  const channels = {
    ...emptyMaterialChannels(256 * 256),
    baseColor,
    water: new Uint8Array(256 * 256),
    forest: new Uint8Array(256 * 256),
    rock: new Uint8Array(256 * 256),
    snow: new Uint8Array(256 * 256),
  };
  baseColor.fill(seed);
  channels.water.fill((seed + 31) & 255);
  channels.forest.fill((seed + 67) & 255);
  channels.rock.fill((seed + 103) & 255);
  channels.snow.fill((seed + 149) & 255);
  return {
    tile: { ...tile },
    revision,
    fence,
    width: 256,
    height: 256,
    channels,
    cache: { baseColor: 'built', water: 'built', forest: 'built', rock: 'built', snow: 'built' },
  };
}

function assertMaterialFrame(frame) {
  for (const tile of frame.tiles) {
    assert.equal(tile.width, 256);
    assert.equal(tile.height, 256);
    assert.equal(tile.channels.baseColor.length, 256 * 256 * 4);
    for (const channel of ['water', 'forest', 'rock', 'snow']) {
      assert.equal(
        tile.channels[channel].length,
        256 * 256,
        `${address(tile.tile)} ${channel} has a complete tile buffer`,
      );
    }
  }
}

function overlaps(a, b) {
  if (a.lod === b.lod) return a.x === b.x && a.y === b.y;
  const fine = a.lod < b.lod ? a : b,
    coarse = a.lod < b.lod ? b : a,
    scale = 2 ** (coarse.lod - fine.lod);
  return Math.floor(fine.x / scale) === coarse.x && Math.floor(fine.y / scale) === coarse.y;
}
function assertNoOverlap(frame) {
  for (let i = 0; i < frame.tiles.length; i++)
    for (let j = i + 1; j < frame.tiles.length; j++)
      assert.equal(
        overlaps(frame.tiles[i].tile, frame.tiles[j].tile),
        false,
        `overlap in material frame: ${address(frame.tiles[i].tile)} and ${address(frame.tiles[j].tile)}`,
      );
}

test('material frames publish complete, address-matched channels and replace a parent only after all detail children arrive', async () => {
  const stream = new AtlasMaterialTileStream(),
    frames = [],
    blocked = deferred(),
    calls = [];
  const loading = stream.load(
    input(),
    async (request) => {
      calls.push(address(request.tile));
      if (request.tile.lod === 0 && request.tile.x === 1) return blocked.promise;
      return materialReply(request);
    },
    (frame) => frames.push(frame),
  );
  await turn();
  assert.deepEqual(calls, ['2/0/0', '0/0/0', '0/1/0']);
  assert.deepEqual(
    frames.map((frame) => frame.tiles.map((tile) => address(tile.tile))),
    [[], ['2/0/0']],
  );
  for (const frame of frames) {
    assertMaterialFrame(frame);
    assertNoOverlap(frame);
  }
  const overview = frames.at(-1).tiles[0];
  assert.equal(
    overview.channels.baseColor[0],
    materialReply({ tile: { lod: 2, x: 0, y: 0 } }).channels.baseColor[0],
  );
  assert.equal(
    overview.channels.forest[0],
    materialReply({ tile: { lod: 2, x: 0, y: 0 } }).channels.forest[0],
  );

  blocked.resolve(materialReply({ tile: { lod: 0, x: 1, y: 0 }, revision: 19 }));
  await loading;
  const final = frames.at(-1);
  assert.equal(final.complete, true);
  assert.deepEqual(
    final.tiles.map((tile) => address(tile.tile)),
    ['0/0/0', '0/1/0'],
  );
  for (const frame of frames) {
    assertMaterialFrame(frame);
    assertNoOverlap(frame);
  }
  assert.equal(
    final.tiles[0].channels.baseColor[0],
    materialReply({ tile: { lod: 0, x: 0, y: 0 } }).channels.baseColor[0],
  );
  assert.equal(
    final.tiles[1].channels.baseColor[0],
    materialReply({ tile: { lod: 0, x: 1, y: 0 } }).channels.baseColor[0],
  );
  for (const channel of ['water', 'forest', 'rock', 'snow'])
    assert.notEqual(final.tiles[0].channels[channel][0], final.tiles[1].channels[channel][0]);
});

test('a malformed material channel cannot be published or cached', async () => {
  for (const channel of ['baseColor', 'water', 'forest', 'rock', 'snow']) {
    const stream = new AtlasMaterialTileStream();
    let attempts = 0,
      frames = [];
    await assert.rejects(
      stream.load(
        input({ x: 0, y: 0, width: 256, height: 256 }),
        async (request) => {
          attempts++;
          const tile = materialReply(request);
          if (attempts === 1)
            tile.channels[channel] = new Uint8Array(tile.channels[channel].length - 1);
          return tile;
        },
        (frame) => frames.push(frame),
      ),
      /material|reply|tile|channel/i,
    );
    assert.ok(
      frames.every((frame) => frame.tiles.length === 0),
      `${channel} failure leaves only the empty revocation frame`,
    );
    await stream.load(
      input({ x: 0, y: 0, width: 256, height: 256 }),
      async (request) => {
        attempts++;
        return materialReply(request);
      },
      (frame) => frames.push(frame),
    );
    assert.equal(
      attempts,
      3,
      `${channel} failure was not cached; retry requests overview and detail`,
    );
    assertMaterialFrame(frames.at(-1));
  }
});

test('stale material revision, fence, and address replies are rejected before publication or caching', async () => {
  const corruptions = [
    (tile) => ({ ...tile, revision: tile.revision + 1 }),
    (tile) => ({ ...tile, fence: 'stale-source' }),
    (tile) => ({ ...tile, tile: { ...tile.tile, x: tile.tile.x + 1 } }),
  ];
  for (const corrupt of corruptions) {
    const stream = new AtlasMaterialTileStream(),
      frames = [];
    let attempts = 0;
    await assert.rejects(
      stream.load(
        input({ x: 0, y: 0, width: 256, height: 256 }),
        async (request) => {
          attempts++;
          const tile = materialReply(request);
          return attempts === 1 ? corrupt(tile) : tile;
        },
        (frame) => frames.push(frame),
      ),
      /reply|material tile/i,
    );
    assert.ok(
      frames.every((frame) => frame.tiles.length === 0),
      'invalid replies cannot appear in a published frame',
    );
    await stream.load(
      input({ x: 0, y: 0, width: 256, height: 256 }),
      async (request) => {
        attempts++;
        return materialReply(request);
      },
      (frame) => frames.push(frame),
    );
    assert.equal(attempts, 3, 'invalid reply was not cached; retry refetches overview and detail');
    assertMaterialFrame(frames.at(-1));
  }
});

test('same-source pan retains intersecting material tiles while newly exposed detail loads', async () => {
  const stream = new AtlasMaterialTileStream(),
    frames = [],
    blocked = deferred();
  await stream.load(
    input(),
    async (request) => materialReply(request),
    (frame) => frames.push(frame),
  );
  const original = frames.at(-1);
  assert.deepEqual(
    original.tiles.map((tile) => address(tile.tile)),
    ['0/0/0', '0/1/0'],
  );
  const moving = stream.load(
    input({ x: 128, y: 0, width: 512, height: 256 }),
    async (request) => {
      if (request.tile.lod === 0 && request.tile.x === 2) return blocked.promise;
      return materialReply(request);
    },
    (frame) => frames.push(frame),
  );
  const retained = frames.at(-1);
  assert.deepEqual(
    retained.tiles.map((tile) => address(tile.tile)),
    ['0/0/0', '0/1/0'],
  );
  assertMaterialFrame(retained);
  await turn();
  assert.ok(
    frames
      .filter((frame) => frame.generation === retained.generation)
      .some((frame) => frame.tiles.length > 0),
  );
  blocked.resolve(materialReply({ tile: { lod: 0, x: 2, y: 0 }, revision: 19 }));
  await moving;
  assert.equal(frames.at(-1).complete, true);
  assert.deepEqual(
    frames.at(-1).tiles.map((tile) => address(tile.tile)),
    ['0/1/0', '0/0/0', '0/2/0'],
  );
  for (const frame of frames.filter((frame) => frame.generation === retained.generation)) {
    assertMaterialFrame(frame);
    assertNoOverlap(frame);
  }

  const secondBlocked = deferred();
  const secondMove = stream.load(
    input({ x: 384, y: 0, width: 512, height: 256 }),
    async (request) => {
      if (request.tile.lod === 0 && request.tile.x === 3) return secondBlocked.promise;
      return materialReply(request);
    },
    (frame) => frames.push(frame),
  );
  const secondRetained = frames.at(-1);
  assert.deepEqual(
    secondRetained.tiles.map((tile) => address(tile.tile)),
    ['0/1/0', '0/2/0'],
  );
  await turn();
  assert.ok(
    frames
      .filter((frame) => frame.generation === secondRetained.generation)
      .some((frame) => frame.tiles.length > 0),
  );
  secondBlocked.resolve(materialReply({ tile: { lod: 0, x: 3, y: 0 }, revision: 19 }));
  await secondMove;
  assert.equal(frames.at(-1).complete, true);
  assert.deepEqual(
    frames
      .at(-1)
      .tiles.map((tile) => address(tile.tile))
      .sort(),
    ['0/1/0', '0/2/0', '0/3/0'],
  );
  for (const frame of frames.filter((frame) => frame.generation === secondRetained.generation)) {
    assertMaterialFrame(frame);
    assertNoOverlap(frame);
  }
});

test('default tile cap coarsens a dense viewport to a bounded completed material frame', async () => {
  const stream = new AtlasMaterialTileStream(),
    frames = [],
    calls = [];
  await stream.load(
    input({ x: 0, y: 0, width: 2048, height: 2048 }),
    async (request) => {
      calls.push(address(request.tile));
      return materialReply(request);
    },
    (frame) => frames.push(frame),
  );
  const final = frames.at(-1);
  assert.equal(final.complete, true);
  assert.ok(final.tiles.length > 0);
  assert.ok(
    final.tiles.length <= 32,
    `default maxTiles bounds visible material frame: got ${final.tiles.length}`,
  );
  assert.ok(calls.length > 0);
  assertMaterialFrame(final);
  assertNoOverlap(final);
});

test('material byte limits count oversized backing buffers behind exact-size channel views', async () => {
  const stream = new AtlasMaterialTileStream({ maxBytes: 1_000_000 });
  await assert.rejects(
    stream.load(
      input({ x: 0, y: 0, width: 256, height: 256 }),
      async (request) => {
        const tile = materialReply(request);
        for (const [channel, array] of Object.entries(tile.channels)) {
          const backing = new ArrayBuffer(array.byteLength * 2);
          new Uint8Array(backing).fill(array[0]);
          tile.channels[channel] = new Uint8Array(backing, 0, array.byteLength);
        }
        assert.equal(
          tile.channels.baseColor.byteLength,
          256 * 256 * 4,
          'visible view has the valid channel length',
        );
        assert.ok(
          tile.channels.baseColor.buffer.byteLength > tile.channels.baseColor.byteLength,
          'backing allocation exceeds view',
        );
        return tile;
      },
      () => {},
    ),
    /maxBytes/i,
  );
});

test('a superseded material load cannot publish or cache its late reply', async () => {
  const stream = new AtlasMaterialTileStream(),
    late = deferred(),
    frames = [];
  let oldFetches = 0,
    newFetches = 0;
  const oldLoad = stream.load(
    input({ x: 0, y: 0, width: 256, height: 256 }),
    async () => {
      oldFetches++;
      return late.promise;
    },
    (frame) => frames.push(frame),
  );
  await turn();
  const beforeReplacement = frames.length;
  const replacement = stream.load(
    { ...input({ x: 512, y: 0, width: 256, height: 256 }), source: 'replacement' },
    async (request) => {
      newFetches++;
      return materialReply(request, 1, 'replacement');
    },
    (frame) => frames.push(frame),
  );
  const currentGeneration = frames.at(-1).generation;
  await turn();
  assert.equal(newFetches, 0, 'replacement waits for physical ownership');
  late.resolve(materialReply({ tile: { lod: 2, x: 0, y: 0 }, revision: 19 }));
  await Promise.all([oldLoad, replacement]);
  assert.ok(
    frames.slice(beforeReplacement).every((frame) => frame.generation === currentGeneration),
  );
  const oldCount = oldFetches;
  await stream.load(
    input({ x: 0, y: 0, width: 256, height: 256 }),
    async (request) => {
      oldFetches++;
      return materialReply(request);
    },
    () => {},
  );
  assert.ok(oldFetches > oldCount, 'superseded reply must not enter the cache');
  assert.ok(newFetches > 0);
});

test('disposed material stream drops blocked replies without publishing them', async () => {
  const stream = new AtlasMaterialTileStream(),
    pending = deferred(),
    frames = [];
  const loading = stream.load(
    input(),
    async () => pending.promise,
    (frame) => frames.push(frame),
  );
  await turn();
  stream.dispose();
  pending.resolve(materialReply({ tile: { lod: 2, x: 0, y: 0 }, revision: 19 }));
  await loading;
  assert.equal(frames.length, 1);
  assert.deepEqual(frames[0].tiles, []);
  await assert.rejects(
    stream.load(
      input(),
      async (request) => materialReply(request),
      () => {},
    ),
    /disposed/i,
  );
});

test('twenty camera supersessions keep one physical fetch and abort obsolete ownership', async () => {
  const stream = new AtlasMaterialTileStream(),
    gate = deferred(),
    frames = [];
  let calls = 0,
    signal;
  const first = stream.load(
    input(),
    async (request, s) => {
      calls++;
      signal = s;
      await gate.promise;
      return materialReply(request);
    },
    (frame) => frames.push(frame),
  );
  await turn();
  const loads = [first];
  for (let i = 1; i <= 20; i++)
    loads.push(
      stream.load(
        input({ x: i * 256, y: 0, width: 256, height: 256 }),
        async (request) => {
          calls++;
          return materialReply(request);
        },
        (frame) => frames.push(frame),
      ),
    );
  await turn();
  assert.equal(calls, 1);
  assert(signal.aborted);
  gate.resolve();
  await Promise.all(loads);
  assert.equal(calls, 3, 'only final overview and detail follow the initial fetch');
  assert.equal(frames.at(-1).complete, true);
  assert.equal(frames.at(-1).generation, 21);
});
