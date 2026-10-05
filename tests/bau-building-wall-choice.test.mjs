import assert from "node:assert/strict";
import test from "node:test";
import {
  buildingDrawStyle,
  buildingHasWall,
  buildingStyleKey,
} from "../src/features/bau/building-wall-choice.ts";

const defaults = {
  layer: 200,
  color: 0xbfb09a,
  wallColor: 0x403e39,
  wallWidth: 0.2,
};
const stone = {
  assetId: "builtin-stone",
  tileSize: 1,
  tint: 0xff7f7e71,
  rotation: 0,
};

test("DD-015.01: a preselected package wall survives into the new Building style", () => {
  const style = buildingDrawStyle(defaults, stone, {
    kind: "asset",
    assetId: "QAWall01/QA Wall",
  });
  assert.equal(style.wallAssetId, "QAWall01/QA Wall");
  assert.equal(style.wallWidth, 0.2);
  assert.equal(style.material, stone);
  assert.equal(buildingHasWall(style), true);
  assert.throws(
    () =>
      buildingDrawStyle(defaults, stone, {
        kind: "asset",
        assetId: "  ",
      }),
    /Assetkennung/,
  );
});

test("DD-015.02: None preserves a floor style without a wall or package texture", () => {
  const none = buildingDrawStyle(defaults, stone, { kind: "none" });
  const basic = buildingDrawStyle(defaults, stone, { kind: "basic" });
  assert.equal(none.fill, basic.fill);
  assert.equal(none.material, basic.material);
  assert.equal(none.wallWidth, 0);
  assert.equal(none.wallAssetId, undefined);
  assert.equal(buildingHasWall(none), false);
  assert.notEqual(buildingStyleKey(none), buildingStyleKey(basic));
});

test("DD-015.01 and DD-011.11/.12: style batching separates walls and preserves older floor tints", () => {
  const first = buildingDrawStyle(defaults, stone, { kind: "basic" });
  const packageWall = buildingDrawStyle(defaults, stone, {
    kind: "asset",
    assetId: "QAWall01/QA Wall",
  });
  const newTint = buildingDrawStyle(
    defaults,
    { ...stone, tint: 0xffe87917 },
    { kind: "basic" },
  );
  assert.notEqual(buildingStyleKey(first), buildingStyleKey(packageWall));
  assert.notEqual(buildingStyleKey(first), buildingStyleKey(newTint));
  assert.equal(first.material.tint, 0xff7f7e71);
  assert.equal(buildingStyleKey(first), buildingStyleKey({ ...first }));
});
