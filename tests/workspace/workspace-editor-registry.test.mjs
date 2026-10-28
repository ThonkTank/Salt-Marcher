import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import path from 'node:path';
import { parseHTML } from '../helpers/dom.mjs';
const require = createRequire(import.meta.url),
  root = process.cwd();
const owners = {
  'npc-ui': ['Npcs'],
  'groups-ui': ['Groups'],
  'treasury-ui': ['Treasury'],
  'trigger-ui': ['Triggers'],
  'dungeon-content-ui': ['DungeonContent'],
  'graph-ui': ['Graph'],
  'key-ui': ['Keys'],
  'path-ui': ['Paths'],
  'volume-ui': ['Volume'],
  'dungeon-ui': ['Dungeon'],
  'drawing-ui': ['Drawing'],
  'autonomy-ui': ['Autonomy'],
  'city-ui': ['City'],
  'music-ui': ['Music'],
  'world-ui': ['World'],
  'items-ui': ['Items'],
  'catalog-ui': ['Catalog'],
  live: ['Live'],
  preparation: ['Preparation'],
  combat: [],
  'chase-ui': [],
  'progression-ui': [],
  'scene-desk-ui': [],
  'narrative-ui': [],
  'session-ui': [],
  'generation-ui': [],
  'finish-draft-ui': [],
};
await build({
  stdin: {
    contents: `export { createWorkspaceEditors } from './src/app/workspace/workspace-editors';
      export { AtlasRegions } from './src/app/atlas/atlas-regions';`,
    resolveDir: root,
  },
  outfile: '.build/workspace-editor-registry-tests.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  plugins: [
    {
      name: 'domain-boundaries',
      setup(b) {
        b.onResolve({ filter: /^\.{1,2}\// }, (args) => {
          const name = path.posix.basename(args.path);
          if (args.importer.endsWith('/workspace-editors.ts') && name in owners)
            return { path: name, namespace: 'editor-boundary' };
        });
        b.onLoad({ filter: /.*/, namespace: 'editor-boundary' }, ({ path: name }) => ({
          loader: 'ts',
          resolveDir: root,
          contents: `import {EditorSession} from ${JSON.stringify(path.join(root, 'src/app/shared/editor-session.ts'))};
 export const editorSession=new EditorSession();
 const call=(name,args)=>globalThis.editorBoundaryTest(name,args);
 ${owners[name].flatMap((suffix) => ['activate', 'flush'].map((prefix) => `export const ${prefix + suffix}=(...args)=>call('${prefix + suffix}',args);`)).join('\n')}
 ${name === 'music-ui' ? "export const deactivateMusic=()=>call('deactivateMusic',[]);" : ''}
 ${name === 'world-ui' ? "export const stopWorldPlayback=()=>call('stopWorldPlayback',[]);" : ''}
 ${name === 'preparation' ? "export const leavePreparation=()=>call('leavePreparation',[]);" : ''}
 ${name === 'graph-ui' ? "export const canLeaveGraphPreview=()=>call('canLeaveGraphPreview',[]);" : ''}
 `,
        }));
      },
    },
  ],
});
const {
  createWorkspaceEditors,
  AtlasRegions,
} = require('../../.build/workspace-editor-registry-tests.cjs');
// A host session needs the same interface, but no DOM or storage capability.
const session = () => ({ settle: async () => {}, deactivate() {}, status: {} });
function fixture() {
  const calls = [];
  let gate = true,
    refuse = null,
    atlasFlush = async () => true;
  globalThis.editorBoundaryTest = (name, args) => {
    calls.push(name);
    if (name === refuse) return false;
    return name.startsWith('activate') || name.startsWith('deactivate') ? undefined : true;
  };
  const owner = (name) => ({
    editorSession: session(),
    ['activate' + name]: (...args) => globalThis.editorBoundaryTest('activate' + name, args),
    ['flush' + name]: (...args) => globalThis.editorBoundaryTest('flush' + name, args),
    ['deactivate' + name]: (...args) => globalThis.editorBoundaryTest('deactivate' + name, args),
  });
  const host = {
    npcs: owner('Npcs'),
    music: owner('Music'),
    items: owner('Items'),
    combat: { editorSession: session() },
    live: {
      editorSession: session(),
      activateLive: (...args) => globalThis.editorBoundaryTest('activateLive', args),
      flushLive: (...args) => globalThis.editorBoundaryTest('flushLive', args),
    },
    preparation: {
      editorSession: session(),
      activatePreparation: (...args) => globalThis.editorBoundaryTest('activatePreparation', args),
      flushPreparation: (...args) => globalThis.editorBoundaryTest('flushPreparation', args),
      leavePreparation: (...args) => globalThis.editorBoundaryTest('leavePreparation', args),
    },
    atlas: {
      session: { ...session(), deactivate: () => calls.push('atlasSessionStop') },
      activate: () => calls.push('atlas'),
      deactivate: () => calls.push('atlasStop'),
      flush: async () => {
        calls.push('atlasFlush');
        return atlasFlush();
      },
    },
    room: {
      session: session(),
      flush: async () => {
        calls.push('roomCheckpoint');
        return true;
      },
      leave: async () => {
        calls.push('roomRetain');
        return true;
      },
    },
    gate: () => gate,
    beforeTool: () => true,
    views: [{ id: 'view', order: 2, activate: () => calls.push('view') }],
  };
  return {
    calls,
    host,
    editors: createWorkspaceEditors(host),
    atlasFlush: (value) => {
      atlasFlush = value;
    },
    gate: (value) => {
      gate = value;
    },
    refuse: (value) => {
      refuse = value;
    },
  };
}
const prefix = [
  'flushNpcs',
  'flushGroups',
  'flushTreasury',
  'flushTriggers',
  'flushDungeonContent',
  'flushGraph',
  'flushKeys',
  'flushPaths',
  'flushVolume',
  'flushDungeon',
  'flushDrawing',
  'flushAutonomy',
  'flushCity',
];
const tail = ['flushMusic', 'flushWorld', 'flushItems', 'flushCatalog', 'flushLive'];
test('checkpoint preserves original writer order and does not substitute raw retention for adoption', async () => {
  const x = fixture();
  assert.equal(await x.editors.flush('checkpoint'), true);
  assert.deepEqual(x.calls, [...prefix, ...tail, 'flushPreparation', 'roomCheckpoint']);
});
test('navigation retains raw preparation and room drafts; campaign and close also check graph preview', async () => {
  for (const reason of ['navigation', 'campaign', 'close']) {
    const x = fixture();
    assert.equal(await x.editors.flush(reason), true);
    assert.deepEqual(x.calls, [
      'atlasFlush',
      'stopWorldPlayback',
      ...prefix,
      ...tail,
      'leavePreparation',
      'roomRetain',
      ...(reason === 'navigation' ? [] : ['canLeaveGraphPreview']),
    ]);
  }
});
test('failed activation keeps its historical short circuit while campaign exit still protects graph preview', async () => {
  const x = fixture();
  x.gate('complete');
  assert.equal(await x.editors.flush('campaign'), true);
  assert.deepEqual(x.calls, ['atlasFlush', 'stopWorldPlayback', ...prefix, 'canLeaveGraphPreview']);
});
test('refusal stops before later editors and all activation callbacks retain their former order', async () => {
  const x = fixture();
  x.refuse('flushCity');
  assert.equal(await x.editors.flush('close'), false);
  assert.deepEqual(x.calls, ['atlasFlush', 'stopWorldPlayback', ...prefix]);
  x.calls.length = 0;
  await x.editors.activate({ token: 'A' });
  assert.deepEqual(x.calls, [
    'atlas',
    'activateLive',
    'view',
    'activateCatalog',
    'activateItems',
    'activateTreasury',
    'activateGroups',
    'activateNpcs',
    'activateWorld',
    'activateCity',
    'activateAutonomy',
    'activateDungeon',
    'activateVolume',
    'activatePaths',
    'activateKeys',
    'activateGraph',
    'activateDungeonContent',
    'activateTriggers',
    'activateDrawing',
    'activateMusic',
    'activatePreparation',
  ]);
});
test('tool preflight excludes its own in-flight task and retains its exact suffix and room checkpoint exception', async () => {
  const order = ['triggers', 'content', 'graph', 'keys', 'paths', 'volume', 'drawing'];
  const flush = [
    'flushTriggers',
    'flushDungeonContent',
    'flushGraph',
    'flushKeys',
    'flushPaths',
    'flushVolume',
    'flushDrawing',
  ];
  for (let i = 0; i < order.length; i++) {
    const x = fixture();
    assert.equal(await x.editors.before(order[i]), true);
    assert.deepEqual(x.calls, [
      ...flush.slice(i + 1),
      'flushAutonomy',
      'flushCity',
      ...tail,
      'leavePreparation',
      'roomCheckpoint',
    ]);
  }
});

