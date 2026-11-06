import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { assertNativeCompletion } from './native-session.mjs';
import { nativeRuntimeArtifacts } from './native-process.mjs';

async function jsonFiles(directory) {
  const files = [];
  for (const item of await readdir(directory, { withFileTypes: true })) {
    if (item.isDirectory() && !item.name.startsWith('profile'))
      files.push(...(await jsonFiles(path.join(directory, item.name))));
    else if (item.isFile() && item.name.endsWith('.json'))
      files.push(path.join(directory, item.name));
  }
  return files;
}
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
async function assertCapture(file, sha256, size) {
  assert.equal(typeof file, 'string', 'Capture path missing');
  const bytes = await readFile(file);
  assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', 'Capture is not a PNG');
  assert.equal(digest(bytes), sha256, 'Capture hash mismatch');
  assert(size?.width > 0 && size?.height > 0, 'Capture dimensions missing');
  assert.equal(bytes.readUInt32BE(16), size.width, 'PNG width mismatch');
  assert.equal(bytes.readUInt32BE(20), size.height, 'PNG height mismatch');
}

export async function assertBaselineReceipt(
  file,
  receipt,
  { name, kind = 'session', binding, failure = false } = {},
) {
  assert.equal(typeof receipt.profile, 'string', 'Isolated native profile missing');
  assert(!receipt.cleanupError, 'Receipt records a cleanup failure');
  if (failure) assert.equal(typeof receipt.error, 'string', 'Expected failure has no error');
  else assert(!receipt.error, 'Receipt records a native failure');
  const development = kind === 'adapter' && name === 'development';
  const update = kind === 'adapter' && /^updates(?:-|$)/.test(name);
  let errors = receipt.errors;
  if (development) {
    assert.equal(receipt.passed, true, 'Development assertions did not complete');
    errors = receipt.rendererErrors;
  } else if (update) {
    assert.equal(receipt.passed, true, 'Packaged update assertions did not complete');
    assert(receipt.adapter?.startsWith('packaged-update'), 'Wrong package protocol');
    errors = [];
    for (const version of ['90.0.0', '90.0.1']) {
      const observed = JSON.parse(
        await readFile(path.join(path.dirname(receipt.root), `renderer-${version}.json`), 'utf8'),
      );
      assert(Array.isArray(observed), 'Packaged renderer observations missing');
      errors.push(...observed);
    }
  } else {
    if (!failure)
      assert.equal(
        receipt.step,
        'all scenario assertions and cleanup complete',
        'Session did not finish its assertions and cleanup',
      );
    assert(
      Array.isArray(receipt.starts) && receipt.starts.length === receipt.launches.length,
      'Every native start needs completion evidence',
    );
    assert(
      receipt.starts.every((start) => start.outcome === 'ready'),
      'A requested native start failed',
    );
    assert.deepEqual(
      Object.keys(receipt.artifacts ?? {}).sort(),
      [...nativeRuntimeArtifacts].sort(),
      'Bound runtime artifacts missing',
    );
    if (binding)
      assert.deepEqual(receipt.artifacts, binding.artifacts, 'Runtime differs from bound baseline');
  }
  assertNativeCompletion(receipt.launches, errors, { allowConfirmedCrash: name === 'e2e01' });
  assert(Array.isArray(receipt.cleanup), 'Cleanup observations missing');
  assert(
    receipt.cleanup.every((entry) => !entry.forced && entry.pidAbsent === true),
    'Incomplete or forced cleanup',
  );
  for (const launch of receipt.launches) {
    assert(Number.isSafeInteger(launch.pid) && launch.pid > 0, 'Native PID missing');
    assert.equal(launch.zoom, 1, 'Actual native zoom must be 100%');
    if (development) {
      assert(launch.capturedAt, 'Development capture timestamp missing');
      await assertCapture(
        path.resolve(path.dirname(file), launch.capture),
        launch.captureSha256,
        launch.captureSize,
      );
      for (const artifact of nativeRuntimeArtifacts)
        assert.match(
          launch.artifacts?.[artifact] ?? '',
          /^[a-f0-9]{64}$/,
          'Development generation runtime artifact missing: ' + artifact,
        );
    } else {
      assert(
        Array.isArray(launch.captures) && launch.captures.length,
        'Every native launch needs a fresh capture',
      );
      for (const capture of launch.captures) {
        if (!update) {
          assert.equal(capture.fresh, true, 'Capture has no fresh frame evidence');
          assert.equal(capture.zoom, 1, 'Captured native zoom must be 100%');
        }
        await assertCapture(
          path.resolve(path.dirname(file), capture.file),
          capture.sha256,
          capture,
        );
      }
      if (update) {
        assert.match(
          launch.artifacts?.electron ?? '',
          /^[a-f0-9]{64}$/,
          'Package executable binding missing',
        );
        for (const artifact of nativeRuntimeArtifacts)
          assert.match(
            launch.artifacts?.['resources/app/' + artifact] ?? '',
            /^[a-f0-9]{64}$/,
            'Package launch runtime artifact missing: ' + artifact,
          );
      }
    }
  }
}

