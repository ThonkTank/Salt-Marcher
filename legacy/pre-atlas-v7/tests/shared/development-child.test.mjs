import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { PassThrough, Writable } from 'node:stream';
import { launchDevelopmentChild } from '../../tools/development-child.mjs';

async function fixture({ databaseClosed = true, code = 0 } = {}) {
  const commands = [],
    child = new EventEmitter();
  child.pid = 123;
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();
  child.stdin = new Writable({
    write(bytes, _encoding, done) {
      const message = JSON.parse(bytes.toString());
      commands.push(message);
      child.stdout.write('SALTMARCHER_DEV ' + JSON.stringify({ id: message.id, ok: true }) + '\n');
      if (message.action === 'close')
        queueMicrotask(() => {
          child.stdout.write(
            'SALTMARCHER_DEV ' + JSON.stringify({ event: 'closed', databaseClosed }) + '\n',
          );
          child.emit('close', code, null);
        });
      done();
    },
  });
  const session = await launchDevelopmentChild({
    root: process.cwd(),
    runtime: '/isolated/runtime',
    dataDir: '/isolated/profile',
    launch: async (launch) => {
      assert.deepEqual(launch.args, [
        '/isolated/runtime/main.cjs',
        '--data-dir',
        '/isolated/profile',
      ]);
      assert.match(launch.env.SALTMARCHER_DEV_TOKEN, /^[a-f0-9]{64}$/);
      assert.match(launch.env.NODE_OPTIONS, /--enable-source-maps/);
      assert.equal(commands.length, 0, 'No command is sent before the application is ready');
      setImmediate(() =>
        child.stdout.write(
          'SALTMARCHER_DEV ' + JSON.stringify({ event: 'ready', pid: child.pid }) + '\n',
        ),
      );
      return child;
    },
    log: () => {},
  });
  await session.ready;
  return { session, commands };
}

test('development control uses inherited pipes and requires explicit normal database closure', async () => {
  const { session, commands } = await fixture();
  await session.styles(['app.css']);
  assert.deepEqual(await session.close(), { code: 0, signal: null, safeClose: true });
  assert.deepEqual(
    commands.map((c) => c.action),
    ['styles', 'close'],
  );
  assert(commands.every((c) => c.kind === 'saltmarcher-dev' && c.token === commands[0].token));
});
test('unconfirmed storage closure prohibits automatic restart even with exit zero', async () => {
  const { session } = await fixture({ databaseClosed: false });
  await assert.rejects(session.close(), /did not confirm a normal store close/);
});
test('abnormal process exit prohibits automatic restart even after a database acknowledgement', async () => {
  const { session } = await fixture({ code: 1 });
  await assert.rejects(session.close(), /did not confirm a normal store close/);
});
