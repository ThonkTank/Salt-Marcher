import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { mkdir, mkdtemp, writeFile, readFile, copyFile, readdir } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runFullNativeBaseline } from './native-baseline.mjs';
import {
  nativeRuntimeArtifacts,
  bounded,
  observeExit,
  pidAbsent,
  stopOwnedChild,
} from './native-process.mjs';

export async function runBaselineControllerNegatives({ root = process.cwd(), output }) {
  assert.equal(
    process.platform,
    'linux',
    'Controller negatives exercise the Linux ui-session owner',
  );
  await mkdir(output, { recursive: true });
  const fixtures = [];
  async function fixture(name, first, { head = true } = {}) {
    const folder = await mkdtemp(path.join(output, name + '-'));
    execFileSync('git', ['init', '-q', folder]);
    if (head)
      execFileSync(
        'git',
        [
          '-c',
          'user.name=Synthetic fixture',
          '-c',
          'user.email=fixture@example.invalid',
          'commit',
          '--quiet',
          '--allow-empty',
          '-m',
          'Synthetic controller fixture',
        ],
        { cwd: folder },
      );
    await mkdir(path.join(folder, 'tools'));
    await mkdir(path.join(folder, 'tests/fixtures/atlas'), { recursive: true });
    await writeFile(path.join(folder, 'package.json'), '{"type":"module"}');
    await copyFile(
      path.join(root, 'tools/ui-session.py'),
      path.join(folder, 'tools/ui-session.py'),
    );
    await writeFile(
      path.join(folder, 'tools/native-session.mjs'),
      'export function runNativeProbe() {}',
    );
    await writeFile(path.join(folder, 'tools/native-process.mjs'), 'export {};');
    await writeFile(
      path.join(folder, 'tools/test-desktop-development.mjs'),
      "import './native-process.mjs'; import {runNativeProbe} from './native-session.mjs'; await runNativeProbe();\n" +
        first,
    );
    await writeFile(
      path.join(folder, 'tools/test-desktop-second.mjs'),
      "import {runNativeProbe} from './native-session.mjs'; await runNativeProbe(); import {writeFile} from 'node:fs/promises'; await writeFile('second-visited.txt','observed'); throw Error('Controlled second fixture failure');",
    );
    await writeFile(
      path.join(folder, 'tests/fixtures/atlas/mixed-world.sqlite.gz'),
      gzipSync('Synthetic fixture only; no native launch'),
    );
    for (const file of nativeRuntimeArtifacts) {
      const target = path.join(folder, '.build/desktop', file);
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, 'Synthetic binding bytes only; no executable launched');
    }
    return { folder, output: path.join(folder, 'evidence') };
  }
  const readReport = async (item) =>
    JSON.parse(await readFile(path.join(item.output, 'report.json'), 'utf8'));
  const checkWrappers = (report) =>
    assert(report.wrappers.every((wrapper) => wrapper.pidAbsent === true));
  const previousExitCode = process.exitCode;
  try {
    const independent = await fixture(
      'independent',
      "throw Error('Controlled first fixture failure');",
    );
    await runFullNativeBaseline({ root: independent.folder, output: independent.output });
    const continued = await readReport(independent);
    assert.deepEqual(
      continued.results.map((row) => row.status),
      ['failed', 'failed'],
    );
    assert.equal(
      await readFile(path.join(independent.folder, 'second-visited.txt'), 'utf8'),
      'observed',
    );
    checkWrappers(continued);
    fixtures.push({ name: 'independent failure continues', ...independent, passed: true });

    const changed = await fixture(
      'source-change',
      "import {writeFile} from 'node:fs/promises'; await writeFile('tools/test-desktop-development.mjs','// changed inside probe'); throw Error('Controlled fixture failure');",
    );
    await assert.rejects(
      runFullNativeBaseline({ root: changed.folder, output: changed.output }),
      /changed inside probe/,
    );
    const invalidated = await readReport(changed);
    assert.deepEqual(
      invalidated.results.map((row) => row.status),
      ['failed', 'not-run'],
    );
    assert.equal(invalidated.results[0].invalidated, true);
    checkWrappers(invalidated);
    fixtures.push({
      name: 'source mutation invalidates current result and stops',
      ...changed,
      passed: true,
    });

    const unknown = await fixture(
      'unknown-wrapper',
      "import {writeFile} from 'node:fs/promises'; if(process.env.CODEX_OWNED_UI_SESSION !== String(process.pid))throw Error('Wrong synthetic owner'); await writeFile('first-pid.txt',String(process.pid)); process.kill(process.ppid,'SIGKILL');",
    );
    await runFullNativeBaseline({ root: unknown.folder, output: unknown.output });
    const reaped = await readReport(unknown);
    assert.deepEqual(
      reaped.results.map((row) => row.status),
      ['failed', 'failed'],
    );
    assert.equal(reaped.results[0].unknownOwnership, false);
    assert.equal(reaped.results[0].resource.cleanup.removed, true);
    await pidAbsent(Number(await readFile(path.join(unknown.folder, 'first-pid.txt'), 'utf8')));
    checkWrappers(reaped);
    fixtures.push({
      name: 'resource owner proves bounded descendants reaped after inner owner SIGKILL and continues',
      ...unknown,
      passed: true,
    });

    const missing = await fixture(
      'missing-resource-proof',
      "import {mkdir,writeFile} from 'node:fs/promises'; await writeFile('first-pid.txt',String(process.pid)); await mkdir(process.env.QA_EVIDENCE_DIR+'/resource-wrapper.json'); throw Error('Controlled resource proof publication failure');",
    );
    await assert.rejects(
      runFullNativeBaseline({ root: missing.folder, output: missing.output }),
      /ownership unresolved/,
    );
    const stopped = await readReport(missing);
    assert.deepEqual(
      stopped.results.map((row) => row.status),
      ['failed', 'not-run'],
    );
    assert.equal(stopped.results[0].unknownOwnership, true);
    assert(stopped.results[0].resourceError);
    await pidAbsent(Number(await readFile(path.join(missing.folder, 'first-pid.txt'), 'utf8')));
    checkWrappers(stopped);
    // The synthetic proof is deliberately unavailable to the controller. Confirm
    // independently that this technical negative itself left no owned group.
    const units = await readdir(path.join(missing.folder, '.build/local-checks'));
    assert.equal(units.length, 1);
    const cleanup = JSON.parse(
      await readFile(
        path.join(missing.folder, '.build/local-checks', units[0], 'report.json'),
        'utf8',
      ),
    );
    assert.equal(cleanup.cleanup.removed, true);
    fixtures.push({
      name: 'missing resource completion proof stops even with an inner empty PID receipt',
      ...missing,
      passed: true,
      cleanup,
    });

    const invalidInventory = await fixture('invalid-inventory', "throw Error('must not run');");
    await writeFile(
      path.join(invalidInventory.folder, 'tools/test-desktop-second.mjs'),
      "import {runNativeProbe} from './native-session.mjs'; await runNativeProbe(); spawn('unowned');",
    );
    await assert.rejects(
      runFullNativeBaseline({ root: invalidInventory.folder, output: invalidInventory.output }),
      /ownership inventory invalid/,
    );
    const rejectedInventory = await readReport(invalidInventory);
    assert.deepEqual(
      rejectedInventory.results.map((row) => row.status),
      ['not-run', 'not-run'],
    );
    assert.equal(rejectedInventory.wrappers.length, 0);
    fixtures.push({
      name: 'unregistered process ownership is rejected before any scenario starts',
      ...invalidInventory,
      passed: true,
    });

    const preflight = await fixture('preparation', "throw Error('must not run');", { head: false });
    await assert.rejects(
      runFullNativeBaseline({ root: preflight.folder, output: preflight.output }),
    );
    const notStarted = await readReport(preflight);
    assert.equal(notStarted.phase, 'preparation');
    assert.deepEqual(
      notStarted.results.map((row) => row.status),
      ['not-run', 'not-run'],
    );
    assert.deepEqual(notStarted.wrappers, []);
    fixtures.push({
      name: 'preparation failure records every unexecuted case',
      ...preflight,
      passed: true,
    });

    const inherited = await fixture('inherited-bound', "throw Error('must not run');");
    const boundedEntry = path.join(inherited.folder, 'runner.mjs');
    await writeFile(
      boundedEntry,
      `import {runFullNativeBaseline} from ${JSON.stringify(new URL('./native-baseline.mjs', import.meta.url).href)};await runFullNativeBaseline({root:process.cwd(),output:${JSON.stringify(inherited.output)}});`,
    );
    const enclosing = spawn(
      process.execPath,
      [path.join(root, 'tools/run-local-check.mjs'), process.execPath, boundedEntry],
      { cwd: inherited.folder, stdio: 'ignore' },
    );
    const enclosingExit = await bounded(
      observeExit(enclosing),
      15000,
      'Synthetic enclosing resource check did not stop',
    );
    assert.equal(enclosingExit.code, 1);
    await pidAbsent(enclosing.pid);
    const rejected = await readReport(inherited);
    assert.equal(rejected.phase, 'preparation');
    assert.match(rejected.error, /enclosing bounded group/);
    assert.deepEqual(
      rejected.results.map((row) => row.status),
      ['not-run', 'not-run'],
    );
    assert.deepEqual(rejected.wrappers, []);
    fixtures.push({
      name: 'enclosing bounded group is rejected before any native scenario starts',
      ...inherited,
      passed: true,
    });

    const abort = await fixture(
      'abort',
      "import {writeFile} from 'node:fs/promises'; await writeFile('first-running.txt',String(process.pid)); setInterval(()=>{},50);",
    );
    const entry = path.join(abort.folder, 'runner.mjs');
    await writeFile(
      entry,
      `import {runFullNativeBaseline} from ${JSON.stringify(new URL('./native-baseline.mjs', import.meta.url).href)};await runFullNativeBaseline({root:process.cwd(),output:${JSON.stringify(abort.output)}});`,
    );
    const runner = spawn(process.execPath, [entry], {
      cwd: abort.folder,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let log = '';
    runner.stdout.on('data', (bytes) => {
      log += bytes;
    });
    runner.stderr.on('data', (bytes) => {
      log += bytes;
    });
    const ended = observeExit(runner);
    try {
      let marker;
      await bounded(
        (async () => {
          for (;;) {
            try {
              marker = Number(await readFile(path.join(abort.folder, 'first-running.txt'), 'utf8'));
              break;
            } catch (error) {
              if (error.code !== 'ENOENT') throw error;
            }
            if (runner.exitCode !== null)
              throw Error('Synthetic runner exited before first marker: ' + log);
            await new Promise((resolve) => setTimeout(resolve, 25));
          }
        })(),
        10000,
        'Synthetic first scenario did not start',
      );
      runner.kill('SIGTERM');
      const exit = await bounded(ended, 15000, 'Synthetic full baseline did not stop');
      assert.equal(exit.code, 1);
      await pidAbsent(runner.pid);
      await pidAbsent(marker);
      const aborted = await readReport(abort);
      assert.equal(aborted.interrupted, 'SIGTERM');
      assert.deepEqual(
        aborted.results.map((row) => row.status),
        ['interrupted', 'not-run'],
      );
      assert(!aborted.results[0].unknownOwnership);
      checkWrappers(aborted);
      fixtures.push({
        name: 'full baseline interruption closes its active exact owner',
        ...abort,
        passed: true,
      });
    } finally {
      await stopOwnedChild(runner);
      await writeFile(path.join(abort.folder, 'runner.log'), log);
    }
    const result = {
      scope: 'Technical controller negatives only; no Electron or native UI launched',
      fixtures,
    };
    await writeFile(path.join(output, 'result.json'), JSON.stringify(result, null, 2));
    return result;
  } finally {
    process.exitCode = previousExitCode;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const output = path.resolve(
    process.env.QA_EVIDENCE_DIR ?? '.build/native-baseline-controller-check',
  );
  console.log(await runBaselineControllerNegatives({ output }));
}
