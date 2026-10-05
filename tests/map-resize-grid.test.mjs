import assert from "node:assert/strict";
import test from "node:test";
import { resizeCellGrid } from "../src/features/verwaltung/map-resize-grid.ts";

const parseRows = (rows) => rows.join("").split("").map((cell) =>
  cell === "." ? -1 : Number(cell));
const source = [
  "............", ".11100......", "............", "............",
  "............", "............", "............", ".11111......",
];
const cropped = [
  ".........", "100......", ".........", ".........",
  ".........", ".........", ".........", "111......",
];
const restored = [
  "............", "...100......", "............", "............",
  "............", "............", "............", "...111......",
];

test("DD-038 native left crop loses four tile cells while reexpand cannot restore them", () => {
  const afterCrop = resizeCellGrid(parseRows(source), 12, 8,
    { left: -3, right: 0, top: 0, bottom: 0 }, -1);
  assert.deepEqual(afterCrop, { width: 9, height: 8, cells: parseRows(cropped) });
  const afterReexpand = resizeCellGrid(afterCrop.cells, 9, 8,
    { left: 3, right: 0, top: 0, bottom: 0 }, -1);
  assert.deepEqual(afterReexpand,
    { width: 12, height: 8, cells: parseRows(restored) });
  assert.equal(afterReexpand.cells.filter((cell) => cell >= 0).length, 6);
});

test("positive left and top margins move cells by exactly those fields", () => {
  const result = resizeCellGrid([1, 2, 3, 4], 2, 2,
    { left: 1, right: 0, top: 2, bottom: 0 }, -1);
  assert.deepEqual(result, { width: 3, height: 4,
    cells: [-1, -1, -1, -1, -1, -1, -1, 1, 2, -1, 3, 4] });
});

test("invalid dimensions and cell counts never silently crop data", () => {
  assert.throws(() => resizeCellGrid([1], 2, 1,
    { left: 0, right: 0, top: 0, bottom: 0 }, -1), RangeError);
  assert.throws(() => resizeCellGrid([1, 2], 2, 1,
    { left: -2, right: 0, top: 0, bottom: 0 }, -1), RangeError);
  assert.throws(() => resizeCellGrid([1, 2], 2, 1,
    { left: 0.5, right: 0, top: 0, bottom: 0 }, -1), RangeError);
});
