import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { readyTasks, criticalTasks, supportTasks, taskCandidate, tasksForArea } from '../tools/next-task.mjs';

const task = (number, extra = [], state = 'open') => ({ number, state, labels: ['kind:task', 'status:ready', ...extra] });
test('task discovery excludes owned, blocked, closed and coordination work even with a ready label', () => {
  const valid = task(4);
  assert.deepEqual(readyTasks([task(1, ['status:active']), task(2, ['status:blocked']), task(3, [], 'closed'), valid,
    { number: 5, state: 'open', labels: ['kind:coordination', 'status:ready'] }]), [valid]);
});

test('support invitations on owned or blocked parents remain visible without becoming free work', () => {
  const owned = { number: 39, state: 'open', labels: ['kind:task', 'status:active', 'help wanted'] };
  const blocked = { ...owned, number: 41, labels: [...owned.labels, 'status:blocked'] };
  const closed = { ...owned, number: 42, state: 'closed' };
  const coordination = { ...owned, number: 12, labels: ['kind:coordination', 'help wanted'] };
  assert.deepEqual(supportTasks([blocked, closed, coordination, owned, task(1, ['help wanted'])]), [owned, blocked]);
  assert.deepEqual(readyTasks([owned, blocked]), []);
});

test('area selection respects shared atlas/city and GM/dungeon boundaries and rejects typos', () => {
  const city = task(1, ['area:atlas-city']);
  const gm = task(2, ['area:dungeon']);
  assert.deepEqual(tasksForArea([city, gm]), [city, gm]);
  assert.deepEqual(tasksForArea([city, gm], 'atlas'), [city]);
  assert.deepEqual(tasksForArea([city, gm], 'gm'), [gm]);
  assert.throws(() => tasksForArea([city], 'typo'), /Unknown area/);
});
test('critical-path priority wins; equal priorities use a stable issue order', () => {
  assert.deepEqual(readyTasks([task(1), task(8, ['priority:next']), task(9, ['priority:now']), task(3, ['priority:next'])])
    .map(issue => issue.number), [9, 3, 8, 1]);
});
test('an empty queue stays empty; REST label objects are supported', () => {
  assert.deepEqual(readyTasks([task(1, ['status:blocked'])]), []);
  assert.equal(readyTasks([{ number: 1, state: 'open', labels: ['kind:task', 'status:ready'].map(name => ({ name })) }]).length, 1);
});
test('equal priority prefers product delivery over preparatory documentation; critical documentation still wins', () => {
  assert.deepEqual(readyTasks([task(1, ['documentation', 'priority:next']), task(3, ['priority:next']),
    task(8, ['documentation', 'priority:now'])]).map(issue => issue.number), [8, 3, 1]);
});
test('critical owned work stays visible without becoming a free task or showing coordination as executable work', () => {
  const owned = { number: 38, state: 'open', labels: ['kind:task', 'priority:now', 'status:active'] };
  const closed = { ...owned, number: 39, state: 'closed' };
  const index = { number: 12, state: 'open', labels: ['kind:coordination', 'priority:now'] };
  assert.deepEqual(criticalTasks([closed, index, owned]), [owned]);
  assert.deepEqual(readyTasks([owned]), []);
});

test('candidate choice applies product priority across issues and PR support without a review-first bias', () => {
  const implementation = { number: 41, state: 'open', labels: ['kind:task', 'help wanted', 'priority:next'] };
  const review = { number: 66, state: 'open', labels: ['help wanted', 'priority:next'] };
  assert.equal(taskCandidate([implementation], [review]).number, 41);
  const bottleneckReview = { ...review, labels: ['help wanted', 'priority:now'] };
  assert.equal(taskCandidate([task(42, ['priority:next'])], [bottleneckReview]).source, 'pr');
  assert.equal(taskCandidate([task(42, ['priority:now'])], [review]).number, 42);
  assert.equal(taskCandidate([], [{ ...review, state: 'closed' }, { ...review, labels: [] }]), undefined);
});

test('free product packages enable parallel implementation before equal-priority support without bypassing bottlenecks', () => {
  const free = task(73, ['priority:next']);
  const support = { number: 58, state: 'open', labels: ['kind:task', 'status:active', 'help wanted', 'priority:next'] };
  const review = { number: 70, state: 'open', labels: ['help wanted', 'priority:next'] };
  assert.equal(taskCandidate([support, free], [review]).number, 73);
  assert.equal(taskCandidate([support, { ...free, labels: [...free.labels, 'status:active'] }], [review]).number, 58);
  assert.equal(taskCandidate([free, { ...support, labels: [...support.labels, 'priority:now'] }], [review]).number, 58);
  assert.equal(taskCandidate([task(1, ['priority:next', 'documentation']), support], []).number, 58);
  assert.equal(taskCandidate([free], [{ ...review, number: 73 }]).source, undefined);
});

