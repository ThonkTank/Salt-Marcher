import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { nativeBaselineBinding, assertBaselineBinding } from '../../../tools/native-baseline.mjs';
import {
  inspectBaselineEvidence,
  assertBaselineReceipt,
} from '../../../tools/native-baseline-evidence.mjs';
import { baselineResourceOwnershipKnown } from '../../../tools/native-baseline-resource-evidence.mjs';
const root = process.cwd(),
  directory = path.resolve(
    process.argv[2] ?? path.join(root, '.build/native-baseline-round10-final-20261029'),
  );
const report = JSON.parse(await readFile(path.join(directory, 'report.json'), 'utf8'));
const binding = JSON.parse(await readFile(path.join(directory, 'binding.json'), 'utf8'));
const failures = [],
  checked = [],
  technicalIssues = [],
  failedNativeEnds = [];
function absent(pid) {
  try {
    process.kill(pid, 0);
    return false;
  } catch (error) {
    if (error.code === 'ESRCH') return true;
    throw error;
  }
}
try {
  assertBaselineBinding(
    await nativeBaselineBinding(root),
    binding.binding,
    'Post-run source/runtime binding mismatch',
  );
} catch (error) {
  failures.push({ check: 'source-runtime-binding', error: error.message });
}
for (const row of report.results) {
  if (!row.endedAt || row.status === 'not-run') continue;
  try {
    assert.equal(row.resourceOwnershipKnown, true);
    assert(baselineResourceOwnershipKnown(row.resource), 'Resource cleanup no longer verifies');
    assert(absent(row.resource.supervisorPid), 'Resource supervisor PID remains present');
    const scenario = binding.scenarios.find((x) => x.name === row.name);
    assert(scenario);
    const observed = await inspectBaselineEvidence(row.directory, row.exit, {
      ...scenario,
      binding: binding.binding,
    });
    assert.equal(observed.unknownOwnership, false);
    if (row.status === 'passed') {
      assert.equal(observed.error, null);
      assert.equal(observed.failures.length, 0);
      assert.equal(observed.invalidReceipts.length, 0);
      assert(observed.receipts.length > 0);
      assert.deepEqual(observed.receipts, row.receipts);
    } else if (row.status === 'detected') {
      assert.equal(observed.error, null);
      assert(observed.negativeControl);
    }
    for (const wrapper of observed.wrappers) {
      assert.deepEqual(wrapper.remainingOwnedPids, []);
      if (wrapper.leakedOwnedPids?.length) {
        for (const pid of wrapper.leakedOwnedPids)
          assert(absent(pid), 'Reaped owned PID remains present');
        const issue = {
          name: row.name,
          status: row.status,
          check: 'regular-native-end',
          leakedOwnedPids: wrapper.leakedOwnedPids,
          remainingOwnedPids: [],
          allAbsent: true,
        };
        if (row.status === 'passed' || row.status === 'detected')
          throw Error('Qualified case needed wrapper process cleanup');
        technicalIssues.push(issue);
      }
    }
    for (const invalid of observed.invalidReceipts)
      technicalIssues.push({
        name: row.name,
        status: row.status,
        check: 'invalid-native-receipt',
        ...invalid,
      });
    const redFiles = [...observed.failures, ...observed.invalidReceipts].filter(
      (item, index, items) => items.findIndex((other) => other.file === item.file) === index,
    );
    for (const failure of redFiles) {
      const receipt = JSON.parse(await readFile(failure.file, 'utf8'));
      if (!receipt.profile || !Array.isArray(receipt.launches)) continue;
      failedNativeEnds.push({
        name: row.name,
        file: failure.file,
        launches: receipt.launches.map((launch) => ({
          pid: launch.pid,
          pidAbsentNow: absent(launch.pid),
          exit: launch.exit,
          receiptPidAbsent: launch.pidAbsent ?? null,
        })),
        cleanup: receipt.cleanup,
        rendererErrors: receipt.errors,
        cleanupError: receipt.cleanupError ?? null,
      });
      try {
        // Failure protocol can record pidAbsent on the matching cleanup entry.
        // Join existing raw observations; never rewrite the failure receipt or status.
        const validationReceipt = {
          ...receipt,
          launches: receipt.launches.map((launch) => {
            if (launch.pidAbsent !== undefined) return launch;
            const end = receipt.cleanup?.find(
              (item) =>
                item.kind === 'electron' &&
                item.pid === launch.pid &&
                JSON.stringify(item.exit) === JSON.stringify(launch.exit),
            );
            return { ...launch, pidAbsent: end?.pidAbsent };
          }),
        };
        await assertBaselineReceipt(failure.file, validationReceipt, {
          ...scenario,
          binding: binding.binding,
          failure: typeof receipt.error === 'string',
        });
        for (const launch of receipt.launches)
          assert(absent(launch.pid), 'Failed native receipt PID remains present');
      } catch (error) {
        technicalIssues.push({
          name: row.name,
          status: row.status,
          check: 'failure-technical-receipt',
          file: failure.file,
          error: error.message,
        });
      }
    }
    let launches = 0,
      captures = 0;
    for (const file of observed.receipts) {
      const receipt = JSON.parse(await readFile(file, 'utf8'));
      for (const item of receipt.cleanup ?? [])
        if (Number.isSafeInteger(item.pid))
          assert(absent(item.pid), 'Cleanup receipt PID remains present');
      for (const launch of receipt.launches) {
        assert(absent(launch.pid), 'Native receipt PID remains present');
        launches++;
        captures += launch.captures?.length ?? 1;
      }
    }
    checked.push({
      name: row.name,
      status: row.status,
      receipts: observed.receipts.length,
      launches,
      captures,
      resourceRemoved: row.resource.ownership?.removed,
      supervisorAbsent: true,
    });
  } catch (error) {
    failures.push({ name: row.name, status: row.status, error: error.message });
  }
}
const auditor = {
  file: 'docs/reference/native-baseline-round10-20261029/audit-final.mjs',
  sha256: createHash('sha256')
    .update(await readFile(new URL(import.meta.url)))
    .digest('hex'),
  validatorSourceHash: binding.binding.sources['tools/native-baseline-evidence.mjs'],
};
const output = {
  auditor,
  observedAt: new Date().toISOString(),
  closed: Boolean(report.endedAt),
  sourceDigest: binding.binding.sourceDigest,
  failureProtocol:
    'For red failure receipts only, absent launch.pidAbsent is read from an existing matching electron cleanup entry with the same PID and exit. Raw receipts remain unchanged; red status remains red.',
  scope:
    'Independent reread of completed immutable final-run receipts, PNG bytes/dimensions, renderer/normal-exit observations, full runtime binding and resource ownership; running/pending cases are not qualified.',
  checked,
  failedNativeEnds,
  technicalIssues,
  failures,
};
await writeFile(path.join(directory, 'posthoc-audit.json'), JSON.stringify(output, null, 2) + '\n');
console.log(
  JSON.stringify({
    closed: output.closed,
    checked: checked.length,
    passed: checked.filter((x) => x.status === 'passed').length,
    technicalIssues,
    failures,
  }),
);
if (failures.length) process.exitCode = 1;
