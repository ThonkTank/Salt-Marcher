import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { checkRepository, markdownLinks, validateIssueStates } from '../tools/check-repository.mjs';

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'repository-structure-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  function write(file, value) {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), typeof value === 'string' ? value : JSON.stringify(value));
  }
  const scope = JSON.parse(fs.readFileSync(new URL('../docs/scope-sources.json', import.meta.url), 'utf8'));
  scope.local_reference_files = [{ path: 'README.md', sha256: '0'.repeat(64) }];
  const policy = { schemaVersion: 1, coreRootDocs: ['README.md', 'AGENTS.md', 'CONTRIBUTING.md'], legacyRootDocs: ['ROADMAP-OLD.md'], inFlightRootDocs: [] };
  write('docs/repository-policy.json', policy);
  write('docs/scope-sources.json', scope);
  write('checkpoint.json', { dungeon: { state: 'open' } });
  write('acceptance.json', { requirements: [] });
  write('README.md', '[Index](docs/INDEX.md)');
  write('AGENTS.md', '# Start'); write('CONTRIBUTING.md', '# Beitragen');
  write('ROADMAP-OLD.md', '# Legacy\n[Historical private QA](file:///unavailable/cache)');
  write('docs/INDEX.md', '[Legacy](../ROADMAP-OLD.md)\n[Guide](GUIDE.md)');
  write('docs/GUIDE.md', '# Prüfung\n# Prüfung\n[Second](#prüfung-1)\n[Readme](../README.md)');
  const files = () => fs.readdirSync(root, { recursive: true }).filter(f => fs.statSync(path.join(root, f)).isFile()).map(f => f.split(path.sep).join('/'));
  return { root, write, policy, scope, check: () => checkRepository(root, files()) };
}

