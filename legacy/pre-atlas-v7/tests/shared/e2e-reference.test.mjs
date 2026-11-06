import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { compareReference } from '../../tools/e2e-reference.mjs';

test('reference comparison preserves identities/effects and rejects mismatched or mutated replays', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'e2e-reference-test-'));
  const capsule = path.join(directory, 'capsule');
  const old = path.join(capsule, 'original/e2e02');
  const output = path.join(directory, 'new');
  const write = async (file, value) => {
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, JSON.stringify(value));
  };
  const report = {
    seedDatabaseHash: 'a'.repeat(64),
    source: 'b'.repeat(40),
    buildInfo: { commit: 'b'.repeat(40) },
    sourceHashes: {},
    host: { zoom: 1 },
    fixture: { a: 'campaign', heroes: [{ id: 'character' }] },
    artifacts: {},
    complete: false,
    workflowSubset: 'passed',
    profile: 'original-profile',
    scenarios: [{ id: 'E02-10-fresh-process', status: 'passed' }],
  };
  const state = {
    plan: [],
    planned_visit: [],
    session_profile: [],
    session_visit: [],
    prepared_group: [],
    encounter_plan: [],
    location: [],
    character_profile: [],
    character_progress: [{ id: 'character', payload: JSON.stringify({ xp: 33 }) }],
    character_ledger: [
      { payload: JSON.stringify({ characterId: 'character', name: 'key', quantity: 1 }) },
    ],
    combat: [{ id: 'combat-old' }],
    chase: [{ id: 'chase-old' }],
    combat_award: [{}],
    treasure: [{}],
    scene_adoption: [{}],
    scene_time_step: [{}],
  };
  try {
    await write(path.join(capsule, 'manifest.json'), { source: { digest: 'd'.repeat(64) } });
    await write(path.join(old, 'result.json'), report);
    await write(path.join(output, 'result.json'), { ...report, profile: 'fresh-profile' });
    await write(path.join(old, 'snapshots.json'), [{ state }]);
    await write(path.join(output, 'snapshots.json'), [
      { state: { ...state, combat: [{ id: 'combat-new' }], chase: [{ id: 'chase-new' }] } },
    ]);
    for (const kind of ['publish-failure', 'reply-loss']) {
      const fault = {
        fixture: report.fixture,
        seedDatabaseHash: report.seedDatabaseHash,
        injectedDatabaseHash: 'f'.repeat(64),
        faultAssertions: 'passed',
        profile: 'old-' + kind,
        before: { rows: [] },
        after: { rows: [] },
        faultSql: kind === 'publish-failure' ? 'controlled rejection' : undefined,
        trace: {
          response: { error: 'controlled write failure' },
          statusResponse: {
            value: { outcome: kind === 'publish-failure' ? 'not-applied' : 'applied' },
          },
        },
      };
      await write(path.join(old, kind, 'result.json'), fault);
      await write(path.join(output, kind, 'result.json'), { ...fault, profile: 'fresh-' + kind });
    }
    const compared = await compareReference(capsule, output);
    assert.deepEqual(compared.semanticEffects.progress, [{ character_id: 'character', xp: 33 }]);
    assert.equal(compared.fullE2E02, 'open');
    const currentFile = path.join(output, 'result.json');
    const current = JSON.parse(await readFile(currentFile, 'utf8'));
    for (const replacement of [
      { fixture: { ...current.fixture, a: 'wrong-campaign' } },
      { seedDatabaseHash: '0'.repeat(64) },
      { host: { zoom: 2 } },
      { profile: report.profile },
      { complete: true },
    ]) {
      await write(currentFile, { ...current, ...replacement });
      await assert.rejects(compareReference(capsule, output));
    }
    await write(currentFile, current);
    const failureFile = path.join(output, 'publish-failure/result.json');
    const failure = JSON.parse(await readFile(failureFile, 'utf8'));
    await write(failureFile, { ...failure, after: { rows: ['partial-write'] } });
    await assert.rejects(
      compareReference(capsule, output),
      /Failed publish changed canonical data/,
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
