import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
const output = await mkdtemp(path.resolve('.build/error-diagnostics-'));
await build({
  stdin: {
    contents:
      "export * from './desktop/error-diagnostics';export * from './desktop/store-client';export * from './desktop/host-ipc';",
    resolveDir: process.cwd(),
  },
  outfile: path.join(output, 'api.cjs'),
  bundle: true,
  platform: 'node',
  format: 'cjs',
});
await build({
  entryPoints: ['desktop/store-worker.ts'],
  outfile: path.join(output, 'worker.cjs'),
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
  plugins: [
    {
      name: 'controlled-storage-boundary',
      setup(build) {
        build.onResolve({ filter: /^\.\.\/src\/app\/storage\/store$/ }, () => ({
          path: path.resolve('tests/helpers/error-diagnostic-store.ts'),
        }));
      },
    },
  ],
});
const require = createRequire(import.meta.url),
  {
    errorDiagnostic,
    remoteStoreError,
    reportError,
    HostIpc,
    StoreClient,
    StoreOutcomeUnknownError,
  } = require(path.join(output, 'api.cjs'));
test.after(() => rm(output, { recursive: true, force: true }));
async function clientFixture(t, version = 'test') {
  const filename = path.join(output, 'store-' + Math.random());
  const client = new StoreClient(filename, version, path.join(output, 'worker.cjs'));
  t.after(() => client.close());
  await client.ready;
  return { client, filename };
}
function host(operation, sink, syncPlayer = async () => {}, channel = 'campaign:create') {
  let invoke;
  const contents = { mainFrame: { url: 'campaign://app/index.html' } };
  const host = new HostIpc(
    {
      handle(_name, callback) {
        invoke = callback;
      },
      removeHandler() {},
    },
    {
      contents: () => contents,
      origin: contents.mainFrame.url,
      stopping: () => false,
      erasing: () => false,
      syncPlayer,
    },
    sink,
  );
  host.scope().handle(channel, operation);
  return {
    invoke: (...args) => invoke({ sender: contents, senderFrame: contents.mainFrame }, ...args),
    host,
  };
}
test('bounded clone-safe diagnostics retain causes without evaluating arbitrary properties', () => {
  const root = Object.assign(new TypeError('inner'), { code: 'SQLITE_BUSY' }),
    outer = new Error('outer', { cause: root });
  const d = structuredClone(
    errorDiagnostic(outer, { phase: 'store-operation', method: 'create', requestId: 7 }),
  );
  assert.equal(d.cause.name, 'TypeError');
  assert.equal(d.cause.code, 'SQLITE_BUSY');
  assert.match(d.cause.stack, /desktop-error-diagnostics/);
  assert.equal(remoteStoreError('visible', d).message, 'visible');
  outer.cause = outer;
  assert.equal(errorDiagnostic(outer).cause.truncated, true);
  const huge = errorDiagnostic(new Error('x'.repeat(1000000)));
  assert(huge.message.length < 4200);
  assert(huge.stack.length < 16500);
  assert(huge.truncated);
  const hostile = new Proxy(
    {},
    {
      get() {
        throw Error('getter');
      },
      getOwnPropertyDescriptor() {
        throw Error('descriptor');
      },
    },
  );
  assert.doesNotThrow(() => structuredClone(errorDiagnostic(hostile)));
  assert.equal(errorDiagnostic(null).message, 'null');
  let attached = {};
  for (let i = 0; i < 1000; i++)
    attached = { [Symbol.for('saltmarcher.internal.error-diagnostic')]: attached };
  assert.doesNotThrow(() => structuredClone(errorDiagnostic(attached)));
  let chain = new Error('root');
  for (let i = 0; i < 30; i++) chain = new Error('x'.repeat(10000), { cause: chain });
  const bounded = JSON.stringify(errorDiagnostic(chain));
  assert(bounded.length < 110000);
  assert(bounded.includes('Further cause omitted.'));
  let accessed = false;
  assert.equal(
    errorDiagnostic({
      get message() {
        accessed = true;
        throw Error();
      },
    }).name,
    'ThrownValue',
  );
  assert.equal(accessed, false);
});
test('real worker rejection reaches host diagnostics but renderer receives exactly the original message', async (t) => {
  const { client } = await clientFixture(t),
    records = [];
  const { invoke, host: ipc } = host(
    (name) => client.create(name),
    (record) => records.push(record),
  );
  assert.deepEqual(await invoke('reject'), { ok: false, error: 'Canonical rejection' });
  assert.equal(ipc.activeCount, 0);
  assert.equal(records.length, 1);
  const d = records[0].error;
  assert.equal(records[0].context.channel, 'campaign:create');
  assert.equal(d.name, 'FixtureStoreError');
  assert.equal(d.code, 'STORE_CODE');
  assert.equal(d.cause.name, 'TypeError');
  assert.equal(d.cause.code, 'ROOT_CODE');
  assert.match(d.stack, /worker.cjs/);
  assert.equal(d.context.method, 'create');
  assert.equal(d.context.requestId, 1);
  assert(!JSON.stringify(records).includes('arguments'));
  assert.deepEqual(await invoke('string'), { ok: false, error: 'plain rejection' });
  assert.deepEqual(await invoke('hostile'), { ok: false, error: 'Vorgang fehlgeschlagen.' });
  assert.deepEqual(await client.list(), { campaigns: [] });
});
test('diagnostic sink failure cannot replace user response or prevent drain', async () => {
  const { invoke, host: ipc } = host(
    () => {
      throw Error('Original message');
    },
    () => {
      throw Error('sink failure');
    },
  );
  assert.deepEqual(await invoke('private argument'), { ok: false, error: 'Original message' });
  await ipc.drain();
  assert.equal(ipc.activeCount, 0);
  assert.doesNotThrow(() =>
    reportError(new Error('original'), { phase: 'test' }, () => {
      throw Error();
    }),
  );
});
test('untransferable post-write result remains unknown with original cause and exactly one dispatch', async (t) => {
  const { client, filename } = await clientFixture(t);
  await assert.rejects(client.create('unserializable'), (error) => {
    assert(error instanceof StoreOutcomeUnknownError);
    const d = errorDiagnostic(error);
    assert.equal(d.cause.context.phase, 'store-result-encode');
    assert.equal(d.cause.context.method, 'create');
    assert.match(d.cause.stack, /encodeStoreValue/);
    return true;
  });
  assert.equal(await readFile(filename + '.attempts', 'utf8'), 'write\n');
});
test('worker startup and shutdown failures retain their remote origin', async (t) => {
  const client = new StoreClient(
    path.join(output, 'startup'),
    'startup-error',
    path.join(output, 'worker.cjs'),
  );
  t.after(() => client.close());
  await assert.rejects(client.ready, (error) => {
    assert(error instanceof StoreOutcomeUnknownError);
    const d = errorDiagnostic(error).cause;
    assert.match(d.stack, /worker.cjs/);
    assert.equal(d.name, 'FixtureStoreError');
    assert.equal(d.code, 'STORE_CODE');
    assert.equal(d.context.phase, 'store-start');
    assert.equal(d.cause.code, 'ROOT_CODE');
    return true;
  });
  assert.equal((await client.close()).databaseClosed, false);
  const { client: closing } = await clientFixture(t, 'close-error');
  let failure;
  closing.on('failure', (error) => (failure = error));
  assert.equal((await closing.close()).databaseClosed, false);
  assert.equal(errorDiagnostic(failure).cause.context.phase, 'store-close');
  assert.equal(errorDiagnostic(failure).cause.cause.message, 'Root detail');
});
test('worker exit remains terminal and preserves pending request context without replay', async (t) => {
  const { client, filename } = await clientFixture(t);
  await assert.rejects(client.create('exit'), (error) => {
    assert(error instanceof StoreOutcomeUnknownError);
    const d = errorDiagnostic(error);
    assert.equal(d.context.method, 'create');
    assert.equal(d.context.requestId, 1);
    assert.equal(d.cause.code, 23);
    return true;
  });
  await assert.rejects(client.list(), StoreOutcomeUnknownError);
  assert.equal(await readFile(filename + '.attempts', 'utf8'), 'write\n');
});

