import assert from "node:assert/strict";
import test from "node:test";
import { GRID_PRESETS, GRID_PPI_RANGE, gridOutputDimensions,
  selectGridPreset, setManualGridPpi } from
  "../src/features/verwaltung/grid-presets.ts";

test("DD-043.13 exposes seven native choices in order and maps six fixed PPI values", () => {
  assert.deepEqual(GRID_PRESETS.map(({ label, ppi }) => [label, ppi]), [
    ["Custom", null], ["Best Quality", 256], ["Optimal Halved", 128],
    ["Commercial Print", 300], ["Roll 20", 70], ['40" TV', 54],
    ['55" TV', 80],
  ]);
  for (const preset of GRID_PRESETS.slice(1))
    assert.deepEqual(selectGridPreset(preset.id, 96),
      { presetId: preset.id, pixelsPerCell: preset.ppi });
  assert.deepEqual(GRID_PPI_RANGE, { min: 16, max: 300 });
});

test("Custom keeps PPI and a manual edit returns the choice to Custom", () => {
  assert.deepEqual(selectGridPreset("custom", 96),
    { presetId: "custom", pixelsPerCell: 96 });
  assert.deepEqual(setManualGridPpi(96),
    { presetId: "custom", pixelsPerCell: 96 });
  assert.deepEqual(setManualGridPpi(16),
    { presetId: "custom", pixelsPerCell: 16 });
  assert.deepEqual(setManualGridPpi(300),
    { presetId: "custom", pixelsPerCell: 300 });
  for (const ppi of [15, 301, NaN, Infinity]) {
    assert.equal(setManualGridPpi(ppi), null);
    assert.equal(selectGridPreset("custom", ppi), null);
  }
  assert.equal(selectGridPreset("missing", 96), null);
});

test("output dimensions use rounded PPI and optional rounded crop field size", () => {
  assert.deepEqual(gridOutputDimensions({ width: 8, height: 8 }, 256),
    { width: 2048, height: 2048 });
  assert.deepEqual(gridOutputDimensions({ width: 8, height: 8 }, 128,
    { width: 4, height: 3 }), { width: 512, height: 384 });
  assert.deepEqual(gridOutputDimensions({ width: 8, height: 8 }, 75.2,
    { width: 2.4, height: 1.6 }), { width: 150, height: 150 });
  assert.deepEqual(gridOutputDimensions({ width: 8, height: 8 }, 75.8),
    { width: 608, height: 608 });
  assert.equal(gridOutputDimensions({ width: 8, height: 8 }, 75.5), null);
  assert.equal(gridOutputDimensions({ width: 8, height: 8 }, 128,
    { width: 2.5, height: 3 }), null);
  assert.equal(gridOutputDimensions({ width: 8, height: 8 }, 128,
    { width: 9, height: 3 }), null);
  assert.equal(gridOutputDimensions({ width: 8, height: 8 }, 128,
    { width: 0, height: 3 }), null);
});
