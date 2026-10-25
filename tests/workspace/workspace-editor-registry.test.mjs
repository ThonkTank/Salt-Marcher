import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import path from 'node:path';
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
  entryPoints: ['src/app/workspace/workspace-editors.ts'],
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
const { createWorkspaceEditors } = require('../../.build/workspace-editor-registry-tests.cjs');
// A host session needs the same interface, but no DOM or storage capability.
const session = () => ({ settle: async () => {}, deactivate() {}, status: {} });
function fixture() {
  const calls = [];
  let gate = true,
    refuse = null;
  globalThis.editorBoundaryTest = (name, args) => {
    calls.push(name);
    if (name === refuse) return false;
    return name.startsWith('activate') || name.startsWith('deactivate') ? undefined : true;
  };
  const host = {
    atlas: {
      session: session(),
      activate: () => calls.push('atlas'),
      flush: async () => {
        calls.push('atlasFlush');
        return true;
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
    editors: createWorkspaceEditors(host),
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
