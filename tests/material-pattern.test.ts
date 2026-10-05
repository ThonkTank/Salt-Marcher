import { test } from "node:test";
import assert from "node:assert/strict";
import {
  alphaByteFromOpacity,
  initialPatternAppearance,
  opacityFromAlphaByte,
} from "../src/features/material/pattern-appearance";

test("DD-020.13 preserves every 8-bit alpha value in the surface opacity", () => {
  for (let alpha = 0; alpha <= 255; alpha++)
    assert.equal(alphaByteFromOpacity(opacityFromAlphaByte(alpha)), alpha);
  assert.equal(opacityFromAlphaByte(160), 160 / 255);
});

test("DD-020.13 rejects alpha values that cannot be stored as an 8-bit value", () => {
  for (const value of [-1, 0.5, 256, NaN, Infinity])
    assert.throws(() => opacityFromAlphaByte(value), RangeError);
  for (const value of [-0.01, 1.01, NaN, Infinity])
    assert.throws(() => alphaByteFromOpacity(value), RangeError);
});

test("DD-020.14 starts a new pattern without an outline", () => {
  assert.deepEqual(initialPatternAppearance, { opacity: 1, wallWidth: 0 });
});
