import { test } from 'node:test';
import assert from 'node:assert/strict';
import { baselineResourceOwnershipKnown } from '../../tools/native-baseline-resource-evidence.mjs';
const unit = 'salt-check-4d56f926-91a4-41ca-a199-55f48b7bdfd4';
const receipt = () => ({
  policy: 'delegated-2G-3G',
  evidence: '/fixture/local-checks/' + unit,
  cleanup: { removed: true },
  ownership: {
    unit,
    group: '/user.slice/user-1000.slice/user@1000.service/' + unit,
    empty: true,
    removed: true,
  },
});
test('only complete matching owned resource evidence allows independent probes to continue', () => {
  assert.equal(baselineResourceOwnershipKnown(receipt()), true);
  assert.equal(baselineResourceOwnershipKnown(null), false);
  for (const mutate of [
    (value) => (value.error = 'Resource cleanup failed'),
    (value) => (value.policy = 'existing-bounded'),
    (value) => delete value.ownership,
    (value) => (value.ownership.error = 'Owner marker absent'),
    (value) => (value.ownership.empty = false),
    (value) => (value.ownership.group += '-different'),
    (value) => (value.ownership.unit = 'unrelated'),
    (value) => (value.evidence += '-different'),
    (value) => (value.cleanup.removed = false),
    (value) => (value.ownership.removed = false),
  ]) {
    const value = receipt();
    mutate(value);
    assert.equal(baselineResourceOwnershipKnown(value), false, JSON.stringify(value));
  }
  const scope = receipt();
  scope.policy = 'systemd-2G-3G';
  scope.ownership.group += '.scope';
  scope.ownership.removed = false;
  delete scope.cleanup;
  assert.equal(
    baselineResourceOwnershipKnown(scope),
    true,
    'An actual empty owned scope may still await systemd collection',
  );
  scope.ownership.empty = false;
  assert.equal(baselineResourceOwnershipKnown(scope), false);
});
