import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSync } from '../helpers/build.mjs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const built = buildSync({
  entryPoints: ['desktop/atlas-host.ts'],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  write: false,
  external: ['electron', 'better-sqlite3', './atlas-region', './room-directory'],
}).outputFiles[0].text;
const deferred = () => {
  let resolve;
  const promise = new Promise((r) => {
    resolve = r;
  });
  return { promise, resolve };
};

for (const consumer of ['bootstrap', 'reuse', 'view', 'export']) {
  test(`graph acceptance blocks a ${consumer} source read already awaiting storage`, async () => {
    const handlers = new Map(),
      sourceWait = deferred(),
      graphWait = deferred(),
      entered = deferred();
    let holdSource = true,
      projections = 0;
    class Reader {
      cursor = 'test';
      async cancelAndWait() {}
      async terrainSourceChange(source, base) {
        projections++;
        return { base, target: source, invalidation: { reset: true, bounds: [] } };
      }
      async terrain() {
        projections++;
        return { draft: true };
      }
    }
    const module = { exports: {} };
    new Function('require', 'module', 'exports', built)(
      (name) => {
        if (name === 'electron') return {};
        if (name === './atlas-region') return { AtlasRegionService: Reader };
        if (name === './room-directory') return { RoomDirectoryService: Reader };
        return require(name);
      },
      module,
      module.exports,
    );
    const source = { revision: 1, fence: 'test-fence' };
    module.exports.registerAtlasHost({
      ipc: { scope: () => ({ handle: (name, fn) => handlers.set(name, fn) }) },
      store: {
        atlasRegionSource: async () => {
          if (holdSource) await sourceWait.promise;
          return source;
        },
        executeAtlasCommit: async () => {
          entered.resolve();
          await graphWait.promise;
          return {};
        },
      },
      win: {},
      dataDir: '.build',
      dungeonImport() {},
    });
    const box = { x: 0, y: 0, width: 16, height: 16 };
    const query = {
      product: 'height',
      revision: 1,
      fence: 'test-fence',
      view: {
        box,
        frame: box,
        columns: 2,
        rows: 2,
        focusM: 0,
        tilt: 0,
        rotation: 0,
        exaggeration: 1,
      },
      width: 16,
      height: 16,
      displayMpp: 1,
      contours: 0,
    };
    const read = () =>
      consumer === 'bootstrap'
        ? handlers.get('atlas:terrain-source')('token')
        : consumer === 'reuse'
          ? handlers.get('atlas:terrain-source')('token', source)
          : handlers.get('atlas:terrain-projection')('token', query, consumer);
    const pendingRead = read();
    const blocked = assert.rejects(pendingRead, /Graphwechsel läuft/);
    const pendingGraph = handlers.get('atlas:commit')({
      commandId: `graph-${consumer}`,
      action: { kind: 'graph-accept' },
    });
    await entered.promise;
    holdSource = false;
    sourceWait.resolve();
    await blocked;
    assert.equal(
      projections,
      0,
      'no projection begins using a source captured before graph mutation',
    );
    graphWait.resolve();
    await pendingGraph;
    const expected =
      consumer === 'bootstrap'
        ? source
        : consumer === 'reuse'
          ? {
              ...source,
              change: { base: source, target: source, invalidation: { reset: true, bounds: [] } },
            }
          : { draft: true };
    assert.deepEqual(await read(), expected);
    assert.equal(projections, consumer === 'bootstrap' ? 0 : 1);
  });
}

test('a surface interval is rejected when its worker evidence finishes after a graph mutation starts', async () => {
  const handlers = new Map(),
    evidence = deferred(),
    entered = deferred(),
    graph = deferred();
  class Reader {
    cursor = undefined;
    async cancelAndWait() {}
    async terrainSourceChange() {
      entered.resolve();
      return evidence.promise;
    }
  }
  const module = { exports: {} };
  new Function('require', 'module', 'exports', built)(
    (name) => {
      if (name === 'electron') return {};
      if (name === './atlas-region') return { AtlasRegionService: Reader };
      if (name === './room-directory') return { RoomDirectoryService: Reader };
      return require(name);
    },
    module,
    module.exports,
  );
  const source = { revision: 2, fence: 'target' },
    base = { revision: 1, fence: 'base' };
  module.exports.registerAtlasHost({
    ipc: { scope: () => ({ handle: (name, fn) => handlers.set(name, fn) }) },
    store: { atlasRegionSource: async () => source, executeAtlasCommit: async () => graph.promise },
    win: {},
    dataDir: '.build',
    dungeonImport() {},
  });
  const read = handlers.get('atlas:terrain-source')('token', base),
    rejected = assert.rejects(read, /Graphwechsel läuft/);
  await entered.promise;
  const mutation = handlers.get('atlas:commit')({
    commandId: 'graph-late',
    action: { kind: 'graph-accept' },
  });
  await new Promise((resolve) => setImmediate(resolve));
  evidence.resolve({ base, target: source, invalidation: { reset: false, bounds: [] } });
  await rejected;
  graph.resolve({});
  await mutation;
});
