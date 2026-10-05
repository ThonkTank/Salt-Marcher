import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";

const bundle = await build({
  entryPoints: ["src/features/objekte/light-color-palette.ts"],
  bundle: true,
  write: false,
  format: "esm",
  platform: "node",
  logLevel: "silent",
});
const { LightColorPalette, LIGHT_COLOR_PRESETS } = await import(
  "data:text/javascript;base64," +
    Buffer.from(bundle.outputFiles[0].contents).toString("base64")
);

test("DD-028.17 shows the five measured native Light swatch colors", () => {
  assert.deepEqual(
    LIGHT_COLOR_PRESETS.map(({ color }) => color),
    [0xeccd8b, 0xeaefca, 0x80beff, 0xffad58, 0x4dd569],
  );
});

test("DD-028.17 blue preset updates the tool color and closes the palette", () => {
  const chosen = [];
  const palette = new LightColorPalette((color) => chosen.push(color));
  assert.equal(palette.isOpen, false);
  assert.throws(() => palette.select("blue"), /geschlossen/);
  palette.open();
  assert.equal(palette.isOpen, true);
  assert.equal(palette.select("blue"), 0x80beff);
  assert.deepEqual(chosen, [0x80beff]);
  assert.equal(palette.isOpen, false);
  palette.open();
  palette.close();
  assert.equal(palette.isOpen, false);
  assert.deepEqual(chosen, [0x80beff]);
});
