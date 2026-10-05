import { test } from "node:test";
import assert from "node:assert/strict";
import {
  readObjectArgb,
  writeObjectArgb,
  objectAlphaOpacity,
} from "../src/features/objekte/color-alpha.ts";

test("DD-028.06/.12 preserves four ARGB colors saved by Dungeondraft 1.2.0.1", () => {
  // own-colorable-object-alpha-solid.dungeondraft_map, QAObjASl asset.
  const samples = [
    ["ffffffff", 0xffffff, 255],
    ["ff4080c0", 0x4080c0, 255],
    ["804080c0", 0x4080c0, 128],
    ["004080c0", 0x4080c0, 0],
  ];
  for (const [native, rgb, alphaByte] of samples) {
    const decoded = readObjectArgb(native);
    assert.deepEqual(decoded, { rgb, alphaByte });
    assert.equal(writeObjectArgb(decoded), native);
  }
  assert.equal(objectAlphaOpacity(255), 1);
  assert.equal(objectAlphaOpacity(128), 128 / 255);
  assert.equal(objectAlphaOpacity(0), 0);
});

test("all 256 native alpha values round trip without truncation", () => {
  for (let alphaByte = 0; alphaByte <= 255; alphaByte++) {
    const native = writeObjectArgb({ rgb: 0x4080c0, alphaByte });
    assert.equal(readObjectArgb(native).alphaByte, alphaByte);
  }
  assert.throws(() => readObjectArgb("4080c0"));
  assert.throws(() => writeObjectArgb({ rgb: 0x4080c0, alphaByte: 256 }), RangeError);
  assert.throws(() => writeObjectArgb({ rgb: 0x1000000, alphaByte: 128 }), RangeError);
});
