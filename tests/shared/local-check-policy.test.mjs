import test from 'node:test';
import assert from 'node:assert/strict';
import { testConcurrency } from '../../tools/local-check-policy.mjs';
test('local default remains serial regardless of available CPUs', () => {
  assert.equal(testConcurrency({ bytes: 7.3 * 1024 ** 3, cpus: 16, ci: false }), 1);
});
test('memory and CPU both bound explicit and CI concurrency', () => {
  assert.equal(testConcurrency({ bytes: 3 * 1024 ** 3, cpus: 16, ci: true }), 1);
  assert.throws(() => testConcurrency({ bytes: 3 * 1024 ** 3, cpus: 16, requested: 2 }));
  assert.equal(testConcurrency({ bytes: 16 * 1024 ** 3, cpus: 2, ci: true }), 2);
  assert.throws(() => testConcurrency({ serial: true, requested: 2 }));
});