test('normal edits keep historical source hashes and legacy paths usable', t => {
  const f = fixture(t);
  assert.deepEqual(f.check(), []); // The pinned SHA need not equal today's README bytes.
});
test('a new root plan is rejected even when someone adds it to the index', t => {
  const f = fixture(t); f.write('ROADMAP-NEW.md', '# New'); f.write('ROADMAP-UPPER.MD', '# New');
  f.write('docs/INDEX.md', '[Old](../ROADMAP-OLD.md)\n[New](../ROADMAP-NEW.md)\n[Guide](GUIDE.md)');
  assert(f.check().some(e => e.includes('ROADMAP-NEW.md: new root document')));
  assert(f.check().some(e => e.includes('ROADMAP-UPPER.MD: new root document')));
});
test('a deleted or renamed document leaves a failing local link', t => {
  const f = fixture(t); fs.renameSync(path.join(f.root, 'docs/GUIDE.md'), path.join(f.root, 'docs/RENAMED.md'));
  assert(f.check().some(e => e.includes('missing local link target GUIDE.md')));
});
test('wrong anchors fail, including in otherwise reachable documentation', t => {
  const f = fixture(t); f.write('docs/GUIDE.md', '# Prüfung\n[Broken](#missing)');
  assert(f.check().some(e => e.includes('missing Markdown anchor')));
});
test('unindexed documentation and removed legacy index entries fail', t => {
  const f = fixture(t); f.write('docs/LOST.md', '# Lost'); f.write('docs/INDEX.md', '[Guide](GUIDE.md)');
  assert(f.check().some(e => e.includes('LOST.md: not reachable')));
  assert(f.check().some(e => e.includes('ROADMAP-OLD.md: root Fachplan missing')));
});
test('new package plans bind scope, owner, issue and checkpoint root', t => {
  const f = fixture(t); f.write('docs/INDEX.md', '[Old](../ROADMAP-OLD.md)\n[Guide](GUIDE.md)\n[Plan](plans/dungeon/trap.md)');
  f.write('docs/plans/dungeon/trap.md', '---\narea: dungeon\nowner: Agent\nissue: 46\nstatus: active\ncheckpoint: dungeon\n---\n# Plan');
  assert.deepEqual(f.check(), []);
  f.write('docs/plans/dungeon/trap.md', '---\narea: dungeon\nissue: 46\nstatus: active\ncheckpoint: someoneElse\n---\n# Plan');
  assert(f.check().some(e => e.includes('missing owner')));
  assert(f.check().some(e => e.includes('unknown checkpoint owner root')));
});
test('an obsolete plan must identify an existing successor', t => {
  const f = fixture(t); f.write('docs/INDEX.md', '[Old](../ROADMAP-OLD.md)\n[Guide](GUIDE.md)\n[Plan](plans/dungeon/trap.md)');
  f.write('docs/plans/dungeon/trap.md', '---\narea: dungeon\nowner: Agent\nissue: 46\nstatus: superseded\ncheckpoint: dungeon\n---\n# Old');
  assert(f.check().some(e => e.includes('superseded plan needs an existing successor')));
});
test('unknown and duplicate source identities are caught', t => {
  const f = fixture(t); f.scope.technical_needs.push(f.scope.technical_needs[0]);
  f.scope.capability_acceptance_references[0].technical_needs.push('TN-UNKNOWN');
  f.write('docs/scope-sources.json', f.scope);
  assert(f.check().some(e => e.includes('duplicate identity')));
  assert(f.check().some(e => e.includes('unknown need TN-UNKNOWN')));
});
test('Markdown examples are ignored; reference links and angle-bracket paths are checked', t => {
  const f = fixture(t); f.write('docs/GUIDE.md', '# Guide\n```md\n[Example](missing.md)\n```\n~~~md\n[Example](missing.md)\n~~~\n`[Example](missing.md)`\n[Reference][r]\n[r]: <space guide.md>\n[Space](<space guide.md>)');
  f.write('docs/space guide.md', '# Space');
  assert.deepEqual(f.check(), []);
  assert.deepEqual(markdownLinks('<!-- [No](missing.md) -->\n[Yes](real.md)'), ['real.md']);
});
test('already published candidate paths remain compatible when indexed by pinned source', t => {
  const f = fixture(t), source = `https://github.com/example/repo/blob/${'a'.repeat(40)}/ROADMAP-INFLIGHT.md`;
  f.policy.inFlightRootDocs.push({ path: 'ROADMAP-INFLIGHT.md', source, reason: 'Existing candidate' });
  f.write('docs/repository-policy.json', f.policy); f.write('ROADMAP-INFLIGHT.md', '# Existing');
  f.write('docs/INDEX.md', `[Old](../ROADMAP-OLD.md)\n[Guide](GUIDE.md)\n[Incoming](${source})`);
  assert.deepEqual(f.check(), []);
});
test('ready cannot also be active or blocked; active may be blocked; closed releases work labels', () => {
  assert.equal(validateIssueStates([{ number: 1, state: 'open', labels: ['status:ready', 'status:active'] }]).length, 1);
  assert.equal(validateIssueStates([{ number: 2, state: 'open', labels: ['status:ready', 'status:blocked'] }]).length, 1);
  assert.deepEqual(validateIssueStates([{ number: 3, state: 'open', labels: ['status:active', 'status:blocked'] }]), []);
  assert.equal(validateIssueStates([{ number: 4, state: 'closed', labels: ['status:active'] }]).length, 1);
});

test('directory links can lead through their README to indexed child documents', t => {
  const f = fixture(t); f.write('docs/INDEX.md', '[Old](../ROADMAP-OLD.md)\n[Guide](GUIDE.md)\n[Subdirectory](guides/)');
  f.write('docs/guides/README.md', '# Guides\n[Child](child.md)'); f.write('docs/guides/child.md', '# Child');
  assert.deepEqual(f.check(), []);
});
test('a malformed source collection gives a specific diagnostic without crashing', t => {
  const f = fixture(t); f.scope.source_requirements = {}; f.write('docs/scope-sources.json', f.scope);
  assert(f.check().some(e => e.includes('invalid collection source_requirements')));
});
