// Exercise the shipped worker through the actual restricted Electron app protocol.
import assert from 'node:assert/strict';
import path from 'node:path';
import { createNativeSession } from './native-session.mjs';

const output = path.resolve(process.env.QA_EVIDENCE_DIR ?? '.build/brush-worker-native');
const native = await createNativeSession({ name: 'brush-worker', output });
try {
  const page = await native.launch(1);
  const result = await page.evaluate(async () => {
    const worker = new Worker(new URL('atlas-brush-worker.js', document.baseURI));
    const request = (job) =>
      new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(Error('Brush worker response timeout')), 10000);
        worker.onerror = (event) => {
          clearTimeout(timeout);
          reject(Error(event.message));
        };
        worker.onmessage = ({ data }) => {
          clearTimeout(timeout);
          resolve({
            generation: data.generation,
            pixels: data.pixels ? Array.from(data.pixels) : null,
            error: data.error,
          });
        };
        worker.postMessage(job);
      });
    try {
      const job = {
        generation: 71,
        records: [],
        box: { x: 0, y: 0, width: 10, height: 10 },
        width: 10,
        height: 10,
      };
      const pixels = await request(job);
      const failure = await request({ ...job, generation: 72, records: null });
      const recovered = await request({ ...job, generation: 73 });
      return { pixels, failure, recovered };
    } finally {
      worker.terminate();
    }
  });
  assert.equal(result.pixels.generation, 71);
  assert.equal(result.pixels.pixels.length, 400);
  assert.equal(result.pixels.error, undefined);
  assert.equal(result.failure.generation, 72);
  assert.equal(typeof result.failure.error, 'string');
  assert.equal(result.failure.pixels, null);
  assert.equal(result.recovered.generation, 73);
  assert.equal(result.recovered.error, undefined);
  assert.deepEqual(result.recovered.pixels, result.pixels.pixels);
  await native.close();
  await native.finish({ result, checks: ['Packaged brush worker: pixels, error, subsequent job'] });
  console.log(JSON.stringify({ output, complete: true }));
} catch (error) {
  await native.fail(error);
  throw error;
} finally {
  await native.dispose();
}
