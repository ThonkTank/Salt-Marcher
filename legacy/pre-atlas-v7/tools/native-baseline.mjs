import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createWriteStream, createReadStream } from 'node:fs';
import { createGunzip } from 'node:zlib';
import { pipeline } from 'node:stream/promises';
import { mkdir, readFile, writeFile, readdir, rm, rename } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isMemoryBounded } from './local-check-policy.mjs';
import { baselineResourceOwnershipKnown } from './native-baseline-resource-evidence.mjs';
import { nativeQualificationScenarios, checkNativeProbes } from './native-probes.mjs';
import { nativeRuntimeArtifacts, stopOwnedChild, pidAbsent } from './native-process.mjs';

const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
async function writeJson(file, value) {
  const temporary = file + `.tmp-${process.pid}`;
  await writeFile(temporary, JSON.stringify(value, null, 2));
  await rename(temporary, file);
}
export async function nativeBaselineBinding(root) {
  const files = execFileSync(
    'git',
    ['ls-files', '-z', '--cached', '--others', '--exclude-standard'],
    { cwd: root },
  )
    .toString()
    .split('\0')
    .filter((file) =>
      /^(?:src\/|desktop\/|tools\/|tests\/|resources\/|package(?:-lock)?\.json$|build\.mjs$|tsconfig.*\.json$)/.test(
        file,
      ),
    );
  const sources = {};
  for (const file of [...new Set(files)].sort()) {
    try {
      sources[file] = digest(await readFile(path.join(root, file)));
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      sources[file] = null;
    }
  }
  const artifacts = {};
  for (const file of nativeRuntimeArtifacts)
    artifacts[file] = digest(await readFile(path.join(root, '.build/desktop', file)));
  return { sourceDigest: digest(JSON.stringify(sources)), sources, artifacts };
}
export function assertBaselineBinding(actual, expected, message) {
  const differences = (kind) =>
    [...new Set([...Object.keys(expected[kind]), ...Object.keys(actual[kind])])]
      .filter((file) => expected[kind][file] !== actual[kind][file])
      .map((file) => ({ file, expected: expected[kind][file], actual: actual[kind][file] }));
  const changes = { sources: differences('sources'), artifacts: differences('artifacts') };
  if (
    actual.sourceDigest === expected.sourceDigest &&
    !changes.sources.length &&
    !changes.artifacts.length
  )
    return;
  const files = [...changes.sources, ...changes.artifacts].map(({ file }) => file);
  const error = new Error(
    message +
      ': ' +
      files.slice(0, 20).join(', ') +
      (files.length > 20 ? ` (+${files.length - 20} more)` : ''),
  );
  error.bindingChanges = changes;
  throw error;
}
export function baselineEnvironment(scenario, directory, inherited = process.env) {
  const env = { ...inherited };
  // Diagnostic paths, shortened matrices and external runtimes must not silently
  // change the invocation bound by the catalogue. Display/backend remain explicit
  // host inputs and are recorded in binding.json.
  for (const key of [
    'ATLAS_PACKAGE',
    'ATLAS_AUTHOR_RUNTIME_DIR',
    'ATLAS_AUTHOR_RUNTIME_REVISION',
    'SOURCE_REVISION',
    'ATLAS_MIXED_SOURCE',
    'ATLAS_NAVIGATION_MINUTES',
    'E2E01_ONLY_COUNTERCASE',
    'QA_SCALES',
    'QA_TILTS',
    'QA_EXPORT_SIZES',
    'GM_QA_START_RESULT',
  ])
    delete env[key];
  return Object.assign(env, {
    GM_QA_NAMESAKES: '0',
    ATLAS_WAIT_DETAIL: '0',
    QA_STRUCTURES: '0',
    QA_DRAWN: '0',
    QA_EXACT_SCALE: '0',
    QA_PERF: '0',
    QA_SWEEP: '0',
    QA_EXPORT: '0',
    TERRAIN_WORLD_PROBE: '0',
    TERRAIN_COVERED_PROBE: '0',
    GM_QA_LONG_REST: '0',
    ...scenario.env,
    QA_EVIDENCE_DIR: directory,
    GM_QA_OUT: directory,
  });
}
export { inspectBaselineEvidence } from './native-baseline-evidence.mjs';
import { inspectBaselineEvidence } from './native-baseline-evidence.mjs';

