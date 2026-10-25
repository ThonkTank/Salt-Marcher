import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { checkRepository, markdownLinks } from '../tools/check-repository.mjs';

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'repository-structure-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  function write(file, value) {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(
      path.join(root, file),
      typeof value === 'string' ? value : JSON.stringify(value),
    );
  }
  const scope = JSON.parse(
    fs.readFileSync(new URL('../docs/project/requirements/sources.json', import.meta.url), 'utf8'),
  );
  scope.local_reference_files = [{ path: 'README.md', sha256: '0'.repeat(64) }];
  write('docs/project/requirements/sources.json', scope);
  write('acceptance.json', { requirements: [] });
  write('README.md', '[Index](docs/INDEX.md)');
  write('AGENTS.md', '# Start');
  write('CONTRIBUTING.md', '# Beitragen');
  write('ROADMAP-OLD.md', '# Legacy\n[Historical private QA](file:///unavailable/cache)');
  write('docs/INDEX.md', '[Legacy](../ROADMAP-OLD.md)\n[Guide](GUIDE.md)');
  write('docs/GUIDE.md', '# Prüfung\n# Prüfung\n[Second](#prüfung-1)\n[Readme](../README.md)');
  const files = () =>
    fs
      .readdirSync(root, { recursive: true })
      .filter((f) => fs.statSync(path.join(root, f)).isFile())
      .map((f) => f.split(path.sep).join('/'));
  return { root, write, scope, check: () => checkRepository(root, files()) };
}

test('normal edits keep historical source hashes and legacy paths usable', (t) => {
  const f = fixture(t);
  assert.deepEqual(f.check(), []); // The pinned SHA need not equal today's README bytes.
});
test('every core test is registered in the canonical bundle entry', (t) => {
  const f = fixture(t);
  f.write('tests/core.test.ts', 'import "./core/registered.test";');
  f.write('tests/core/registered.test.ts', '');
  f.write('tests/core/forgotten.test.ts', '');
  assert.deepEqual(
    f.check().filter((e) => e.includes('core test is not registered')),
    ['tests/core/forgotten.test.ts: core test is not registered in tests/core.test.ts'],
  );
});
test('a deleted or renamed document leaves a failing local link', (t) => {
  const f = fixture(t);
  fs.renameSync(path.join(f.root, 'docs/GUIDE.md'), path.join(f.root, 'docs/RENAMED.md'));
  assert(f.check().some((e) => e.includes('missing local link target GUIDE.md')));
});
test('wrong Markdown anchors fail', (t) => {
  const f = fixture(t);
  f.write('docs/GUIDE.md', '# Prüfung\n[Broken](#missing)');
  assert(f.check().some((e) => e.includes('missing Markdown anchor')));
});
test('unknown and duplicate source identities are caught', (t) => {
  const f = fixture(t);
  f.scope.technical_needs.push(f.scope.technical_needs[0]);
  f.scope.capability_acceptance_references[0].technical_needs.push('TN-UNKNOWN');
  f.write('docs/project/requirements/sources.json', f.scope);
  assert(f.check().some((e) => e.includes('duplicate identity')));
  assert(f.check().some((e) => e.includes('unknown need TN-UNKNOWN')));
});
test('Markdown examples are ignored; reference links and angle-bracket paths are checked', (t) => {
  const f = fixture(t);
  f.write(
    'docs/GUIDE.md',
    '# Guide\n```md\n[Example](missing.md)\n```\n~~~md\n[Example](missing.md)\n~~~\n`[Example](missing.md)`\n[Reference][r]\n[r]: <space guide.md>\n[Space](<space guide.md>)',
  );
  f.write('docs/space guide.md', '# Space');
  assert.deepEqual(f.check(), []);
  assert.deepEqual(
    markdownLinks('<!-- [No](missing.md) -->\n[Yes](real.md)\n[A multiline\nlabel](second.md)'),
    ['real.md', 'second.md'],
  );
});
test('directory links and their child document links remain valid', (t) => {
  const f = fixture(t);
  f.write('docs/INDEX.md', '[Old](../ROADMAP-OLD.md)\n[Guide](GUIDE.md)\n[Subdirectory](guides/)');
  f.write('docs/guides/README.md', '# Guides\n[Child](child.md)');
  f.write('docs/guides/child.md', '# Child');
  assert.deepEqual(f.check(), []);
});
test('a malformed source collection gives a specific diagnostic without crashing', (t) => {
  const f = fixture(t);
  f.scope.source_requirements = {};
  f.write('docs/project/requirements/sources.json', f.scope);
  assert(f.check().some((e) => e.includes('invalid collection source_requirements')));
});
test('ADR matrix references a local plan and detects its later removal', (t) => {
  const f = fixture(t);
  f.write('ROADMAP-ADR-MATRIX.json', { normativeFor: 'ROADMAP-OLD.md' });
  assert.deepEqual(f.check(), []);
  fs.unlinkSync(path.join(f.root, 'ROADMAP-OLD.md'));
  assert(f.check().some((e) => e.includes('missing normativeFor target ROADMAP-OLD.md')));
});
test('ADR matrix accepts a commit-bound historical plan, but rejects moving URLs', (t) => {
  const f = fixture(t);
  f.write('ROADMAP-ADR-MATRIX.json', {
    normativeFor: `https://github.com/example/repo/blob/${'a'.repeat(40)}/ROADMAP-OLD.md`,
  });
  assert.deepEqual(f.check(), []);
  f.write('ROADMAP-ADR-MATRIX.json', {
    normativeFor: 'https://github.com/example/repo/blob/main/ROADMAP-OLD.md',
  });
  assert(f.check().some((e) => e.includes('invalid or missing normativeFor target')));
});
