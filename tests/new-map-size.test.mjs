import assert from "node:assert/strict";
import test from "node:test";
import { NEW_MAP_DEFAULT_SIZE, newMapDialogSize } from
  "../src/features/verwaltung/new-map-size.ts";

test("DD-001 native New Map starts at 35 by 20 fields", () => {
  assert.deepEqual(NEW_MAP_DEFAULT_SIZE, { width: 35, height: 20 });
});

test("DD-001 measured width 0 and 7.5 yield eight fields", () => {
  assert.deepEqual(newMapDialogSize(0, 20), { width: 8, height: 20 });
  assert.deepEqual(newMapDialogSize(7.5, 20), { width: 8, height: 20 });
  assert.deepEqual(newMapDialogSize(8, 8), { width: 8, height: 8 });
});

test("unmeasured rounding and height rules are not imposed", () => {
  assert.deepEqual(newMapDialogSize(9.5, 20), { width: 9.5, height: 20 });
  assert.deepEqual(newMapDialogSize(35, 7.5), { width: 35, height: 7.5 });
  assert.deepEqual(newMapDialogSize(-1, 20), { width: -1, height: 20 });
  assert(Number.isNaN(newMapDialogSize(NaN, 20).width));
});
