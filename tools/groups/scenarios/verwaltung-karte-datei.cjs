// DD-039 in the wider file-management group. Other cases remain open here.
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const fixture = path.resolve(__dirname, "../../../qa/dd039/fixtures/own-object-color.dungeondraft_pack");
const fixtureHash = "df920080409feda5d15194cd8c998553f18a80292762da2f30735ea6b5649088";
const selectedPath = "Dungeons/MapInfoSelectedQA/Karte.dungeon";
const unselectedPath = "Dungeons/MapInfoUnselectedQA/Karte.dungeon";
const packageName = "QA Object Color alpha-solid · Independent QA";
const digest = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");
const writeJson = (file, value) => fs.writeFileSync(file, JSON.stringify(value, null, 2) + "\n");
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

async function mapState(page, mapPath) {
  return page.evaluate((mapPath) => {
    const leaf = app.workspace.getLeavesOfType("dungeon-native-map")
      .find((item) => item.view.file?.path === mapPath);
    const editor = leaf?.view.editor;
    if (!editor) throw new Error(`Karteneditor fehlt: ${mapPath}`);
    return { document: editor.session.document(), dirty: editor.session.dirty,
      history: editor.session.historySize,
      notes: editor.session.draft().notes.map((note) => [note.path, note.current]) };
  }, mapPath);
}

async function openMap(page, mapPath) {
  await page.evaluate(async (mapPath) => {
    const file = app.vault.getAbstractFileByPath(mapPath);
    if (!file) throw new Error(`Karte fehlt: ${mapPath}`);
    await app.workspace.getLeaf(false).openFile(file);
  }, mapPath);
  await page.waitForFunction((mapPath) => app.workspace.getLeavesOfType("dungeon-native-map")
    .some((item) => item.view.file?.path === mapPath && item.view.editor), mapPath);
  await page.locator(".dungeon-native-editor:visible .dn-canvas canvas").last().waitFor();
}

async function saveMap(page, mapPath) {
  const editor = page.locator(".dungeon-native-editor:visible").last();
  await editor.getByRole("button", { name: "Speichern", exact: true }).click();
  await page.waitForFunction((mapPath) => app.workspace.getLeavesOfType("dungeon-native-map")
    .find((item) => item.view.file?.path === mapPath)?.view.editor?.session.dirty === false,
  mapPath);
}

async function openInformation(page) {
  const editor = page.locator(".dungeon-native-editor:visible").last();
  if (!(await editor.evaluate((element) => element.classList.contains("dn-maximized")))) {
    await editor.getByRole("button", { name: "Maximieren", exact: true }).click();
    await page.locator(".dungeon-native-editor.dn-maximized:visible").waitFor();
  }
  const active = page.locator(".dungeon-native-editor:visible").last();
  await active.locator(".dn-group-rail")
    .getByRole("button", { name: "Dungeon", exact: true }).click();
  await active.locator(".dn-tool-rail")
    .getByRole("button", { name: "Karteninformationen", exact: true }).click();
  const modal = page.locator(".modal-container:visible").last();
  await modal.getByText("Karteninformationen", { exact: true }).waitFor();
  return modal;
}

