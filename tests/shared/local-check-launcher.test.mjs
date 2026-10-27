import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
const run = (code) =>
  spawnSync(process.execPath, ['tools/run-local-check.mjs', process.execPath, '-e', code], {
    encoding: 'utf8',
    env: { ...process.env, CI: '1' },
  });
test('portable launcher preserves child exit status', () =>
  assert.equal(run('process.exit(17)').status, 17));
test('portable launcher preserves child termination signal', () =>
  assert.equal(run("process.kill(process.pid,'SIGTERM')").signal, 'SIGTERM'));
test('missing executable fails without fallback', () => {
  const result = spawnSync(
    process.execPath,
    ['tools/run-local-check.mjs', '/nonexistent/salt-check-command'],
    { encoding: 'utf8', env: { ...process.env, CI: '1' } },
  );
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /ENOENT/);
});
