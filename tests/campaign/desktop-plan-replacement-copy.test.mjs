import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { buildSync } from '../helpers/build.mjs';
buildSync({
  entryPoints: ['src/app/storage/store.ts'],
  outfile: '.build/plan-replacement-copy.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
const { CampaignStore } = createRequire(import.meta.url)('../../.build/plan-replacement-copy.cjs');

for (const clear of [false, true])
  test(`independent copy rebinds ${clear ? 'cleared historical' : 'replaced current and historical'} timeline visit references`, async (t) => {
    const root = mkdtempSync(path.join(tmpdir(), 'plan-replacement-copy-')),
      filename = path.join(root, 'store.sqlite');
    let store = new CampaignStore(filename);
    t.after(() => {
      store.close();
      rmSync(root, { recursive: true, force: true });
    });
    const cam = store.create('Timeline'),
      w = store.activate(cam.id),
      command = (action) => ({
        commandId: randomUUID(),
        campaignId: cam.id,
        token: w.token,
        action,
      });
    const create = (name, count) => {
      const plan = {
        version: 1,
        id: randomUUID(),
        revision: 1,
        name,
        scenes: Array.from({ length: count }, () => ({
          id: randomUUID(),
          title: name,
          notes: '',
          locationId: null,
        })),
      };
      store.changePreparation({
        ...command(null),
        change: { kind: 'plan', plan, expectedRevision: null },
      });
      return plan;
    };
    const target = create('Ziel', 2),
      source = create('Vorlage', 2),
      literal = 'Unveränderter Verweistext ' + target.scenes[0].id;
    source.scenes[0].notes = literal;
    store.changePreparation({
      ...command(null),
      change: { kind: 'plan', plan: source, expectedRevision: 1 },
    });
    const replace = () =>
      store.executeSession(
        command({
          kind: 'replace-plan',
          planId: target.id,
          expectedBasis: store.session(w.token, target.id).replacementBasis,
          name: 'Ersetzt',
          sourcePlanId: clear ? null : source.id,
          expectedSourceBasis: clear ? null : store.session(w.token, source.id).replacementBasis,
          copyParty: false,
        }),
      );
    replace();
    const history = () =>
      store.db
        .prepare('SELECT payload FROM world_history WHERE campaign_id=?')
        .all(cam.id)
        .map((r) => JSON.parse(r.payload))
        .find((r) => r.facts?.kind === 'plan-replaced');
    const original = history(),
      file = path.join(root, 'campaign.sqlite');
    await store.campaignSnapshot(w.token, file);
    const bytes = readFileSync(file),
      copy = store.acceptCampaignSnapshot(file, 'Kopie', {});
    const copied = store.db
      .prepare('SELECT payload FROM world_history WHERE campaign_id=?')
      .all(copy.id)
      .map((r) => JSON.parse(r.payload))
      .find((r) => r.facts?.kind === 'plan-replaced');
    const mapping = JSON.parse(
      store.db.prepare('SELECT local_map FROM campaign_origin WHERE campaign_id=?').get(copy.id)
        .local_map,
    );
    assert.notEqual(copied.facts.planId, target.id);
    for (const key of ['previousVisitIds', 'visitIds']) {
      assert.equal(copied.facts[key].length, original.facts[key].length);
      for (const [index, id] of original.facts[key].entries()) {
        assert.ok(mapping[id], `Historical ${key} identities need a local copy mapping`);
        assert.equal(
          copied.facts[key][index],
          mapping[id],
          `${key} must use the same campaign-local remapping as current visits`,
        );
        assert.notEqual(copied.facts[key][index], id);
      }
    }
    if (!clear) {
      const current = store
        .preparation(store.activate(copy.id).token)
        .plans.find((p) => p.id === mapping[target.id]);
      assert.deepEqual(
        current.scenes.map((s) => s.id),
        copied.facts.visitIds,
      );
      assert.equal(current.scenes[0].notes, literal);
    }
    assert.ok(bytes.equals(readFileSync(file)), 'Source package bytes remain unchanged');
    await store.backup(path.join(root, 'safe.sqlite'));
    store.close();
    store = new CampaignStore(filename);
    const fresh = store.db
      .prepare('SELECT payload FROM world_history WHERE campaign_id=?')
      .all(copy.id)
      .map((r) => JSON.parse(r.payload))
      .find((r) => r.facts?.kind === 'plan-replaced');
    assert.deepEqual(fresh, copied);
  });
