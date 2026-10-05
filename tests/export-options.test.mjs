import assert from "node:assert/strict";
import test from "node:test";
import { exportFormatLabels, exportPixelDimensions, nonNegativePercent,
  positivePixelsPerCell, validExportCrop } from
  "../src/features/verwaltung/export-options.ts";

test("Exportformate bieten alle vier angeforderten Ausgaben", () => {
  assert.deepEqual(Object.keys(exportFormatLabels),
    ["png", "jpeg", "webp", "universal-vtt"]);
});

test("Pixel pro Feld akzeptiert nur sichere positive Ganzzahlen", () => {
  assert.equal(positivePixelsPerCell("256"), 256);
  assert.equal(positivePixelsPerCell("1"), 1);
  for (const value of ["", "0", "-1", "1,5", ".25", "NaN", "Infinity",
    "0x10", "1e3", "1px", "9007199254740992"])
    assert.equal(positivePixelsPerCell(value), null, value);
});

test("sichtbare Prozentwerte und Kartenfeld-Zuschnitt bleiben prüfbar", () => {
  assert.equal(nonNegativePercent("100"), 100);
  assert.equal(nonNegativePercent("12,5"), 12.5);
  assert.equal(nonNegativePercent("101", 100), null);
  assert.equal(nonNegativePercent("-1"), null);
  const mapSize = { width: 8, height: 8 };
  assert.deepEqual(exportPixelDimensions(mapSize, 256),
    { width: 2048, height: 2048 });
  const crop = { x: 1, y: 2, width: 4, height: 3 };
  assert.equal(validExportCrop(crop, mapSize), true);
  assert.deepEqual(exportPixelDimensions(mapSize, 256, crop),
    { width: 1024, height: 768 });
  assert.equal(validExportCrop({ ...crop, width: 8 }, mapSize), false);
  assert.equal(exportPixelDimensions(mapSize, 256, { ...crop, width: 8 }), null);
});
