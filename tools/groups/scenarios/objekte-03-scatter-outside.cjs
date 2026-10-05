// DD-028.16 only. Import through objekte-03 when DUNGEON_QA_DD02816_ONLY=1;
// the shared runner owns the isolated Obsidian process and graphics slot.
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const mapName = "ScatterPickerOutsideQA";
const mapPath = `Dungeons/${mapName}/Karte.dungeon`;
const stateName = "dd02816-scatter-outside-saved.json";
const digest = (value) =>
  crypto.createHash("sha256").update(value).digest("hex");
const saveJson = (file, value) =>
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + "\n");

async function state(page) {
  return page.evaluate(() => {
    const editor =
      app.workspace.getLeavesOfType("dungeon-native-map")[0]?.view?.editor;
    assertEditor(editor);
    return {
      document: editor.session.document(),
      historySize: editor.session.historySize,
      dirty: editor.session.dirty,
      toolColor: editor.settings.object.color,
      toolAlpha: editor.settings.object.alpha ?? 255,
    };
    function assertEditor(value) {
      if (!value) throw new Error("Karteneditor nicht geöffnet");
    }
  });
}

async function persistedColor(vault, expectedColor) {
  const file = path.join(vault, ".obsidian/plugins/dungeon-editor/data.json");
  const deadline = Date.now() + 10000;
  do {
    if (fs.existsSync(file)) {
      const data = JSON.parse(fs.readFileSync(file, "utf8"));
      if (data.toolDefaults?.object?.color === expectedColor)
        return data.toolDefaults.object;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  } while (Date.now() < deadline);
  throw new Error("Geänderte Scatter-Farbe wurde nicht als Werkzeugvorgabe gespeichert");
}

async function chooseScatter(page) {
  if (!(await page.locator(".dungeon-native-editor.dn-maximized").count()))
    await page.getByRole("button", { name: "Maximieren", exact: true }).click();
  await page
    .locator(".dn-group-rail")
    .getByRole("button", { name: "Objekte", exact: true })
    .click();
  await page
    .locator(".dn-tool-rail")
    .getByRole("button", { name: "Streuen", exact: true })
    .click();
}

async function gesture(page, out, label) {
  const before = await state(page);
  const opener = page.getByRole("button", {
    name: "Objektfarbe RGBA öffnen",
    exact: true,
  });
  assert.equal(await opener.count(), 1, "Scatter-Farböffner fehlt");
  await opener.click();
  const dialog = page.getByRole("dialog", { name: "Objektfarbe RGBA" });
  await dialog.waitFor();
  const startHex = await dialog
    .getByRole("textbox", { name: "Hex ARGB" })
    .inputValue();
  const firstImage = path.join(out, `${label}-picker-open.png`);
  await page.screenshot({ path: firstImage });

  // A click inside must leave the picker open, without editing any field.
  await dialog.getByRole("textbox", { name: "Hex ARGB" }).click();
  assert.equal(await dialog.isVisible(), true);
  assert.equal(
    await dialog.getByRole("textbox", { name: "Hex ARGB" }).inputValue(),
    startHex,
  );

  // The inspector heading is outside the picker and has no map action.
  await page
    .locator(".dungeon-native-editor.dn-maximized .dn-inspector > h2")
    .click();
  await dialog.waitFor({ state: "detached" });
  assert.equal(await opener.isEnabled(), true);
  const outsideImage = path.join(out, `${label}-picker-outside-closed.png`);
  await page.screenshot({ path: outsideImage });
  const afterOutside = await state(page);
  assert.deepEqual(
    afterOutside,
    before,
    "Außenklick änderte Karte oder History",
  );

  await opener.click();
  await dialog.waitFor();
  const reopenedHex = await dialog
    .getByRole("textbox", { name: "Hex ARGB" })
    .inputValue();
  assert.equal(
    reopenedHex,
    startHex,
    "Unveränderter Picker verlor seinen Startwert",
  );
  const reopenedImage = path.join(out, `${label}-picker-reopened.png`);
  await page.screenshot({ path: reopenedImage });
  await dialog.press("Escape");
  await dialog.waitFor({ state: "detached" });
  const afterEscape = await state(page);
  assert.deepEqual(
    afterEscape,
    before,
    "Erneutes Öffnen und Escape änderten Karte oder History",
  );
  return {
    before,
    afterOutside,
    afterEscape,
    startHex,
    images: [firstImage, outsideImage, reopenedImage],
  };
}

async function changedGesture(page, out, label, targetHex) {
  const before = await state(page);
  const targetColor = Number.parseInt(targetHex, 16);
  assert.notEqual(before.toolColor, targetColor,
    "Zielwert muss von der aktuellen Werkzeugfarbe abweichen");
  const opener = page.getByRole("button", {
    name: "Objektfarbe RGBA öffnen", exact: true,
  });
  await opener.click();
  const dialog = page.getByRole("dialog", { name: "Objektfarbe RGBA" });
  await dialog.waitFor();
  const hex = dialog.getByRole("textbox", { name: "Hex ARGB" });
  const startHex = await hex.inputValue();
  await hex.fill(targetHex);
  assert.equal(await hex.inputValue(), targetHex);
  const liveImage = path.join(out, `${label}-changed-live.png`);
  await page.screenshot({ path: liveImage });
  const during = await state(page);
  assert.deepEqual(during, before,
    "Farbvorschau erzeugte vor dem Außenklick eine Dokument- oder Werkzeugmutation");

  // Heading is outside the picker and does not paint the map.
  await page
    .locator(".dungeon-native-editor.dn-maximized .dn-inspector > h2")
    .click();
  await dialog.waitFor({ state: "detached" });
  const afterOutside = await state(page);
  assert.equal(afterOutside.toolColor, targetColor);
  assert.equal(afterOutside.toolAlpha, 255);
  assert.deepEqual(afterOutside.document, before.document);
  assert.equal(afterOutside.historySize, before.historySize);
  assert.equal(afterOutside.dirty, before.dirty);
  const outsideImage = path.join(out, `${label}-changed-outside.png`);
  await page.screenshot({ path: outsideImage });

  await opener.click();
  await dialog.waitFor();
  const reopenedHex = await hex.inputValue();
  assert.equal(reopenedHex, targetHex,
    "Außenklick verwarf den geänderten Scatter-Wert");
  const reopenedImage = path.join(out, `${label}-changed-reopened.png`);
  await page.screenshot({ path: reopenedImage });
  await dialog.press("Escape");
  await dialog.waitFor({ state: "detached" });
  assert.deepEqual(await state(page), afterOutside);
  return {
    startHex, targetHex, before, during, afterOutside, reopenedHex,
    images: [liveImage, outsideImage, reopenedImage],
  };
}

module.exports = async function scatterOutside({
  page,
  out,
  qa,
  vault,
  restart,
  group,
  record,
}) {
  assert.equal(group.id, "objekte-03");
  assert(group.caseIds.includes("DD-028.16"));
  const savedFile = path.join(qa, stateName);
  const mapFile = path.join(vault, mapPath);
  if (!restart) {
    assert(
      !fs.existsSync(mapFile),
      "QA-Karte existiert bereits; frisches QA-Verzeichnis verwenden",
    );
    await page.evaluate(
      (name) => app.plugins.getPlugin("dungeon-editor").create(name, 8, 8),
      mapName,
    );
    await page.locator(".dn-canvas canvas").waitFor({ timeout: 30000 });
    await chooseScatter(page);
    await page.getByRole("button", { name: "Speichern", exact: true }).click();
    await page.waitForFunction(
      (file) => !!app.vault.getAbstractFileByPath(file),
      mapPath,
    );
    assert(fs.existsSync(mapFile), "QA-Karte wurde nicht gespeichert");
    await chooseScatter(page);
    const diskBefore = digest(fs.readFileSync(mapFile));
    const result = await gesture(page, out, "edit");
    const changed = await changedGesture(page, out, "edit", "4080c0");
    const persisted = await persistedColor(vault, 0x4080c0);
    assert.equal(
      digest(fs.readFileSync(mapFile)),
      diskBefore,
      "Außenklick änderte die gespeicherte Karte",
    );
    assert.equal(result.before.dirty, false);
    const details = {
      mapPath,
      diskSha256: diskBefore,
      documentSha256: digest(JSON.stringify(result.before.document)),
      historySize: result.before.historySize,
      startHex: result.startHex,
      changedHex: changed.targetHex,
      toolColor: persisted.color,
    };
    saveJson(savedFile, details);
    const resultFile = path.join(out, "dd02816-scatter-edit.json");
    saveJson(resultFile, {
      ...details,
      ...result,
      changed,
      diskAfterSha256: diskBefore,
    });
    record.add(
      "DD-028.16",
      "pass",
      "Scatter-RGBA-Picker öffnet; Außenklick schließt ihn unverändert und nach RGB-Änderung auf 4080c0. Der neue Wert bleibt beim Wiederöffnen und in den Werkzeugvorgaben; Karte und History bleiben gleich.",
      [resultFile, savedFile, ...result.images, ...changed.images],
    );
    return;
  }

  const saved = JSON.parse(fs.readFileSync(savedFile, "utf8"));
  assert.equal(saved.mapPath, mapPath);
  assert.equal(
    digest(fs.readFileSync(mapFile)),
    saved.diskSha256,
    "QA-Karte zwischen Edit und Frischstart geändert",
  );
  await page.evaluate(
    async (file) =>
      app.workspace
        .getLeaf(false)
        .openFile(app.vault.getAbstractFileByPath(file)),
    mapPath,
  );
  await page.locator(".dn-canvas canvas").waitFor({ timeout: 30000 });
  await chooseScatter(page);
  const result = await gesture(page, out, "reopen");
  assert.equal(result.before.dirty, false);
  assert.equal(result.before.toolColor, saved.toolColor,
    "Scatter-Werkzeugfarbe nach Frischstart verloren");
  const changed = await changedGesture(page, out, "reopen", "7292b2");
  const persisted = await persistedColor(vault, 0x7292b2);
  assert.equal(
    digest(JSON.stringify(result.before.document)),
    saved.documentSha256,
  );
  assert.equal(digest(fs.readFileSync(mapFile)), saved.diskSha256);
  const resultFile = path.join(out, "dd02816-scatter-reopen.json");
  saveJson(resultFile, { ...saved, ...result, changed,
    finalToolColor: persisted.color });
  record.add(
    "DD-028.16",
    "pass",
    "Frischer Obsidian-Prozess lädt RGB 4080c0; Außenklick nach Änderung auf 7292b2 schließt den Picker und behält den neuen Wert. Karte und History bleiben unverändert.",
    [resultFile, savedFile, ...result.images, ...changed.images],
  );
};
