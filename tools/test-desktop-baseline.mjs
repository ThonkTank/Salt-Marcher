import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

// Run serially: each probe owns real native windows and its own UI process group.
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
const completed = [];
let step = 'prepare';
try {
  // Invalidate every previous child success even if an earlier probe fails.
  for (const probe of probes)
    await rm(path.join(output, probe.name, probe.result), { force: true });
  for (const probe of probes) {
    step = probe.name;
    console.log(`Native baseline: ${step}`);
    const directory = path.join(output, step);
    const exit = await new Promise((resolve, reject) => {
      const child = spawn(
        'python3',
        [
          'tools/ui-session.py',
          process.execPath,
          `tools/test-desktop-${probe.script}.mjs`,
          ...probe.args,
        ],
        {
          stdio: 'inherit',
          env: { ...process.env, QA_EVIDENCE_DIR: directory },
        },
      );
      child.once('error', reject);
      child.once('exit', (code, signal) => resolve({ code, signal }));
    });
    assert.deepEqual(exit, { code: 0, signal: null }, `${step} did not complete`);
    const evidence = JSON.parse(await readFile(path.join(directory, probe.result), 'utf8'));
    assert(evidence.launches?.length > 0, `${step} has no native launch evidence`);
    completed.push({ name: step, evidence: path.join(directory, probe.result) });
  }
  await writeFile(path.join(output, 'result.json'), JSON.stringify({ completed }, null, 2));
  console.log(`Native baseline passed: ${output}`);
} catch (error) {
  await writeFile(
    path.join(output, 'failure.json'),
    JSON.stringify({ step, completed, error: error.stack }, null, 2),
  );
  console.error(`Native baseline failed at ${step}: ${error.message}`);
  throw error;
}
