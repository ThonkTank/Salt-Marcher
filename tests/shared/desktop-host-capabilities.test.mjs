import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { createRequire } from 'node:module';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { build } from 'esbuild';
import { setTimeout as delay } from 'node:timers/promises';
const require = createRequire(import.meta.url);
const output = path.resolve('.build/host-capabilities.cjs');
await build({
  entryPoints: ['desktop/main.ts'],
  outfile: output,
  bundle: true,
  platform: 'node',
  format: 'cjs',
  define: { __APP_VERSION__: '"test"' },
  external: ['better-sqlite3'],
  plugins: [
    {
      name: 'native-ports',
      setup(build) {
        build.onResolve(
          { filter: /^(electron|\.\/store-client|\.\/update-runtime|\.\/update-service)$/ },
          (args) => ({ path: args.path, namespace: 'native-ports' }),
        );
        build.onLoad({ filter: /.*/, namespace: 'native-ports' }, (args) => ({
          contents:
            args.path === 'electron'
              ? 'module.exports=globalThis.__hostFixture.electron'
              : args.path === './store-client'
                ? 'exports.StoreClient=class {constructor(){return globalThis.__hostFixture.store}};exports.StoreOutcomeUnknownError=class StoreOutcomeUnknownError extends Error{}'
                : args.path === './update-runtime'
                  ? 'exports.openUpdateRuntime=async()=>globalThis.__hostFixture.updateRuntime'
                  : 'exports.UpdateService=class {constructor(){return globalThis.__hostFixture.updates}}',
        }));
      },
    },
  ],
});
const tick = () => new Promise((resolve) => setImmediate(resolve));
async function until(check) {
  const deadline = Date.now() + 5000;
  while (!check() && Date.now() < deadline) await delay(5);
  assert(check(), 'Host did not reach expected state');
}
function deferred() {
  let resolve;
  const promise = new Promise((r) => (resolve = r));
  return { promise, resolve };
}
async function fixture(t, { ready = Promise.resolve() } = {}) {
  const dir = mkdtempSync(path.join(tmpdir(), 'host-capabilities-')),
    calls = [],
    handlers = new Map(),
    windows = [],
    errors = [];
  const started = deferred();
  let disposed = false;
  const previous = globalThis.__hostFixture,
    argv = process.argv;
  const ipcMain = new EventEmitter();
  ipcMain.handle = (name, handler) => {
    assert(!handlers.has(name), 'Duplicate channel ' + name);
    handlers.set(name, handler);
  };
  ipcMain.removeHandler = (name) => handlers.delete(name);
  function session() {
    const s = new EventEmitter();
    s.setPermissionRequestHandler = (fn) => (s.permission = fn);
    s.setPermissionCheckHandler = (fn) => (s.permissionCheck = fn);
    s.webRequest = { onBeforeRequest: (fn) => (s.request = fn) };
    s.protocol = {
      handle: (name, fn) => (s.resource = fn),
      unhandle: () => {
        s.resource = null;
      },
    };
    return s;
  }
  const playerSession = session(),
    gmSession = session();
  const protocol = {
    registerSchemesAsPrivileged() {},
    handle: (name, fn) => (protocol.resource = fn),
    unhandle: () => {
      protocol.resource = null;
    },
  };
  const app = new EventEmitter();
  Object.assign(app, {
    setName() {},
    setPath() {},
    getPath: () => dir,
    requestSingleInstanceLock: () => true,
    whenReady: () => ready,
    quit: () => calls.push('quit'),
    exit: (code) => {
      errors.push(code);
      started.resolve();
    },
  });
  class BrowserWindow extends EventEmitter {
    constructor(options) {
      super();
      if (disposed) throw Error('Host fixture already disposed');
      this.options = options;
      this.webContents = new EventEmitter();
      Object.assign(this.webContents, {
        id: windows.length + 1,
        mainFrame: { url: 'campaign://app/index.html' },
        session: gmSession,
        setWindowOpenHandler() {},
        send: (name, ...args) => calls.push([name, ...args]),
      });
      windows.push(this);
    }
    isDestroyed() {
      return false;
    }
    async loadURL(url) {
      this.webContents.mainFrame.url = url;
      calls.push('loaded');
      started.resolve();
    }
    show() {
      calls.push('show');
    }
    close() {
      this.emit('close', { preventDefault() {} });
    }
  }
  const store = new EventEmitter();
  Object.assign(store, {
    ready: Promise.resolve(),
    pendingCampaignErasures: async () => [],
    list: async () => ({ campaigns: [] }),
    select: async (...args) => args,
    currentPlayerDisplay: async () => null,
    finishCampaignErasureFiles: async (id) => calls.push(['erased', id]),
    close: async () => {
      calls.push('store.close');
      return { databaseClosed: true, exitCode: 0 };
    },
  });
  const updateRuntime = {
    root: null,
    transaction: null,
    ready: async () => calls.push('ready'),
    prepare: async () => {
      calls.push('prepare');
      return 'request';
    },
    handoff: async (request) => calls.push(['handoff', request]),
    close: async () => calls.push('runtime.close'),
  };
  const updates = {
    init: async () => {},
    status: () => ({ phase: 'idle' }),
    autoCheck: async () => {},
    installation: () => ({}),
    installing: () => calls.push('installing'),
    installationFailed: () => calls.push('installationFailed'),
  };
  const electron = {
    app,
    BrowserWindow,
    ipcMain,
    protocol,
    session: { fromPartition: () => playerSession },
    dialog: { showErrorBox: (...args) => errors.push(args) },
    net: { fetch: async () => new Response('file') },
    screen: { getAllDisplays: () => [] },
    nativeImage: {},
    shell: {},
  };
  // Register ownership before starting any async initialization or assertion.
  t.after(async () => {
    try {
      const win = windows[0];
      if (win && !calls.includes('quit')) {
        ipcMain.emit('campaign:close-ready', {
          sender: win.webContents,
          senderFrame: win.webContents.mainFrame,
        });
        await until(() => calls.includes('quit'));
      }
    } finally {
      disposed = true;
      // Failure cleanup must release the backup interval even when graceful close failed.
      for (const win of windows) win.emit('closed');
      globalThis.__hostFixture = previous;
      process.argv = argv;
      rmSync(dir, { recursive: true, force: true });
    }
  });
  globalThis.__hostFixture = { electron, store, updates, updateRuntime };
  process.argv = [...argv, '--data-dir', dir];
  delete require.cache[output];
  require(output);
  let timeout;
  try {
    await Promise.race([
      started.promise,
      new Promise((_, reject) => {
        timeout = setTimeout(() => reject(Error('Host startup timed out')), 5000);
      }),
    ]);
  } finally {
    clearTimeout(timeout);
  }
  assert.deepEqual(errors, []);
  const win = windows[0],
    event = { sender: win.webContents, senderFrame: win.webContents.mainFrame };
  const invoke = (name, ...args) => handlers.get(name)(event, ...args);
  return {
    calls,
    handlers,
    ipcMain,
    store,
    event,
    invoke,
    errors,
    win,
    playerSession,
    protocol,
    updateRuntime,
  };
}
test('the assembled host registers exactly the published bridges and keeps sender and argument checks', async (t) => {
  const x = await fixture(t);
  const preload =
    readFileSync('desktop/preload.ts', 'utf8') + readFileSync('desktop/player-preload.ts', 'utf8');
  const published = [...preload.matchAll(/ipcRenderer\.invoke\(\s*'([^']+)'/g)].map((m) => m[1]);
  assert.deepEqual([...x.handlers.keys()].sort(), [...new Set(published)].sort());
  assert.equal(x.win.options.webPreferences.nodeIntegration, false);
  assert.equal(x.win.options.webPreferences.contextIsolation, true);
  assert.equal(x.win.options.webPreferences.sandbox, true);
  const denied = { ok: false, error: 'Zugriff verweigert.' };
  for (const event of [
    { ...x.event, sender: {} },
    { ...x.event, senderFrame: { url: x.event.senderFrame.url } },
    { ...x.event, senderFrame: null },
  ])
    assert.deepEqual(await x.handlers.get('campaign:list')(event), denied);
  x.event.senderFrame.url = 'https://outside.invalid/';
  assert.deepEqual(await x.invoke('campaign:list'), denied);
  x.event.senderFrame.url = 'campaign://app/index.html';
  assert.deepEqual(await x.invoke('player:frame'), denied);
  assert.deepEqual(await x.invoke('player:window', 'token', 'yes'), {
    ok: false,
    error: 'Fensteraktion prüfen.',
  });
  assert.deepEqual(await x.invoke('campaign:select', 'token', 'room'), {
    ok: true,
    value: ['token', 'room'],
  });
  x.store.list = async () => {
    throw Error('Canonical failure');
  };
  assert.deepEqual(await x.invoke('campaign:list'), { ok: false, error: 'Canonical failure' });
  x.store.list = async () => {
    throw null;
  };
  assert.deepEqual(await x.invoke('campaign:list'), {
    ok: false,
    error: 'Vorgang fehlgeschlagen.',
  });
});
test('shutdown rejects new work, drains admitted work and waits for store exit before releasing the runtime', async (t) => {
  const x = await fixture(t),
    read = deferred(),
    exit = deferred();
  x.store.list = () => read.promise;
  x.store.close = () => {
    x.calls.push('store.close');
    return exit.promise;
  };
  const admitted = x.invoke('campaign:list');
  await tick();
  x.ipcMain.emit('campaign:close-ready', { ...x.event, sender: {} });
  await tick();
  assert(!x.calls.includes('store.close'));
  x.ipcMain.emit('campaign:close-ready', x.event);
  await tick();
  assert(!x.calls.includes('store.close'));
  assert.match((await x.invoke('campaign:list')).error, /angehalten/);
  assert.deepEqual(await x.invoke('update:status'), { ok: true, value: { phase: 'idle' } });
  read.resolve({ campaigns: ['saved'] });
  assert.deepEqual(await admitted, { ok: true, value: { campaigns: ['saved'] } });
  await until(() => x.calls.includes('store.close'));
  await tick();
  assert(!x.calls.includes('quit'));
  assert(!x.calls.includes('runtime.close'));
  exit.resolve({ databaseClosed: true, exitCode: 0 });
  await until(() => x.calls.includes('quit'));
  assert.equal(x.handlers.size, 0);
  assert.equal(x.ipcMain.listenerCount('campaign:close-ready'), 0);
  assert.equal(x.protocol.resource, null);
  assert.equal(x.playerSession.resource, null);
  let denied;
  x.playerSession.request({}, (result) => (denied = result.cancel));
  assert.equal(denied, true);
  assert(x.calls.indexOf('store.close') < x.calls.indexOf('runtime.close'));
});
test('update installation is not in its own shutdown drain and hands off only after storage exit', async (t) => {
  const x = await fixture(t);
  const result = await x.invoke('update:install');
  assert.deepEqual(result, { ok: true, value: undefined });
  assert.deepEqual(
    x.calls.filter(
      (c) =>
        ['prepare', 'installing', 'store.close', 'runtime.close', 'quit'].includes(c) ||
        (Array.isArray(c) && c[0] === 'handoff'),
    ),
    ['prepare', 'installing', 'store.close', ['handoff', 'request'], 'runtime.close', 'quit'],
  );
});
test('campaign erasure excludes concurrent file work and blocks newly admitted operations', async (t) => {
  const x = await fixture(t),
    read = deferred(),
    erasure = deferred();
  let erased = 0;
  x.store.list = () => read.promise;
  x.store.campaignCatalog = () => {
    erased++;
    return erasure.promise;
  };
  const busy = x.invoke('campaign:list');
  await tick();
  assert.match(
    (await x.invoke('campaign:catalog', { kind: 'erase', id: 'campaign' })).error,
    /Laufende Vorgänge/,
  );
  assert.equal(erased, 0);
  read.resolve({ campaigns: [] });
  await busy;
  const deleting = x.invoke('campaign:catalog', { kind: 'erase', id: 'campaign' });
  await tick();
  assert.match((await x.invoke('campaign:list')).error, /Kampagnenlöschung läuft/);
  erasure.resolve({ id: 'campaign' });
  assert.equal((await deleting).ok, true);
  assert(x.calls.some((c) => Array.isArray(c) && c[0] === 'erased'));
});
test('an unexpected writer exit remains an explicit warning, not a clean storage acknowledgement', async (t) => {
  const x = await fixture(t);
  x.store.close = async () => ({ databaseClosed: false, exitCode: 9 });
  x.ipcMain.emit('campaign:close-ready', x.event);
  await until(() => x.calls.includes('quit'));
  assert.match(x.errors[0][0], /Speicherprozess unerwartet beendet/);
  assert.match(x.errors[0][1], /Speicherbestätigungen bleiben ungeklärt/);
});
test('failed update preparation leaves normal IPC usable and does not close the writer', async (t) => {
  const x = await fixture(t);
  x.updateRuntime.prepare = async () => {
    throw Error('Profile lock unavailable');
  };
  assert.deepEqual(await x.invoke('update:install'), {
    ok: false,
    error: 'Profile lock unavailable',
  });
  assert(!x.calls.includes('store.close'));
  assert.deepEqual(await x.invoke('campaign:list'), { ok: true, value: { campaigns: [] } });
});

test('host startup waits for readiness beyond a fixed number of event-loop turns', async (t) => {
  const ready = deferred();
  let settled = false;
  const opening = fixture(t, { ready: ready.promise });
  // Attach both outcomes immediately so a premature rejection is observable, not unhandled.
  void opening.then(
    () => {
      settled = true;
    },
    () => {
      settled = true;
    },
  );
  try {
    for (let i = 0; i < 200; i++) await tick();
    assert.equal(settled, false);
  } finally {
    ready.resolve();
  }
  const x = await opening;
  assert(x.calls.includes('loaded'));
  assert.deepEqual(await x.invoke('campaign:list'), { ok: true, value: { campaigns: [] } });
});

test('startup failure has already registered cleanup and restores the surrounding process', async () => {
  const cleanup = [],
    argv = process.argv,
    previous = globalThis.__hostFixture;
  await assert.rejects(
    fixture(
      { after: (hook) => cleanup.push(hook) },
      {
        ready: Promise.reject(Error('Controlled startup failure')),
      },
    ),
  );
  assert.equal(cleanup.length, 1);
  for (const close of cleanup) await close();
  assert.equal(process.argv, argv);
  assert.equal(globalThis.__hostFixture, previous);
});
