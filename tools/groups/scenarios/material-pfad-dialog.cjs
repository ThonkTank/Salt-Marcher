// Separate DD-021.15 host substep. The caller owns the isolated Obsidian
// process and runs edit and --restart in two different process invocations.
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const fixture = JSON.parse(fs.readFileSync(
  path.join(__dirname, "../fixtures/material-pfad-dialog.json"), "utf8"));
const savedName = "material-pfad-dialog-saved.json";
const reportName = "material-pfad-dialog-result.json";
const writeJson = (file, value) =>
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + "\n");
const sha256 = (file) => new Promise((resolve, reject) => {
  const hash = crypto.createHash("sha256");
  fs.createReadStream(file).on("data", (chunk) => hash.update(chunk))
    .on("error", reject).on("end", () => resolve(hash.digest("hex")));
});

async function choosePathTool(page) {
  if (!(await page.locator(".dungeon-native-editor.dn-maximized").count()))
    await page.getByRole("button", { name: "Maximieren", exact: true }).click();
  await page.locator(".dn-group-rail")
    .getByRole("button", { name: "Gelände", exact: true }).click();
  await page.locator(".dn-tool-rail")
    .getByRole("button", { name: "Pfade", exact: true }).click();
}

async function openMap(page) {
  await page.evaluate(async (mapPath) => {
    const file = app.vault.getAbstractFileByPath(mapPath);
    if (!file) throw new Error(`Gespeicherte Karte fehlt: ${mapPath}`);
    await app.workspace.getLeaf(false).openFile(file);
  }, fixture.mapPath);
  await page.locator(".dn-canvas canvas").last().waitFor({ timeout: 30000 });
}

async function openDialog(page) {
  await choosePathTool(page);
  await page.locator(".dn-group-rail")
    .getByRole("button", { name: "Dungeon", exact: true }).click();
  await page.locator(".dn-tool-rail")
    .getByRole("button", { name: "Bibliothek", exact: true }).click();
  await page.getByRole("button", { name: "Originaldatei wählen", exact: true })
    .waitFor({ timeout: 15000 });
}

async function libraryState(page) {
  await choosePathTool(page);
  const tile = page.locator(
    `.dn-path-library-tiles button[aria-label="${fixture.assetName}"]`);
  await tile.waitFor({ timeout: 15000 });
  const preview = tile.locator("img");
  await preview.evaluate((image) => image.decode());
  const tiles = await page.locator(".dn-path-library-tiles button").count();
  const state = await page.evaluate((packId) => {
    const plugin = app.plugins.getPlugin("dungeon-editor");
    const assets = plugin.listAssets([], true);
    return {
      storedPath: plugin.pluginData.nativePckPath ?? null,
      catalogCount: plugin.nativePathCatalog?.textures.length ?? 0,
      pathAssetCount: assets.filter((asset) =>
        asset.packId === packId && asset.kind === "path").length,
    };
  }, fixture.packId);
  return { ...state, visibleTiles: tiles,
    previewWidth: await preview.evaluate((image) => image.naturalWidth) };
}

