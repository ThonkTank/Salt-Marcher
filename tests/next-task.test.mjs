import assert from 'node:assert/strict';
import test from 'node:test';
import { readyTasks } from '../tools/next-task.mjs';

const task = (number, extra = [], state = 'open') => ({ number, state, labels: ['kind:task', 'status:ready', ...extra] });
test('task discovery excludes owned, blocked, closed and coordination work even with a ready label', () => {
  const valid = task(4);
  assert.deepEqual(readyTasks([task(1, ['status:active']), task(2, ['status:blocked']), task(3, [], 'closed'), valid,
    { number: 5, state: 'open', labels: ['kind:coordination', 'status:ready'] }]), [valid]);
});
test('critical-path priority wins; equal priorities use a stable issue order', () => {
  assert.deepEqual(readyTasks([task(1), task(8, ['priority:next']), task(9, ['priority:now']), task(3, ['priority:next'])])
    .map(issue => issue.number), [9, 3, 8, 1]);
});
test('an empty queue stays empty; REST label objects are supported', () => {
  assert.deepEqual(readyTasks([task(1, ['status:blocked'])]), []);
  assert.equal(readyTasks([{ number: 1, state: 'open', labels: ['kind:task', 'status:ready'].map(name => ({ name })) }]).length, 1);
});