export async function runFullNativeBaseline({
  root = process.cwd(),
  output = path.resolve(process.env.QA_EVIDENCE_DIR ?? '.build/native-baseline-all'),
} = {}) {
  assert.equal(process.versions.node.split('.')[0], '22', 'Native baseline requires Node.js 22');
  // A baseline is append-only evidence. Reusing a directory could mix source stands.
  await mkdir(path.dirname(output), { recursive: true });
  await mkdir(output);
  const scenarios = nativeQualificationScenarios(root);
  const packageDirectory = process.argv.find((arg) => arg.startsWith('--package='))?.slice(10);
  if (packageDirectory) {
    const update = scenarios.find((item) => item.name === 'updates');
    delete update.notRunReason;
    update.args = [path.resolve(packageDirectory)];
    for (const args of [['--workspace'], ['--force']])
      scenarios.push({
        ...update,
        name: 'updates-' + args[0].slice(2),
        args: [...update.args, ...args],
      });
  }
  const metadata = {
    startedAt: new Date().toISOString(),
    pid: process.pid,
    node: process.version,
    scenarios,
  };
  let binding;
  try {
    assert.equal(
      process.platform,
      'linux',
      'The complete native catalogue currently requires the Linux ui-session ownership and resource backend',
    );
    assert(
      !isMemoryBounded(),
      'Run the all-scenario supervisor directly with Node.js; an enclosing bounded group would kill its supervisor with a native case. Each probe receives its own existing 2G/3G resource owner.',
    );
    const ownershipErrors = checkNativeProbes(root);
    assert.equal(
      ownershipErrors.length,
      0,
      'Native probe ownership inventory invalid: ' + ownershipErrors.join('; '),
    );
    const fixtureDirectory = path.join(output, 'fixtures');
    await mkdir(fixtureDirectory);
    const mixedWorld = path.join(fixtureDirectory, 'mixed-world.sqlite');
    await pipeline(
      createReadStream(path.join(root, 'tests/fixtures/atlas/mixed-world.sqlite.gz')),
      createGunzip(),
      createWriteStream(mixedWorld, { flags: 'wx' }),
    );
    for (const scenario of scenarios.filter((item) =>
      /^(?:atlas-cache-reopen|atlas-early-terrain|atlas-scale-roundtrip)/.test(item.name),
    ))
      scenario.env = { ...scenario.env, ATLAS_MIXED_SOURCE: mixedWorld };
    binding = await nativeBaselineBinding(root);
    const fixtureSha256 = digest(await readFile(mixedWorld));
    let matchingPackage;
    if (packageDirectory) {
      const directory = path.resolve(packageDirectory),
        artifacts = {};
      for (const file of nativeRuntimeArtifacts)
        artifacts[file] = digest(await readFile(path.join(directory, 'resources/app', file)));
      assert.deepEqual(
        artifacts,
        binding.artifacts,
        'Package adapter must use exactly the bound current desktop artifacts',
      );
      matchingPackage = { directory, artifacts };
    }

    Object.assign(metadata, {
      fixture: { file: mixedWorld, sha256: fixtureSha256 },
      head: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
      dirty: execFileSync('git', ['status', '--short'], { cwd: root, encoding: 'utf8' }).trim(),
      node: process.version,
      host: {
        platform: process.platform,
        arch: process.arch,
        release: os.release(),
        display: process.env.DISPLAY ?? null,
        waylandDisplay: process.env.WAYLAND_DISPLAY ?? null,
        desktopSession: process.env.XDG_SESSION_TYPE ?? null,
        ozone: process.env.QA_OZONE_PLATFORM ?? 'default',
        zoom: 1,
        cgroup: await readFile('/proc/self/cgroup', 'utf8'),
      },
      binding,
      matchingPackage,
      scenarios,
    });
    await writeFile(path.join(output, 'binding.json'), JSON.stringify(metadata, null, 2));
  } catch (error) {
    const failure = { phase: 'preparation', error: error.stack };
    await writeFile(
      path.join(output, 'binding.json'),
      JSON.stringify({ ...metadata, ...failure }, null, 2),
    );
    await writeFile(path.join(output, 'failure.json'), JSON.stringify(failure, null, 2));
    await writeFile(
      path.join(output, 'report.json'),
      JSON.stringify(
        {
          ...metadata,
          ...failure,
          results: scenarios.map((scenario) => ({
            ...scenario,
            status: 'not-run',
            reason: 'Baseline preparation failed: ' + error.message,
          })),
          wrappers: [],
        },
        null,
        2,
      ),
    );
    throw error;
  }
  const results = [],
    wrappers = [];
  let active, activeExit, activeRecord, interrupted, cleanupError;
  const persist = () =>
    writeJson(path.join(output, 'report.json'), {
      ...metadata,
      binding: { sourceDigest: binding.sourceDigest, artifacts: binding.artifacts },
      results,
      wrappers,
      interrupted,
      cleanupError: cleanupError?.stack,
    });
  let stopping;
  function stopActive() {
    if (!active) return Promise.resolve();
    return (stopping ??= stopOwnedChild(active, { timeout: 10000 }));
  }
  const handlers = ['SIGINT', 'SIGTERM'].map((signal) => {
    const handler = () => {
      interrupted ??= signal;
      stopActive().catch((error) => {
        cleanupError = error;
      });
    };
    process.on(signal, handler);
    return [signal, handler];
  });
  try {
    for (const scenario of scenarios) {
      if (interrupted || cleanupError) break;
      const prior = results.find((item) => item.name === scenario.dependency);
      if (scenario.notRunReason || (scenario.dependency && prior?.status !== 'passed')) {
        results.push({
          ...scenario,
          status: 'not-run',
          reason:
            scenario.notRunReason ??
            `Required normally completed fixture unavailable: ${scenario.dependency}`,
        });
        await persist();
        continue;
      }
      const current = await nativeBaselineBinding(root);
      assertBaselineBinding(
        current,
        binding,
        'Sources or desktop artifacts changed during baseline; refusing mixed qualification',
      );
      const directory = path.join(output, scenario.name);
      await mkdir(directory);
      const args = ['tools/ui-session.py', process.execPath, scenario.file, ...scenario.args];
      const env = baselineEnvironment(scenario, directory);
      if (scenario.dependency)
        env.GM_QA_START_RESULT = path.join(output, scenario.dependency, 'result.json');
      const record = {
        ...scenario,
        command: ['python3', ...args],
        directory,
        startedAt: new Date().toISOString(),
        status: 'running',
      };
      activeRecord = record;
      results.push(record);
      await persist();
      console.log(`Native baseline ${results.length}/${scenarios.length}: ${scenario.name}`);
      const log = createWriteStream(path.join(directory, 'run.log'), { flags: 'wx' });
      stopping = undefined;
      active = spawn(
        process.execPath,
        [
          fileURLToPath(new URL('./native-baseline-resource.mjs', import.meta.url)),
          'python3',
          ...args,
        ],
        { cwd: root, env, stdio: ['ignore', 'pipe', 'pipe'] },
      );
      const owner = { probe: scenario.name, pid: active.pid, startedAt: record.startedAt };
      wrappers.push(owner);
      await writeFile(path.join(output, 'active-wrapper.json'), JSON.stringify(owner));
      active.stdout.pipe(log, { end: false });
      active.stderr.pipe(log, { end: false });
      activeExit = new Promise((resolve, reject) => {
        active.once('error', reject);
        active.once('close', (code, signal) => resolve({ code, signal }));
      });
      const exit = await activeExit;
      await new Promise((resolve) => log.end(resolve));
      await pidAbsent(active.pid);
      owner.exit = exit;
      owner.pidAbsent = true;
      active = undefined;
      await rm(path.join(output, 'active-wrapper.json'), { force: true });
      const evidence = await inspectBaselineEvidence(directory, exit, { ...scenario, binding });
      let resource;
      try {
        resource = JSON.parse(
          await readFile(path.join(directory, 'resource-wrapper.json'), 'utf8'),
        );
      } catch (error) {
        evidence.resourceError = error.message;
      }
      const resourceOwnershipKnown = baselineResourceOwnershipKnown(resource);
      evidence.unknownOwnership =
        !resourceOwnershipKnown ||
        evidence.wrappers.some(
          (wrapper) =>
            !Array.isArray(wrapper.remainingOwnedPids) || wrapper.remainingOwnedPids.length > 0,
        );
      evidence.resource = resource;
      evidence.resourceOwnershipKnown = resourceOwnershipKnown;
      Object.assign(record, {
        endedAt: new Date().toISOString(),
        exit,
        ...evidence,
        status: interrupted
          ? 'interrupted'
          : scenario.kind === 'negative-control' &&
              evidence.negativeControl &&
              !evidence.error &&
              !evidence.unknownOwnership
            ? 'detected'
            : exit.code === 0 && !evidence.error && !evidence.unknownOwnership
              ? 'passed'
              : 'failed',
      });
      const after = await nativeBaselineBinding(root);
      assertBaselineBinding(
        after,
        binding,
        'Sources or desktop artifacts changed inside probe; refusing mixed qualification',
      );
      await persist();
      activeRecord = undefined;
      console.log(`Native baseline ${scenario.name}: ${record.status}`);
      if (evidence.unknownOwnership)
        throw Error('Native process ownership unresolved: ' + scenario.name);
    }
    for (const scenario of scenarios)
      if (!results.some((item) => item.name === scenario.name))
        results.push({
          ...scenario,
          status: 'not-run',
          reason: interrupted
            ? 'Baseline interrupted: ' + interrupted
            : 'Baseline stopped before this scenario',
        });
    metadata.endedAt = new Date().toISOString();
    await persist();
    if (
      interrupted ||
      cleanupError ||
      results.some(
        (item) => !['passed', 'detected'].includes(item.status) && item.kind !== 'historical',
      )
    )
      process.exitCode = 1;
    console.log(
      `Native baseline completed: ${results.filter((item) => item.status === 'passed').length} passed, ${results.filter((item) => item.status === 'failed').length} failed, ${results.filter((item) => item.status === 'not-run').length} not run`,
    );
  } catch (error) {
    metadata.endedAt = new Date().toISOString();
    if (activeRecord)
      Object.assign(activeRecord, {
        status: 'failed',
        endedAt: new Date().toISOString(),
        invalidated: true,
        error: error.stack,
        bindingChanges: error.bindingChanges,
      });
    try {
      await stopActive();
      if (activeExit) await activeExit;
    } catch (cleanup) {
      cleanupError = cleanup;
    }
    for (const scenario of scenarios)
      if (!results.some((item) => item.name === scenario.name))
        results.push({ ...scenario, status: 'not-run', reason: error.message });
    await writeFile(
      path.join(output, 'failure.json'),
      JSON.stringify(
        {
          error: error.stack,
          bindingChanges: error.bindingChanges,
          cleanupError: cleanupError?.stack,
        },
        null,
        2,
      ),
    );
    await persist();
    throw error;
  } finally {
    await stopActive();
    for (const [signal, handler] of handlers) process.off(signal, handler);
  }
}