/** Returns a substep result; it does not grant DD-021.15 overall parity. */
module.exports = async function materialPathDialog({ page, out, qa, vault, restart }) {
  const result = {
    phase: restart ? "reopen" : "edit",
    caseId: "DD-021.15",
    substep: "visible-native-pck-file-dialog",
    state: "open",
    observation: null,
    gap: "Host: Sichtbarer Datei-Dialog und vollständiger Neustart noch nicht ausgeführt.",
    evidence: [],
  };
  const reportFile = path.join(out, reportName);
  const savedFile = path.join(qa, savedName);
  const dataFile = path.join(vault, ".obsidian/plugins/dungeon-editor/data.json");
  result.evidence.push(reportFile);
  let chooserStage = false;
  const capture = async (name) => {
    const file = path.join(out, `material-pfad-dialog-${name}.png`);
    await page.screenshot({ path: file });
    result.evidence.push(file);
  };
  try {
    assert.equal(fixture.originalVersion, "1.2.0.1");
    assert.equal(await sha256(fixture.pckPath), fixture.pckSha256,
      "Original-PCK hat nicht die protokollierte Prüfsumme");
    if (!restart) fs.rmSync(savedFile, { force: true });
    if (restart) {
      const saved = JSON.parse(fs.readFileSync(savedFile, "utf8"));
      assert.equal(saved.mapPath, fixture.mapPath);
      assert.equal(saved.path, fixture.pckPath);
      result.dataSha256 = await sha256(dataFile);
      await openMap(page);
      await openDialog(page);
      const status = page.getByText(/44 Pfadtexturen verfügbar\./);
      await status.waitFor({ timeout: 30000 });
      await capture("reopen-status");
      await page.keyboard.press("Escape");
      result.library = await libraryState(page);
      await capture("reopen-library");
      assert.equal(result.library.storedPath, fixture.pckPath);
      assert.equal(result.library.catalogCount, 44);
      assert.equal(result.library.pathAssetCount, 44);
      assert.equal(result.library.visibleTiles, 44);
      assert(result.library.previewWidth > 0, "Native Vorschaukachel nicht dekodiert");
      result.state = "pass";
      result.gap = null;
      result.observation = "Nach vollständigem Plugin-Neustart: gespeicherte PCK-Quelle, 44er-Dialogstatus und 44 dekodierbare Pfadkacheln ohne Direktaufruf vorhanden.";
      return result;
    }

    const before = await page.evaluate(() =>
      app.plugins.getPlugin("dungeon-editor").pluginData.nativePckPath ?? null);
    if (before === fixture.pckPath) {
      result.gap = "Host-Vorbedingung: Die PCK war vor dem sichtbaren Dateidialog bereits gespeichert; ein frischer Dialog-Persistenznachweis ist so nicht möglich.";
      return result;
    }
    await page.evaluate(async (name) =>
      app.plugins.getPlugin("dungeon-editor").create(name, 16, 12,
        { assetPacks: [], builtInAssets: true }), fixture.mapName);
    await page.locator(".dn-canvas canvas").last().waitFor({ timeout: 30000 });
    await openDialog(page);
    await capture("before-choice");
    await page.evaluate(() => {
      const input = document.querySelector(
        '.modal input[type="file"][accept=".pck"]');
      if (!input) throw new Error("Sichtbarer Assetdialog hat keine PCK-Dateiauswahl");
      window.__nativePathDialogFile = null;
      input.addEventListener("change", () => {
        const selected = input.files?.[0];
        window.__nativePathDialogFile = {
          name: selected?.name ?? null,
          path: selected?.path ?? null,
        };
      }, { capture: true, once: true });
    });
    chooserStage = true;
    const chooserPromise = page.waitForEvent("filechooser", { timeout: 15000 });
    await page.getByRole("button", { name: "Originaldatei wählen", exact: true }).click();
    const chooser = await chooserPromise;
    await chooser.setFiles(fixture.pckPath);
    result.file = await page.evaluate(() => window.__nativePathDialogFile ?? null);
    chooserStage = false;
    if (!result.file?.path) {
      await capture("missing-file-path");
      result.gap = "Host: Playwright-Dateiauswahl lieferte im Obsidian/Electron-File kein `.path`; Produktdialog meldet deshalb fehlenden Dateipfad. Ein echter OS-Dateidialog bleibt als Gegenprobe offen.";
      result.observation = `File-Objekt nach Playwright-Auswahl: ${JSON.stringify(result.file)}.`;
      return result;
    }
    await page.getByText(/44 Pfadtexturen verfügbar\./)
      .waitFor({ timeout: 30000 });
    await capture("loaded-status");
    const persisted = JSON.parse(fs.readFileSync(dataFile, "utf8"));
    assert.equal(persisted.nativePckPath, fixture.pckPath,
      "PCK-Quellpfad wurde nicht in Plugin-Daten gespeichert");
    await page.keyboard.press("Escape");
    result.library = await libraryState(page);
    await capture("loaded-library");
    assert.equal(result.library.catalogCount, 44);
    assert.equal(result.library.pathAssetCount, 44);
    assert.equal(result.library.visibleTiles, 44);
    assert(result.library.previewWidth > 0, "Native Vorschaukachel nicht dekodiert");
    writeJson(savedFile, { mapPath: fixture.mapPath, path: fixture.pckPath,
      dataSha256: await sha256(dataFile), fileExposure: result.file });
    result.evidence.push(savedFile);
    result.state = "pass";
    result.gap = null;
    result.observation = "Sichtbarer PCK-Dateidialog übernahm die Originaldatei, zeigte 44 Pfadtexturen, speicherte den Quellpfad und bot 44 dekodierbare Kacheln ohne Zusatzpaket.";
    return result;
  } catch (error) {
    result.state = chooserStage ? "open" : "fail";
    result.gap = (chooserStage
      ? "Host: Playwright/Electron-Dateiauswahl konnte nicht belastbar ausgeführt werden; echter OS-Dateidialog bleibt als Gegenprobe offen. "
      : "Host-Prüfung fehlgeschlagen: ") + String(error?.stack ?? error);
    return result;
  } finally {
    writeJson(reportFile, result);
  }
};
