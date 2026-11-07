import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import Database from 'better-sqlite3';
import { buildSync } from '../helpers/build.mjs';
buildSync({
  entryPoints: ['src/app/storage/store.ts'],
  outfile: '.build/data-format-store.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
const { CampaignStore } = createRequire(import.meta.url)('../../.build/data-format-store.cjs');
const format = JSON.parse(readFileSync(new URL('../../src/app/data-format.json', import.meta.url)));
function fixture(t) {
  const dir = mkdtempSync(path.join(tmpdir(), 'data-format-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}
for (const version of [0, 3, 33, 43, 45, 48, 50, 51, 52, 53, 54, 56])
  test(`format ${version} cannot be opened, previewed or imported and stays byte-identical`, (t) => {
    const dir = fixture(t),
      source = path.join(dir, 'source.sqlite'),
      db = new Database(source);
    db.exec("CREATE TABLE test_setup(id TEXT); INSERT INTO test_setup VALUES('preserved')");
    db.pragma('user_version=' + version);
    db.close();
    const bytes = readFileSync(source),
      target = new CampaignStore(path.join(dir, 'target.sqlite'));
    t.after(() => target.close());
    assert.throws(() => new CampaignStore(source), /Testdatenformat/);
    assert.throws(() => target.campaignPreview(source), /Testformat|Appversion/);
    assert.throws(
      () => target.acceptCampaignSnapshot(source, 'Rejected', {}),
      /Testformat|Appversion/,
    );
    assert.deepEqual(readFileSync(source), bytes);
    assert.equal(target.list().campaigns.length, 0);
  });
test('new database, independent archive copy and fresh reopen use the one declared format', async (t) => {
  const dir = fixture(t),
    filename = path.join(dir, 'source.sqlite'),
    archive = path.join(dir, 'archive.sqlite');
  let store = new CampaignStore(filename);
  t.after(() => store.close());
  const campaign = store.create('Current'),
    token = store.activateShell(campaign.id).token;
  assert.equal(store.db.pragma('user_version', { simple: true }), format.schema);
  assert.deepEqual(
    store.db
      .prepare(
        "SELECT name FROM sqlite_schema WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
      )
      .all()
      .map((r) => r.name),
    format.tables,
  );
  await store.campaignSnapshot(token, archive);
  assert.equal(store.campaignPreview(archive).schema, format.schema);
  const copy = store.acceptCampaignSnapshot(archive, 'Independent', {});
  assert.notEqual(copy.id, campaign.id);
  store.close();
  store = new CampaignStore(filename);
  assert.deepEqual(
    store
      .list()
      .campaigns.map((c) => c.name)
      .sort(),
    ['Current', 'Independent'],
  );
});

for (const table of ['history', 'receipt', 'atlas_command'])
  test('missing canonical ' + table + ' is rejected without repair', (t) => {
    const dir = fixture(t),
      file = path.join(dir, 'damaged.sqlite'),
      store = new CampaignStore(file);
    store.close();
    const db = new Database(file);
    db.exec('DROP TABLE ' + table);
    db.close();
    const bytes = readFileSync(file);
    assert.throws(() => new CampaignStore(file), /unvollständig/);
    assert.deepEqual(readFileSync(file), bytes);
  });
test('failed source validation rolls startup trigger changes back', (t) => {
  const dir = fixture(t),
    file = path.join(dir, 'damaged.sqlite'),
    store = new CampaignStore(file);
  store.create('Source');
  store.close();
  const db = new Database(file);
  db.prepare("UPDATE world_record SET checksum='broken' WHERE kind='atlas-shape-source'").run();
  const triggers = () =>
      db.prepare("SELECT name,sql FROM sqlite_schema WHERE type='trigger' ORDER BY name").all(),
    before = triggers();
  assert.throws(() => new CampaignStore(file));
  assert.deepEqual(triggers(), before);
  db.close();
});
