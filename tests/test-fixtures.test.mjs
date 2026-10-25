import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fixtureStore } from './helpers/store.mjs';

const { CampaignStore } = createRequire(import.meta.url)('../.build/test-shared/store.cjs');

test('schema copies are independent durable databases and cannot overwrite a reopen target', (t) => {
  const root = mkdtempSync(path.join(tmpdir(), 'fixture-isolation-'));
  const stores = [];
  t.after(() => {
    for (const store of stores) store.close();
    rmSync(root, { recursive: true, force: true });
  });
  const a = fixtureStore(CampaignStore, path.join(root, 'a.sqlite'));
  stores.push(a);
  const b = fixtureStore(CampaignStore, path.join(root, 'b.sqlite'));
  stores.push(b);
  const campaign = a.create('Only in A');
  assert.equal(b.db.prepare('SELECT count(*) n FROM campaign').get().n, 0);
  assert.equal(a.db.pragma('journal_mode', { simple: true }), 'wal');
  assert.equal(a.db.pragma('synchronous', { simple: true }), 2);
  const c = fixtureStore(CampaignStore, path.join(root, 'c.sqlite'));
  stores.push(c);
  assert.equal(c.db.prepare('SELECT count(*) n FROM campaign').get().n, 0);
  const bytes = readFileSync(a.filename);
  assert.throws(() => fixtureStore(CampaignStore, a.filename), /EEXIST/);
  assert.deepEqual(readFileSync(a.filename), bytes);
  a.close();
  stores.splice(stores.indexOf(a), 1);
  const reopened = new CampaignStore(a.filename);
  stores.push(reopened);
  assert.equal(reopened.activate(campaign.id).campaign.name, 'Only in A');
});
