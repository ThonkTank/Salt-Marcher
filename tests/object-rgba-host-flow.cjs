// DD-028.06 host flow. Import from the isolated host runner after its
// object-alpha fixture has created and saved ObjectAlphaQA/Karte.dungeon.
// Pass the saved mapPath/ids and an external stateFile to runEdit. In a fresh
// process with that isolated vault preserved, call verifyReopen with stateFile.
// Do not rerun the old object-alpha reopen assertions after runEdit: that
// older case expects the original [255, 128, 0] alpha order.
// This module deliberately never starts Obsidian or a graphical process.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { PNG } = require("pngjs");

const PICKER_BUTTON = "Objektfarbe RGBA öffnen";
const CANVAS = ".dn-canvas canvas";

function pixelDifference(before, after, point, halfWidth, halfHeight) {
  const left = Math.max(0, Math.floor(point.x - halfWidth));
  const right = Math.min(before.width, Math.ceil(point.x + halfWidth));
  const top = Math.max(0, Math.floor(point.y - halfHeight));
  const bottom = Math.min(before.height, Math.ceil(point.y + halfHeight));
  assert.equal(before.width, after.width);
  assert.equal(before.height, after.height);
  let changed = 0;
  for (let y = top; y < bottom; y++)
    for (let x = left; x < right; x++) {
      const offset = (y * before.width + x) * 4;
      const delta =
        Math.abs(before.data[offset] - after.data[offset]) +
        Math.abs(before.data[offset + 1] - after.data[offset + 1]) +
        Math.abs(before.data[offset + 2] - after.data[offset + 2]);
      if (delta > 12) changed++;
    }
  return changed;
}

async function snapshot(page, id) {
  return page.evaluate((id) => {
    const editor =
      app.workspace.getLeavesOfType("dungeon-native-map")[0].view.editor;
    const object = editor.session.entities.get(id);
    if (object?.kind !== "object") throw new Error("QA-Objekt fehlt: " + id);
    const renderer = editor.renderer;
    const bounds = renderer.canvas.getBoundingClientRect();
    return {
      object: { id, color: object.color, alpha: object.alpha ?? 255 },
      historySize: editor.session.historySize,
      selected: editor.selected,
      screen: {
        x: bounds.x + renderer.camera.x + object.x * renderer.camera.scale,
        y: bounds.y + renderer.camera.y + object.y * renderer.camera.scale,
      },
      canvas: {
        x: renderer.camera.x + object.x * renderer.camera.scale,
        y: renderer.camera.y + object.y * renderer.camera.scale,
        halfWidth: object.width * renderer.camera.scale * 0.3,
        halfHeight: object.height * renderer.camera.scale * 0.3,
      },
    };
  }, id);
}

async function canvasPng(page, file) {
  const bytes = await page.locator(CANVAS).screenshot({ path: file });
  return PNG.sync.read(bytes);
}

async function changedPreview(page, baseline, probe, file) {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    const image = await canvasPng(page, file);
    const changed = pixelDifference(
      baseline,
      image,
      probe.canvas,
      probe.canvas.halfWidth,
      probe.canvas.halfHeight,
    );
    if (changed > 100) return changed;
    await page.waitForTimeout(100);
  }
  throw new Error("Keine sichtbare Objektvorschau vor Picker-Schluss.");
}

async function selectExisting(page, chooseTool, id) {
  await chooseTool("Auswahl");
  const state = await snapshot(page, id);
  await page.mouse.click(state.screen.x, state.screen.y);
  await page.waitForFunction(
    (id) =>
      app.workspace.getLeavesOfType("dungeon-native-map")[0].view.editor
        .selected === id,
    id,
  );
  return snapshot(page, id);
}

async function openPicker(page) {
  await page.getByRole("button", { name: PICKER_BUTTON, exact: true }).click();
  const picker = page.getByRole("dialog", { name: "Objektfarbe RGBA" });
  await picker.waitFor();
  return picker;
}

