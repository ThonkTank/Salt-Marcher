// Real-process negative-path qualification for the common native lifecycle.
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { bounded, observeExit, pidAbsent, stopOwnedChild, ownsProfile } from './native-process.mjs';
import path from 'node:path';
import { createNativeSession, runNativeProbe } from './native-session.mjs';
const output = process.env.QA_EVIDENCE_DIR ?? path.resolve('.build/native-session-check');
await mkdir(output, { recursive: true });
await rm(path.join(output, 'result.json'), { force: true });
const cases = [];
async function rejected(name, scenario, pattern) {
  const folder = path.join(output, name);
  await mkdir(folder, { recursive: true });
  await writeFile(path.join(folder, 'result.json'), 'stale success');
  await assert.rejects(
    runNativeProbe({ output: folder, name: 'lifecycle-' + name }, scenario),
    pattern,
  );
  await assert.rejects(readFile(path.join(folder, 'result.json')), { code: 'ENOENT' });
  const failure = JSON.parse(await readFile(path.join(folder, 'failure.json'), 'utf8'));
  assert(failure.error);
  for (const entry of [
    ...(failure.starts ?? []),
    ...(failure.launches ?? []),
    ...(failure.cleanup ?? []),
  ])
    if (entry.pid) await pidAbsent(entry.pid);
  cases.push({ name, successAbsent: true, failureRecorded: true, ownedProcessesAbsent: true });
  return failure;
}
await rejected(
  'fixture',
  async () => {
    throw Error('fixture rejected');
  },
  /fixture rejected/,
);
const failedStart = async (native) => {
  await native.launchConfigured({
    args: [
      path.resolve('.build/desktop/main.cjs'),
      '--ozone-platform=x11',
      '--data-dir',
      native.profile,
    ],
    env: { DISPLAY: ':65534', WAYLAND_DISPLAY: 'saltmarcher-missing-display' },
    timeout: 3000,
  });
};
await rejected('launch', failedStart, /launch|closed|display|Timeout/i);
await rejected(
  'proxy',
  async (native) => {
    const previousPath = process.env.PATH;
    try {
      process.env.PATH = path.join(native.profile, 'missing-executable-directory');
      await native.launch();
    } finally {
      process.env.PATH = previousPath;
    }
  },
  /proxy|ENOENT/,
);
await rejected(
  'proxy-exit',
  async (native) => {
    await native.launch();
    await native.close();
    const pid = native.processes.bus;
    assert(Number.isSafeInteger(pid));
    process.kill(pid, 'SIGTERM');
    await pidAbsent(pid);
  },
  /Native bus proxy/,
);
await rejected(
  'unexpected-exit',
  async (native) => {
    await native.launch();
    const child = native.app.process(),
      ended = observeExit(child);
    await native.app
      .evaluate(({ app }) => {
        app.exit(17);
      })
      .catch(() => {});
    assert.deepEqual(await ended, { code: 17, signal: null });
    await pidAbsent(child.pid);
  },
  /Close all native windows|Every launch/,
);
await rejected(
  'close-timeout',
  async (native) => {
    await native.launch();
    await native.app.evaluate(({ BrowserWindow }) => {
      BrowserWindow.getAllWindows()
        .find((w) => w.webContents.getURL().endsWith('/index.html'))
        .on('close', (e) => e.preventDefault());
    });
    await native.close();
  },
  /Normal close timed out/,
);
await rejected(
  'restart',
  async (native) => {
    await native.launch();
    await native.close();
    await failedStart(native);
  },
  /launch|closed|display|Timeout/i,
);
const caughtRestart = await rejected(
  'caught-restart',
  async (native) => {
    await native.launch();
    await native.close();
    await failedStart(native).catch(() => {});
  },
  /Every requested native start must complete/,
);
assert.equal(caughtRestart.starts.length, 2);
assert.deepEqual(
  caughtRestart.starts.map((attempt) => attempt.outcome),
  ['ready', 'failed'],
);
const late = await rejected(
  'post-close',
  async (native) => {
    await native.launch();
    await native.close();
    throw Error('post-close assertion');
  },
  /post-close assertion/,
);
assert.equal(late.launches.length, 1);
assert.equal(late.launches[0].pidAbsent, true);
await rejected(
  'renderer',
  async (native) => {
    const page = await native.launch();
    await page.evaluate(() => {
      setTimeout(() => {
        throw Error('intentional native renderer failure');
      }, 0);
    });
    for (let i = 0; i < 100 && !native.errors.length; i++)
      await new Promise((resolve) => setTimeout(resolve, 20));
    assert(native.errors.length);
    await native.close();
  },
  /Renderer errors/,
);
const forced = await rejected(
  'emergency',
  async (native) => {
    await native.launch();
    await native.dispose();
  },
  /Every launch must close normally|Closed native PID must be absent/,
);
assert(forced.cleanup.some((item) => item.kind === 'electron' && item.pidAbsent));
const killed = await rejected(
  'emergency-kill',
  async (native) => {
    await native.launch();
    await native.app.evaluate(({ app, BrowserWindow }) => {
      process.on('SIGTERM', () => {});
      app.on('before-quit', (event) => event.preventDefault());
      for (const window of BrowserWindow.getAllWindows())
        window.on('close', (event) => event.preventDefault());
    });
    await native.dispose();
  },
  /Every launch must close normally|Closed native PID must be absent|Emergency cleanup/,
);
assert(
  killed.cleanup.some(
    (item) =>
      item.kind === 'electron' && item.forced && item.pidAbsent && item.exit.signal === 'SIGKILL',
  ),
);
async function baselineAbort() {
  const folder = path.join(output, 'orchestrator-abort');
  await mkdir(folder, { recursive: true });
  await writeFile(path.join(folder, 'result.json'), 'stale success');
  const child = spawn(process.execPath, ['tools/test-desktop-baseline.mjs'], {
      env: { ...process.env, QA_EVIDENCE_DIR: folder, GM_QA_OUT: folder },
      stdio: ['ignore', 'pipe', 'pipe'],
    }),
    ended = observeExit(child);
  let logs = '',
    wrapper;
  child.stderr.on('data', (chunk) => {
    logs += chunk;
  });
  const ready = new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', () => reject(Error('Baseline ended before native window: ' + logs)));
    child.stdout.on('data', (chunk) => {
      logs += chunk;
      if (logs.includes('[native window ready]')) resolve();
    });
  });
  const identity = async (pid) => {
    const stat = await readFile('/proc/' + pid + '/stat', 'utf8');
    return stat.slice(stat.lastIndexOf(')') + 2).split(' ')[19];
  };
  try {
    await bounded(ready, 60000, 'Baseline child did not reach a native window');
    const receipt = JSON.parse(await readFile(path.join(folder, 'active-wrapper.json'), 'utf8'));
    wrapper = { pid: receipt.pid, identity: await identity(receipt.pid) };
    child.kill('SIGTERM');
    assert.deepEqual(await bounded(ended, 20000, 'Baseline abort did not finish'), {
      code: 1,
      signal: null,
    });
    await pidAbsent(child.pid);
    await assert.rejects(readFile(path.join(folder, 'result.json')), { code: 'ENOENT' });
    const failure = JSON.parse(await readFile(path.join(folder, 'failure.json'), 'utf8'));
    assert.equal(failure.interrupted, 'SIGTERM');
    assert(failure.wrappers.length);
    for (const owned of failure.wrappers) await pidAbsent(owned.pid);
    const cleanup = JSON.parse(
      await readFile(path.join(folder, 'rooms/wrapper-failure.json'), 'utf8'),
    );
    assert.deepEqual(cleanup.remainingOwnedPids, []);
    for (const pid of cleanup.leakedOwnedPids) await pidAbsent(pid);
    cases.push({
      name: 'orchestrator-abort',
      successAbsent: true,
      failureRecorded: true,
      ownedProcessesAbsent: true,
    });
  } finally {
    await stopOwnedChild(child, { timeout: 15000 });
    if (wrapper) {
      try {
        await pidAbsent(wrapper.pid, 1);
      } catch {
        assert.equal(
          await identity(wrapper.pid),
          wrapper.identity,
          'Refuse cleanup after wrapper PID reuse',
        );
        process.kill(wrapper.pid, 'SIGTERM');
        await pidAbsent(wrapper.pid, 15000);
      }
    }
    await writeFile(path.join(folder, 'run.log'), logs);
  }
}
// The lifecycle owns only its recorded children; an unrelated live process survives.
const foreign = spawn(process.execPath, ['-e', "console.log('ready');setInterval(()=>{},1000)"], {
  stdio: ['ignore', 'pipe', 'ignore'],
});
await once(foreign.stdout, 'data');
try {
  await rejected(
    'foreign-preserved',
    async (native) => {
      await native.launch();
      throw Error('preserve foreign');
    },
    /preserve foreign/,
  );
  await baselineAbort();
  assert.equal(foreign.exitCode, null);
  assert.equal(foreign.signalCode, null);
  process.kill(foreign.pid, 0);
} finally {
  await stopOwnedChild(foreign);
}

