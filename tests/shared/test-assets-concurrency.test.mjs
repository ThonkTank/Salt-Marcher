import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';
const cache = pathToFileURL(path.resolve('tools/test-assets.mjs')).href;
function fixture(t) {
  const root = mkdtempSync(path.join(tmpdir(), 'asset-race-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(path.join(root, 'src'));
  writeFileSync(path.join(root, 'src/a'), 'source');
  return root;
}
function launch(root, mode = 'normal') {
  const code = `import {prepareArtifact,treeFingerprint} from ${JSON.stringify(cache)};import {writeFileSync,appendFileSync} from 'node:fs';import path from 'node:path';const root=${JSON.stringify(root)};const result=prepareArtifact({root,kind:'race',outputs:['bundle.cjs'],fingerprint:()=>treeFingerprint(root,['src/'],{}),build:dir=>{appendFileSync(path.join(root,'builds'),'build\\n');${mode === 'kill' ? "process.kill(process.pid,'SIGKILL');" : "Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,150);writeFileSync(path.join(dir,'bundle.cjs'),'valid');"}}});console.log(result.cache);`;
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['--input-type=module', '-e', code]);
    let output = '';
    child.stdout.on('data', (d) => (output += d));
    child.stderr.on('data', (d) => (output += d));
    child.once('error', reject);
    child.once('exit', (code, signal) => resolve({ code, signal, output }));
  });
}
test('concurrent preparations publish one complete artifact', async (t) => {
  const root = fixture(t),
    results = await Promise.all([launch(root), launch(root)]);
  assert(
    results.every((x) => x.code === 0),
    JSON.stringify(results),
  );
  assert.deepEqual(results.map((x) => x.output.trim()).sort(), ['hit', 'miss']);
  assert.equal(readFileSync(path.join(root, 'builds'), 'utf8'), 'build\n');
});
test('an interrupted publisher leaves no valid hit and a dead owner is recovered', async (t) => {
  const root = fixture(t);
  assert.equal((await launch(root, 'kill')).signal, 'SIGKILL');
  const next = await launch(root);
  assert.equal(next.code, 0, next.output);
  assert.equal(next.output.trim(), 'miss');
});