async function inspectInformation({ page, out, vault, mapPath, size, selected, suffix }) {
  const before = await mapState(page, mapPath);
  const mapFile = path.join(vault, mapPath);
  const diskBefore = digest(fs.readFileSync(mapFile));
  const modal = await openInformation(page);
  const wantedPackage = selected ? `1. ${packageName}` : "keine";
  await modal.getByText(wantedPackage, { exact: true }).waitFor();
  const text = await modal.innerText();
  const expectedPath = path.join(vault, mapPath);
  assert(text.includes(`${size.width} × ${size.height} Felder`));
  assert(text.includes(expectedPath), `Vollständiger Dateipfad fehlt: ${expectedPath}`);
  assert(text.includes("Für diese Karte ausgewählte Assetpakete"));
  assert.equal(text.includes(packageName), selected);
  assert.equal(await modal.locator("input, select, textarea").count(), 0,
    "Karteninformation darf keine editierbaren Felder enthalten");
  const screenshot = path.join(out, `${suffix}-information.png`);
  const html = path.join(out, `${suffix}-information.html`);
  await modal.screenshot({ path: screenshot });
  fs.writeFileSync(html, await modal.evaluate((element) => element.outerHTML));
  await modal.getByRole("button", { name: "Schließen", exact: true }).click();
  await modal.waitFor({ state: "detached" });
  assert(same(await mapState(page, mapPath), before));
  assert.equal(digest(fs.readFileSync(mapFile)), diskBefore);
  const closeScreenshot = path.join(out, `${suffix}-after-close.png`);
  await page.screenshot({ path: closeScreenshot });

  const again = await openInformation(page);
  await again.getByText(wantedPackage, { exact: true }).waitFor();
  await again.locator(".modal-header-button:has(svg.lucide-x)").click();
  await again.waitFor({ state: "detached" });
  assert(same(await mapState(page, mapPath), before));
  assert.equal(digest(fs.readFileSync(mapFile)), diskBefore);
  const xScreenshot = path.join(out, `${suffix}-after-x.png`);
  await page.screenshot({ path: xScreenshot });
  return { mapPath, size, selected, fullPath: expectedPath, diskSha256: diskBefore,
    screenshots: { information: screenshot, close: closeScreenshot, x: xScreenshot },
    html, readOnly: true, closeUnchanged: true, xUnchanged: true };
}

async function addFixturePackage(page) {
  const bytes = fs.readFileSync(fixture);
  assert.equal(digest(bytes), fixtureHash);
  await page.evaluate(async (encoded) => {
    const data = Uint8Array.from(atob(encoded), (char) => char.charCodeAt(0));
    const plugin = app.plugins.getPlugin("dungeon-editor");
    await plugin.assets.add([new Blob([data])]);
    await plugin.reloadAssets();
  }, bytes.toString("base64"));
}

async function createMap(page, name, width, height, assetPacks) {
  await page.evaluate(async ({ name, width, height, assetPacks }) => {
    const plugin = app.plugins.getPlugin("dungeon-editor");
    const catalog = await plugin.assets.read();
    await plugin.create(name, width, height,
      { assetPacks, builtInAssets: catalog.builtIns });
  }, { name, width, height, assetPacks });
  await page.locator(".dungeon-native-editor:visible").last()
    .getByRole("button", { name: "Speichern", exact: true }).click();
  await page.waitForFunction((mapPath) => !!app.vault.getAbstractFileByPath(mapPath),
    `Dungeons/${name}/Karte.dungeon`);
  await page.waitForFunction((mapPath) => {
    const editor = app.workspace.getLeavesOfType("dungeon-native-map")
      .find((leaf) => leaf.view.file?.path === mapPath)?.view.editor;
    return !!editor && !editor.session.mutationsHeld;
  }, `Dungeons/${name}/Karte.dungeon`);
  await openMap(page, `Dungeons/${name}/Karte.dungeon`);
}

async function addUnselectedReference(page, mapPath) {
  await page.evaluate((mapPath) => {
    const plugin = app.plugins.getPlugin("dungeon-editor");
    const editor = app.workspace.getLeavesOfType("dungeon-native-map")
      .find((item) => item.view.file?.path === mapPath)?.view.editor;
    if (!editor) throw new Error("Karteneditor für Assetreferenz fehlt");
    const asset = plugin.listAssets(["QAObjASl"])
      .find((item) => item.name === "QA Object Color");
    if (!asset) throw new Error("QA-Assetreferenz fehlt");
    const session = editor.session;
    const object = { id: "qa-map-info-remaining-asset", kind: "object",
      floorId: session.floors.keys().next().value, x: 4, y: 4,
      rotation: 0, width: 1, height: 1, color: 0xffffff,
      label: "", assetId: asset.id };
    session.execute({ label: "QA-Paketreferenz ohne Auswahl",
      entities: [{ id: object.id, before: null, after: object }] });
  }, mapPath);
  const state = await mapState(page, mapPath);
  assert.deepEqual(state.document.settings.assetPacks, []);
  assert(state.document.entities.some((item) =>
    item.id === "qa-map-info-remaining-asset" && item.assetId));
}