for (const acknowledged of [true, false])
  test(`close retires Atlas readers after every writer acknowledges (acknowledged=${acknowledged})`, async () => {
    const x = fixture();
    let settle;
    x.atlasFlush(() => new Promise((resolve) => (settle = resolve)));
    // Match the renderer boundary: a refused drain keeps the live Atlas attached.
    const closing = (async () => {
      if (await x.editors.flush('close')) x.editors.deactivate();
    })();
    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(x.calls, ['atlasFlush']);
    settle(acknowledged);
    await closing;
    if (!acknowledged) {
      assert.deepEqual(x.calls, ['atlasFlush']);
      return;
    }
    assert(x.calls.indexOf('atlasStop') > x.calls.indexOf('canLeaveGraphPreview'));
    assert(x.calls.indexOf('atlasSessionStop') < x.calls.indexOf('atlasStop'));
    assert.equal(x.calls.filter((call) => call === 'atlasStop').length, 1);
    x.calls.length = 0;
    await x.editors.activate({ token: 'next' });
    assert.equal(x.calls[0], 'atlas');
  });

test('campaign suspension retires pending Atlas replies before Main cancels source reads', async (t) => {
  const previous = { window: global.window, document: global.document };
  const { window, document } = parseHTML(
    '<p id="atlas-save-status"></p><p id="atlas-hint"></p><button id="atlas-region-retry"></button>',
  );
  Object.assign(global, { window, document });
  t.after(() => Object.assign(global, previous));
  let reply;
  const errors = [],
    x = fixture();
  const host = {
    owner: { token: 'source' },
    root: document.createElement('section'),
    canvas: document.createElement('canvas'),
    landscape: { livePainting: false },
    journey: {
      beginContextRead() {},
      renderTravel() {},
      failContextRead() {
        errors.push('travel failed');
      },
    },
    invalidateHits() {},
    render() {},
    error: (error) => errors.push(error.message),
  };
  window.campaign = {
    atlasRegion: () =>
      new Promise((resolve) => {
        reply = resolve;
      }),
    cancelAtlasRegion: () => {},
  };
  const regions = new AtlasRegions(host);
  regions.regionQuery = () => ({});
  x.host.atlas.deactivate = () => regions.cancel();
  // The registration captures this callback when built, as the renderer does.
  const editors = createWorkspaceEditors(x.host);
  const pending = regions.refresh();
  assert.equal(host.root.dataset.regionState, 'loading');
  editors.suspend();
  assert.equal(
    host.owner.token,
    'source',
    'source session stays attached until the next context loads',
  );
  reply({ ok: false, error: 'Kartenausschnitt abgebrochen.' });
  await pending;
  assert.deepEqual(
    errors,
    [],
    'retired source cancellation must not mark the visible Atlas failed',
  );
  assert.equal(regions.reading, false);
  assert.notEqual(host.root.dataset.regionState, 'failed');
  // The next live owner still reports a genuine read failure; suspension does
  // not suppress errors from requests it continues to own.
  const current = regions.refresh();
  reply({ ok: false, error: 'Current Atlas source unavailable' });
  await current;
  assert.deepEqual(errors, ['travel failed', 'Current Atlas source unavailable']);
  assert.equal(host.root.dataset.regionState, 'failed');
});
