// Bounded DD-038 probe inside verwaltung-karte-datei; no other file cases asserted.
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const mapPath = "Dungeons/ResizeQA/Karte.dungeon";
const polygonId = "qa-dd038-original-polygons";
const nativePolygons = [
  [[6, 7.25], [1, 7.25], [1, 7], [6, 7]],
  [[5.25, 2], [4.25, 2], [4.25, 1], [5.25, 1]],
  [[2, 2], [1, 2], [1, 1], [2, 1]],
  [[3.25, 2], [2.25, 2], [2.25, 1], [3.25, 1]],
].map((outer) => ({ outer: outer.map(([x, y]) => ({ x, y })), holes: [] }));
const digest = (file) => crypto.createHash("sha256")
  .update(fs.readFileSync(file)).digest("hex");
const writeJson = (file, value) => fs.writeFileSync(file, JSON.stringify(value, null, 2) + "\n");
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);

async function openMap(page) {
  await page.evaluate(async (mapPath) => {
    const file = app.vault.getAbstractFileByPath(mapPath);
    if (!file) throw new Error(`Resize-Karte fehlt: ${mapPath}`);
    await app.workspace.getLeaf(false).openFile(file);
  }, mapPath);
  await page.waitForFunction((mapPath) => app.workspace.getLeavesOfType("dungeon-native-map")
    .some((item) => item.view.file?.path === mapPath && item.view.editor), mapPath);
  await page.locator(".dungeon-native-editor:visible .dn-canvas canvas").waitFor();
}

async function state(page) {
  return page.evaluate((mapPath) => {
    const editor = app.workspace.getLeavesOfType("dungeon-native-map")
      .find((item) => item.view.file?.path === mapPath)?.view.editor;
    if (!editor) throw new Error("Resize-Editor fehlt");
    const surface = editor.session.entities.get("qa-dd038-original-polygons");
    return { settings: editor.session.settings, polygons: surface?.polygons,
      document: editor.session.document(), dirty: editor.session.dirty,
      history: editor.session.historySize, canUndo: editor.session.canUndo,
      canRedo: editor.session.canRedo,
      notes: editor.session.draft().notes.map((item) => [item.path, item.current]) };
  }, mapPath);
}

function shifted(polygons, dx, dy) {
  return polygons.map((polygon) => ({
    outer: polygon.outer.map(({ x, y }) => ({ x: x + dx, y: y + dy })),
    holes: polygon.holes.map((hole) =>
      hole.map(({ x, y }) => ({ x: x + dx, y: y + dy }))),
  }));
}

async function createMap(page) {
  await page.evaluate(async () => {
    const plugin = app.plugins.getPlugin("dungeon-editor");
    await plugin.create("ResizeQA", 12, 8);
  });
  await openMap(page);
  await page.evaluate(({ mapPath, polygonId, nativePolygons }) => {
    const editor = app.workspace.getLeavesOfType("dungeon-native-map")
      .find((item) => item.view.file?.path === mapPath)?.view.editor;
    if (!editor) throw new Error("Resize-Karte wurde nicht geöffnet");
    editor.session.execute({ label: "QA-Originalpolygone",
      entities: [{ id: polygonId, before: null, after: {
        id: polygonId, floorId: editor.session.floors.keys().next().value,
        kind: "surface", category: "material", polygons: nativePolygons,
        layer: 100, color: 0xbfb09a, wallColor: 0x403e39, wallWidth: 0.2,
      } }] });
  }, { mapPath, polygonId, nativePolygons });
}

async function save(page) {
  await page.locator(".dungeon-native-editor:visible").last()
    .getByRole("button", { name: "Speichern", exact: true }).click();
  await page.waitForFunction((mapPath) => app.workspace.getLeavesOfType("dungeon-native-map")
    .find((item) => item.view.file?.path === mapPath)?.view.editor?.session.dirty === false,
  mapPath);
}

async function openResize(page) {
  const editor = page.locator(".dungeon-native-editor:visible").last();
  if (!(await editor.evaluate((element) => element.classList.contains("dn-maximized")))) {
    await editor.getByRole("button", { name: "Maximieren", exact: true }).click();
    await page.locator(".dungeon-native-editor.dn-maximized:visible").waitFor();
  }
  const active = page.locator(".dungeon-native-editor:visible").last();
  await active.locator(".dn-group-rail")
    .getByRole("button", { name: "Dungeon", exact: true }).click();
  await active.locator(".dn-tool-rail")
    .getByRole("button", { name: "Einstellungen", exact: true }).click();
  const modal = page.locator(".modal-container:visible").last();
  await modal.getByText("Kartengröße ändern", { exact: true }).waitFor();
  return modal;
}

async function setMargin(modal, label, amount) {
  await modal.locator(".setting-item").filter({ hasText: `${label} in Feldern` })
    .locator("input").fill(String(amount));
}

async function applyResize(modal) {
  await modal.getByRole("button", { name: "Übernehmen", exact: true }).click();
  await modal.waitFor({ state: "detached" });
}

