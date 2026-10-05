// DD-028.17 only. Delegate from objekte-03 when DUNGEON_QA_DD02817_ONLY=1.
// The shared runner owns the isolated Obsidian process and graphics slot.
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const mapName = "LightPaletteQA";
const mapPath = `Dungeons/${mapName}/Karte.dungeon`;
const savedName = "dd02817-light-palette-saved.json";
const blue = 0x80beff;
const digest = (value) =>
  crypto.createHash("sha256").update(value).digest("hex");
const writeJson = (file, value) =>
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + "\n");

async function state(page) {
  return page.evaluate(() => {
    const editor =
      app.workspace.getLeavesOfType("dungeon-native-map")[0]?.view?.editor;
    if (!editor) throw new Error("Karteneditor nicht geöffnet");
    return {
      document: editor.session.document(),
      historySize: editor.session.historySize,
      dirty: editor.session.dirty,
      toolColor: editor.settings.light.color,
    };
  });
}

async function chooseLight(page) {
  if (!(await page.locator(".dungeon-native-editor.dn-maximized").count()))
    await page.getByRole("button", { name: "Maximieren", exact: true }).click();
  await page
    .locator(".dn-group-rail")
    .getByRole("button", { name: "Beleuchtung", exact: true })
    .click();
  await page
    .locator(".dn-tool-rail")
    .getByRole("button", { name: "Lichtquelle", exact: true })
    .click();
}