module.exports = async function mapInformationGroup({ page, out, qa, vault, restart, group, record }) {
  assert.equal(group.id, "verwaltung-karte-datei");
  if (process.env.DUNGEON_QA_ONLY_DD00104 === "1")
    return require("./dd00104-first-save.cjs")({
      page, out, qa, vault, restart, group, record,
    });
  if (process.env.DUNGEON_QA_ONLY_DD001002 === "1")
    return require("./dd001002-map-start.cjs")({
      page, out, qa, vault, restart, group, record,
    });
  const resize = require("./dd038-map-size.cjs");
  if (process.env.DUNGEON_QA_ONLY_DD038 === "1")
    return resize({ page, out, qa, vault, restart, group, record });
  const results = [];
  if (!restart) {
    await addFixturePackage(page);
    await createMap(page, "MapInfoSelectedQA", 9, 10, ["QAObjASl"]);
    results.push(await inspectInformation({ page, out, vault, mapPath: selectedPath,
      size: { width: 9, height: 10 }, selected: true, suffix: "selected" }));
    await saveMap(page, selectedPath);
    await createMap(page, "MapInfoUnselectedQA", 8, 8, []);
    await addUnselectedReference(page, unselectedPath);
    results.push(await inspectInformation({ page, out, vault, mapPath: unselectedPath,
      size: { width: 8, height: 8 }, selected: false, suffix: "unselected" }));
    await saveMap(page, unselectedPath);
  } else {
    await openMap(page, selectedPath);
    results.push(await inspectInformation({ page, out, vault, mapPath: selectedPath,
      size: { width: 9, height: 10 }, selected: true, suffix: "selected-reopened" }));
    await openMap(page, unselectedPath);
    const state = await mapState(page, unselectedPath);
    assert.deepEqual(state.document.settings.assetPacks, []);
    assert(state.document.entities.some((item) =>
      item.id === "qa-map-info-remaining-asset" && item.assetId));
    results.push(await inspectInformation({ page, out, vault, mapPath: unselectedPath,
      size: { width: 8, height: 8 }, selected: false, suffix: "unselected-reopened" }));
  }
  const resultFile = path.join(out, "dd039-map-information.json");
  writeJson(resultFile, { phase: restart ? "reopen" : "edit", results });
  const evidence = [resultFile, ...results.flatMap((item) =>
    [item.screenshots.information, item.html])];
  record.add("DD-039.01", "pass",
    "Dungeon → Karteninformationen öffnet einen eigenständigen, lesenden Informationsdialog.", evidence);
  record.add("DD-039.02", "pass",
    "Kartengröße zeigt für beide Karten die gespeicherten 9 × 10 bzw. 8 × 8 Felder.", evidence);
  record.add("DD-039.03", "pass",
    "Dateiname zeigt für beide Karten den tatsächlichen vollständigen Dateipfad.", evidence);
  record.add("DD-039.04", "pass",
    "Ausgewähltes Paket erscheint mit Name und Autor; die abgewählte Karte nennt es trotz gespeicherter Assetreferenz nicht.", evidence);
  record.add("DD-039.05", "pass",
    "Schließen lässt beide Dokumente, Dirty-Flags, History, Notizen und Kartendateien unverändert.",
    [resultFile, ...results.map((item) => item.screenshots.close)]);
  record.add("DD-039.06", "pass",
    "X lässt beide Dokumente, Dirty-Flags, History, Notizen und Kartendateien unverändert.",
    [resultFile, ...results.map((item) => item.screenshots.x)]);
  if (process.env.DUNGEON_QA_ONLY_DD039 !== "1")
    await resize({ page, out, qa, vault, restart, group, record });
};
