import assert from 'node:assert/strict';
import test from 'node:test';
import { bodyHash, workSection, replaceWork, liveFacts, recentComments } from '../tools/task-state.mjs';
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

test('dry run produces the exact section diff without writing; idempotent apply does not issue a PATCH', () => {
  const h = harness(); const preview = updateTask(h.call, 'test/repo', 68, request);
  assert.equal(preview.changed, true); assert.match(preview.after, /New missing input/);
  assert.equal(h.calls.length, 1);
  const current = replaceWork(body, request.content), same = harness([issue(current)]);
  assert.equal(updateTask(same.call, 'test/repo', 68, { ...request, expectedBodySha256: bodyHash(current) }, true).changed, false);
  assert.equal(same.calls.length, 1);
});

test('checked publication changes only body and verifies the result; no comments/labels/claims changed', () => {
  const h = harness([issue(body), issue(body)]); const result = updateTask(h.call, 'test/repo', 68, request, true);
  assert.equal(result.verified, true);
  const mutations = h.calls.filter(c => c.input);
  assert.equal(mutations.length, 1);
  assert.deepEqual(Object.keys(JSON.parse(mutations[0].input)), ['body']);
  assert.match(JSON.parse(mutations[0].input).body, /Original scope and owner A/);
});

test('incoming edits before initial read or between read and publication cause zero mutations', () => {
  for (const reads of [[issue(body + 'Foreign change')], [issue(body), issue(body + 'Foreign change')],
    [issue(body), { ...issue(body), updated_at: 'later' }]]) {
    const h = harness(reads);
    assert.throws(() => updateTask(h.call, 'test/repo', 68, request, true), /Incoming task change/);
    assert.equal(h.calls.filter(c => c.input).length, 0);
  }
});

test('non-tasks, closed issues and unsupported mutation fields are rejected', () => {
  for (const bad of [{ ...issue(body), state: 'closed' }, { ...issue(body), labels: [] }])
    assert.throws(() => updateTask(harness([bad]).call, 'test/repo', 68, request, true), /closed or is not/);
  assert.throws(() => updateTask(harness().call, 'test/repo', 68, { ...request, labels: [] }, true), /no ownership/);
});

test('unknown publication or failed read-back is not retried or rolled back', () => {
  const h = harness([issue(body), issue(body)]);
  const fail = (args, input) => { if (input) { h.calls.push({ args, input }); throw new Error('timeout'); } return h.call(args); };
  assert.throws(() => updateTask(fail, 'test/repo', 68, request, true), /outcome unknown/);
  assert.equal(h.calls.filter(c => c.input).length, 1);
  const conflict = harness([issue(body), issue(body), issue(body + 'Someone changed after PATCH')]);
  assert.throws(() => updateTask(conflict.call, 'test/repo', 68, request, true), /not confirmed/);
  assert.equal(conflict.calls.filter(c => c.input).length, 1);
  const unreadable = harness([issue(body), issue(body)]); let reads = 0;
  assert.throws(() => updateTask((args, input) => {
    if (!input && ++reads === 3) throw new Error('readback 401');
    return unreadable.call(args, input);
  }, 'test/repo', 68, request, true), /confirmation unavailable/);
  assert.equal(unreadable.calls.filter(c => c.input).length, 1);
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
