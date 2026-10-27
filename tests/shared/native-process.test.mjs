import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, writeFile, readFile, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  bounded,
  observeExit,
  pidAbsent,
  stopOwnedChild,
  ownsProfile,
  nativeRuntimeArtifacts,
} from '../../tools/native-process.mjs';
import { createNativeSession, assertNativeCompletion } from '../../tools/native-session.mjs';
async function child(t, stubborn = false) {
  const p = spawn(
    process.execPath,
    [
      '-e',
      `${stubborn ? 'process.on("SIGTERM",()=>{});' : ''}console.log('ready');setInterval(()=>{},1000);`,
    ],
    { stdio: ['ignore', 'pipe', 'pipe'] },
  );
  t.after(async () => {
    if (p.exitCode === null && p.signalCode === null) {
      p.kill('SIGKILL');
      await observeExit(p);
    }
  });
  await once(p.stdout, 'data');
  return p;
}
test('cleanup awaits the actual registered process exit and PID disappearance', async (t) => {
  const p = await child(t);
  const result = await stopOwnedChild(p);
  assert.equal(result.pidAbsent, true);
  assert.equal(result.forced, false);
  assert.equal(result.exit.signal, 'SIGTERM');
  await pidAbsent(p.pid);
});
test('bounded emergency escalation is recorded and cannot pass normal qualification', async (t) => {
  const p = await child(t, true);
  const result = await stopOwnedChild(p, { timeout: 100 });
  assert.equal(result.forced, true);
  assert.equal(result.exit.signal, 'SIGKILL');
  assert.throws(() => assertNativeCompletion([result], []));
});
test('refused ownership leaves the process untouched', async (t) => {
  const p = await child(t);
  await assert.rejects(stopOwnedChild(p, { owns: async () => false }), /ownership/);
  assert.equal(p.exitCode, null);
  assert.equal(p.signalCode, null);
  assert.equal(await ownsProfile(p, '/not-this-process'), false);
});
test('already exited processes and bounded waits are handled without hanging', async () => {
  const p = spawn(process.execPath, ['-e', 'process.exit(0)']);
  await observeExit(p);
  const result = await stopOwnedChild(p);
  assert.equal(result.exit.code, 0);
  assert.equal(result.pidAbsent, true);
  await assert.rejects(bounded(new Promise(() => {}), 10, 'deadline'), /deadline/);
});
test('native setup invalidates stale success and disposal forbids later launch', async (t) => {
  const output = await mkdtemp(path.join(tmpdir(), 'native-evidence-'));
  t.after(() => rm(output, { recursive: true, force: true }));
  await writeFile(path.join(output, 'result.json'), 'old success');
  // Pure lifecycle setup does not depend on a previously built desktop.
  await mkdir('.build', { recursive: true });
  const root = await mkdtemp(path.join(process.cwd(), '.build/native-process-fixture-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, '.build/desktop/ui'), { recursive: true });
  for (const file of nativeRuntimeArtifacts)
    await writeFile(path.join(root, '.build/desktop', file), 'lifecycle fixture');
  const session = await createNativeSession({ root, output, name: 'session-lifecycle-test' });
  await assert.rejects(readFile(path.join(output, 'result.json')), { code: 'ENOENT' });
  const disposal = session.dispose();
  assert.equal(session.dispose(), disposal);
  await disposal;
  await assert.rejects(session.finish(), /No native launches/);
  await assert.rejects(session.launch(), /disposed/);
  assert.equal(session.starts.length, 1);
  assert.equal(session.starts[0].outcome, 'failed');
  await assert.rejects(session.finish(), /Every requested native start must complete/);
});

test('Electron-style rewritten argv still requires the exact registered profile', async (t) => {
  const profile = '/tmp/owned-native-title-test';
  const p = spawn(
    process.execPath,
    [
      '-e',
      `process.title='electron --data-dir /runtime/main.cjs ${profile}';console.log('ready');setInterval(()=>{},1000);`,
    ],
    { stdio: ['ignore', 'pipe', 'pipe'] },
  );
  t.after(async () => {
    if (p.exitCode === null && p.signalCode === null) {
      p.kill('SIGKILL');
      await observeExit(p);
    }
  });
  await once(p.stdout, 'data');
  assert.equal(await ownsProfile(p, profile), true);
  assert.equal(await ownsProfile(p, '/tmp/owned-native'), false);
  const { registerOwnedPid, stopRegisteredPid } = await import('../../tools/native-process.mjs');
  await assert.rejects(registerOwnedPid(p.pid, profile + '-other'), /ownership/);
  const owner = await registerOwnedPid(p.pid, profile);
  assert.equal((await stopRegisteredPid(owner)).pidAbsent, true);
});

test('outer UI owner invalidates registered success after a leak or later abort', async (t) => {
  const { spawnSync } = await import('node:child_process');
  const output = await mkdtemp(path.join(tmpdir(), 'native-wrapper-'));
  t.after(() => rm(output, { recursive: true, force: true }));
  const foreign = await child(t);
  const module = new URL('../../tools/native-process.mjs', import.meta.url).href;
  for (const mode of ['pass', 'leak', 'abort']) {
    const result = path.join(output, mode + '.json');
    const code = `
      import {registerNativeEvidence} from ${JSON.stringify(module)};
      import {writeFile} from 'node:fs/promises';
      import {spawn} from 'node:child_process';
      await registerNativeEvidence(${JSON.stringify(result)});
      await writeFile(${JSON.stringify(result)},JSON.stringify({passed:true}));
      ${mode === 'leak' ? "spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{detached:true,stdio:'ignore'}).unref();" : ''}
      ${mode === 'abort' ? "throw Error('intentional post-success abort');" : ''}
    `;
    const run = spawnSync(
      'python3',
      ['tools/ui-session.py', process.execPath, '--input-type=module', '-e', code],
      {
        encoding: 'utf8',
        timeout: 15000,
      },
    );
    assert.equal(run.error, undefined);
    if (mode === 'pass') {
      assert.equal(run.status, 0, run.stderr);
      assert.deepEqual(JSON.parse(await readFile(result, 'utf8')), { passed: true });
    } else {
      assert.notEqual(run.status, 0);
      await assert.rejects(readFile(result), { code: 'ENOENT' });
      assert(
        JSON.parse(await readFile(path.join(output, 'wrapper-failure.json'), 'utf8')).exitCode,
      );
    }
    assert.equal(foreign.exitCode, null, 'Outer cleanup must preserve an unrelated process');
  }
});

test('repeated interruption cannot abort the outer owner during child cleanup', async (t) => {
  const output = await mkdtemp(path.join(tmpdir(), 'native-repeat-interrupt-'));
  t.after(() => rm(output, { recursive: true, force: true }));
  const foreign = await child(t),
    result = path.join(output, 'custom-success.json');
  const module = new URL('../../tools/native-process.mjs', import.meta.url).href;
  const code = `
    import {registerNativeEvidence} from ${JSON.stringify(module)};
    import {writeFile} from 'node:fs/promises';
    process.on('SIGTERM',()=>{});
    await registerNativeEvidence(${JSON.stringify(result)});
    await writeFile(${JSON.stringify(result)},'{"passed":true}');
    console.log(process.pid);setInterval(()=>{},1000);
  `;
  const wrapper = spawn(
      'python3',
      ['tools/ui-session.py', process.execPath, '--input-type=module', '-e', code],
      {
        env: { ...process.env, QA_EVIDENCE_DIR: output },
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    ),
    ended = observeExit(wrapper);
  const identity = async (pid) => {
    const stat = await readFile('/proc/' + pid + '/stat', 'utf8');
    return stat.slice(stat.lastIndexOf(')') + 2).split(' ')[19];
  };
  let ownedPid, ownedIdentity;
  try {
    ownedPid = Number(
      (await bounded(once(wrapper.stdout, 'data'), 5000, 'Owned fixture did not start'))[0]
        .toString()
        .trim(),
    );
    ownedIdentity = await identity(ownedPid);
    assert(Number.isSafeInteger(ownedPid));
    wrapper.kill('SIGTERM');
    await new Promise((resolve) => setTimeout(resolve, 50));
    assert.equal(wrapper.exitCode, null, 'Owner must still await its stubborn child');
    wrapper.kill('SIGTERM');
    assert.deepEqual(await bounded(ended, 15000, 'Interrupted owner did not finish cleanup'), {
      code: 130,
      signal: null,
    });
    await pidAbsent(ownedPid);
    await pidAbsent(wrapper.pid);
    await assert.rejects(readFile(result), { code: 'ENOENT' });
    assert.deepEqual(
      JSON.parse(await readFile(path.join(output, 'wrapper-failure.json'), 'utf8'))
        .remainingOwnedPids,
      [],
    );
    assert.equal(foreign.exitCode, null);
  } finally {
    await stopOwnedChild(wrapper, { timeout: 10000 });
    if (ownedPid) {
      try {
        await pidAbsent(ownedPid, 1);
      } catch {
        assert.equal(
          await identity(ownedPid),
          ownedIdentity,
          'Refuse cleanup after fixture PID reuse',
        );
        process.kill(ownedPid, 'SIGKILL');
        await pidAbsent(ownedPid);
      }
    }
  }
});