export async function inspectBaselineEvidence(directory, exit, scenario = {}) {
  const receipts = [],
    failures = [],
    wrappers = [],
    invalidReceipts = [];
  for (const file of await jsonFiles(directory)) {
    let value;
    try {
      value = JSON.parse(await readFile(file, 'utf8'));
    } catch {
      continue;
    }
    if (path.basename(file) === 'wrapper-failure.json') wrappers.push({ file, ...value });
    if (path.basename(file) === 'failure.json')
      failures.push({
        file,
        error: value.error,
        step: value.step,
        phase: value.phase,
        status: value.status,
        failures: value.failures,
        unexpectedError: value.unexpectedError,
      });
    if (
      !Array.isArray(value.launches) ||
      !value.launches.length ||
      path.basename(file) === 'failure.json'
    )
      continue;
    // Aggregate progress rows are not completed native sessions. A receipt must
    // identify its isolated profile and satisfy its explicitly selected protocol.
    if (typeof value.profile !== 'string') continue;
    try {
      await assertBaselineReceipt(file, value, scenario);
      receipts.push(file);
    } catch (error) {
      invalidReceipts.push({ file, error: error.message });
    }
  }
  const unknownOwnership =
    (exit.code !== 0 && !wrappers.length) ||
    wrappers.some(
      (item) => !Array.isArray(item.remainingOwnedPids) || item.remainingOwnedPids.length > 0,
    );
  if (scenario.kind === 'negative-control') {
    let negativeControl = null,
      error = null;
    try {
      assert(
        exit.code !== 0 && exit.signal === null,
        'Negative control must fail through its intended assertion',
      );
      assert(!unknownOwnership, 'Negative control has unresolved process ownership');
      assert(
        wrappers.every(
          (item) => Array.isArray(item.leakedOwnedPids) && !item.leakedOwnedPids.length,
        ),
        'Negative control leaked owned processes',
      );
      assert.equal(failures.length, 1, 'Negative control needs one complete failure receipt');
      const target = failures[0],
        value = JSON.parse(await readFile(target.file, 'utf8'));
      assert(!value.unexpectedError, 'Negative control failed before its intended assertion');
      if (scenario.negativeControl.check) {
        assert(
          value.failures?.some((item) => item.check === scenario.negativeControl.check),
          'Expected fault-detection assertion did not fail',
        );
        assert(
          value.failures.every(
            (item) =>
              item.check === scenario.negativeControl.check ||
              /^retained-(?:undo|redo)-\d+$/.test(item.check),
          ),
          'Negative control has unrelated failures',
        );
        assert(
          Object.values(value.checks).every(
            (item) => item.status === 'PASS' || item.status === 'FAIL',
          ),
          'Negative control has unexecuted assertions',
        );
      } else
        assert(
          value.error.includes(scenario.negativeControl.error),
          'Expected fault-detection assertion did not fail',
        );
      await assertBaselineReceipt(target.file, value, {
        ...scenario,
        kind: 'session',
        failure: true,
      });
      negativeControl = { evidence: target.file, reason: scenario.negativeControl.reason };
    } catch (cause) {
      error = cause.message;
    }
    return {
      receipts: [],
      failures,
      wrappers,
      invalidReceipts,
      unknownOwnership,
      error,
      negativeControl,
    };
  }
  const error =
    exit.code === 0
      ? failures.length || wrappers.length
        ? 'Successful process contains native failure evidence'
        : invalidReceipts.length
          ? 'Native completion receipt failed technical validation'
          : !receipts.length
            ? 'Successful process has no complete native launch receipt in its evidence directory'
            : null
      : null;
  return { receipts, failures, wrappers, invalidReceipts, unknownOwnership, error };
}
