import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { bodyHash, workSection, replaceWork, liveFacts, recentComments, taskContext } from '../tools/task-state.mjs';
import { updateTask } from '../tools/update-task.mjs';

const body = '## Nutzerergebnis\nOriginal scope and owner A.\n\n## Aktueller Arbeitsstand\n\nOld blocker.\n\n## Abnahme\nUnapproved native gate.\n';
const issue = b => ({ number: 68, html_url: 'https://github.com/test/repo/issues/68', title: 'World',
  body: b, state: 'open', labels: [{ name: 'kind:task' }, { name: 'status:active' }], updated_at: '2026-10-10T12:00:00Z' });
const request = { expectedBodySha256: bodyHash(body), expectedUpdatedAt: issue(body).updated_at, content: 'New missing input; owner remains A.' };

function harness(reads = [issue(body)]) {
  const calls = []; let index = 0, stored;
  const call = (args, input) => {
    calls.push({ args, input });
    if (args.includes('PATCH')) { stored = JSON.parse(input); return JSON.stringify(issue(stored.body)); }
    return JSON.stringify(index < reads.length ? reads[index++] : issue(stored?.body ?? body));
  };
  return { call, calls };
}

test('section replacement preserves scope, ownership and acceptance byte-for-byte; fences do not create fake sections', () => {
  const next = replaceWork(body, 'New status.');
  const before = workSection(body), after = workSection(next);
  assert.equal(next.slice(0, after.start), body.slice(0, before.start));
  assert.equal(next.slice(after.end), body.slice(before.end));
  assert.equal(replaceWork(next, 'New status.'), next);
  const example = '## Goal\n```md\n## Aktueller Arbeitsstand\n```\n';
  assert.equal(workSection(example), null);
  assert.equal(workSection(replaceWork(example, 'Ready')).start, example.length + 1);
  assert.throws(() => replaceWork(body, '## Abnahme\nInvented pass'), /headings/);
  assert.throws(() => replaceWork(body, '```md\nUnclosed fence'), /code fences/);
  assert.throws(() => workSection(body + '\n## Aktueller Arbeitsstand\nOther owner'), /Duplicate/);
});

