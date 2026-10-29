import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { inspectBaselineEvidence } from '../../tools/native-baseline-evidence.mjs';
import { nativeRuntimeArtifacts } from '../../tools/native-process.mjs';

test('completed native receipts require assertions, renderer observations, normal exits, fresh bound captures and runtime identity', async () => {
  const folder = await mkdtemp(path.join(os.tmpdir(), 'native-evidence-'));
  const bytes = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==',
    'base64',
  );
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  const artifacts = Object.fromEntries(
    nativeRuntimeArtifacts.map((file) => [file, 'a'.repeat(64)]),
  );
  const receipt = {
    profile: '/synthetic-isolated-profile',
    step: 'all scenario assertions and cleanup complete',
    starts: [{ outcome: 'ready' }],
    artifacts,
    errors: [],
    cleanup: [],
    launches: [
      {
        pid: 12,
        zoom: 1,
        pidAbsent: true,
        exit: { code: 0, signal: null },
        captures: [{ file: 'native.png', sha256, fresh: true, zoom: 1, width: 1, height: 1 }],
      },
    ],
  };
  const probe = { name: 'synthetic', binding: { artifacts } };
  const inspect = async (value, exit = { code: 0 }) => {
    await writeFile(path.join(folder, 'result.json'), JSON.stringify(value));
    return inspectBaselineEvidence(folder, exit, probe);
  };
  try {
    await writeFile(path.join(folder, 'native.png'), bytes);
    assert.equal((await inspect(receipt)).error, null);
    for (const corrupt of [
      (r) => delete r.profile,
      (r) => delete r.step,
      (r) => r.starts.push({ outcome: 'failed' }),
      (r) => delete r.artifacts[nativeRuntimeArtifacts[0]],
      (r) => (r.artifacts[nativeRuntimeArtifacts[0]] = 'b'.repeat(64)),
      (r) => r.errors.push('renderer failed'),
      (r) => r.cleanup.push({ forced: true, pidAbsent: true }),
      (r) => (r.launches[0].exit.code = 1),
      (r) => delete r.launches[0].pidAbsent,
      (r) => (r.launches[0].zoom = 2),
      (r) => (r.launches[0].captures = []),
      (r) => (r.launches[0].captures[0].fresh = false),
      (r) => (r.launches[0].captures[0].zoom = 2),
      (r) => (r.launches[0].captures[0].sha256 = 'c'.repeat(64)),
      (r) => (r.launches[0].captures[0].width = 2),
    ]) {
      const invalid = structuredClone(receipt);
      corrupt(invalid);
      assert.notEqual((await inspect(invalid)).error, null, String(corrupt));
    }
    assert.notEqual((await inspect({ launches: [{ pid: 12 }] })).error, null);
    await inspect(receipt);
    await writeFile(path.join(folder, 'failure.json'), JSON.stringify({ error: 'masked failure' }));
    assert.match((await inspect(receipt)).error, /failure evidence/);
    await rm(path.join(folder, 'failure.json'));
    assert.equal((await inspect(receipt, { code: 1 })).unknownOwnership, true);
    await writeFile(
      path.join(folder, 'wrapper-failure.json'),
      JSON.stringify({ remainingOwnedPids: [], exitCode: 1 }),
    );
    assert.equal((await inspect(receipt, { code: 1 })).unknownOwnership, false);
    await writeFile(
      path.join(folder, 'wrapper-failure.json'),
      JSON.stringify({ remainingOwnedPids: [12], exitCode: 1 }),
    );
    assert.equal((await inspect(receipt, { code: 1 })).unknownOwnership, true);
    await rm(path.join(folder, 'result.json'));
    await writeFile(
      path.join(folder, 'wrapper-failure.json'),
      JSON.stringify({ remainingOwnedPids: [], leakedOwnedPids: [], exitCode: 1 }),
    );
    const controlled = {
      ...structuredClone(receipt),
      error: 'Expected narrow opening fault',
      step: 'normal native exit confirmed',
    };
    await writeFile(path.join(folder, 'failure.json'), JSON.stringify(controlled));
    const negative = {
      ...probe,
      kind: 'negative-control',
      negativeControl: {
        error: 'Expected narrow opening fault',
        reason: 'Test the detector itself',
      },
    };
    const detected = await inspectBaselineEvidence(folder, { code: 1, signal: null }, negative);
    assert.equal(detected.error, null);
    assert(detected.negativeControl);
    assert.notEqual(
      (await inspectBaselineEvidence(folder, { code: 0, signal: null }, negative)).error,
      null,
    );
    controlled.error = 'Unrelated fixture error';
    await writeFile(path.join(folder, 'failure.json'), JSON.stringify(controlled));
    assert.notEqual(
      (await inspectBaselineEvidence(folder, { code: 1, signal: null }, negative)).error,
      null,
    );
    await rm(path.join(folder, 'failure.json'));
    await rm(path.join(folder, 'wrapper-failure.json'));
    const development = {
      ...structuredClone(receipt),
      passed: true,
      rendererErrors: [],
      launches: [
        {
          ...structuredClone(receipt.launches[0]),
          artifacts: { ...artifacts },
          capture: 'native.png',
          captureSha256: sha256,
          captureSize: { width: 1, height: 1 },
          capturedAt: new Date().toISOString(),
        },
      ],
    };
    const adapterInspect = async (value, name) => {
      await writeFile(path.join(folder, 'result.json'), JSON.stringify(value));
      return inspectBaselineEvidence(folder, { code: 0, signal: null }, { kind: 'adapter', name });
    };
    assert.equal((await adapterInspect(development, 'development')).error, null);
    const missingGeneration = structuredClone(development);
    delete missingGeneration.launches[0].artifacts['main.cjs'];
    assert.notEqual((await adapterInspect(missingGeneration, 'development')).error, null);
    for (const version of ['90.0.0', '90.0.1'])
      await writeFile(path.join(folder, 'renderer-' + version + '.json'), '[]');
    const packaged = {
      ...structuredClone(receipt),
      passed: true,
      adapter: 'packaged-update-synthetic',
      root: path.join(folder, 'runtime'),
    };
    packaged.launches[0].artifacts = Object.fromEntries(
      Object.entries(artifacts).map(([file, hash]) => ['resources/app/' + file, hash]),
    );
    packaged.launches[0].artifacts.electron = 'b'.repeat(64);
    assert.equal((await adapterInspect(packaged, 'updates')).error, null);
    delete packaged.launches[0].artifacts['resources/app/preload.cjs'];
    assert.notEqual((await adapterInspect(packaged, 'updates')).error, null);
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
});
