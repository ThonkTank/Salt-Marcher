import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSync } from './helpers/build.mjs';
import { createRequire } from 'node:module';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync, readdirSync, rmSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
const require = createRequire(import.meta.url);
for (const [name, file] of [
  ['store', 'src/app/storage/store.ts'],
  ['service', 'desktop/backup-validation.ts'],
  ['worker', 'desktop/backup-validation-worker.ts'],
])
  buildSync({
    entryPoints: [file],
    outfile: '.build/backup-validation-' + name + '.cjs',
    bundle: true,
    platform: 'node',
    format: 'cjs',
    external: ['better-sqlite3'],
  });
const { CampaignStore } = require('../.build/backup-validation-store.cjs'),
  { BackupValidationService } = require('../.build/backup-validation-service.cjs');
function fixture(t, worker = path.resolve('.build/backup-validation-worker.cjs')) {
  const base = path.join(homedir(), '.cache/saltmarcher/tests');
  mkdirSync(base, { recursive: true });
  const dir = mkdtempSync(path.join(base, 'backup-worker-')),
    store = new CampaignStore(path.join(dir, 'world.sqlite')),
    cam = store.create('Welt'),
    service = new BackupValidationService(worker);
  t.after(async () => {
    await service.close();
    store.close();
    rmSync(dir, { recursive: true, force: true });
  });
  return {
    dir,
    store,
    cam,
    service,
    target: path.join(dir, 'recovery.sqlite'),
    validate: (file) => service.validate(file),
  };
}
test('background backup keeps every validation and preserves the previous safe snapshot on corruption', async (t) => {
  const f = fixture(t);
  await f.store.backup(f.target, f.validate);
  let saved = readFileSync(f.target);
  const copy = new CampaignStore(f.target);
  assert.equal(copy.list().campaigns[0].id, f.cam.id);
  copy.close();
  saved = readFileSync(f.target);
  // A semantically invalid draft can still have a valid SQLite structure.
  const payload = JSON.stringify({ bad: true });
  f.store.db.prepare("INSERT INTO settings VALUES('session-recap:broken',?)").run(payload);
  await assert.rejects(f.store.backup(f.target, f.validate));
  assert.ok(readFileSync(f.target).equals(saved), 'previous safe snapshot must be byte-identical');
  assert.deepEqual(
    readdirSync(f.dir).filter((n) => n.includes('.candidate-')),
    [],
  );
});
test('validation yields to the main event loop and close waits for worker exit before candidate cleanup', async (t) => {
  const f = fixture(t);
  await f.store.backup(f.target);
  const saved = readFileSync(f.target);
  const worker = path.join(f.dir, 'blocked.cjs');
  writeFileSync(
    worker,
    "const {parentPort}=require('node:worker_threads');parentPort.postMessage({ok:true});Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,60000);",
  );
  const blocked = new BackupValidationService(worker);
  t.after(() => blocked.close());
  let entered;
  const ready = new Promise((r) => (entered = r));
  let settled = false;
  const backup = f.store
    .backup(f.target, (file) => {
      entered();
      return blocked.validate(file);
    })
    .finally(() => (settled = true));
  const rejected = assert.rejects(backup, /beendet/);
  await ready;
  await new Promise((r) => setTimeout(r, 50));
  assert.equal(settled, false, 'message alone must not allow publication before worker exit');
  await blocked.close();
  await rejected;
  assert.equal(settled, true);
  assert.ok(readFileSync(f.target).equals(saved), 'previous safe snapshot must be byte-identical');
  assert.deepEqual(
    readdirSync(f.dir).filter((n) => n.includes('.candidate-')),
    [],
  );
  await assert.rejects(blocked.validate(f.target), /beendet/);
});
test('worker failure, missing result, and invalidated source cannot publish a candidate', async (t) => {
  const f = fixture(t);
  await f.store.backup(f.target);
  const saved = readFileSync(f.target);
  for (const source of ["throw Error('worker failed')", '']) {
    const file = path.join(f.dir, 'failure.cjs');
    writeFileSync(file, source);
    const service = new BackupValidationService(file);
    try {
      await assert.rejects(
        f.store.backup(f.target, (p) => service.validate(p)),
        /worker failed|ohne Ergebnis/,
      );
    } finally {
      await service.close();
    }
    assert.ok(
      readFileSync(f.target).equals(saved),
      'previous safe snapshot must be byte-identical',
    );
  }
  await assert.rejects(
    f.store.backup(f.target, async (file) => {
      await f.validate(file);
      f.store.trashCampaign({
        commandId: 'trash',
        id: f.cam.id,
        expectedRevision: 0,
        trashed: true,
      });
    }),
    /Löschung überholt/,
  );
  assert.ok(readFileSync(f.target).equals(saved), 'previous safe snapshot must be byte-identical');
  assert.deepEqual(
    readdirSync(f.dir).filter((n) => n.includes('.candidate-')),
    [],
  );
});
