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
    };
    function assertEditor(value) {
      if (!value) throw new Error("Karteneditor nicht geöffnet");
    }
  });
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
    const diskBefore = digest(fs.readFileSync(mapFile));
    const result = await gesture(page, out, "edit");
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
    };
    saveJson(savedFile, details);
    const resultFile = path.join(out, "dd02816-scatter-edit.json");
    saveJson(resultFile, {
      ...details,
      ...result,
      diskAfterSha256: diskBefore,
    });
    record.add(
      "DD-028.16",
      "pass",
      "Scatter-RGBA-Picker öffnet; Innenklick erhält ihn, Außenklick ohne Farbänderung schließt; erneutes Öffnen und Escape ändern weder Karte noch History.",
      [resultFile, savedFile, ...result.images],
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
  assert.equal(
    digest(JSON.stringify(result.before.document)),
    saved.documentSha256,
  );
  assert.equal(digest(fs.readFileSync(mapFile)), saved.diskSha256);
  const resultFile = path.join(out, "dd02816-scatter-reopen.json");
  saveJson(resultFile, { ...saved, ...result });
  record.add(
    "DD-028.16",
    "pass",
    "Frischer Obsidian-Prozess: unveränderte QA-Karte; Scatter-Picker öffnet, Außenklick ohne Farbänderung schließt und erneutes Öffnen funktioniert ohne Dokument- oder Historyänderung.",
    [resultFile, savedFile, ...result.images],
  );
};