/**
 * Run after the existing object-alpha host fixture has produced three objects.
 * ids[1] starts at A128; ids[2] starts at A0. The flow edits them through UI.
 * The host runner must preserve the isolated vault until verifyReopen runs.
 */
async function runEdit({
  page,
  chooseTool,
  ids,
  mapPath,
  vault,
  out,
  stateFile,
}) {
  assert.equal(ids.length, 3);
  fs.mkdirSync(out, { recursive: true });
  await page.evaluate(
    async (mapPath) =>
      app.workspace
        .getLeaf(false)
        .openFile(app.vault.getAbstractFileByPath(mapPath)),
    mapPath,
  );
  await page.locator(CANVAS).waitFor();

  // Existing A128 object: live A0 preview, Escape commit, one Undo/Redo.
  const first = await selectExisting(page, chooseTool, ids[1]);
  assert.deepEqual(first.object, { id: ids[1], color: 0x4080c0, alpha: 128 });
  await page.mouse.move(10, 40);
  const before = await canvasPng(page, path.join(out, "01-before-a0.png"));
  let picker = await openPicker(page);
  assert.equal(
    await picker.getByRole("textbox", { name: "Hex ARGB" }).inputValue(),
    "804080c0",
  );
  const alpha = picker.getByRole("spinbutton", { name: "A", exact: true });
  await alpha.fill("0");
  assert.equal(
    await picker.getByRole("textbox", { name: "Hex ARGB" }).inputValue(),
    "004080c0",
  );
  assert.equal((await snapshot(page, ids[1])).object.alpha, 128);
  assert.equal((await snapshot(page, ids[1])).historySize, first.historySize);
  const previewA0 = await changedPreview(
    page,
    before,
    first,
    path.join(out, "02-live-a0.png"),
  );
  await alpha.press("Escape");
  await picker.waitFor({ state: "detached" });
  let after = await snapshot(page, ids[1]);
  assert.equal(after.object.alpha, 0);
  assert.equal(after.historySize, first.historySize + 1);
  await page.getByRole("button", { name: "Rückgängig", exact: true }).click();
  assert.equal((await snapshot(page, ids[1])).object.alpha, 128);
  await page.getByRole("button", { name: "Wiederholen", exact: true }).click();
  assert.equal((await snapshot(page, ids[1])).object.alpha, 0);

  // Existing A0 object: eight-digit ARGB input previews and Accept commits A128.
  const second = await selectExisting(page, chooseTool, ids[2]);
  assert.deepEqual(second.object, { id: ids[2], color: 0x4080c0, alpha: 0 });
  await page.mouse.move(10, 40);
  const beforeA128 = await canvasPng(
    page,
    path.join(out, "03-before-a128.png"),
  );
  picker = await openPicker(page);
  const hex = picker.getByRole("textbox", { name: "Hex ARGB" });
  await hex.fill("804080c0");
  assert.equal(
    await picker
      .getByRole("spinbutton", { name: "A", exact: true })
      .inputValue(),
    "128",
  );
  assert.equal((await snapshot(page, ids[2])).object.alpha, 0);
  assert.equal((await snapshot(page, ids[2])).historySize, second.historySize);
  const previewA128 = await changedPreview(
    page,
    beforeA128,
    second,
    path.join(out, "04-live-a128.png"),
  );
  await picker.getByRole("button", { name: "Accept", exact: true }).click();
  await picker.waitFor({ state: "detached" });
  after = await snapshot(page, ids[2]);
  assert.equal(after.object.alpha, 128);
  assert.equal(after.historySize, second.historySize + 1);
  await page.getByRole("button", { name: "Rückgängig", exact: true }).click();
  assert.equal((await snapshot(page, ids[2])).object.alpha, 0);
  await page.getByRole("button", { name: "Wiederholen", exact: true }).click();
  assert.equal((await snapshot(page, ids[2])).object.alpha, 128);
  await canvasPng(page, path.join(out, "05-after-redo.png"));

  await page.getByRole("button", { name: "Speichern", exact: true }).click();
  await page.waitForFunction(
    () =>
      !app.workspace.getLeavesOfType("dungeon-native-map")[0].view.editor
        .session.dirty,
  );
  const diskPath = path.join(vault, mapPath);
  const disk = JSON.parse(fs.readFileSync(diskPath, "utf8"));
  assert.equal(disk.version, 3);
  assert.deepEqual(
    [ids[1], ids[2]].map(
      (id) => disk.entities.find((entity) => entity.id === id)?.alpha,
    ),
    [0, 128],
  );
  const result = {
    case: "DD-028.06",
    mapPath,
    ids,
    color: 0x4080c0,
    alphaAfter: [0, 128],
    previewChangedPixels: { a0: previewA0, a128: previewA128 },
    savedSha256: crypto
      .createHash("sha256")
      .update(fs.readFileSync(diskPath))
      .digest("hex"),
  };
  fs.writeFileSync(stateFile, JSON.stringify(result, null, 2));
  return result;
}

