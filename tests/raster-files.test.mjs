import { test } from "node:test";
import assert from "node:assert/strict";
import { encodeRasterFile } from "../src/features/verwaltung/raster-files.ts";

function canvasFake(result, width = 640, height = 480) {
  const calls = [];
  const canvas = {
    width,
    height,
    toBlob(callback, mimeType, quality) {
      calls.push({ mimeType, quality, width: this.width, height: this.height });
      if (result instanceof Error) throw result;
      queueMicrotask(() => callback(result));
    },
  };
  return { canvas, calls };
}

test("encodes all three formats directly from the unchanged canvas", async () => {
  for (const [format, mimeType, quality] of [
    ["png", "image/png", undefined],
    ["jpeg", "image/jpeg", 0],
    ["webp", "image/webp", 1],
  ]) {
    const blob = new Blob([`pixel-data-${format}`], { type: mimeType });
    const { canvas, calls } = canvasFake(blob);
    const encoded = await encodeRasterFile(canvas, { format, quality });
    assert.deepEqual(calls, [{ mimeType, quality, width: 640, height: 480 }]);
    assert.deepEqual(encoded, { format, mimeType, blob, widthPixels: 640, heightPixels: 480 });
    assert.equal(canvas.width, 640);
    assert.equal(canvas.height, 480);
    assert.equal(await encoded.blob.text(), `pixel-data-${format}`);
  }
});

test("rejects invalid format, quality and empty dimensions before encoding", async () => {
  const { canvas, calls } = canvasFake(new Blob(["x"], { type: "image/png" }));
  for (const options of [
    { format: "gif" },
    { format: "png", quality: 0.5 },
    { format: "jpeg", quality: -0.1 },
    { format: "webp", quality: 1.1 },
    { format: "jpeg", quality: NaN },
  ]) await assert.rejects(encodeRasterFile(canvas, options));
  assert.equal(calls.length, 0);
  await assert.rejects(encodeRasterFile(canvasFake(null, 0, 480).canvas, { format: "png" }), /positive Pixelabmessungen/);
});

test("detects Chromium fallback, missing data and encoder errors", async () => {
  const fallback = canvasFake(new Blob(["png"], { type: "image/png" }));
  await assert.rejects(encodeRasterFile(fallback.canvas, { format: "webp" }), /image\/png statt image\/webp/);
  await assert.rejects(encodeRasterFile(canvasFake(null).canvas, { format: "png" }), /keine PNG-Bilddaten/);
  await assert.rejects(encodeRasterFile(canvasFake(new Blob([], { type: "image/png" })).canvas, { format: "png" }), /keine PNG-Bilddaten/);
  const failure = new Error("SecurityError");
  await assert.rejects(encodeRasterFile(canvasFake(failure).canvas, { format: "jpeg" }),
    (error) => error.message.includes("JPEG exportiert") && error.cause === failure);
});

test("rejects canvas resize while asynchronous encoding is pending", async () => {
  const { canvas } = canvasFake(new Blob(["x"], { type: "image/png" }));
  const pending = encodeRasterFile(canvas, { format: "png" });
  canvas.width = 320;
  await assert.rejects(pending, /während des Exports verändert/);
});