test('owned-package resume works without queue access and still rejects closed/non-task targets', {
  skip: process.platform === 'win32' ? 'Executable gh stub requires POSIX' : false,
}, t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'next-resume-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, 'docs'));
  fs.mkdirSync(path.join(root, 'bin'));
  fs.writeFileSync(path.join(root, 'docs/repository-policy.json'), JSON.stringify({ repository: 'test/repo' }));
  fs.writeFileSync(path.join(root, 'bin/gh'), `#!/usr/bin/env node
const fs = require('node:fs');
const args = process.argv.slice(2);
fs.appendFileSync('calls.jsonl', JSON.stringify(args) + '\\n');
if (fs.existsSync('queue.json') && args[1] === 'list') {
  process.stdout.write(args[0] === 'issue' ? fs.readFileSync('queue.json', 'utf8') : '[]');
  process.exit(0);
}
const issue = JSON.parse(fs.readFileSync('issue.json', 'utf8'));
if (args[0] === 'api' && args[1] === 'graphql') {
  process.stdout.write(JSON.stringify({ data: { repository: { issue: { comments: { nodes: issue.comments.slice(-3) } } } } }));
  process.exit(0);
}
if (args[0] !== 'api' || args[1] !== 'repos/test/repo/issues/40') {
  process.stderr.write('Unrelated queue queries are unavailable');
  process.exit(8);
}
process.stdout.write(JSON.stringify({ ...issue, html_url: issue.url, state: issue.state.toLowerCase(), updated_at: '2026-10-10T12:00:00Z' }));
`, { mode: 0o755 });
  const issue = { number: 40, title: 'Save and fresh reopen', url: 'https://example.test/40',
    body: 'Continue the owned repair.', state: 'OPEN', labels: [{ name: 'kind:task' },
      { name: 'status:active' }, { name: 'status:blocked' }],
    comments: [1, 2, 3, 4].map(number => ({ url: `comment/${number}`,
      body: `handoff ${number}\n${'evidence '.repeat(100)}full-tail-${number}` })) };
  const run = (value, extra = [], resume = true) => {
    fs.writeFileSync(path.join(root, 'issue.json'), JSON.stringify(value));
    return spawnSync(process.execPath, [fileURLToPath(new URL('../tools/next-task.mjs', import.meta.url)),
      ...(resume ? ['--task', '40'] : []), ...extra], { cwd: root, encoding: 'utf8', env: { ...process.env,
        PATH: path.join(root, 'bin') + path.delimiter + process.env.PATH } });
  };
  const result = run(issue);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Requested package #40/);
  assert.match(result.stdout, /Continue the owned repair/);
  assert.doesNotMatch(result.stdout, /Live task queue|Free executable tasks|handoff 1/);
  assert.doesNotMatch(result.stdout, /handoff [1-4]/);
  const calls = fs.readFileSync(path.join(root, 'calls.jsonl'), 'utf8').trim().split('\n').map(JSON.parse);
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], ['api', 'repos/test/repo/issues/40']);
  assert.match(result.stdout, /older claims\/decisions must be checked explicitly/);
  assert.doesNotMatch(result.stdout, /full-tail/);
  assert(result.stdout.length < 2000, 'Default resume must not expand long evidence comments');
  const snapshot = run(issue, ['--json']);
  assert.equal(snapshot.status, 0, snapshot.stderr);
  assert.equal(JSON.parse(snapshot.stdout).body, issue.body);
  assert.match(JSON.parse(snapshot.stdout).bodySha256, /^[a-f0-9]{64}$/);
  const expanded = run(issue, ['--comments']);
  assert.equal(expanded.status, 0, expanded.stderr);
  for (const number of [2, 3, 4]) assert.match(expanded.stdout, new RegExp(`full-tail-${number}`));
  assert.doesNotMatch(expanded.stdout, /full-tail-1|comment preview/);
  for (const invalid of [{ ...issue, state: 'CLOSED' }, { ...issue, labels: [{ name: 'kind:coordination' }] }]) {
    const rejected = run(invalid);
    assert.equal(rejected.status, 1);
    assert.match(rejected.stderr, /closed or is not a work package/);
  }
  const free = { ...issue, labels: [{ name: 'kind:task' }, { name: 'status:ready' }] };
  const owned = { ...issue, number: 90, title: 'Unrelated owned package' };
  fs.writeFileSync(path.join(root, 'queue.json'), JSON.stringify([free, owned]));
  const compact = run(free, [], false);
  assert.equal(compact.status, 0, compact.stderr);
  assert.match(compact.stdout, /Free candidate #40/);
  assert.match(compact.stdout, /1 free packages, 0 support invitations/);
  assert.doesNotMatch(compact.stdout, /Unrelated owned package|Owned packages:/);
  const overview = run(free, ['--list'], false);
  assert.equal(overview.status, 0, overview.stderr);
  assert.match(overview.stdout, /Unrelated owned package/);
  assert.doesNotMatch(overview.stdout, /Continue the owned repair/);
});
