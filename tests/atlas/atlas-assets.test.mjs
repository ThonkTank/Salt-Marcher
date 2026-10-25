import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSync } from 'esbuild';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

buildSync({
  entryPoints: ['src/app/atlas/atlas-assets.ts'],
  outfile: '.build/atlas-assets-test.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
});
const {
  ATLAS_FONT_COVERAGE,
  ATLAS_FONT_FAMILY,
  ATLAS_FONT_FILES,
  ATLAS_FONT_STACK,
  ATLAS_MARKER_IMAGE_ID,
  ATLAS_SYMBOLS_FAMILY,
  atlasMarkerImage,
  preloadAtlasFonts,
} = createRequire(import.meta.url)('../../.build/atlas-assets-test.cjs');

test('font preflight fetches only same-origin assets and waits for loaded faces before resolving', async () => {
  const calls = [],
    added = [],
    loaded = [];
  class FakeFontFace {
    constructor(family, source, descriptors) {
      this.family = family;
      this.source = source;
      this.descriptors = descriptors;
      this.status = 'unloaded';
    }
    async load() {
      this.status = 'loaded';
      return this;
    }
  }
  const document = {
    location: { protocol: 'campaign:', host: 'app', href: 'campaign://app/index.html' },
    fonts: {
      add(face) {
        assert.equal(face.status, 'loaded');
        added.push(face);
      },
      async load(specimen, text) {
        loaded.push({ specimen, text });
        return added;
      },
    },
  };
  const fetcher = async (url, options) => {
    calls.push({ url, options });
    return { ok: true, status: 200, arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer };
  };
  const options = { base: 'campaign://app/', document, fetcher, FontFaceConstructor: FakeFontFace };
  const first = preloadAtlasFonts(options),
    second = preloadAtlasFonts(options);
  assert.equal(first, second);
  await first;
  assert.equal(calls.length, 2);
  assert(calls.every((call) => call.url.startsWith('campaign://app/atlas-fonts/')));
  assert(calls.every((call) => call.options.credentials === 'same-origin'));
  assert.deepEqual(
    added.map((face) => face.family),
    [ATLAS_FONT_FAMILY, ATLAS_SYMBOLS_FAMILY],
  );
  assert(added.every((face) => face.descriptors.weight === '100 900'));
  assert.equal(loaded.length, 2);
  await assert.rejects(
    () => preloadAtlasFonts({ ...options, base: 'campaign://elsewhere/' }),
    /local application asset origin/,
  );
});

test('vendored font bytes match the recorded provenance and include the full OFL license', () => {
  const files = [
    [
      'resources/atlas-fonts/NotoSans-VF.ttf',
      'fb53504de62e767a54695416123d68d67f71c9b69722175184ad56e7dd13547b',
    ],
    [
      'resources/atlas-fonts/NotoSansSymbols-VF.ttf',
      '63724daeff6755a45933b9a5e3a3b41df5df8fe925c0f4c991f2f68c08a4182d',
    ],
  ];
  for (const [file, expected] of files) {
    const digest = createHash('sha256').update(readFileSync(file)).digest('hex');
    assert.equal(digest, expected, file);
  }
  const license = readFileSync('resources/atlas-fonts/OFL-1.1.txt', 'utf8');
  const provenance = readFileSync('resources/atlas-fonts/PROVENANCE.md', 'utf8');
  assert.match(license, /SIL OPEN FONT LICENSE Version 1\.1/);
  assert.match(license, /PERMISSION & CONDITIONS/);
  assert.match(license, /DISCLAIMER/);
  assert.match(provenance, /google-noto-fonts-20251201-2\.fc44\.src\.rpm/);
  assert.match(provenance, /Copyright 2022 The Noto\s+Project Authors/);
  assert.match(provenance, /not complete Unicode coverage/i);
});

test('generated marker is deterministic local RGBA', () => {
  const image = atlasMarkerImage(),
    again = atlasMarkerImage();
  assert.equal(image.width, 48);
  assert.equal(image.height, 72);
  assert.deepEqual(image, again);
  assert.equal(image.data.length, image.width * image.height * 4);
  const pixel = (x, y) =>
    Array.from(image.data.slice((y * image.width + x) * 4, (y * image.width + x) * 4 + 4));
  assert.deepEqual(pixel(0, 0), [0, 0, 0, 0]);
  assert.deepEqual(pixel(24, 24), [242, 223, 173, 255]);
  assert.deepEqual(pixel(24, 62), [54, 92, 83, 255]);
});
