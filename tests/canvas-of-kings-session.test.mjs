import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
// Offline fixtures only; these are never claimed as original runtime evidence.
const testQaRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'cok-adapter-root-')),
  identityPath = new URL('../tools/canvas-of-kings/identity.mjs', import.meta.url),
  identitySource = fs.readFileSync(identityPath, 'utf8'),
  rootDeclaration = "export const qaRoot = '/home/aaron/.cache/dungeon-native-qa';",
  isolatedSource = identitySource.replace(rootDeclaration, `export const qaRoot = ${JSON.stringify(testQaRoot)};`);
assert.notEqual(isolatedSource, identitySource, 'QA root declaration must match the helper');
const { assertRun, originalIdentity, assertProcesses, startTicks, sha256, qaRoot, assertHeldLock, assertTarget } =
  await import(`data:text/javascript;base64,${Buffer.from(isolatedSource).toString('base64')}`);
const root = fs.mkdtempSync(path.join(qaRoot, 'cok-adapter-offline-'));
test.after(() => fs.rmSync(testQaRoot, { recursive: true, force: true }));
test('private run rejects reuse, outside root, and symlink escape', () => {
  assertRun(path.join(root, 'new'));
  assert.throws(() => assertRun(root), /existing session/);
  assert.throws(() => assertRun('/tmp/cok-test'), /QA root/);
  fs.symlinkSync('/tmp', path.join(root, 'outside'));
  assert.throws(() => assertRun(path.join(root, 'outside', 'new')), /symlink/);
});
test('demo identity binds Steam app, installation and both libraries', async () => {
  const steam = path.join(root, 'steamapps'), directory = path.join(steam, 'common', 'Canvas of Kings Demo');
  fs.mkdirSync(directory, { recursive: true });
  const app = path.join(directory, 'CanvasOfKingsDemo.x86_64');
  fs.writeFileSync(app, 'offline executable fixture', { mode: 0o700 });
  for (const name of ['libgodotsteam.x86_64.so', 'libsteam_api.so']) fs.writeFileSync(path.join(directory, name), name);
  const manifest = path.join(steam, 'appmanifest_3122210.acf');
  const content = '"appid" "3122210"\n"name" "Canvas of Kings Demo"\n"StateFlags" "4"\n"installdir" "Canvas of Kings Demo"\n"buildid" "fixture"';
  fs.writeFileSync(manifest, content);
  const identity = await originalIdentity(app, manifest);
  assert.equal(identity.files.length, 3); assert.equal(identity.files[0].sha256, await sha256(app));
  fs.writeFileSync(manifest, content.replace('3122210', '2498570'));
  await assert.rejects(originalIdentity(app, manifest), /Steam manifest/);
  fs.writeFileSync(manifest, content);
  const wrong = path.join(directory, 'other'); fs.writeFileSync(wrong, 'different');
  await assert.rejects(originalIdentity(wrong, manifest), /differs/);
});
test('process guard rejects wrong product, executable and PID start identity', () => {
  const session = { state: 'running', role: 'actual_original_runtime', product: 'Canvas of Kings Demo', run: root,
    processes: [{ name: 'canvas-of-kings', pid: process.pid, executable: process.execPath, startTicks: startTicks(process.pid) }] };
  assertProcesses(session);
  assert.throws(() => assertProcesses({ ...session, product: 'Wonderdraft' }), /Canvas/);
  assert.throws(() => assertProcesses({ ...session, processes: [{ ...session.processes[0], startTicks: '0' }] }), /identity/);
  assert.throws(() => assertProcesses({ ...session, processes: [{ ...session.processes[0], executable: '/bin/false' }] }), /identity/);
});

test('real flock ownership is required, including internal launcher reentry', () => {
  const lock = path.join(root, 'offline.lock'); fs.writeFileSync(lock, '');
  const owner = { pid: process.pid, startTicks: startTicks(process.pid), executable: process.execPath };
  assert.throws(() => assertHeldLock(lock, owner), /not held/);
  const module = pathToFileURL(path.resolve('tools/canvas-of-kings/identity.mjs')).href;
  const code = `import { assertHeldLock, startTicks } from ${JSON.stringify(module)}; assertHeldLock(${JSON.stringify(lock)}, { pid: process.pid, startTicks: startTicks(process.pid), executable: process.execPath });`;
  const result = spawnSync('flock', ['--no-fork', lock, process.execPath, '--input-type=module', '-e', code], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.throws(() => assertHeldLock(lock, owner), /not held/);
});
test('RFB target cannot redirect to another port or incomplete role set', () => {
  const session = { display: ':12', port: 5912, width: 1280, height: 960, executable: process.execPath,
    processes: ['canvas-of-kings', 'session-bus', 'window-manager', 'xvnc'].map(name => ({ name, executable: process.execPath })) };
  assertTarget(session);
  assert.throws(() => assertTarget({ ...session, port: 5900 }), /contract/);
  assert.throws(() => assertTarget({ ...session, processes: session.processes.slice(1) }), /roles/);
});
