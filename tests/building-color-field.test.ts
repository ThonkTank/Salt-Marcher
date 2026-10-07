import { test } from "node:test";
import assert from "node:assert/strict";
import { patternWithSaturationValue } from
  "../src/features/material/pattern-color-behavior";

test("DD-011.17 Building field rounds native RGB channels from known ARGB starts", () => {
  assert.equal(patternWithSaturationValue(0xb28f6f, .75,
    1 - 141 / 256, "nearest"), 0x73461d);
  assert.equal(patternWithSaturationValue(0x726e65, .75,
    1 - 140 / 256, "nearest"), 0x74591d);
  assert.equal(patternWithSaturationValue(0xb28f6f, .75,
    1 - 141 / 256), 0x72451c);
});