// Existing manual session clients report the error before finally/dispose.
// Their final failure must still contain the fully awaited cleanup receipts.
{
  const name = 'manual-session-failure',
    folder = path.join(output, name);
  const native = await createNativeSession({ output: folder, name: 'lifecycle-manual-failure' });
  try {
    await native.launch();
    throw Error('manual session failure');
  } catch (error) {
    await native.fail(error);
  } finally {
    await native.dispose();
  }
  await assert.rejects(native.finish(), /recorded native failure/);
  await assert.rejects(readFile(path.join(folder, 'result.json')), { code: 'ENOENT' });
  const failure = JSON.parse(await readFile(path.join(folder, 'failure.json'), 'utf8'));
  assert.match(failure.error, /manual session failure/);
  assert(failure.cleanup.some((entry) => entry.kind === 'electron' && entry.pidAbsent));
  assert(failure.cleanup.some((entry) => entry.kind === 'bus' && entry.pidAbsent));
  for (const entry of failure.cleanup) await pidAbsent(entry.pid);
  cases.push({ name, successAbsent: true, failureRecorded: true, ownedProcessesAbsent: true });
}

await writeFile(path.join(output, 'result.json'), JSON.stringify({ passed: true, cases }, null, 2));
console.log(JSON.stringify({ passed: true, cases }));
