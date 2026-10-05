import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  colorableSettingsFromMetadata,
  recolorColorableObjectPixel,
  recolorColorableObjectRgba,
} from "../src/features/objekte/colorable-pixels.ts";

const root = "../dungeon-auswertung/";
const modes = ["default", "ramp", "override", "saturation",
  "saturation-wide", "alpha-solid"];

for (const mode of modes) {
  test(`DD-028.11 Colorable ${mode}: 1024 native pixels within one byte`,
    async () => {
      const suffix = mode === "default" ? "" : `-${mode}`;
      const map = JSON.parse(await readFile(
        `${root}reference/own-colorable-object${suffix}.dungeondraft_map`,
        "utf8",
      ));
      assert.equal(map.header.creation_build, "1.2.0.1 opulent kirin");
      const settings = colorableSettingsFromMetadata(
        map.header.asset_manifest[0].custom_color_overrides);
      const rows = JSON.parse(await readFile(
        `${root}tests/fixtures/colorable-object${suffix}-probe/native-samples.json`,
        "utf8",
      ));
      assert.equal(rows.length, 1024);
      let maximumError = 0;
      for (const row of rows) {
        const result = recolorColorableObjectPixel(
          [...row.rgb, row.alpha],
          [...row.tint, row.tint_alpha],
          settings,
        );
        const visible = mode === "alpha-solid"
          ? result.slice(0, 3).map((value) =>
            Math.round(value * result[3] / 255 + 37 * (1 - result[3] / 255)))
          : result.slice(0, 3);
        maximumError = Math.max(maximumError,
          ...visible.map((value, index) =>
            Math.abs(value - row.native[index])));
      }
      assert.ok(maximumError <= 1, `max native RGB error ${maximumError}`);
    });
}

test("target A=0 removes only eligible pixels and leaves other pixels opaque", () => {
  assert.equal(recolorColorableObjectPixel(
    [200, 160, 160, 255], [64, 128, 192, 0])[3], 0);
  assert.deepEqual(recolorColorableObjectPixel(
    [200, 176, 176, 255], [64, 128, 192, 0]),
    [200, 176, 176, 255]);
  const source = new Uint8Array([200, 160, 160, 255, 200, 176, 176, 255]);
  const result = recolorColorableObjectRgba(source, [64, 128, 192, 0]);
  assert.equal(result[3], 0);
  assert.deepEqual([...result.slice(4)], [200, 176, 176, 255]);
  assert.deepEqual([...source], [200, 160, 160, 255, 200, 176, 176, 255]);
});

test("package overrides widen tolerance and can exclude low saturation", () => {
  const override = colorableSettingsFromMetadata({ enabled: true,
    min_redness: 0.1, min_saturation: 0, red_tolerance: 0.25 });
  const saturation = colorableSettingsFromMetadata({ enabled: true,
    min_redness: 0.1, min_saturation: 0.5, red_tolerance: 0.04 });
  const tint = [64, 128, 192, 255];
  assert.deepEqual(recolorColorableObjectPixel(
    [200, 64, 32, 255], tint), [200, 64, 32, 255]);
  assert.notDeepEqual(recolorColorableObjectPixel(
    [200, 64, 32, 255], tint, override), [200, 64, 32, 255]);
  assert.deepEqual(recolorColorableObjectPixel(
    [200, 160, 160, 255], tint, saturation), [200, 160, 160, 255]);
  assert.throws(() => recolorColorableObjectRgba(new Uint8Array(3), tint));
});
