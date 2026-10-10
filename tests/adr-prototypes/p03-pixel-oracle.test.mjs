import assert from "node:assert/strict";
import test from "node:test";
import {
  canaryPixels,
  findPrivateRaster,
} from "../../tools/adr-prototypes/p03/pixel-oracle.mjs";

test("P03 raster oracle detects scaled and mildly transformed positive controls", () => {
  assert.deepEqual(findPrivateRaster(canaryPixels(1)), {
    x: 0,
    y: 0,
    scale: 1,
  });
  assert.deepEqual(
    findPrivateRaster(canaryPixels(2, (value) => Math.max(0, value - 10))),
    { x: 0, y: 0, scale: 2 },
  );
});

test("P03 raster oracle rejects a uniform public frame", () => {
  assert.equal(
    findPrivateRaster({
      width: 32,
      height: 32,
      data: Buffer.alloc(32 * 32 * 4, 90),
    }),
    null,
  );
});
