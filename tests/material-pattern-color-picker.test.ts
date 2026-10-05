import { test } from "node:test";
import assert from "node:assert/strict";
import {
  patternHex,
  patternRgbFromHex,
} from "../src/features/material/pattern-color-picker";

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
