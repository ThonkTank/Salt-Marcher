import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";

const bundle = await build({
  entryPoints: ["src/features/objekte/rgba-picker.ts"],
  bundle: true,
  write: false,
  format: "esm",
  platform: "node",
  logLevel: "silent",
});
const { ObjectColorPicker } = await import(
  "data:text/javascript;base64," +
    Buffer.from(bundle.outputFiles[0].contents).toString("base64")
);

function picker(rgb = 0x6b3834, alpha = 255) {
  const previews = [],
    commits = [],
    closes = [];
  const controller = new ObjectColorPicker(rgb, alpha, {
    onPreview: (color, a) => previews.push([color, a]),
    onCommit: (color, a) => commits.push([color, a]),
    onClose: (reason) => closes.push(reason),
  });
  return { controller, previews, commits, closes };
}

test("DD-028.06 synchronizes six-digit Hex, numeric alpha, and native ARGB", () => {
  const { controller, previews, commits } = picker();
  assert.equal(controller.argb, "ff6b3834");
  assert.equal(controller.hexDisplay, "6b3834");
  assert.equal(controller.setHex("#4080c0"), true);
  assert.deepEqual(controller.value, { r: 64, g: 128, b: 192, a: 255 });
  assert.equal(controller.argb, "ff4080c0");
  assert.equal(controller.hexDisplay, "4080c0");
  assert.equal(controller.setChannel("a", 128), true);
  assert.equal(controller.argb, "804080c0");
  assert.equal(controller.hexDisplay, "804080c0");
  assert.equal(controller.setChannel("a", 0), true);
  assert.equal(controller.argb, "004080c0");
  assert.deepEqual(previews, [
    [0x4080c0, 255],
    [0x4080c0, 128],
    [0x4080c0, 0],
  ]);
  assert.deepEqual(commits, []);
  controller.close("accept");
  assert.deepEqual(commits, [[0x4080c0, 0]]);
});

test("DD-028.06 Escape keeps live color and commits exactly once", () => {
  const { controller, previews, commits, closes } = picker(0x4080c0, 128);
  assert.equal(controller.setHex("004080c0"), true);
  assert.deepEqual(previews, [[0x4080c0, 0]]);
  controller.close("escape");
  controller.close("accept");
  assert.deepEqual(commits, [[0x4080c0, 0]]);
  assert.deepEqual(closes, ["escape"]);
  assert.equal(controller.argb, "004080c0");
  assert.equal(controller.setChannel("a", 255), false);
});

test("invalid or incomplete entries do not change the preview or create history", () => {
  const { controller, previews, commits } = picker(0x4080c0, 255);
  for (const value of ["", "4080c", "804080c", "zz4080c0", "004080c000"])
    assert.equal(controller.setHex(value), false);
  for (const value of [-1, 0.5, 256, Number.NaN])
    assert.equal(controller.setChannel("a", value), false);
  assert.deepEqual(previews, []);
  controller.close("accept");
  assert.deepEqual(commits, []);
});

test("editing back to the initial color leaves no history command", () => {
  const { controller, previews, commits } = picker(0x4080c0, 255);
  controller.setChannel("a", 128);
  controller.setChannel("a", 255);
  assert.deepEqual(previews, [
    [0x4080c0, 128],
    [0x4080c0, 255],
  ]);
  controller.close("escape");
  assert.deepEqual(commits, []);
});

test("six-digit Hex preserves alpha while eight-digit Hex replaces it", () => {
  const { controller } = picker(0x4080c0, 128);
  assert.equal(controller.setHex("ff0000"), true);
  assert.equal(controller.argb, "80ff0000");
  assert.equal(controller.setHex("0000ff00"), true);
  assert.equal(controller.argb, "0000ff00");
  assert.equal(controller.setHex("ffffff00"), true);
  assert.equal(controller.argb, "ffffff00");
});