async function savedToolColor(file, expected) {
  const deadline = Date.now() + 10000;
  do {
    if (fs.existsSync(file)) {
      const data = JSON.parse(fs.readFileSync(file, "utf8"));
      if (data.toolDefaults?.light?.color === expected) return data;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  } while (Date.now() < deadline);
  throw new Error("Licht-Werkzeugvorgabe wurde nicht in data.json gespeichert");
}

module.exports = async function lightPalette({
  page, out, qa, vault, restart, group, record,
}) {
  assert.equal(group.id, "objekte-03");
  assert(group.caseIds.includes("DD-028.17"));
  const savedFile = path.join(qa, savedName);
  const mapFile = path.join(vault, mapPath);
  const pluginDataFile = path.join(
    vault, ".obsidian/plugins/dungeon-editor/data.json",
  );
  const field = page.locator('input[aria-label="Lichtfarbe"]');
  const opener = page.getByRole("button", {
    name: "Lichtfarbpalette öffnen", exact: true,
  });
  const swatches = page.locator(".dn-light-color-preset");

  if (!restart) {
    assert(!fs.existsSync(savedFile) && !fs.existsSync(mapFile),
      "DD-028.17 benötigt ein frisches isoliertes QA-Verzeichnis");
    await page.evaluate(
      (name) => app.plugins.getPlugin("dungeon-editor").create(name, 8, 8),
      mapName,
    );
    await page.locator(".dn-canvas canvas").waitFor({ timeout: 30000 });
    await chooseLight(page);
    await page.getByRole("button", { name: "Speichern", exact: true }).click();
    await page.waitForFunction(
      (target) => {
        const editor = app.workspace.getLeavesOfType("dungeon-native-map")
          .find((leaf) => leaf.view.file?.path === target)?.view.editor;
        return !!app.vault.getAbstractFileByPath(target) &&
          !!editor && !editor.session.dirty;
      },
      mapPath,
    );
    assert(fs.existsSync(mapFile), "QA-Karte wurde nicht gespeichert");
    await chooseLight(page);
    const diskSha256 = digest(fs.readFileSync(mapFile));
    const before = await state(page);
    assert.equal(before.dirty, false, "QA-Karte vor der Palettenwahl noch geändert");
    assert.notEqual(before.toolColor, blue,
      "QA-Profil hat bereits Blau als Lichtvorgabe; frisches Profil verwenden");
    assert.equal(await field.inputValue(),
      "#" + before.toolColor.toString(16).padStart(6, "0"));
    assert.equal(await opener.count(), 1, "Lichtpalette fehlt");
    assert.equal(await opener.getAttribute("aria-expanded"), "false");
    await opener.click();
    assert.equal(await opener.getAttribute("aria-expanded"), "true");
    assert.equal(await swatches.count(), 5, "Fünf Farbvorgaben erwartet");
    for (let index = 0; index < 5; index++)
      assert.equal(await swatches.nth(index).isVisible(), true);
    const openImage = path.join(out, "dd02817-palette-open.png");
    await page.screenshot({ path: openImage });
    const measured = [
      ["Warm", 0xeccd8b],
      ["Blass", 0xeaefca],
      ["Orange", 0xffad58],
      ["Grün", 0x4dd569],
    ];
    for (const [label, color] of measured) {
      await page.getByRole("button", {
        name: `Lichtfarbe ${label}`, exact: true,
      }).click();
      assert.equal(await opener.getAttribute("aria-expanded"), "false");
      assert.equal(await field.inputValue(),
        "#" + color.toString(16).padStart(6, "0"));
      assert.equal((await state(page)).toolColor, color);
      await opener.click();
      assert.equal(await opener.getAttribute("aria-expanded"), "true");
    }
    const blueSwatch = page.getByRole("button", {
      name: "Lichtfarbe Blau", exact: true,
    });
    assert.equal(await blueSwatch.evaluate((button) =>
      button.style.backgroundColor), "rgb(128, 190, 255)");
    await blueSwatch.click();
    assert.equal(await opener.getAttribute("aria-expanded"), "false");
    assert.equal(await swatches.first().isVisible(), false);
    assert.equal(await field.inputValue(), "#80beff");
    const after = await state(page);
    assert.equal(after.toolColor, blue);
    assert.deepEqual(after.document, before.document,
      "Werkzeugvorgabe änderte das Kartendokument");
    assert.equal(after.historySize, before.historySize,
      "Werkzeugvorgabe erzeugte einen History-Schritt");
    assert.equal(after.dirty, before.dirty,
      "Werkzeugvorgabe markierte die Karte als geändert");
    const persisted = await savedToolColor(pluginDataFile, blue);
    assert.equal(digest(fs.readFileSync(mapFile)), diskSha256,
      "Werkzeugvorgabe änderte die gespeicherte Karte");
    const selectedImage = path.join(out, "dd02817-blue-selected.png");
    await page.screenshot({ path: selectedImage });
    const saved = {
      mapPath, diskSha256, before, after,
      measuredPresets: [...measured, ["Blau", blue]],
      pluginLightColor: persisted.toolDefaults.light.color,
    };
    writeJson(savedFile, saved);
    const resultFile = path.join(out, "dd02817-light-palette-edit.json");
    writeJson(resultFile, saved);
    record.add("DD-028.17", "pass",
      "Light Tool: fünf sichtbare Palettenfelder; alle fünf Original-RGB-Werte schließen die Palette und setzen nur die Werkzeugvorgabe. Blau RGB 128/190/255 bleibt gespeichert, ohne Karten- oder Historyänderung.",
      [resultFile, savedFile, openImage, selectedImage]);
    return;
  }

  const saved = JSON.parse(fs.readFileSync(savedFile, "utf8"));
  assert.equal(saved.mapPath, mapPath);
  assert.equal(digest(fs.readFileSync(mapFile)), saved.diskSha256,
    "QA-Karte zwischen Edit und Frischstart geändert");
  const persisted = await savedToolColor(pluginDataFile, blue);
  await page.evaluate(async (target) => {
    const file = app.vault.getAbstractFileByPath(target);
    if (!file) throw new Error(`QA-Karte fehlt: ${target}`);
    await app.workspace.getLeaf(false).openFile(file);
  }, mapPath);
  await page.locator(".dn-canvas canvas").waitFor({ timeout: 30000 });
  await chooseLight(page);
  assert.equal(await opener.count(), 1);
  assert.equal(await field.inputValue(), "#80beff");
  const reopened = await state(page);
  assert.equal(reopened.toolColor, blue);
  assert.deepEqual(reopened.document, saved.after.document);
  assert.equal(reopened.dirty, false);
  assert.equal(reopened.historySize, 0,
    "Frischer Prozess sollte keine alte Werkzeugaktion in die History laden");
  assert.equal(digest(fs.readFileSync(mapFile)), saved.diskSha256);
  await opener.click();
  assert.equal(await swatches.count(), 5);
  assert.equal(await opener.getAttribute("aria-expanded"), "true");
  for (let index = 0; index < 5; index++)
    assert.equal(await swatches.nth(index).isVisible(), true);
  const reopenImage = path.join(out, "dd02817-palette-reopened.png");
  await page.screenshot({ path: reopenImage });
  const resultFile = path.join(out, "dd02817-light-palette-reopen.json");
  writeJson(resultFile, {
    ...saved, reopened,
    pluginLightColor: persisted.toolDefaults.light.color,
  });
  record.add("DD-028.17", "pass",
    "Frischer Obsidian-Prozess: Lichtfarbe #80beff und fünfteilige Palette wieder verfügbar; gespeicherte Karte und Dokument unverändert.",
    [resultFile, savedFile, reopenImage]);
};
