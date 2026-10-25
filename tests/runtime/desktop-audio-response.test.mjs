import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { createRequire } from 'node:module';
import { buildSync } from 'esbuild';
buildSync({
  entryPoints: ['desktop/audio-response.ts'],
  outfile: '.build/audio-response.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
});
const { audioResponse } = createRequire(import.meta.url)('../../.build/audio-response.cjs');
function fixture() {
  const root = mkdtempSync(path.join(tmpdir(), 'audio-response-')),
    file = root + '/own.wav',
    bytes = Buffer.from('0123456789');
  writeFileSync(file, bytes);
  let calls = 0;
  return {
    calls: () => calls,
    request: (range = null, method = 'GET') =>
      new Request('campaign://app/audio/own', { method, headers: range ? { Range: range } : {} }),
    respond: async (request) =>
      audioResponse(file, request, async (url, options) => {
        calls++;
        assert(url.startsWith('file:'));
        const range = options.headers.Range;
        const match = range && /bytes=(\d+)-(\d+)/.exec(range);
        return new Response(
          match ? bytes.subarray(Number(match[1]), Number(match[2]) + 1) : bytes,
          { headers: { 'Content-Type': 'audio/wav' } },
        );
      }),
    cleanup: () => rmSync(root, { recursive: true, force: true }),
  };
}
test('full media responses declare their size and range capability', async () => {
  const x = fixture();
  try {
    const r = await x.respond(x.request());
    assert.equal(r.status, 200);
    assert.equal(r.headers.get('content-length'), '10');
    assert.equal(r.headers.get('accept-ranges'), 'bytes');
    assert.equal(r.headers.get('content-type'), 'audio/wav');
    assert.equal(await r.text(), '0123456789');
  } finally {
    x.cleanup();
  }
});
for (const [range, text, contentRange] of [
  ['bytes=2-5', '2345', 'bytes 2-5/10'],
  ['bytes=6-', '6789', 'bytes 6-9/10'],
  ['bytes=-3', '789', 'bytes 7-9/10'],
  ['bytes=8-999', '89', 'bytes 8-9/10'],
])
  test('partial media metadata agrees with its bytes: ' + range, async () => {
    const x = fixture();
    try {
      const r = await x.respond(x.request(range));
      assert.equal(r.status, 206);
      assert.equal(r.headers.get('content-range'), contentRange);
      assert.equal(r.headers.get('content-length'), String(text.length));
      assert.equal(await r.text(), text);
    } finally {
      x.cleanup();
    }
  });
test('HEAD reads no media body and invalid ranges do not read the file', async () => {
  const x = fixture();
  try {
    const r = await x.respond(x.request(null, 'HEAD'));
    assert.equal(r.headers.get('content-length'), '10');
    assert.equal(await r.text(), '');
    for (const range of [
      'bytes=20-',
      'bytes=-0',
      'bytes=7-2',
      'bytes=0-2,4-6',
      'bytes=-',
      'invalid',
    ]) {
      const response = await x.respond(x.request(range));
      assert.equal(response.status, 416);
      assert.equal(response.headers.get('content-range'), 'bytes */10');
    }
    assert.equal(x.calls(), 0);
  } finally {
    x.cleanup();
  }
});
