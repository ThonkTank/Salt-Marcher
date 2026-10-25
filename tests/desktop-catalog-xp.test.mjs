import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, copyFileSync, mkdtempSync, rmSync } from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { buildSync } from 'esbuild';
mkdirSync('.build/catalog', { recursive: true });
copyFileSync(
  'src/features/catalog/data/srd-5.1.generated.json',
  '.build/catalog/srd-5.1.generated.json',
);
buildSync({
  stdin: {
    contents:
      "export {CampaignStore} from './src/app/storage/store';export {creatureInfo,readCreature,searchCreatures} from './src/app/storage/encounters';export * from './src/features/catalog/creature-catalog';",
    resolveDir: process.cwd(),
    loader: 'ts',
  },
  outfile: '.build/catalog-xp.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['better-sqlite3'],
});
const {
  CampaignStore,
  CreatureCatalog,
  SRD_5_1_ARTIFACT_SHA256,
  SRD_5_1_XP_CORRECTIONS,
  SRD_5_1_REACTION_SUPPLEMENT,
  creatureInfo,
  readCreature,
  searchCreatures,
} = createRequire(import.meta.url)('../.build/catalog-xp.cjs');
const bytes = readFileSync('src/features/catalog/data/srd-5.1.generated.json'),
  raw = JSON.parse(bytes),
  hash = (value) => createHash('sha256').update(value).digest('hex');
// Both projection checks read the same deeply immutable catalog.
const catalog = new CreatureCatalog(raw);
function fixture(t) {
  const dir = mkdtempSync(path.join(tmpdir(), 'catalog-xp-')),
    s = new CampaignStore(path.join(dir, 'workbench.sqlite')),
    c = s.create('XP errata'),
    w = s.activate(c.id);
  t.after(() => {
    s.close();
    rmSync(dir, { recursive: true, force: true });
  });
  return {
    s,
    c,
    w,
    command: () => ({ commandId: randomUUID(), campaignId: c.id, token: w.token }),
  };
}

