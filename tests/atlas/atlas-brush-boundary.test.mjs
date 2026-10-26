import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runInNewContext } from 'node:vm';
import { buildSync } from 'esbuild';

function load(entry, self, document) {
  const { outputFiles } = buildSync({
    entryPoints: [`src/app/atlas/${entry}.ts`],
    bundle: true,
    platform: 'browser',
    format: 'iife',
    globalName: 'preview',
    write: false,
  });
  const context = { self, document, structuredClone, Uint8Array, Uint8ClampedArray, atob, btoa };
  runInNewContext(outputFiles[0].text, context);
  return context.preview;
}

const job = {
  generation: 7,
  records: [],
  box: { x: 0, y: 0, width: 2, height: 2 },
  width: 2,
  height: 2,
};

test('pure brush preview leaves worker registration untouched', () => {
  const sentinel = () => {};
  const self = { onmessage: sentinel };
  const preview = load('atlas-brush-preview', self);
  assert.equal(self.onmessage, sentinel);
  assert.equal(preview.renderBrushPreview(job).length, 16);
});

test('browser brush entry registers jobs, transfers pixels and reports failures', () => {
  const messages = [];
  const self = { postMessage: (...args) => messages.push(args) };
  load('atlas-brush-worker', self);
  assert.equal(typeof self.onmessage, 'function');
  self.onmessage({ data: job });
  const [result, options] = messages[0];
  assert.equal(result.generation, job.generation);
  const preview = load('atlas-brush-preview', {});
  assert.deepEqual([...result.pixels], [...preview.renderBrushPreview(job)]);
  assert.equal(options.transfer.length, 1);
  assert.equal(options.transfer[0], result.pixels.buffer);
  self.onmessage({ data: { ...job, records: null } });
  assert.equal(messages[1][0].generation, job.generation);
  assert.equal(typeof messages[1][0].error, 'string');
  assert.equal(messages[1].length, 1);
});

test('browser brush entry does not register on the document surface', () => {
  const sentinel = () => {};
  const self = { onmessage: sentinel };
  load('atlas-brush-worker', self, {});
  assert.equal(self.onmessage, sentinel);
});
