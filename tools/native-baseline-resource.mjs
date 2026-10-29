// A small resource owner remains outside the native command's bounded group.
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { runLocalCheck, propagateExit } from './run-local-check.mjs';

const [command, ...args] = process.argv.slice(2);
assert(command, 'Native baseline resource owner needs an explicit command');
const result = await runLocalCheck(command, args);
let ownership;
try {
  const started = JSON.parse(await readFile(path.join(result.evidence, 'started.json'), 'utf8'));
  const unit = path.basename(result.evidence);
  assert(/^salt-check-[a-f0-9-]+$/.test(unit), 'Unexpected owned resource unit');
  assert(
    [unit, unit + '.scope'].includes(path.basename(started.group)),
    'Started group differs from this owned unit',
  );
  const group = path.join('/sys/fs/cgroup', started.group);
  try {
    const events = await readFile(path.join(group, 'cgroup.events'), 'utf8');
    ownership = { unit, group: started.group, removed: false, empty: !/populated 1/.test(events) };
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    ownership = { unit, group: started.group, removed: true, empty: true };
  }
} catch (error) {
  ownership = { error: error.message };
}
await writeFile(
  path.join(process.env.QA_EVIDENCE_DIR, 'resource-wrapper.json'),
  JSON.stringify(
    { ...result, supervisorPid: process.pid, command: [command, ...args], ownership },
    null,
    2,
  ),
);
propagateExit(result);