test('four source-backed XP errata preserve pinned artifact bytes and unrelated creature details', () => {
  assert.equal(hash(bytes), SRD_5_1_ARTIFACT_SHA256);
  assert.equal(SRD_5_1_XP_CORRECTIONS.length, 4);
  for (const source of raw.creatures) {
    const actual = catalog.detail(source.id),
      correction = SRD_5_1_XP_CORRECTIONS.find((c) => c.id === source.id);
    const { sourceId, sourceLabel, sourceVersion, rulesVersion, legacy, ...details } = actual;
    const reactions = SRD_5_1_REACTION_SUPPLEMENT.creatures.find((c) => c.id === source.id);
    assert.deepEqual(details, {
      ...source,
      xp: correction?.to ?? source.xp,
      traits: [...source.traits, ...(reactions?.traits ?? [])],
    });
    assert.equal(actual.xp, readCreature(source.id).xp);
    if (correction) {
      assert.equal(source.xp, correction.from);
      assert.equal(source.cr, correction.cr);
      assert.match(sourceVersion, /xp-errata/);
      assert.match(correction.source, /^https:\/\/www.dndbeyond.com\/monsters\//);
    }
  }
  assert.notEqual(creatureInfo().hash, SRD_5_1_ARTIFACT_SHA256);
  assert.equal(searchCreatures({ text: 'Riding Horse' }).rows[0].xp, 50);
  assert.equal(raw.creatures.find((c) => c.id === 'riding-horse').xp, 25);
});

test('historical plan snapshots remain unchanged until an explicit edit uses corrected catalog values', (t) => {
  const x = fixture(t),
    p = x.s.saveEncounterPlan({
      ...x.command(),
      expectedRevision: null,
      plan: {
        id: randomUUID(),
        revision: 0,
        name: 'Horse patrol',
        notes: 'Keep this prose',
        party: [{ id: randomUUID(), name: 'Party', level: 5, count: 4 }],
        entries: [{ id: randomUUID(), creatureId: 'riding-horse', count: 4, grouped: false }],
        sources: [],
        catalogHash: '',
      },
    });
  const old = {
      ...p,
      catalogHash: SRD_5_1_ARTIFACT_SHA256,
      sources: p.sources.map((c) => ({ ...c, xp: 25, sourceVersion: 'v5.10.0' })),
    },
    payload = JSON.stringify(old);
  x.s.db
    .prepare('UPDATE encounter_plan SET payload=?,checksum=? WHERE id=?')
    .run(payload, hash(payload), p.id);
  const before = x.s.db.serialize();
  assert.deepEqual(x.s.encounterPlan(x.w.token, p.id), old);
  assert.ok(x.s.db.serialize().equals(before));
  const edited = x.s.saveEncounterPlan({
    ...x.command(),
    expectedRevision: 1,
    plan: { ...old, notes: 'Explicit edit' },
  });
  assert.equal(edited.sources[0].xp, 50);
  assert.equal(edited.catalogHash, creatureInfo().hash);
  assert.equal(edited.revision, 2);
});

test('a readable proposal made with the previous catalog cannot be accepted under the corrected identity', (t) => {
  const x = fixture(t),
    run = x.s.generateEncounters(x.w.token, {
      seed: 'old-catalog',
      tableIds: [],
      filters: { text: 'Goblin' },
      habitat: '',
      time: 'any',
      party: [{ id: randomUUID(), name: 'Party', level: 3, count: 4 }],
      difficulty: 'medium',
      amount: 'neutral',
      balance: 'neutral',
      diversity: 'neutral',
      title: 'Old proposal',
      count: 1,
    });
  const old = {
      ...run,
      catalogHash: SRD_5_1_ARTIFACT_SHA256,
      plans: run.plans.map((p) => ({ ...p, catalogHash: SRD_5_1_ARTIFACT_SHA256 })),
    },
    payload = JSON.stringify(old);
  x.s.db
    .prepare('UPDATE generation_run SET payload=?,checksum=? WHERE id=?')
    .run(payload, hash(payload), run.id);
  assert.deepEqual(x.s.generationRun(x.w.token, run.id), old);
  const before = x.s.db.serialize();
  assert.throws(
    () =>
      x.s.acceptGeneration({
        ...x.command(),
        runId: run.id,
        index: 0,
        expectedRegistryRevision: x.s.generatorRegistry(x.w.token).revision,
      }),
    /Katalog geändert/,
  );
  assert.ok(x.s.db.serialize().equals(before));
});

test('all twelve omitted reactions are readable, clearly named and immutable in the current catalog', () => {
  const ids = [
    'bandit-captain',
    'black-pudding',
    'chain-devil',
    'erinyes',
    'gladiator',
    'knight',
    'marilith',
    'noble',
    'ochre-jelly',
    'shield-guardian',
    'shrieker',
    'stone-giant',
  ];
  assert.deepEqual(
    SRD_5_1_REACTION_SUPPLEMENT.creatures.map((c) => c.id),
    ids,
  );
  for (const id of ids) {
    const c = catalog.detail(id),
      source = raw.creatures.find((c) => c.id === id),
      added = c.traits.slice(source.traits.length);
    assert.equal(added.length, 1);
    assert.match(added[0].name, /^Reaktion: /);
    assert.match(c.sourceVersion, /reactions\.1/);
    assert.ok(added[0].description.length > 60);
    assert.ok(Object.isFrozen(added[0]));
    assert.ok(Object.isFrozen(c.traits));
  }
  const parry = catalog.detail('gladiator').traits.find((t) => t.name === 'Reaktion: Parry');
  assert.equal(
    parry.description,
    'The gladiator adds 3 to its AC against one melee attack that would hit it. To do so, the gladiator must see the attacker and be wielding a melee weapon.',
  );
  assert.match(catalog.detail('black-pudding').traits.at(-1).description, /at least 10 hit points/);
  assert.deepEqual(
    catalog.detail('goblin').traits,
    raw.creatures.find((c) => c.id === 'goblin').traits,
  );
});

test('reaction supplementation preserves old saved sources and prose until an explicit plan edit', (t) => {
  const x = fixture(t),
    p = x.s.saveEncounterPlan({
      ...x.command(),
      expectedRevision: null,
      plan: {
        id: randomUUID(),
        revision: 0,
        name: 'Gladiators',
        notes: '  Original notes\r\n',
        party: [],
        entries: [{ id: randomUUID(), creatureId: 'gladiator', count: 2, grouped: false }],
        sources: [],
        catalogHash: '',
      },
    });
  const original = raw.creatures.find((c) => c.id === 'gladiator'),
    previousHash = hash(
      JSON.stringify({ artifact: SRD_5_1_ARTIFACT_SHA256, xpCorrections: SRD_5_1_XP_CORRECTIONS }),
    );
  const old = {
      ...p,
      catalogHash: previousHash,
      sources: p.sources.map((c) => ({ ...c, traits: original.traits, sourceVersion: 'v5.10.0' })),
    },
    payload = JSON.stringify(old);
  x.s.db
    .prepare('UPDATE encounter_plan SET payload=?,checksum=? WHERE id=?')
    .run(payload, hash(payload), p.id);
  const before = x.s.db.serialize();
  assert.deepEqual(x.s.encounterPlan(x.w.token, p.id), old);
  assert.ok(x.s.db.serialize().equals(before));
  assert.notEqual(creatureInfo().hash, previousHash);
  const edited = x.s.saveEncounterPlan({
    ...x.command(),
    expectedRevision: p.revision,
    plan: { ...old, notes: old.notes + 'Explicit edit' },
  });
  assert.equal(edited.sources[0].traits.at(-1).name, 'Reaktion: Parry');
  assert.equal(edited.catalogHash, creatureInfo().hash);
  assert.equal(edited.notes, old.notes + 'Explicit edit');
  assert.deepEqual(edited.sources[0].traits.slice(0, -1), original.traits);
  assert.equal(hash(bytes), SRD_5_1_ARTIFACT_SHA256);
});