test('GitHub form level-3 headings use the same section and preserve the following acceptance fields', () => {
  const form = '### Nutzerergebnis\nGoal\n\n### Aktueller Arbeitsstand\nOld\n\n### Abnahme und nächster Empfänger\nNative pending\n';
  const result = replaceWork(form, 'New blocker');
  assert.equal(workSection(result).heading, '### Aktueller Arbeitsstand');
  assert.match(result, /### Abnahme und nächster Empfänger\nNative pending/);
  assert.equal((result.match(/Aktueller Arbeitsstand/g) ?? []).length, 1);
});

test('preview is read-only and preserves fixed scope; apply is rejected even when callers still request it', () => {
  const h = harness(); const preview = updateTask(h.call, 'test/repo', 68, request);
  assert.equal(preview.changed, true); assert.equal(preview.mode, 'preview-only');
  assert.match(preview.after, /New missing input/); assert.equal(h.calls.length, 1);
  assert.equal('verified' in preview, false);
  const current = replaceWork(body, request.content);
  const same = harness([issue(current)]);
  assert.equal(updateTask(same.call, 'test/repo', 68, { ...request, expectedBodySha256: bodyHash(current) }).changed, false);
  assert.throws(() => updateTask(() => assert.fail('apply must not access GitHub'), 'test/repo', 68, request, true), /publication disabled/);
  assert.equal(h.calls.filter(c => c.input).length, 0);
});

test('stale previews, non-tasks and unsupported fields are rejected', () => {
  assert.throws(() => updateTask(harness([issue(body + 'foreign')]).call, 'test/repo', 68, request), /Incoming task change/);
  for (const bad of [{ ...issue(body), state: 'closed' }, { ...issue(body), labels: [] }])
    assert.throws(() => updateTask(harness([bad]).call, 'test/repo', 68, request), /closed or is not/);
  assert.throws(() => updateTask(harness().call, 'test/repo', 68, { ...request, labels: [] }), /no ownership/);
});

test('valid indented/trailing-hash/setext boundaries preserve following acceptance; malformed fences fail closed', () => {
  for (const following of ['  ## Abnahme', '### Abnahme ###', 'Abnahme\n---']) {
    const level = following.startsWith('###') ? '###' : '##';
    const original = `${level} Aktueller Arbeitsstand\nOld\n\n${following}\nNot approved\n`;
    assert.match(replaceWork(original, 'New'), /Not approved/);
  }
  assert.throws(() => replaceWork(body + '\n```md\nAmbiguous', 'New'), /Unclosed/);
  assert.throws(() => replaceWork(body, 'Heading\n---'), /headings/);
  assert.throws(() => replaceWork(body, '#### Invented acceptance'), /headings/);
});

test('only explicit current links are queried; candidate and inputs show live facts without treating closed input as acceptance', () => {
  const current = replaceWork(body, 'Kandidat: https://github.com/test/repo/pull/75\nEingang: https://github.com/test/repo/issues/41\nWarte auf Integration.');
  const calls = [];
  const result = liveFacts(args => { calls.push(args); return JSON.stringify(args[0] === 'pr'
    ? { state: 'MERGED', headRefOid: 'new-head', statusCheckRollup: [{ name: 'check', conclusion: 'SUCCESS' }] }
    : { state: 'closed', html_url: 'https://github.com/test/repo/issues/41' }); }, 'test/repo', current + '\nHistorical https://github.com/test/repo/pull/13');
  assert.equal(calls.length, 2); assert.equal(result.facts[0].head, 'new-head');
  assert.equal(result.facts[1].state, 'closed'); assert.match(result.warnings[0], /not package\/product acceptance/);
});

test('missing live metadata remains explicitly unavailable; default reads never reconstruct historical claims', () => {
  const result = liveFacts(() => { throw new Error('401'); }, 'test/repo', replaceWork(body, 'Kandidat: https://github.com/test/repo/pull/75'));
  assert.deepEqual(result.facts, []); assert.match(result.warnings[0], /unavailable.*401/);
  assert.equal(liveFacts(() => assert.fail(), 'test/repo', 'Legacy PR #75').warnings.length, 1);
});

test('comment retrieval requests only the latest three and never the complete chronological connection', () => {
  const result = recentComments(args => { assert.match(args.join(' '), /comments\(last:3\)/);
    return JSON.stringify({ data: { repository: { issue: { comments: { nodes: [{ url: 'claim', body: 'decision' }] } } } } }); }, 'test/repo', 68);
  assert.equal(result[0].url, 'claim');
});

const revision = 'a'.repeat(40);
const pointer = 'Arbeitsstand: https://github.com/test/repo/blob/active/installed-phase1/PLAN.md#arbeitsstand-68';
function remote(content, calls = []) {
  return args => {
    calls.push(args);
    if (args[1] === 'repos/test/repo') return JSON.stringify({ default_branch: 'active/installed-phase1' });
    if (args[1].includes('/commits/')) return JSON.stringify({ sha: revision });
    if (args[1].includes('/contents/')) {
      assert.equal(args[1], `repos/test/repo/contents/PLAN.md?ref=${revision}`);
      return JSON.stringify({ type: 'file', encoding: 'base64', content: Buffer.from(content).toString('base64') });
    }
    if (args[0] === 'pr') return JSON.stringify({ state: 'OPEN', headRefOid: 'live-head' });
    assert.fail(`Unexpected request: ${args}`);
  };
}

test('versioned context reads one default-branch revision, bounded named section and explicit live candidate', () => {
  const calls = [];
  const result = taskContext(remote('### SMR-02\nStable scope\n#### Arbeitsstand #68\nKandidat: https://github.com/test/repo/pull/75\nNext GUI, native unapproved.\n### SMR-03\nUnrelated history', calls), 'test/repo', 68, pointer);
  assert.equal(result.source.mode, 'shared'); assert.equal(result.source.branch, 'active/installed-phase1');
  assert.equal(result.source.revision, revision); assert.match(result.source.text, /Next GUI/);
  assert.doesNotMatch(result.source.text, /Stable scope|Unrelated history/);
  assert.equal(result.facts[0].head, 'live-head'); assert.deepEqual(result.warnings, []);
  assert.equal(calls.length, 4);
});

test('missing, duplicate, oversized, unsafe and unavailable versioned sources do not fall back to old prose or comments', () => {
  for (const content of ['### Other', '#### Arbeitsstand #68\nA\n#### Arbeitsstand #68\nB',
    '#### Arbeitsstand #68\n' + 'x'.repeat(6001)]) {
    const result = taskContext(remote(content), 'test/repo', 68, pointer);
    assert.equal(result.source, null); assert.deepEqual(result.facts, []); assert.match(result.warnings[0], /No historical fallback/);
  }
  for (const link of [pointer + '\n' + pointer, pointer.replace('test/repo', 'foreign/repo'),
    pointer.replace('PLAN.md', '../PLAN.md'), pointer.replace('68', '69'), pointer.replace('active/installed-phase1', 'otherbranch')]) {
    assert.equal(taskContext(remote(''), 'test/repo', 68, link).source, null);
  }
  const unavailable = taskContext(() => { throw new Error('401'); }, 'test/repo', 68, pointer);
  assert.match(unavailable.warnings[0], /401/);
  const duplicate = taskContext(remote('#### Arbeitsstand #68\nNew'), 'test/repo', 68, pointer + '\n' + body);
  assert.match(duplicate.warnings[0], /duplicate/);
});

test('explicit ownerbranch URL resolves only its named ref and loads that exact SHA as candidate context', () => {
  const candidate = 'b'.repeat(40), calls = [];
  const link = pointer.replace('active/installed-phase1', 'city/manual-session-planner');
  const call = args => {
    calls.push(args);
    if (args[1] === 'repos/test/repo') return JSON.stringify({ default_branch: 'active/installed-phase1' });
    if (args[1] === 'repos/test/repo/git/matching-refs/heads/city') return JSON.stringify([
      { ref: 'refs/heads/city/other', object: { type: 'commit', sha: revision } },
      { ref: 'refs/heads/city/manual-session-planner', object: { type: 'commit', sha: candidate } }]);
    assert.equal(args[1], `repos/test/repo/contents/PLAN.md?ref=${candidate}`);
    return JSON.stringify({ type: 'file', encoding: 'base64', content: Buffer.from('#### Arbeitsstand #68\nStart the delivered GUI. Native Save unapproved.').toString('base64') });
  };
  const result = taskContext(call, 'test/repo', 68, link);
  assert.equal(result.source.branch, 'city/manual-session-planner');
  assert.equal(result.source.mode, 'candidate'); assert.equal(result.source.revision, candidate);
  assert.match(result.source.text, /delivered GUI/); assert.deepEqual(result.warnings, []);
  assert.equal(calls.length, 3); assert(!calls.some(c => c[0] === 'pr' || c[1]?.includes('/commits/')));
});

test('deleted or ambiguous declared ownerbranch never falls back to Shared or another candidate', () => {
  for (const refs of [[], [
    { ref: 'refs/heads/city', object: { type: 'commit', sha: revision } },
    { ref: 'refs/heads/city/manual-session-planner', object: { type: 'commit', sha: revision } }]]) {
    const calls = [];
    const result = taskContext(args => {
      calls.push(args);
      return JSON.stringify(args[1] === 'repos/test/repo' ? { default_branch: 'main' } : refs);
    }, 'test/repo', 68, pointer.replace('active/installed-phase1', 'city/manual-session-planner'));
    assert.equal(result.source, null); assert.deepEqual(result.facts, []);
    assert.match(result.warnings[0], /missing or ambiguous.*No historical fallback/);
    assert.equal(calls.length, 2);
  }
});

test('versioned tasks cannot create a second issue work section through the preview helper', () => {
  const b = pointer;
  assert.throws(() => updateTask(harness([issue(b)]).call, 'test/repo', 68,
    { ...request, expectedBodySha256: bodyHash(b) }), /edit the linked plan/);
});

test('ordinary Git publication rejects stale parallel writes and exposes a shared-section conflict without losing either commit', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'task-git-conflict-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const git = (cwd, args, ok = true) => {
    const result = spawnSync('git', args, { cwd, encoding: 'utf8', env: { ...process.env,
      GIT_AUTHOR_NAME: 'Task test', GIT_AUTHOR_EMAIL: 'test@example.invalid',
      GIT_COMMITTER_NAME: 'Task test', GIT_COMMITTER_EMAIL: 'test@example.invalid' } });
    if (ok) assert.equal(result.status, 0, result.stderr);
    return result;
  };
  git(root, ['init', '--bare', '--initial-branch=main', 'remote.git']);
  git(root, ['clone', 'remote.git', 'a']);
  const a = path.join(root, 'a'), b = path.join(root, 'b');
  fs.writeFileSync(path.join(a, 'PLAN.md'), '#### Arbeitsstand #68\nBase input\n');
  git(a, ['add', 'PLAN.md']); git(a, ['commit', '-m', 'base']); git(a, ['push', 'origin', 'main']);
  git(root, ['clone', 'remote.git', 'b']);
  fs.writeFileSync(path.join(a, 'PLAN.md'), '#### Arbeitsstand #68\nFirst contributor input\n');
  git(a, ['commit', '-am', 'first']); const first = git(a, ['rev-parse', 'HEAD']).stdout.trim();
  fs.writeFileSync(path.join(b, 'PLAN.md'), '#### Arbeitsstand #68\nSecond contributor input\n');
  git(b, ['commit', '-am', 'second']); const second = git(b, ['rev-parse', 'HEAD']).stdout.trim();
  git(a, ['push', 'origin', 'main']);
  assert.notEqual(git(b, ['push', 'origin', 'main'], false).status, 0);
  git(b, ['fetch', 'origin']);
  assert.equal(git(b, ['rev-parse', 'origin/main']).stdout.trim(), first);
  assert.equal(git(b, ['rev-parse', 'HEAD']).stdout.trim(), second);
  assert.notEqual(git(b, ['merge', '--no-edit', 'origin/main'], false).status, 0);
  const conflict = fs.readFileSync(path.join(b, 'PLAN.md'), 'utf8');
  assert.match(conflict, /First contributor input/); assert.match(conflict, /Second contributor input/);
  assert.match(conflict, /<<<<<<<|>>>>>>>/);
  git(b, ['merge', '--abort']);
  assert.equal(git(b, ['rev-parse', 'HEAD']).stdout.trim(), second);
});