test('failure of post-operation player projection is diagnosed separately without repeating the operation', async () => {
  let executions = 0;
  const records = [];
  const { invoke } = host(
    () => {
      executions++;
      return 'committed';
    },
    (record) => records.push(record),
    async () => {
      throw new Error('Projection failed');
    },
    'campaign:execute',
  );
  assert.deepEqual(await invoke(), { ok: false, error: 'Projection failed' });
  assert.equal(executions, 1);
  assert.equal(records[0].context.phase, 'player-sync');
});
test('local input encoding failure retains its source and never dispatches a worker write', async (t) => {
  const { client, filename } = await clientFixture(t);
  await assert.rejects(
    client.create(() => {}),
    (error) => {
      const d = errorDiagnostic(error);
      assert.equal(d.context.phase, 'store-call-encode');
      assert.equal(d.context.method, 'create');
      assert.match(d.stack, /encodeStoreValue/);
      return true;
    },
  );
  await assert.rejects(readFile(filename + '.attempts'), { code: 'ENOENT' });
});

test('malformed worker result retains the decoder cause and request context without replay', async (t) => {
  const filename = path.join(output, 'decode');
  const client = new StoreClient(
    filename,
    'test',
    path.resolve('tests/helpers/error-diagnostic-wire-worker.mjs'),
  );
  t.after(() => client.close());
  await client.ready;
  await assert.rejects(client.create('ignored'), (error) => {
    assert(error instanceof StoreOutcomeUnknownError);
    const d = errorDiagnostic(error);
    assert.equal(d.context.phase, 'store-result-decode');
    assert.equal(d.context.method, 'create');
    assert.equal(d.context.requestId, 1);
    assert.match(d.cause.stack, /decodeStoreValue/);
    return true;
  });
  assert.equal(await readFile(filename + '.attempts', 'utf8'), 'write\n');
});
test('synchronous send failure preserves native cause and leaves no pending request', async () => {
  const outfile = path.join(output, 'send-client.cjs');
  await build({
    entryPoints: ['desktop/store-client.ts'],
    outfile,
    bundle: true,
    platform: 'node',
    format: 'cjs',
    plugins: [
      {
        name: 'throwing-worker-port',
        setup(build) {
          build.onResolve({ filter: /^node:worker_threads$/ }, () => ({
            path: 'port',
            namespace: 'fixture',
          }));
          build.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({
            contents: `import {EventEmitter} from 'node:events';export class Worker extends EventEmitter{constructor(){super();queueMicrotask(()=>this.emit('message',{kind:'ready'}));}postMessage(message){if(message.kind==='close'){queueMicrotask(()=>{this.emit('message',{kind:'closed'});this.emit('exit',0);});return;}throw new RangeError('Port send failure',{cause:new Error('Original port cause')});}}`,
          }));
        },
      },
    ],
  });
  const { StoreClient: SendClient, StoreOutcomeUnknownError: SendUnknown } = require(outfile);
  const client = new SendClient('unused', 'test');
  await client.ready;
  await assert.rejects(client.create('private argument'), (error) => {
    assert(error instanceof SendUnknown);
    const d = errorDiagnostic(error);
    assert.equal(d.context.phase, 'store-call-send');
    assert.equal(d.context.requestId, 1);
    assert.equal(d.cause.name, 'RangeError');
    assert.equal(d.cause.cause.message, 'Original port cause');
    assert(!JSON.stringify(d).includes('private argument'));
    return true;
  });
  assert.deepEqual(await client.close(), { databaseClosed: true, exitCode: 0 });
});
