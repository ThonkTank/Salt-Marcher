import {
  bounded,
  observeExit,
  pidAbsent,
  ownsProfile,
  stopOwnedChild,
  startNativeBus,
  registerNativeEvidence,
  nativeRuntimeArtifacts as artifacts,
} from './native-process.mjs';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { homedir } from 'node:os';
import path from 'node:path';
import { currentProcessGroup } from './process-group.mjs';

export function assertNativeCompletion(launches, errors) {
  assert(launches.length > 0, 'No native launches recorded');
  assert.deepEqual(errors, [], 'Renderer errors prevent qualification');
  for (const launch of launches) {
    assert.deepEqual(launch.exit, { code: 0, signal: null }, 'Every launch must close normally');
    assert.equal(launch.pidAbsent, true, 'Closed native PID must be absent');
  }
}

/** Technical evidence only. The caller owns the actual user task and its assertions. */
export async function createNativeSession({
  root = process.cwd(),
  output,
  name,
  resultName = 'result.json',
}) {
  assert.equal(
    path.basename(resultName),
    resultName,
    'Result name must stay in the evidence directory',
  );
  const require = createRequire(root + '/package.json');
  // Match an ordinary Electron launch unless the probe explicitly compares a backend.
  const platform = process.env.QA_OZONE_PLATFORM;
  assert(
    platform === undefined || ['auto', 'x11', 'wayland'].includes(platform),
    'Unknown native display platform',
  );
  const platformArgs = platform ? [`--ozone-platform=${platform}`] : [];
  await mkdir(output, { recursive: true });
  // Remove success before fixture setup: even a setup failure must not leave an old pass.
  await rm(path.join(output, resultName), { force: true });
  await rm(path.join(output, 'failure.json'), { force: true });
  await registerNativeEvidence(path.join(output, resultName));
  const profiles = path.join(homedir(), '.cache/saltmarcher/ui');
  await mkdir(profiles, { recursive: true });
  const profile = await mkdtemp(path.join(profiles, name + '-')),
    group = await currentProcessGroup();
  const source = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  const dirty = !!execFileSync('git', ['status', '--porcelain'], {
    cwd: root,
    encoding: 'utf8',
  }).trim();
  const hashes = async () =>
    Object.fromEntries(
      await Promise.all(
        artifacts.map(async (file) => {
          const bytes = await readFile(path.join(root, '.build/desktop', file));
          return [file, createHash('sha256').update(bytes).digest('hex')];
        }),
      ),
    );
  const build = await hashes(),
    launches = [],
    starts = [],
    errors = [];
  let app = null,
    processHandle = null,
    proxy = null;
  const bus = path.join(profile, 'bus');
  let disposed = false;
  let disposal;
  let scenarioResult;
  let failureContext = null;
  let launchedRuntime;
  const runtimeHashes = async (runtime) =>
    Object.fromEntries(
      await Promise.all(
        runtime.files.map(async (file) => [
          file,
          createHash('sha256')
            .update(await readFile(path.join(runtime.directory, file)))
            .digest('hex'),
        ]),
      ),
    );
  async function verifyRuntime() {
    if (launchedRuntime)
      assert.deepEqual(
        await runtimeHashes(launchedRuntime),
        launchedRuntime.hashes,
        'Launched runtime changed during this workflow',
      );
  }
  const cleanup = [];
  let step = 'fixture setup';
  const steps = [];
  function mark(name) {
    step = name;
    steps.push({ step, at: new Date().toISOString() });
    console.log(`[${name}]`);
  }
  const evidence = () => ({
    source,
    dirty,
    profile,
    artifacts: build,
    starts,
    launches,
    errors,
    step,
    steps,
    cleanup,
    runtime: launchedRuntime,
  });
  async function startBus() {
    if (!proxy) proxy = (await startNativeBus(profile)).child;
    assert.equal(proxy.exitCode, null, 'Native bus proxy exited during the workflow');
    assert.equal(proxy.signalCode, null, 'Native bus proxy terminated during the workflow');
  }
  async function launch(zoom = 1, config = {}) {
    const attempt = {
      at: new Date().toISOString(),
      zoom,
      profile,
      outcome: 'requested',
      executable: config.executablePath ?? path.join(root, 'node_modules/electron/dist/electron'),
      args: config.args
        ? [...config.args]
        : [path.join(root, '.build/desktop/main.cjs'), ...platformArgs, '--data-dir', profile],
      runtime: config.runtime?.kind ?? 'current',
    };
    starts.push(attempt);
    try {
      assert(!disposed, 'Native session already disposed');
      mark('native launch');
      assert(app === null, 'Close the previous native process before restarting');
      assert.deepEqual(await hashes(), build, 'Native artifacts changed during this workflow');
      await startBus();
      const adapter = config.runtime;
      const executable =
        config.executablePath ?? path.join(root, 'node_modules/electron/dist/electron');
      const args = config.args ?? [
        path.join(root, '.build/desktop/main.cjs'),
        ...platformArgs,
        '--data-dir',
        profile,
      ];
      if (adapter) {
        assert(['snapshot', 'package'].includes(adapter.kind), 'Unknown native runtime adapter');
        const directory = path.resolve(adapter.directory);
        if (adapter.kind === 'package') {
          assert.equal(path.resolve(executable), path.join(directory, 'electron'));
          assert(args[0].startsWith('--'), 'Packaged runtime must own its entry point');
        } else {
          assert.equal(
            path.resolve(executable),
            path.join(root, 'node_modules/electron/dist/electron'),
          );
          assert.equal(path.resolve(args[0]), path.join(directory, 'main.cjs'));
        }
        const runtime = {
          kind: adapter.kind,
          directory,
          files:
            adapter.kind === 'package'
              ? ['electron', ...artifacts.map((file) => 'resources/app/' + file)]
              : artifacts,
        };
        if (!launchedRuntime)
          launchedRuntime = { ...runtime, hashes: await runtimeHashes(runtime) };
        else
          assert.deepEqual(
            runtime,
            {
              kind: launchedRuntime.kind,
              directory: launchedRuntime.directory,
              files: launchedRuntime.files,
            },
            'Runtime adapter changed between launches',
          );
        await verifyRuntime();
      } else {
        assert.equal(launchedRuntime, undefined, 'Runtime adapter removed between launches');
        assert.equal(
          path.resolve(executable),
          path.join(root, 'node_modules/electron/dist/electron'),
        );
        assert.equal(
          path.resolve(args[0]),
          path.join(root, '.build/desktop/main.cjs'),
          'Custom runtimes require an explicit native adapter',
        );
      }
      assert.equal(
        args[args.indexOf('--data-dir') + 1],
        profile,
        'Native profile must belong to this session',
      );
      app = await require('playwright-core')._electron.launch({
        executablePath: executable,
        args,
        env: { ...process.env, ...config.env, DBUS_SESSION_BUS_ADDRESS: 'unix:path=' + bus },
        timeout: config.timeout ?? 20000,
      });
      processHandle = app.process();
      attempt.pid = processHandle.pid;
      const pid = processHandle.pid,
        entry = { pid, zoom, cgroup: group };
      launches.push(entry);
      app.process().once('exit', (code, signal) => {
        entry.exit = { code, signal };
      });
      assert(
        (await readFile('/proc/' + pid + '/cmdline', 'utf8')).includes(profile),
        'Native profile ownership missing',
      );
      assert.equal(
        (await readFile('/proc/' + pid + '/cgroup', 'utf8')).trim().split('::')[1],
        group,
      );
      const watched = new WeakSet();
      const watch = (page) => {
        if (watched.has(page)) return;
        watched.add(page);
        page.on('pageerror', (error) => errors.push(error.stack));
      };
      app.on('window', watch);
      const page = await app.firstWindow();
      for (const window of app.windows()) watch(window);
      page.setDefaultTimeout(15000);
      await page.waitForURL(/\/index\.html$/);
      await page.waitForFunction(() => document.body.dataset.tutorialReady === 'true');
      entry.platform = {
        requested:
          args.find((arg) => arg.startsWith('--ozone-platform='))?.split('=')[1] ?? 'default',
        desktopSession: process.env.XDG_SESSION_TYPE ?? null,
      };
      await app.evaluate(({ BrowserWindow }, zoom) => {
        const window = BrowserWindow.getAllWindows().find((w) =>
          w.webContents.getURL().endsWith('/index.html'),
        );
        window.webContents.setZoomFactor(zoom);
        window.show();
        window.focus();
      }, zoom);
      mark('native window ready');
      attempt.outcome = 'ready';
      attempt.readyAt = new Date().toISOString();
      return page;
    } catch (error) {
      attempt.outcome = 'failed';
      attempt.error = error?.stack ?? String(error);
      throw error;
    }
  }
  async function close() {
    mark('normal native close');
    assert(app, 'No native process to close');
    await bounded(
      capture(await app.firstWindow(), 'native-launch-' + launches.length),
      5000,
      'Native close capture timed out',
    );
    const child = app.process(),
      entry = launches.at(-1);
    assert.equal(child.exitCode, null, 'Native process already exited');
    const exited = observeExit(child);
    let closeError;
    try {
      await bounded(
        app.evaluate(({ BrowserWindow }) =>
          BrowserWindow.getAllWindows()
            .find((w) => w.webContents.getURL().endsWith('/index.html'))
            .close(),
        ),
        3000,
        'Native close request timed out',
      );
    } catch (error) {
      closeError = error;
    }
    assert.deepEqual(await bounded(exited, 10000, 'Normal close timed out'), {
      code: 0,
      signal: null,
    });
    if (closeError)
      assert(
        /closed|destroyed/i.test(closeError.message),
        'Native close request failed: ' + closeError.message,
      );
    await pidAbsent(child.pid);
    entry.pidAbsent = true;
    app = null;
    processHandle = null;
    mark('normal native exit confirmed');
  }
  async function capture(page, name, selector) {
    assert(app, 'Native capture requires an open application');
    const captureZoom = await app.evaluate(({ BrowserWindow }) => {
      const w = BrowserWindow.getAllWindows().find((w) =>
        w.webContents.getURL().endsWith('/index.html'),
      );
      w.show();
      w.focus();
      return w.webContents.getZoomFactor();
    });
    if (selector) await page.locator(selector).scrollIntoViewIfNeeded();
    await page.evaluate(
      () =>
        new Promise((resolve, reject) => {
          let frame;
          const timer = setTimeout(() => {
            cancelAnimationFrame(frame);
            reject(Error('No fresh native capture frames'));
          }, 2500);
          frame = requestAnimationFrame(() => {
            frame = requestAnimationFrame(() => {
              clearTimeout(timer);
              resolve();
            });
          });
        }),
    );
    const bytes = Buffer.from(
      await app.evaluate(async ({ BrowserWindow }) =>
        (
          await BrowserWindow.getAllWindows()
            .find((w) => w.webContents.getURL().endsWith('/index.html'))
            .webContents.capturePage()
        ).toPNG(),
      ),
    );
    const png = require('pngjs').PNG.sync.read(bytes),
      colors = new Set();
    for (let i = 0; i < png.data.length; i += 4 * 31) colors.add(png.data.readUInt32BE(i));
    assert(colors.size > 8, 'Native capture is blank');
    const file = name.endsWith('.png') ? name : name + '.png';
    await writeFile(path.join(output, file), bytes);
    const entry = launches.at(-1);
    entry.captures ??= [];
    entry.captures.push({
      file,
      zoom: captureZoom,
      width: png.width,
      height: png.height,
      sha256: createHash('sha256').update(bytes).digest('hex'),
      fresh: true,
    });
  }
  async function finish(extra = {}) {
    assert.equal(failureContext, null, 'A recorded native failure prevents qualification');
    assert(app === null, 'Close all native windows before publishing success');
    assert(
      starts.every((attempt) => attempt.outcome === 'ready'),
      'Every requested native start must complete; a caught start failure prevents qualification',
    );
    assertNativeCompletion(launches, errors);
    if (proxy) {
      assert.equal(proxy.exitCode, null, 'Native bus proxy exited during the workflow');
      assert.equal(proxy.signalCode, null, 'Native bus proxy terminated during the workflow');
    }
    await dispose();
    assert(
      !cleanup.some((entry) => entry.forced),
      'Forced emergency cleanup prevents native qualification',
    );
    mark('all scenario assertions and cleanup complete');
    await verifyRuntime();
    assert.deepEqual(await hashes(), build, 'Native artifacts changed during this workflow');
    await writeFile(
      path.join(output, resultName),
      JSON.stringify({ ...extra, ...evidence() }, null, 2),
    );
  }
  async function writeFailure() {
    if (failureContext)
      await writeFile(
        path.join(output, 'failure.json'),
        JSON.stringify({ ...evidence(), ...failureContext }, null, 2),
      );
  }
  async function fail(error) {
    failureContext = { view: failureContext?.view ?? null, error: error.stack ?? String(error) };
    console.error(`Native failure at ${step}: ${error.message ?? error}`);
    await rm(path.join(output, resultName), { force: true });
    let view = failureContext.view;
    const live = app && processHandle?.exitCode === null && processHandle?.signalCode === null;
    if (live) {
      try {
        view = await bounded(
          (async () =>
            (await app.firstWindow()).evaluate(() => ({
              status: document.querySelector('#status')?.textContent,
              atlasStatus: document.querySelector('#atlas-save-status')?.textContent,
              atlas: { ...document.querySelector('#campaign-atlas')?.dataset },
              canvas: { ...document.querySelector('#campaign-map')?.dataset },
            })))(),
          2000,
          'Native failure view timed out',
        );
      } catch {}
    }
    failureContext.view = view;
    await writeFailure();
    if (live)
      try {
        await bounded(
          (async () => capture(await app.firstWindow(), 'failure.png'))(),
          4000,
          'Native failure capture timed out',
        );
      } catch {}
  }
  function dispose() {
    if (disposal) return disposal;
    disposed = true;
    disposal = (async () => {
      const failures = [];
      if (app) {
        const child = processHandle;
        try {
          // Emergency cleanup is never counted as normal completion.
          cleanup.push({
            kind: 'electron',
            ...(await stopOwnedChild(child, {
              owns: () => ownsProfile(child, profile),
            })),
          });
        } catch (error) {
          failures.push(error);
        } finally {
          app = null;
          processHandle = null;
        }
      }
      if (proxy) {
        try {
          const unexpected = proxy.exitCode !== null || proxy.signalCode !== null;
          cleanup.push({ kind: 'bus', unexpected, ...(await stopOwnedChild(proxy)) });
          if (unexpected) failures.push(Error('Native bus proxy exited during the workflow'));
        } catch (error) {
          failures.push(error);
        } finally {
          proxy = null;
        }
      }
      // Manual session callers fail before their finally/dispose. Refresh that
      // same failure after all owned processes have actually been cleaned up.
      await writeFailure();
      if (failures.length) {
        const error = new AggregateError(failures, 'Native cleanup incomplete');
        await fail(error);
        throw error;
      }
    })();
    return disposal;
  }
  return {
    profile,
    source,
    dirty,
    artifacts: build,
    starts,
    launches,
    errors,
    get app() {
      return app;
    },
    get processes() {
      return { electron: processHandle?.pid ?? null, bus: proxy?.pid ?? null };
    },
    launch,
    async launchConfigured(config) {
      await launch(1, config);
      return app;
    },
    recordResult(value) {
      scenarioResult = value;
    },
    get result() {
      return scenarioResult;
    },
    mark,
    close,
    capture,
    finish,
    fail,
    dispose,
  };
}

