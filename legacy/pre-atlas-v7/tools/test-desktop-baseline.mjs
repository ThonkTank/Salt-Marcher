import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { stopOwnedChild, pidAbsent, registerNativeEvidence } from './native-process.mjs';

if (process.argv.includes('--all')) {
  const { runFullNativeBaseline } = await import('./native-baseline.mjs');
  await runFullNativeBaseline();
  process.exit(process.exitCode ?? 0);
}

// The orchestrator owns exact ui-session children; each wrapper owns its native processes.
const output = path.resolve(process.env.QA_EVIDENCE_DIR ?? '.build/native-baseline');
const probes = [
  { name: 'rooms', script: 'room-reads', args: [], result: 'native.json' },
  { name: 'region', script: 'region-export', args: [], result: 'result.json' },
  {
    name: 'player',
    script: 'player-focus',
    args: ['--cue', '--handout'],
    result: 'focus-cue-after.json',
  },
];
await mkdir(output, { recursive: true });
await rm(path.join(output, 'result.json'), { force: true });
await rm(path.join(output, 'failure.json'), { force: true });
await registerNativeEvidence(path.join(output, 'result.json'));
const completed = [],
  wrappers = [];
let step = 'prepare',
  activeChild,
  activeRecord,
  activeStop,
  interrupted;
let interruptReady;
const interruptCompletion = new Promise((resolve) => {
  interruptReady = resolve;
});
function stopActive() {
  if (activeStop) return activeStop;
  if (!activeChild) return Promise.resolve();
  const child = activeChild,
    record = activeRecord;
  activeStop = stopOwnedChild(child, { timeout: 10000 }).then((result) => {
    record.cleanup = result;
    return result;
  });
  activeStop.catch(() => {});
  return activeStop;
}
const onSignal = (signal) => {
  if (interrupted) return;
  interrupted = signal;
  // Do not send the same wrapper a second signal while it is cleaning its children.
  stopActive().then(interruptReady, interruptReady);
};
const handlers = ['SIGINT', 'SIGTERM'].map((signal) => {
  const handler = () => onSignal(signal);
  process.on(signal, handler);
  return [signal, handler];
});
try {
  for (const probe of probes)
    await rm(path.join(output, probe.name, probe.result), { force: true });
  for (const probe of probes) {
    if (interrupted) throw Error('Native baseline interrupted: ' + interrupted);
    step = probe.name;
    console.log(`Native baseline: ${step}`);
    const directory = path.join(output, step);
    const ended = new Promise((resolve, reject) => {
      const child = (activeChild = spawn(
        'python3',
        [
          'tools/ui-session.py',
          process.execPath,
          `tools/test-desktop-${probe.script}.mjs`,
          ...probe.args,
        ],
        { stdio: 'inherit', env: { ...process.env, QA_EVIDENCE_DIR: directory } },
      ));
      activeStop = undefined;
      activeRecord = { probe: step, pid: child.pid, startedAt: new Date().toISOString() };
      wrappers.push(activeRecord);
      child.once('error', reject);
      child.once('exit', (code, signal) => resolve({ code, signal }));
      writeFileSync(path.join(output, 'active-wrapper.json'), JSON.stringify(activeRecord));
    });
    const exit = await Promise.race([
      ended,
      interruptCompletion.then(() => {
        throw Error('Native baseline interrupted: ' + interrupted);
      }),
    ]);
    activeRecord.exit = exit;
    await pidAbsent(activeChild.pid);
    activeRecord.pidAbsent = true;
    activeChild = undefined;
    await rm(path.join(output, 'active-wrapper.json'), { force: true });
    if (interrupted) throw Error('Native baseline interrupted: ' + interrupted);
    assert.deepEqual(exit, { code: 0, signal: null }, `${step} did not complete`);
    const evidence = JSON.parse(await readFile(path.join(directory, probe.result), 'utf8'));
    assert(evidence.launches?.length > 0, `${step} has no native launch evidence`);
    completed.push({ name: step, evidence: path.join(directory, probe.result) });
  }
  if (interrupted) throw Error('Native baseline interrupted: ' + interrupted);
  await writeFile(
    path.join(output, 'result.json'),
    JSON.stringify({ completed, wrappers }, null, 2),
  );
  if (interrupted) throw Error('Native baseline interrupted: ' + interrupted);
  console.log(`Native baseline passed: ${output}`);
} catch (error) {
  let cleanupError;
  try {
    await stopActive();
  } catch (failure) {
    cleanupError = failure;
  }
  await rm(path.join(output, 'result.json'), { force: true });
  await rm(path.join(output, 'active-wrapper.json'), { force: true });
  await writeFile(
    path.join(output, 'failure.json'),
    JSON.stringify(
      {
        step,
        completed,
        wrappers,
        interrupted,
        error: error.stack,
        cleanupError: cleanupError?.stack,
      },
      null,
      2,
    ),
  );
  console.error(`Native baseline failed at ${step}: ${error.message}`);
  if (cleanupError)
    throw new AggregateError([error, cleanupError], 'Native baseline cleanup incomplete');
  throw error;
} finally {
  await stopActive().catch(() => {});
  for (const [signal, handler] of handlers) process.off(signal, handler);
}
