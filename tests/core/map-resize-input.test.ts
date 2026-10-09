import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeResizeEdge } from "../../src/features/verwaltung/map-resize-input";

test("DD-038 edge input follows the measured 12×8 Dungeondraft bounds", () => {
  const zero = { left: 0, right: 0, top: 0, bottom: 0 };
  for (const [typed, shown] of [
    [-5, -4], [-4, -4], [116, 64], [117, 64], [999, 64],
    [1.5, 2], [-0.5, -1], [-1.5, -2], [-2.5, -3], [-1.49, -1],
  ] as const)
    assert.equal(normalizeResizeEdge(12, 8, zero, "left", typed), shown);
  assert.equal(normalizeResizeEdge(12, 8,
    { ...zero, right: 64 }, "left", -999), -64);
  assert.equal(normalizeResizeEdge(12, 8,
    { ...zero, left: -4 }, "right", -4), 0);
  assert.equal(normalizeResizeEdge(12, 8,
    { ...zero, left: 4 }, "right", -8), -8);
  assert.equal(normalizeResizeEdge(12, 8, zero, "top", -1), 0);
  assert.equal(normalizeResizeEdge(12, 8,
    { ...zero, top: 4 }, "bottom", -4), -4);
  assert.equal(normalizeResizeEdge(12, 8,
    { ...zero, top: 64 }, "bottom", 999), 56);
});