/** Publish only after the complete scenario (including post-close storage
 * assertions) has returned and every owned process has been reaped. */
export async function runNativeProbe(options, scenario) {
  let native;
  try {
    native = await createNativeSession(options);
  } catch (error) {
    await mkdir(options.output, { recursive: true });
    const resultName = options.resultName ?? 'result.json';
    if (path.basename(resultName) === resultName)
      await rm(path.join(options.output, resultName), { force: true });
    await writeFile(
      path.join(options.output, 'failure.json'),
      JSON.stringify({ step: 'session setup', error: error.stack ?? String(error) }, null, 2),
    );
    throw error;
  }
  let originalError;
  try {
    const result = await scenario(native);
    await native.finish(result ?? native.result ?? {});
    return result;
  } catch (error) {
    originalError = error;
    await native.fail(error).catch((e) => {
      console.error('Failure evidence unavailable:', e);
    });
    throw error;
  } finally {
    try {
      await native.dispose();
      if (originalError) await native.fail(originalError);
    } catch (cleanupError) {
      const combined = originalError
        ? new AggregateError(
            [originalError, cleanupError],
            'Probe and cleanup failed: ' + originalError.message + '; ' + cleanupError.message,
          )
        : cleanupError;
      await native.fail(combined).catch(() => {});
      throw combined;
    }
  }
}