/** Run in a fresh isolated Obsidian process with the prior vault preserved. */
async function verifyReopen({ page, chooseTool, view, stateFile, vault, out }) {
  const expected = JSON.parse(fs.readFileSync(stateFile, "utf8"));
  const diskPath = path.join(vault, expected.mapPath);
  assert.equal(
    crypto.createHash("sha256").update(fs.readFileSync(diskPath)).digest("hex"),
    expected.savedSha256,
  );
  await page.evaluate(
    async (mapPath) =>
      app.workspace
        .getLeaf(false)
        .openFile(app.vault.getAbstractFileByPath(mapPath)),
    expected.mapPath,
  );
  await page.locator(CANVAS).waitFor();
  await chooseTool("Auswahl");
  await page.evaluate(() => {
    const renderer =
      app.workspace.getLeavesOfType("dungeon-native-map")[0].view.editor
        .renderer;
    renderer.appearance.mapFill = 0x252525;
    renderer.appearance.grid = false;
    renderer.drawGrid();
    renderer.invalidate();
  });
  const document = (await view()).document;
  assert.deepEqual(
    [expected.ids[1], expected.ids[2]].map((id) => {
      const object = document.entities.find((entity) => entity.id === id);
      return [object?.kind, object?.color, object?.alpha];
    }),
    [
      ["object", expected.color, 0],
      ["object", expected.color, 128],
    ],
  );
  await page.waitForFunction(
    (ids) => {
      const renderer =
        app.workspace.getLeavesOfType("dungeon-native-map")[0].view.editor
          .renderer;
      return ids.every((id) =>
        renderer.visuals
          .get(id)
          ?.container.children.some((child) => !!child.texture),
      );
    },
    [expected.ids[1], expected.ids[2]],
  );
  const probes = await Promise.all(
    expected.ids.map((id) => snapshot(page, id)),
  );
  const image = await canvasPng(page, path.join(out, "06-fresh-reopen.png"));
  const samples = probes.map(({ canvas }) => {
    const x = Math.round(canvas.x);
    const y = Math.round(canvas.y + canvas.halfHeight * 0.85);
    assert(x >= 0 && x < image.width && y >= 0 && y < image.height);
    const offset = (y * image.width + x) * 4;
    return [...image.data.subarray(offset, offset + 3)];
  });
  assert.deepEqual(samples[1], [37, 37, 37]);
  for (let channel = 0; channel < 3; channel++) {
    const halfway = 37 + ((samples[0][channel] - 37) * 128) / 255;
    assert(Math.abs(samples[2][channel] - halfway) <= 3);
  }
  fs.writeFileSync(
    path.join(out, "reopen-result.json"),
    JSON.stringify(
      {
        ...expected,
        samples,
      },
      null,
      2,
    ),
  );
  return expected;
}

module.exports = { runEdit, verifyReopen };
