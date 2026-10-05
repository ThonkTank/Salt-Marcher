// Focused host regression for a selected Colorable object's RGBA picker.
// The group runner owns the isolated Obsidian process and records other cases open.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const pickerName = "Objektfarbe RGBA";
const openerName = "Objektfarbe RGBA öffnen";
const near = (actual, expected) => actual.every((value, index) =>
  Math.abs(value - expected[index]) <= 2);

async function state(page, id) {
  return page.evaluate((id) => {
    const editor = app.workspace.getLeavesOfType("dungeon-native-map")[0].view.editor;
    const renderer = editor.renderer;
    const object = editor.session.entities.get(id);
    assertObject(object);
    return {
      alpha: object.alpha ?? 255,
      color: object.color,
      historySize: editor.session.historySize,
      dirty: editor.session.dirty,
      selected: editor.selected,
      preview: renderer.objectColorPreview ?? null,
      visualAlpha: renderer.visuals.get(id)?.entity.alpha ?? null,
    };
    function assertObject(value) {
      if (value?.kind !== "object") throw new Error("Colorable-QA-Objekt fehlt: " + id);
    }
  }, id);
}

async function clickObject(page, id) {
  const point = await page.evaluate((id) => {
    const editor = app.workspace.getLeavesOfType("dungeon-native-map")[0].view.editor;
    const object = editor.session.entities.get(id);
    if (object?.kind !== "object") throw new Error("QA-Auswahl fehlt: " + id);
    const renderer = editor.renderer;
    const box = renderer.canvas.getBoundingClientRect();
    return { x: box.x + renderer.camera.x + object.x * renderer.camera.scale,
      y: box.y + renderer.camera.y + object.y * renderer.camera.scale };
  }, id);
  await page.mouse.click(point.x, point.y);
  await page.waitForFunction((id) => app.workspace.getLeavesOfType("dungeon-native-map")[0]
    .view.editor.selected === id, id);
}

async function openPicker(page) {
  await page.getByRole("button", { name: openerName, exact: true }).click();
  const dialog = page.getByRole("dialog", { name: pickerName });
  await dialog.waitFor();
  return dialog;
}

async function waitForPixels(page, screenshotSamples, file, index, expected) {
  const deadline = Date.now() + 5000;
  let samples;
  do {
    samples = await screenshotSamples(page, file);
    if (near(samples.colorable[index], expected)) return samples;
    await page.waitForTimeout(100);
  } while (Date.now() < deadline);
  throw new Error("Live-Farbpixel fehlt: " + JSON.stringify({ index, expected, samples }));
}

