// A portable local capsule of the explicitly preserved round-10 source stand.
// Never changes the working checkout or adopts unrelated newer dirty changes.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import {
  mkdir,
  readFile,
  writeFile,
  cp,
  copyFile,
  readdir,
  chmod,
  stat,
  readlink,
} from 'node:fs/promises';
import { execFileSync, spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const json = async (file) => JSON.parse(await readFile(file, 'utf8'));
const writeJson = (file, value) => writeFile(file, JSON.stringify(value, null, 2) + '\n');
async function sha(file) {
  const hash = createHash('sha256');
  for await (const bytes of createReadStream(file)) hash.update(bytes);
  return hash.digest('hex');
}
const command = (file, args, cwd) =>
  execFileSync(file, args, { cwd, stdio: 'pipe', maxBuffer: 32 * 1024 ** 2 });
async function inventory(root, prefix = '') {
  const result = {};
  for (const entry of (await readdir(path.join(root, prefix), { withFileTypes: true })).sort(
    (a, b) => a.name.localeCompare(b.name),
  )) {
    const name = path.posix.join(prefix, entry.name);
    if (entry.isDirectory()) Object.assign(result, await inventory(root, name));
    else if (entry.isFile()) result[name] = await sha(path.join(root, name));
    else if (entry.isSymbolicLink())
      result[name] = 'symlink:' + (await readlink(path.join(root, name)));
    else assert.fail('Unsupported reference input: ' + name);
  }
  return result;
}
async function checkFiles(root, files) {
  for (const [file, hash] of Object.entries(files)) {
    if (hash === null) {
      await assert.rejects(stat(path.join(root, file)), { code: 'ENOENT' });
    } else if (hash.startsWith('symlink:')) {
      assert.equal(
        'symlink:' + (await readlink(path.join(root, file))),
        hash,
        'Reference link differs: ' + file,
      );
    } else assert.equal(await sha(path.join(root, file)), hash, 'Reference input differs: ' + file);
  }
}
async function checkCapsule(capsule) {
  const manifest = await json(path.join(capsule, 'manifest.json'));
  assert.equal(manifest.format, 'saltmarcher-e2e-reference-v1');
  await checkFiles(capsule, manifest.files);
  return manifest;
}
export async function packReference(root, capsule) {
  assert.equal(process.versions.node, '22.19.0');
  const original = path.join(root, '.build/native-baseline-round10-review-source-20261029');
  const binding = await json(path.join(original, 'binding.json'));
  const raw = path.join(root, '.build/native-baseline-round10-final-20261029');
  const final = await json(path.join(raw, 'binding.json'));
  assert.deepEqual(binding.binding, final.binding);
  assert.equal(await sha(path.join(original, 'sources.tar.gz')), binding.sourceArchive.sha256);
  assert.equal(command('git', ['rev-parse', 'HEAD'], root).toString().trim(), binding.head);
  await mkdir(capsule); // Append-only: never replace a previous capsule.
  await copyFile(path.join(original, 'sources.tar.gz'), path.join(capsule, 'sources.tar.gz'));
  await writeJson(path.join(capsule, 'binding.json'), binding);
  await mkdir(path.join(capsule, 'controller'));
  for (const file of [
    'e2e-reference.mjs',
    'e2e-reference-seed-loader.mjs',
    'e2e-reference-fault.mjs',
  ])
    await copyFile(path.join(here, file), path.join(capsule, 'controller', file));
  await mkdir(path.join(capsule, 'original'));
  const resourceEvidence = {};
  for (const name of ['e2e01', 'e2e02', 'travel-checkpoints', 'evening-handoff', 'note-excerpts']) {
    await cp(path.join(raw, name), path.join(capsule, 'original', name), { recursive: true });
    const resource = await json(path.join(raw, name, 'resource-wrapper.json'));
    const destination = path.join('original/resources', resource.ownership.unit);
    await cp(resource.evidence, path.join(capsule, destination), { recursive: true });
    resourceEvidence[name] = destination;
  }
  for (const name of ['binding.json', 'report.json', 'posthoc-audit.json'])
    await copyFile(path.join(raw, name), path.join(capsule, 'original', name));
  command('git', ['bundle', 'create', path.join(capsule, 'base.bundle'), 'HEAD'], root);
  command('tar', ['-czf', path.join(capsule, 'dependencies.tar.gz'), 'node_modules'], root);
  command(
    'tar',
    [
      '-czf',
      path.join(capsule, 'runtime.tar.gz'),
      '-C',
      path.join(binding.packageDirectory, 'resources/app'),
      '.',
    ],
    root,
  );
  await copyFile(process.execPath, path.join(capsule, 'node'));
  await chmod(path.join(capsule, 'node'), 0o755);
  const files = await inventory(capsule);
  const manifest = {
    format: 'saltmarcher-e2e-reference-v1',
    createdAt: new Date().toISOString(),
    source: {
      head: binding.head,
      dirty: true,
      digest: binding.binding.sourceDigest,
      files: Object.keys(binding.binding.sources).length,
    },
    environment: {
      node: binding.node,
      electron: binding.electron,
      betterSqlite3: binding.betterSqlite3,
      host: binding.host,
    },
    scope:
      'Preserved Plan-1 correction stand; E2E-01 technical success and E2E-02 subset, not current checkout/product acceptance.',
    restoration:
      'No old profiles/output required. Git base, dirty sources, Node, dependencies, Electron, desktop runtime, seeds, media, raw evidence and controller are included.',
    files,
    restoredInputs: {
      dependencies: await inventory(path.join(root, 'node_modules')),
      runtime: await inventory(path.join(binding.packageDirectory, 'resources/app')),
    },
    resourceEvidence,
  };
  await writeJson(path.join(capsule, 'manifest.json'), manifest);
  return {
    capsule,
    manifestSha256: await sha(path.join(capsule, 'manifest.json')),
    ...manifest.source,
  };
}
export async function restoreReference(capsule, target) {
  const manifest = await checkCapsule(capsule);
  await mkdir(target);
  // Only the capsule's Git objects are used; no dependency on a local repository.
  command('git', [
    'clone',
    '--no-checkout',
    path.join(capsule, 'base.bundle'),
    path.join(target, 'checkout'),
  ]);
  const root = path.join(target, 'checkout');
  command('git', ['reset', '--mixed', manifest.source.head], root);
  for (const file of ['sources.tar.gz', 'dependencies.tar.gz'])
    command('tar', ['-xzf', path.join(capsule, file), '-C', root]);
  await mkdir(path.join(root, '.build/desktop'), { recursive: true });
  command('tar', [
    '-xzf',
    path.join(capsule, 'runtime.tar.gz'),
    '-C',
    path.join(root, '.build/desktop'),
  ]);
  await mkdir(path.join(target, 'bin'));
  await copyFile(path.join(capsule, 'node'), path.join(target, 'bin/node'));
  await chmod(path.join(target, 'bin/node'), 0o755);
  await writeJson(path.join(target, 'reference.json'), {
    capsule,
    manifestSha256: await sha(path.join(capsule, 'manifest.json')),
  });
  await verifyRestoration(target);
  return { target, sourceDigest: manifest.source.digest, restored: true };
}
export async function verifyRestoration(target) {
  const reference = await json(path.join(target, 'reference.json'));
  assert.equal(await sha(path.join(reference.capsule, 'manifest.json')), reference.manifestSha256);
  const manifest = await checkCapsule(reference.capsule);
  const binding = await json(path.join(reference.capsule, 'binding.json'));
  const root = path.join(target, 'checkout');
  await checkFiles(root, binding.binding.sources);
  await checkFiles(path.join(root, '.build/desktop'), binding.binding.artifacts);
  if (manifest.restoredInputs) {
    await checkFiles(path.join(root, 'node_modules'), manifest.restoredInputs.dependencies);
    await checkFiles(path.join(root, '.build/desktop'), manifest.restoredInputs.runtime);
  }
  assert.equal(command('git', ['rev-parse', 'HEAD'], root).toString().trim(), manifest.source.head);
  assert.equal(await sha(path.join(target, 'bin/node')), manifest.files.node);
  const e2e02 = await json(path.join(reference.capsule, 'original/e2e02/result.json'));
  assert.equal(
    await sha(path.join(reference.capsule, 'original/e2e02/seed.sqlite')),
    e2e02.seedDatabaseHash,
  );
  await checkFiles(path.join(reference.capsule, 'original/e2e02/seed-player-images'), {
    [path.basename(e2e02.fixture.media.name)]: e2e02.fixture.media.sha256,
  });
  return { root, capsule: reference.capsule, binding, manifest };
}
export async function auditReference(target) {
  const { root, capsule, binding, manifest } = await verifyRestoration(target);
  const { assertBaselineReceipt } = await import(
    pathToFileURL(path.join(root, 'tools/native-baseline-evidence.mjs'))
  );
  const { assertE2E01Scenarios } = await import(
    pathToFileURL(path.join(root, 'tools/atlas-e2e01-scenarios.mjs'))
  );
  const { baselineResourceOwnershipKnown } = await import(
    pathToFileURL(path.join(root, 'tools/native-baseline-resource-evidence.mjs'))
  );
  const results = [];
  for (const name of ['e2e01', 'e2e02', 'travel-checkpoints', 'evening-handoff', 'note-excerpts']) {
    const file = path.join(
      capsule,
      'original',
      name,
      name === 'note-excerpts' ? 'failure.json' : 'result.json',
    );
    const receipt = await json(file);
    await assertBaselineReceipt(file, receipt, {
      name,
      binding: binding.binding,
      failure: name === 'note-excerpts',
    });
    assert.equal(receipt.source, binding.head);
    for (const [file, hash] of Object.entries(receipt.sourceHashes ?? {}))
      assert.equal(hash, binding.binding.sources[file], 'Reused report source differs: ' + file);
    const resource = await json(path.join(capsule, 'original', name, 'resource-wrapper.json'));
    assert(baselineResourceOwnershipKnown(resource), 'Unresolved original resource ownership');
    assert(manifest.resourceEvidence[name], 'Archived resource evidence missing');
    await json(path.join(capsule, manifest.resourceEvidence[name], 'started.json'));
    await json(path.join(capsule, manifest.resourceEvidence[name], 'report.json'));
    if (name === 'e2e01') assertE2E01Scenarios(receipt);
    results.push({
      name,
      nativeEvidence: 'verified',
      source: receipt.source,
      launches: receipt.launches.length,
      zoom: 1,
      status: name === 'note-excerpts' ? 'failed' : name === 'e2e02' ? 'subset-passed' : 'passed',
    });
  }
  return {
    observedAt: new Date().toISOString(),
    sourceDigest: manifest.source.digest,
    results,
    limits: 'Historical Plan-1 local stand, not current Candidate/Main/product acceptance.',
  };
}
async function child(file, args, options) {
  return new Promise((resolve, reject) => {
    const process = spawn(file, args, { ...options, stdio: 'inherit' });
    process.once('error', reject);
    process.once('exit', (code, signal) => resolve({ code, signal }));
  });
}
async function auditFresh(root, output, exit, name, expectedReceipts = 3) {
  const { inspectBaselineEvidence, assertBaselineReceipt } = await import(
    pathToFileURL(path.join(root, 'tools/native-baseline-evidence.mjs'))
  );
  const { baselineResourceOwnershipKnown } = await import(
    pathToFileURL(path.join(root, 'tools/native-baseline-resource-evidence.mjs'))
  );
  const evidence = await inspectBaselineEvidence(output, exit, { name });
  assert.equal(evidence.unknownOwnership, false);
  assert.equal(evidence.invalidReceipts.length, 0);
  assert.equal(evidence.error, null);
  const resource = await json(path.join(output, 'resource-wrapper.json'));
  assert(baselineResourceOwnershipKnown(resource), 'Fresh resource ownership unresolved');
  await cp(resource.evidence, path.join(output, 'resource-evidence'), { recursive: true });
  if (exit.code === 0)
    assert.equal(
      evidence.receipts.length,
      expectedReceipts,
      'Every requested native receipt is required',
    );
  else {
    assert.equal(evidence.failures.length, 1);
    await assertBaselineReceipt(
      path.join(output, 'failure.json'),
      await json(path.join(output, 'failure.json')),
      { name, failure: true },
    );
  }
  await writeJson(path.join(output, 'reference-native-audit.json'), evidence);
}
export async function runReference(target, output) {
  const { root, capsule } = await verifyRestoration(target);
  await mkdir(output); // A fresh output is mandatory; old successes cannot leak.
  const node = path.join(target, 'bin/node');
  const env = {
    ...process.env,
    QA_EVIDENCE_DIR: output,
    E2E_REFERENCE_FIXTURE: path.join(capsule, 'original/e2e02'),
  };
  for (const key of [
    'NODE_OPTIONS',
    'ATLAS_PACKAGE',
    'ATLAS_AUTHOR_RUNTIME_DIR',
    'ATLAS_AUTHOR_RUNTIME_REVISION',
    'SOURCE_REVISION',
    'E2E01_ONLY_COUNTERCASE',
    'QA_SCALES',
    'QA_TILTS',
  ])
    delete env[key];
  const exit = await child(
    node,
    [
      'tools/native-baseline-resource.mjs',
      'python3',
      'tools/ui-session.py',
      node,
      '--import',
      path.join(capsule, 'controller/e2e-reference-seed-loader.mjs'),
      'tools/test-desktop-e2e02.mjs',
    ],
    { cwd: root, env },
  );
  await verifyRestoration(target);
  await writeJson(path.join(output, 'reference-exit.json'), { exit, target, capsule, zoom: 1 });
  assert.deepEqual(
    exit,
    { code: 0, signal: null },
    'Restored native workflow failed; raw outputs preserved',
  );
  await auditFresh(root, output, exit, 'e2e02');
  const comparison = await compareReference(capsule, output);
  await writeJson(path.join(output, 'reference-comparison.json'), comparison);
  return comparison;
}
export async function compareReference(capsule, output) {
  const previous = path.join(capsule, 'original/e2e02');
  const original = await json(path.join(previous, 'result.json'));
  const current = await json(path.join(output, 'result.json'));
  assert.equal(current.seedDatabaseHash, original.seedDatabaseHash);
  assert.equal(current.source, original.source);
  assert.deepEqual(current.buildInfo, original.buildInfo);
  assert.deepEqual(current.sourceHashes, original.sourceHashes);
  assert.deepEqual(current.host, original.host);
  assert.deepEqual(current.fixture, original.fixture, 'Frozen source identities must match');
  assert.deepEqual(current.artifacts, original.artifacts);
  assert.equal(current.complete, false, 'Partial workflow must not claim the full gate');
  assert.equal(current.workflowSubset, 'passed');
  assert.deepEqual(
    current.scenarios.map(({ id, status }) => ({ id, status })),
    original.scenarios.map(({ id, status }) => ({ id, status })),
  );
  assert.notEqual(current.profile, original.profile, 'Must use a fresh independent profile');
  const snapshot = async (dir) => (await json(path.join(dir, 'snapshots.json'))).at(-1).state;
  const oldState = await snapshot(previous),
    newState = await snapshot(output);
  // Authored bytes/identities and persistent semantic effects are compared across
  // executions. New runtime/command IDs and timestamps must remain independent.
  for (const table of [
    'plan',
    'planned_visit',
    'session_profile',
    'session_visit',
    'prepared_group',
    'encounter_plan',
    'location',
    'character_profile',
  ])
    assert.deepEqual(newState[table], oldState[table], 'Source identity/bytes differ: ' + table);
  const effect = (state) => ({
    progress: state.character_progress
      .map((row) => ({ character_id: row.id, payload: JSON.parse(row.payload) }))
      .map(({ character_id, payload }) => ({ character_id, xp: payload.xp })),
    ledger: state.character_ledger.map((row) => {
      const p = JSON.parse(row.payload);
      return {
        characterId: p.characterId,
        name: p.name,
        quantity: p.quantity,
        unitCopper: p.unitCopper,
        origin: p.origin,
        status: p.status,
        locationId: p.locationId,
        instantMs: p.instantMs,
      };
    }),
    counts: Object.fromEntries(
      ['combat', 'chase', 'combat_award', 'treasure', 'scene_adoption', 'scene_time_step'].map(
        (table) => [table, state[table].length],
      ),
    ),
  });
  assert.deepEqual(effect(newState), effect(oldState), 'Restored workflow effects differ');
  for (const table of ['combat', 'chase'])
    assert.notEqual(
      newState[table][0].id,
      oldState[table][0].id,
      'Independent execution reuses runtime identity',
    );
  const faults = [];
  for (const kind of ['publish-failure', 'reply-loss']) {
    const old = await json(path.join(previous, kind, 'result.json'));
    const fresh = await json(path.join(output, kind, 'result.json'));
    assert.deepEqual(fresh.fixture, old.fixture);
    assert.equal(fresh.seedDatabaseHash, old.seedDatabaseHash);
    assert.equal(fresh.injectedDatabaseHash, old.injectedDatabaseHash);
    assert.notEqual(fresh.profile, old.profile, 'Fault case must use a fresh profile');
    assert.equal(fresh.faultAssertions, 'passed');
    assert.equal(fresh.trace.statusResponse.value.outcome, old.trace.statusResponse.value.outcome);
    assert.deepEqual(fresh.before, old.before, kind + ': original start rows differ');
    if (kind === 'publish-failure') {
      assert.equal(fresh.faultSql, old.faultSql);
      assert.deepEqual(fresh.before, fresh.after, 'Failed publish changed canonical data');
      assert.equal(fresh.trace.response.error, old.trace.response.error);
    }
    faults.push({
      kind,
      status: 'reproduced',
      outcome: fresh.trace.statusResponse.value.outcome,
      freshProfile: fresh.profile !== old.profile,
    });
  }
  return {
    observedAt: new Date().toISOString(),
    sourceDigest: (await json(path.join(capsule, 'manifest.json'))).source.digest,
    seedDatabaseHash: current.seedDatabaseHash,
    freshProfile: current.profile,
    fixedIdentities: current.fixture,
    semanticEffects: effect(newState),
    positiveSubset: 'passed',
    fullE2E02: 'open',
    faults,
    boundaries: [
      'Candidate/Main binding',
      'package/install',
      'target device',
      'E2E-03/04 combined workflows',
      'owner acceptance',
    ],
  };
}
export async function runFailureReference(target, output) {
  const { root, capsule } = await verifyRestoration(target);
  await mkdir(output);
  const node = path.join(target, 'bin/node');
  const env = {
    ...process.env,
    QA_EVIDENCE_DIR: output,
    GM_QA_OUT: output,
    E2E_REFERENCE_FIXTURE: path.join(capsule, 'original/e2e02'),
  };
  for (const key of [
    'NODE_OPTIONS',
    'ATLAS_PACKAGE',
    'ATLAS_AUTHOR_RUNTIME_DIR',
    'ATLAS_AUTHOR_RUNTIME_REVISION',
    'SOURCE_REVISION',
  ])
    delete env[key];
  const exit = await child(
    node,
    [
      'tools/native-baseline-resource.mjs',
      'python3',
      'tools/ui-session.py',
      node,
      path.join(capsule, 'controller/e2e-reference-fault.mjs'),
    ],
    { cwd: root, env },
  );
  await verifyRestoration(target);
  await writeJson(path.join(output, 'reference-exit.json'), { exit, target, capsule, zoom: 1 });
  assert.deepEqual(
    exit,
    { code: 0, signal: null },
    'Controlled failures did not satisfy their unchanged native assertions',
  );
  await auditFresh(root, output, exit, 'e2e02', 2);
  const faults = [];
  for (const kind of ['publish-failure', 'reply-loss']) {
    const old = await json(path.join(capsule, 'original/e2e02', kind, 'result.json'));
    const fresh = await json(path.join(output, kind, 'result.json'));
    assert.equal(fresh.seedDatabaseHash, old.seedDatabaseHash);
    assert.equal(fresh.injectedDatabaseHash, old.injectedDatabaseHash);
    assert.deepEqual(fresh.fixture, old.fixture);
    assert.deepEqual(fresh.before, old.before);
    assert.equal(fresh.faultAssertions, 'passed');
    assert.notEqual(fresh.profile, old.profile);
    assert.equal(fresh.trace.statusResponse.value.outcome, old.trace.statusResponse.value.outcome);
    if (kind === 'publish-failure') {
      assert.deepEqual(fresh.before, fresh.after);
      assert.equal(fresh.trace.response.error, old.trace.response.error);
    }
    faults.push({
      kind,
      status: 'reproduced',
      profile: fresh.profile,
      outcome: fresh.trace.statusResponse.value.outcome,
    });
  }
  const result = {
    observedAt: new Date().toISOString(),
    sourceDigest: (await json(path.join(capsule, 'manifest.json'))).source.digest,
    status: 'controlled-errors-reproduced',
    faults,
    sourceRecipe: 'tools/live-e2e02-countercases.mjs',
    limit:
      'Controlled transactional failures, not unintended product defects or a full E2E-02 gate.',
  };
  await writeJson(path.join(output, 'reference-comparison.json'), result);
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const [mode, first, second] = process.argv.slice(2);
  let result;
  if (mode === 'pack') result = await packReference(process.cwd(), path.resolve(first));
  else if (mode === 'restore')
    result = await restoreReference(path.resolve(first), path.resolve(second));
  else if (mode === 'verify')
    result = await verifyRestoration(path.resolve(first)).then(({ manifest }) => ({
      verified: true,
      source: manifest.source,
    }));
  else if (mode === 'audit') result = await auditReference(path.resolve(first));
  else if (mode === 'run') result = await runReference(path.resolve(first), path.resolve(second));
  else if (mode === 'run-failure')
    result = await runFailureReference(path.resolve(first), path.resolve(second));
  else if (mode === 'compare')
    result = await compareReference(path.resolve(first), path.resolve(second));
  else
    throw Error(
      'Usage: e2e-reference.mjs pack CAPSULE | restore CAPSULE FRESH-DIRECTORY | verify RESTORED | run RESTORED FRESH-OUTPUT | compare CAPSULE OUTPUT',
    );
  console.log(JSON.stringify(result, null, 2));
}
