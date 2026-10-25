import { test } from "node:test";
import assert from "node:assert/strict";
import { PNG } from "pngjs";
import { decodeBrowserImagePixels } from "../../../src/features/objekte/browser-image-pixels";

test("colorable PNG keeps raw RGBA for transparent and half-transparent pixels", async () => {
  const image = new PNG({ width: 4, height: 1 });
  const pixels = Uint8Array.from([
    210, 15, 35, 0,
    180, 30, 40, 128,
    90, 70, 50, 255,
    255, 0, 0, 64,
  ]);
  image.data = Buffer.from(pixels);
  const encoded = PNG.sync.write(image, { colorType: 6 });
  const bytes = new Uint8Array(encoded.byteLength);
  bytes.set(encoded);
  const result = await decodeBrowserImagePixels(new Blob([bytes]));
  assert.equal(result.width, 4);
  assert.equal(result.height, 1);
  assert.deepEqual([...result.rgba], [...pixels]);
});