module.exports = async function resizeMapGroup({ page, out, vault, restart, group, record }) {
  assert.equal(group.id, "verwaltung-karte-datei");
  const mapFile = path.join(vault, mapPath);
  const report = { phase: restart ? "reopen" : "edit", original: {
    tileCells: "10 → 6 → 6 after left -3 then +3 on 12×8 source",
    shapePolygons: "four polygons / 16 points translate then restore exactly",
  }, observations: {} };
  if (!restart) {
    await createMap(page);
    const initial = await state(page);
    assert.equal(initial.settings.width, 12);
    assert.equal(initial.settings.height, 8);
    assert.deepEqual(initial.polygons, nativePolygons);
    await save(page);
    const beforeCancel = await state(page);
    const diskBeforeCancel = digest(mapFile);
    const cancelled = await openResize(page);
    const controls = {};
    for (const label of ["Oben", "Rechts", "Unten", "Links"])
      controls[label] = await cancelled.locator(".setting-item")
        .filter({ hasText: `${label} in Feldern` }).locator("input").count();
    assert(Object.values(controls).every((count) => count === 1));
    await setMargin(cancelled, "Oben", 2);
    await setMargin(cancelled, "Rechts", 1);
    await setMargin(cancelled, "Unten", 1);
    await setMargin(cancelled, "Links", 1);
    await cancelled.getByText("Neue Größe: 14 × 11 Felder", { exact: true }).waitFor();
    report.observations.warningVisible = /cannot undo|nicht rückgängig/i
      .test(await cancelled.innerText());
    report.observations.cancelButtonVisible = await cancelled
      .getByRole("button", { name: /^(Cancel|Abbrechen)$/ }).count() > 0;
    const preview = path.join(out, "dd038-four-fields-preview.png");
    await cancelled.screenshot({ path: preview });
    await cancelled.locator(".modal-header-button:has(svg.lucide-x)").click();
    await cancelled.waitFor({ state: "detached" });
    assert(equal(await state(page), beforeCancel));
    assert.equal(digest(mapFile), diskBeforeCancel);
    report.observations.cancelled = { controls, preview, unchanged: true };

    const cancelButton = await openResize(page);
    await setMargin(cancelButton, "Links", -1);
    await cancelButton.getByRole("button", { name: "Abbrechen", exact: true }).click();
    await cancelButton.waitFor({ state: "detached" });
    assert(equal(await state(page), beforeCancel));
    assert.equal(digest(mapFile), diskBeforeCancel);
    report.observations.cancelButtonUnchanged = true;

    const crop = await openResize(page);
    await setMargin(crop, "Links", -3);
    await crop.getByText("Neue Größe: 9 × 8 Felder", { exact: true }).waitFor();
    const cropPreview = path.join(out, "dd038-left-crop-preview.png");
    await crop.screenshot({ path: cropPreview });
    await applyResize(crop);
    const afterCrop = await state(page);
    assert.equal(afterCrop.settings.width, 9);
    assert.equal(afterCrop.settings.height, 8);
    assert.deepEqual(afterCrop.polygons, shifted(nativePolygons, -3, 0));
    assert.equal(afterCrop.canUndo, false);
    assert.equal(afterCrop.canRedo, false);
    report.observations.crop = { size: [9, 8], preview: cropPreview,
      polygons: afterCrop.polygons, historyDelta: afterCrop.history - beforeCancel.history };
    await save(page);
    report.observations.croppedDiskSha256 = digest(mapFile);
  } else {
    await openMap(page);
    const cropped = await state(page);
    assert.equal(cropped.settings.width, 9);
    assert.equal(cropped.settings.height, 8);
    assert.deepEqual(cropped.polygons, shifted(nativePolygons, -3, 0));
    report.observations.croppedDiskSha256 = digest(mapFile);
    const freshCancel = await openResize(page);
    await setMargin(freshCancel, "Rechts", 1);
    await freshCancel.getByText("Neue Größe: 10 × 8 Felder", { exact: true }).waitFor();
    await freshCancel.locator(".modal-header-button:has(svg.lucide-x)").click();
    await freshCancel.waitFor({ state: "detached" });
    assert(equal(await state(page), cropped));
    assert.equal(digest(mapFile), report.observations.croppedDiskSha256);
    report.observations.freshXUnchanged = true;
    const expand = await openResize(page);
    report.observations.warningVisible = /cannot undo|nicht rückgängig/i
      .test(await expand.innerText());
    await setMargin(expand, "Links", 3);
    await expand.getByText("Neue Größe: 12 × 8 Felder", { exact: true }).waitFor();
    await applyResize(expand);
    const expanded = await state(page);
    assert.equal(expanded.settings.width, 12);
    assert.equal(expanded.settings.height, 8);
    assert.deepEqual(expanded.polygons, nativePolygons);
    assert.equal(expanded.canUndo, false);
    assert.equal(expanded.canRedo, false);
    report.observations.reexpanded = { size: [12, 8],
      polygonsRestored: true, historyDelta: expanded.history - cropped.history };
    await page.evaluate((mapPath) => {
      const session = app.workspace.getLeavesOfType("dungeon-native-map")
        .find((item) => item.view.file?.path === mapPath).view.editor.session;
      session.undo();
    }, mapPath);
    const undone = await state(page);
    report.observations.undoPossible = undone.settings.width === 9 &&
      equal(undone.polygons, shifted(nativePolygons, -3, 0));
    await page.evaluate((mapPath) => {
      const session = app.workspace.getLeavesOfType("dungeon-native-map")
        .find((item) => item.view.file?.path === mapPath).view.editor.session;
      session.redo();
    }, mapPath);
    assert.deepEqual((await state(page)).document, expanded.document);
    const top = await openResize(page);
    await setMargin(top, "Oben", 2);
    await setMargin(top, "Links", 1);
    await top.getByText("Neue Größe: 13 × 10 Felder", { exact: true }).waitFor();
    await applyResize(top);
    const shiftedTop = await state(page);
    assert.equal(shiftedTop.settings.width, 13);
    assert.equal(shiftedTop.settings.height, 10);
    assert.deepEqual(shiftedTop.polygons, shifted(nativePolygons, 1, 2));
    report.observations.expandedTopLeft = { size: [13, 10],
      polygonsTranslatedBy: [1, 2] };
    await save(page);
    report.observations.finalDiskSha256 = digest(mapFile);
  }
  const resultFile = path.join(out, "dd038-map-size.json");
  writeJson(resultFile, report);
  const evidence = [resultFile];
  record.add("DD-038.01", "open",
    "Dungeon → Einstellungen öffnet vier getrennte Randfelder und die berechnete neue Größe.", evidence,
    "Vollständige Kartenwirkung weiterer Elementarten und globale Eingabegrenzen bleiben offen.");
  record.add("DD-038.02", "open",
    restart ? "Im Frischstartlauf verschiebt Oben +2 alle 16 Polygonpunkte um zwei Felder."
      : "Oben +2 wurde zunächst nur in der Vorschau und per X-Abbruch geprüft.", evidence,
    restart ? "Der neu gespeicherte Top-Resize wurde in keinem weiteren frischen Prozess geöffnet."
      : "Angewandte Top-Geometrie folgt erst im Frischstartabschnitt.");
  record.add("DD-038.03", "open",
    "Rechts +1 wird als getrenntes Randfeld in der Größen-Vorschau verarbeitet.", evidence,
    "Direkte Original-Dateiwirkung und gleicher Host-Commit für einen rechten Rand fehlen.");
  record.add("DD-038.04", "open",
    "Unten +1 wird als getrenntes Randfeld in der Größen-Vorschau verarbeitet.", evidence,
    "Direkte Original-Dateiwirkung und gleicher Host-Commit für einen unteren Rand fehlen.");
  record.add("DD-038.05", "open",
    "Links -3 schneidet die Kartengröße 12×8 auf 9×8 und verschiebt vier Polygone um -3; +3 stellt sie wieder her.", evidence,
    "Das Original verwirft dabei 4 von 10 Tile-Zellen dauerhaft; dem Editor fehlt ein getrenntes Tile-Zellmodell für den Hostvergleich.");
  const undoEquivalent = report.observations.warningVisible &&
    (restart ? !report.observations.undoPossible : report.observations.crop.historyDelta < 0);
  record.add("DD-038.06", undoEquivalent ? "open" : "deviation",
    `Nicht-Undo-Warnung sichtbar=${report.observations.warningVisible}; ` +
      (restart ? `Resize per Undo umkehrbar=${report.observations.undoPossible}.`
        : `History-Zuwachs nach Resize=${report.observations.crop.historyDelta}.`), evidence,
    undoEquivalent ? "Eine neue Aktion nach Resize und deren Undo wurde im Original noch nicht geprüft."
      : "Das Original sperrt nach Resize auch vorherige Undo-Schritte.");
  record.add("DD-038.07", "open",
    restart ? "Übernehmen schreibt die angezeigte Größe und verschiebt Polygonkoordinaten; der gespeicherte linke Beschnitt überstand die Frischöffnung."
      : "Übernehmen schreibt die angezeigte Größe und verschiebt Polygonkoordinaten; Speichern wurde ausgeführt.", evidence,
    restart ? "Weitere Randrichtungen und Elementarten sind noch nicht gleichwertig verglichen."
      : "Frisches Öffnen des gespeicherten Ergebnisses folgt im zweiten Lauf.");
  record.add("DD-038.08", "open",
    restart ? "Der Abbruchknopf wurde im Bearbeitungslauf geprüft."
      : "Abbrechen und X verwerfen unbestätigte Randwerte ohne Datei- oder Sessionänderung.", evidence,
    "Die Cancel-Wirkung auf Karte und History im Original ist noch nicht direkt gemessen.");
  record.add("DD-038.09", "open",
    restart ? "X verwirft auch nach Frischöffnung die Eingabe Rechts +1 ohne Änderung von Dokument, History oder Datei."
      : "X verwirft alle vier eingegebenen Randwerte ohne Änderung von Dokument, History oder Datei.", evidence,
    "Die X-Wirkung auf Karte und History im Original ist noch nicht direkt gemessen.");
};
