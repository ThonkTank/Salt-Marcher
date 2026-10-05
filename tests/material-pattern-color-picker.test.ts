import { test } from "node:test";
import assert from "node:assert/strict";
import {
  patternColorFromHex,
  patternHex,
  patternHexWithAlpha,
  patternRgbFromHex,
} from "../src/features/material/pattern-color-picker";
import {
  patternHsv,
  patternRgbChannels,
  patternWithHue,
  patternWithRgbChannel,
  patternWithSample,
  patternWithSaturationValue,
} from "../src/features/material/pattern-color-behavior";

test("DD-020.26/.27 hex entry and Accept use the same 24-bit color", () => {
  assert.equal(patternRgbFromHex("ff00ff"), 0xff00ff);
  assert.equal(patternRgbFromHex("#3366CC"), 0x3366cc);
  assert.equal(patternHex(0xff00ff), "ff00ff");
  assert.equal(patternHex(0x3366cc), "3366cc");
  for (const value of [0, 1, 0x110059, 0xffffff])
    assert.equal(patternRgbFromHex(patternHex(value)), value);
});

test("DD-020.26 rejects incomplete or non-RGB input without a color change", () => {
  for (const value of ["", "abc", "#12345", "1234567", "#12GG56", "red"])
    assert.throws(() => patternRgbFromHex(value), RangeError);
  for (const value of [-1, 0x1000000, 1.5, NaN])
    assert.throws(() => patternHex(value), RangeError);
});

test("DD-020.21/.22 native picker samples preserve HSV parts and store measured RGB", () => {
  const base = 0x3366cc;
  const baseHsv = patternHsv(base);
  assert.ok(Math.abs(baseHsv.hue - 220 / 360) < 1e-10);
  assert.ok(Math.abs(baseHsv.saturation - 0.75) < 1e-10);
  assert.ok(Math.abs(baseHsv.value - 0.8) < 1e-10);
  // Measured native 1600×960 picker: field (72,557) in (8,389)-(264,646),
  // hue (282,454) in y=389..646. These are sample calibrations, not a
  // promise about other control sizes or intermediate pointer positions.
  assert.equal(patternWithSaturationValue(base, 64 / 256, 1 - 168 / 257), 0x424958);
  assert.equal(patternWithHue(base, 65 / 257), 0x7ccc33);
});

test("DD-020.23–.25 native numeric edits change exactly one RGB channel", () => {
  const base = 0x3366cc;
  assert.deepEqual(patternRgbChannels(base), { r: 51, g: 102, b: 204 });
  assert.equal(patternWithRgbChannel(base, "r", 100), 0x6466cc);
  assert.equal(patternWithRgbChannel(base, "g", 150), 0x3396cc);
  assert.equal(patternWithRgbChannel(base, "b", 50), 0x336632);
  for (const invalid of [-1, 256, 1.5, NaN])
    assert.throws(() => patternWithRgbChannel(base, "r", invalid), RangeError);
});

test("DD-020.28 opaque floor sampling replaces RGB and alpha from rendered pixel", () => {
  const before = { color: 0x3366cc, opacity: 160 / 255 };
  const sampled = patternWithSample(before, { color: 0x6e6059, alphaByte: 255 });
  assert.deepEqual(sampled, { color: 0x6e6059, opacity: 1 });
  assert.deepEqual(before, { color: 0x3366cc, opacity: 160 / 255 });
  assert.throws(() => patternWithSample(before, { color: 0x6e6059, alphaByte: 256 }), RangeError);
});

test("DD-020.26/.27 alpha-aware hex mirrors the native A160 display", () => {
  assert.equal(patternHexWithAlpha({ color: 0x3366cc, opacity: 1 }), "3366cc");
  assert.equal(patternHexWithAlpha({ color: 0x3366cc, opacity: 160 / 255 }), "a03366cc");
  assert.deepEqual(patternColorFromHex("#a03366cc", 1), {
    color: 0x3366cc,
    opacity: 160 / 255,
  });
  assert.deepEqual(patternColorFromHex("#3366cc", 160 / 255), {
    color: 0x3366cc,
    opacity: 160 / 255,
  });
  assert.throws(() => patternColorFromHex("a03366c", 1), RangeError);
});
