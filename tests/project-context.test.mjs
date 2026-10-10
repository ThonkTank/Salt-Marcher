import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { areas, buildContext, findCases, parseArgs } from '../tools/project-context.mjs';

test('default navigation needs no giant status file; malformed selectors cannot trigger a full dump', () => {
  assert(Object.hasOwn(buildContext(os.tmpdir(), []).areas, 'atlas'));
  for (const args of [['--full'], ['--case'], ['--area', 'atlas', '--checkpoint', 'x'], ['--area', 'atlas', '--area', 'city']])
    assert.throws(() => parseArgs(args));
});
test('case identities match exactly, report duplicate locations and escape JSON pointers', () => {
  const data = { cases: [{ id: 'AC-1', state: 'open' }, { id: 'AC-10' }], 'a/b~': { 'AC-1': { state: 'review' } } };
  assert.deepEqual(findCases(data, 'AC-1').map(m => m.pointer), ['/cases/0', '/a~1b~0/AC-1']);
  assert.deepEqual(findCases(data, 'AC'), []);
});
test('selected output bounds huge evidence, marks omissions and permits explicit complete entry', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'project-context-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const entry = { id: 'AC-1', evidence: 'x'.repeat(100000), history: Array.from({ length: 5000 }, (_, i) => ({ i, detail: 'y'.repeat(1000) })) };
  fs.writeFileSync(path.join(root, 'acceptance.json'), JSON.stringify({ cases: [entry, { id: 'OTHER' }] }));
  const result = buildContext(root, ['--case', 'AC-1']);
  assert(JSON.stringify(result).length < 3000);
  assert(result.matches[0].entry.evidence.includes('truncated'));
  assert.equal(result.matches[0].entry.history.omittedEntries, 4997);
  assert.deepEqual(buildContext(root, ['--case', 'AC-1', '--full']).matches[0].entry, entry);
  assert.throws(() => buildContext(root, ['--case', 'AC-UNKNOWN']), /No exact/);
  assert.match(result.scope, /Not live/);
});
test('every area references existing shared roots and plans; portfolio areas claim no execution root', () => {
  const root = path.resolve(new URL('..', import.meta.url).pathname);
  for (const [name, route] of Object.entries(areas)) {
    const result = buildContext(root, ['--area', name]);
    assert(fs.existsSync(path.join(root, route.plan)));
    assert.match(result.source.commit, /^[a-f0-9]{40}$/);
    assert.match(result.scope, /Not live/);
    if (['campaign', 'runtime'].includes(name)) { assert.deepEqual(result.checkpoint, {}); assert(result.note); }
  }
});
