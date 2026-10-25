import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { buildSync } from 'esbuild';
import { zipSync } from 'fflate';
buildSync({
  entryPoints: ['desktop/zip-files.ts'],
  outfile: '.build/archive-error-review.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
});
const { readArchive } = createRequire(import.meta.url)('../.build/archive-error-review.cjs'),
  digest = (b) => createHash('sha256').update(b).digest('hex');
function fixture(t) {
  const root = mkdtempSync(path.join(tmpdir(), 'archive-error-')),
    filename = path.join(root, 'input.zip'),
    base = path.join(root, 'staging');
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return { root, filename, base };
}
test('archive retains the original metadata failure when a later ZIP entry is undeclared', async (t) => {
  const x = fixture(t),
    cause = new Error('Ursprünglicher Metadatenfehler');
  writeFileSync(
    x.filename,
    zipSync({
      'manifest.json': Buffer.from('{}'),
      'data.bin': Buffer.from('after invalid manifest'),
    }),
  );
  await assert.rejects(
    readArchive(
      x.filename,
      x.base,
      () => true,
      () => {
        throw cause;
      },
      { check: () => {}, progress: () => {} },
    ),
    (error) => error === cause,
  );
  assert.deepEqual(readdirSync(x.base), []);
});
test('archive retains the original checksum failure instead of a later undeclared entry', async (t) => {
  const x = fixture(t),
    data = Buffer.from('first'),
    manifest = {};
  writeFileSync(
    x.filename,
    zipSync({
      'manifest.json': Buffer.from(JSON.stringify(manifest)),
      'data.bin': data,
      'extra.bin': Buffer.from('undeclared'),
    }),
  );
  await assert.rejects(
    readArchive(
      x.filename,
      x.base,
      () => true,
      () =>
        new Map([
          [
            'data.bin',
            { name: 'data.bin', bytes: data.length, sha256: digest(Buffer.from('other')) },
          ],
        ]),
      { check: () => {}, progress: () => {} },
    ),
    /Prüfsumme/,
  );
  assert.deepEqual(readdirSync(x.base), []);
});
