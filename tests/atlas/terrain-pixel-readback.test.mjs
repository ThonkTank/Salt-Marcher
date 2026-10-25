import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  TerrainPixelReadback,
  terrainPixelDifference,
} from '../../tools/terrain-pixel-readback.mjs';
function fakeGL() {
  const gl = {
    PIXEL_PACK_BUFFER: 1,
    PIXEL_PACK_BUFFER_BINDING: 2,
    PACK_ALIGNMENT: 3,
    PACK_ROW_LENGTH: 4,
    PACK_SKIP_PIXELS: 5,
    PACK_SKIP_ROWS: 6,
    STREAM_READ: 7,
    RGBA: 8,
    UNSIGNED_BYTE: 9,
    SYNC_GPU_COMMANDS_COMPLETE: 10,
    TIMEOUT_EXPIRED: 11,
    CONDITION_SATISFIED: 12,
    ALREADY_SIGNALED: 13,
    WAIT_FAILED: 14,
    color: 40,
    reads: 0,
    deletedBuffers: [],
    deletedSyncs: [],
    fences: [],
  };
  const external = { external: true },
    values = new Map([
      [2, external],
      [3, 8],
      [4, 7],
      [5, 2],
      [6, 3],
    ]);
  gl.queries = [];
  gl.getParameter = (k) => {
    gl.queries.push(k);
    return values.get(k);
  };
  gl.createBuffer = () => ({});
  gl.bindBuffer = (_, b) => values.set(2, b);
  gl.bufferData = (_, size) => (values.get(2).data = new Uint8Array(size));
  gl.pixelStorei = (k, v) => values.set(k, v);
  gl.readPixels = (x, y, w, h, format, type, offset) => {
    assert.equal(values.get(3), 1);
    for (const k of [4, 5, 6]) assert.equal(values.get(k), 0);
    assert.equal(offset, 0);
    values.get(2).data.fill(gl.color, 0, w * h * 4);
  };
  gl.fenceSync = () => {
    const f = { ready: false };
    gl.fences.push(f);
    return f;
  };
  gl.flush = () => {};
  gl.clientWaitSync = (s, flags, timeout) => {
    assert.equal(flags, 0);
    assert.equal(timeout, 0);
    return s.failed ? gl.WAIT_FAILED : s.ready ? gl.CONDITION_SATISFIED : gl.TIMEOUT_EXPIRED;
  };
  gl.getBufferSubData = (_, offset, bytes) => {
    gl.reads++;
    bytes.set(values.get(2).data.subarray(offset, offset + bytes.length));
  };
  gl.deleteSync = (s) => gl.deletedSyncs.push(s);
  gl.deleteBuffer = (b) => gl.deletedBuffers.push(b);
  return { gl, external, values };
}
test('pixel readback waits for fences, preserves pack state, bounds its queue and disposes pending GPU resources', () => {
  const { gl, external, values } = fakeGL(),
    original = [...values],
    reader = new TerrainPixelReadback(gl, 256, 2),
    box = { x: 0, y: 0, width: 2, height: 2 },
    seen = [];
  assert.equal(gl.getParameter(gl.PIXEL_PACK_BUFFER_BINDING), external);
  assert(reader.enqueue(box, { name: 'before' }));
  gl.color = 90;
  assert(reader.enqueue(box, { name: 'after' }));
  assert.equal(reader.enqueue(box, {}), false);
  assert.deepEqual([...values], original);
  reader.poll((bytes, p) => seen.push([p.meta.name, [...bytes]]));
  assert.equal(gl.reads, 0, 'no CPU read before GPU completion');
  gl.queries = [];
  gl.fences[0].ready = true;
  reader.poll((bytes, p) => seen.push([p.meta.name, [...bytes]]));
  assert.deepEqual(seen, [['before', Array(16).fill(40)]]);
  assert.deepEqual(
    gl.queries,
    [gl.PIXEL_PACK_BUFFER_BINDING],
    'CPU copies do not query irrelevant pixel pack state',
  );
  gl.fences[1].ready = true;
  reader.poll((bytes, p) => seen.push([p.meta.name, [...bytes]]));
  assert.deepEqual(seen[1], ['after', Array(16).fill(90)]);
  assert.deepEqual([...values], original);
  assert(reader.enqueue(box, {}));
  gl.fences.at(-1).failed = true;
  assert.throws(() => reader.poll(() => assert.fail()), /fence wait failed/);
  assert.throws(() => reader.enqueue({ ...box, width: 100 }, {}), /capacity/);
  reader.dispose();
  assert.equal(gl.deletedBuffers.length, 2);
  assert.equal(gl.deletedSyncs.length, 3);
  assert.equal(reader.pending.length, 0);
});
test('brush comparison detects an interior edge change missed by the centre and excludes the reticle ring', () => {
  const region = { x: 100, y: 200, width: 64, height: 64, centerX: 132, centerY: 232, radius: 30 },
    before = new Uint8Array(64 * 64 * 4),
    after = before.slice(),
    set = (x, y, n) => (after[(y * 64 + x) * 4] = n);
  set(61, 32, 255);
  set(20, 32, 2);
  assert.deepEqual(terrainPixelDifference(before, after, region), {
    center: 0,
    brush: 0,
    maximum: 2,
  });
  set(55, 32, 20);
  assert.deepEqual(terrainPixelDifference(before, after, region), {
    center: 0,
    brush: 1,
    maximum: 20,
  });
  set(32, 32, 10);
  assert.deepEqual(terrainPixelDifference(before, after, region), {
    center: 1,
    brush: 2,
    maximum: 20,
  });
  assert.deepEqual(
    terrainPixelDifference(before, after, { ...region, x: 0, y: 0, centerX: 32, centerY: 32 }),
    { center: 1, brush: 2, maximum: 20 },
  );
});
