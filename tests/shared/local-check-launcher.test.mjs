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

// These counterexamples use the actual launcher, process/signal protocol and CLI.
// Only systemd's unavailable queue is substituted; the command cannot run as fallback.
import { mkdtempSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
function systemdFixture(t, program) {
  const dir = mkdtempSync(path.join(tmpdir(), 'local-check-systemd-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  for (const [name, code] of Object.entries({
    'systemd-run': program,
    systemctl: `import{appendFileSync}from'node:fs';appendFileSync(${JSON.stringify(path.join(dir, 'controls'))},JSON.stringify(process.argv.slice(2))+'\\n');if(process.argv.includes('show'))console.log('12345');`,
  }))
    writeFileSync(path.join(dir, name), '#!' + process.execPath + '\n' + code, { mode: 0o700 });
  return { dir, env: { ...process.env, CI: '', PATH: dir + ':' + process.env.PATH } };
}
function forcedScope(fixture, startupMs = 100) {
  return spawnSync(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      `
    import {runLocalCheck} from './tools/run-local-check.mjs';
    const result = await runLocalCheck(process.execPath,['-e',${JSON.stringify("require('node:fs').writeFileSync('" + fixture.dir + "/unbounded-command','bad')")}],{ci:false,backend:'systemd',startupMs:${startupMs}});
    console.log('RESULT:'+JSON.stringify(result));process.exitCode=result.code??1;
  `,
    ],
    { encoding: 'utf8', env: fixture.env, timeout: 5000 },
  );
}
test(
  'scope startup timeout cancels its pending job, terminates launcher and never starts fallback',
  { skip: process.platform !== 'linux' },
  (t) => {
    const fixture = systemdFixture(t, 'setInterval(()=>{},1000);');
    const result = forcedScope(fixture);
    assert.equal(result.status, 1, result.stderr);
    assert.match(result.stderr, /did not start within 100 ms/);
    assert.equal(existsSync(path.join(fixture.dir, 'unbounded-command')), false);
    const calls = readFileSync(path.join(fixture.dir, 'controls'), 'utf8')
      .trim()
      .split('\n')
      .map(JSON.parse);
    assert.ok(calls.some((args) => args.includes('cancel') && args.includes('12345')));
    assert.ok(
      calls
        .filter((args) => args.includes('kill'))
        .every((args) => args.some((arg) => /^salt-check-[0-9a-f-]+\.scope$/.test(arg))),
    );
  },
);
test(
  'scope start error preserves failure and does not execute the command elsewhere',
  { skip: process.platform !== 'linux' },
  (t) => {
    const fixture = systemdFixture(
      t,
      "console.error('counterexample: systemd rejected scope');process.exit(23);",
    );
    const result = forcedScope(fixture, 1000);
    assert.equal(result.status, 23, result.stderr);
    assert.match(result.stderr, /systemd rejected scope/);
    assert.equal(existsSync(path.join(fixture.dir, 'unbounded-command')), false);
  },
);
test('bounded entry refuses an unverified cgroup before launching the command', (t) => {
  const dir = mkdtempSync(path.join(tmpdir(), 'local-check-entry-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  // A nonexistent membership target fails before the command, independent of host delegation.
  const result = spawnSync(
    process.execPath,
    [
      'tools/run-local-check.mjs',
      '--bounded-entry',
      path.join(dir, 'missing'),
      path.join(dir, 'started.json'),
      process.execPath,
      '-e',
      `require('node:fs').writeFileSync(${JSON.stringify(path.join(dir, 'ran'))},'bad')`,
    ],
    { encoding: 'utf8' },
  );
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /ENOENT/);
  assert.equal(existsSync(path.join(dir, 'ran')), false);
});

test(
  'a scope launcher cannot report success without a verified bounded entry',
  { skip: process.platform !== 'linux' },
  (t) => {
    const fixture = systemdFixture(t, 'process.exit(0);');
    const result = forcedScope(fixture, 1000);
    assert.equal(result.status, 1, result.stderr);
    assert.match(result.stdout, /before confirming bounded command startup/);
    assert.equal(existsSync(path.join(fixture.dir, 'unbounded-command')), false);
  },
);
