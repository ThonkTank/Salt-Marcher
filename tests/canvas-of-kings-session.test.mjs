import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { assertRun, originalIdentity, assertProcesses, startTicks, sha256, qaRoot } from '../tools/canvas-of-kings/identity.mjs';
// Offline fixtures only; these are never claimed as original runtime evidence.
const root = fs.mkdtempSync(path.join(qaRoot, 'cok-adapter-offline-'));
test.after(() => fs.rmSync(root, { recursive: true, force: true }));
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
