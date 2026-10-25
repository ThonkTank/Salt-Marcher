import { spawnSync } from 'node:child_process';
import { strict as assert } from 'node:assert';
import { test } from 'node:test';

test('maintenance inventory, checkpoint recovery and content-free character counting', () => {
  const result = spawnSync(
    'python3',
    [
      '-B',
      '-m',
      'unittest',
      'discover',
      '-s',
      'tools/agent-setup/tests',
      '-p',
      'test_maintenance.py',
    ],
    {
      encoding: 'utf8',
      timeout: 60_000,
    },
  );
  assert.equal(result.status, 0, result.stderr || result.error?.message || result.stdout);
});
