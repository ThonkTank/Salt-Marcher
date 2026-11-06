import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import {
  copyFileSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import Database from 'better-sqlite3';
import { buildSync } from '../helpers/build.mjs';

buildSync({
  entryPoints: ['src/app/storage/store.ts'],
  outfile: '.build/store-persistence.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
const { CampaignStore } = createRequire(import.meta.url)('../../.build/store-persistence.cjs');
buildSync({
  entryPoints: ['src/app/storage/campaign-snapshots.ts'],
  outfile: '.build/campaign-snapshot-persistence.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
const { writeCampaignSnapshot } = createRequire(import.meta.url)(
  '../../.build/campaign-snapshot-persistence.cjs',
);
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
function fixture(t) {
  const root = mkdtempSync(path.join(tmpdir(), 'store-persistence-'));
  const stores = [];
  t.after(() => {
    for (const store of stores) store.close();
    rmSync(root, { recursive: true, force: true });
  });
  return {
    root,
    open(name) {
      const store = new CampaignStore(path.join(root, name + '.sqlite'), '1.0.0');
      stores.push(store);
      return store;
    },
    close(store) {
      store.close();
      stores.splice(stores.indexOf(store), 1);
    },
  };
}

test('failed bootstrap closes its connection and preserves the existing database', (t) => {
  const { root, open, close } = fixture(t);
  const initial = open('bootstrap'),
    campaign = initial.create('Erhalten');
  close(initial);
  const filename = path.join(root, 'bootstrap.sqlite'),
    bytes = readFileSync(filename),
    failure = new Error('SQLite version read failed'),
    prepare = Database.prototype.prepare;
  let connection;
  // Inject a dependency failure before schema work, without exposing Store internals.
  Database.prototype.prepare = function (sql) {
    if (sql === 'SELECT sqlite_version() v') {
      connection = this;
      throw failure;
    }
    return prepare.call(this, sql);
  };
  try {
    assert.throws(
      () => new CampaignStore(filename, '1.0.0'),
      (error) => error === failure,
    );
  } finally {
    Database.prototype.prepare = prepare;
  }
  assert.ok(connection, 'the injected failure must exercise the opened canonical connection');
  assert.equal(connection.open, false);
  assert.deepEqual(readFileSync(filename), bytes);
  assert.equal(open('bootstrap').list().campaigns[0].id, campaign.id);
});

test('a damaged tutorial record survives failed read and state change across reopen', (t) => {
  const { root, open, close } = fixture(t);
  const filename = path.join(root, 'tutorial.sqlite');
  const initial = new CampaignStore(filename, '1.0.0');
  initial.tutorial('finished');
  initial.close();
  // Deliberate on-disk corruption, without accessing private Store fields.
  const damaged = '{broken tutorial';
  const connection = new Database(filename);
  try {
    connection
      .prepare('UPDATE settings SET value=? WHERE key=?')
      .run(damaged, 'tutorial:app:1.0.0');
  } finally {
    connection.close();
  }
  const store = open('tutorial');
  assert.throws(() => store.tutorial());
  assert.throws(() => store.tutorial('shown'));
  const reader = new Database(filename, { readonly: true });
  try {
    assert.equal(
      reader.prepare('SELECT value FROM settings WHERE key=?').get('tutorial:app:1.0.0').value,
      damaged,
    );
  } finally {
    reader.close();
  }
  close(store);
  const reopened = open('tutorial');
  assert.throws(() => reopened.tutorial());
  assert.throws(() => reopened.tutorial('skipped'));
  close(reopened);
  const finalReader = new Database(filename, { readonly: true });
  try {
    assert.equal(
      finalReader.prepare('SELECT value FROM settings WHERE key=?').get('tutorial:app:1.0.0').value,
      damaged,
    );
  } finally {
    finalReader.close();
  }
});

test('a reviewed snapshot digest mismatch preserves the source and cannot publish a receipt', async (t) => {
  const { root, open } = fixture(t);
  const source = open('source'),
    target = open('target');
  const campaign = source.create('Quelle'),
    workspace = source.activate(campaign.id);
  const filename = path.join(root, 'reviewed.sqlite');
  await source.campaignSnapshot(workspace.token, filename);
  const bytes = readFileSync(filename),
    ticket = randomUUID();
  assert.throws(
    () => target.acceptCampaignSnapshot(filename, 'Kopie', {}, ticket, '0'.repeat(64)),
    /Paketdatenbank wurde verändert/,
  );
  assert.deepEqual(readFileSync(filename), bytes);
  assert.equal(target.campaignTransferOutcome(ticket), null);
  assert.equal(target.list().campaigns.length, 0);
  assert.deepEqual(
    readdirSync(root).filter((name) => name.includes('.accept-')),
    [],
  );
  const copy = target.acceptCampaignSnapshot(filename, 'Kopie', {}, ticket, digest(bytes));
  assert.deepEqual(
    target.acceptCampaignSnapshot(filename, 'Kopie', {}, ticket, digest(bytes)),
    copy,
  );
  assert.equal(target.list().campaigns.length, 1);
  assert.deepEqual(readFileSync(filename), bytes);
});

test('trashing the source during asynchronous snapshot creation retains the published file', async (t) => {
  const { root, open } = fixture(t);
  const store = open('source'),
    campaign = store.create('Quelle'),
    workspace = store.activate(campaign.id);
  const filename = path.join(root, 'published.sqlite');
  await store.campaignSnapshot(workspace.token, filename);
  const bytes = readFileSync(filename);
  // campaignSnapshot has already captured its source fence and yielded to SQLite backup.
  const pending = store.campaignSnapshot(workspace.token, filename);
  store.trashCampaign({
    commandId: randomUUID(),
    id: campaign.id,
    expectedRevision: 0,
    trashed: true,
  });
  await assert.rejects(pending, /Quellkampagne wurde gelöscht oder ihr Lebenszyklus geändert/);
  assert.deepEqual(readFileSync(filename), bytes);
  assert.deepEqual(
    readdirSync(root).filter((name) => name.includes('.snapshot-')),
    [],
  );
});

test('a revoked snapshot fence rejects before processing the backup candidate', async (t) => {
  const { root } = fixture(t);
  const filename = path.join(root, 'published.sqlite'),
    published = Buffer.from('previous published file');
  writeFileSync(filename, published);
  let checks = 0;
  await assert.rejects(
    writeCampaignSnapshot(
      { backup: async (candidate) => writeFileSync(candidate, 'not a SQLite database') },
      'source',
      0,
      () => {
        checks++;
        throw new Error('source fence revoked');
      },
      filename,
    ),
    /source fence revoked/,
  );
  assert.equal(checks, 1);
  assert.deepEqual(readFileSync(filename), published);
  assert.deepEqual(readdirSync(root), ['published.sqlite']);
});

test('a snapshot fence revoked after processing preserves the previous publication', async (t) => {
  const { root, open } = fixture(t);
  const store = open('source'),
    campaign = store.create('Quelle'),
    workspace = store.activate(campaign.id),
    source = path.join(root, 'source-snapshot.sqlite'),
    filename = path.join(root, 'published.sqlite');
  await store.campaignSnapshot(workspace.token, source);
  const published = Buffer.from('previous published file');
  writeFileSync(filename, published);
  let checks = 0;
  await assert.rejects(
    writeCampaignSnapshot(
      { backup: async (candidate) => copyFileSync(source, candidate) },
      campaign.id,
      0,
      () => {
        checks++;
        store.campaignFence(campaign.id, 0);
        if (checks === 1)
          store.trashCampaign({
            commandId: randomUUID(),
            id: campaign.id,
            expectedRevision: 0,
            trashed: true,
          });
      },
      filename,
    ),
    /Quellkampagne wurde gelöscht oder ihr Lebenszyklus geändert/,
  );
  assert.equal(checks, 2, 'the second fence must reject after the first successful check');
  assert.deepEqual(readFileSync(filename), published);
  assert.deepEqual(
    readdirSync(root).filter((name) => name.includes('.snapshot-')),
    [],
  );
});
