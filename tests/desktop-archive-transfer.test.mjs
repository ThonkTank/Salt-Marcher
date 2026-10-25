import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  mkdtempSync,
  mkdirSync,
  existsSync,
  writeFileSync,
  readFileSync,
  readdirSync,
  rmSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { buildSync } from 'esbuild';
import { zipSync } from 'fflate';

for (const name of ['campaign-files', 'audio-files'])
  buildSync({
    entryPoints: [`desktop/${name}.ts`],
    outfile: `.build/archive-transfer/${name}.cjs`,
    bundle: true,
    platform: 'node',
    format: 'cjs',
    external: ['better-sqlite3'],
  });
const require = createRequire(import.meta.url),
  { extractCampaignArchive } = require('../.build/archive-transfer/campaign-files.cjs'),
  { importAudioBundle } = require('../.build/archive-transfer/audio-files.cjs');
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const hooks = { cancelled: () => false, progress: () => {}, fence: () => {} };
function fixture(t) {
  const root = mkdtempSync(path.join(tmpdir(), 'archive-transfer-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return { filename: path.join(root, 'input.zip'), base: path.join(root, 'destination') };
}
function campaign() {
  const bytes = Buffer.from('campaign snapshot'),
    name = 'campaign.sqlite';
  return {
    bytes,
    name,
    manifest: {
      format: 'Kampagnenwerkstatt Campaign',
      version: 1,
      campaignId: 'campaign',
      name: 'Campaign',
      applicationVersion: '1',
      schema: 1,
      createdAt: '2026-10-15T10:00:00Z',
      files: [{ name, bytes: bytes.length, sha256: digest(bytes) }],
    },
  };
}
function audio() {
  const bytes = Buffer.from('audio bytes'),
    sha256 = digest(bytes),
    name = `audio/${sha256}.ogg`;
  const asset = {
    id: 'one',
    revision: 1,
    name: 'Wind',
    kind: 'ambience',
    media: {
      sha256,
      bytes: bytes.length,
      extension: '.ogg',
      mime: 'audio/ogg',
      originalName: 'wind.ogg',
    },
    moods: {},
    moodTags: [],
    intensity: 50,
    vibes: [],
    genres: [],
    notes: '',
    trashed: false,
    problem: null,
    available: true,
  };
  return {
    bytes,
    name,
    manifest: {
      format: 'Kampagnenwerkstatt Musikbibliothek',
      version: 1,
      axes: [],
      assets: [asset, { ...asset, id: 'two', name: 'Wind copy' }],
    },
  };
}
const cases = [
  ['campaign', campaign, extractCampaignArchive],
  ['audio', audio, importAudioBundle],
];
function archive(x, data, entries = { [data.name]: data.bytes }) {
  writeFileSync(
    x.filename,
    zipSync({ 'manifest.json': Buffer.from(JSON.stringify(data.manifest)), ...entries }),
  );
}

for (const [kind, make, importPackage] of cases) {
  test(`${kind} import preserves validated metadata and exact file bytes`, async (t) => {
    const x = fixture(t),
      data = make();
    archive(x, data);
    const result = await importPackage(x.filename, x.base, hooks);
    assert.deepEqual(kind === 'campaign' ? result.manifest : result, data.manifest);
    assert.deepEqual(
      readFileSync(
        kind === 'campaign'
          ? path.join(result.dir, data.name)
          : path.join(x.base, path.basename(data.name)),
      ),
      data.bytes,
    );
    if (kind === 'audio') {
      assert.deepEqual(
        await importPackage(x.filename, x.base, hooks),
        data.manifest,
        'existing valid media can be reused',
      );
      assert.deepEqual(
        readdirSync(x.base),
        [path.basename(data.name)],
        'shared media is published once and staging is removed',
      );
    }
  });
  for (const fault of ['missing', 'extra', 'checksum', 'size', 'manifest'])
    test(`${kind} import rejects ${fault} before publishing and removes staging`, async (t) => {
      const x = fixture(t),
        data = make();
      let entries = { [data.name]: data.bytes };
      if (fault === 'missing') entries = {};
      if (fault === 'extra')
        entries['audio/' + digest(Buffer.from('extra')) + '.ogg'] = Buffer.from('extra');
      if (fault === 'checksum') entries[data.name] = Buffer.alloc(data.bytes.length, 42);
      if (fault === 'size') entries[data.name] = Buffer.concat([data.bytes, Buffer.from('!')]);
      if (fault === 'manifest') data.manifest.version = 999;
      archive(x, data, entries);
      await assert.rejects(importPackage(x.filename, x.base, hooks));
      assert.deepEqual(readdirSync(x.base), []);
    });
}
test('audio import keeps existing bytes and rolls back new media when a later destination is corrupt', async (t) => {
  const x = fixture(t),
    data = audio(),
    other = audio(),
    bytes = Buffer.from('second audio');
  other.manifest.assets[0].media = {
    ...other.manifest.assets[0].media,
    sha256: digest(bytes),
    bytes: bytes.length,
  };
  other.manifest.assets[0].id = 'second';
  data.manifest.assets = [data.manifest.assets[0], other.manifest.assets[0]];
  const otherName = `audio/${digest(bytes)}.ogg`;
  archive(x, data, { [data.name]: data.bytes, [otherName]: bytes });
  // A corrupt existing destination must survive the failed import unchanged.
  mkdirSync(x.base);
  const existing = path.join(x.base, path.basename(otherName)),
    corrupt = Buffer.from('user data');
  writeFileSync(existing, corrupt);
  await assert.rejects(importAudioBundle(x.filename, x.base, hooks), /Vorhandene Medienbytes/);
  assert.deepEqual(readdirSync(x.base), [path.basename(otherName)]);
  assert.deepEqual(readFileSync(existing), corrupt);
});
test('audio import cancellation after publication removes only newly copied files', async (t) => {
  const x = fixture(t),
    data = audio();
  archive(x, data);
  let cancelled = false;
  await assert.rejects(
    importAudioBundle(x.filename, x.base, {
      ...hooks,
      cancelled: () =>
        cancelled ||
        (cancelled = existsSync(x.base) && readdirSync(x.base).includes(path.basename(data.name))),
    }),
    /abgebrochen/,
  );
  assert.deepEqual(readdirSync(x.base), []);
});