async function waitForDraftGone(file) {
  const deadline = Date.now() + 12000;
  while (fs.existsSync(file)) {
    if (Date.now() >= deadline) throw new Error("Entwurf nach Save nicht entfernt: " + file);
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}

module.exports = async function pickerLifecycle({
  page, out, qa, vault, restart, group, record, helpers,
}) {
  assert.equal(group.id, "objekte-03");
  assert(group.caseIds.includes("DD-028.06"));
  const { createFixture, chooseTool, editorState, screenshotSamples,
    setPlainBackground, writeJson, digest, mapPath } = helpers;
  const stateFile = path.join(qa, "objekte-03-picker-lifecycle.json");
  const mapFile = path.join(vault, mapPath);

  if (restart) {
    const saved = JSON.parse(fs.readFileSync(stateFile, "utf8"));
    assert.equal(digest(fs.readFileSync(mapFile)), saved.mapSha256,
      "Karte zwischen Edit und Frischstart verändert");
    await page.evaluate(async (file) => app.workspace.getLeaf(false)
      .openFile(app.vault.getAbstractFileByPath(file)), mapPath);
    await page.locator(".dn-canvas canvas").waitFor({ timeout: 30000 });
    await chooseTool(page, "Auswahl", "Auswahl");
    await setPlainBackground(page);
    await page.waitForFunction((ids) => {
      const renderer = app.workspace.getLeavesOfType("dungeon-native-map")[0]
        .view.editor.renderer;
      return ids.every((id) => renderer.visuals.get(id)?.container.children
        .some((child) => !!child.texture));
    }, saved.ids);
    const document = await editorState(page);
    const alpha = saved.ids.map((id) => document.document.entities
      .find((entity) => entity.id === id)?.alpha ?? 255);
    assert.deepEqual(alpha, [255, 0, 128]);
    assert.equal(document.dirty, false);
    const first = await state(page, saved.ids[1]);
    const second = await state(page, saved.ids[2]);
    assert.equal(first.preview, null);
    assert.equal(second.preview, null);
    const samples = await screenshotSamples(page,
      path.join(out, "picker-lifecycle-reopened.png"));
    assert(near(samples.colorable[1], [37, 37, 37]));
    assert(near(samples.colorable[2], saved.a128Pixel));
    const evidence = path.join(out, "picker-lifecycle-reopen.json");
    writeJson(evidence, { alpha, dirty: document.dirty, first, second,
      samples, mapSha256: saved.mapSha256 });
    record.add("DD-028.06", "open",
      "Frisch geöffnet: beide Wechsel-Commits, A0/A128-Pixel und keine Renderer-Vorschau erhalten.",
      [evidence, path.join(out, "picker-lifecycle-reopened.png")],
      "Originalwirkung von Werkzeug-/Auswahlwechsel bei offenem Picker nicht direkt gemessen.");
    return;
  }

  const baseline = await createFixture(page, vault, out);
  await chooseTool(page, "Auswahl", "Auswahl");
  await clickObject(page, baseline.ids[1]);
  const beforeTool = await state(page, baseline.ids[1]);
  assert.equal(beforeTool.alpha, 128);
  let dialog = await openPicker(page);
  await dialog.getByRole("spinbutton", { name: "A", exact: true }).fill("0");
  assert.equal(await dialog.getByRole("textbox", { name: "Hex ARGB" }).inputValue(),
    "004080c0");
  await page.waitForFunction((id) => {
    const renderer = app.workspace.getLeavesOfType("dungeon-native-map")[0]
      .view.editor.renderer;
    return renderer.objectColorPreview?.id === id &&
      renderer.objectColorPreview.alpha === 0 &&
      renderer.visuals.get(id)?.entity.alpha === 0;
  }, baseline.ids[1]);
  assert.equal((await state(page, baseline.ids[1])).alpha, 128);
  assert.equal((await state(page, baseline.ids[1])).historySize,
    beforeTool.historySize);
  const toolLive = await waitForPixels(page, screenshotSamples,
    path.join(out, "picker-tool-switch-live.png"), 1, [37, 37, 37]);
  await chooseTool(page, "Auswahl", "Hand");
  await dialog.waitFor({ state: "detached" });
  const afterTool = await state(page, baseline.ids[1]);
  assert.equal(afterTool.alpha, 0);
  assert.equal(afterTool.historySize, beforeTool.historySize + 1);
  assert.equal(afterTool.preview, null);
  assert.equal(afterTool.visualAlpha, 0);
  const toolCommitted = await waitForPixels(page, screenshotSamples,
    path.join(out, "picker-tool-switch-committed.png"), 1, [37, 37, 37]);
  assert(near(toolCommitted.fixed[1], baseline.samples.fixed[1]));
  await page.getByRole("button", { name: "Rückgängig", exact: true }).click();
  assert.equal((await state(page, baseline.ids[1])).alpha, 128);
  await page.getByRole("button", { name: "Wiederholen", exact: true }).click();
  assert.equal((await state(page, baseline.ids[1])).alpha, 0);

  await chooseTool(page, "Auswahl", "Auswahl");
  await clickObject(page, baseline.ids[2]);
  const beforeSelection = await state(page, baseline.ids[2]);
  assert.equal(beforeSelection.alpha, 0);
  dialog = await openPicker(page);
  await dialog.getByRole("spinbutton", { name: "A", exact: true }).fill("128");
  assert.equal(await dialog.getByRole("textbox", { name: "Hex ARGB" }).inputValue(),
    "804080c0");
  await page.waitForFunction((id) => {
    const renderer = app.workspace.getLeavesOfType("dungeon-native-map")[0]
      .view.editor.renderer;
    return renderer.objectColorPreview?.id === id &&
      renderer.objectColorPreview.alpha === 128 &&
      renderer.visuals.get(id)?.entity.alpha === 128;
  }, baseline.ids[2]);
  assert.equal((await state(page, baseline.ids[2])).alpha, 0);
  assert.equal((await state(page, baseline.ids[2])).historySize,
    beforeSelection.historySize);
  const selectionLive = await waitForPixels(page, screenshotSamples,
    path.join(out, "picker-selection-switch-live.png"), 2,
    baseline.samples.colorable[1]);
  await clickObject(page, baseline.ids[0]);
  await dialog.waitFor({ state: "detached" });
  const afterSelection = await state(page, baseline.ids[2]);
  assert.equal(afterSelection.alpha, 128);
  assert.equal(afterSelection.historySize, beforeSelection.historySize + 1);
  assert.equal(afterSelection.preview, null);
  assert.equal(afterSelection.visualAlpha, 128);
  const selectionCommitted = await waitForPixels(page, screenshotSamples,
    path.join(out, "picker-selection-switch-committed.png"), 2,
    baseline.samples.colorable[1]);
  assert(near(selectionCommitted.fixed[2], baseline.samples.fixed[2]));
  await page.getByRole("button", { name: "Rückgängig", exact: true }).click();
  assert.equal((await state(page, baseline.ids[2])).alpha, 0);
  await page.getByRole("button", { name: "Wiederholen", exact: true }).click();
  assert.equal((await state(page, baseline.ids[2])).alpha, 128);

  await page.getByRole("button", { name: "Speichern", exact: true }).click();
  await page.waitForFunction(() => !app.workspace.getLeavesOfType("dungeon-native-map")[0]
    .view.editor.session.dirty);
  await waitForDraftGone(mapFile + ".draft");
  const disk = fs.readFileSync(mapFile);
  const savedDocument = JSON.parse(disk);
  assert.equal(savedDocument.entities.find((entity) => entity.id === baseline.ids[1])?.alpha, 0);
  assert.equal(savedDocument.entities.find((entity) => entity.id === baseline.ids[2])?.alpha, 128);
  const saved = { ids: baseline.ids, mapSha256: digest(disk),
    a128Pixel: baseline.samples.colorable[1] };
  writeJson(stateFile, saved);
  const evidence = path.join(out, "picker-lifecycle-edit.json");
  writeJson(evidence, { beforeTool, toolLive, afterTool, toolCommitted,
    beforeSelection, selectionLive, afterSelection, selectionCommitted, saved });
  record.add("DD-028.06", "open",
    "Host: Werkzeug- und Auswahlwechsel schließen Livepicker mit je einem Undo-Schritt; Vorschau entfernt, A0/A128 gespeichert.",
    [evidence, stateFile, path.join(out, "picker-tool-switch-live.png"),
      path.join(out, "picker-tool-switch-committed.png"),
      path.join(out, "picker-selection-switch-live.png"),
      path.join(out, "picker-selection-switch-committed.png")],
    "Originalwirkung von Werkzeug-/Auswahlwechsel bei offenem Picker nicht direkt gemessen.");
};
